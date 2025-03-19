const config = require('../utils/config');

module.exports = {
  name: 'help',
  description: 'Shows help information about the bot commands',
  usage: '!help',
  execute(message, args, client) {
    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    const prefix = serverConfig.prefix || '!';
    
    // Create an embed with command information
    const helpEmbed = {
      title: '📚 YouTube Verification Bot Help',
      description: `Use this bot to verify YouTube subscriptions and assign roles to subscribers.\nPrefix: \`${prefix}\``,
      color: 0xFF0000, // Red color for YouTube
      fields: [
        {
          name: `${prefix}setnotificationchannel`,
          value: 'Sets the current channel for bot notifications'
        },
        {
          name: `${prefix}setverificationchannel`,
          value: 'Sets the current channel for subscription verification'
        },
        {
          name: `${prefix}setyoutubechannel [channelId or URL]`,
          value: 'Sets the YouTube channel to verify subscriptions against'
        },
        {
          name: `${prefix}searchchannel [channel name]`,
          value: 'Search for a YouTube channel by name to get its ID'
        },
        {
          name: `${prefix}setrole [roleName]`,
          value: 'Sets the role to assign to verified subscribers'
        },
        {
          name: `${prefix}livesubcount`,
          value: 'Creates a voice channel showing live subscriber count for the YouTube channel'
        },
        {
          name: `${prefix}setvoicechannelname [format]`,
          value: 'Customizes the subscriber count voice channel name format'
        },
        {
          name: `${prefix}setupdatefrequency [minutes]`,
          value: 'Sets how often the subscriber count should update'
        },
        {
          name: `${prefix}help`,
          value: 'Shows this help message'
        }
      ],
      footer: {
        text: 'Only administrators can use setup commands'
      }
    };
    
    // Add current configuration info
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
    
    helpEmbed.fields.push(configField);
    
    // Add verification instructions
    if (serverConfig.verificationChannelId) {
      helpEmbed.fields.push({
        name: '🔍 How to Verify',
        value: `1. Subscribe to the YouTube channel${serverConfig.youtubeChannelName ? ` (${serverConfig.youtubeChannelName})` : ''}\n2. Take a screenshot showing your subscription\n3. Post the screenshot in <#${serverConfig.verificationChannelId}>\n4. Wait for verification and role assignment`
      });
    }
    
    message.channel.send({ embeds: [helpEmbed] });
  },
};
