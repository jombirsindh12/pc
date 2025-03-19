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

  // Check if message is in verification channel
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
          await message.reply('Processing your verification image... Please wait.');
          
          // Process the image
          const imageUrl = attachment.url;
          const result = await imageProcessor.processImage(imageUrl);
          
          // If image processing succeeded and we have a YouTube channel configured
          if (result && serverConfig.youtubeChannelId) {
            // Verify subscription with YouTube API
            const isSubscribed = await youtubeAPI.verifySubscription(
              result.userId, 
              serverConfig.youtubeChannelId
            );
            
            if (isSubscribed) {
              // Add role to user if role is set
              if (serverConfig.roleId) {
                try {
                  await message.member.roles.add(serverConfig.roleId);
                  await message.reply('✅ Verification successful! You have been assigned the subscriber role.');
                } catch (error) {
                  console.error('Error assigning role:', error);
                  await message.reply('✅ Verification successful, but I could not assign the role. Please contact an administrator.');
                }
              } else {
                await message.reply('✅ Verification successful! However, no subscriber role has been set up yet.');
              }
            } else {
              await message.reply('❌ Verification failed. Could not confirm your subscription to the YouTube channel. Please make sure you are subscribed and try again.');
            }
          } else {
            await message.reply('❌ Could not process your verification image or no YouTube channel has been set for verification. Please try again or contact an administrator.');
          }
        } else {
          await message.reply('❌ Please upload an image file for verification.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        await message.reply('❌ An error occurred during verification. Please try again later.');
      }
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

// Start the server to keep the bot running 24/7
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is running!\n');
});

server.listen(8000, '0.0.0.0', () => {
  console.log('HTTP server running on port 8000');
});
