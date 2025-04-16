const config = require('../utils/config');

module.exports = {
  name: 'setlogs',
  description: 'Set up logging channels for different events',
  usage: '/setlogs [type] [channel]',
  options: [
    {
      name: 'type',
      type: 3, // STRING type
      description: 'Type of logs to set up',
      required: true,
      choices: [
        {
          name: 'mod',
          value: 'mod'
        },
        {
          name: 'server',
          value: 'server'
        },
        {
          name: 'message',
          value: 'message'
        },
        {
          name: 'voice',
          value: 'voice'
        },
        {
          name: 'join-leave',
          value: 'joinleave'
        },
        {
          name: 'all',
          value: 'all'
        }
      ]
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Channel to send logs to',
      required: true
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get parameters
    let logType, channel;
    
    if (isSlashCommand) {
      logType = interaction.options.getString('type');
      channel = interaction.options.getChannel('channel');
      
      // Defer reply
      await interaction.deferReply();
    } else {
      // Legacy command handling - simplified since we're focusing on slash commands
      return message.reply('Please use the slash command `/setlogs` instead.');
    }
    
    // Validate channel is a text channel
    if (channel.type !== 0) { // 0 is GUILD_TEXT channel type
      return interaction.followUp('❌ The channel must be a text channel.');
    }
    
    // Create log channels config if not exists
    const logChannels = serverConfig.logChannels || {};
    
    // Handle different log types
    if (logType === 'all') {
      // Set all log types to the same channel
      logChannels.mod = channel.id;
      logChannels.server = channel.id;
      logChannels.message = channel.id;
      logChannels.voice = channel.id;
      logChannels.joinleave = channel.id;
    } else {
      // Set specific log type
      logChannels[logType] = channel.id;
    }
    
    // Update server config
    config.updateServerConfig(serverId, {
      logChannels: logChannels
    });
    
    // Set up the logging event handlers if not already set
    if (!client._hasLogHandlers) {
      setupLogHandlers(client);
      client._hasLogHandlers = true;
    }
    
    // Create embed for success message
    const embed = {
      title: '✅ Logging Channels Set',
      description: logType === 'all' 
        ? `All log types will now be sent to <#${channel.id}>.`
        : `**${getLogTypeName(logType)}** logs will now be sent to <#${channel.id}>.`,
      color: 0x00FF00,
      fields: [
        {
          name: 'Current Log Channels',
          value: formatLogChannelsInfo(logChannels, interaction.guild)
        }
      ],
      footer: {
        text: 'Logs will appear automatically as events occur'
      }
    };
    
    // Send success message
    await interaction.followUp({ embeds: [embed] });
    
    // Send a test log to the channel to confirm it's working
    try {
      await channel.send({
        embeds: [{
          title: '📝 Log System Initialized',
          description: `This channel has been set up to receive **${getLogTypeName(logType)}** logs.`,
          color: 0x5865F2,
          fields: [
            {
              name: 'Setup By',
              value: `<@${interaction.user.id}> (${interaction.user.tag})`
            },
            {
              name: 'Timestamp',
              value: new Date().toLocaleString()
            }
          ]
        }]
      });
    } catch (error) {
      console.error('Error sending test log:', error);
      await interaction.followUp('⚠️ I was able to set the log channel, but encountered an error sending a test message. Please check my permissions in that channel.');
    }
  },
};

// Helper function to get user-friendly name for log types
function getLogTypeName(logType) {
  const logTypeNames = {
    mod: 'Moderation',
    server: 'Server Changes',
    message: 'Message',
    voice: 'Voice Channel',
    joinleave: 'Join/Leave'
  };
  
  return logTypeNames[logType] || logType.charAt(0).toUpperCase() + logType.slice(1);
}

// Helper function to format log channels info
function formatLogChannelsInfo(logChannels, guild) {
  if (!logChannels || Object.keys(logChannels).length === 0) {
    return 'No logging channels configured yet.';
  }
  
  let info = '';
  
  // Add each log type
  if (logChannels.mod) {
    const channel = guild.channels.cache.get(logChannels.mod);
    info += `• Moderation Logs: ${channel ? `<#${channel.id}>` : 'Channel not found'}\n`;
  }
  
  if (logChannels.server) {
    const channel = guild.channels.cache.get(logChannels.server);
    info += `• Server Change Logs: ${channel ? `<#${channel.id}>` : 'Channel not found'}\n`;
  }
  
  if (logChannels.message) {
    const channel = guild.channels.cache.get(logChannels.message);
    info += `• Message Logs: ${channel ? `<#${channel.id}>` : 'Channel not found'}\n`;
  }
  
  if (logChannels.voice) {
    const channel = guild.channels.cache.get(logChannels.voice);
    info += `• Voice Channel Logs: ${channel ? `<#${channel.id}>` : 'Channel not found'}\n`;
  }
  
  if (logChannels.joinleave) {
    const channel = guild.channels.cache.get(logChannels.joinleave);
    info += `• Join/Leave Logs: ${channel ? `<#${channel.id}>` : 'Channel not found'}\n`;
  }
  
  return info || 'No logging channels configured yet.';
}

// Setup log event handlers
function setupLogHandlers(client) {
  const config = require('../utils/config');
  
  // MESSAGE DELETE
  client.on('messageDelete', async message => {
    // Ignore DMs and bot messages
    if (!message.guild || message.author?.bot) return;
    
    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if message logs are enabled
    if (!serverConfig.logChannels?.message) return;
    
    // Get log channel
    const logChannelId = serverConfig.logChannels.message;
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    // Create log embed
    const embed = {
      title: '🗑️ Message Deleted',
      description: message.content || 'No text content',
      color: 0xFF9900,
      fields: [
        {
          name: 'Channel',
          value: `<#${message.channel.id}>`
        }
      ],
      footer: {
        text: `User ID: ${message.author?.id || 'Unknown'}`
      },
      timestamp: new Date()
    };
    
    // Add author if available
    if (message.author) {
      embed.author = {
        name: message.author.tag,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      };
    }
    
    // Add attachment info if any
    if (message.attachments.size > 0) {
      const attachmentList = Array.from(message.attachments.values())
        .map(a => `[${a.name}](${a.url})`)
        .join('\n');
      
      embed.fields.push({
        name: 'Attachments',
        value: attachmentList
      });
    }
    
    // Send log
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending message delete log:', error);
    }
  });
  
  // MESSAGE UPDATE
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    // Ignore DMs, bot messages, and empty content
    if (!newMessage.guild || newMessage.author?.bot || 
        oldMessage.content === newMessage.content) return;
    
    const serverId = newMessage.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if message logs are enabled
    if (!serverConfig.logChannels?.message) return;
    
    // Get log channel
    const logChannelId = serverConfig.logChannels.message;
    const logChannel = newMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    // Create log embed
    const embed = {
      title: '✏️ Message Edited',
      color: 0x3498DB,
      fields: [
        {
          name: 'Before',
          value: oldMessage.content || 'No text content'
        },
        {
          name: 'After',
          value: newMessage.content || 'No text content'
        },
        {
          name: 'Channel',
          value: `<#${newMessage.channel.id}>`
        },
        {
          name: 'Jump to Message',
          value: `[Click Here](${newMessage.url})`
        }
      ],
      footer: {
        text: `User ID: ${newMessage.author?.id || 'Unknown'}`
      },
      timestamp: new Date()
    };
    
    // Add author if available
    if (newMessage.author) {
      embed.author = {
        name: newMessage.author.tag,
        icon_url: newMessage.author.displayAvatarURL({ dynamic: true })
      };
    }
    
    // Send log
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending message update log:', error);
    }
  });
  
  // MEMBER JOIN
  client.on('guildMemberAdd', async member => {
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if join/leave logs are enabled
    if (!serverConfig.logChannels?.joinleave) return;
    
    // Get log channel
    const logChannelId = serverConfig.logChannels.joinleave;
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    // Calculate account age
    const createdAt = member.user.createdAt;
    const createdDaysAgo = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
    
    // Create log embed
    const embed = {
      title: '📥 Member Joined',
      description: `<@${member.id}> ${member.user.tag}`,
      color: 0x00FF00,
      fields: [
        {
          name: 'Account Created',
          value: `${createdAt.toUTCString()} (${createdDaysAgo} days ago)`
        },
        {
          name: 'Member Count',
          value: `${member.guild.memberCount.toLocaleString()}`
        }
      ],
      footer: {
        text: `User ID: ${member.id}`
      },
      timestamp: new Date()
    };
    
    // Add user avatar
    embed.thumbnail = {
      url: member.user.displayAvatarURL({ dynamic: true })
    };
    
    // Send log
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending member join log:', error);
    }
  });
  
  // MEMBER LEAVE
  client.on('guildMemberRemove', async member => {
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if join/leave logs are enabled
    if (!serverConfig.logChannels?.joinleave) return;
    
    // Get log channel
    const logChannelId = serverConfig.logChannels.joinleave;
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    // Calculate time in server
    const joinedAt = member.joinedAt;
    const joinedDaysAgo = joinedAt 
      ? Math.floor((Date.now() - joinedAt) / (1000 * 60 * 60 * 24))
      : 'Unknown';
    
    // Create log embed
    const embed = {
      title: '📤 Member Left',
      description: `${member.user.tag}`,
      color: 0xFF0000,
      fields: [
        {
          name: 'Joined Server',
          value: joinedAt 
            ? `${joinedAt.toUTCString()} (${joinedDaysAgo} days ago)`
            : 'Unknown join date'
        },
        {
          name: 'Roles',
          value: member.roles.cache.size > 1
            ? member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ')
            : 'No roles'
        },
        {
          name: 'Member Count',
          value: `${member.guild.memberCount.toLocaleString()}`
        }
      ],
      footer: {
        text: `User ID: ${member.id}`
      },
      timestamp: new Date()
    };
    
    // Add user avatar
    embed.thumbnail = {
      url: member.user.displayAvatarURL({ dynamic: true })
    };
    
    // Send log
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending member leave log:', error);
    }
  });
  
  // VOICE CHANNEL EVENTS
  client.on('voiceStateUpdate', async (oldState, newState) => {
    // No server, same states, or bot user
    if (!newState.guild || (oldState.channelId === newState.channelId) || newState.member.user.bot) return;
    
    const serverId = newState.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if voice logs are enabled
    if (!serverConfig.logChannels?.voice) return;
    
    // Get log channel
    const logChannelId = serverConfig.logChannels.voice;
    const logChannel = newState.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    // Default embed
    const embed = {
      footer: {
        text: `User ID: ${newState.member.id}`
      },
      timestamp: new Date(),
      author: {
        name: newState.member.user.tag,
        icon_url: newState.member.user.displayAvatarURL({ dynamic: true })
      }
    };
    
    // Joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      embed.title = '🔊 Voice Channel Joined';
      embed.description = `<@${newState.member.id}> joined <#${newState.channelId}>`;
      embed.color = 0x00FF00;
    }
    // Left a voice channel
    else if (oldState.channelId && !newState.channelId) {
      embed.title = '🔊 Voice Channel Left';
      embed.description = `<@${newState.member.id}> left <#${oldState.channelId}>`;
      embed.color = 0xFF0000;
    }
    // Moved voice channels
    else if (oldState.channelId !== newState.channelId) {
      embed.title = '🔊 Voice Channel Moved';
      embed.description = `<@${newState.member.id}> moved from <#${oldState.channelId}> to <#${newState.channelId}>`;
      embed.color = 0xFFA500;
    } else {
      // Other voice state changes (mute, deaf, etc.) - we'll skip these
      return;
    }
    
    // Send log
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending voice state update log:', error);
    }
  });
  
  console.log('Log event handlers have been set up');
}