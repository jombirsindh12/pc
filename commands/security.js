const config = require('../utils/config');

module.exports = {
  name: 'security',
  description: 'Manage advanced security features for the server',
  usage: '/security [enable/disable/status]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with security features',
      required: true,
      choices: [
        {
          name: 'enable',
          value: 'enable'
        },
        {
          name: 'disable',
          value: 'disable'
        },
        {
          name: 'status',
          value: 'status'
        }
      ]
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get action from args or options
    let action;
    if (isSlashCommand) {
      action = interaction.options.getString('action');
    } else {
      action = args[0]?.toLowerCase(); 
      
      // Check if a valid action was provided
      if (!action || !['enable', 'disable', 'status'].includes(action)) {
        return message.reply('❌ Please specify a valid action: `enable`, `disable`, or `status`');
      }
    }
    
    // Create embeds for showing security status
    const securityEmbed = {
      title: '🛡️ Server Security Settings',
      description: '',
      color: 0x3366FF, // Blue color
      fields: [],
      footer: {
        text: 'Phantom Guard Security System • Advanced Protection'
      }
    };
    
    // Handle different actions
    switch (action) {
      case 'enable':
        // Enable security features
        config.updateServerConfig(serverId, {
          securityDisabled: false
        });
        
        securityEmbed.description = '✅ **Security features have been enabled!**\n\nYour server is now protected against nukes, raids, and spam attacks.';
        securityEmbed.color = 0x00FF00; // Green for success
        
        securityEmbed.fields.push(
          {
            name: '🔒 Active Protections',
            value: '• Anti-Nuke: Prevent mass channel deletions\n' +
                   '• Anti-Ban: Prevent mass user bans\n' +
                   '• Anti-Raid: Detect multiple users joining rapidly\n' +
                   '• Spam Detection: Monitor for spam and mention abuse'
          },
          {
            name: '⚙️ Configuration',
            value: 'All security alerts will be sent to your notification channel if set.'
          }
        );
        break;
        
      case 'disable':
        // Disable security features
        config.updateServerConfig(serverId, {
          securityDisabled: true
        });
        
        securityEmbed.description = '⚠️ **Security features have been disabled**\n\nYour server is no longer protected against nukes, raids, and spam attacks.';
        securityEmbed.color = 0xFF0000; // Red for warning
        
        securityEmbed.fields.push(
          {
            name: '🔓 Disabled Protections',
            value: 'All security features are now disabled. It is recommended to enable them again for server protection.'
          }
        );
        break;
        
      case 'status':
        // Show current status
        const securityStatus = serverConfig.securityDisabled ? 'Disabled ❌' : 'Enabled ✅';
        
        securityEmbed.description = `**Security Status: ${securityStatus}**\n\nPhantom Guard's advanced security system helps protect your server from various threats.`;
        securityEmbed.color = serverConfig.securityDisabled ? 0xFF0000 : 0x00FF00;
        
        securityEmbed.fields.push(
          {
            name: '🔒 Protection Features',
            value: '• Anti-Nuke: Prevent mass channel deletions\n' +
                   '• Anti-Ban: Prevent mass user bans\n' +
                   '• Anti-Raid: Detect multiple users joining rapidly\n' +
                   '• Spam Detection: Monitor for spam and mention abuse'
          },
          {
            name: '📊 Recent Incidents',
            value: serverConfig.securityIncidents && serverConfig.securityIncidents.length > 0 
              ? `${serverConfig.securityIncidents.length} security incidents detected` 
              : 'No security incidents detected yet'
          },
          {
            name: '⚙️ Configuration',
            value: serverConfig.notificationChannelId 
              ? `Security alerts will be sent to <#${serverConfig.notificationChannelId}>` 
              : 'No notification channel set. Use /setnotificationchannel to receive security alerts.'
          }
        );
        break;
    }
    
    // Send the message via slash command or regular command
    if (isSlashCommand) {
      if (interaction.deferred) {
        interaction.followUp({ embeds: [securityEmbed] });
      } else {
        interaction.reply({ embeds: [securityEmbed] });
      }
    } else {
      message.channel.send({ embeds: [securityEmbed] });
    }
  },
};