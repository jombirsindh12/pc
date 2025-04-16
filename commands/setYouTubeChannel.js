const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');

module.exports = {
  name: 'setyoutubechannel',
  description: 'Sets the YouTube channel for subscription verification',
  usage: '/setyoutubechannel [channel]',
  options: [
    {
      name: 'channel',
      type: 3, // STRING type
      description: 'YouTube channel ID, username, or URL',
      required: true
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    let youtubeChannelId;
    let sendReply;
    let serverId;
    
    if (isSlashCommand) {
      // Get channel ID from slash command
      youtubeChannelId = interaction.options.getString('channel');
      serverId = interaction.guild.id;
      
      // Check admin permissions
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
          content: '❌ You need administrator permissions to use this command.',
          ephemeral: true
        });
      }
      
      // Defer reply as API calls can take time
      await interaction.deferReply();
      
      sendReply = async (content, isEmbed = false) => {
        if (isEmbed) {
          return interaction.followUp(content);
        }
        return interaction.followUp({ content });
      };
    } else {
      // Legacy command handling
      console.log(`Executing setYouTubeChannel command with args: ${args ? args.join(', ') : 'none'}`);
      serverId = message.guild.id;
      
      // Check if user has admin permissions
      if (!message.member.permissions.has('ADMINISTRATOR')) {
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
        if (isEmbed) {
          return message.channel.send(content);
        }
        return message.reply(content);
      };
    }

    console.log(`Processing YouTube channel identifier: ${youtubeChannelId}`);
    
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
            return sendReply('❌ Could not extract username from the provided URL. Please provide the direct channel ID instead.');
          }
        }
      } catch (error) {
        console.error('Error extracting channel ID from URL:', error);
        return sendReply('❌ Could not extract channel ID from the provided URL. Please provide the direct channel ID instead.');
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
        
        // Send channel information
        await sendReply({
          content: '**Channel Information**',
          embeds: [{
            title: channelInfo.title,
            description: channelInfo.description ? channelInfo.description.substring(0, 100) + '...' : 'No description',
            color: 0xFF0000, // Red color for YouTube
            fields: [
              { name: 'Subscriber Count', value: channelInfo.subscriberCount || 'Hidden', inline: true },
              { name: 'Channel ID', value: actualChannelId, inline: true }
            ],
            thumbnail: { url: channelInfo.thumbnailUrl }
          }]
        }, true);
      } else {
        console.log(`YouTube channel ID validation failed`);
        await sendReply('❌ Invalid YouTube channel ID. Please check the ID and try again.');
      }
    } catch (error) {
      console.error('Error validating YouTube channel:', error);
      await sendReply(`❌ An error occurred while validating the YouTube channel: ${error.message}. Make sure the API key is valid and try again.`);
    }
  },
};
