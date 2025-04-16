const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const config = require('../utils/config');
const sessionManager = require('../utils/sessionManager');

module.exports = {
  name: 'game',
  description: 'Create and manage gaming sessions for your server',
  usage: '/game [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with gaming sessions',
      required: true,
      choices: [
        {
          name: 'create',
          value: 'create'
        },
        {
          name: 'join',
          value: 'join'
        },
        {
          name: 'list',
          value: 'list'
        },
        {
          name: 'end',
          value: 'end'
        }
      ]
    },
    {
      name: 'game',
      type: 3, // STRING type
      description: 'Game name for the session',
      required: false
    },
    {
      name: 'players',
      type: 4, // INTEGER type
      description: 'Number of players needed for the session',
      required: false
    },
    {
      name: 'time',
      type: 3, // STRING type
      description: 'When the gaming session will start (e.g., "in 30 minutes", "5pm EST")',
      required: false
    },
    {
      name: 'description',
      type: 3, // STRING type
      description: 'Additional details about the gaming session',
      required: false
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    if (!isSlashCommand) {
      return message.reply('Please use the slash command `/game` for gaming sessions.');
    }
    
    // Get server and user info
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get parameters
    const action = interaction.options.getString('action');
    const gameName = interaction.options.getString('game');
    const playerCount = interaction.options.getInteger('players');
    const gameTime = interaction.options.getString('time');
    const description = interaction.options.getString('description');
    
    // Get or initialize gaming sessions for this server
    const gamingSessions = serverConfig.gamingSessions || {};
    
    // Track this command
    sessionManager.trackCommand(userId, serverId, 'game', { action, gameName });
    
    // Defer reply for most actions as they might take time
    if (action !== 'join') {
      await interaction.deferReply();
    }
    
    // Handle different actions
    switch (action) {
      case 'create':
        // Check required parameters
        if (!gameName) {
          return interaction.followUp('❌ Please specify a game name with the `game` parameter.');
        }
        
        if (!playerCount) {
          return interaction.followUp('❌ Please specify the number of players needed with the `players` parameter.');
        }
        
        // Create a unique session ID
        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // Set up the gaming session
        const newSession = {
          id: sessionId,
          game: gameName,
          host: {
            id: userId,
            username: interaction.user.tag
          },
          players: [{
            id: userId,
            username: interaction.user.tag,
            joinedAt: Date.now()
          }],
          playerCount: playerCount,
          time: gameTime || 'As soon as the group is formed',
          description: description || `Join ${interaction.user.username}'s ${gameName} session!`,
          createdAt: Date.now(),
          status: 'open'
        };
        
        // Add session to server config
        gamingSessions[sessionId] = newSession;
        config.updateServerConfig(serverId, { gamingSessions });
        
        // Create join button
        const joinButton = new ButtonBuilder()
          .setCustomId(`join_game_${sessionId}`)
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎮');
          
        const cancelButton = new ButtonBuilder()
          .setCustomId(`cancel_game_${sessionId}`)
          .setLabel('Cancel Session')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌');
        
        const row = new ActionRowBuilder().addComponents(joinButton, cancelButton);
        
        // Create gaming session embed
        const sessionEmbed = {
          title: `🎮 ${gameName} - Gaming Session`,
          description: newSession.description,
          color: 0x9370DB, // Medium purple
          fields: [
            {
              name: 'Host',
              value: `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name: 'Players Needed',
              value: `${newSession.players.length}/${playerCount}`,
              inline: true
            },
            {
              name: 'When',
              value: newSession.time,
              inline: true
            },
            {
              name: 'Status',
              value: '✅ Recruiting players...',
              inline: true
            },
            {
              name: 'Players Joined',
              value: `<@${interaction.user.id}>`,
              inline: false
            }
          ],
          footer: {
            text: `Session ID: ${sessionId} • Use /game join to join this session`
          },
          timestamp: new Date()
        };
        
        // Send the gaming session announcement
        const sessionMsg = await interaction.followUp({
          embeds: [sessionEmbed],
          components: [row]
        });
        
        // Store message ID for later updates
        newSession.messageId = sessionMsg.id;
        config.updateServerConfig(serverId, { gamingSessions });
        
        // Set up button collector for joins
        setupGameButtonCollector(client, interaction.channel, sessionId, serverId);
        
        break;
        
      case 'list':
        // List all active gaming sessions
        const activeSessions = Object.values(gamingSessions)
          .filter(session => session.status === 'open');
        
        if (activeSessions.length === 0) {
          return interaction.followUp('📝 There are no active gaming sessions. Create one with `/game create`!');
        }
        
        // Create list embed
        const listEmbed = {
          title: '🎮 Active Gaming Sessions',
          description: 'Join one of these gaming sessions or create your own!',
          color: 0x4169E1, // Royal blue
          fields: activeSessions.map(session => ({
            name: `${session.game} (${session.players.length}/${session.playerCount} players)`,
            value: `**Host:** <@${session.host.id}>\n**When:** ${session.time}\n**Description:** ${session.description}\n**ID:** \`${session.id}\``
          })),
          footer: {
            text: `Use /game join to join a session • ${activeSessions.length} active sessions`
          },
          timestamp: new Date()
        };
        
        // Create join selector
        if (activeSessions.length > 0) {
          const joinSelector = new StringSelectMenuBuilder()
            .setCustomId('game_join_selector')
            .setPlaceholder('Select a session to join')
            .addOptions(activeSessions.map(session => ({
              label: `${session.game} (${session.players.length}/${session.playerCount})`,
              description: `Host: ${session.host.username}`,
              value: session.id
            })));
          
          const selectRow = new ActionRowBuilder().addComponents(joinSelector);
          
          await interaction.followUp({
            embeds: [listEmbed],
            components: [selectRow]
          });
          
          // Set up select menu collector
          setupGameSelectCollector(client, interaction.channel, serverId);
        } else {
          await interaction.followUp({ embeds: [listEmbed] });
        }
        
        break;
        
      case 'join':
        // Quick response for join command
        await interaction.deferReply({ ephemeral: true });
        
        // Check if session ID was provided via direct command
        if (!gameName) {
          // Create selector with all available sessions
          const openSessions = Object.values(gamingSessions)
            .filter(session => session.status === 'open');
          
          if (openSessions.length === 0) {
            return interaction.followUp({
              content: '❌ There are no open gaming sessions to join. Create one with `/game create`!',
              ephemeral: true
            });
          }
          
          // Create session selector
          const sessionSelector = new StringSelectMenuBuilder()
            .setCustomId('game_join_selector')
            .setPlaceholder('Select a session to join')
            .addOptions(openSessions.map(session => ({
              label: `${session.game} (${session.players.length}/${session.playerCount})`,
              description: `Host: ${session.host.username}`,
              value: session.id
            })));
          
          const selectorRow = new ActionRowBuilder().addComponents(sessionSelector);
          
          return interaction.followUp({
            content: '👇 Select a gaming session to join:',
            components: [selectorRow],
            ephemeral: true
          });
        }
        
        // If specific session ID was provided
        const sessionToJoin = gamingSessions[gameName]; // gameName parameter is used as session ID
        
        if (!sessionToJoin || sessionToJoin.status !== 'open') {
          return interaction.followUp({
            content: `❌ Gaming session with ID \`${gameName}\` not found or is no longer accepting players.`,
            ephemeral: true
          });
        }
        
        // Check if user already joined
        if (sessionToJoin.players.some(player => player.id === userId)) {
          return interaction.followUp({
            content: '❌ You have already joined this gaming session.',
            ephemeral: true
          });
        }
        
        // Add player to session
        sessionToJoin.players.push({
          id: userId,
          username: interaction.user.tag,
          joinedAt: Date.now()
        });
        
        // Update server config
        config.updateServerConfig(serverId, { gamingSessions });
        
        // Send confirmation
        await interaction.followUp({
          content: `✅ You've joined the **${sessionToJoin.game}** gaming session hosted by <@${sessionToJoin.host.id}>!`,
          ephemeral: true
        });
        
        // Try to update the original message
        try {
          const channel = interaction.channel;
          const message = await channel.messages.fetch(sessionToJoin.messageId);
          
          if (message) {
            // Update players list in embed
            const embed = message.embeds[0];
            const fields = [...embed.fields];
            
            // Update player count
            fields[1] = {
              name: 'Players Needed',
              value: `${sessionToJoin.players.length}/${sessionToJoin.playerCount}`,
              inline: true
            };
            
            // Update players list
            fields[4] = {
              name: 'Players Joined',
              value: sessionToJoin.players.map(player => `<@${player.id}>`).join('\n'),
              inline: false
            };
            
            // Check if session is now full
            if (sessionToJoin.players.length >= sessionToJoin.playerCount) {
              fields[3] = {
                name: 'Status',
                value: '✅ Session Full!',
                inline: true
              };
              
              sessionToJoin.status = 'full';
              config.updateServerConfig(serverId, { gamingSessions });
            }
            
            const updatedEmbed = {
              ...embed,
              fields: fields
            };
            
            await message.edit({ embeds: [updatedEmbed] });
            
            // Notify host if session is full
            if (sessionToJoin.status === 'full') {
              try {
                const host = await interaction.guild.members.fetch(sessionToJoin.host.id);
                host.send(`🎮 Your **${sessionToJoin.game}** gaming session is now full with ${sessionToJoin.playerCount} players! Time to start the game!`);
              } catch (e) {
                console.error('Could not DM host about full session:', e);
              }
              
              // Also send a message in the channel
              channel.send({
                content: `🎮 <@${sessionToJoin.host.id}>'s **${sessionToJoin.game}** gaming session is now full! All players: ${sessionToJoin.players.map(p => `<@${p.id}>`).join(' ')}`,
                allowedMentions: { users: [sessionToJoin.host.id] }
              });
            }
          }
        } catch (error) {
          console.error('Error updating game session message:', error);
        }
        
        break;
        
      case 'end':
        // List user's hosted sessions for cancellation
        const hostedSessions = Object.entries(gamingSessions)
          .filter(([id, session]) => session.host.id === userId && session.status === 'open')
          .map(([id, session]) => session);
        
        if (hostedSessions.length === 0) {
          return interaction.followUp('❌ You are not hosting any active gaming sessions.');
        }
        
        // If specific session ID was provided
        if (gameName && gamingSessions[gameName]) {
          const sessionToEnd = gamingSessions[gameName];
          
          // Check if user is the host
          if (sessionToEnd.host.id !== userId) {
            return interaction.followUp('❌ You can only end gaming sessions that you are hosting.');
          }
          
          // Mark session as ended
          sessionToEnd.status = 'ended';
          config.updateServerConfig(serverId, { gamingSessions });
          
          // Try to update the original message
          try {
            const channel = interaction.channel;
            const message = await channel.messages.fetch(sessionToEnd.messageId);
            
            if (message) {
              // Update status in embed
              const embed = message.embeds[0];
              const fields = [...embed.fields];
              
              fields[3] = {
                name: 'Status',
                value: '❌ Cancelled by host',
                inline: true
              };
              
              const updatedEmbed = {
                ...embed,
                fields: fields
              };
              
              // Disable buttons
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`join_game_${gameName}`)
                  .setLabel('Session Ended')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🚫')
                  .setDisabled(true)
              );
              
              await message.edit({ 
                embeds: [updatedEmbed],
                components: [disabledRow]
              });
            }
          } catch (error) {
            console.error('Error updating ended game session message:', error);
          }
          
          return interaction.followUp(`✅ Your **${sessionToEnd.game}** gaming session has been ended.`);
        }
        
        // If multiple sessions, let user select which to end
        const endSelector = new StringSelectMenuBuilder()
          .setCustomId('game_end_selector')
          .setPlaceholder('Select a session to end')
          .addOptions(hostedSessions.map(session => ({
            label: `${session.game} (${session.players.length}/${session.playerCount})`,
            description: `Created: ${new Date(session.createdAt).toLocaleString()}`,
            value: session.id
          })));
        
        const endSelectorRow = new ActionRowBuilder().addComponents(endSelector);
        
        await interaction.followUp({
          content: '👇 Select which gaming session you want to end:',
          components: [endSelectorRow]
        });
        
        // Set up select menu collector for ending games
        const endCollector = interaction.channel.createMessageComponentCollector({
          filter: i => i.customId === 'game_end_selector' && i.user.id === userId,
          time: 60000 // 1 minute
        });
        
        endCollector.on('collect', async i => {
          await i.deferUpdate();
          const selectedSessionId = i.values[0];
          const selectedSession = gamingSessions[selectedSessionId];
          
          if (!selectedSession) {
            return i.followUp({
              content: '❌ Session not found or already ended.',
              ephemeral: true
            });
          }
          
          // Mark session as ended
          selectedSession.status = 'ended';
          config.updateServerConfig(serverId, { gamingSessions });
          
          // Try to update the original message
          try {
            const channel = interaction.channel;
            const message = await channel.messages.fetch(selectedSession.messageId);
            
            if (message) {
              // Update status in embed
              const embed = message.embeds[0];
              const fields = [...embed.fields];
              
              fields[3] = {
                name: 'Status',
                value: '❌ Cancelled by host',
                inline: true
              };
              
              const updatedEmbed = {
                ...embed,
                fields: fields
              };
              
              // Disable buttons
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`join_game_${selectedSessionId}`)
                  .setLabel('Session Ended')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('🚫')
                  .setDisabled(true)
              );
              
              await message.edit({ 
                embeds: [updatedEmbed],
                components: [disabledRow]
              });
            }
          } catch (error) {
            console.error('Error updating ended game session message:', error);
          }
          
          await i.followUp({
            content: `✅ Your **${selectedSession.game}** gaming session has been ended.`,
            ephemeral: true
          });
          
          // Edit the original message to prevent further selections
          await interaction.editReply({
            content: `✅ Successfully ended the **${selectedSession.game}** gaming session.`,
            components: []
          });
          
          endCollector.stop();
        });
        
        endCollector.on('end', (collected, reason) => {
          if (reason === 'time' && collected.size === 0) {
            interaction.editReply({
              content: '⏱️ You did not select a session to end within the time limit.',
              components: []
            });
          }
        });
        
        break;
        
      default:
        await interaction.followUp('❌ Invalid action. Please use `create`, `join`, `list`, or `end`.');
    }
  },
};

/**
 * Set up collector for game session buttons
 * @param {Client} client Discord client
 * @param {TextChannel} channel Channel to collect from
 * @param {string} sessionId Session ID
 * @param {string} serverId Server ID
 */
function setupGameButtonCollector(client, channel, sessionId, serverId) {
  // Set up button collector
  const collector = channel.createMessageComponentCollector({
    filter: i => i.customId === `join_game_${sessionId}` || i.customId === `cancel_game_${sessionId}`,
    time: 86400000 // Collect for 24 hours
  });
  
  collector.on('collect', async i => {
    // Get server config
    const serverConfig = config.getServerConfig(serverId);
    const gamingSessions = serverConfig.gamingSessions || {};
    const session = gamingSessions[sessionId];
    
    // Check if session still exists
    if (!session) {
      return i.reply({
        content: '❌ This gaming session no longer exists.',
        ephemeral: true
      });
    }
    
    // Check if session is already full or ended
    if (session.status !== 'open') {
      return i.reply({
        content: `❌ This gaming session is ${session.status === 'full' ? 'already full' : 'no longer available'}.`,
        ephemeral: true
      });
    }
    
    // Handle join button
    if (i.customId === `join_game_${sessionId}`) {
      // Check if user already joined
      if (session.players.some(player => player.id === i.user.id)) {
        return i.reply({
          content: '❌ You have already joined this gaming session.',
          ephemeral: true
        });
      }
      
      // Add player to session
      session.players.push({
        id: i.user.id,
        username: i.user.tag,
        joinedAt: Date.now()
      });
      
      // Update server config
      config.updateServerConfig(serverId, { gamingSessions });
      
      // Send confirmation
      await i.reply({
        content: `✅ You've joined the **${session.game}** gaming session hosted by <@${session.host.id}>!`,
        ephemeral: true
      });
      
      // Update embed
      const message = i.message;
      const embed = message.embeds[0];
      const fields = [...embed.fields];
      
      // Update player count
      fields[1] = {
        name: 'Players Needed',
        value: `${session.players.length}/${session.playerCount}`,
        inline: true
      };
      
      // Update players list
      fields[4] = {
        name: 'Players Joined',
        value: session.players.map(player => `<@${player.id}>`).join('\n'),
        inline: false
      };
      
      // Check if session is now full
      if (session.players.length >= session.playerCount) {
        fields[3] = {
          name: 'Status',
          value: '✅ Session Full!',
          inline: true
        };
        
        session.status = 'full';
        config.updateServerConfig(serverId, { gamingSessions });
        
        // Notify host
        try {
          const host = await i.guild.members.fetch(session.host.id);
          host.send(`🎮 Your **${session.game}** gaming session is now full with ${session.playerCount} players! Time to start the game!`);
        } catch (e) {
          console.error('Could not DM host about full session:', e);
        }
        
        // Also send a message in the channel
        channel.send({
          content: `🎮 <@${session.host.id}>'s **${session.game}** gaming session is now full! All players: ${session.players.map(p => `<@${p.id}>`).join(' ')}`,
          allowedMentions: { users: [session.host.id] }
        });
        
        // Disable buttons if full
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`join_game_${sessionId}`)
            .setLabel('Session Full')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✅')
            .setDisabled(true),
          
          new ButtonBuilder()
            .setCustomId(`cancel_game_${sessionId}`)
            .setLabel('Cancel Session')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );
        
        await message.edit({
          embeds: [{ ...embed, fields }],
          components: [disabledRow]
        });
      } else {
        await message.edit({
          embeds: [{ ...embed, fields }]
        });
      }
    }
    // Handle cancel button
    else if (i.customId === `cancel_game_${sessionId}`) {
      // Check if user is the host
      if (session.host.id !== i.user.id) {
        return i.reply({
          content: '❌ Only the host can cancel this gaming session.',
          ephemeral: true
        });
      }
      
      // Mark session as ended
      session.status = 'ended';
      config.updateServerConfig(serverId, { gamingSessions });
      
      // Update embed
      const message = i.message;
      const embed = message.embeds[0];
      const fields = [...embed.fields];
      
      fields[3] = {
        name: 'Status',
        value: '❌ Cancelled by host',
        inline: true
      };
      
      // Create disabled buttons
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`join_game_${sessionId}`)
          .setLabel('Session Ended')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🚫')
          .setDisabled(true)
      );
      
      await message.edit({
        embeds: [{ ...embed, fields }],
        components: [disabledRow]
      });
      
      await i.reply({
        content: `✅ You have cancelled the **${session.game}** gaming session.`,
        ephemeral: true
      });
      
      // Notify participants
      if (session.players.length > 1) {
        channel.send(`ℹ️ The **${session.game}** gaming session hosted by <@${session.host.id}> has been cancelled.`);
      }
      
      // Stop the collector
      collector.stop();
    }
  });
}

/**
 * Set up collector for game join select menus
 * @param {Client} client Discord client
 * @param {TextChannel} channel Channel to collect from
 * @param {string} serverId Server ID
 */
function setupGameSelectCollector(client, channel, serverId) {
  // Set up select menu collector
  const collector = channel.createMessageComponentCollector({
    filter: i => i.customId === 'game_join_selector',
    time: 300000 // Collect for 5 minutes
  });
  
  collector.on('collect', async i => {
    // Get server config
    const serverConfig = config.getServerConfig(serverId);
    const gamingSessions = serverConfig.gamingSessions || {};
    const sessionId = i.values[0];
    const session = gamingSessions[sessionId];
    
    // Check if session still exists
    if (!session) {
      return i.reply({
        content: '❌ This gaming session no longer exists.',
        ephemeral: true
      });
    }
    
    // Check if session is already full or ended
    if (session.status !== 'open') {
      return i.reply({
        content: `❌ This gaming session is ${session.status === 'full' ? 'already full' : 'no longer available'}.`,
        ephemeral: true
      });
    }
    
    // Check if user already joined
    if (session.players.some(player => player.id === i.user.id)) {
      return i.reply({
        content: '❌ You have already joined this gaming session.',
        ephemeral: true
      });
    }
    
    // Add player to session
    session.players.push({
      id: i.user.id,
      username: i.user.tag,
      joinedAt: Date.now()
    });
    
    // Update server config
    config.updateServerConfig(serverId, { gamingSessions });
    
    // Send confirmation
    await i.reply({
      content: `✅ You've joined the **${session.game}** gaming session hosted by <@${session.host.id}>!`,
      ephemeral: true
    });
    
    // Try to update the original session message
    try {
      const message = await channel.messages.fetch(session.messageId);
      
      if (message) {
        // Update embed
        const embed = message.embeds[0];
        const fields = [...embed.fields];
        
        // Update player count
        fields[1] = {
          name: 'Players Needed',
          value: `${session.players.length}/${session.playerCount}`,
          inline: true
        };
        
        // Update players list
        fields[4] = {
          name: 'Players Joined',
          value: session.players.map(player => `<@${player.id}>`).join('\n'),
          inline: false
        };
        
        // Check if session is now full
        if (session.players.length >= session.playerCount) {
          fields[3] = {
            name: 'Status',
            value: '✅ Session Full!',
            inline: true
          };
          
          session.status = 'full';
          config.updateServerConfig(serverId, { gamingSessions });
          
          // Notify host
          try {
            const host = await i.guild.members.fetch(session.host.id);
            host.send(`🎮 Your **${session.game}** gaming session is now full with ${session.playerCount} players! Time to start the game!`);
          } catch (e) {
            console.error('Could not DM host about full session:', e);
          }
          
          // Also send a message in the channel
          channel.send({
            content: `🎮 <@${session.host.id}>'s **${session.game}** gaming session is now full! All players: ${session.players.map(p => `<@${p.id}>`).join(' ')}`,
            allowedMentions: { users: [session.host.id] }
          });
          
          // Disable buttons if full
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`join_game_${sessionId}`)
              .setLabel('Session Full')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('✅')
              .setDisabled(true),
            
            new ButtonBuilder()
              .setCustomId(`cancel_game_${sessionId}`)
              .setLabel('Cancel Session')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );
          
          await message.edit({
            embeds: [{ ...embed, fields }],
            components: [disabledRow]
          });
        } else {
          await message.edit({
            embeds: [{ ...embed, fields }]
          });
        }
      }
    } catch (error) {
      console.error('Error updating game session message from selector:', error);
    }
  });
}