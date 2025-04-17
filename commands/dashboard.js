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
    
    // Get the standard Replit URL
    const standardUrl = `https://${process.env.REPL_ID}-${process.env.REPL_OWNER}.repl.co`;
    
    // Create an embed for the dashboard
    const dashboardEmbed = {
      title: '🌐 Phantom Guard Dashboard',
      description: `Access the web dashboard to manage bot settings, view verification history, and more.`,
      color: 0x7289DA, // Discord blue color
      fields: [
        {
          name: '🔗 Dashboard Link',
          value: `[Click here to access the dashboard](${standardUrl})`
        },
        {
          name: '📋 Features',
          value: `• Manage verification settings\n• Configure security features\n• Track verification history\n• Monitor server activity\n• Control voice announcements`
        },
        {
          name: '🔐 Login Instructions',
          value: `1. Click on the dashboard link above\n2. Click "Login with Discord" button\n3. Authorize the application when prompted\n4. Select your server to manage settings`
        },
        {
          name: '⚠️ Troubleshooting Tips',
          value: `If you cannot access the dashboard:\n• Try refreshing the page or using a different browser\n• Check that you're logged into Discord in your browser\n• Ensure you have admin permissions on your server`
        }
      ],
      footer: {
        text: 'Only server administrators can access and manage dashboard settings'
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