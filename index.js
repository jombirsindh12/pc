require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const config = require('./utils/config');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
});

// Load commands
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
  console.log(`Loaded command: ${command.name}`);
}

// Bot ready event
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Bot is online and ready!');
});

// Message event handler
client.on(Events.MessageCreate, async message => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Load server configuration
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
          
          const result = await imageProcessor.processImage(imageUrl);
          console.log('Image processing result:', JSON.stringify(result, null, 2));
          
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
                await statusMsg.edit('✅ **Verification Successful!**\nHowever, no subscriber role has been set up yet. Please ask an administrator to set up a role using `!setrole`.');
              }
            } else {
              const channelName = channelInfo?.title || serverConfig.youtubeChannelName || 'the YouTube channel';
              await statusMsg.edit(`❌ **Verification Failed**\nCould not confirm your subscription to **${channelName}**.\nPlease make sure you are subscribed and try again with a clear screenshot showing your subscription status.`);
            }
          } else {
            console.log('Image processing failed or no YouTube channel configured');
            
            if (!serverConfig.youtubeChannelId) {
              console.log('No YouTube channel ID is set for this server');
              await statusMsg.edit('❌ **Verification Failed**\nNo YouTube channel has been set for verification. Please ask an administrator to set up a YouTube channel using `!setyoutubechannel`.');
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

// Login to Discord
const token = process.env.DISCORD_TOKEN || 'MTM1MTc5NDc0OTk5MjA3NTMwNQ.GskElp.k5uSc-J8z3eBm9JDja4jLBYH4daJuM5cPuJpN8';
client.login(token).catch(error => {
  console.error('Failed to log in:', error);
  process.exit(1);
});

// Error handling for unexpected issues
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Enhanced server to keep the bot running 24/7
const http = require('http');
const url = require('url');

// Keep track of the bot's uptime
const startTime = new Date();
let pingCount = 0;

// Create a more robust HTTP server
const server = http.createServer((req, res) => {
  const route = url.parse(req.url).pathname;
  pingCount++;
  
  // Basic health endpoint
  if (route === '/health' || route === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    // Calculate uptime
    const uptime = Math.floor((new Date() - startTime) / 1000);
    const uptimeStr = formatUptime(uptime);
    
    res.end(JSON.stringify({
      status: 'online',
      uptime: uptimeStr,
      botUser: client.user ? client.user.tag : 'Not logged in',
      pingCount: pingCount,
      serverCount: client.guilds.cache.size,
      message: 'Discord Bot is running!'
    }));
  // Bot status endpoint
  } else if (route === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    // Collect some useful stats
    const guildCount = client.guilds.cache.size;
    const guildNames = Array.from(client.guilds.cache.values()).map(g => g.name);
    
    res.end(JSON.stringify({
      online: client.user ? true : false,
      username: client.user ? client.user.username : 'Not logged in',
      discriminator: client.user ? client.user.discriminator : '0000',
      guildCount: guildCount,
      guildNames: guildNames,
      commandCount: client.commands.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      uptimeSecs: Math.floor((new Date() - startTime) / 1000)
    }));
  // Interface for UptimeRobot or similar services
  } else if (route === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

// Helper function to format uptime nicely
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Auto-reconnect capability
client.on('disconnect', (event) => {
  console.log(`Bot disconnected with code ${event.code}. Reason: ${event.reason}`);
  console.log('Attempting to reconnect...');
});

client.on('reconnecting', () => {
  console.log('Bot is reconnecting...');
});

client.on('resume', (replayed) => {
  console.log(`Bot resumed connection. ${replayed} events replayed.`);
});

// Handle error events to prevent crashes
client.on('error', (error) => {
  console.error('Client error:', error);
});

// Start the server
server.listen(8000, '0.0.0.0', () => {
  console.log('Enhanced HTTP server running on port 8000');
  console.log('Bot uptime monitoring active. The bot will stay online 24/7.');
});
