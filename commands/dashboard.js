const { detectReplitUrl } = require('../dashboard/detectReplit');

module.exports = {
  name: 'dashboard',
  description: 'Get a link to the bot dashboard',
  usage: '/dashboard',
  options: [], // No options for slash command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Detect the dashboard URL
    const dashboardUrl = detectReplitUrl();
    
    // Create an embed for the dashboard
    const dashboardEmbed = {
      title: '🌐 Phantom Guard Dashboard',
      description: `Access the web dashboard to manage bot settings, view verification history, and more.`,
      color: 0x7289DA, // Discord blue color
      fields: [
        {
          name: '🔗 Dashboard Link',
          value: `[Click here to access the dashboard](${dashboardUrl})`
        },
        {
          name: '📋 Features',
          value: `• Manage verification settings\n• Configure security features\n• Track verification history\n• Monitor server activity\n• Control voice announcements`
        },
        {
          name: '🔐 Login',
          value: `Login with your Discord account to manage servers where you have admin permissions.`
        }
      ],
      footer: {
        text: 'Only server admins can access dashboard features'
      }
    };
    
    // Send the message via slash command or regular command
    if (isSlashCommand) {
      if (interaction.deferred) {
        interaction.followUp({ embeds: [dashboardEmbed] });
      } else {
        interaction.reply({ embeds: [dashboardEmbed] });
      }
    } else {
      message.channel.send({ embeds: [dashboardEmbed] });
    }
  },
};