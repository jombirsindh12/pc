const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'antispam',
  description: 'Configure anti-spam protection settings',
  usage: '/antispam [action]',
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure anti-spam protection settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable anti-spam protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable anti-spam protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('Configure anti-spam settings')
        .addIntegerOption(option =>
          option.setName('message_threshold')
            .setDescription('Number of messages to trigger spam detection (default: 5)')
            .setRequired(false)
            .setMinValue(3)
            .setMaxValue(20))
        .addIntegerOption(option =>
          option.setName('time_window')
            .setDescription('Time window in seconds to count messages (default: 3)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to take when spam is detected')
            .setRequired(false)
            .addChoices(
              { name: 'Warn', value: 'warn' },
              { name: 'Mute', value: 'mute' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check anti-spam protection status')
    ),
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get guild, user, etc.
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const user = isSlashCommand ? interaction.user : message.author;
    const serverId = guild.id;
    const userId = user.id;
    
    // Determine if user is server owner
    const isOwner = guild.ownerId === userId;
    
    // Get server config
    const serverConfig = config.getServerConfig(serverId);
    
    // Only server owner can use security commands now
    if (!isOwner) {
      const errorResponse = '🔒 **SECURITY ALERT**: Only the server owner can modify security settings!';
      if (isSlashCommand) {
        return interaction.reply({ content: errorResponse, ephemeral: true });
      } else {
        return message.reply(errorResponse);
      }
    }
    
    // Handle subcommands
    let subcommand;
    if (isSlashCommand) {
      await interaction.deferReply();
      subcommand = interaction.options.getSubcommand();
    } else {
      if (!args || args.length === 0) {
        return message.reply('❌ Please specify an action: `enable`, `disable`, `settings`, or `status`');
      }
      subcommand = args[0].toLowerCase();
      if (!['enable', 'disable', 'settings', 'status'].includes(subcommand)) {
        return message.reply('❌ Invalid action. Please use `enable`, `disable`, `settings`, or `status`');
      }
    }
    
    switch (subcommand) {
      case 'enable': {
        // Enable anti-spam
        config.updateServerConfig(serverId, {
          antiSpamEnabled: true,
          antiSpamDisabled: false
        });
        
        // Create success embed
        const enabledEmbed = new EmbedBuilder()
          .setTitle('✅ Anti-Spam Protection Enabled')
          .setDescription('Your server is now protected against spam attacks. Suspicious message patterns will be detected and actioned automatically.')
          .setColor(0x00FF00)
          .addFields(
            {
              name: '⚙️ Current Settings',
              value: `**Message Threshold:** ${serverConfig.antiSpamSettings?.messageThreshold || 5} messages\n` +
                     `**Time Window:** ${(serverConfig.antiSpamSettings?.timeWindow || 3000) / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(serverConfig.antiSpamSettings?.action || 'mute')}`
            },
            {
              name: '📝 Next Steps',
              value: 'You can customize anti-spam settings with `/antispam settings`'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Spam Protection' })
          .setTimestamp();
          
        // Send response
        if (isSlashCommand) {
          await interaction.editReply({ embeds: [enabledEmbed] });
        } else {
          await message.reply({ embeds: [enabledEmbed] });
        }
        break;
      }
      
      case 'disable': {
        // Disable anti-spam
        config.updateServerConfig(serverId, {
          antiSpamEnabled: false,
          antiSpamDisabled: true
        });
        
        // Create response embed
        const disabledEmbed = new EmbedBuilder()
          .setTitle('❌ Anti-Spam Protection Disabled')
          .setDescription('Anti-spam protection is now disabled. Your server will not automatically respond to spam attacks.')
          .setColor(0xFF0000)
          .addFields(
            {
              name: '⚠️ Security Warning',
              value: 'Disabling anti-spam protection leaves your server vulnerable to spam attacks and mention storms. It is recommended to keep it enabled.'
            },
            {
              name: '🔄 Re-enable Protection',
              value: 'You can re-enable protection at any time with `/antispam enable`'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Spam Protection' })
          .setTimestamp();
          
        // Send response
        if (isSlashCommand) {
          await interaction.editReply({ embeds: [disabledEmbed] });
        } else {
          await message.reply({ embeds: [disabledEmbed] });
        }
        break;
      }
      
      case 'settings': {
        // Get settings parameters
        let messageThreshold, timeWindow, action;
        
        if (isSlashCommand) {
          messageThreshold = interaction.options.getInteger('message_threshold');
          timeWindow = interaction.options.getInteger('time_window');
          action = interaction.options.getString('action');
        } else {
          // Parse manual settings from args (format: settings threshold window action)
          if (args.length >= 2) messageThreshold = parseInt(args[1]);
          if (args.length >= 3) timeWindow = parseInt(args[2]);
          if (args.length >= 4) action = args[3];
        }
        
        // Get existing settings
        const currentSettings = serverConfig.antiSpamSettings || {
          messageThreshold: 5,
          timeWindow: 3000,
          action: 'mute'
        };
        
        // Update with new settings if provided
        const newSettings = {
          messageThreshold: messageThreshold || currentSettings.messageThreshold,
          timeWindow: (timeWindow || timeWindow === 0) ? timeWindow * 1000 : currentSettings.timeWindow,
          action: action || currentSettings.action
        };
        
        // Save new settings
        config.updateServerConfig(serverId, {
          antiSpamSettings: newSettings,
          antiSpamEnabled: true,
          antiSpamDisabled: false
        });
        
        // Create response embed
        const settingsEmbed = new EmbedBuilder()
          .setTitle('⚙️ Anti-Spam Settings Updated')
          .setDescription('Your anti-spam protection settings have been configured.')
          .setColor(0x3498DB)
          .addFields(
            {
              name: '📊 Settings Configuration',
              value: `**Message Threshold:** ${newSettings.messageThreshold} messages\n` +
                     `**Time Window:** ${newSettings.timeWindow / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(newSettings.action)}`
            },
            {
              name: '📝 How It Works',
              value: `If a user sends ${newSettings.messageThreshold} or more messages within ${newSettings.timeWindow / 1000} seconds, ` +
                    `they will be ${getActionExplanation(newSettings.action)}`
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Spam Protection' })
          .setTimestamp();
        
        // Add protection status
        const isEnabled = !serverConfig.antiSpamDisabled;
        settingsEmbed.addFields({
          name: isEnabled ? '✅ Protection Active' : '❌ Protection Inactive',
          value: isEnabled ? 
            'Anti-spam protection is currently active with these settings.' : 
            'These settings are saved, but anti-spam protection is currently disabled. Use `/antispam enable` to activate it.'
        });
        
        // Send response
        if (isSlashCommand) {
          await interaction.editReply({ embeds: [settingsEmbed] });
        } else {
          await message.reply({ embeds: [settingsEmbed] });
        }
        break;
      }
      
      case 'status': {
        // Get anti-spam status
        const isEnabled = !serverConfig.antiSpamDisabled;
        const settings = serverConfig.antiSpamSettings || {
          messageThreshold: 5,
          timeWindow: 3000,
          action: 'mute'
        };
        
        // Create status embed
        const statusEmbed = new EmbedBuilder()
          .setTitle(`${isEnabled ? '✅ Anti-Spam Protection Active' : '❌ Anti-Spam Protection Disabled'}`)
          .setDescription(isEnabled ? 
            'Your server is protected against spam attacks.' : 
            'Anti-spam protection is currently disabled. Your server may be vulnerable to spam attacks.')
          .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
          .addFields(
            {
              name: '⚙️ Current Configuration',
              value: `**Message Threshold:** ${settings.messageThreshold} messages\n` +
                     `**Time Window:** ${settings.timeWindow / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(settings.action)}`
            },
            {
              name: '📝 How It Works',
              value: `If a user sends ${settings.messageThreshold} or more messages within ${settings.timeWindow / 1000} seconds, ` +
                    `they will be ${getActionExplanation(settings.action)}`
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Spam Protection' })
          .setTimestamp();
          
        // Add quick action buttons
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`antispam_${isEnabled ? 'disable' : 'enable'}_${serverId}`)
              .setLabel(isEnabled ? 'Disable Protection' : 'Enable Protection')
              .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
              .setEmoji(isEnabled ? '❌' : '✅'),
            new ButtonBuilder()
              .setCustomId(`antispam_settings_${serverId}`)
              .setLabel('Configure Settings')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⚙️')
          );
          
        // Send status message
        let statusMessage;
        if (isSlashCommand) {
          statusMessage = await interaction.editReply({ 
            embeds: [statusEmbed], 
            components: [actionRow] 
          });
        } else {
          statusMessage = await message.reply({ 
            embeds: [statusEmbed], 
            components: [actionRow] 
          });
        }
        
        // Set up collector for the buttons
        const filter = i => i.user.id === userId && 
                          (i.customId === `antispam_enable_${serverId}` || 
                           i.customId === `antispam_disable_${serverId}` || 
                           i.customId === `antispam_settings_${serverId}`);
                           
        const collector = statusMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000 // 1 minute timeout
        });
        
        collector.on('collect', async i => {
          await i.deferUpdate();
          
          if (i.customId === `antispam_enable_${serverId}`) {
            // Enable anti-spam
            config.updateServerConfig(serverId, {
              antiSpamEnabled: true,
              antiSpamDisabled: false
            });
            
            // Update embed
            statusEmbed.setTitle('✅ Anti-Spam Protection Active');
            statusEmbed.setDescription('Your server is now protected against spam attacks.');
            statusEmbed.setColor(0x00FF00);
            
            // Update button
            const newActionRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`antispam_disable_${serverId}`)
                  .setLabel('Disable Protection')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('❌'),
                actionRow.components[1]
              );
              
            await i.editReply({ 
              embeds: [statusEmbed], 
              components: [newActionRow] 
            });
          }
          else if (i.customId === `antispam_disable_${serverId}`) {
            // Disable anti-spam
            config.updateServerConfig(serverId, {
              antiSpamEnabled: false,
              antiSpamDisabled: true
            });
            
            // Update embed
            statusEmbed.setTitle('❌ Anti-Spam Protection Disabled');
            statusEmbed.setDescription('Anti-spam protection is currently disabled. Your server may be vulnerable to spam attacks.');
            statusEmbed.setColor(0xFF0000);
            
            // Update button
            const newActionRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`antispam_enable_${serverId}`)
                  .setLabel('Enable Protection')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('✅'),
                actionRow.components[1]
              );
              
            await i.editReply({ 
              embeds: [statusEmbed], 
              components: [newActionRow] 
            });
          }
          else if (i.customId === `antispam_settings_${serverId}`) {
            // Show settings configuration
            const settingsEmbed = new EmbedBuilder()
              .setTitle('⚙️ Anti-Spam Settings Configuration')
              .setDescription('Configure how the anti-spam system should respond to spam attempts.')
              .setColor(0x3498DB)
              .addFields(
                {
                  name: '📊 Current Settings',
                  value: `**Message Threshold:** ${settings.messageThreshold} messages\n` +
                         `**Time Window:** ${settings.timeWindow / 1000} seconds\n` +
                         `**Action:** ${getActionDescription(settings.action)}`
                },
                {
                  name: '📝 Available Actions',
                  value: '• **Warn** - Send a warning to the user\n' +
                         '• **Mute** - Temporarily mute the user for 5 minutes\n' +
                         '• **Kick** - Remove the user from the server\n' +
                         '• **Ban** - Permanently ban the user from the server'
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Lower thresholds are more sensitive but may cause false positives. Higher thresholds may miss some spam attacks.'
                }
              )
              .setFooter({ text: 'Use /antispam settings to configure' })
              .setTimestamp();
              
            await i.followUp({ 
              embeds: [settingsEmbed],
              ephemeral: true
            });
          }
        });
        
        collector.on('end', async (collected, reason) => {
          if (reason === 'time') {
            // Disable buttons after timeout
            const disabledRow = new ActionRowBuilder()
              .addComponents(
                ActionRowBuilder.from(actionRow).components.map(button => 
                  ButtonBuilder.from(button).setDisabled(true)
                )
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
              console.error("Failed to update expired buttons:", err);
            }
          }
        });
        
        break;
      }
      
      default: {
        const errorResponse = '❌ Invalid action. Please use `enable`, `disable`, `settings`, or `status`.';
        if (isSlashCommand) {
          await interaction.editReply(errorResponse);
        } else {
          await message.reply(errorResponse);
        }
      }
    }
  }
};

// Helper functions
function getActionDescription(action) {
  switch (action) {
    case 'warn':
      return 'Warn User';
    case 'mute':
      return 'Temporarily Mute';
    case 'kick':
      return 'Kick from Server';
    case 'ban':
      return 'Ban from Server';
    default:
      return 'Unknown';
  }
}

function getActionExplanation(action) {
  switch (action) {
    case 'warn':
      return 'warned about their behavior.';
    case 'mute':
      return 'temporarily muted for 5 minutes.';
    case 'kick':
      return 'kicked from the server.';
    case 'ban':
      return 'banned from the server.';
    default:
      return 'handled according to server policy.';
  }
}