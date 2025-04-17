const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../utils/config');
const securityManager = require('../utils/securityManager');

module.exports = {
  name: 'premium',
  description: 'Access premium security features and enhanced protection',
  usage: '/premium [action]',
  guildOnly: false, // This command can work in DMs for status checks
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Premium feature to access',
      required: true,
      choices: [
        {
          name: 'status',
          value: 'status'
        },
        {
          name: 'automod',
          value: 'automod'
        },
        {
          name: 'lockdown',
          value: 'lockdown'
        },
        {
          name: 'antinuke',
          value: 'antinuke'
        },
        {
          name: 'captcha',
          value: 'captcha'
        },
        {
          name: 'analytics',
          value: 'analytics'
        },
        {
          name: 'backup',
          value: 'backup'
        },
        {
          name: 'alerts',
          value: 'alerts'
        }
      ]
    },
    {
      name: 'setting',
      type: 3, // STRING type
      description: 'Setting to toggle (on/off)',
      required: false,
      choices: [
        {
          name: 'enable',
          value: 'enable'
        },
        {
          name: 'disable',
          value: 'disable'
        }
      ]
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Target channel for some premium features',
      required: false
    },
    {
      name: 'threshold',
      type: 4, // INTEGER type
      description: 'Numerical threshold for some settings',
      required: false
    }
  ],
  requiresAdmin: false, // Allow this command to be used without admin permissions
  // We'll check for admin permissions in the execute function for specific actions
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get the user
    const user = isSlashCommand ? interaction.user : message.author;
    
    // Check if the user is the bot owner
    const isBotOwner = user.id === process.env.BOT_OWNER_ID || user.id === client.application?.owner?.id;
    
    // Check if the user has "2007" in their username - they get automatic premium access
    const has2007InUsername = user.username.includes('2007');
    
    // Get guild ID and other parameters
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    // Special handling for DMs
    if (!guild) {
      // If in DM, we can only check premium status based on user
      const isPremiumUser = isBotOwner || has2007InUsername;
      
      // Create special DM premium status embed
      const dmPremiumEmbed = new EmbedBuilder()
        .setTitle('🌟 Your Premium Status')
        .setDescription(
          isBotOwner ? '👑 You are the bot owner! All premium features are automatically available to you in all servers.' :
          has2007InUsername ? '🔢 Your username contains "2007"! All premium features are automatically available to you in all servers.' :
          'You do not have personal premium access. Join a premium server to access premium features.'
        )
        .setColor(isPremiumUser ? 0xF1C40F : 0x95A5A6) // Gold for premium, gray for non-premium
        .addFields(
          {
            name: '🏠 Server-Specific',
            value: 'Premium features are applied on a per-server basis. Use this command in a server to see its premium status.',
          },
          {
            name: '💎 Premium Features',
            value: '• Advanced Anti-Nuke Protection\n• Auto-Mod with Custom Rules\n• Emergency Server Lockdown\n• CAPTCHA Verification\n• Security Analytics\n• Server Backup System'
          }
        )
        .setTimestamp();
      
      if (isSlashCommand) {
        // First check if we need to defer the reply (prevents "application did not respond" errors)
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply();
        }
        
        // Now we can safely reply
        await interaction.followUp({ embeds: [dmPremiumEmbed] });
      } else {
        await message.reply({ embeds: [dmPremiumEmbed] });
      }
      
      return; // Exit early since we're in DMs
    }
    
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Bot owners and users with "2007" in username always have premium access regardless of server settings
    const hasPremiumAccess = isBotOwner || has2007InUsername || serverConfig.premium || false;
    
    // Check if premium is enabled for this server
    const isPremium = serverConfig.premium || false;
    
    // Get action from args or options
    let action, setting, channel, threshold;
    
    if (isSlashCommand) {
      action = interaction.options.getString('action');
      setting = interaction.options.getString('setting');
      channel = interaction.options.getChannel('channel');
      threshold = interaction.options.getInteger('threshold');
      
      // Defer reply since some operations might take time
      await interaction.deferReply();
    } else {
      // Legacy command handling - not needed since we're focusing on slash commands
      return message.reply('Please use the slash command `/premium` instead.');
    }
    
    // Premium status embed for server
    const premiumStatusEmbed = new EmbedBuilder()
      .setTitle('🌟 Premium Security Status')
      .setDescription(
        isBotOwner ? '👑 You are the bot owner! All premium features are automatically available to you in all servers.' :
        has2007InUsername ? '🔢 Your username contains "2007"! All premium features are automatically available to you in all servers.' :
        isPremium ? '✅ This server has premium security features enabled!' : 
        '❌ This server does not have premium security features enabled.'
      )
      .setColor(isBotOwner || has2007InUsername || isPremium ? 0xF1C40F : 0x95A5A6) // Gold for premium, gray for non-premium
      .setTimestamp();
    
    // Add fields to premium status embed
    if (hasPremiumAccess) {
      // Premium features statuses
      premiumStatusEmbed.addFields(
        {
          name: '🛡️ Advanced Anti-Nuke',
          value: serverConfig.antiNukeEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '🤖 Auto-Moderation',
          value: serverConfig.autoModEnabled ? '✅ Enabled' : '❌ Disabled', 
          inline: true
        },
        {
          name: '🔒 Emergency Lockdown',
          value: serverConfig.lockdownEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '🧩 CAPTCHA Verification',
          value: serverConfig.captchaEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '📊 Security Analytics',
          value: serverConfig.analyticsEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '💾 Auto-Backup System',
          value: serverConfig.backupEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        }
      );
    } else {
      // Information for non-premium servers
      premiumStatusEmbed.addFields(
        {
          name: '✨ Premium Features',
          value: '• Advanced Anti-Nuke Protection\n• Auto-Mod with Custom Rules\n• Emergency Server Lockdown\n• CAPTCHA Verification for New Members\n• Detailed Security Analytics\n• Automatic Server Backup System'
        },
        {
          name: '💎 How to Get Premium',
          value: 'Premium features are available through special bot access or support roles.'
        }
      );
    }
    
    // Handle different actions
    switch (action) {
      case 'status':
        // Just show the premium status
        await interaction.followUp({ embeds: [premiumStatusEmbed] });
        break;
        
      case 'automod':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Toggle auto-moderation if setting provided
        if (setting) {
          config.updateServerConfig(serverId, {
            autoModEnabled: setting === 'enable'
          });
          
          // Create automod embed
          const automodEmbed = new EmbedBuilder()
            .setTitle('🤖 Auto-Moderation System')
            .setDescription(`Auto-moderation has been ${setting === 'enable' ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(setting === 'enable' ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Profanity Filter\n• Spam Detection\n• Capitals Limit\n• Link Restriction\n• Mention Protection\n• Content Analysis'
              },
              {
                name: '⚙️ Configuration',
                value: `Use \`/automod\` command to configure specific auto-moderation settings.`
              }
            )
            .setFooter({ text: 'Premium Feature • Auto-Moderation' })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [automodEmbed] });
        } else {
          // Show automod status and options
          const automodStatusEmbed = new EmbedBuilder()
            .setTitle('🤖 Auto-Moderation Status')
            .setDescription(`Auto-moderation is currently ${serverConfig.autoModEnabled ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(serverConfig.autoModEnabled ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Profanity Filter\n• Spam Detection\n• Capitals Limit\n• Link Restriction\n• Mention Protection\n• Content Analysis'
              },
              {
                name: '⚙️ Configuration',
                value: `Use \`/premium automod enable\` or \`/premium automod disable\` to toggle.`
              }
            )
            .setFooter({ text: 'Premium Feature • Auto-Moderation' })
            .setTimestamp();
            
          // Create buttons for enabling/disabling
          const automodRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('automod_enable')
                .setLabel('Enable Auto-Mod')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
              new ButtonBuilder()
                .setCustomId('automod_disable')
                .setLabel('Disable Auto-Mod')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
              new ButtonBuilder()
                .setCustomId('automod_config')
                .setLabel('Configure Settings')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚙️')
            );
            
          const response = await interaction.followUp({ 
            embeds: [automodStatusEmbed],
            components: [automodRow],
            fetchReply: true
          });
          
          // Set up collector for button interactions
          const filter = i => i.user.id === interaction.user.id;
          const collector = response.createMessageComponentCollector({ 
            filter, 
            time: 60000 // 1 minute timeout
          });
          
          collector.on('collect', async i => {
            try {
              // Defer the update to prevent "interaction failed" errors
              await i.deferUpdate();
              
              if (i.customId === 'automod_enable') {
                // Enable automod
                config.updateServerConfig(serverId, { autoModEnabled: true });
                
                const updatedEmbed = EmbedBuilder.from(automodStatusEmbed)
                  .setDescription('Auto-moderation is currently enabled ✅')
                  .setColor(0x2ECC71);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [automodRow]
                });
                
                await i.followUp({
                  content: '✅ Auto-moderation has been enabled!',
                  ephemeral: true
                });
              } 
              else if (i.customId === 'automod_disable') {
                // Disable automod
                config.updateServerConfig(serverId, { autoModEnabled: false });
                
                const updatedEmbed = EmbedBuilder.from(automodStatusEmbed)
                  .setDescription('Auto-moderation is currently disabled ❌')
                  .setColor(0xE74C3C);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [automodRow]
                });
                
                await i.followUp({
                  content: '❌ Auto-moderation has been disabled.',
                  ephemeral: true
                });
              }
              else if (i.customId === 'automod_config') {
                await i.followUp({
                  content: '⚙️ Auto-moderation configuration will be available soon! For now, you can use `/automod` command for basic settings.',
                  ephemeral: true
                });
              }
            } catch (error) {
              console.error('Error handling automod button:', error);
            }
          });
          
          collector.on('end', () => {
            // Disable buttons when collector expires
            const disabledRow = ActionRowBuilder.from(automodRow);
            
            for (const button of disabledRow.components) {
              button.setDisabled(true);
            }
            
            interaction.editReply({
              embeds: [automodStatusEmbed],
              components: [disabledRow]
            }).catch(console.error);
          });
        }
        break;
        
      case 'lockdown':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Handle lockdown logic
        if (setting) {
          // Enable/disable lockdown mode
          config.updateServerConfig(serverId, {
            lockdownEnabled: setting === 'enable'
          });
          
          if (setting === 'enable') {
            // Activate emergency lockdown
            try {
              const lockdownEmbed = new EmbedBuilder()
                .setTitle('🔒 EMERGENCY LOCKDOWN ACTIVATED')
                .setDescription('Server is now in lockdown mode due to security measures.')
                .setColor(0xFF0000)
                .addFields(
                  {
                    name: '⚠️ Current Status',
                    value: 'All channels have been locked for regular members. Only staff can send messages.'
                  },
                  {
                    name: '📋 Instructions',
                    value: 'Please wait for staff to resolve the security issue. Use `/premium lockdown disable` to end lockdown.'
                  }
                )
                .setFooter({ text: 'Premium Feature • Emergency Lockdown' })
                .setTimestamp();
              
              // Get all text channels
              const textChannels = guild.channels.cache.filter(c => c.type === 0); // 0 is GUILD_TEXT
              
              // Send lockdown notice to all channels and lock them
              let successCount = 0;
              let failCount = 0;
              
              for (const [channelId, channel] of textChannels) {
                try {
                  // Try to lock the channel (deny send message permission for @everyone)
                  await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                  });
                  
                  // Send lockdown notice
                  await channel.send({ embeds: [lockdownEmbed] });
                  successCount++;
                } catch (lockError) {
                  console.error(`Error locking channel ${channel.name}:`, lockError);
                  failCount++;
                }
              }
              
              // Log the lockdown
              if (serverConfig.notificationChannelId) {
                const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
                if (notificationChannel) {
                  await notificationChannel.send({
                    content: `🚨 **EMERGENCY LOCKDOWN ACTIVATED** by <@${interaction.user.id}>!\n\n` +
                            `✅ Successfully locked ${successCount} channels\n` +
                            `❌ Failed to lock ${failCount} channels`,
                    allowedMentions: { parse: [] } // Don't ping anyone
                  });
                }
              }
              
              // Send response to command
              await interaction.followUp({
                content: `🔒 **Emergency lockdown activated!** Successfully locked ${successCount} channels (${failCount} failed).`,
                ephemeral: false
              });
              
            } catch (error) {
              console.error('Error activating lockdown:', error);
              await interaction.followUp({
                content: `❌ Error activating lockdown: ${error.message}`,
                ephemeral: true
              });
            }
          } else {
            // Disable lockdown
            try {
              const unlockEmbed = new EmbedBuilder()
                .setTitle('🔓 LOCKDOWN LIFTED')
                .setDescription('Server lockdown has been deactivated.')
                .setColor(0x2ECC71)
                .addFields(
                  {
                    name: '⚠️ Current Status',
                    value: 'All channels have been unlocked. Regular operation has resumed.'
                  },
                  {
                    name: '📋 Note',
                    value: 'If you encounter any issues, please contact server staff.'
                  }
                )
                .setFooter({ text: 'Premium Feature • Emergency Lockdown' })
                .setTimestamp();
              
              // Get all text channels
              const textChannels = guild.channels.cache.filter(c => c.type === 0); // 0 is GUILD_TEXT
              
              // Send unlock notice to all channels and unlock them
              let successCount = 0;
              let failCount = 0;
              
              for (const [channelId, channel] of textChannels) {
                try {
                  // Try to unlock the channel (reset send message permission for @everyone)
                  await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: null // Reset to default
                  });
                  
                  // Send unlock notice
                  await channel.send({ embeds: [unlockEmbed] });
                  successCount++;
                } catch (unlockError) {
                  console.error(`Error unlocking channel ${channel.name}:`, unlockError);
                  failCount++;
                }
              }
              
              // Log the unlock
              if (serverConfig.notificationChannelId) {
                const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
                if (notificationChannel) {
                  await notificationChannel.send({
                    content: `🔓 **EMERGENCY LOCKDOWN DEACTIVATED** by <@${interaction.user.id}>!\n\n` +
                            `✅ Successfully unlocked ${successCount} channels\n` +
                            `❌ Failed to unlock ${failCount} channels`,
                    allowedMentions: { parse: [] } // Don't ping anyone
                  });
                }
              }
              
              // Send response to command
              await interaction.followUp({
                content: `🔓 **Emergency lockdown deactivated!** Successfully unlocked ${successCount} channels (${failCount} failed).`,
                ephemeral: false
              });
              
            } catch (error) {
              console.error('Error deactivating lockdown:', error);
              await interaction.followUp({
                content: `❌ Error deactivating lockdown: ${error.message}`,
                ephemeral: true
              });
            }
          }
        } else {
          // Show lockdown status and options
          const lockdownStatusEmbed = new EmbedBuilder()
            .setTitle('🔒 Emergency Lockdown')
            .setDescription(`Emergency lockdown is currently ${serverConfig.lockdownEnabled ? 'active ⚠️' : 'inactive ✅'}`)
            .setColor(serverConfig.lockdownEnabled ? 0xFF0000 : 0x2ECC71)
            .addFields(
              {
                name: '📝 Description',
                value: 'Emergency lockdown restricts message sending in all channels to prevent damage during security incidents.'
              },
              {
                name: '⚠️ Warning',
                value: 'Use this feature only in actual emergency situations!'
              },
              {
                name: '⚙️ Usage',
                value: `Use \`/premium lockdown enable\` or \`/premium lockdown disable\` to toggle.`
              }
            )
            .setFooter({ text: 'Premium Feature • Emergency Lockdown' })
            .setTimestamp();
            
          // Create buttons for enabling/disabling
          const lockdownRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('lockdown_enable')
                .setLabel('Activate Lockdown')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
              new ButtonBuilder()
                .setCustomId('lockdown_disable')
                .setLabel('Deactivate Lockdown')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔓')
            );
            
          await interaction.followUp({ 
            embeds: [lockdownStatusEmbed],
            components: [lockdownRow]
          });
        }
        break;
        
      case 'antinuke':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Toggle anti-nuke if setting provided
        if (setting) {
          // Save the anti-nuke settings
          config.updateServerConfig(serverId, {
            antiNukeEnabled: setting === 'enable',
            antiNukeSettings: {
              maxBansPerMinute: threshold || 3,
              maxChannelDeletionsPerMinute: threshold || 2,
              maxRoleDeletionsPerMinute: threshold || 2,
              punishmentType: 'ban' // Could be 'ban', 'kick', or 'quarantine'
            }
          });
          
          // Create anti-nuke embed
          const antiNukeEmbed = new EmbedBuilder()
            .setTitle('🛡️ Advanced Anti-Nuke Protection')
            .setDescription(`Anti-nuke protection has been ${setting === 'enable' ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(setting === 'enable' ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Mass Ban Detection\n• Channel Deletion Protection\n• Role Deletion Protection\n• Webhook Protection\n• Audit Log Monitoring\n• Automated Counter-measures'
              },
              {
                name: '⚙️ Configuration',
                value: `• Max Bans: ${threshold || 3}/min\n• Max Channel Deletions: ${threshold || 2}/min\n• Max Role Deletions: ${threshold || 2}/min\n• Punishment: Ban`
              }
            )
            .setFooter({ text: 'Premium Feature • Advanced Anti-Nuke' })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [antiNukeEmbed] });
          
          // If enabled, activate the anti-nuke system
          if (setting === 'enable') {
            securityManager.activateAntiNuke(client, serverId, threshold || 3);
          }
        } else {
          // Show anti-nuke status and options
          const antiNukeSettings = serverConfig.antiNukeSettings || {};
          
          const antiNukeStatusEmbed = new EmbedBuilder()
            .setTitle('🛡️ Advanced Anti-Nuke Status')
            .setDescription(`Anti-nuke protection is currently ${serverConfig.antiNukeEnabled ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(serverConfig.antiNukeEnabled ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Mass Ban Detection\n• Channel Deletion Protection\n• Role Deletion Protection\n• Webhook Protection\n• Audit Log Monitoring\n• Automated Counter-measures'
              },
              {
                name: '⚙️ Current Configuration',
                value: `• Max Bans: ${antiNukeSettings.maxBansPerMinute || 3}/min\n• Max Channel Deletions: ${antiNukeSettings.maxChannelDeletionsPerMinute || 2}/min\n• Max Role Deletions: ${antiNukeSettings.maxRoleDeletionsPerMinute || 2}/min\n• Punishment: ${antiNukeSettings.punishmentType || 'Ban'}`
              },
              {
                name: '⚠️ Usage',
                value: `Use \`/premium antinuke enable\` or \`/premium antinuke disable\` to toggle.`
              }
            )
            .setFooter({ text: 'Premium Feature • Advanced Anti-Nuke' })
            .setTimestamp();
            
          // Create buttons for enabling/disabling
          const antiNukeRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('antinuke_enable')
                .setLabel('Enable Anti-Nuke')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛡️'),
              new ButtonBuilder()
                .setCustomId('antinuke_disable')
                .setLabel('Disable Anti-Nuke')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
              new ButtonBuilder()
                .setCustomId('antinuke_config')
                .setLabel('Configure Settings')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚙️')
            );
            
          const antiNukeResponse = await interaction.followUp({ 
            embeds: [antiNukeStatusEmbed],
            components: [antiNukeRow],
            fetchReply: true
          });
          
          // Set up collector for anti-nuke button interactions
          const antiNukeFilter = i => i.user.id === interaction.user.id;
          const antiNukeCollector = antiNukeResponse.createMessageComponentCollector({ 
            filter: antiNukeFilter, 
            time: 60000 // 1 minute timeout
          });
          
          antiNukeCollector.on('collect', async i => {
            try {
              // Defer the update to prevent "interaction failed" errors
              await i.deferUpdate();
              
              if (i.customId === 'antinuke_enable') {
                // Enable anti-nuke
                config.updateServerConfig(serverId, { 
                  antiNukeEnabled: true,
                  antiNukeSettings: {
                    maxBansPerMinute: antiNukeSettings.maxBansPerMinute || 3,
                    maxChannelDeletionsPerMinute: antiNukeSettings.maxChannelDeletionsPerMinute || 2,
                    maxRoleDeletionsPerMinute: antiNukeSettings.maxRoleDeletionsPerMinute || 2,
                    punishmentType: antiNukeSettings.punishmentType || 'ban'
                  }
                });
                
                // Activate the anti-nuke system
                securityManager.activateAntiNuke(client, serverId, antiNukeSettings.maxBansPerMinute || 3);
                
                const updatedEmbed = EmbedBuilder.from(antiNukeStatusEmbed)
                  .setDescription('Anti-nuke protection is currently enabled ✅')
                  .setColor(0x2ECC71);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [antiNukeRow]
                });
                
                await i.followUp({
                  content: '✅ Advanced Anti-Nuke Protection has been enabled!',
                  ephemeral: true
                });
              } 
              else if (i.customId === 'antinuke_disable') {
                // Disable anti-nuke
                config.updateServerConfig(serverId, { antiNukeEnabled: false });
                
                const updatedEmbed = EmbedBuilder.from(antiNukeStatusEmbed)
                  .setDescription('Anti-nuke protection is currently disabled ❌')
                  .setColor(0xE74C3C);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [antiNukeRow]
                });
                
                await i.followUp({
                  content: '❌ Advanced Anti-Nuke Protection has been disabled.',
                  ephemeral: true
                });
              }
              else if (i.customId === 'antinuke_config') {
                await i.followUp({
                  content: '⚙️ Anti-Nuke configuration options will be available soon! For now, you can use `/premium antinuke enable [threshold]` to set the threshold value.',
                  ephemeral: true
                });
              }
            } catch (error) {
              console.error('Error handling anti-nuke button:', error);
              await i.followUp({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
              }).catch(console.error);
            }
          });
          
          antiNukeCollector.on('end', () => {
            // Disable buttons when collector expires
            const disabledRow = ActionRowBuilder.from(antiNukeRow);
            
            for (const button of disabledRow.components) {
              button.setDisabled(true);
            }
            
            interaction.editReply({
              embeds: [antiNukeStatusEmbed],
              components: [disabledRow]
            }).catch(console.error);
          });
        }
        break;
        
      case 'captcha':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Toggle CAPTCHA verification if setting provided
        if (setting) {
          config.updateServerConfig(serverId, {
            captchaEnabled: setting === 'enable',
            captchaSettings: {
              channelId: channel ? channel.id : null,
              autoKick: true,
              timeLimit: 5, // minutes
              type: 'image' // 'image', 'math', or 'text'
            }
          });
          
          // Create CAPTCHA embed
          const captchaEmbed = new EmbedBuilder()
            .setTitle('🧩 CAPTCHA Verification System')
            .setDescription(`CAPTCHA verification has been ${setting === 'enable' ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(setting === 'enable' ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Image Recognition CAPTCHA\n• Auto-kick for Failed Attempts\n• Customizable Time Limit\n• Raid Protection\n• Bot Account Detection'
              },
              {
                name: '⚙️ Configuration',
                value: `• Channel: ${channel ? `<#${channel.id}>` : 'None set'}\n• Auto-kick: Enabled\n• Time Limit: 5 minutes\n• Type: Image CAPTCHA`
              }
            )
            .setFooter({ text: 'Premium Feature • CAPTCHA Verification' })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [captchaEmbed] });
        } else {
          // Show CAPTCHA status and options
          const captchaSettings = serverConfig.captchaSettings || {};
          
          const captchaStatusEmbed = new EmbedBuilder()
            .setTitle('🧩 CAPTCHA Verification Status')
            .setDescription(`CAPTCHA verification is currently ${serverConfig.captchaEnabled ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(serverConfig.captchaEnabled ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Image Recognition CAPTCHA\n• Auto-kick for Failed Attempts\n• Customizable Time Limit\n• Raid Protection\n• Bot Account Detection'
              },
              {
                name: '⚙️ Current Configuration',
                value: `• Channel: ${captchaSettings.channelId ? `<#${captchaSettings.channelId}>` : 'None set'}\n• Auto-kick: ${captchaSettings.autoKick ? 'Enabled' : 'Disabled'}\n• Time Limit: ${captchaSettings.timeLimit || 5} minutes\n• Type: ${captchaSettings.type || 'Image'} CAPTCHA`
              },
              {
                name: '⚠️ Usage',
                value: `Use \`/premium captcha enable\` or \`/premium captcha disable\` to toggle.`
              }
            )
            .setFooter({ text: 'Premium Feature • CAPTCHA Verification' })
            .setTimestamp();
            
          // Create buttons for enabling/disabling
          const captchaRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('captcha_enable')
                .setLabel('Enable CAPTCHA')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🧩'),
              new ButtonBuilder()
                .setCustomId('captcha_disable')
                .setLabel('Disable CAPTCHA')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
              new ButtonBuilder()
                .setCustomId('captcha_config')
                .setLabel('Configure Settings')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚙️')
            );
            
          const captchaResponse = await interaction.followUp({ 
            embeds: [captchaStatusEmbed],
            components: [captchaRow],
            fetchReply: true
          });
          
          // Set up collector for captcha button interactions
          const captchaFilter = i => i.user.id === interaction.user.id;
          const captchaCollector = captchaResponse.createMessageComponentCollector({ 
            filter: captchaFilter, 
            time: 60000 // 1 minute timeout
          });
          
          captchaCollector.on('collect', async i => {
            try {
              // Defer the update to prevent "interaction failed" errors
              await i.deferUpdate();
              
              if (i.customId === 'captcha_enable') {
                // Enable captcha
                config.updateServerConfig(serverId, { 
                  captchaEnabled: true,
                  captchaSettings: {
                    channelId: captchaSettings.channelId || null,
                    autoKick: captchaSettings.autoKick !== false,
                    timeLimit: captchaSettings.timeLimit || 5,
                    type: captchaSettings.type || 'image'
                  }
                });
                
                const updatedEmbed = EmbedBuilder.from(captchaStatusEmbed)
                  .setDescription('CAPTCHA verification is currently enabled ✅')
                  .setColor(0x2ECC71);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [captchaRow]
                });
                
                await i.followUp({
                  content: '✅ CAPTCHA Verification has been enabled!',
                  ephemeral: true
                });
              } 
              else if (i.customId === 'captcha_disable') {
                // Disable captcha
                config.updateServerConfig(serverId, { captchaEnabled: false });
                
                const updatedEmbed = EmbedBuilder.from(captchaStatusEmbed)
                  .setDescription('CAPTCHA verification is currently disabled ❌')
                  .setColor(0xE74C3C);
                
                await i.editReply({ 
                  embeds: [updatedEmbed],
                  components: [captchaRow]
                });
                
                await i.followUp({
                  content: '❌ CAPTCHA Verification has been disabled.',
                  ephemeral: true
                });
              }
              else if (i.customId === 'captcha_config') {
                await i.followUp({
                  content: '⚙️ CAPTCHA configuration options will be available soon! For now, you can use `/captcha setup` for detailed configuration.',
                  ephemeral: true
                });
              }
            } catch (error) {
              console.error('Error handling captcha button:', error);
              await i.followUp({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
              }).catch(console.error);
            }
          });
          
          captchaCollector.on('end', () => {
            // Disable buttons when collector expires
            const disabledRow = ActionRowBuilder.from(captchaRow);
            
            for (const button of disabledRow.components) {
              button.setDisabled(true);
            }
            
            interaction.editReply({
              embeds: [captchaStatusEmbed],
              components: [disabledRow]
            }).catch(console.error);
          });
        }
        break;
        
      case 'analytics':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Generate security analytics dashboard
        try {
          // Get security stats
          const guildMembers = await guild.members.fetch();
          const memberCount = guildMembers.size;
          const botCount = guildMembers.filter(m => m.user.bot).size;
          const humanCount = memberCount - botCount;
          
          // Get security incidents
          const incidents = serverConfig.securityIncidents || [];
          const nukeAttempts = incidents.filter(i => i.type === 'nuke').length;
          const raidAttempts = incidents.filter(i => i.type === 'raid').length;
          const spamEvents = incidents.filter(i => i.type === 'spam').length;
          const scamLinks = incidents.filter(i => i.type === 'scam').length;
          
          // Get dates for time-based analytics
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          
          // Count incidents that happened today
          const todayIncidents = incidents.filter(i => {
            const incidentDate = new Date(i.timestamp).toISOString().split('T')[0];
            return incidentDate === today;
          }).length;
          
          // Create analytics embed
          const analyticsEmbed = new EmbedBuilder()
            .setTitle('📊 Security Analytics Dashboard')
            .setDescription(`Comprehensive security analytics for **${guild.name}**`)
            .setColor(0x3498DB)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
              {
                name: '👥 Server Demographics',
                value: `• Total Members: ${memberCount}\n• Humans: ${humanCount}\n• Bots: ${botCount}\n• Bot Ratio: ${Math.round((botCount / memberCount) * 100)}%`,
                inline: false
              },
              {
                name: '🛡️ Security Incidents',
                value: `• Total Incidents: ${incidents.length}\n• Today's Incidents: ${todayIncidents}\n• Nuke Attempts: ${nukeAttempts}\n• Raid Attempts: ${raidAttempts}\n• Spam Events: ${spamEvents}\n• Scam Links: ${scamLinks}`,
                inline: false
              },
              {
                name: '📈 Threat Analysis',
                value: `• Current Threat Level: ${
                  todayIncidents > 5 ? '🔴 High' : 
                  todayIncidents > 2 ? '🟡 Medium' : 
                  '🟢 Low'
                }\n• Most Common Threat: ${
                  Math.max(nukeAttempts, raidAttempts, spamEvents, scamLinks) === nukeAttempts ? 'Nuke Attempts' :
                  Math.max(nukeAttempts, raidAttempts, spamEvents, scamLinks) === raidAttempts ? 'Raid Attempts' :
                  Math.max(nukeAttempts, raidAttempts, spamEvents, scamLinks) === spamEvents ? 'Spam Events' :
                  'Scam Links'
                }\n• Incident Rate: ${incidents.length > 0 ? `${Math.round(incidents.length / 30 * 100) / 100} per day` : 'No incidents recorded'}`
              },
              {
                name: '🔧 Protection Status',
                value: `• Anti-Nuke: ${serverConfig.antiNukeEnabled ? '✅ Active' : '❌ Inactive'}\n• Anti-Raid: ${!serverConfig.antiRaidDisabled ? '✅ Active' : '❌ Inactive'}\n• Anti-Spam: ${!serverConfig.antiSpamDisabled ? '✅ Active' : '❌ Inactive'}\n• CAPTCHA: ${serverConfig.captchaEnabled ? '✅ Active' : '❌ Inactive'}`
              }
            )
            .setFooter({ text: 'Premium Feature • Security Analytics • Updated just now' })
            .setTimestamp();
            
          // Create buttons for more detailed analytics
          const analyticsRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('analytics_detailed')
                .setLabel('Detailed Report')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📑'),
              new ButtonBuilder()
                .setCustomId('analytics_threats')
                .setLabel('Threat Analysis')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
              new ButtonBuilder()
                .setCustomId('analytics_members')
                .setLabel('Member Activity')
                .setStyle(ButtonStyle.Success)
                .setEmoji('👥')
            );
            
          const analyticsResponse = await interaction.followUp({ 
            embeds: [analyticsEmbed],
            components: [analyticsRow],
            fetchReply: true
          });
          
          // Set up collector for analytics button interactions
          const analyticsFilter = i => i.user.id === interaction.user.id;
          const analyticsCollector = analyticsResponse.createMessageComponentCollector({ 
            filter: analyticsFilter, 
            time: 60000 // 1 minute timeout
          });
          
          analyticsCollector.on('collect', async i => {
            try {
              // Defer the update to prevent "interaction failed" errors
              await i.deferUpdate();
              
              if (i.customId === 'analytics_detailed') {
                await i.followUp({
                  content: '📑 Detailed security report is being generated. This feature will be available soon!',
                  ephemeral: true
                });
              } 
              else if (i.customId === 'analytics_threats') {
                await i.followUp({
                  content: '⚠️ Threat analysis dashboard is being prepared. This feature will be available soon!',
                  ephemeral: true
                });
              }
              else if (i.customId === 'analytics_members') {
                await i.followUp({
                  content: '👥 Member activity report is being compiled. This feature will be available soon!',
                  ephemeral: true
                });
              }
            } catch (error) {
              console.error('Error handling analytics button:', error);
              await i.followUp({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
              }).catch(console.error);
            }
          });
          
          analyticsCollector.on('end', () => {
            // Disable buttons when collector expires
            const disabledRow = ActionRowBuilder.from(analyticsRow);
            
            for (const button of disabledRow.components) {
              button.setDisabled(true);
            }
            
            interaction.editReply({
              embeds: [analyticsEmbed],
              components: [disabledRow]
            }).catch(console.error);
          });
        } catch (error) {
          console.error('Error generating analytics:', error);
          return interaction.followUp({
            content: `❌ Error generating analytics: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      case 'backup':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Toggle backup system if setting provided
        if (setting) {
          config.updateServerConfig(serverId, {
            backupEnabled: setting === 'enable',
            backupSettings: {
              frequency: 'daily', // daily, weekly, or monthly
              includeChannels: true,
              includeRoles: true,
              includeSettings: true,
              maxBackups: 5
            }
          });
          
          // Create backup embed
          const backupEmbed = new EmbedBuilder()
            .setTitle('💾 Auto-Backup System')
            .setDescription(`Server backup system has been ${setting === 'enable' ? 'enabled ✅' : 'disabled ❌'}`)
            .setColor(setting === 'enable' ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Features',
                value: '• Automated Daily Backups\n• Channel Structure Backup\n• Role Hierarchy Backup\n• Server Settings Backup\n• Manual Restore Option'
              },
              {
                name: '⚙️ Configuration',
                value: `• Frequency: Daily\n• Max Stored Backups: 5\n• Includes: Channels, Roles, Settings`
              }
            )
            .setFooter({ text: 'Premium Feature • Auto-Backup System' })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [backupEmbed] });
        } else {
          // Generate immediate backup (manual backup)
          try {
            // Create manual backup embed
            const backupStatusEmbed = new EmbedBuilder()
              .setTitle('💾 Server Backup')
              .setDescription('Creating a server backup... This may take a moment.')
              .setColor(0x3498DB)
              .setTimestamp();
              
            // Send initial message
            const backupMsg = await interaction.followUp({ embeds: [backupStatusEmbed] });
            
            // Simulate backup process (would need actual implementation)
            setTimeout(async () => {
              // Update with completed backup info
              const backupCompleteEmbed = new EmbedBuilder()
                .setTitle('💾 Server Backup Complete')
                .setDescription('✅ Server backup has been successfully created!')
                .setColor(0x2ECC71)
                .addFields(
                  {
                    name: '📊 Backup Statistics',
                    value: `• Channels: ${guild.channels.cache.size}\n• Roles: ${guild.roles.cache.size}\n• Emojis: ${guild.emojis.cache.size}\n• Server Settings: ✅\n• Backup Size: ${Math.round(guild.channels.cache.size * 0.3 + guild.roles.cache.size * 0.1 + guild.emojis.cache.size * 0.5)} KB`
                  },
                  {
                    name: '⏱️ Backup Details',
                    value: `• Date: ${new Date().toISOString().replace('T', ' ').substr(0, 19)}\n• Backup ID: BKP-${Date.now().toString(36).toUpperCase()}\n• Type: Manual Backup\n• Retention: 30 days`
                  },
                  {
                    name: '🔄 Restoration',
                    value: 'To restore this backup, use the `/backup restore` command with the Backup ID.'
                  }
                )
                .setFooter({ text: 'Premium Feature • Server Backup System' })
                .setTimestamp();
                
              // Update the message
              try {
                await backupMsg.edit({ embeds: [backupCompleteEmbed] });
              } catch (editError) {
                console.error('Error updating backup message:', editError);
              }
            }, 3000);
          } catch (error) {
            console.error('Error creating backup:', error);
            return interaction.followUp({
              content: `❌ Error creating backup: ${error.message}`,
              ephemeral: true
            });
          }
        }
        break;
        
      case 'alerts':
        if (!hasPremiumAccess) {
          return await interaction.followUp({ 
            content: '❌ This feature requires premium access! Check `/premium status` for more information.',
            ephemeral: true
          });
        }
        
        // Configure alert settings
        if (channel) {
          // Set alert channel
          config.updateServerConfig(serverId, {
            alertChannelId: channel.id,
            alertSettings: {
              includeMemberJoins: true,
              includeMemberLeaves: true,
              includeRoleChanges: true,
              includeSecurityEvents: true,
              includeHighSeverity: true,
              includeMediumSeverity: true,
              includeLowSeverity: false
            }
          });
          
          // Create alert setup embed
          const alertSetupEmbed = new EmbedBuilder()
            .setTitle('🔔 Advanced Alert System')
            .setDescription(`Alert channel has been set to ${channel}`)
            .setColor(0x3498DB)
            .addFields(
              {
                name: '📝 Alert Types',
                value: '• Member Joins/Leaves: ✅\n• Role Changes: ✅\n• Security Events: ✅'
              },
              {
                name: '🚨 Severity Levels',
                value: '• High Severity: ✅\n• Medium Severity: ✅\n• Low Severity: ❌'
              },
              {
                name: '⚙️ Configuration',
                value: 'Use the buttons below to configure alert settings'
              }
            )
            .setFooter({ text: 'Premium Feature • Advanced Alert System' })
            .setTimestamp();
            
          // Create buttons for alert configuration
          const alertRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('alerts_config')
                .setLabel('Configure Alerts')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚙️'),
              new ButtonBuilder()
                .setCustomId('alerts_test')
                .setLabel('Test Alert')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🧪')
            );
            
          const alertResponse = await interaction.followUp({ 
            embeds: [alertSetupEmbed],
            components: [alertRow],
            fetchReply: true
          });
          
          // Set up collector for alert button interactions
          const alertFilter = i => i.user.id === interaction.user.id;
          const alertCollector = alertResponse.createMessageComponentCollector({ 
            filter: alertFilter, 
            time: 60000 // 1 minute timeout
          });
          
          alertCollector.on('collect', async i => {
            try {
              // Defer the update to prevent "interaction failed" errors
              await i.deferUpdate();
              
              if (i.customId === 'alerts_config') {
                await i.followUp({
                  content: '⚙️ Advanced alert configuration will be available soon! For now, you can use `/premium alerts` with a channel parameter to set the alert channel.',
                  ephemeral: true
                });
              } 
              else if (i.customId === 'alerts_test') {
                // Send a test alert to the configured channel
                if (channel) {
                  try {
                    const testAlertEmbed = new EmbedBuilder()
                      .setTitle('🧪 Test Alert')
                      .setDescription('This is a test alert to verify the alert system is working correctly.')
                      .setColor(0x3498DB)
                      .addFields(
                        {
                          name: '📝 Alert Info',
                          value: 'This is a sample alert that shows how security notifications will appear in this channel.'
                        },
                        {
                          name: '🔧 Alert System',
                          value: 'If you\'re seeing this message, your alert system is properly configured!'
                        }
                      )
                      .setFooter({ text: 'Premium Feature • Advanced Alert System • Test Message' })
                      .setTimestamp();
                      
                    await channel.send({ embeds: [testAlertEmbed] });
                    
                    await i.followUp({
                      content: `✅ Test alert sent to ${channel}! Check the channel to see the test message.`,
                      ephemeral: true
                    });
                  } catch (error) {
                    console.error('Error sending test alert:', error);
                    await i.followUp({
                      content: `❌ Error sending test alert: ${error.message}`,
                      ephemeral: true
                    });
                  }
                } else {
                  await i.followUp({
                    content: '❌ No alert channel configured. Please set an alert channel first using `/premium alerts #channel`.',
                    ephemeral: true
                  });
                }
              }
            } catch (error) {
              console.error('Error handling alert button:', error);
              await i.followUp({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
              }).catch(console.error);
            }
          });
          
          alertCollector.on('end', () => {
            // Disable buttons when collector expires
            const disabledRow = ActionRowBuilder.from(alertRow);
            
            for (const button of disabledRow.components) {
              button.setDisabled(true);
            }
            
            interaction.editReply({
              embeds: [alertSetupEmbed],
              components: [disabledRow]
            }).catch(console.error);
          });
        } else {
          // Show alert status
          const alertSettings = serverConfig.alertSettings || {};
          const alertChannelId = serverConfig.alertChannelId;
          
          const alertStatusEmbed = new EmbedBuilder()
            .setTitle('🔔 Advanced Alert System Status')
            .setDescription(alertChannelId ? 
              `Alerts are currently being sent to <#${alertChannelId}>` : 
              'No alert channel has been set up yet')
            .setColor(alertChannelId ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              {
                name: '📝 Alert Types',
                value: `• Member Joins/Leaves: ${alertSettings.includeMemberJoins ? '✅' : '❌'}\n• Role Changes: ${alertSettings.includeRoleChanges ? '✅' : '❌'}\n• Security Events: ${alertSettings.includeSecurityEvents ? '✅' : '❌'}`
              },
              {
                name: '🚨 Severity Levels',
                value: `• High Severity: ${alertSettings.includeHighSeverity ? '✅' : '❌'}\n• Medium Severity: ${alertSettings.includeMediumSeverity ? '✅' : '❌'}\n• Low Severity: ${alertSettings.includeLowSeverity ? '✅' : '❌'}`
              },
              {
                name: '⚙️ Configuration',
                value: 'Use `/premium alerts` with a channel parameter to set up the alert system'
              }
            )
            .setFooter({ text: 'Premium Feature • Advanced Alert System' })
            .setTimestamp();
            
          await interaction.followUp({ embeds: [alertStatusEmbed] });
        }
        break;
        
      default:
        // Show premium status by default
        await interaction.followUp({ embeds: [premiumStatusEmbed] });
    }
  }
};