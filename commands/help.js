const config = require('../utils/config');

module.exports = {
  name: 'help',
  description: 'Shows information about all bot features and commands',
  usage: '/help',
  guildOnly: false, // Allow this command to work in DMs
  options: [], // No options for slash command
  execute(message, args, client, interaction = null) {
    try {
      // Use interaction if available (slash command), otherwise use message (legacy)
      const isSlashCommand = !!interaction;
      
      // Check if in a guild or DM
      let serverId = null;
      let serverConfig = null;
      let prefix = '!';
      let inGuild = false;
      
      if (isSlashCommand) {
        inGuild = !!interaction.guild;
        if (inGuild) {
          serverId = interaction.guild.id;
          serverConfig = config.getServerConfig(serverId);
          prefix = serverConfig ? serverConfig.prefix || '!' : '!';
        }
      } else {
        inGuild = !!message.guild;
        if (inGuild) {
          serverId = message.guild.id;
          serverConfig = config.getServerConfig(serverId);
          prefix = serverConfig ? serverConfig.prefix || '!' : '!';
        }
      }
      
      // Create an embed with command information
      const helpEmbed = {
        title: '🛡️ Phantom Guard - All-in-One Discord Bot',
        description: `Phantom Guard combines YouTube verification, security, and moderation in one powerful package.\nAll commands now support slash (/) format!`,
        color: 0x7289DA, // Discord blue color
        fields: []
      };
    
    // YouTube Verification Section
    helpEmbed.fields.push({
      name: '📱 YouTube Verification System',
      value: 'Verify users by their YouTube subscription status and assign roles automatically.'
    });
    
    helpEmbed.fields.push({
      name: '📋 Verification Commands',
      value: `\`/setverificationchannel\` - Set a channel for verification\n`+
             `\`/setyoutubechannel [channelId or URL]\` - Set the YouTube channel\n`+
             `\`/searchchannel [channel name]\` - Search for a YouTube channel\n`+
             `\`/setrole [roleName]\` - Set role for verified subscribers\n`+
             `\`/setnotificationchannel\` - Set where notifications are sent`
    });
    
    // Live Counter Section
    helpEmbed.fields.push({
      name: '📊 Live Counters',
      value: `\`/livesubcount\` - Create a voice channel showing live subscriber count\n`+
             `\`/setvoicechannelname [format]\` - Customize voice channel format\n`+
             `\`/setupdatefrequency [minutes]\` - Set update frequency interval`
    });
    
    // Security & Moderation Features
    helpEmbed.fields.push({
      name: '🔐 Security Features',
      value: `Protect your server with our advanced security tools:\n`+
             `• Duplicate verification detection (prevents reused screenshots)\n`+
             `• Verified users tracking with \`/listverified\` command\n`+
             `• Anti-nuke protection against mass bans & channel deletion\n`+
             `• Raid detection for multiple joins in short time\n`+
             `• Spam & mention abuse prevention\n`+
             `• Manage security with \`/security\` command`
    });
    
    // Voice Channel Features
    helpEmbed.fields.push({
      name: '🎙️ Voice Channel Features',
      value: `\`/voice join\` - Join a voice channel with announcements\n`+
             `\`/voice leave\` - Leave the voice channel\n`+
             `\`/voice message\` - Send a voice message\n`+
             `\`/voice announce\` - Toggle join/leave announcements`
    });
    
    // Server Stats Features
    helpEmbed.fields.push({
      name: '📊 Server Statistics',
      value: `\`/serverstats setup\` - Create voice channels showing server stats\n`+
             `\`/serverstats role\` - Create a counter for members with a specific role\n`+
             `\`/serverstats custom\` - Create custom stat counters (online, bots, etc.)\n`+
             `\`/serverstats update\` - Manually update all stat channels`
    });

    // Web Dashboard
    helpEmbed.fields.push({
      name: '🌐 Web Dashboard',
      value: `Manage your bot settings easily from our web dashboard!\n`+
             `Dashboard: Use \`/dashboard\` command for a link\n`+
             `• Manage verification settings\n`+
             `• Configure security features\n`+
             `• Track verification history\n`+
             `• Monitor server activity`
    });
    
    // Bot Navigation
    helpEmbed.fields.push({
      name: '🧭 Bot Navigation',
      value: `\`/help\` - Shows this help message\n`+
             `Use slash commands for all actions - just type / to see all options!`
    });
    
    // Footer with admin info
    helpEmbed.footer = {
      text: 'Setup commands require Administrator permissions • Bot developed by Phantom Dev Team'
    };
    
    // Add current configuration info if in a server
    if (serverConfig) {
      const configField = {
        name: '⚙️ Current Configuration',
        value: ''
      };
      
      if (serverConfig.notificationChannelId) {
        configField.value += `• Notification Channel: <#${serverConfig.notificationChannelId}>\n`;
      } else {
        configField.value += '• Notification Channel: Not set\n';
      }
      
      if (serverConfig.verificationChannelId) {
        configField.value += `• Verification Channel: <#${serverConfig.verificationChannelId}>\n`;
      } else {
        configField.value += '• Verification Channel: Not set\n';
      }
      
      if (serverConfig.youtubeChannelName) {
        configField.value += `• YouTube Channel: ${serverConfig.youtubeChannelName}\n`;
      } else {
        configField.value += '• YouTube Channel: Not set\n';
      }
      
      if (serverConfig.roleName) {
        configField.value += `• Subscriber Role: ${serverConfig.roleName}\n`;
      } else {
        configField.value += '• Subscriber Role: Not set\n';
      }
      
      if (serverConfig.subCountChannelId) {
        configField.value += `• Subscriber Count: <#${serverConfig.subCountChannelId}>\n`;
        
        // Show update frequency if set
        if (serverConfig.updateFrequencyMinutes) {
          configField.value += `• Update Frequency: Every ${serverConfig.updateFrequencyMinutes} minutes\n`;
        }
        
        // Show voice channel format if set
        if (serverConfig.voiceChannelFormat) {
          configField.value += `• Voice Channel Format: \`${serverConfig.voiceChannelFormat}\`\n`;
        }
      } else {
        configField.value += '• Subscriber Count: Not set\n';
      }
      
      // Show server stats info if enabled
      if (serverConfig.statsConfig?.enabled) {
        configField.value += `• Server Stats: Enabled\n`;
        
        // Show category if set
        if (serverConfig.statsConfig.categoryId) {
          configField.value += `• Stats Category: <#${serverConfig.statsConfig.categoryId}>\n`;
        }
        
        // Show number of stat channels
        const statChannelCount = Object.keys(serverConfig.statsConfig.channels || {}).length;
        if (statChannelCount > 0) {
          configField.value += `• Stat Channels: ${statChannelCount} channels\n`;
        }
      } else {
        configField.value += '• Server Stats: Not set\n';
      }
      
      helpEmbed.fields.push(configField);
      
      // Add verification instructions
      if (serverConfig.verificationChannelId) {
        helpEmbed.fields.push({
          name: '🔍 How to Verify',
          value: `1. Subscribe to the YouTube channel${serverConfig.youtubeChannelName ? ` (${serverConfig.youtubeChannelName})` : ''}\n2. Take a screenshot showing your subscription\n3. Post the screenshot in <#${serverConfig.verificationChannelId}>\n4. Wait for verification and role assignment`
        });
      }
    } else {
      // Add note for DM mode
      helpEmbed.fields.push({
        name: '📝 Note',
        value: 'You are viewing this in Direct Messages mode. Some features are only available in servers.'
      });
    }
    
    // Send the message via slash command or regular command
    if (isSlashCommand) {
      if (interaction.deferred) {
        interaction.followUp({ embeds: [helpEmbed] });
      } else {
        interaction.reply({ embeds: [helpEmbed] });
      }
    } else {
      message.channel.send({ embeds: [helpEmbed] });
    }
    
    } catch (error) {
      console.error('Error in help command:', error);
      
      // Send error message
      if (isSlashCommand) {
        if (interaction.deferred) {
          interaction.followUp({ content: 'There was an error displaying the help information.', ephemeral: true });
        } else {
          interaction.reply({ content: 'There was an error displaying the help information.', ephemeral: true });
        }
      } else if (message.channel) {
        message.channel.send('There was an error displaying the help information.');
      }
    }
  },
};
