const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');

module.exports = {
  name: 'setyoutubechannel',
  description: 'Sets the YouTube channel for subscription verification',
  usage: '!setyoutubechannel [channelId or URL]',
  async execute(message, args, client) {
    console.log(`Executing setYouTubeChannel command with args: ${args.join(', ')}`);
    
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      console.log('Permission denied: User does not have admin permissions');
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    // Check if a YouTube channel ID or URL was provided
    if (!args.length) {
      console.log('No YouTube channel ID or URL provided');
      return message.reply('❌ Please provide a YouTube channel ID or URL. Usage: `!setyoutubechannel [channelId or URL]`');
    }

    let youtubeChannelId = args[0];
    console.log(`Processing YouTube channel identifier: ${youtubeChannelId}`);
    
    // Extract ID from URL if a URL was provided
    if (youtubeChannelId.includes('youtube.com') || youtubeChannelId.includes('youtu.be')) {
      try {
        console.log(`Detected YouTube URL, attempting to extract channel ID`);
        // Try to extract the channel ID from different URL formats
        if (youtubeChannelId.includes('/channel/')) {
          const match = youtubeChannelId.match(/\/channel\/([^\/\?]+)/);
          if (match && match[1]) {
            youtubeChannelId = match[1];
            console.log(`Extracted channel ID from URL: ${youtubeChannelId}`);
          }
        } else if (youtubeChannelId.includes('/user/') || youtubeChannelId.includes('/c/')) {
          console.log(`URL contains /user/ or /c/ which requires additional processing`);
          message.reply('⚠️ Warning: For username-based URLs, please provide the actual channel ID instead. You can find it in the channel\'s page source or using the YouTube API.');
          return;
        }
      } catch (error) {
        console.error('Error extracting channel ID from URL:', error);
        return message.reply('❌ Could not extract channel ID from the provided URL. Please provide the direct channel ID instead.');
      }
    }
    
    // Validate the YouTube channel ID
    try {
      console.log(`About to validate YouTube channel ID: ${youtubeChannelId}`);
      await message.reply(`⏳ Validating YouTube channel ID: ${youtubeChannelId}. Please wait...`);
      
      const isValid = await youtubeAPI.validateChannel(youtubeChannelId);
      console.log(`YouTube channel validation result: ${isValid}`);
      
      if (isValid) {
        const serverId = message.guild.id;
        console.log(`Getting channel info for ID: ${youtubeChannelId}`);
        const channelInfo = await youtubeAPI.getChannelInfo(youtubeChannelId);
        console.log(`Retrieved channel info:`, channelInfo);
        
        // Save the YouTube channel ID to server config
        config.updateServerConfig(serverId, { 
          youtubeChannelId: youtubeChannelId,
          youtubeChannelName: channelInfo.title
        });
        console.log(`Updated server config with YouTube channel info`);
        
        // Send confirmation message
        message.reply(`✅ YouTube channel has been set for verification: **${channelInfo.title}**\nUsers will now be verified against subscriptions to this channel.`);
        
        // Send channel information
        message.channel.send({
          content: '**Channel Information**',
          embeds: [{
            title: channelInfo.title,
            description: channelInfo.description ? channelInfo.description.substring(0, 100) + '...' : 'No description',
            color: 0xFF0000, // Red color for YouTube
            fields: [
              { name: 'Subscriber Count', value: channelInfo.subscriberCount || 'Hidden', inline: true },
              { name: 'Channel ID', value: youtubeChannelId, inline: true }
            ],
            thumbnail: { url: channelInfo.thumbnailUrl }
          }]
        });
      } else {
        console.log(`YouTube channel ID validation failed`);
        message.reply('❌ Invalid YouTube channel ID. Please check the ID and try again.');
      }
    } catch (error) {
      console.error('Error validating YouTube channel:', error);
      message.reply(`❌ An error occurred while validating the YouTube channel: ${error.message}. Make sure the API key is valid and try again.`);
    }
  },
};
