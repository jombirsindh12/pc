const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'setyoutubechannel',
  description: 'Sets the YouTube channel for subscription verification',
  usage: '/setyoutubechannel [channel]',
  
  // Discord.js v14 slash command builder
  data: new SlashCommandBuilder()
    .setName('setyoutubechannel')
    .setDescription('Sets the YouTube channel for subscription verification')
    .addStringOption(option =>
      option.setName('channel')
        .setDescription('YouTube channel ID, username, or URL')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  guildOnly: true, // This command can only be used in servers
  
  async execute(message, args, client, interaction = null) {
    console.log(`Executing setYouTubeChannel command`);
    
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    let youtubeChannelId;
    let sendReply;
    let serverId;
    
    try {
      if (isSlashCommand) {
        console.log('Processing as slash command');
        
        // Get channel ID from slash command
        youtubeChannelId = interaction.options.getString('channel');
        serverId = interaction.guild.id;
        
        // Defer reply as API calls can take time
        await interaction.deferReply({ ephemeral: false }).catch(err => {
          console.error('Error deferring reply:', err);
        });
        
        sendReply = async (content, isEmbed = false) => {
          try {
            if (isEmbed) {
              return await interaction.followUp(content);
            }
            return await interaction.followUp({ content });
          } catch (error) {
            console.error('Error sending reply:', error);
            // Try alternative methods if the first one fails
            try {
              if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply(typeof content === 'string' ? { content } : content);
              } else {
                return await interaction.channel.send(typeof content === 'string' ? { content } : content);
              }
            } catch (fallbackError) {
              console.error('Fallback reply also failed:', fallbackError);
            }
          }
        };
      } else {
        // Legacy command handling
        console.log(`Executing setYouTubeChannel message command with args: ${args ? args.join(', ') : 'none'}`);
        
        if (!message.guild) {
          console.error('Error: message.guild is undefined');
          return message.reply('This command can only be used in a server.');
        }
        
        serverId = message.guild.id;
        
        // Check if user has admin permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          console.log('Permission denied: User does not have admin permissions');
          return message.reply('❌ You need administrator permissions to use this command.');
        }

        // Check if a YouTube channel ID or URL was provided
        if (!args || !args.length) {
          console.log('No YouTube channel ID or URL provided');
          return message.reply('❌ Please provide a YouTube channel ID or URL. Usage: `!setyoutubechannel [channelId or URL]`');
        }
        
        youtubeChannelId = args[0];
        
        sendReply = async (content, isEmbed = false) => {
          try {
            if (isEmbed) {
              return await message.channel.send(content);
            }
            return await message.reply(typeof content === 'string' ? { content } : content);
          } catch (error) {
            console.error('Error sending reply in message command:', error);
            try {
              return await message.channel.send(typeof content === 'string' ? { content } : content);
            } catch (fallbackError) {
              console.error('Fallback message reply also failed:', fallbackError);
            }
          }
        };
      }

      console.log(`Processing YouTube channel identifier: ${youtubeChannelId}`);
      
      // Guard against null or undefined youtubeChannelId
      if (!youtubeChannelId) {
        return await sendReply('❌ No YouTube channel ID or URL provided. Please try again with a valid YouTube channel ID, URL, or handle.');
      }
      
      // Extract ID from URL if a URL was provided
      if (youtubeChannelId.includes('youtube.com') || youtubeChannelId.includes('youtu.be') || youtubeChannelId.includes('@')) {
        try {
          console.log(`Detected YouTube URL or handle, attempting to extract channel ID`);
          // Try to extract the channel ID from different URL formats
          if (youtubeChannelId.includes('/channel/')) {
            const match = youtubeChannelId.match(/\/channel\/([^\/\?]+)/);
            if (match && match[1]) {
              youtubeChannelId = match[1];
              console.log(`Extracted channel ID from URL: ${youtubeChannelId}`);
            }
          } else if (youtubeChannelId.includes('@')) {
            // Handle new @username format
            let handle = youtubeChannelId;
            
            // Extract from URL if needed
            if (handle.includes('youtube.com/')) {
              const match = handle.match(/@([^\/\?]+)/);
              if (match && match[1]) {
                handle = '@' + match[1];
              }
            }
            
            console.log(`Detected channel handle: ${handle}`);
            await sendReply(`⏳ Detected YouTube channel handle: ${handle}. Attempting to resolve...`);
            
            // We'll use this handle directly with the YouTube API
            // The YouTube API can sometimes work with handles directly
            youtubeChannelId = handle.replace('@', '');
          } else if (youtubeChannelId.includes('/user/') || youtubeChannelId.includes('/c/')) {
            // Extract username
            let username = null;
            if (youtubeChannelId.includes('/user/')) {
              const match = youtubeChannelId.match(/\/user\/([^\/\?]+)/);
              if (match && match[1]) username = match[1];
            } else if (youtubeChannelId.includes('/c/')) {
              const match = youtubeChannelId.match(/\/c\/([^\/\?]+)/);
              if (match && match[1]) username = match[1];
            }
            
            if (username) {
              console.log(`Extracted username from URL: ${username}`);
              await sendReply(`⏳ Detected custom YouTube URL with username: ${username}. Attempting to resolve...`);
              youtubeChannelId = username;
            } else {
              return await sendReply('❌ Could not extract username from the provided URL. Please provide the direct channel ID instead.');
            }
          }
        } catch (error) {
          console.error('Error extracting channel ID from URL:', error);
          return await sendReply('❌ Could not extract channel ID from the provided URL. Please provide the direct channel ID instead.');
        }
      }
      
      // Validate the YouTube channel ID
      try {
        console.log(`About to validate YouTube channel ID: ${youtubeChannelId}`);
        await sendReply(`⏳ Validating YouTube channel ID: ${youtubeChannelId}. Please wait...`);
        
        const validatedId = await youtubeAPI.validateChannel(youtubeChannelId);
        console.log(`YouTube channel validation result:`, validatedId);
        
        if (validatedId) {
          // Use the validated/resolved channel ID 
          const actualChannelId = typeof validatedId === 'string' ? validatedId : youtubeChannelId;
          
          console.log(`Getting channel info for ID: ${actualChannelId}`);
          const channelInfo = await youtubeAPI.getChannelInfo(actualChannelId);
          console.log(`Retrieved channel info:`, channelInfo);
          
          // Save the YouTube channel ID to server config
          config.updateServerConfig(serverId, { 
            youtubeChannelId: actualChannelId,
            youtubeChannelName: channelInfo.title
          });
          console.log(`Updated server config with YouTube channel info`);
          
          // Send confirmation message
          await sendReply(`✅ YouTube channel has been set for verification: **${channelInfo.title}**\nUsers will now be verified against subscriptions to this channel.`);
          
          // Create an embed for channel information
          const channelEmbed = new EmbedBuilder()
            .setTitle(channelInfo.title)
            .setDescription(channelInfo.description ? 
              channelInfo.description.substring(0, 100) + 
              (channelInfo.description.length > 100 ? '...' : '') : 
              'No description')
            .setColor(0xFF0000) // Red color for YouTube
            .addFields(
              { name: 'Subscriber Count', value: channelInfo.subscriberCount || 'Hidden', inline: true },
              { name: 'Channel ID', value: actualChannelId, inline: true }
            );
            
          if (channelInfo.thumbnailUrl) {
            channelEmbed.setThumbnail(channelInfo.thumbnailUrl);
          }
          
          // Send channel information embed
          await sendReply({ 
            content: '**Channel Information**',
            embeds: [channelEmbed]
          }, true);
          
        } else {
          console.log(`YouTube channel ID validation failed`);
          await sendReply('❌ Invalid YouTube channel ID. Please check the ID and try again.');
        }
      } catch (error) {
        console.error('Error validating YouTube channel:', error);
        await sendReply(`❌ An error occurred while validating the YouTube channel: ${error.message}. Make sure the API key is valid and try again.`);
      }
    } catch (outerError) {
      console.error('Outer error in setYouTubeChannel command:', outerError);
      
      try {
        if (isSlashCommand) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: `❌ An unexpected error occurred: ${outerError.message}`,
              ephemeral: true
            });
          } else {
            await interaction.followUp({ 
              content: `❌ An unexpected error occurred: ${outerError.message}`,
              ephemeral: true
            });
          }
        } else if (message && message.channel) {
          await message.channel.send(`❌ An unexpected error occurred: ${outerError.message}`);
        }
      } catch (finalError) {
        console.error('Could not send error message:', finalError);
      }
    }
  },
};
