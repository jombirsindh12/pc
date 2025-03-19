const config = require('../utils/config');
const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'setvoicechannelname',
  description: 'Sets a custom name format for the live subscriber count voice channel',
  usage: '!setvoicechannelname [format]',
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);

    // Check if YouTube channel is configured
    if (!serverConfig.youtubeChannelId) {
      return message.reply('❌ YouTube channel not set. Please use `!setyoutubechannel` first.');
    }

    // No args = show current format
    if (!args.length) {
      const currentFormat = serverConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
      return message.reply(`Current voice channel name format: \`${currentFormat}\`\n\nAvailable placeholders:\n- \`{channelName}\`: YouTube channel name\n- \`{subCount}\`: Subscriber count\n\nExample: \`!setvoicechannelname 📈 {channelName} | {subCount} subscribers\``);
    }

    // Join all args back into a string for the format
    const format = args.join(' ');

    if (!format.includes('{channelName}') && !format.includes('{subCount}')) {
      return message.reply('❌ Format must include at least one of these placeholders: `{channelName}`, `{subCount}`');
    }

    // Update config with new format
    config.updateServerConfig(serverId, { voiceChannelFormat: format });

    // Confirm to user
    message.reply(`✅ Voice channel name format set to: \`${format}\`\nThe channel will be updated with this format on the next subscriber count update.`);

    // If we have an existing subscriber count channel, update it now
    if (serverConfig.subCountChannelId) {
      try {
        // Update immediately if possible
        const channelUpdateMessage = updateSubCountChannel(client, serverId);
        if (channelUpdateMessage) {
          message.channel.send(channelUpdateMessage);
        }
      } catch (error) {
        console.error('Error updating subscriber count channel with new format:', error);
      }
    }
  },
};

// Helper function to update the subscriber count channel
async function updateSubCountChannel(client, serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    if (!serverConfig.subCountChannelId || !serverConfig.youtubeChannelId) {
      return null;
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) return null;

    let subCountChannel;
    try {
      subCountChannel = await guild.channels.fetch(serverConfig.subCountChannelId);
    } catch (error) {
      console.error('Could not fetch subscriber count channel:', error);
      return 'Could not update the subscriber count channel. It may have been deleted.';
    }

    // Get the latest channel info
    const youtubeAPI = require('../utils/youtubeAPI');
    const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
    
    if (!channelInfo || !channelInfo.title) {
      return 'Could not retrieve YouTube channel information.';
    }

    // Use the custom format or fall back to default
    const format = serverConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
    const newName = format
      .replace('{channelName}', channelInfo.title)
      .replace('{subCount}', channelInfo.subscriberCount || '0');

    // Update the channel name
    await subCountChannel.setName(newName);
    console.log(`Updated subscriber count channel name to: ${newName}`);
    
    return `✅ Subscriber count channel updated to: ${newName}`;
  } catch (error) {
    console.error('Error in updateSubCountChannel:', error);
    return `❌ Error updating subscriber count channel: ${error.message}`;
  }
}