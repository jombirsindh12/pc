const config = require('../utils/config');

module.exports = {
  name: 'setannouncer',
  description: 'Configure voice channel join/leave announcements',
  usage: '/setannouncer [channel] [join_message] [leave_message]',
  options: [
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Text channel to send announcements in',
      required: true
    },
    {
      name: 'join_message',
      type: 3, // STRING type
      description: 'Message when users join voice (use {user} for mention, {channel} for VC name)',
      required: false
    },
    {
      name: 'leave_message',
      type: 3, // STRING type
      description: 'Message when users leave voice (use {user} for mention, {channel} for VC name)',
      required: false
    },
    {
      name: 'disable',
      type: 5, // BOOLEAN type
      description: 'Disable voice announcements',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get parameters
    let channel, joinMessage, leaveMessage, disable;
    
    if (isSlashCommand) {
      channel = interaction.options.getChannel('channel');
      joinMessage = interaction.options.getString('join_message');
      leaveMessage = interaction.options.getString('leave_message');
      disable = interaction.options.getBoolean('disable');
      
      // Defer reply
      await interaction.deferReply();
    } else {
      // Legacy command handling - simplified since we're focusing on slash commands
      return message.reply('Please use the slash command `/setannouncer` instead.');
    }
    
    // If disabling voice announcements
    if (disable) {
      config.updateServerConfig(serverId, {
        voiceAnnouncer: {
          enabled: false
        }
      });
      
      return interaction.followUp('✅ Voice channel announcements have been disabled.');
    }
    
    // Validate channel is a text channel
    if (channel.type !== 0) { // 0 is GUILD_TEXT channel type
      return interaction.followUp('❌ The channel must be a text channel.');
    }
    
    // Set default messages if none provided
    if (!joinMessage) {
      joinMessage = '🎙️ {user} has joined {channel}';
    }
    
    if (!leaveMessage) {
      leaveMessage = '👋 {user} has left {channel}';
    }
    
    // Set up voice announcer settings
    const announcerSettings = {
      enabled: true,
      channelId: channel.id,
      joinMessage,
      leaveMessage
    };
    
    // Update server config
    config.updateServerConfig(serverId, {
      voiceAnnouncer: announcerSettings
    });
    
    // Set up the voice announcer event handler if not already set
    if (!client._hasAnnouncerHandler) {
      setupAnnouncerHandler(client);
      client._hasAnnouncerHandler = true;
    }
    
    // Create embed for success message
    const embed = {
      title: '✅ Voice Announcer Set Up',
      description: `Voice channel join/leave announcements will now be sent to <#${channel.id}>.`,
      color: 0x00FF00,
      fields: [
        {
          name: 'Join Message',
          value: joinMessage.replace('{user}', '@user').replace('{channel}', 'Voice Channel')
        },
        {
          name: 'Leave Message',
          value: leaveMessage.replace('{user}', '@user').replace('{channel}', 'Voice Channel')
        }
      ]
    };
    
    // Send success message
    await interaction.followUp({ embeds: [embed] });
    
    // Send example announcements
    try {
      await channel.send(joinMessage
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{channel}', '**General Voice**'));
      
      // Wait a moment and send leave example
      setTimeout(async () => {
        await channel.send(leaveMessage
          .replace('{user}', `<@${interaction.user.id}>`)
          .replace('{channel}', '**General Voice**'));
      }, 2000);
    } catch (error) {
      console.error('Error sending example voice announcements:', error);
      await interaction.followUp('⚠️ I was able to set up voice announcements, but encountered an error sending test messages. Please check my permissions in that channel.');
    }
  },
};

// Setup voice announcer event handler
function setupAnnouncerHandler(client) {
  const config = require('../utils/config');
  
  client.on('voiceStateUpdate', async (oldState, newState) => {
    // No server or bot user
    if (!newState.guild || newState.member.user.bot) return;
    
    // If no state change in channels, ignore
    if (oldState.channelId === newState.channelId) return;
    
    const serverId = newState.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if voice announcer is enabled
    if (!serverConfig.voiceAnnouncer?.enabled || !serverConfig.voiceAnnouncer?.channelId) return;
    
    // Get announcer channel
    const announcerChannelId = serverConfig.voiceAnnouncer.channelId;
    const announcerChannel = newState.guild.channels.cache.get(announcerChannelId);
    if (!announcerChannel) return;
    
    // Get announcer settings
    const announcerSettings = serverConfig.voiceAnnouncer;
    
    try {
      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        const voiceChannel = newState.channel;
        
        // Send join message
        await announcerChannel.send(
          announcerSettings.joinMessage
            .replace('{user}', `<@${newState.member.id}>`)
            .replace('{channel}', `**${voiceChannel.name}**`)
        );
      }
      // User left a voice channel
      else if (oldState.channelId && !newState.channelId) {
        const voiceChannel = oldState.channel;
        
        // Send leave message
        await announcerChannel.send(
          announcerSettings.leaveMessage
            .replace('{user}', `<@${newState.member.id}>`)
            .replace('{channel}', `**${voiceChannel ? voiceChannel.name : 'Unknown Channel'}**`)
        );
      }
      // User switched voice channels
      else if (oldState.channelId !== newState.channelId) {
        const oldVoiceChannel = oldState.channel;
        const newVoiceChannel = newState.channel;
        
        // Send leave message for old channel
        await announcerChannel.send(
          announcerSettings.leaveMessage
            .replace('{user}', `<@${newState.member.id}>`)
            .replace('{channel}', `**${oldVoiceChannel ? oldVoiceChannel.name : 'Unknown Channel'}**`)
        );
        
        // Wait a moment then send join message for new channel
        setTimeout(async () => {
          await announcerChannel.send(
            announcerSettings.joinMessage
              .replace('{user}', `<@${newState.member.id}>`)
              .replace('{channel}', `**${newVoiceChannel ? newVoiceChannel.name : 'Unknown Channel'}**`)
          );
        }, 1000);
      }
    } catch (error) {
      console.error('Error sending voice announcement:', error);
    }
  });
  
  console.log('Voice announcer event handler has been set up');
}