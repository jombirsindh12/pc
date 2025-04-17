const config = require('../utils/config');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'setupdatefrequency',
  description: 'Sets how often (in minutes) the subscriber count updates',
  usage: '!setupdatefrequency [minutes]',
  guildOnly: true, // This command can only be used in servers
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ You need to have Administrator permissions to use this command.');
    }
    
    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // If no voice channel has been set up yet
    if (!serverConfig.subCountChannelId) {
      return message.reply('❌ You need to set up a subscriber count channel first using `!livesubcount`');
    }
    
    // Display current frequency if no arguments provided
    if (!args.length) {
      const currentFrequency = serverConfig.updateFrequencyMinutes || 60;
      return message.reply({
        embeds: [{
          title: '⏱️ Update Frequency Settings',
          description: `The subscriber count currently updates every **${currentFrequency} minutes**.\n\nTo change this, use \`!setupdatefrequency [minutes]\` (minimum: 5, maximum: 1440).`,
          color: 0x7289DA,
          footer: { text: 'Note: Setting a very low frequency may cause rate limiting issues with the YouTube API' }
        }]
      });
    }
    
    // Parse the frequency argument
    const frequency = parseInt(args[0]);
    
    // Validate the frequency
    if (isNaN(frequency) || frequency < 5 || frequency > 1440) {
      return message.reply('❌ Please provide a valid number of minutes between 5 and 1440 (24 hours).');
    }
    
    // Update config
    config.updateServerConfig(serverId, { updateFrequencyMinutes: frequency });
    
    // Confirmation message
    return message.reply({
      embeds: [{
        title: '✅ Update Frequency Changed',
        description: `The subscriber count will now update every **${frequency} minutes**.`,
        color: 0x43B581
      }]
    });
  },
};