const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'antiraid',
  description: 'Configure anti-raid protection settings',
  usage: '/antiraid [action]',
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid protection settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable anti-raid protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable anti-raid protection')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('Configure anti-raid settings')
        .addIntegerOption(option =>
          option.setName('join_threshold')
            .setDescription('Number of joins to trigger a raid alert (default: 5)')
            .setRequired(false)
            .setMinValue(3)
            .setMaxValue(30))
        .addIntegerOption(option =>
          option.setName('time_window')
            .setDescription('Time window in seconds to count joins (default: 10)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(60))
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to take when raid is detected')
            .setRequired(false)
            .addChoices(
              { name: 'Alert Only', value: 'alert' },
              { name: 'Temporary Lockdown', value: 'lockdown' },
              { name: 'Quarantine New Joins', value: 'quarantine' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check anti-raid protection status')
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

    // Get member for permission checking
    const member = guild.members.cache.get(userId);
    
    // User must be server owner or have administrator permissions
    // With new security updates, only owner can edit security settings
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
        // Enable anti-raid
        config.updateServerConfig(serverId, {
          antiRaidEnabled: true,
          antiRaidDisabled: false
        });
        
        // Create success embed
        const enabledEmbed = new EmbedBuilder()
          .setTitle('✅ Anti-Raid Protection Enabled')
          .setDescription('Your server is now protected against raid attacks. Suspicious rapid joins will be detected and actioned automatically.')
          .setColor(0x00FF00)
          .addFields(
            {
              name: '⚙️ Current Settings',
              value: `**Join Threshold:** ${serverConfig.antiRaidSettings?.joinThreshold || 5} joins\n` +
                     `**Time Window:** ${(serverConfig.antiRaidSettings?.timeWindow || 10000) / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(serverConfig.antiRaidSettings?.action || 'lockdown')}`
            },
            {
              name: '📝 Next Steps',
              value: 'You can customize anti-raid settings with `/antiraid settings`'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Raid Protection' })
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
        // Disable anti-raid
        config.updateServerConfig(serverId, {
          antiRaidEnabled: false,
          antiRaidDisabled: true
        });
        
        // Create response embed
        const disabledEmbed = new EmbedBuilder()
          .setTitle('❌ Anti-Raid Protection Disabled')
          .setDescription('Anti-raid protection is now disabled. Your server will not automatically respond to raid attacks.')
          .setColor(0xFF0000)
          .addFields(
            {
              name: '⚠️ Security Warning',
              value: 'Disabling anti-raid protection leaves your server vulnerable to coordinated raid attacks. It is recommended to keep it enabled.'
            },
            {
              name: '🔄 Re-enable Protection',
              value: 'You can re-enable protection at any time with `/antiraid enable`'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Raid Protection' })
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
        let joinThreshold, timeWindow, action;
        
        if (isSlashCommand) {
          joinThreshold = interaction.options.getInteger('join_threshold');
          timeWindow = interaction.options.getInteger('time_window');
          action = interaction.options.getString('action');
        } else {
          // Parse manual settings from args (format: settings threshold window action)
          if (args.length >= 2) joinThreshold = parseInt(args[1]);
          if (args.length >= 3) timeWindow = parseInt(args[2]);
          if (args.length >= 4) action = args[3];
        }
        
        // Get existing settings
        const currentSettings = serverConfig.antiRaidSettings || {
          joinThreshold: 5,
          timeWindow: 10000,
          action: 'lockdown'
        };
        
        // Update with new settings if provided
        const newSettings = {
          joinThreshold: joinThreshold || currentSettings.joinThreshold,
          timeWindow: (timeWindow || timeWindow === 0) ? timeWindow * 1000 : currentSettings.timeWindow,
          action: action || currentSettings.action
        };
        
        // Save new settings
        config.updateServerConfig(serverId, {
          antiRaidSettings: newSettings,
          antiRaidEnabled: true,
          antiRaidDisabled: false
        });
        
        // Create response embed
        const settingsEmbed = new EmbedBuilder()
          .setTitle('⚙️ Anti-Raid Settings Updated')
          .setDescription('Your anti-raid protection settings have been configured.')
          .setColor(0x3498DB)
          .addFields(
            {
              name: '📊 Settings Configuration',
              value: `**Join Threshold:** ${newSettings.joinThreshold} joins\n` +
                     `**Time Window:** ${newSettings.timeWindow / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(newSettings.action)}`
            },
            {
              name: '📝 How It Works',
              value: `If ${newSettings.joinThreshold} or more users join within ${newSettings.timeWindow / 1000} seconds, ` +
                    `the bot will ${getActionExplanation(newSettings.action)}`
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Raid Protection' })
          .setTimestamp();
        
        // Add settings preview
        const exampleThreshold = newSettings.joinThreshold;
        const exampleWindow = newSettings.timeWindow / 1000;
        
        // Add protection status
        const isEnabled = !serverConfig.antiRaidDisabled;
        settingsEmbed.addFields({
          name: isEnabled ? '✅ Protection Active' : '❌ Protection Inactive',
          value: isEnabled ? 
            'Anti-raid protection is currently active with these settings.' : 
            'These settings are saved, but anti-raid protection is currently disabled. Use `/antiraid enable` to activate it.'
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
        // Get anti-raid status
        const isEnabled = !serverConfig.antiRaidDisabled;
        const settings = serverConfig.antiRaidSettings || {
          joinThreshold: 5,
          timeWindow: 10000,
          action: 'lockdown'
        };
        
        // Create status embed
        const statusEmbed = new EmbedBuilder()
          .setTitle(`${isEnabled ? '✅ Anti-Raid Protection Active' : '❌ Anti-Raid Protection Disabled'}`)
          .setDescription(isEnabled ? 
            'Your server is protected against raid attacks.' : 
            'Anti-raid protection is currently disabled. Your server may be vulnerable to raid attacks.')
          .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
          .addFields(
            {
              name: '⚙️ Current Configuration',
              value: `**Join Threshold:** ${settings.joinThreshold} joins\n` +
                     `**Time Window:** ${settings.timeWindow / 1000} seconds\n` +
                     `**Action:** ${getActionDescription(settings.action)}`
            },
            {
              name: '📝 How It Works',
              value: `If ${settings.joinThreshold} or more users join within ${settings.timeWindow / 1000} seconds, ` +
                    `the bot will ${getActionExplanation(settings.action)}`
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Raid Protection' })
          .setTimestamp();
          
        // Add quick action buttons
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`antiraid_${isEnabled ? 'disable' : 'enable'}_${serverId}`)
              .setLabel(isEnabled ? 'Disable Protection' : 'Enable Protection')
              .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
              .setEmoji(isEnabled ? '❌' : '✅'),
            new ButtonBuilder()
              .setCustomId(`antiraid_settings_${serverId}`)
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
                          (i.customId === `antiraid_enable_${serverId}` || 
                           i.customId === `antiraid_disable_${serverId}` || 
                           i.customId === `antiraid_settings_${serverId}`);
                           
        const collector = statusMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000 // 1 minute timeout
        });
        
        collector.on('collect', async i => {
          await i.deferUpdate();
          
          if (i.customId === `antiraid_enable_${serverId}`) {
            // Enable anti-raid
            config.updateServerConfig(serverId, {
              antiRaidEnabled: true,
              antiRaidDisabled: false
            });
            
            // Update embed
            statusEmbed.setTitle('✅ Anti-Raid Protection Active');
            statusEmbed.setDescription('Your server is now protected against raid attacks.');
            statusEmbed.setColor(0x00FF00);
            
            // Update button
            const newActionRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`antiraid_disable_${serverId}`)
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
          else if (i.customId === `antiraid_disable_${serverId}`) {
            // Disable anti-raid
            config.updateServerConfig(serverId, {
              antiRaidEnabled: false,
              antiRaidDisabled: true
            });
            
            // Update embed
            statusEmbed.setTitle('❌ Anti-Raid Protection Disabled');
            statusEmbed.setDescription('Anti-raid protection is currently disabled. Your server may be vulnerable to raid attacks.');
            statusEmbed.setColor(0xFF0000);
            
            // Update button
            const newActionRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`antiraid_enable_${serverId}`)
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
          else if (i.customId === `antiraid_settings_${serverId}`) {
            // Show settings configuration
            const settingsEmbed = new EmbedBuilder()
              .setTitle('⚙️ Anti-Raid Settings Configuration')
              .setDescription('Configure how the anti-raid system should respond to raid attempts. These settings help balance security with convenience.')
              .setColor(0x3498DB)
              .addFields(
                {
                  name: '📊 Current Settings',
                  value: `**Join Threshold:** ${settings.joinThreshold} joins\n` +
                         `**Time Window:** ${settings.timeWindow / 1000} seconds\n` +
                         `**Action:** ${getActionDescription(settings.action)}`
                },
                {
                  name: '📝 Available Actions',
                  value: '• **Alert Only** - Send notifications but take no action\n' +
                         '• **Temporary Lockdown** - Lock all channels temporarily\n' +
                         '• **Quarantine New Joins** - Restrict all new members'
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Lower thresholds are more sensitive but may cause false alarms. Higher thresholds are less likely to trigger on legitimate joins.'
                }
              )
              .setFooter({ text: 'Use /antiraid settings to configure' })
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
    case 'alert':
      return 'Alert Only';
    case 'lockdown':
      return 'Temporary Lockdown';
    case 'quarantine':
      return 'Quarantine New Joins';
    default:
      return 'Unknown';
  }
}

function getActionExplanation(action) {
  switch (action) {
    case 'alert':
      return 'send alerts to notification channels without taking any protective actions.';
    case 'lockdown':
      return 'temporarily lock all channels for 5 minutes while alerting server staff.';
    case 'quarantine':
      return 'automatically restrict all newly joined members to prevent potential damage.';
    default:
      return 'take appropriate protective actions.';
  }
}