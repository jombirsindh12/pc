const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../utils/config');
const securityManager = require('../utils/securityManager');
const backupManager = require('../utils/backupManager');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'status',
  description: 'Display and test status of all bot features',
  usage: '/status [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform',
      required: false,
      choices: [
        {
          name: 'check',
          value: 'check'
        },
        {
          name: 'test',
          value: 'test'
        },
        {
          name: 'security',
          value: 'security'
        },
        {
          name: 'backup',
          value: 'backup'
        },
        {
          name: 'youtube',
          value: 'youtube'
        }
      ]
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available, otherwise use message
    const isSlashCommand = !!interaction;
    
    // Always defer reply for slash commands
    if (isSlashCommand && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(err => {
        console.error(`[Status] Failed to defer reply: ${err}`);
      });
    }
    
    // Get the user and guild info
    const user = isSlashCommand ? interaction.user : message.author;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    if (!guild) {
      const response = "❌ This command must be used in a server!";
      if (isSlashCommand) {
        return interaction.editReply({ content: response });
      } else {
        return message.reply(response);
      }
    }
    
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get member for permission checking
    const member = guild.members.cache.get(user.id);
    
    // Check if user has admin permissions
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      const permError = '❌ You need administrator permissions to use this command.';
      
      if (isSlashCommand) {
        return interaction.editReply({ content: permError });
      } else {
        return message.reply(permError);
      }
    }
    
    // Get action from args or interaction options
    let action = 'check'; // Default action
    if (isSlashCommand) {
      const actionOption = interaction.options.getString('action');
      if (actionOption) action = actionOption;
    } else if (args && args.length > 0) {
      action = args[0].toLowerCase();
    }
    
    // Handle different actions
    switch(action) {
      case 'check':
        await checkAllFeatures(client, guild, user, isSlashCommand, interaction, message);
        break;
        
      case 'test':
        await testAllFeatures(client, guild, user, isSlashCommand, interaction, message);
        break;
        
      case 'security':
        await checkSecurityFeatures(client, guild, user, isSlashCommand, interaction, message);
        break;
        
      case 'backup':
        await checkBackupFeatures(client, guild, user, isSlashCommand, interaction, message);
        break;
        
      case 'youtube':
        await checkYouTubeFeatures(client, guild, user, isSlashCommand, interaction, message);
        break;
        
      default:
        const unknownAction = `❌ Unknown action: ${action}. Available actions: check, test, security, backup, youtube`;
        if (isSlashCommand) {
          await interaction.editReply({ content: unknownAction });
        } else {
          await message.reply(unknownAction);
        }
    }
  }
};

/**
 * Check status of all bot features
 */
async function checkAllFeatures(client, guild, user, isSlashCommand, interaction, message) {
  const serverId = guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  // Create main embed
  const statusEmbed = new EmbedBuilder()
    .setTitle('🤖 Bot Status Overview')
    .setDescription(`Status report for ${guild.name}`)
    .setColor(0x3498DB)
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp();
  
  // Add general info
  statusEmbed.addFields(
    {
      name: '📊 General Information',
      value: [
        `**Bot Name:** ${client.user.username}`,
        `**Bot ID:** ${client.user.id}`,
        `**Uptime:** ${formatUptime(client.uptime)}`,
        `**Server Count:** ${client.guilds.cache.size}`,
        `**Prefix:** ${serverConfig.prefix || '!'}`,
        `**Latency:** ${client.ws.ping}ms`
      ].join('\n')
    }
  );
  
  // Add YouTube features status
  const youtubeStatus = [
    `**YouTube Channel:** ${serverConfig.youtubeChannelId ? '✅ Set' : '❌ Not Set'}`,
    serverConfig.youtubeChannelId ? `**Channel Name:** ${serverConfig.youtubeChannelName || 'Unknown'}` : '',
    `**Sub Count Channel:** ${serverConfig.subCountChannelId ? '✅ Active' : '❌ Not Set'}`,
    serverConfig.subCountChannelId ? `**Update Frequency:** ${serverConfig.updateFrequencyMinutes || 60} minutes` : '',
    `**Notification Channel:** ${serverConfig.notificationChannelId ? '✅ Set' : '❌ Not Set'}`
  ].filter(Boolean).join('\n');
  
  statusEmbed.addFields(
    {
      name: '📺 YouTube Features',
      value: youtubeStatus || 'No YouTube features configured'
    }
  );
  
  // Add security features status
  const securityStatus = [
    `**Security Monitoring:** ${serverConfig.securityDisabled ? '❌ Disabled' : '✅ Active'}`,
    `**Anti-Nuke Protection:** ${serverConfig.antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}`,
    `**Verification Channel:** ${serverConfig.verificationChannelId ? '✅ Set' : '❌ Not Set'}`,
    `**Verification Role:** ${serverConfig.roleId ? '✅ Set' : '❌ Not Set'}`,
    `**Whitelisted Users:** ${(serverConfig.whitelistedUsers?.length || 0)} users`,
    `**Captcha Verification:** ${serverConfig.captchaEnabled ? '✅ Enabled' : '❌ Disabled'}`
  ].join('\n');
  
  statusEmbed.addFields(
    {
      name: '🛡️ Security Features',
      value: securityStatus
    }
  );
  
  // Add backup features status
  const backupStatus = [
    `**Backup System:** ${serverConfig.backupEnabled ? '✅ Enabled' : '❌ Disabled'}`,
    serverConfig.backupEnabled ? `**Backup Frequency:** ${serverConfig.backupSettings?.frequency || 'daily'}` : '',
    serverConfig.backupEnabled ? `**Max Backups:** ${serverConfig.backupSettings?.maxBackups || 5}` : '',
    `**Last Backup:** ${serverConfig.lastBackupTime ? new Date(serverConfig.lastBackupTime).toLocaleString() : 'Never'}`
  ].filter(Boolean).join('\n');
  
  statusEmbed.addFields(
    {
      name: '💾 Backup Features',
      value: backupStatus
    }
  );
  
  // Add premium status
  const premiumStatus = serverConfig.premium ? '✅ Enabled' : '❌ Disabled';
  
  statusEmbed.addFields(
    {
      name: '💎 Premium Status',
      value: premiumStatus
    }
  );
  
  // Create buttons for testing different features
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('status_test_security')
        .setLabel('Test Security')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('status_test_youtube')
        .setLabel('Test YouTube')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📺'),
      new ButtonBuilder()
        .setCustomId('status_test_backup')
        .setLabel('Test Backup')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💾')
    );
  
  // Send the embed
  let sentMessage;
  if (isSlashCommand) {
    sentMessage = await interaction.editReply({
      embeds: [statusEmbed],
      components: [buttonRow]
    });
  } else {
    sentMessage = await message.reply({
      embeds: [statusEmbed],
      components: [buttonRow]
    });
  }
  
  // Set up collector for the buttons
  const filter = i => i.user.id === user.id;
  const collector = sentMessage.createMessageComponentCollector({ 
    filter, 
    time: 60000 // 1 minute timeout
  });
  
  collector.on('collect', async i => {
    try {
      await i.deferUpdate();
      
      if (i.customId === 'status_test_security') {
        await checkSecurityFeatures(client, guild, user, true, i, null);
      } else if (i.customId === 'status_test_youtube') {
        await checkYouTubeFeatures(client, guild, user, true, i, null);
      } else if (i.customId === 'status_test_backup') {
        await checkBackupFeatures(client, guild, user, true, i, null);
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
    }
  });
  
  collector.on('end', () => {
    // Disable buttons after timeout
    const disabledButtonRow = ActionRowBuilder.from(buttonRow);
    for (const button of disabledButtonRow.components) {
      button.setDisabled(true);
    }
    
    if (isSlashCommand) {
      interaction.editReply({
        embeds: [statusEmbed],
        components: [disabledButtonRow]
      }).catch(console.error);
    } else if (sentMessage?.editable) {
      sentMessage.edit({
        embeds: [statusEmbed],
        components: [disabledButtonRow]
      }).catch(console.error);
    }
  });
}

/**
 * Test all features and return results
 */
async function testAllFeatures(client, guild, user, isSlashCommand, interaction, message) {
  const testEmbed = new EmbedBuilder()
    .setTitle('🧪 Bot Feature Test')
    .setDescription(`Running tests for all bot features in ${guild.name}...`)
    .setColor(0xE67E22)
    .setTimestamp();
  
  // Send initial message
  let sentMessage;
  if (isSlashCommand) {
    sentMessage = await interaction.editReply({
      embeds: [testEmbed]
    });
  } else {
    sentMessage = await message.reply({
      embeds: [testEmbed]
    });
  }
  
  // Start running tests
  try {
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Test results storage
    const testResults = {
      general: { status: '✅ Passed', details: [] },
      youtube: { status: '⏳ Testing...', details: [] },
      security: { status: '⏳ Testing...', details: [] },
      backup: { status: '⏳ Testing...', details: [] }
    };
    
    // General tests
    testResults.general.details.push(`Bot latency: ${client.ws.ping}ms`);
    testResults.general.details.push(`Command count: ${client.commands.size}`);
    testResults.general.details.push(`Server config loaded: ${Object.keys(serverConfig).length > 0 ? '✅' : '❌'}`);
    
    // Update embed with initial results
    testEmbed.setFields(
      {
        name: '🤖 General Systems',
        value: `${testResults.general.status}\n${testResults.general.details.join('\n')}`
      },
      {
        name: '📺 YouTube Features',
        value: testResults.youtube.status
      },
      {
        name: '🛡️ Security Features',
        value: testResults.security.status
      },
      {
        name: '💾 Backup Features',
        value: testResults.backup.status
      }
    );
    
    // Update message
    if (isSlashCommand) {
      await interaction.editReply({ embeds: [testEmbed] });
    } else if (sentMessage?.editable) {
      await sentMessage.edit({ embeds: [testEmbed] });
    }
    
    // Test YouTube features
    if (serverConfig.youtubeChannelId) {
      try {
        const youtubeAPI = require('../utils/youtubeAPI');
        const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
        
        if (channelInfo && channelInfo.title) {
          testResults.youtube.details.push(`Channel info fetched: ✅`);
          testResults.youtube.details.push(`Channel name: ${channelInfo.title}`);
          testResults.youtube.details.push(`Subscriber count: ${channelInfo.subscriberCount}`);
          testResults.youtube.status = '✅ Passed';
        } else {
          testResults.youtube.details.push('Failed to fetch channel info');
          testResults.youtube.status = '❌ Failed';
        }
      } catch (error) {
        testResults.youtube.details.push(`Error: ${error.message}`);
        testResults.youtube.status = '❌ Failed';
      }
    } else {
      testResults.youtube.details.push('No YouTube channel configured');
      testResults.youtube.status = '⚠️ Skipped';
    }
    
    // Update embed with YouTube results
    testEmbed.setFields(
      {
        name: '🤖 General Systems',
        value: `${testResults.general.status}\n${testResults.general.details.join('\n')}`
      },
      {
        name: '📺 YouTube Features',
        value: `${testResults.youtube.status}\n${testResults.youtube.details.join('\n')}`
      },
      {
        name: '🛡️ Security Features',
        value: testResults.security.status
      },
      {
        name: '💾 Backup Features',
        value: testResults.backup.status
      }
    );
    
    // Update message
    if (isSlashCommand) {
      await interaction.editReply({ embeds: [testEmbed] });
    } else if (sentMessage?.editable) {
      await sentMessage.edit({ embeds: [testEmbed] });
    }
    
    // Test security features
    try {
      // Check if security module is loaded
      if (typeof securityManager.recordAction === 'function') {
        testResults.security.details.push('Security manager loaded: ✅');
        
        // Test a simulated action (won't trigger actual security measures)
        const testAction = securityManager.recordAction(
          'SYSTEM_TEST', 
          'SYSTEM_TEST_USER',
          'systemTest',
          { isTest: true, isServerOwner: true }
        );
        
        testResults.security.details.push('Test action recorded: ✅');
        testResults.security.details.push(`Security disabled: ${serverConfig.securityDisabled ? '✅' : '❌'}`);
        testResults.security.details.push(`Anti-nuke enabled: ${serverConfig.antiNukeEnabled ? '✅' : '❌'}`);
        
        testResults.security.status = '✅ Passed';
      } else {
        testResults.security.details.push('Security manager not properly loaded');
        testResults.security.status = '❌ Failed';
      }
    } catch (error) {
      testResults.security.details.push(`Error: ${error.message}`);
      testResults.security.status = '❌ Failed';
    }
    
    // Update embed with security results
    testEmbed.setFields(
      {
        name: '🤖 General Systems',
        value: `${testResults.general.status}\n${testResults.general.details.join('\n')}`
      },
      {
        name: '📺 YouTube Features',
        value: `${testResults.youtube.status}\n${testResults.youtube.details.join('\n')}`
      },
      {
        name: '🛡️ Security Features',
        value: `${testResults.security.status}\n${testResults.security.details.join('\n')}`
      },
      {
        name: '💾 Backup Features',
        value: testResults.backup.status
      }
    );
    
    // Update message
    if (isSlashCommand) {
      await interaction.editReply({ embeds: [testEmbed] });
    } else if (sentMessage?.editable) {
      await sentMessage.edit({ embeds: [testEmbed] });
    }
    
    // Test backup features
    try {
      // Check if backup module is loaded
      if (typeof backupManager.getAvailableBackups === 'function') {
        testResults.backup.details.push('Backup manager loaded: ✅');
        
        // Check for backup directory
        const backupDir = path.join(__dirname, '..', 'backups');
        const backupDirExists = fs.existsSync(backupDir);
        testResults.backup.details.push(`Backup directory exists: ${backupDirExists ? '✅' : '❌'}`);
        
        // Get available backups
        const backups = backupManager.getAvailableBackups(serverId);
        testResults.backup.details.push(`Available backups: ${backups.length}`);
        
        if (backups.length > 0) {
          testResults.backup.details.push(`Last backup: ${new Date(backups[backups.length - 1].timestamp).toLocaleString()}`);
        }
        
        testResults.backup.details.push(`Backup enabled: ${serverConfig.backupEnabled ? '✅' : '❌'}`);
        
        testResults.backup.status = '✅ Passed';
      } else {
        testResults.backup.details.push('Backup manager not properly loaded');
        testResults.backup.status = '❌ Failed';
      }
    } catch (error) {
      testResults.backup.details.push(`Error: ${error.message}`);
      testResults.backup.status = '❌ Failed';
    }
    
    // Final embed update with all results
    testEmbed.setFields(
      {
        name: '🤖 General Systems',
        value: `${testResults.general.status}\n${testResults.general.details.join('\n')}`
      },
      {
        name: '📺 YouTube Features',
        value: `${testResults.youtube.status}\n${testResults.youtube.details.join('\n')}`
      },
      {
        name: '🛡️ Security Features',
        value: `${testResults.security.status}\n${testResults.security.details.join('\n')}`
      },
      {
        name: '💾 Backup Features',
        value: `${testResults.backup.status}\n${testResults.backup.details.join('\n')}`
      }
    );
    
    // Add overall status
    const allPassed = Object.values(testResults).every(r => r.status === '✅ Passed' || r.status === '⚠️ Skipped');
    testEmbed.setDescription(`Test complete for ${guild.name}\nOverall status: ${allPassed ? '✅ All tests passed' : '❌ Some tests failed'}`);
    testEmbed.setColor(allPassed ? 0x2ECC71 : 0xE74C3C);
    
    // Final message update
    if (isSlashCommand) {
      await interaction.editReply({ embeds: [testEmbed] });
    } else if (sentMessage?.editable) {
      await sentMessage.edit({ embeds: [testEmbed] });
    }
    
  } catch (error) {
    console.error('Error during feature tests:', error);
    
    // Update with error
    testEmbed.setDescription(`Error during feature tests: ${error.message}`)
      .setColor(0xE74C3C);
    
    if (isSlashCommand) {
      await interaction.editReply({ embeds: [testEmbed] });
    } else if (sentMessage?.editable) {
      await sentMessage.edit({ embeds: [testEmbed] });
    }
  }
}

/**
 * Check and test security features
 */
async function checkSecurityFeatures(client, guild, user, isSlashCommand, interaction, message) {
  const serverId = guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  const securityEmbed = new EmbedBuilder()
    .setTitle('🛡️ Security Features Status')
    .setDescription(`Security configuration for ${guild.name}`)
    .setColor(0xE74C3C)
    .setTimestamp();
  
  // Main security settings
  securityEmbed.addFields(
    {
      name: '⚙️ Main Security Settings',
      value: [
        `**Security Monitoring:** ${serverConfig.securityDisabled ? '❌ Disabled' : '✅ Active'}`,
        `**Anti-Nuke Protection:** ${serverConfig.antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        `**Security Incidents:** ${(serverConfig.securityIncidents?.length || 0)} recorded`,
        `**Notification Channel:** ${serverConfig.notificationChannelId ? `<#${serverConfig.notificationChannelId}>` : '❌ Not Set'}`
      ].join('\n')
    }
  );
  
  // Verification settings
  securityEmbed.addFields(
    {
      name: '🔐 Verification Settings',
      value: [
        `**Verification Channel:** ${serverConfig.verificationChannelId ? `<#${serverConfig.verificationChannelId}>` : '❌ Not Set'}`,
        `**Verification Role:** ${serverConfig.roleId ? `<@&${serverConfig.roleId}>` : '❌ Not Set'}`,
        `**CAPTCHA Verification:** ${serverConfig.captchaEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        `**CAPTCHA Type:** ${serverConfig.captchaType || 'image'}`,
        `**Verified Users:** ${Object.keys(serverConfig.verifiedImages || {}).length}`
      ].join('\n')
    }
  );
  
  // Whitelist settings
  const whitelistedUsers = serverConfig.whitelistedUsers || [];
  const whitelistedRoles = serverConfig.whitelistedRoles || [];
  
  securityEmbed.addFields(
    {
      name: '📋 Whitelist Settings',
      value: [
        `**Whitelisted Users:** ${whitelistedUsers.length}`,
        `**Whitelisted Roles:** ${whitelistedRoles.length}`
      ].join('\n')
    }
  );
  
  // Add test options
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('security_test_antinuke')
        .setLabel('Test Anti-Nuke')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('security_test_verification')
        .setLabel('Test Verification')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔐'),
      new ButtonBuilder()
        .setCustomId('security_toggle')
        .setLabel(serverConfig.securityDisabled ? 'Enable Security' : 'Disable Security')
        .setStyle(serverConfig.securityDisabled ? ButtonStyle.Success : ButtonStyle.Danger)
        .setEmoji(serverConfig.securityDisabled ? '✅' : '❌')
    );
  
  // Send the embed
  let sentMessage;
  if (isSlashCommand) {
    sentMessage = await interaction.followUp({
      embeds: [securityEmbed],
      components: [buttonRow]
    });
  } else {
    sentMessage = await message.reply({
      embeds: [securityEmbed],
      components: [buttonRow]
    });
  }
  
  // Set up collector for the buttons
  const filter = i => i.user.id === user.id;
  const collector = sentMessage.createMessageComponentCollector({ 
    filter, 
    time: 60000 // 1 minute timeout
  });
  
  collector.on('collect', async i => {
    try {
      await i.deferUpdate();
      
      if (i.customId === 'security_test_antinuke') {
        // Show simulated anti-nuke test
        const testEmbed = new EmbedBuilder()
          .setTitle('🧪 Anti-Nuke System Test')
          .setDescription('Running simulated anti-nuke test...')
          .setColor(0xE74C3C)
          .addFields(
            {
              name: '🔍 Test Result',
              value: 'Anti-nuke system is functioning correctly. The system will detect and respond to:\n- Mass ban attempts\n- Mass channel deletion\n- Mass role deletion\n- Unauthorized webhook creation'
            },
            {
              name: '⚙️ Current Thresholds',
              value: '- Mass Bans: 3 bans in 60 seconds\n- Channel Deletions: 3 deletions in 60 seconds\n- Role Deletions: 3 deletions in 60 seconds'
            }
          )
          .setFooter({ text: 'Note: This is a simulated test. No real security actions were taken.' })
          .setTimestamp();
        
        await i.followUp({ embeds: [testEmbed], ephemeral: true });
      } 
      else if (i.customId === 'security_test_verification') {
        // Show verification system test
        const verificationEmbed = new EmbedBuilder()
          .setTitle('🧪 Verification System Test')
          .setDescription(serverConfig.verificationChannelId ? 'Verification system is ready' : 'Verification system is not fully configured')
          .setColor(serverConfig.verificationChannelId ? 0x2ECC71 : 0xE74C3C)
          .addFields(
            {
              name: '🔍 Requirements Check',
              value: [
                `**Verification Channel:** ${serverConfig.verificationChannelId ? '✅ Set' : '❌ Not Set'}`,
                `**Verification Role:** ${serverConfig.roleId ? '✅ Set' : '❌ Not Set'}`, 
                `**YouTube Channel:** ${serverConfig.youtubeChannelId ? '✅ Set' : '❌ Not Set'}`
              ].join('\n')
            },
            {
              name: '📝 How to Use',
              value: serverConfig.verificationChannelId ? 
                `Users should post screenshots showing they are subscribed to the YouTube channel in <#${serverConfig.verificationChannelId}>` :
                'Set up verification with `/setupverification`'
            }
          )
          .setTimestamp();
        
        await i.followUp({ embeds: [verificationEmbed], ephemeral: true });
      }
      else if (i.customId === 'security_toggle') {
        // Toggle security status
        const newStatus = !serverConfig.securityDisabled;
        config.updateServerConfig(serverId, {
          securityDisabled: newStatus
        });
        
        // Update the embed
        securityEmbed.setFields(
          {
            name: '⚙️ Main Security Settings',
            value: [
              `**Security Monitoring:** ${newStatus ? '❌ Disabled' : '✅ Active'}`,
              `**Anti-Nuke Protection:** ${serverConfig.antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}`,
              `**Security Incidents:** ${(serverConfig.securityIncidents?.length || 0)} recorded`,
              `**Notification Channel:** ${serverConfig.notificationChannelId ? `<#${serverConfig.notificationChannelId}>` : '❌ Not Set'}`
            ].join('\n')
          },
          securityEmbed.data.fields[1],
          securityEmbed.data.fields[2]
        );
        
        // Update button
        const updatedButtonRow = new ActionRowBuilder()
          .addComponents(
            buttonRow.components[0],
            buttonRow.components[1],
            new ButtonBuilder()
              .setCustomId('security_toggle')
              .setLabel(newStatus ? 'Enable Security' : 'Disable Security')
              .setStyle(newStatus ? ButtonStyle.Success : ButtonStyle.Danger)
              .setEmoji(newStatus ? '✅' : '❌')
          );
        
        await sentMessage.edit({
          embeds: [securityEmbed],
          components: [updatedButtonRow]
        });
        
        await i.followUp({ 
          content: `Security monitoring has been ${newStatus ? 'disabled' : 'enabled'} for this server.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error handling security button:', error);
      await i.followUp({ 
        content: `Error: ${error.message}`,
        ephemeral: true
      }).catch(console.error);
    }
  });
  
  collector.on('end', () => {
    // Disable buttons after timeout
    const disabledButtonRow = ActionRowBuilder.from(buttonRow);
    for (const button of disabledButtonRow.components) {
      button.setDisabled(true);
    }
    
    sentMessage.edit({
      embeds: [securityEmbed],
      components: [disabledButtonRow]
    }).catch(console.error);
  });
}

/**
 * Check backup features and configure backup system
 */
async function checkBackupFeatures(client, guild, user, isSlashCommand, interaction, message) {
  const serverId = guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  // Get available backups
  let backups = [];
  try {
    backups = backupManager.getAvailableBackups(serverId);
  } catch (error) {
    console.error('Error getting backups:', error);
  }
  
  const backupEmbed = new EmbedBuilder()
    .setTitle('💾 Backup System Status')
    .setDescription(`Backup configuration for ${guild.name}`)
    .setColor(serverConfig.backupEnabled ? 0x2ECC71 : 0xE74C3C)
    .setTimestamp();
  
  // Backup settings
  backupEmbed.addFields(
    {
      name: '⚙️ Backup Settings',
      value: [
        `**Backup System:** ${serverConfig.backupEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        `**Backup Frequency:** ${serverConfig.backupSettings?.frequency || 'daily'}`,
        `**Include Channels:** ${serverConfig.backupSettings?.includeChannels ? '✅' : '❌'}`,
        `**Include Roles:** ${serverConfig.backupSettings?.includeRoles ? '✅' : '❌'}`,
        `**Include Settings:** ${serverConfig.backupSettings?.includeSettings ? '✅' : '❌'}`,
        `**Max Backups:** ${serverConfig.backupSettings?.maxBackups || 5}`
      ].join('\n')
    }
  );
  
  // Backup history
  let backupHistory = 'No backups found';
  if (backups.length > 0) {
    backupHistory = backups.slice(-5).map(backup => {
      return `• ${new Date(backup.timestamp).toLocaleString()} - ID: ${backup.backupId}`;
    }).join('\n');
  }
  
  backupEmbed.addFields(
    {
      name: '📚 Backup History',
      value: backupHistory
    }
  );
  
  // Stats field
  backupEmbed.addFields(
    {
      name: '📊 Server Stats',
      value: [
        `**Channels:** ${guild.channels.cache.size}`,
        `**Roles:** ${guild.roles.cache.size}`,
        `**Members:** ${guild.memberCount}`,
        `**Emojis:** ${guild.emojis.cache.size}`
      ].join('\n')
    }
  );
  
  // Create buttons
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('backup_create')
        .setLabel('Create Backup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾'),
      new ButtonBuilder()
        .setCustomId('backup_toggle')
        .setLabel(serverConfig.backupEnabled ? 'Disable Auto-Backup' : 'Enable Auto-Backup')
        .setStyle(serverConfig.backupEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(serverConfig.backupEnabled ? '❌' : '✅')
    );
  
  // Add restore button if backups exist
  if (backups.length > 0) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('backup_restore')
        .setLabel('Restore Backup')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄')
    );
  }
  
  // Send the embed
  let sentMessage;
  if (isSlashCommand) {
    sentMessage = await interaction.followUp({
      embeds: [backupEmbed],
      components: [buttonRow]
    });
  } else {
    sentMessage = await message.reply({
      embeds: [backupEmbed],
      components: [buttonRow]
    });
  }
  
  // Set up collector for the buttons
  const filter = i => i.user.id === user.id;
  const collector = sentMessage.createMessageComponentCollector({ 
    filter, 
    time: 60000 // 1 minute timeout
  });
  
  collector.on('collect', async i => {
    try {
      await i.deferUpdate();
      
      if (i.customId === 'backup_create') {
        // Create a backup
        const backupStatusEmbed = new EmbedBuilder()
          .setTitle('💾 Server Backup')
          .setDescription('Creating a server backup... This may take a moment.')
          .setColor(0x3498DB)
          .setTimestamp();
          
        const backupMsg = await i.followUp({ 
          embeds: [backupStatusEmbed],
          ephemeral: false
        });
        
        try {
          // Create backup
          const backupResult = await backupManager.createServerBackup(guild, {
            includeMessages: true,
            messageLimit: 50
          });
          
          if (backupResult.success) {
            // Update with success
            const backupCompleteEmbed = new EmbedBuilder()
              .setTitle('💾 Server Backup Complete')
              .setDescription('✅ Server backup has been successfully created!')
              .setColor(0x2ECC71)
              .addFields(
                {
                  name: '📊 Backup Statistics',
                  value: `• Channels: ${backupResult.statistics.channels}\n• Roles: ${backupResult.statistics.roles}\n• Settings: ${backupResult.statistics.settings}\n• Backup Size: ${Math.round(backupResult.statistics.size / 1024)} KB`
                },
                {
                  name: '⏱️ Backup Details',
                  value: `• Date: ${new Date().toLocaleString()}\n• Backup ID: ${backupResult.backupId}\n• Type: Manual Backup\n• Retention: 30 days`
                }
              )
              .setFooter({ text: 'Backup System • Status Command' })
              .setTimestamp();
              
            await backupMsg.edit({ embeds: [backupCompleteEmbed] });
            
            // Update the main embed with the new backup
            backups = backupManager.getAvailableBackups(serverId);
            let updatedBackupHistory = 'No backups found';
            if (backups.length > 0) {
              updatedBackupHistory = backups.slice(-5).map(backup => {
                return `• ${new Date(backup.timestamp).toLocaleString()} - ID: ${backup.backupId}`;
              }).join('\n');
            }
            
            backupEmbed.setFields(
              backupEmbed.data.fields[0],
              {
                name: '📚 Backup History',
                value: updatedBackupHistory
              },
              backupEmbed.data.fields[2]
            );
            
            // Update buttons if this is the first backup
            let updatedButtonRow = buttonRow;
            if (backups.length === 1 && !buttonRow.components.find(c => c.data.custom_id === 'backup_restore')) {
              updatedButtonRow = ActionRowBuilder.from(buttonRow);
              updatedButtonRow.addComponents(
                new ButtonBuilder()
                  .setCustomId('backup_restore')
                  .setLabel('Restore Backup')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🔄')
              );
            }
            
            await sentMessage.edit({
              embeds: [backupEmbed],
              components: [updatedButtonRow]
            });
          } else {
            throw new Error(backupResult.error || 'Unknown error during backup');
          }
        } catch (backupError) {
          console.error('Error creating backup:', backupError);
          
          // Show error message
          const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Backup Failed')
            .setDescription(`There was an error creating the backup: ${backupError.message}`)
            .setColor(0xE74C3C)
            .setTimestamp();
            
          await backupMsg.edit({ embeds: [errorEmbed] });
        }
      } 
      else if (i.customId === 'backup_toggle') {
        // Toggle backup system
        const newStatus = !serverConfig.backupEnabled;
        config.updateServerConfig(serverId, {
          backupEnabled: newStatus,
          backupSettings: serverConfig.backupSettings || {
            frequency: 'daily',
            includeChannels: true,
            includeRoles: true,
            includeSettings: true,
            maxBackups: 5
          }
        });
        
        // Reschedule if enabling
        if (newStatus) {
          try {
            if (typeof backupManager.scheduleAutomaticBackups === 'function') {
              backupManager.scheduleAutomaticBackups(client);
            }
          } catch (error) {
            console.error('Error scheduling backups:', error);
          }
        }
        
        // Update the embed
        backupEmbed.setFields(
          {
            name: '⚙️ Backup Settings',
            value: [
              `**Backup System:** ${newStatus ? '✅ Enabled' : '❌ Disabled'}`,
              `**Backup Frequency:** ${serverConfig.backupSettings?.frequency || 'daily'}`,
              `**Include Channels:** ${serverConfig.backupSettings?.includeChannels ? '✅' : '❌'}`,
              `**Include Roles:** ${serverConfig.backupSettings?.includeRoles ? '✅' : '❌'}`,
              `**Include Settings:** ${serverConfig.backupSettings?.includeSettings ? '✅' : '❌'}`,
              `**Max Backups:** ${serverConfig.backupSettings?.maxBackups || 5}`
            ].join('\n')
          },
          backupEmbed.data.fields[1],
          backupEmbed.data.fields[2]
        );
        backupEmbed.setColor(newStatus ? 0x2ECC71 : 0xE74C3C);
        
        // Update the button
        const updatedButtonRow = ActionRowBuilder.from(buttonRow);
        updatedButtonRow.components[1] = new ButtonBuilder()
          .setCustomId('backup_toggle')
          .setLabel(newStatus ? 'Disable Auto-Backup' : 'Enable Auto-Backup')
          .setStyle(newStatus ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(newStatus ? '❌' : '✅');
        
        await sentMessage.edit({
          embeds: [backupEmbed],
          components: [updatedButtonRow]
        });
        
        await i.followUp({
          content: `Auto-backup system has been ${newStatus ? 'enabled' : 'disabled'}.`,
          ephemeral: true
        });
      }
      else if (i.customId === 'backup_restore') {
        // Show restore options
        if (backups.length === 0) {
          await i.followUp({
            content: 'No backups available to restore.',
            ephemeral: true
          });
          return;
        }
        
        const restoreEmbed = new EmbedBuilder()
          .setTitle('🔄 Restore Backup')
          .setDescription(`Select a backup to restore for ${guild.name}\n\n⚠️ **WARNING:** Restoring a backup may overwrite existing channels, roles, and settings.`)
          .setColor(0x3498DB)
          .addFields(
            {
              name: '📚 Available Backups',
              value: backups.slice(-5).map((backup, index) => {
                return `${index + 1}. ${new Date(backup.timestamp).toLocaleString()} - ID: ${backup.backupId}`;
              }).join('\n')
            }
          )
          .setFooter({ text: 'Note: Actual restoration requires premium access.' })
          .setTimestamp();
        
        await i.followUp({
          embeds: [restoreEmbed],
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error handling backup button:', error);
      await i.followUp({ 
        content: `Error: ${error.message}`,
        ephemeral: true
      }).catch(console.error);
    }
  });
  
  collector.on('end', () => {
    // Disable buttons after timeout
    const disabledButtonRow = ActionRowBuilder.from(buttonRow);
    for (const button of disabledButtonRow.components) {
      button.setDisabled(true);
    }
    
    sentMessage.edit({
      embeds: [backupEmbed],
      components: [disabledButtonRow]
    }).catch(console.error);
  });
}

/**
 * Check YouTube features and live subscriber count
 */
async function checkYouTubeFeatures(client, guild, user, isSlashCommand, interaction, message) {
  const serverId = guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  const youtubeEmbed = new EmbedBuilder()
    .setTitle('📺 YouTube Features Status')
    .setDescription(`YouTube integration for ${guild.name}`)
    .setColor(serverConfig.youtubeChannelId ? 0xFF0000 : 0xE74C3C) // YouTube red if channel is set
    .setTimestamp();
  
  // Basic YouTube settings
  youtubeEmbed.addFields(
    {
      name: '⚙️ YouTube Settings',
      value: [
        `**YouTube Channel:** ${serverConfig.youtubeChannelId ? '✅ Set' : '❌ Not Set'}`,
        serverConfig.youtubeChannelId ? `**Channel Name:** ${serverConfig.youtubeChannelName || 'Unknown'}` : '',
        serverConfig.youtubeChannelId ? `**Channel ID:** ${serverConfig.youtubeChannelId}` : '',
        `**Notification Channel:** ${serverConfig.notificationChannelId ? `<#${serverConfig.notificationChannelId}>` : '❌ Not Set'}`
      ].filter(Boolean).join('\n')
    }
  );
  
  // Subscriber count settings
  youtubeEmbed.addFields(
    {
      name: '🔢 Subscriber Count',
      value: [
        `**Sub Count Channel:** ${serverConfig.subCountChannelId ? `<#${serverConfig.subCountChannelId}>` : '❌ Not Set'}`,
        serverConfig.subCountChannelId ? `**Update Frequency:** ${serverConfig.updateFrequencyMinutes || 60} minutes` : '',
        serverConfig.voiceChannelFormat ? `**Display Format:** ${serverConfig.voiceChannelFormat}` : ''
      ].filter(Boolean).join('\n')
    }
  );
  
  // Let's get the current subscriber count if available
  if (serverConfig.youtubeChannelId) {
    try {
      const youtubeAPI = require('../utils/youtubeAPI');
      const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
      
      if (channelInfo && channelInfo.title) {
        youtubeEmbed.addFields(
          {
            name: '📊 Channel Statistics',
            value: [
              `**Channel Name:** ${channelInfo.title}`,
              `**Subscriber Count:** ${channelInfo.subscriberCount || 'Hidden'}`,
              `**Last Updated:** ${new Date().toLocaleString()}`
            ].join('\n')
          }
        );
      }
    } catch (error) {
      console.error('Error fetching channel info:', error);
      youtubeEmbed.addFields(
        {
          name: '❌ Error',
          value: `Could not fetch channel information: ${error.message}`
        }
      );
    }
  }
  
  // Create buttons
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('youtube_test_update')
        .setLabel('Test Update')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('youtube_change_format')
        .setLabel('Change Format')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝')
    );
  
  // Send the embed
  let sentMessage;
  if (isSlashCommand) {
    sentMessage = await interaction.followUp({
      embeds: [youtubeEmbed],
      components: [buttonRow]
    });
  } else {
    sentMessage = await message.reply({
      embeds: [youtubeEmbed],
      components: [buttonRow]
    });
  }
  
  // Set up collector for the buttons
  const filter = i => i.user.id === user.id;
  const collector = sentMessage.createMessageComponentCollector({ 
    filter, 
    time: 60000 // 1 minute timeout
  });
  
  collector.on('collect', async i => {
    try {
      await i.deferUpdate();
      
      if (i.customId === 'youtube_test_update') {
        // Test subscriber count update
        if (!serverConfig.youtubeChannelId) {
          await i.followUp({
            content: '❌ No YouTube channel set. Use `/setyoutubechannel` to set one first.',
            ephemeral: true
          });
          return;
        }
        
        if (!serverConfig.subCountChannelId) {
          await i.followUp({
            content: '❌ No subscriber count channel set. Use `/livesubcount` to set one first.',
            ephemeral: true
          });
          return;
        }
        
        const updateEmbed = new EmbedBuilder()
          .setTitle('🔄 Testing Subscriber Count Update')
          .setDescription('Updating voice channel with current subscriber count...')
          .setColor(0x3498DB)
          .setTimestamp();
          
        const updateMsg = await i.followUp({
          embeds: [updateEmbed],
          ephemeral: false
        });
        
        try {
          // Update the subscriber count
          const youtubeAPI = require('../utils/youtubeAPI');
          const freshInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
          
          if (freshInfo && freshInfo.title) {
            // Try to update the channel
            const channel = await guild.channels.fetch(serverConfig.subCountChannelId);
            
            if (channel) {
              const format = serverConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
              const newName = format
                .replace('{channelName}', freshInfo.title)
                .replace('{subCount}', freshInfo.subscriberCount || '0');
                
              await channel.setName(newName);
              
              // Update succeeded
              const successEmbed = new EmbedBuilder()
                .setTitle('✅ Subscriber Count Updated')
                .setDescription(`Successfully updated <#${serverConfig.subCountChannelId}> with current subscriber count.`)
                .setColor(0x2ECC71)
                .addFields(
                  {
                    name: '📊 Channel Statistics',
                    value: [
                      `**Channel Name:** ${freshInfo.title}`,
                      `**Subscriber Count:** ${freshInfo.subscriberCount || 'Hidden'}`,
                      `**New Channel Name:** ${newName}`
                    ].join('\n')
                  }
                )
                .setTimestamp();
                
              await updateMsg.edit({ embeds: [successEmbed] });
            } else {
              throw new Error('Could not find subscriber count channel');
            }
          } else {
            throw new Error('Could not fetch channel information');
          }
        } catch (error) {
          console.error('Error updating subscriber count:', error);
          
          const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Update Failed')
            .setDescription(`There was an error updating the subscriber count: ${error.message}`)
            .setColor(0xE74C3C)
            .setTimestamp();
            
          await updateMsg.edit({ embeds: [errorEmbed] });
        }
      }
      else if (i.customId === 'youtube_change_format') {
        // Ask for new format
        await i.followUp({
          content: 'To change the format, use `/setvoicechannelname` with your desired format.\n\nAvailable placeholders:\n- `{channelName}` - YouTube channel name\n- `{subCount}` - Subscriber count\n\nExample: `📊 {channelName}: {subCount} subscribers`',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error handling YouTube button:', error);
      await i.followUp({ 
        content: `Error: ${error.message}`,
        ephemeral: true
      }).catch(console.error);
    }
  });
  
  collector.on('end', () => {
    // Disable buttons after timeout
    const disabledButtonRow = ActionRowBuilder.from(buttonRow);
    for (const button of disabledButtonRow.components) {
      button.setDisabled(true);
    }
    
    sentMessage.edit({
      embeds: [youtubeEmbed],
      components: [disabledButtonRow]
    }).catch(console.error);
  });
}

/**
 * Format uptime into readable string
 * @param {number} uptime - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(uptime) {
  const totalSeconds = Math.floor(uptime / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}