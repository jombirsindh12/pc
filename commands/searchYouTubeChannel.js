const youtubeAPI = require('../utils/youtubeAPI');

module.exports = {
  name: 'searchchannel',
  description: 'Search for a YouTube channel by name',
  usage: '!searchchannel [channel name]',
  async execute(message, args, client) {
    // Check if search query was provided
    if (!args.length) {
      return message.reply('❌ Please provide a channel name to search for. Example: `!searchchannel PewDiePie`');
    }

    // Join all arguments to form the search query
    const query = args.join(' ');
    
    try {
      // Send initial message
      const statusMsg = await message.reply(`🔍 Searching for YouTube channels matching: "${query}"...`);
      
      // Search for channels
      const channels = await youtubeAPI.searchChannels(query);
      
      if (!channels.length) {
        return statusMsg.edit(`❌ No channels found matching "${query}". Please try a different search term.`);
      }
      
      // Format the results
      const channelList = channels.map((channel, index) => {
        return `**${index + 1}.** [${channel.title}](https://www.youtube.com/channel/${channel.id})
        ID: \`${channel.id}\`
        ${channel.description ? '> ' + channel.description.substring(0, 100) + (channel.description.length > 100 ? '...' : '') : '> No description'}`;
      }).join('\n\n');
      
      // Send results as an embed
      await statusMsg.edit({
        content: `✅ Found ${channels.length} YouTube channel(s) matching "${query}":`,
        embeds: [{
          title: `YouTube Channel Search Results`,
          description: channelList,
          color: 0xFF0000, // YouTube red
          footer: { text: `Use !setyoutubechannel [ID] to set a channel for verification` }
        }]
      });
      
      // Add helpful message about using the results
      message.channel.send(`👆 To set one of these channels for verification, use \`!setyoutubechannel [channel ID]\` with the ID shown above.`);
      
    } catch (error) {
      console.error('Error searching for YouTube channels:', error);
      message.reply(`❌ An error occurred while searching for YouTube channels: ${error.message}`);
    }
  },
};