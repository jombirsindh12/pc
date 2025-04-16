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
            // Create a voice connection - this makes the bot physically join the voice channel
            // and appear in the user list like a normal user
            try {
              const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
              
              // Create the connection
              const connection = joinVoiceChannel({
                channelId: targetChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false, // Not deafened to hear others
                selfMute: false  // Not muted so the bot appears active
              });
              
              // Listen for connection ready
              connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`Bot voice connection to ${targetChannel.name} is ready!`);
              });
              
              // Listen for disconnection
              connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.log(`Bot was disconnected from ${targetChannel.name}`);
                
                // Update server config to reflect disconnection
                config.updateServerConfig(serverId, {
                  activeVoiceChannelId: null,
                  activeVoiceChannelName: null
                });
              });
              
              // Store the connection in the client for later use
              client.voiceConnections = client.voiceConnections || {};
              client.voiceConnections[guild.id] = connection;
              
            } catch (voiceError) {
              console.error('Error creating voice connection:', voiceError);
              // Continue without voice connection - we'll still monitor the channel
            }
            
            // Store the current voice channel info in server config
            config.updateServerConfig(serverId, {
              activeVoiceChannelId: targetChannel.id,
              activeVoiceChannelName: targetChannel.name,
              voiceAnnouncements: true // Enable announcements by default
            });
            
            // Set up join/leave tracking for this channel
            setupVoiceStateTracking(client, serverId, targetChannel.id);
            
            // Send a message to the voice channel notification channel to announce bot presence
            const notificationChannelId = serverConfig.notificationChannelId || interaction.channelId;
            const notificationChannel = guild.channels.cache.get(notificationChannelId);
            
            if (notificationChannel) {
              await notificationChannel.send({
                content: `🤖 **KITT System**: I have joined voice channel **${targetChannel.name}**. I will now monitor this channel and announce member activity.`
              });
            }
            
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
                  name: '🎙️ Voice Status',
                  value: '• 🟢 Bot is active in voice channel\n• 📢 Announcements are enabled\n• 🔊 Tracking member join/leave events'
                },
                {
                  name: '⚙️ Features',
                  value: '• Join/Leave Announcements\n• Voice Channel Messaging\n• Member Activity Tracking\n• Time Spent Tracking'
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
          
          // Check if we have a voice connection to disconnect
          if (client.voiceConnections && client.voiceConnections[guild.id]) {
            try {
              // Get the voice connection
              const connection = client.voiceConnections[guild.id];
              
              // Send a message to the notification channel before disconnecting
              const notificationChannelId = serverConfig.notificationChannelId || interaction.channelId;
              const notificationChannel = guild.channels.cache.get(notificationChannelId);
              const channelName = serverConfig.activeVoiceChannelName || 'voice channel';
              
              if (notificationChannel) {
                await notificationChannel.send({
                  content: `🤖 **KITT System**: I am now leaving voice channel **${channelName}**. Voice monitoring has been stopped.`
                });
              }
              
              // Destroy the connection
              connection.destroy();
              
              // Remove from our tracking
              delete client.voiceConnections[guild.id];
              
              console.log(`Disconnected from voice in server ${guild.name}`);
            } catch (disconnectError) {
              console.error('Error disconnecting from voice:', disconnectError);
              // Continue anyway to update the config
            }
          }
          
          // Update server config
          config.updateServerConfig(serverId, {
            activeVoiceChannelId: null,
            activeVoiceChannelName: null,
            voiceSessionData: {} // Clear session data
          });
          
          // Send success message
          await interaction.followUp({
            content: '✅ Successfully left the voice channel and stopped monitoring.',
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
      if (oldState.member?.user.bot || newState.member?.user.bot) return;
      
      // Get guild ID
      const guildId = oldState.guild?.id || newState.guild?.id;
      if (!guildId) return;
      
      // Get server config
      const serverConfig = config.getServerConfig(guildId);
      
      // Check if we have an active voice channel set for this server
      if (!serverConfig.activeVoiceChannelId) return;
      
      // Get active voice channel
      const activeChannelId = serverConfig.activeVoiceChannelId;
      
      // Initialize or get voice session data
      const voiceSessionData = serverConfig.voiceSessionData || {};
      
      // User joined our tracked voice channel
      if (!oldState.channelId && newState.channelId === activeChannelId) {
        // User joined the voice channel
        
        // Store join time in session data
        if (newState.member && newState.member.user) {
          voiceSessionData[newState.member.user.id] = {
            joinTime: Date.now(),
            channelId: activeChannelId,
            username: newState.member.user.username
          };
          
          // Update server config with session data
          config.updateServerConfig(guildId, {
            voiceSessionData: voiceSessionData
          });
        }
        
        // Only send announcements if enabled
        if (serverConfig.voiceAnnouncements !== false) {
          await handleVoiceJoin(newState);
        }
      }
      // User left our tracked voice channel
      else if (oldState.channelId === activeChannelId && !newState.channelId) {
        // Only send announcements if enabled
        if (serverConfig.voiceAnnouncements !== false) {
          await handleVoiceLeave(oldState);
        }
      }
      // User switched to our tracked voice channel
      else if (oldState.channelId !== activeChannelId && newState.channelId === activeChannelId) {
        // Store join time in session data
        if (newState.member && newState.member.user) {
          voiceSessionData[newState.member.user.id] = {
            joinTime: Date.now(),
            channelId: activeChannelId,
            username: newState.member.user.username
          };
          
          // Update server config with session data
          config.updateServerConfig(guildId, {
            voiceSessionData: voiceSessionData
          });
        }
        
        // Only send announcements if enabled
        if (serverConfig.voiceAnnouncements !== false) {
          await handleVoiceJoin(newState);
        }
      }
      // User switched from our tracked voice channel to another
      else if (oldState.channelId === activeChannelId && newState.channelId !== activeChannelId) {
        // Only send announcements if enabled
        if (serverConfig.voiceAnnouncements !== false) {
          await handleVoiceLeave(oldState);
        }
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
    
    // Get user information
    const member = state.member;
    const username = member.nickname || member.user.username;
    const userAvatar = member.user.displayAvatarURL({ dynamic: true });
    const userID = member.user.id;
    const channelName = state.channel.name;
    
    // Format user status
    let userStatus = '';
    if (member.presence) {
      userStatus = member.presence.status || 'offline';
    }
    
    // Check how many other people are in the voice channel
    const memberCount = state.channel.members.size;
    let otherUsersMessage = '';
    
    if (memberCount > 1) {
      if (memberCount === 2) {
        // Get the other user
        const otherMember = state.channel.members.find(m => m.id !== userID);
        if (otherMember) {
          otherUsersMessage = `\n👥 Now talking with **${otherMember.user.username}**`;
        }
      } else {
        otherUsersMessage = `\n👥 Now talking with **${memberCount - 1}** other members`;
      }
    }
    
    // Build KITT-like embed with advanced formatting
    const joinEmbed = new EmbedBuilder()
      .setTitle('🎙️ Voice Channel Activity')
      .setDescription(`🔊 **${username}** joined voice channel **${channelName}**${otherUsersMessage}`)
      .setColor(0x2ECC71) // Green color
      .setThumbnail(userAvatar)
      .addFields(
        {
          name: '⏰ Joined At',
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        },
        {
          name: '👤 User Status',
          value: userStatus === 'online' ? '🟢 Online' : 
                 userStatus === 'idle' ? '🟡 Idle' : 
                 userStatus === 'dnd' ? '🔴 Do Not Disturb' : '⚫ Offline',
          inline: true
        }
      )
      .setFooter({ text: `ID: ${userID} • Channel ID: ${state.channel.id}` })
      .setTimestamp();
    
    // Send announcement
    await notificationChannel.send({ embeds: [joinEmbed] });
    
    // Send KITT-like text message
    await notificationChannel.send({
      content: `🤖 **KITT System**: User **${username}** has entered voice channel **${channelName}**. ${memberCount > 1 ? `There are now **${memberCount}** users in the channel.` : 'They are currently alone in the channel.'}`
    });
    
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
    
    // Get user information
    const member = state.member;
    const username = member.nickname || member.user.username;
    const userAvatar = member.user.displayAvatarURL({ dynamic: true });
    const userID = member.user.id;
    const channelName = state.channel.name;
    
    // Calculate time spent in voice channel
    const now = Date.now();
    let timeSpent = 'Unknown';
    
    // Check session data if available
    if (serverConfig.voiceSessionData && 
        serverConfig.voiceSessionData[userID] && 
        serverConfig.voiceSessionData[userID].joinTime) {
      
      const joinTime = serverConfig.voiceSessionData[userID].joinTime;
      const duration = now - joinTime;
      
      // Format duration
      if (duration < 60000) {
        // Less than a minute
        timeSpent = `${Math.floor(duration / 1000)} seconds`;
      } else if (duration < 3600000) {
        // Less than an hour
        timeSpent = `${Math.floor(duration / 60000)} minutes`;
      } else {
        // Hours and minutes
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        timeSpent = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    }
    
    // Check remaining members in the channel
    const remainingCount = state.channel.members.size;
    let remainingMessage = '';
    
    if (remainingCount === 0) {
      remainingMessage = '\n🔇 The channel is now empty.';
    } else if (remainingCount === 1) {
      const remainingMember = state.channel.members.first();
      remainingMessage = `\n👤 **${remainingMember.user.username}** is now alone in the channel.`;
    } else {
      remainingMessage = `\n👥 **${remainingCount}** members remain in the channel.`;
    }
    
    // Build KITT-like embed with advanced formatting
    const leaveEmbed = new EmbedBuilder()
      .setTitle('🎙️ Voice Channel Activity')
      .setDescription(`🔊 **${username}** left voice channel **${channelName}**${remainingMessage}`)
      .setColor(0xE74C3C) // Red color
      .setThumbnail(userAvatar)
      .addFields(
        {
          name: '⏰ Left At',
          value: `<t:${Math.floor(now / 1000)}:R>`,
          inline: true
        },
        {
          name: '⌛ Time Spent',
          value: timeSpent,
          inline: true
        }
      )
      .setFooter({ text: `ID: ${userID} • Channel ID: ${state.channel.id}` })
      .setTimestamp();
    
    // Send announcement
    await notificationChannel.send({ embeds: [leaveEmbed] });
    
    // Send KITT-like text message
    await notificationChannel.send({
      content: `🤖 **KITT System**: User **${username}** has left voice channel **${channelName}**. ${
        remainingCount === 0 ? 'The channel is now empty.' : 
        remainingCount === 1 ? 'One user remains in the channel.' : 
        `${remainingCount} users remain in the channel.`}`
    });
    
    // Clean up session data
    if (serverConfig.voiceSessionData && serverConfig.voiceSessionData[userID]) {
      const updatedSessionData = serverConfig.voiceSessionData || {};
      delete updatedSessionData[userID];
      
      config.updateServerConfig(serverId, {
        voiceSessionData: updatedSessionData
      });
    }
    
  } catch (error) {
    console.error('Error handling voice leave:', error);
  }
}