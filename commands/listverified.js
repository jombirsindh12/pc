const config = require('../utils/config');

module.exports = {
  name: 'listverified',
  description: 'Lists all users who have verified their YouTube subscription',
  usage: '/listverified',
  options: [],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Create embeds for verified users
    const verifiedEmbed = {
      title: '✅ Verified Users List',
      description: 'Users who have verified their YouTube subscription:',
      color: 0x00FF00, // Green color for success
      fields: [],
      footer: {
        text: 'Verification timestamps are in server local time'
      }
    };
    
    // Check if we have any verified images
    if (!serverConfig.verifiedImages || Object.keys(serverConfig.verifiedImages).length === 0) {
      verifiedEmbed.description = 'No users have verified their YouTube subscription yet.';
    } else {
      // Get all verified users
      const verifiedImages = serverConfig.verifiedImages;
      
      // Sort by timestamp (newest first)
      const sortedVerifications = Object.values(verifiedImages).sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      // Limit to 25 most recent verifications to avoid embed limits
      const recentVerifications = sortedVerifications.slice(0, 25);
      
      // Add to embed
      recentVerifications.forEach((verification, index) => {
        const verifiedAt = new Date(verification.timestamp).toLocaleString();
        verifiedEmbed.fields.push({
          name: `${index + 1}. ${verification.username}`,
          value: `• User ID: ${verification.userId}\n• Verified: ${verifiedAt}`
        });
      });
      
      // Add counter at the top 
      verifiedEmbed.description = `${Object.keys(verifiedImages).length} users have verified their YouTube subscription.${
        Object.keys(verifiedImages).length > 25 ? ' Showing 25 most recent.' : ''}`;
    }
    
    // Send the message via slash command or regular command
    if (isSlashCommand) {
      if (interaction.deferred) {
        interaction.followUp({ embeds: [verifiedEmbed] });
      } else {
        interaction.reply({ embeds: [verifiedEmbed] });
      }
    } else {
      message.channel.send({ embeds: [verifiedEmbed] });
    }
  },
};