const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');

module.exports = {
  name: 'setyoutubechannel',
  description: 'Sets the YouTube channel for subscription verification',
  usage: '!setyoutubechannel [channelId or URL]',
  async execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    // Check if a YouTube channel ID or URL was provided
    if (!args.length) {
      return message.reply('❌ Please provide a YouTube channel ID or URL. Usage: `!setyoutubechannel [channelId or URL]`');
    }

    let youtubeChannelId = args[0];
    
    // Extract ID from URL if a URL was provided
    if (youtubeChannelId.includes('youtube.com') || youtubeChannelId.includes('youtu.be')) {
      try {
        // Try to extract the channel ID from different URL formats
        if (youtubeChannelId.includes('/channel/')) {
          const match = youtubeChannelId.match(/\/channel\/([^\/\?]+)/);
          if (match && match[1]) {
            youtubeChannelId = match[1];
          }
        } else if (youtubeChannelId.includes('/user/') || youtubeChannelId.includes('/c/')) {
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
      const isValid = await youtubeAPI.validateChannel(youtubeChannelId);
      
      if (isValid) {
        const serverId = message.guild.id;
        const channelInfo = await youtubeAPI.getChannelInfo(youtubeChannelId);
        
        // Save the YouTube channel ID to server config
        config.updateServerConfig(serverId, { 
          youtubeChannelId: youtubeChannelId,
          youtubeChannelName: channelInfo.title
        });
        
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
        message.reply('❌ Invalid YouTube channel ID. Please check the ID and try again.');
      }
    } catch (error) {
      console.error('Error validating YouTube channel:', error);
      message.reply('❌ An error occurred while validating the YouTube channel. Make sure the API key is valid and try again.');
    }
  },
};
