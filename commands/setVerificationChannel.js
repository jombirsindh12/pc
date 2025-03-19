const config = require('../utils/config');

module.exports = {
  name: 'setverificationchannel',
  description: 'Sets the channel where users can post verification images',
  usage: '!setverificationchannel',
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    // Set the current channel as verification channel
    const channelId = message.channel.id;
    const serverId = message.guild.id;
    
    try {
      config.updateServerConfig(serverId, { verificationChannelId: channelId });
      
      message.reply(`✅ Verification channel has been set to <#${channelId}>\nUsers can now post screenshots here to verify their YouTube subscription.`);
      
      // Send an instruction message
      message.channel.send('📝 **Verification Instructions**\n1. Subscribe to the YouTube channel\n2. Take a screenshot showing your subscription\n3. Post the screenshot in this channel\n4. Wait for verification and role assignment');
      
      // Check if YouTube channel is set
      const serverConfig = config.getServerConfig(serverId);
      if (!serverConfig.youtubeChannelId) {
        message.channel.send('⚠️ **Warning**: No YouTube channel has been set for verification. Please use `!setyoutubechannel [channelId]` to set one.');
      }
      
      // Check if role is set
      if (!serverConfig.roleId) {
        message.channel.send('⚠️ **Warning**: No role has been set for verified subscribers. Please use `!setrole [roleName]` to set one.');
      }
    } catch (error) {
      console.error('Error setting verification channel:', error);
      message.reply('❌ An error occurred while setting the verification channel. Please try again.');
    }
  },
};
