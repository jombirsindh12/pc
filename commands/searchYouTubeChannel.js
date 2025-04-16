const youtubeAPI = require('../utils/youtubeAPI');

module.exports = {
  name: 'searchchannel',
  description: 'Search for a YouTube channel by name',
  usage: '/searchchannel [query]',
  options: [
    {
      name: 'query',
      type: 3, // STRING type
      description: 'The YouTube channel name to search for',
      required: true
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    let query;
    
    if (isSlashCommand) {
      // Get query from slash command
      query = interaction.options.getString('query');
      
      // Defer reply as API calls can take time
      await interaction.deferReply();
    } else {
      // Legacy command handling for backward compatibility
      if (!args.length) {
        return message.reply('❌ Please provide a channel name to search for. Example: `!searchchannel PewDiePie`');
      }
      
      // Join all arguments to form the search query
      query = args.join(' ');
      
      // Send initial message
      const statusMsg = await message.reply(`🔍 Searching for YouTube channels matching: "${query}"...`);
      
      try {
        await handleSearch(query, message, statusMsg);
      } catch (error) {
        console.error('Error searching for YouTube channels:', error);
        statusMsg.edit(`❌ An error occurred while searching for YouTube channels: ${error.message}`);
      }
      
      return; // Exit early for legacy command
    }
    
    // Handle slash command version
    try {
      // Search for channels
      const channels = await youtubeAPI.searchChannels(query);
      
      if (!channels.length) {
        return interaction.followUp(`❌ No YouTube channels found matching "${query}". Please try a different search term.`);
      }
      
      // Format the results
      const channelList = channels.map((channel, index) => {
        return `**${index + 1}.** [${channel.title}](https://www.youtube.com/channel/${channel.id})
        ID: \`${channel.id}\`
        ${channel.description ? '> ' + channel.description.substring(0, 100) + (channel.description.length > 100 ? '...' : '') : '> No description'}`;
      }).join('\n\n');
      
      // Create embed with search results
      const resultsEmbed = {
        title: `🔍 YouTube Channel Search Results`,
        description: channelList,
        color: 0xFF0000, // YouTube red
        footer: { 
          text: `Use /setyoutubechannel [ID] to set a channel for verification` 
        }
      };
      
      // Send results
      await interaction.followUp({
        content: `✅ Found ${channels.length} YouTube channel(s) matching "${query}":`,
        embeds: [resultsEmbed]
      });
      
      // Add helpful tip
      setTimeout(async () => {
        await interaction.followUp({
          content: `💡 **Tip:** To set one of these channels for verification, use \`/setyoutubechannel\` with the channel ID shown above.`,
          ephemeral: true
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error searching for YouTube channels:', error);
      interaction.followUp(`❌ An error occurred while searching for YouTube channels: ${error.message}`);
    }
  },
};

// Helper function for legacy command
async function handleSearch(query, message, statusMsg) {
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
      footer: { text: `Use /setyoutubechannel [ID] to set a channel for verification` }
    }]
  });
  
  // Add helpful message about using the results
  message.channel.send(`👆 To set one of these channels for verification, use \`/setyoutubechannel [channel ID]\` with the ID shown above.`);
}