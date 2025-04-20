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
  
  // Create slash command data
  const slashCommand = {
    name: command.name,
    description: command.description || `${command.name} command`,
    options: command.options || [],
    
    // Convert regular command to slash command
    execute: async (interaction, client) => {
      // Get server config if in a guild
      let serverId = null;
      let serverConfig = null;
      
      // In Discord.js v14, we can use either interaction.guild or interaction.guildId
      // Using guildId is safer as it's a primitive and won't cause any reference issues
      const isInGuild = Boolean(interaction.guildId);
      
      if (isInGuild) {
        serverId = interaction.guildId;
        // Initialize serverConfig with guild ID - important for commands
        serverConfig = config.getServerConfig(serverId);
        
        // Make sure guild property is correctly initialized for backward compatibility
        if (!interaction.guild && interaction.guildId) {
          console.log(`Warning: interaction.guild was null but guildId exists: ${interaction.guildId}`);
        }
      }
      
      try {
        // Check if the command requires admin permissions and is in a guild
        if (command.requiresAdmin) {
          // If not in a guild, can't be an admin
          if (!isInGuild) {
            return interaction.reply({
              content: '❌ This command can only be used in a server!',
              ephemeral: true
            });
          }
          
          // Additional safety check for member object
          if (!interaction.member || typeof interaction.member.permissions?.has !== 'function') {
            console.error('Invalid member or permissions object:', interaction.member);
            return interaction.reply({
              content: '❌ Error checking permissions. Please try again.',
              ephemeral: true
            });
          }
          
          // Check if the user has admin permissions
          if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
              content: '❌ You need Administrator permissions to use this command.',
              ephemeral: true
            });
          }
        }
        
        // We no longer block guild-only commands even in DMs
        // This fixes the "This command can only be used in a server!" issue
        // Each command will handle its own requirements now
        
        // DO NOT defer reply here - let the command handle it
        // Each command will decide if it needs to defer based on its operation
        
        // Create a mock message object for backward compatibility
        const mockMessage = {
          author: interaction.user,
          member: interaction.member,
          channel: interaction.channel,
          guild: interaction.guild,
          reply: (content) => {
            // If interaction hasn't been replied to yet, use reply
            // Otherwise use followUp
            if (!interaction.replied && !interaction.deferred) {
              return interaction.reply(content);
            } else {
              return interaction.followUp(content);
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
        console.error(`Error executing slash command ${command.name}:`, error);
        
        // Reply with error if not already replied
        if (interaction.deferred && !interaction.replied) {
          await interaction.followUp({
            content: 'There was an error executing this command.',
            ephemeral: true
          });
        }
      }
    }
  };
  
  // Add slash command to collection and command list
  client.slashCommands.set(slashCommand.name, slashCommand);
  slashCommands.push({
    name: slashCommand.name,
    description: slashCommand.description,
    options: slashCommand.options
  });
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
    
    // GLOBAL DEFERRED REPLY: Add this to every slash command to prevent "Phantom guard is thinking" issues
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(err => {
        console.error(`Failed to defer reply for ${commandName}: ${err}`);
      });
    }
    
    // Check if the guildId exists but interaction.guild is null (this is the core issue)
    if (interaction.guildId && !interaction.guild) {
      console.warn(`Warning: interaction.guild was null but guildId exists: ${interaction.guildId}`);
    }
    
    // Make sure we have a proper guild object resolved before proceeding
    const resolvedGuild = interaction.guild || (interaction.guildId ? await client.guilds.fetch(interaction.guildId).catch(err => {
      console.error(`Failed to fetch guild for ${interaction.guildId}: ${err}`);
      return null;
    }) : null);
    
    // Execute the slash command and get mock interaction to wrap the command
    // This helps prevent the double-reply issue
    const mockInteraction = {
      ...interaction,
      responded: false,
      deferredReply: false,
      guild: resolvedGuild, // Use our manually resolved guild
      
      // Fix for channel type detection - add missing properties for channel type handling
      channel: {
        ...interaction.channel,
        type: interaction.channel?.type,
        guild: resolvedGuild // Use our manually resolved guild here too
      },
      
      // Override reply method to track response state
      reply: async (options) => {
        if (interaction.replied || interaction.deferred) {
          console.log(`Using followUp instead of reply for ${commandName}`);
          return interaction.followUp(options);
        }
        mockInteraction.responded = true;
        return interaction.reply(options);
      },
      
      // Override deferReply method to track deferred state
      deferReply: async (options) => {
        if (!interaction.deferred && !interaction.replied) {
          mockInteraction.deferredReply = true;
          return interaction.deferReply(options);
        } else {
          return Promise.resolve(); // Already deferred or replied
        }
      },
      
      // Pass-through methods for other interaction functions
      followUp: interaction.followUp.bind(interaction),
      editReply: interaction.editReply.bind(interaction),
      deleteReply: interaction.deleteReply.bind(interaction)
    };
    
    // Execute the slash command with our mock wrapper
    await command.execute(mockInteraction, client);
  } catch (error) {
    console.error(`Error executing slash command ${commandName}:`, error);
    
    try {
      // Reply with error if interaction hasn't been responded to
      if (interaction.deferred && !interaction.replied) {
        await interaction.followUp({ 
          content: 'There was an error executing this command.', 
          ephemeral: true 
        });
      } else if (!interaction.replied) {
        await interaction.reply({ 
          content: 'There was an error executing this command.', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error(`Error sending error response: ${replyError.message}`);
    }
  }
});

// Message event handler (keeping for backward compatibility and image verification)
client.on(Events.MessageCreate, async message => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if we're in a DM
  const isDM = message.channel.type === 1; // Discord.js v14 uses numeric types, DM is 1
  
  // Skip server-specific handling for DMs
  if (isDM) {
    console.log(`DM received from ${message.author.tag}: ${message.content}`);
    // Use default prefix for DMs
    const prefix = '!';
    
    // Check if it's a command
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      console.log(`DM command received: ${commandName}, Arguments: ${args.join(', ')}`);
      
      if (!client.commands.has(commandName)) {
        message.reply("I don't understand that command. Try sending !help for a list of available commands.");
        return;
      }
      
      const command = client.commands.get(commandName);
      
      try {
        command.execute(message, args, client);
      } catch (error) {
        console.error(`Error executing DM command ${commandName}:`, error);
        message.reply('There was an error executing that command.');
      }
    }
    return;
  }
  
  // We're in a server (not DM)
  // Make sure we have a valid guild before proceeding
  if (!message.guild || !message.guild.id) {
    console.warn(`Warning: message.guild is missing in a non-DM channel type ${message.channel.type}`);
    return;
  }

  // Now safely load server configuration
  const serverConfig = config.getServerConfig(message.guild.id);
  const prefix = serverConfig.prefix || '!';

  // Enhanced verification channel logic
  if (serverConfig.verificationChannelId && message.channel.id === serverConfig.verificationChannelId) {
    // Check if the message has an attachment (image)
    if (message.attachments.size > 0) {
      const imageProcessor = require('./utils/imageProcessor');
      const youtubeAPI = require('./utils/youtubeAPI');
      
      try {
        // Get first attachment
        const attachment = message.attachments.first();
        
        // Check if attachment is an image
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          // Send status message with nice emoji
          const statusMsg = await message.reply('🔍 **Processing your verification image...**\nPlease wait while I check your YouTube subscription.');
          console.log(`Processing verification image from user ${message.author.tag} (${message.author.id})`);
          
          // Process the image
          const imageUrl = attachment.url;
          console.log(`Image URL: ${imageUrl}`);
          
          // Add visual feedback
          await statusMsg.edit('🔍 **Processing your verification image...**\n⏳ Analyzing screenshot...');
          
          // Process the image to get hash and verify
          const result = await imageProcessor.processImage(imageUrl);
          console.log('Image processing result:', JSON.stringify(result, null, 2));
          
          // Check if this image has been verified before
          if (result.imageHash && serverConfig.verifiedImages && serverConfig.verifiedImages[result.imageHash]) {
            const previousVerification = serverConfig.verifiedImages[result.imageHash];
            const verifiedByUsername = previousVerification.username || 'another user';
            const verifiedAt = new Date(previousVerification.timestamp).toLocaleString();
            
            await statusMsg.edit(`⚠️ **This image has been used before!**\nThis exact image was already verified by **${verifiedByUsername}** on **${verifiedAt}**.\nPlease take a new screenshot of your subscription.`);
            return;
          }
          
          // Update status message
          await statusMsg.edit('🔍 **Processing your verification image...**\n✅ Image analyzed\n⏳ Verifying subscription...');
          
          // If image processing succeeded and we have a YouTube channel configured
          if (result && result.success === true && serverConfig.youtubeChannelId) {
            console.log(`Verification proceeding with channel ID: ${serverConfig.youtubeChannelId}`);
            
            // Get channel info for better messaging
            let channelInfo = null;
            try {
              channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
              console.log('Channel info for verification:', channelInfo);
              
              // Save channel name for future reference if we got it successfully
              if (channelInfo && channelInfo.title) {
                config.updateServerConfig(message.guild.id, {
                  youtubeChannelName: channelInfo.title
                });
              }
            } catch (error) {
              console.error('Error fetching channel info during verification:', error);
            }
            
            // Verify subscription with YouTube API
            const isSubscribed = await youtubeAPI.verifySubscription(
              result.userId, 
              serverConfig.youtubeChannelId
            );
            
            console.log(`Subscription verification result: ${isSubscribed ? 'Subscribed' : 'Not subscribed'}`);
            
            if (isSubscribed) {
              // Add role to user if role is set
              if (serverConfig.roleId) {
                try {
                  console.log(`Attempting to assign role ID ${serverConfig.roleId} to user ${message.author.id}`);
                  
                  // Final status update before role assignment
                  await statusMsg.edit('🔍 **Processing your verification image...**\n✅ Image analyzed\n✅ Subscription verified\n⏳ Assigning role...');
                  
                  await message.member.roles.add(serverConfig.roleId);
                  
                  // Success message with channel name (if available)
                  const channelName = channelInfo?.title || serverConfig.youtubeChannelName || 'the YouTube channel';
                  await statusMsg.edit(`✅ **Verification Successful!**\nYou have been verified as a subscriber to **${channelName}**.\nYou have been assigned the **${serverConfig.roleName || 'Subscriber'}** role!`);
                  
                  // Store this verified image hash to prevent reuse
                  if (result.imageHash) {
                    // Create verifiedImages object if it doesn't exist
                    const verifiedImages = serverConfig.verifiedImages || {};
                    
                    // Store verification details
                    verifiedImages[result.imageHash] = {
                      userId: message.author.id,
                      username: message.author.tag,
                      timestamp: new Date().toISOString(),
                      guildId: message.guild.id
                    };
                    
                    // Update server config with new verified image
                    config.updateServerConfig(message.guild.id, {
                      verifiedImages: verifiedImages
                    });
                    
                    console.log(`Saved verified image hash: ${result.imageHash} for user ${message.author.tag}`);
                  }
                  
                  // Send notification if a notification channel is set
                  if (serverConfig.notificationChannelId) {
                    const notificationChannel = message.guild.channels.cache.get(serverConfig.notificationChannelId);
                    if (notificationChannel) {
                      notificationChannel.send(`🎉 **${message.author.tag}** has verified their subscription to **${channelName}**!`);
                    }
                  }
                } catch (error) {
                  console.error('Error assigning role:', error);
                  await statusMsg.edit('⚠️ **Verification Partially Successful**\nYour subscription was verified, but I could not assign the role. Please contact an administrator.');
                }
              } else {
                console.log('No role ID configured for this server');
                await statusMsg.edit('✅ **Verification Successful!**\nHowever, no subscriber role has been set up yet. Please ask an administrator to set up a role using `/setrole`.');
              }
            } else {
              const channelName = channelInfo?.title || serverConfig.youtubeChannelName || 'the YouTube channel';
              await statusMsg.edit(`❌ **Verification Failed**\nCould not confirm your subscription to **${channelName}**.\nPlease make sure you are subscribed and try again with a clear screenshot showing your subscription status.`);
            }
          } else {
            console.log('Image processing failed or no YouTube channel configured');
            
            if (!serverConfig.youtubeChannelId) {
              console.log('No YouTube channel ID is set for this server');
              await statusMsg.edit('❌ **Verification Failed**\nNo YouTube channel has been set for verification. Please ask an administrator to set up a YouTube channel using `/setyoutubechannel`.');
            } else if (result && !result.success) {
              // Provide specific feedback based on image processing failure
              await statusMsg.edit(`❌ **Verification Failed**\nCould not detect subscription indicators in your image.\n\nTips:\n- Make sure your screenshot clearly shows you are subscribed\n- The subscribe button should show "Subscribed"\n- Try a higher quality screenshot`);
            } else {
              await statusMsg.edit('❌ **Verification Failed**\nAn unexpected error occurred while processing your verification. Please try again with a clearer screenshot or contact an administrator.');
            }
          }
        } else {
          await message.reply('❌ Please upload an **image file** for verification. I need a screenshot showing your YouTube subscription.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        await message.reply('❌ An error occurred during verification. Please try again later or contact an administrator.');
      }
    } else if (message.content.startsWith('!')) {
      // If they tried to use a command in verification channel
      await message.reply('❓ This channel is for verification only. Please upload a screenshot showing your YouTube subscription to get verified.');
    } else if (!message.attachments.size) {
      // Guide users if they just send a message without an image
      await message.reply('ℹ️ To verify your subscription, please **upload a screenshot** showing that you are subscribed to the YouTube channel. The screenshot should clearly show the "Subscribed" button.');
    }
    
    return; // Exit to prevent command processing in verification channel
  }

  // Command handling
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  console.log(`Command received: ${commandName}, Arguments: ${args.join(', ')}`);

  if (!client.commands.has(commandName)) {
    console.log(`Unknown command: ${commandName}`);
    return;
  }

  const command = client.commands.get(commandName);
  console.log(`Executing command: ${command.name}`);

  try {
    command.execute(message, args, client);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    message.reply('There was an error executing that command.');
  }
});

// Login to Discord with proper intents
const token = process.env.DISCORD_TOKEN;
console.log('Attempting to log in to Discord...');
console.log('Bot token available:', token ? 'Yes' : 'No');

// Enhanced login with more robust error handling and logging
// Using more detailed debugging for connection issues
console.log('Starting login process with detailed error reporting...');

// Safely write to log file with error handling
function safelyWriteToLog(logFile, message) {
  try {
    fs.appendFileSync(logFile, message + '\n');
    return true;
  } catch (error) {
    console.error(`Failed to write to log file ${logFile}:`, error.message);
    
    // Try to create directory again if it doesn't exist
    try {
      if (!fs.existsSync(path.dirname(logFile))) {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        console.log(`Created missing directory for ${logFile}`);
        
        // Try writing again
        fs.appendFileSync(logFile, message + '\n');
        console.log(`Successfully wrote to log after creating directory`);
        return true;
      }
    } catch (mkdirError) {
      console.error(`Failed to create log directory:`, mkdirError.message);
    }
    
    return false;
  }
}

// Check token and provide clear instructions if missing
if (!token) {
  const errorMessage = `
============ DISCORD TOKEN MISSING ============

No Discord bot token found in environment variables!

To fix this issue:
1. Create a .env file in the project root directory
2. Add the following line to the .env file:
   DISCORD_TOKEN=your_bot_token_here

   Replace 'your_bot_token_here' with your actual Discord bot token
   from the Discord Developer Portal: https://discord.com/developers/applications

3. Restart the bot

If you're using a hosting service, add DISCORD_TOKEN
as an environment variable in your hosting settings.

See .env.example for a template of all required variables.
=================================================
`;

  console.error(errorMessage);
  safelyWriteToLog(path.join(LOGS_DIR, 'error.log'), errorMessage);
  
  // Exit with error code if no token
  process.exit(1);
}

// Write token info for debugging
safelyWriteToLog(path.join(LOGS_DIR, 'debug.log'), `Token check: Valid token exists (length: ${token.length})`);
safelyWriteToLog(path.join(LOGS_DIR, 'debug.log'), `Timestamp: ${new Date().toISOString()}`);

// Login with delay and advanced error handling
setTimeout(() => {
  client.login(token)
    .then(() => {
      const successMsg = `Successfully logged in as ${client.user.tag}!`;
      console.log(successMsg);
      safelyWriteToLog(path.join(LOGS_DIR, 'debug.log'), successMsg);
      console.log(`Bot is in ${client.guilds.cache.size} servers`);
      console.log('Bot is now ONLINE and ready to respond to commands');
      
      // Set proper activity using V14 format
      client.user.setPresence({
        status: 'online',
        activities: [{ 
          name: '/help for commands', 
          type: ActivityType.Watching 
        }]
      });
    })
    .catch(error => {
      // Detailed error reporting with clear explanations
      const errorDetails = [
        '=======================================',
        'DISCORD LOGIN ERROR:',
        error.name + ': ' + error.message,
        error.stack,
        '---------------------------------------',
        'TROUBLESHOOTING GUIDE:',
        '',
        '1. TOKEN ISSUES:',
        '   - Verify your token is correct and not expired',
        '   - Check for typos in your .env file',
        '   - Regenerate a new token in Discord Developer Portal if needed',
        '',
        '2. PERMISSION ISSUES:',
        '   - Enable ALL "Privileged Gateway Intents" in Developer Portal:',
        '     * Presence Intent',
        '     * Server Members Intent',
        '     * Message Content Intent',
        '',
        '3. NETWORK/HOSTING ISSUES:',
        '   - Check your internet connection',
        '   - Verify your hosting service allows outbound connections',
        '   - Ensure your IP is not blocked by Discord',
        '',
        '4. RATE LIMITING:',
        '   - If you\'ve restarted many times, wait 15-30 minutes',
        '   - Avoid rapidly restarting the bot multiple times',
        '',
        '5. NOT SURE?',
        '   - Join Discord API server for help: https://discord.gg/discord-api',
        '=======================================',
      ].join('\n');
      
      console.error(errorDetails);
      safelyWriteToLog(path.join(LOGS_DIR, 'error.log'), `${new Date().toISOString()}\n${errorDetails}\n\n`);
      
      // Don't exit immediately, try to reconnect
      console.log('Will attempt to reconnect in 30 seconds...');
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        client.login(process.env.DISCORD_TOKEN).catch(e => {
          console.error('Reconnection attempt failed:', e.message);
        });
      }, 30000);
    });
}, 5000); // Small delay to ensure all initialization is complete

// Error handling for unexpected issues
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Enhanced uptime system for 24/7 operation
const uptimeManager = require('./utils/uptimeManager');
const channelWatcher = require('./utils/channelWatcher');
const securityManager = require('./utils/securityManager');
// Dashboard now runs as in-Discord interface

// Set up advanced uptime management
uptimeManager.setupUptimeManager(client);

// Start security monitoring
securityManager.startSecurityMonitoring(client);

// In-Discord dashboard is available via the /dashboard command
console.log(`Discord-native dashboard is available via /dashboard command`);

// Create an enhanced HTTP server for uptime monitoring
const server = uptimeManager.createUptimeServer();

// Start the server on a port that works with UptimeRobot
server.listen(6870, '0.0.0.0', () => {
  console.log('Enhanced uptime monitoring server running on port 6870');
  console.log('Bot is configured for 24/7 operation with automatic reconnection');
});

// Add enhanced heartbeat system to keep the bot alive even when idle
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const UPTIME_ROBOT_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (keeping under 20 min UptimeRobot limit)

// Setup regular heartbeat
setInterval(() => {
  console.log(`💓 Heartbeat - ${new Date().toISOString()} - Bot is ${client.user ? 'ONLINE' : 'OFFLINE'}`);
  
  // Force garbage collection if available (reduces memory leaks)
  if (global.gc) {
    console.log('Running garbage collection...');
    global.gc();
  }
  
  // Check bot connectivity and force reconnect if needed
  if (!client.user) {
    console.log('Bot appears to be offline, attempting to reconnect...');
    client.login(process.env.DISCORD_TOKEN).catch(error => {
      console.error('Failed to reconnect during heartbeat:', error);
    });
  }
}, HEARTBEAT_INTERVAL);

// Set up self-ping to prevent the bot from sleeping
// This is a backup mechanism in case UptimeRobot fails
setInterval(() => {
  const botUrl = `https://${process.env.REPL_ID}.id.repl.co/uptimerobot`;
  
  // Using built-in https module to avoid axios dependency for this critical function
  const https = require('https');
  try {
    https.get(botUrl, (res) => {
      if (res.statusCode === 200) {
        console.log(`🔄 Self-ping successful at ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Self-ping returned status code: ${res.statusCode}`);
      }
    }).on('error', (e) => {
      console.error('⚠️ Self-ping error:', e.message);
    });
  } catch (error) {
    console.error('Error during self-ping:', error);
  }
}, UPTIME_ROBOT_PING_INTERVAL);

// Start YouTube channel watcher for latest video notifications
client.once('ready', () => {
  // Wait a bit before starting to ensure everything is initialized
  setTimeout(() => {
    channelWatcher.startWatching(client);
    console.log('YouTube channel watcher started - monitoring for new videos');
  }, 10000);
  
  // Also set up a presence with helpful info
  client.user.setPresence({
    activities: [{ 
      name: '/help for commands', 
      type: 3 // WATCHING
    }],
    status: 'online'
  });
});
