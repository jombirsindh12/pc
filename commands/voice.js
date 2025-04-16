const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'voice',
  description: 'Voice channel commands for joining, leaving, and sending messages',
  usage: '/voice [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with voice channels',
      required: true,
      choices: [
        {
          name: 'join',
          value: 'join'
        },
        {
          name: 'leave',
          value: 'leave'
        },
        {
          name: 'message',
          value: 'message'
        },
        {
          name: 'announce',
          value: 'announce'
        }
      ]
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Voice channel to join or affect (not required if already in a voice channel)',
      required: false
    },
    {
      name: 'message',
      type: 3, // STRING type
      description: 'Message to send to the voice channel (required for message action)',
      required: false
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get guild ID
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get action from args or options
    let action, targetChannel, messageContent;
    
    if (isSlashCommand) {
      action = interaction.options.getString('action');
      targetChannel = interaction.options.getChannel('channel');
      messageContent = interaction.options.getString('message');
      
      // Defer reply since some operations might take time
      await interaction.deferReply();
    } else {
      // Legacy command handling - not needed since we're focusing on slash commands
      return message.reply('Please use the slash command `/voice` instead.');
    }
    
    // Get the member who initiated the command
    const member = isSlashCommand ? interaction.member : message.member;
    
    switch (action) {
      case 'join':
        // Join a voice channel
        try {
          // If no channel specified, try to use the member's current voice channel
          if (!targetChannel) {
            // Check if member is in a voice channel
            if (!member.voice.channel) {
              return interaction.followUp({
                content: '❌ You need to join a voice channel first or specify a channel to join!',
                ephemeral: true
              });
            }
            
            targetChannel = member.voice.channel;
          }
          
          // Check if the channel is a voice channel
          if (targetChannel.type !== ChannelType.GuildVoice) {
            return interaction.followUp({
              content: '❌ The specified channel is not a voice channel!',
              ephemeral: true
            });
          }
          
          // Check if the bot has permissions to join and speak in the voice channel
          const permissions = targetChannel.permissionsFor(guild.members.me);
          if (!permissions.has(PermissionFlagsBits.Connect)) {
            return interaction.followUp({
              content: '❌ I don\'t have permission to join that voice channel!',
              ephemeral: true
            });
          }
          
          if (!permissions.has(PermissionFlagsBits.Speak)) {
            return interaction.followUp({
              content: '⚠️ I don\'t have permission to speak in that voice channel!',
              ephemeral: true
            });
          }
          
          // Join the voice channel
          try {
            // Store the current voice channel info in server config
            config.updateServerConfig(serverId, {
              activeVoiceChannelId: targetChannel.id,
              activeVoiceChannelName: targetChannel.name
            });
            
            // Set up join/leave tracking for this channel
            setupVoiceStateTracking(client, serverId, targetChannel.id);
            
            // Create voice channel monitor embed
            const voiceEmbed = new EmbedBuilder()
              .setTitle('🔊 Voice Channel Monitor')
              .setDescription(`Now monitoring voice channel: **${targetChannel.name}**`)
              .setColor(0x3498DB)
              .addFields(
                {
                  name: '👥 Current Members',
                  value: targetChannel.members.size > 1 
                    ? targetChannel.members.map(m => `• ${m.user.bot ? '🤖' : '👤'} ${m.user.tag}`).join('\n')
                    : 'No members in the channel yet'
                },
                {
                  name: '⚙️ Features',
                  value: '• Join/Leave Announcements\n• Voice Channel Messaging\n• Member Activity Tracking'
                }
              )
              .setFooter({ text: 'Use /voice leave to stop monitoring' })
              .setTimestamp();
            
            // Send success message
            await interaction.followUp({ embeds: [voiceEmbed] });
            
            // Log the action
            console.log(`Bot joined voice channel ${targetChannel.name} (${targetChannel.id}) in server ${guild.name}`);
            
          } catch (joinError) {
            console.error('Error joining voice channel:', joinError);
            return interaction.followUp({
              content: `❌ Failed to join the voice channel: ${joinError.message}`,
              ephemeral: true
            });
          }
        } catch (error) {
          console.error('Error in voice join command:', error);
          return interaction.followUp({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      case 'leave':
        // Leave the voice channel
        try {
          // Check if bot is in a voice channel in this server
          const serverConfig = config.getServerConfig(serverId);
          if (!serverConfig.activeVoiceChannelId) {
            return interaction.followUp({
              content: '❌ I\'m not currently in any voice channel in this server!',
              ephemeral: true
            });
          }
          
          // Update server config
          config.updateServerConfig(serverId, {
            activeVoiceChannelId: null,
            activeVoiceChannelName: null
          });
          
          // Send success message
          await interaction.followUp({
            content: '✅ Successfully stopped monitoring the voice channel.',
            ephemeral: false
          });
          
          // Log the action
          console.log(`Bot left voice channel in server ${guild.name}`);
          
        } catch (error) {
          console.error('Error in voice leave command:', error);
          return interaction.followUp({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      case 'message':
        // Send a message to a voice channel
        try {
          // Check if a message was provided
          if (!messageContent) {
            return interaction.followUp({
              content: '❌ You need to provide a message to send!',
              ephemeral: true
            });
          }
          
          // Check if bot is in an active voice channel for this server
          const serverConfig = config.getServerConfig(serverId);
          if (!serverConfig.activeVoiceChannelId) {
            return interaction.followUp({
              content: '❌ I\'m not currently in any voice channel in this server! Use `/voice join` first.',
              ephemeral: true
            });
          }
          
          // Get the channel from ID
          const voiceChannel = guild.channels.cache.get(serverConfig.activeVoiceChannelId);
          if (!voiceChannel) {
            // Voice channel not found, clear the stored ID
            config.updateServerConfig(serverId, {
              activeVoiceChannelId: null,
              activeVoiceChannelName: null
            });
            
            return interaction.followUp({
              content: '❌ The voice channel I was monitoring no longer exists!',
              ephemeral: true
            });
          }
          
          // Create and send the message embed to the notification channel
          const textChannelId = serverConfig.notificationChannelId || interaction.channelId;
          const textChannel = guild.channels.cache.get(textChannelId);
          
          if (!textChannel) {
            return interaction.followUp({
              content: '❌ Could not find a text channel to send the voice message to!',
              ephemeral: true
            });
          }
          
          // Create and send the message embed
          const messageEmbed = new EmbedBuilder()
            .setTitle('🔊 Voice Channel Message')
            .setDescription(messageContent)
            .setColor(0x3498DB)
            .setFooter({ 
              text: `Sent by ${member.user.tag} to ${voiceChannel.name}`, 
              iconURL: member.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();
          
          await textChannel.send({ embeds: [messageEmbed] });
          
          // Send success message
          await interaction.followUp({
            content: `✅ Message sent to voice channel **${voiceChannel.name}**!`,
            ephemeral: false
          });
          
        } catch (error) {
          console.error('Error in voice message command:', error);
          return interaction.followUp({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      case 'announce':
        // Toggle announcements for voice channel
        try {
          // Check if bot is in an active voice channel for this server
          const serverConfig = config.getServerConfig(serverId);
          if (!serverConfig.activeVoiceChannelId) {
            return interaction.followUp({
              content: '❌ I\'m not currently in any voice channel in this server! Use `/voice join` first.',
              ephemeral: true
            });
          }
          
          // Toggle announcement setting
          const currentSetting = serverConfig.voiceAnnouncements || false;
          config.updateServerConfig(serverId, {
            voiceAnnouncements: !currentSetting
          });
          
          // Send success message
          await interaction.followUp({
            content: `✅ Voice channel join/leave announcements are now ${!currentSetting ? 'enabled' : 'disabled'}.`,
            ephemeral: false
          });
          
        } catch (error) {
          console.error('Error in voice announce command:', error);
          return interaction.followUp({
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      default:
        return interaction.followUp({
          content: '❌ Invalid action! Available actions: join, leave, message, announce',
          ephemeral: true
        });
    }
  }
};

/**
 * Set up voice state change tracking for the specified channel
 * @param {Client} client - Discord client
 * @param {string} serverId - Server ID
 * @param {string} channelId - Voice channel ID to monitor
 */
function setupVoiceStateTracking(client, serverId, channelId) {
  // Add voice state update listener if not already present
  if (!client._hasVoiceListener) {
    client.on('voiceStateUpdate', async (oldState, newState) => {
      // Ignore bot voice state changes
      if (oldState.member.user.bot || newState.member.user.bot) return;
      
      // Get guild ID
      const guildId = oldState.guild.id || newState.guild.id;
      
      // Get server config
      const serverConfig = config.getServerConfig(guildId);
      
      // Check if we have an active voice channel set for this server
      if (!serverConfig.activeVoiceChannelId) return;
      
      // Check if announcements are enabled
      if (!serverConfig.voiceAnnouncements) return;
      
      // Get active voice channel
      const activeChannelId = serverConfig.activeVoiceChannelId;
      
      // User joined our tracked voice channel
      if (!oldState.channelId && newState.channelId === activeChannelId) {
        // User joined the voice channel
        await handleVoiceJoin(newState);
      }
      // User left our tracked voice channel
      else if (oldState.channelId === activeChannelId && !newState.channelId) {
        // User left the voice channel
        await handleVoiceLeave(oldState);
      }
      // User switched to our tracked voice channel
      else if (oldState.channelId !== activeChannelId && newState.channelId === activeChannelId) {
        // User switched to the voice channel
        await handleVoiceJoin(newState);
      }
      // User switched from our tracked voice channel to another
      else if (oldState.channelId === activeChannelId && newState.channelId !== activeChannelId) {
        // User switched from the voice channel
        await handleVoiceLeave(oldState);
      }
    });
    
    // Mark that we've set up the listener
    client._hasVoiceListener = true;
    console.log('Voice state update listener has been set up');
  }
}

/**
 * Handle a user joining a voice channel
 * @param {VoiceState} state - Voice state object
 */
async function handleVoiceJoin(state) {
  try {
    // Get server config
    const serverId = state.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get text channel for announcements
    const notificationChannelId = serverConfig.notificationChannelId;
    if (!notificationChannelId) return;
    
    const notificationChannel = state.guild.channels.cache.get(notificationChannelId);
    if (!notificationChannel) return;
    
    // Build embed
    const joinEmbed = new EmbedBuilder()
      .setTitle('🔊 Voice Channel Update')
      .setDescription(`**${state.member.user.tag}** joined the voice channel ${state.channel.name}`)
      .setColor(0x2ECC71) // Green color
      .setThumbnail(state.member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    
    // Send announcement
    await notificationChannel.send({ embeds: [joinEmbed] });
    
  } catch (error) {
    console.error('Error handling voice join:', error);
  }
}

/**
 * Handle a user leaving a voice channel
 * @param {VoiceState} state - Voice state object
 */
async function handleVoiceLeave(state) {
  try {
    // Get server config
    const serverId = state.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get text channel for announcements
    const notificationChannelId = serverConfig.notificationChannelId;
    if (!notificationChannelId) return;
    
    const notificationChannel = state.guild.channels.cache.get(notificationChannelId);
    if (!notificationChannel) return;
    
    // Build embed
    const leaveEmbed = new EmbedBuilder()
      .setTitle('🔊 Voice Channel Update')
      .setDescription(`**${state.member.user.tag}** left the voice channel ${state.channel.name}`)
      .setColor(0xE74C3C) // Red color
      .setThumbnail(state.member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    
    // Send announcement
    await notificationChannel.send({ embeds: [leaveEmbed] });
    
  } catch (error) {
    console.error('Error handling voice leave:', error);
  }
}