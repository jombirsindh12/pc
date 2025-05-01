const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const securityManager = require('../utils/securityManager');
const config = require('../utils/config');

module.exports = {
  name: 'lockdown',
  description: 'Enable or disable emergency server lockdown (Owner only)',
  usage: '/lockdown [enable/disable] [reason]',
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Enable or disable emergency server lockdown')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable emergency lockdown mode to protect your server during attacks')
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for the lockdown')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable lockdown mode and restore normal server operations')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check lockdown status')
    ),
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get guild, user, etc.
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const user = isSlashCommand ? interaction.user : message.author;
    const serverId = guild.id;
    const userId = user.id;
    
    // Always require server owner for lockdown
    const isOwner = guild.ownerId === userId;
    
    if (!isOwner) {
      const errorResponse = '🔒 **SECURITY ALERT**: Only the server owner can use emergency lockdown features!';
      if (isSlashCommand) {
        return interaction.reply({ content: errorResponse, ephemeral: true });
      } else {
        return message.reply(errorResponse);
      }
    }
    
    // Get server config
    const serverConfig = config.getServerConfig(serverId);
    
    // Handle subcommands
    let subcommand;
    
    if (isSlashCommand) {
      await interaction.deferReply({ ephemeral: false });
      subcommand = interaction.options.getSubcommand();
    } else {
      if (!args || args.length === 0) {
        return message.reply('❌ Please specify an action: `enable`, `disable`, or `status`');
      }
      subcommand = args[0].toLowerCase();
      if (!['enable', 'disable', 'status'].includes(subcommand)) {
        return message.reply('❌ Invalid action. Please use `enable`, `disable`, or `status`');
      }
    }
    
    switch (subcommand) {
      case 'enable': {
        // Get reason
        let reason;
        if (isSlashCommand) {
          reason = interaction.options.getString('reason') || 'Security emergency';
        } else {
          reason = args.slice(1).join(' ') || 'Security emergency';
        }
        
        // Check if already in lockdown
        if (serverConfig.lockdownActive) {
          const alreadyActiveEmbed = new EmbedBuilder()
            .setTitle('🔒 Server Already In Lockdown')
            .setDescription(`This server is already in lockdown mode.`)
            .setColor(0xFF9900)
            .addFields(
              {
                name: 'Lockdown Info',
                value: `**Reason:** ${serverConfig.lockdownInfo?.reason || 'Not specified'}\n`+
                       `**Started:** ${serverConfig.lockdownInfo?.timestamp ? 
                         `<t:${Math.floor(serverConfig.lockdownInfo.timestamp/1000)}:R>` : 
                         'Unknown'}\n`+
                       `**Requested by:** <@${serverConfig.lockdownInfo?.requesterId || userId}>`
              }
            )
            .setFooter({ text: 'Use /lockdown disable to end the lockdown' })
            .setTimestamp();
            
          if (isSlashCommand) {
            return interaction.editReply({ embeds: [alreadyActiveEmbed] });
          } else {
            return message.reply({ embeds: [alreadyActiveEmbed] });
          }
        }
        
        // Show confirmation dialog
        const confirmEmbed = new EmbedBuilder()
          .setTitle('🚨 EMERGENCY LOCKDOWN CONFIRMATION')
          .setDescription('**Are you sure you want to lockdown the entire server?**\n\n' +
                         'This will:\n' +
                         '• Disable messaging in all channels\n' +
                         '• Prevent new threads from being created\n' +
                         '• Send lockdown notifications to all channels\n\n' +
                         '**Note:** Only you, the server owner, can end the lockdown.')
          .setColor(0xFF0000)
          .addFields(
            {
              name: 'Reason',
              value: reason
            }
          )
          .setTimestamp();
          
        // Create confirm/cancel buttons
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`lockdown_confirm_${serverId}`)
              .setLabel('CONFIRM LOCKDOWN')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒'),
            new ButtonBuilder()
              .setCustomId(`lockdown_cancel_${serverId}`)
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Secondary)
          );
          
        // Send confirmation message
        let confirmMessage;
        if (isSlashCommand) {
          confirmMessage = await interaction.editReply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
          });
        } else {
          confirmMessage = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
          });
        }
        
        // Set up collector for the confirmation buttons
        const filter = i => i.user.id === userId && 
                            (i.customId === `lockdown_confirm_${serverId}` || 
                             i.customId === `lockdown_cancel_${serverId}`);
                             
        const collector = confirmMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000 // 1 minute timeout
        });
        
        collector.on('collect', async i => {
          // Stop collector after button press
          collector.stop();
          
          if (i.customId === `lockdown_cancel_${serverId}`) {
            // User cancelled
            const cancelEmbed = new EmbedBuilder()
              .setTitle('❌ Lockdown Cancelled')
              .setDescription('Server lockdown has been cancelled.')
              .setColor(0x00FF00)
              .setTimestamp();
              
            await i.update({ 
              embeds: [cancelEmbed], 
              components: [] 
            });
            return;
          }
          
          // User confirmed lockdown
          await i.update({ 
            content: '🔒 **INITIATING EMERGENCY LOCKDOWN...**\nPlease wait while all channels are being locked.',
            embeds: [], 
            components: []
          });
          
          // Execute lockdown
          const result = await securityManager.enableLockdownMode(client, serverId, userId, reason);
          
          if (result.success) {
            // Lockdown successful
            const successEmbed = new EmbedBuilder()
              .setTitle('🔒 SERVER LOCKDOWN ACTIVE')
              .setDescription(`The server has been successfully locked down.`)
              .setColor(0xFF0000)
              .addFields(
                {
                  name: 'Lockdown Details',
                  value: `**Channels Locked:** ${result.affectedChannels}\n` +
                         `**Failed Channels:** ${result.failedChannels}\n` +
                         `**Reason:** ${reason}\n` +
                         `**Requested by:** <@${userId}>`
                },
                {
                  name: 'How to End Lockdown',
                  value: 'Only the server owner can end the lockdown using `/lockdown disable`'
                }
              )
              .setTimestamp();
              
            // Send success message
            await i.editReply({ 
              content: null,
              embeds: [successEmbed],
              components: [] 
            });
          } else {
            // Lockdown failed
            const errorEmbed = new EmbedBuilder()
              .setTitle('❌ Lockdown Failed')
              .setDescription(`Failed to initiate server lockdown: ${result.error}`)
              .setColor(0xFF9900)
              .setTimestamp();
              
            await i.editReply({ 
              content: null,
              embeds: [errorEmbed], 
              components: [] 
            });
          }
        });
        
        collector.on('end', async (collected, reason) => {
          if (reason === 'time' && collected.size === 0) {
            // Timed out
            const timeoutEmbed = new EmbedBuilder()
              .setTitle('⏱️ Lockdown Confirmation Expired')
              .setDescription('Lockdown was not confirmed in time. Please try again if needed.')
              .setColor(0x808080)
              .setTimestamp();
              
            if (isSlashCommand) {
              await interaction.editReply({ 
                embeds: [timeoutEmbed], 
                components: [] 
              }).catch(console.error);
            } else if (confirmMessage.editable) {
              await confirmMessage.edit({ 
                embeds: [timeoutEmbed], 
                components: [] 
              }).catch(console.error);
            }
          }
        });
        
        break;
      }
      
      case 'disable': {
        // Check if server is in lockdown
        if (!serverConfig.lockdownActive) {
          const notActiveEmbed = new EmbedBuilder()
            .setTitle('❓ No Lockdown Active')
            .setDescription('This server is not currently in lockdown mode.')
            .setColor(0x00FF00)
            .setTimestamp();
            
          if (isSlashCommand) {
            return interaction.editReply({ embeds: [notActiveEmbed] });
          } else {
            return message.reply({ embeds: [notActiveEmbed] });
          }
        }
        
        // Show disable confirmation
        const confirmEmbed = new EmbedBuilder()
          .setTitle('🔓 End Server Lockdown?')
          .setDescription('Are you sure you want to end the server lockdown?\n\n' +
                         'This will:\n' +
                         '• Restore messaging permissions for all channels\n' +
                         '• Send unlock notifications to all channels\n' +
                         '• Resume normal server operations')
          .setColor(0x00AA00)
          .addFields(
            {
              name: 'Current Lockdown Info',
              value: `**Reason:** ${serverConfig.lockdownInfo?.reason || 'Not specified'}\n`+
                     `**Started:** ${serverConfig.lockdownInfo?.timestamp ? 
                       `<t:${Math.floor(serverConfig.lockdownInfo.timestamp/1000)}:R>` : 
                       'Unknown'}`
            }
          )
          .setTimestamp();
          
        // Create confirm/cancel buttons
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`lockdown_end_confirm_${serverId}`)
              .setLabel('END LOCKDOWN')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🔓'),
            new ButtonBuilder()
              .setCustomId(`lockdown_end_cancel_${serverId}`)
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Secondary)
          );
          
        // Send confirmation message
        let confirmMessage;
        if (isSlashCommand) {
          confirmMessage = await interaction.editReply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
          });
        } else {
          confirmMessage = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
          });
        }
        
        // Set up collector for the confirmation buttons
        const filter = i => i.user.id === userId && 
                            (i.customId === `lockdown_end_confirm_${serverId}` || 
                             i.customId === `lockdown_end_cancel_${serverId}`);
                             
        const collector = confirmMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000 // 1 minute timeout
        });
        
        collector.on('collect', async i => {
          // Stop collector after button press
          collector.stop();
          
          if (i.customId === `lockdown_end_cancel_${serverId}`) {
            // User cancelled
            const cancelEmbed = new EmbedBuilder()
              .setTitle('✅ Kept Lockdown Active')
              .setDescription('Server will remain in lockdown mode.')
              .setColor(0xFF0000)
              .setTimestamp();
              
            await i.update({ 
              embeds: [cancelEmbed], 
              components: [] 
            });
            return;
          }
          
          // User confirmed to end lockdown
          await i.update({ 
            content: '🔓 **ENDING EMERGENCY LOCKDOWN...**\nPlease wait while all channels are being restored.',
            embeds: [], 
            components: []
          });
          
          // Execute lockdown
          const result = await securityManager.disableLockdownMode(client, serverId, userId);
          
          if (result.success) {
            // Lockdown ended successful
            const successEmbed = new EmbedBuilder()
              .setTitle('🔓 SERVER LOCKDOWN ENDED')
              .setDescription(`The server lockdown has been successfully ended.`)
              .setColor(0x00FF00)
              .addFields(
                {
                  name: 'Restoration Details',
                  value: `**Channels Restored:** ${result.restoredChannels}\n` +
                         `**Failed Channels:** ${result.failedChannels}\n` +
                         `**Ended by:** <@${userId}>`
                }
              )
              .setTimestamp();
              
            // Send success message
            await i.editReply({ 
              content: null,
              embeds: [successEmbed],
              components: [] 
            });
          } else {
            // Failed to end lockdown
            const errorEmbed = new EmbedBuilder()
              .setTitle('❌ Failed to End Lockdown')
              .setDescription(`Failed to end server lockdown: ${result.error}`)
              .setColor(0xFF9900)
              .setTimestamp();
              
            await i.editReply({ 
              content: null,
              embeds: [errorEmbed], 
              components: [] 
            });
          }
        });
        
        collector.on('end', async (collected, reason) => {
          if (reason === 'time' && collected.size === 0) {
            // Timed out
            const timeoutEmbed = new EmbedBuilder()
              .setTitle('⏱️ Action Expired')
              .setDescription('The lockdown remains active. Please try again if you want to end it.')
              .setColor(0x808080)
              .setTimestamp();
              
            if (isSlashCommand) {
              await interaction.editReply({ 
                embeds: [timeoutEmbed], 
                components: [] 
              }).catch(console.error);
            } else if (confirmMessage.editable) {
              await confirmMessage.edit({ 
                embeds: [timeoutEmbed], 
                components: [] 
              }).catch(console.error);
            }
          }
        });
        
        break;
      }
      
      case 'status': {
        // Get lockdown status
        const isActive = !!serverConfig.lockdownActive;
        const lockdownInfo = serverConfig.lockdownInfo || {};
        const lastLockdown = serverConfig.lastLockdown || {};
        
        const statusEmbed = new EmbedBuilder()
          .setTitle(`${isActive ? '🔒 Lockdown Active' : '🔓 No Active Lockdown'}`)
          .setDescription(isActive ? 
            'This server is currently in emergency lockdown mode. All channels are restricted.' : 
            'This server is operating normally with no active lockdown.')
          .setColor(isActive ? 0xFF0000 : 0x00FF00)
          .setTimestamp();
        
        if (isActive) {
          // Show active lockdown info
          statusEmbed.addFields(
            {
              name: 'Lockdown Details',
              value: `**Reason:** ${lockdownInfo.reason || 'Not specified'}\n` +
                     `**Started:** ${lockdownInfo.timestamp ? 
                       `<t:${Math.floor(lockdownInfo.timestamp/1000)}:R>` : 'Unknown'}\n` +
                     `**Requested by:** <@${lockdownInfo.requesterId || 'Unknown'}>\n` +
                     `**Affected Channels:** ${lockdownInfo.affectedChannels?.length || 0}`
            },
            {
              name: 'How to End Lockdown',
              value: 'Use `/lockdown disable` to end the lockdown and restore normal operations.'
            }
          );
        } else if (lastLockdown.endedAt) {
          // Show last lockdown info if available
          statusEmbed.addFields(
            {
              name: 'Last Lockdown',
              value: `**Reason:** ${lastLockdown.reason || 'Not specified'}\n` +
                     `**Ended:** <t:${Math.floor(lastLockdown.endedAt/1000)}:R>\n` +
                     `**Duration:** ${lastLockdown.duration ? 
                       `${Math.floor(lastLockdown.duration / 60000)} minutes` : 'Unknown'}`
            }
          );
        }
        
        // Add one-click lockdown button if not in lockdown
        let components = [];
        if (!isActive) {
          const lockdownRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`lockdown_quick_${serverId}`)
                .setLabel('🔒 EMERGENCY LOCKDOWN')
                .setStyle(ButtonStyle.Danger)
            );
          components.push(lockdownRow);
        }
        
        // Send status message
        let statusMessage;
        if (isSlashCommand) {
          statusMessage = await interaction.editReply({ 
            embeds: [statusEmbed], 
            components: components
          });
        } else {
          statusMessage = await message.reply({ 
            embeds: [statusEmbed], 
            components: components
          });
        }
        
        // If we have a quick lockdown button, set up collector
        if (!isActive) {
          const filter = i => i.user.id === userId && i.customId === `lockdown_quick_${serverId}`;
          
          const collector = statusMessage.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minute timeout for the quick action button
          });
          
          collector.on('collect', async i => {
            // Stop collector after button press
            collector.stop();
            
            // User clicked quick lockdown
            await i.update({ 
              content: '🔒 **INITIATING EMERGENCY LOCKDOWN...**\nPlease wait while all channels are being locked.',
              embeds: [], 
              components: []
            });
            
            // Execute lockdown with default reason
            const result = await securityManager.enableLockdownMode(
              client, 
              serverId, 
              userId, 
              "Emergency Quick Lockdown"
            );
            
            if (result.success) {
              // Lockdown successful
              const successEmbed = new EmbedBuilder()
                .setTitle('🔒 SERVER LOCKDOWN ACTIVE')
                .setDescription(`The server has been successfully locked down.`)
                .setColor(0xFF0000)
                .addFields(
                  {
                    name: 'Lockdown Details',
                    value: `**Channels Locked:** ${result.affectedChannels}\n` +
                          `**Failed Channels:** ${result.failedChannels}\n` +
                          `**Reason:** Emergency Quick Lockdown\n` +
                          `**Requested by:** <@${userId}>`
                  },
                  {
                    name: 'How to End Lockdown',
                    value: 'Only the server owner can end the lockdown using `/lockdown disable`'
                  }
                )
                .setTimestamp();
                
              // Send success message
              await i.editReply({ 
                content: null,
                embeds: [successEmbed],
                components: [] 
              });
            } else {
              // Lockdown failed
              const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Lockdown Failed')
                .setDescription(`Failed to initiate server lockdown: ${result.error}`)
                .setColor(0xFF9900)
                .setTimestamp();
                
              await i.editReply({ 
                content: null,
                embeds: [errorEmbed], 
                components: [] 
              });
            }
          });
          
          collector.on('end', async (collected, reason) => {
            // Only handle timeout if no button was pressed
            if (reason === 'time' && collected.size === 0) {
              const disabledRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`lockdown_quick_${serverId}_disabled`)
                    .setLabel('🔒 EMERGENCY LOCKDOWN')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
                );
                
              try {
                if (isSlashCommand) {
                  await interaction.editReply({ 
                    embeds: [statusEmbed], 
                    components: [disabledRow] 
                  });
                } else if (statusMessage.editable) {
                  await statusMessage.edit({ 
                    embeds: [statusEmbed], 
                    components: [disabledRow] 
                  });
                }
              } catch (err) {
                console.error("Failed to update expired lockdown button:", err);
              }
            }
          });
        }
        
        break;
      }
      
      default: {
        const errorResponse = '❌ Invalid lockdown action. Please use `enable`, `disable`, or `status`.';
        if (isSlashCommand) {
          await interaction.editReply(errorResponse);
        } else {
          await message.reply(errorResponse);
        }
      }
    }
  }
};