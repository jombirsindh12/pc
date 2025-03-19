const config = require('../utils/config');

module.exports = {
  name: 'setnotificationchannel',
  description: 'Sets the channel where notifications will be sent',
  usage: '!setnotificationchannel',
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    // Set the current channel as notification channel
    const channelId = message.channel.id;
    const serverId = message.guild.id;
    
    try {
      config.updateServerConfig(serverId, { notificationChannelId: channelId });
      
      message.reply(`✅ Notification channel has been set to <#${channelId}>\nAll bot notifications will be sent to this channel.`);
      
      // Send a test notification
      message.channel.send('🔔 This is a test notification. Future bot notifications will be sent to this channel.');
    } catch (error) {
      console.error('Error setting notification channel:', error);
      message.reply('❌ An error occurred while setting the notification channel. Please try again.');
    }
  },
};
