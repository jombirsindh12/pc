require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const config = require('./utils/config');

// Ensure required directories exist
const LOGS_DIR = path.join(__dirname, '.logs');
const TEMP_DIR = path.join(__dirname, 'temp');

// Create directories if they don't exist
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    console.log('Created logs directory');
  }
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log('Created temp directory');
  }
  
  // Ensure the config directories also exist
  config.ensureDirectories();
} catch (error) {
  console.error('Error creating required directories:', error);
}

// Create a new client instance with ALL required intents
// Fixed with proper Discord.js v14 Partials and ActivityType
const { Partials, ActivityType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  // Enable all privileged intents
  presence: {
    status: 'online',
    activities: [{ name: '/help', type: ActivityType.Watching }]
  },
  // Ensure we receive all events with proper enums for v14
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// Load commands
client.commands = new Collection();
client.slashCommands = new Collection();

// Prepare to register slash commands 
const slashCommands = [];

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
  console.log(`Loaded command: ${command.name}`);
  
  // Add command to slash commands collection
  client.slashCommands.set(command.name, command);
  
  // Register slash command data
  if (command.data) {
    try {
      // Get proper command data from SlashCommandBuilder
      const jsonData = command.data.toJSON();
      slashCommands.push(jsonData);
      console.log(`Registered slash command: ${jsonData.name}`);
    } catch (error) {
      console.error(`Error processing slash command data for ${command.name}:`, error);
      
      // Fallback to basic command format
      slashCommands.push({
        name: command.name,
        description: command.description || `${command.name} command`,
        options: command.options || []
      });
    }
  } else if (command.options) {
    // Legacy format with options array
    slashCommands.push({
      name: command.name,
      description: command.description || `${command.name} command`,
      options: command.options
    });
  } else {
    // Basic command with no options
    slashCommands.push({
      name: command.name,
      description: command.description || `${command.name} command`
    });
  }
}

// Bot ready event
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready!');
  
  try {
    // Create REST instance for registering commands
    const rest = new REST({ version: '10' }).setToken(client.token);
    
    // Transform regular commands to slash commands
    console.log('Started refreshing application (/) commands.');
    
    // Register all slash commands
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands }
    );
    
    console.log('Successfully registered application (/) commands.');
    
    // Initialize verification collectors from security.js
    if (client.commands.has('security')) {
      const securityCommand = client.commands.get('security');
      if (typeof securityCommand.setupAllVerificationCollectors === 'function') {
        securityCommand.setupAllVerificationCollectors(client);
      } else {
        console.log('Setting up verification collectors from parent module');
        const setupVerificationCollectors = require('./commands/security').setupAllVerificationCollectors;
        if (typeof setupVerificationCollectors === 'function') {
          setupVerificationCollectors(client);
        }
      }
    }
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

// Interaction event handler for slash commands
client.on(Events.InteractionCreate, async interaction => {
  // Check if it's a command
  if (!interaction.isCommand()) return;
  
  const { commandName } = interaction;
  
  console.log(`Slash command received: ${commandName}`);
  
  // Get the slash command
  const command = client.slashCommands.get(commandName);
  
  if (!command) {
    console.log(`Unknown slash command: ${commandName}`);
    return;
  }
  
  try {
    // Add detailed debug info for channel detection
    console.log(`Command execution info: ${commandName} | channel.type: ${interaction.channel?.type} | guildId: ${interaction.guildId} | channelId: ${interaction.channelId}`);
    
    // Create a mock message object for backward compatibility
    const mockMessage = {
      author: interaction.user,
      member: interaction.member,
      channel: interaction.channel,
      guild: interaction.guild,
      reply: async (content) => {
        // If interaction hasn't been replied to yet, use reply
        // Otherwise use followUp
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply(content);
        } else {
          return await interaction.followUp(content);
        }
      }
    };
    
    // Extract arguments from options
    const args = [];
    if (interaction.options && interaction.options.data.length > 0) {
      interaction.options.data.forEach(option => {
        if (option.value !== undefined) {
          args.push(option.value.toString());
        }
      });
    }
    
    // Call the original command with our mock message
    await command.execute(mockMessage, args, client, interaction);
    
  } catch (error) {
    console.error(`Error executing slash command ${commandName}:`, error);
    
    try {
      // Reply with error if interaction hasn't been responded to
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error executing this command.', 
          ephemeral: true 
        });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.followUp({ 
          content: 'There was an error executing this command.', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error(`Error sending error response: ${replyError.message}`);
    }
  }
});

// Message event handler for legacy commands
client.on(Events.MessageCreate, async message => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if we're in a DM
  const isDM = message.channel.type === 1; // Discord.js v14 uses numeric types, DM is 1
  
  if (isDM) {
    // Handle DM commands with default prefix
    const prefix = '!';
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      if (!client.commands.has(commandName)) {
        return message.reply("I don't understand that command. Try !help for a list of available commands.");
      }
      
      try {
        await client.commands.get(commandName).execute(message, args, client);
      } catch (error) {
        console.error(`Error executing DM command ${commandName}:`, error);
        message.reply('Error executing that command.');
      }
    }
    return;
  }
  
  // Message is in a server
  if (!message.guild || !message.guild.id) {
    console.warn(`Warning: message.guild is missing in a non-DM channel`);
    return;
  }

  // Get server config for prefix
  const serverConfig = config.getServerConfig(message.guild.id);
  const prefix = serverConfig.prefix || '!';
  
  // Handle verification channel logic
  if (serverConfig.verificationChannelId && message.channel.id === serverConfig.verificationChannelId) {
    // Verification logic for image processing would go here
    // (This is just a placeholder - implement your actual verification logic)
    if (message.attachments.size > 0) {
      console.log("Verification image received");
    }
  }
  
  // Handle regular commands
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    if (!client.commands.has(commandName)) return;
    
    try {
      await client.commands.get(commandName).execute(message, args, client);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      message.reply('There was an error trying to execute that command!');
    }
  }
});

// Login to Discord with the bot token
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Successfully logged in to Discord!');
  console.log(`Bot is in ${client.guilds.cache.size} servers`);
  
  // Set up uptime manager after successful login
  try {
    const uptimeManager = require('./utils/uptimeManager');
    uptimeManager.setupUptimeManager(client);
  } catch (error) {
    console.error('Error setting up uptime manager:', error);
  }
  
  // Set up security monitoring
  try {
    console.log('Starting security monitoring for all servers...');
    const securityManager = require('./utils/securityManager');
    securityManager.startSecurityMonitoring(client);
    console.log('Security monitoring active for all servers - checking for nukes, raids and spam');
  } catch (error) {
    console.error('Error setting up security monitoring:', error);
  }
  
  console.log('Discord-native dashboard is available via /dashboard command');
}).catch(error => {
  console.error('Error during login:', error);
});

function safelyWriteToLog(logFile, message) {
  try {
    fs.appendFileSync(
      path.join(LOGS_DIR, logFile),
      `[${new Date().toISOString()}] ${message}\n`
    );
  } catch (error) {
    console.error(`Error writing to log ${logFile}:`, error);
  }
}

// Global error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  safelyWriteToLog('error.log', `Uncaught Exception: ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  safelyWriteToLog('error.log', `Unhandled Rejection: ${reason}`);
});