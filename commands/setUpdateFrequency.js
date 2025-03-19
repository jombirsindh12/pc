const config = require('../utils/config');

module.exports = {
  name: 'setupdatefrequency',
  description: 'Sets how often the subscriber count should update (in minutes)',
  usage: '!setupdatefrequency [minutes]',
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);

    // Check if YouTube channel and subscriber count channel are configured
    if (!serverConfig.youtubeChannelId) {
      return message.reply('❌ YouTube channel not set. Please use `!setyoutubechannel` first.');
    }

    if (!serverConfig.subCountChannelId) {
      return message.reply('❌ Subscriber count channel not set. Please use `!livesubcount` first.');
    }

    // If no arguments provided, show current frequency
    if (!args.length) {
      const currentFrequency = serverConfig.updateFrequencyMinutes || 60;
      return message.reply(`Current update frequency: **${currentFrequency} minutes**\n\nTo change it, use \`!setupdatefrequency [minutes]\`. Example: \`!setupdatefrequency 30\``);
    }

    // Parse the frequency in minutes
    const frequencyMinutes = parseInt(args[0]);
    
    // Validate the input
    if (isNaN(frequencyMinutes) || frequencyMinutes < 5) {
      return message.reply('❌ Please provide a valid number of minutes (minimum 5 minutes to avoid rate limits).');
    }

    if (frequencyMinutes > 1440) {
      return message.reply('❌ The maximum frequency is 1440 minutes (24 hours).');
    }

    // Update the config
    config.updateServerConfig(serverId, { updateFrequencyMinutes: frequencyMinutes });

    // Reset the interval with the new frequency
    if (client.subCountIntervals && client.subCountIntervals.has(serverId)) {
      clearInterval(client.subCountIntervals.get(serverId));
      
      // Create a new interval with the updated frequency
      const intervalId = setInterval(async () => {
        try {
          // Fetch the latest configuration
          const updatedConfig = config.getServerConfig(serverId);
          const channel = await message.guild.channels.fetch(updatedConfig.subCountChannelId);
          
          if (channel) {
            const youtubeAPI = require('../utils/youtubeAPI');
            const freshInfo = await youtubeAPI.getChannelInfo(updatedConfig.youtubeChannelId);
            
            // Get the format from config
            const format = updatedConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
            const newName = format
              .replace('{channelName}', freshInfo.title)
              .replace('{subCount}', freshInfo.subscriberCount || '0');
              
            await channel.setName(newName);
            console.log(`Updated subscriber count for ${freshInfo.title} to ${freshInfo.subscriberCount}`);
          }
        } catch (error) {
          console.error('Error updating subscriber count channel:', error);
          // If there's an error, stop the interval
          clearInterval(intervalId);
          client.subCountIntervals.delete(serverId);
        }
      }, frequencyMinutes * 60000); // Convert minutes to milliseconds
      
      // Store the new interval ID
      client.subCountIntervals.set(serverId, intervalId);
    }

    // Send confirmation message
    message.reply(`✅ Subscriber count update frequency set to **${frequencyMinutes} minutes**. The count will now update every ${frequencyMinutes} minutes.`);
  },
};