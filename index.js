// Load environment configuration from appropriate .env files
const { environment, isProduction } = require('./setup-env');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const config = require('./utils/config');
const { inviteTracker } = require('./server/db');

console.log(`Starting bot in ${environment} environment`);

// Function to initialize subscriber count intervals for all servers
async function initializeAllSubCountIntervals(client) {
  if (!client.subCountIntervals) {
    client.subCountIntervals = new Map();
  }
  
  console.log('Initializing subscriber count intervals for all servers...');
  
  // Process each guild the bot is in
  for (const guild of client.guilds.cache.values()) {
    const serverId = guild.id;
    // Get config for this server
    const serverConfig = config.getServerConfig(serverId);
    
    // Only set up interval if the server has a YouTube channel and subscriber count channel
    if (serverConfig.youtubeChannelId && serverConfig.subCountChannelId) {
      try {
        // Check if the channel exists
        const channel = await guild.channels.fetch(serverConfig.subCountChannelId).catch(() => null);
        if (!channel) {
          console.log(`Channel ${serverConfig.subCountChannelId} not found in guild ${serverId}, skipping`);
          continue; // Skip to next guild
        }
        
        // Clear any existing interval for this server
        if (client.subCountIntervals.has(serverId)) {
          clearInterval(client.subCountIntervals.get(serverId));
        }
        
        // Function to update subscriber count
        const updateSubscriberCount = async () => {
          try {
            const currentGuild = client.guilds.cache.get(serverId);
            if (!currentGuild) {
              console.log(`Guild ${serverId} not found for subscriber count update`);
              return;
            }
            
            const channel = await currentGuild.channels.fetch(serverConfig.subCountChannelId).catch(() => null);
            if (channel) {
              // Get channel info from YouTube
              const youtubeAPI = require('./utils/youtubeAPI');
              const freshInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
              
              // Get the format from config and update channel name
              const currentConfig = config.getServerConfig(serverId);
              const format = currentConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
              const newName = format
                .replace('{channelName}', freshInfo.title)
                .replace('{subCount}', freshInfo.subscriberCount || '0');
                
              await channel.setName(newName);
              console.log(`Updated subscriber count for ${freshInfo.title} to ${freshInfo.subscriberCount}`);
            }
          } catch (error) {
            console.error(`Error updating subscriber count for server ${serverId}:`, error);
          }
        };
        
        // Update immediately when bot starts
        updateSubscriberCount();
        
        // Set up the interval to update the subscriber count regularly
        const intervalId = setInterval(updateSubscriberCount, (serverConfig.updateFrequencyMinutes || 60) * 60000); // Use configured update frequency or default to 60 minutes
        
        // Store the interval ID
        client.subCountIntervals.set(serverId, intervalId);
        
        console.log(`Subscriber count interval set up for server ${serverId}`);
      } catch (error) {
        console.error(`Error setting up subscriber count for server ${serverId}:`, error);
      }
    }
  }
  
  console.log('Finished initializing subscriber count intervals');
}

// Function to initialize security monitoring for all servers
async function initializeSecurityMonitoring(client) {
  console.log('Starting security monitoring for all servers...');
  
  try {
    // Load security manager
    const securityManager = require('./utils/securityManager');
    
    // Process each guild the bot is in
    for (const guild of client.guilds.cache.values()) {
      const serverId = guild.id;
      // Get config for this server
      const serverConfig = config.getServerConfig(serverId);
      
      if (!serverConfig.securityDisabled) {
        try {
          // Activate anti-nuke for this server with default threshold
          if (typeof securityManager.activateAntiNuke === 'function') {
            securityManager.activateAntiNuke(client, serverId, 3);
          }
          
          // Also enable ultra-strict security mode for all servers
          if (typeof securityManager.enableStrictSecurity === 'function') {
            // Update config to enable strict security by default
            config.updateServerConfig(serverId, {
              strictSecurity: true,
              strictSecurityAction: 'kick',
              strictSecurityEnabled: Date.now()
            });
            
            // Actually enable the strict security mode
            await securityManager.enableStrictSecurity(client, serverId, 'kick');
            console.log(`🔒 Enabled Ultra-Strict security for server: ${guild.name} - Only owner can modify server`);
          }
          
          console.log(`Security monitoring activated for server ${serverId}`);
        } catch (error) {
          console.error(`Error activating security for server ${serverId}:`, error);
        }
      } else {
        console.log(`Security disabled for server ${serverId}, skipping`);
      }
    }
    
    console.log('Security monitoring active for all servers - checking for nukes, raids and spam');
    
    // Set up protection against channel and server modifications
    if (typeof securityManager.setupChannelModificationProtection === 'function') {
      securityManager.setupChannelModificationProtection(client);
      console.log('🔒 Strict channel and server protection activated - Only server owner can modify channels and server settings');
    }
  } catch (error) {
    console.error('Error initializing security monitoring:', error);
  }
}

// Function to initialize invite tracking for all servers
async function initializeInviteTracking(client) {
  console.log('Initializing invite tracking system...');
  
  try {
    // Initialize database tables
    await inviteTracker.initializeTables();
    
    // Load invite tracker command 
    const { setupInviteTrackingCollector } = require('./commands/invitetracker');
    
    // Set up invite tracking collectors for all servers
    setupInviteTrackingCollector(client);
    
    console.log('✅ Invite tracking system initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing invite tracking:', error);
  }
}

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
  
  // Config directories are created by the config module
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
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Transform regular commands to slash commands
    console.log('Started refreshing application (/) commands.');
    
    // Register all slash commands
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands }
    );
    
    console.log('Successfully registered application (/) commands.');
    
    // Initialize verification collectors from security.js
    try {
      console.log('Setting up verification collectors from security.js');
      // Import the setupAllVerificationCollectors function directly
      const { setupAllVerificationCollectors } = require('./commands/security');
      setupAllVerificationCollectors(client);
    } catch (verificationError) {
      console.error('Error setting up verification collectors:', verificationError);
    }
    
    // Initialize welcome message handler
    try {
      console.log('Setting up welcome message handler...');
      const { setupWelcomeHandler } = require('./commands/setwelcome');
      setupWelcomeHandler(client);
      console.log('Welcome message handler initialized successfully');
    } catch (welcomeError) {
      console.error('Error setting up welcome message handler:', welcomeError);
    }
    
    // Initialize DM message handler
    try {
      console.log('Setting up DM message handler...');
      const { setupDMHandler } = require('./commands/setdm');
      setupDMHandler(client);
      console.log('DM message handler initialized successfully');
    } catch (dmError) {
      console.error('Error setting up DM message handler:', dmError);
    }
    
    // Initialize all subscriber count intervals for all servers
    initializeAllSubCountIntervals(client);
    
    // Start security monitoring for all servers
    initializeSecurityMonitoring(client);
    
    // Initialize invite tracking system
    initializeInviteTracking(client);
    
    // Initialize the backup system
    try {
      const backupManager = require('./utils/backupManager');
      if (typeof backupManager.scheduleAutomaticBackups === 'function') {
        console.log('Setting up automatic server backup system');
        backupManager.scheduleAutomaticBackups(client);
      }
    } catch (backupError) {
      console.error('Error initializing backup system:', backupError);
    }
    
    // Initialize the server stats system
    try {
      const serverStats = require('./commands/serverstats');
      if (typeof serverStats.setupStatsUpdateInterval === 'function') {
        console.log('Setting up server stats monitoring system');
        serverStats.setupStatsUpdateInterval(client);
      }
    } catch (statsError) {
      console.error('Error initializing server stats system:', statsError);
    }
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

// Auto-initialize security when joining a new server
client.on(Events.GuildCreate, async guild => {
  try {
    console.log(`🔐 Bot has joined a new server: ${guild.name} (${guild.id})`);
    
    // Get or create server configuration
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Set default security configurations - MAXIMUM SECURITY by default
    const securitySettings = {
      // Set automatic security features all to TRUE
      securityEnabled: true,
      securityDisabled: false,
      antiRaidEnabled: true,
      antiRaidDisabled: false,
      antiSpamEnabled: true, 
      antiSpamDisabled: false,
      antiScamEnabled: true,
      antiScamDisabled: false,
      securityOwnerOnly: true, // Only owner can control security
      
      // Anti-raid settings - very strict
      antiRaidSettings: {
        joinThreshold: 3, // Detect 3 quick joins
        timeWindow: 8000, // Within 8 seconds
        action: 'lockdown' // Auto-lockdown on raid
      },
      
      // Anti-spam settings - strict
      antiSpamSettings: {
        messageThreshold: 4, // 4 messages
        timeWindow: 3000, // Within 3 seconds
        action: 'mute' // Mute spammers
      },
      
      // Anti-nuke settings
      antiNukeEnabled: true,
      antiNukeThreshold: 2, // Very sensitive - 2 actions triggers anti-nuke
      
      // Ultra-Strict Security - Enable by default
      strictSecurity: true,
      strictSecurityAction: 'kick', // kick admins who try to modify server
      strictSecurityEnabled: Date.now(),
      
      // Create a welcome message for server owner explaining security
      welcomeMessage: true
    };
    
    // Save enhanced security configuration
    config.updateServerConfig(serverId, securitySettings);
    
    // Initialize security for this server
    console.log(`🔒 Auto-enabling maximum security for new server: ${guild.name}`);
    const securityManager = require('./utils/securityManager');
    securityManager.activateAntiNuke(client, serverId, securitySettings.antiNukeThreshold);
    
    // Enable ultra-strict security mode by default
    try {
      await securityManager.enableStrictSecurity(client, serverId, 'kick');
      console.log(`🔒 Auto-enabled ULTRA-STRICT security for new server: ${guild.name} - Only owner can modify server`);
    } catch (strictError) {
      console.error(`Error enabling strict security for new server:`, strictError);
    }
    
    // Get the server owner
    const owner = await guild.fetchOwner();
    if (owner) {
      try {
        // Create welcome/security info embed
        const welcomeEmbed = {
          title: '🔒 Maximum Security Activated',
          description: `Thank you for adding Phantom Guard to your server! **Maximum security has been automatically enabled** to protect your server from attacks, raids, and spam.`,
          color: 0x2ECC71, // Green
          fields: [
            {
              name: '🛡️ Security Features Activated',
              value: '• Anti-Raid Protection\n• Anti-Spam System\n• Anti-Nuke Protection\n• Anti-Scam Filter\n• Emergency Lockdown System'
            },
            {
              name: '🔐 Owner-Only Security',
              value: 'For enhanced protection, all security commands can only be used by you, the server owner. This prevents security compromise even if admin accounts are compromised.'
            },
            {
              name: '📊 Server Statistics',
              value: 'Use `/serverstats setup` to create voice channels that display server stats like member counts, online users, and role counts - similar to Statbot.'
            },
            {
              name: '⚠️ Important',
              value: 'If you want to adjust security settings, use `/security`, `/antiraid`, `/antispam`, or `/lockdown` commands. Only you can modify these settings.'
            }
          ],
          footer: {
            text: 'Phantom Guard • Advanced Security System'
          },
          timestamp: new Date()
        };
        
        // Send a private message to the server owner
        await owner.send({ embeds: [welcomeEmbed] });
        console.log(`📨 Sent security welcome message to server owner: ${owner.user.tag}`);
      } catch (dmError) {
        console.error(`❌ Could not send DM to server owner:`, dmError);
        
        // Try to find a suitable channel to send welcome message
        try {
          // Look for system, general, or welcome channels
          const systemChannel = guild.systemChannel;
          const generalChannel = guild.channels.cache.find(channel => 
            channel.type === 0 && // Text channel
            (channel.name.includes('general') || 
             channel.name === 'general' || 
             channel.name.includes('welcome') || 
             channel.name.includes('chat'))
          );
          
          const targetChannel = systemChannel || generalChannel;
          
          if (targetChannel) {
            const serverEmbed = {
              title: '🔒 Phantom Guard Security Activated',
              description: `Thank you for adding Phantom Guard! **Maximum security has been automatically enabled** to protect your server.`,
              color: 0x2ECC71, // Green
              fields: [
                {
                  name: '🛡️ Security Features',
                  value: 'All security features have been auto-enabled with maximum protection. Only the server owner can adjust security settings.'
                },
                {
                  name: '📊 Server Statistics',
                  value: 'Use `/serverstats setup` to create voice channels that show member counts, online users, and role counts.'
                },
                {
                  name: '⚙️ Key Commands',
                  value: 'Use `/security`, `/antiraid`, `/antispam`, `/serverstats`, or `/lockdown` commands to manage features.'
                }
              ],
              footer: {
                text: 'Phantom Guard • Advanced Security System'
              }
            };
            
            await targetChannel.send({ 
              content: `<@${owner.id}> Server owner, please note:`,
              embeds: [serverEmbed]
            });
          }
        } catch (channelError) {
          console.error(`❌ Could not send welcome message to any channel:`, channelError);
        }
      }
    }
    
    // Initialize YouTube features if available
    if (process.env.YOUTUBE_API_KEY) {
      console.log(`📺 Setting up YouTube features for new server: ${guild.name}`);
      // No need to do anything special, as these are set up on demand
    }
    
  } catch (error) {
    console.error(`❌ Error during automatic security setup for new server:`, error);
  }
});

// Import config for owner check
const { isBotOwner } = require('./utils/config');

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
    
    // Check if the user is a bot owner
    const isOwner = isBotOwner(interaction.user.id);
    if (isOwner) {
      console.log(`Bot owner ${interaction.user.tag} (${interaction.user.id}) is executing command: ${commandName}`);
      // Add isOwner flag to interaction object itself
      interaction.isOwner = true;
    }
    
    // Create a mock message object for backward compatibility
    const mockMessage = {
      author: interaction.user,
      member: interaction.member,
      channel: interaction.channel,
      guild: interaction.guild,
      isOwner: isOwner, // Add isOwner flag to message object
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

  // Check if user is a bot owner
  const isOwner = isBotOwner(message.author.id);
  if (isOwner) {
    // Add isOwner flag to message object for all command handlers
    message.isOwner = true;
    console.log(`Bot owner ${message.author.tag} (${message.author.id}) is sending a message`);
  }

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
    // Process verification images
    if (message.attachments.size > 0) {
      console.log("Verification image received from user:", message.author.tag);
      
      // Get the first image attachment
      const attachment = message.attachments.first();
      const imageUrl = attachment.url;
      
      // Check if we have a YouTube channel set up for verification
      if (!serverConfig.youtubeChannelId) {
        return message.reply("❌ No YouTube channel has been set for verification. Please ask an admin to set one up using `/setyoutubechannel`.");
      }
      
      // Check if we have a role set up for verification
      if (!serverConfig.roleId) {
        return message.reply("❌ No role has been set for verification. Please ask an admin to set one up using `/setrole`.");
      }
      
      // Let user know we're processing their image
      message.reply("⏳ Processing your verification screenshot... Please wait a moment.");
      
      // Process the image using our image processor utility
      try {
        const imageProcessor = require('./utils/imageProcessor');
        const youtubeAPI = require('./utils/youtubeAPI');
        
        // Process the image
        imageProcessor.processImage(imageUrl).then(async (result) => {
          console.log("Image processing result:", result);
          
          // Check for duplicate image hash to prevent reuse of verification screenshots
          if (result.imageHash) {
            // Get all verified images across all users in this server
            const verifiedImages = serverConfig.verifiedImages || {};
            
            // Look for this image hash in previous verifications
            let isDuplicate = false;
            let originalVerifier = null;
            
            for (const userId in verifiedImages) {
              if (verifiedImages[userId].imageHash === result.imageHash) {
                isDuplicate = true;
                originalVerifier = {
                  userId: userId,
                  username: verifiedImages[userId].username,
                  timestamp: verifiedImages[userId].timestamp
                };
                break;
              }
            }
            
            // If this is a duplicate image, inform the user
            if (isDuplicate) {
              // Check if this user already has the verification role
              const role = message.guild.roles.cache.get(serverConfig.roleId);
              if (role && message.member.roles.cache.has(role.id)) {
                return message.reply(`❌ This image has already been used for verification. You already have the ${role.name} role.`);
              }
              
              // If another user used this image before
              if (originalVerifier && originalVerifier.userId !== message.author.id) {
                const verifyDate = new Date(originalVerifier.timestamp).toLocaleString();
                return message.reply({
                  embeds: [{
                    title: '❌ Duplicate Verification Image',
                    description: 'This exact image has already been used for verification by another user.',
                    color: 0xFF0000,
                    fields: [
                      {
                        name: 'Original Verifier',
                        value: `<@${originalVerifier.userId}> (${originalVerifier.username})`
                      },
                      {
                        name: 'Verification Date',
                        value: verifyDate
                      },
                      {
                        name: 'YouTube Channel',
                        value: serverConfig.youtubeChannelName 
                          ? `[${serverConfig.youtubeChannelName}](https://youtube.com/channel/${serverConfig.youtubeChannelId})`
                          : `[Click here to view channel](https://youtube.com/channel/${serverConfig.youtubeChannelId})`
                      }
                    ],
                    footer: {
                      text: 'Please upload a new screenshot showing your own subscription'
                    }
                  }]
                });
              }
              
              // If this user had previously used this image
              return message.reply({
                embeds: [{
                  title: '❌ Duplicate Verification Image',
                  description: 'This exact image has already been used for verification.',
                  color: 0xFF0000,
                  fields: [
                    {
                      name: 'YouTube Channel',
                      value: serverConfig.youtubeChannelName 
                        ? `[${serverConfig.youtubeChannelName}](https://youtube.com/channel/${serverConfig.youtubeChannelId})`
                        : `[Click here to view channel](https://youtube.com/channel/${serverConfig.youtubeChannelId})`
                    }
                  ],
                  footer: {
                    text: 'Please upload a new and unique screenshot showing your subscription'
                  }
                }]
              });
            }
          }
          
          if (result.success) {
            // Verify the subscription using our youtubeAPI utility
            const isVerified = await youtubeAPI.verifySubscription(
              result.channelId || null, 
              serverConfig.youtubeChannelId
            );
            
            if (isVerified) {
              // Add role to the user
              const role = message.guild.roles.cache.get(serverConfig.roleId);
              if (role) {
                try {
                  // Check if user already has the role
                  if (message.member.roles.cache.has(role.id)) {
                    return message.reply(`✅ You're already verified and have the ${role.name} role.`);
                  }
                  
                  await message.member.roles.add(role);
                  
                  // Store the verification record
                  const verifiedImages = serverConfig.verifiedImages || {};
                  verifiedImages[message.author.id] = {
                    userId: message.author.id,
                    username: message.author.tag,
                    timestamp: new Date().toISOString(),
                    method: 'image',
                    imageHash: result.imageHash,
                    guildId: message.guild.id
                  };
                  
                  // Update server config with verification record
                  config.updateServerConfig(message.guild.id, {
                    verifiedImages: verifiedImages
                  });
                  
                  // Send success message
                  message.reply(`✅ **Verification successful!** You've been given the ${role.name} role.`);
                  
                  // Log verification
                  console.log(`User ${message.author.tag} verified for YouTube channel ${serverConfig.youtubeChannelId} in server ${message.guild.name}`);
                  
                  // If notification channel is set, send notification
                  if (serverConfig.notificationChannelId) {
                    const notificationChannel = message.guild.channels.cache.get(serverConfig.notificationChannelId);
                    if (notificationChannel) {
                      notificationChannel.send({
                        embeds: [{
                          title: '✅ New Verified Subscriber',
                          description: `<@${message.author.id}> has verified their subscription to the YouTube channel.`,
                          color: 0x00FF00,
                          timestamp: new Date(),
                          footer: {
                            text: 'YouTube Verification System'
                          }
                        }]
                      }).catch(err => console.error('Error sending verification notification:', err));
                    }
                  }
                } catch (roleError) {
                  console.error('Error adding role to verified user:', roleError);
                  message.reply("❌ An error occurred while giving you the verified role. Please contact a server admin.");
                }
              } else {
                message.reply("❌ The verification role couldn't be found. Please contact a server admin.");
              }
            } else {
              message.reply("❌ Couldn't verify your subscription from the screenshot. Please make sure you're subscribed to the correct channel and try again with a clearer screenshot.");
            }
          } else {
            message.reply(`❌ ${result.message}`);
          }
        }).catch(error => {
          console.error('Error processing verification image:', error);
          message.reply("❌ There was an error processing your verification image. Please try again with a different screenshot.");
        });
      } catch (error) {
        console.error('Error loading image processor:', error);
        message.reply("❌ There was a system error with the verification process. Please contact a server admin.");
      }
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