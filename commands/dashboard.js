const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'dashboard',
  description: 'Access the in-Discord dashboard for server settings',
  guildOnly: false, // Allow the command to be used anywhere for proper error handling
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Always defer reply for slash commands to prevent timeout
    if (isSlashCommand && !interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: false });
        console.log(`[Dashboard] Successfully deferred reply`);
      } catch (err) {
        console.error(`[Dashboard] Failed to defer reply: ${err}`);
        // Even if defer fails, we'll continue with command execution
      }
    }
    
    const user = isSlashCommand ? interaction.user : message.author;
    const channel = isSlashCommand ? interaction.channel : message.channel;
    
    // ULTRA RELIABLE SERVER DETECTION - Multiple checks to ensure we detect server context correctly
    let isDM = false;
    let guild = null;
    
    if (isSlashCommand) {
      // Method 1: Check if guildId exists
      if (interaction.guildId) {
        guild = interaction.guild;
        isDM = false;
      }
      // Method 2: Check channel.guild
      else if (interaction.channel?.guild) {
        guild = interaction.channel.guild;
        isDM = false;
      }
      // Method 3: Check channel type
      else if (interaction.channel?.type === 'DM') {
        isDM = true;
      }
      // Last resort - check if we can get guild from client cache
      else if (interaction.channelId) {
        const possibleChannel = client.channels.cache.get(interaction.channelId);
        if (possibleChannel?.guild) {
          guild = possibleChannel.guild;
          isDM = false;
        }
      }
    } else {
      // Legacy message command
      guild = message.guild || message.channel?.guild;
      isDM = !guild || message.channel?.type === 'DM';
    }
    
    // Detailed logging for diagnostics
    console.log(`Dashboard command used by ${user.tag} | isDM=${isDM}`);
    console.log(`Guild detection: hasGuild=${!!guild}, guildName=${guild?.name || 'Unknown'}`);
    if (isSlashCommand) {
      console.log(`Extra interaction data: guildId=${interaction.guildId}, channelId=${interaction.channelId}`);
    }
    
    // Skip if determined to be in DM
    if (isDM || !guild) {
      const directMessageEmbed = {
        title: '🛡️ Phantom Guard Dashboard',
        description: `Welcome to the Phantom Guard dashboard! Please use this command in a server where I'm present to access all features.`,
        color: 0x7289DA,
        fields: [
          {
            name: '📣 Important Note',
            value: 'This is a limited version of the dashboard since you are in DMs. For full functionality, use this command in a server.'
          },
          {
            name: '❓ Need help?',
            value: 'Use the `/help` command to see all available commands.'
          }
        ],
        footer: {
          text: 'Phantom Guard Security System' 
        }
      };

      if (isSlashCommand) {
        await interaction.editReply({ embeds: [directMessageEmbed] });
      } else {
        await message.reply({ embeds: [directMessageEmbed] });
      }
      return;
    }

    // Get server configuration
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // If in a guild, check for admin permissions
    const member = guild.members.cache.get(user.id);
    if (!member || !member.permissions.has('ManageGuild')) {
      const errorResponse = '❌ You need the "Manage Server" permission to access the dashboard!';
      if (isSlashCommand) {
        return interaction.followUp({ content: errorResponse, ephemeral: true });
      } else {
        return message.reply(errorResponse);
      }
    }
    
    // Create the dashboard embed
    const dashboardEmbed = {
      title: '🛡️ Phantom Guard Dashboard',
      description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
      color: 0x7289DA, // Discord blue color
      fields: [
        {
          name: '🔒 Security Settings',
          value: `Adjust anti-nuke, verification, and raid protection settings`
        },
        {
          name: '🔔 Notification Settings',
          value: `Configure welcome messages, announcements, and log channels`
        },
        {
          name: '🎮 Game & Entertainment',
          value: `Control game features and entertainment options`
        },
        {
          name: '📊 Server Statistics',
          value: `View activity, verification, and security stats`
        }
      ],
      footer: {
        text: 'Select an option from the dropdown menu below'
      }
    };
    
    // Create dashboard menu components
    const dashboardRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('dashboard_menu')
          .setPlaceholder('Select a dashboard option')
          .addOptions([
            new StringSelectMenuOptionBuilder()
              .setLabel('Security Settings')
              .setDescription('Configure anti-nuke, verification, and raid protection')
              .setValue('security')
              .setEmoji('🔒'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Notification Settings')
              .setDescription('Set up welcome messages, logs, and announcements')
              .setValue('notifications')
              .setEmoji('🔔'),
            new StringSelectMenuOptionBuilder()
              .setLabel('YouTube Verification')
              .setDescription('Configure YouTube verification system and image verification')
              .setValue('youtube')
              .setEmoji('📱'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Voice & Counters')
              .setDescription('Set up voice features and live subscriber counters')
              .setValue('voice')
              .setEmoji('🎤'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Game Settings')
              .setDescription('Manage game features and entertainment options')
              .setValue('games')
              .setEmoji('🎮'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Server Statistics')
              .setDescription('View activity and security stats')
              .setValue('stats')
              .setEmoji('📊'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Help & Info')
              .setDescription('Get help and detailed command information')
              .setValue('help')
              .setEmoji('❓')
          ])
      );
    
    // Send the initial dashboard message
    let dashboardMessage;
    if (isSlashCommand) {
      try {
        // Use the already deferred reply
        const response = await interaction.editReply({ 
          embeds: [dashboardEmbed], 
          components: [dashboardRow]
        });
        
        // Get the message object
        dashboardMessage = response;
      } catch (error) {
        console.error('Error sending dashboard:', error);
        await interaction.followUp({ 
          content: '❌ An error occurred while loading the dashboard. Please try again.', 
          ephemeral: true 
        });
        return;
      }
    } else {
      dashboardMessage = await message.channel.send({ 
        embeds: [dashboardEmbed], 
        components: [dashboardRow] 
      });
    }
    
    // Setup collector for dashboard interactions
    const filter = i => i.customId === 'dashboard_menu' && i.user.id === user.id;
    const collector = dashboardMessage.createMessageComponentCollector({
      filter,
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async i => {
      try {
        await i.deferUpdate().catch(err => {
          console.error(`[Dashboard] Failed to defer menu interaction: ${err}`);
        });
        
        const selection = i.values[0];
        const serverConfig = config.getServerConfig(guild.id);
        
        // Handle different dashboard sections
        switch (selection) {
          case 'security':
            await handleSecuritySettings(i, guild, serverConfig, client);
            break;
          case 'notifications':
            await handleNotificationSettings(i, guild, serverConfig, client);
            break;
          case 'youtube':
            await handleYouTubeSettings(i, guild, serverConfig, client);
            break;
          case 'voice':
            await handleVoiceSettings(i, guild, serverConfig, client);
            break;
          case 'games':
            await handleGameSettings(i, guild, serverConfig, client);
            break;
          case 'stats':
            await handleStatsView(i, guild, serverConfig, client);
            break;
          case 'help':
            await handleHelpInfo(i, guild, serverConfig, client);
            break;
        }
      } catch (error) {
        console.error('[Dashboard] Error handling dashboard menu selection:', error);
        // Attempt to notify user about the error
        try {
          await i.followUp({ 
            content: '❌ An error occurred while processing your selection. Please try again.', 
            ephemeral: true 
          }).catch(console.error);
        } catch (followUpError) {
          console.error('[Dashboard] Could not send error followUp:', followUpError);
        }
      }
    });
    
    collector.on('end', () => {
      // Disable the components when collection period ends
      const disabledRow = ActionRowBuilder.from(dashboardRow).setComponents(
        StringSelectMenuBuilder.from(dashboardRow.components[0]).setDisabled(true)
      );
      
      if (dashboardMessage.editable) {
        dashboardMessage.edit({ components: [disabledRow] }).catch(console.error);
      }
    });
  },
};

// Handler functions for different dashboard sections
async function handleYouTubeSettings(interaction, guild, serverConfig, client) {
  // Get current YouTube settings
  const youtubeChannel = serverConfig.youtubeChannelId ? 
    serverConfig.youtubeChannelName || serverConfig.youtubeChannelId : 'Not set';
  const verificationChannel = serverConfig.verificationChannelId ? 
    `<#${serverConfig.verificationChannelId}>` : 'Not set';
  const subscriberRole = serverConfig.roleId ? 
    `<@&${serverConfig.roleId}>` : 'Not set';
  const notificationChannel = serverConfig.notificationChannelId ? 
    `<#${serverConfig.notificationChannelId}>` : 'Not set';
  const imageVerificationEnabled = serverConfig.imageVerification || false;
  
  // Create YouTube settings embed
  const youtubeEmbed = {
    title: '📱 YouTube Verification Settings',
    description: `Manage YouTube verification settings for ${guild.name}`,
    color: 0xFF0000, // YouTube red
    fields: [
      {
        name: '📺 YouTube Channel',
        value: `Channel: ${youtubeChannel}\n` +
               `Use \`/setyoutubechannel\` or \`/searchchannel\` to change`
      },
      {
        name: '✅ Verification Channel',
        value: `Channel: ${verificationChannel}\n` +
               `Use \`/setverificationchannel\` to change`
      },
      {
        name: '👤 Subscriber Role',
        value: `Role: ${subscriberRole}\n` +
               `Use \`/setrole\` to change`
      },
      {
        name: '🔔 Notification Channel',
        value: `Channel: ${notificationChannel}\n` +
               `Use \`/setnotificationchannel\` to change`
      },
      {
        name: '🖼️ Image Verification',
        value: `Status: ${imageVerificationEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Automatically analyze verification screenshots`
      }
    ],
    footer: {
      text: 'Use the buttons below to manage settings'
    }
  };
  
  // Create buttons for YouTube settings
  const youtubeRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_imageverification')
        .setLabel(`${imageVerificationEnabled ? 'Disable' : 'Enable'} Image Verification`)
        .setStyle(imageVerificationEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('test_verification')
        .setLabel('Test Verification System')
        .setStyle(ButtonStyle.Primary)
    );
  
  const channelRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_youtube')
        .setLabel('Setup All YouTube Settings')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('view_verified')
        .setLabel('View Verified Users')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with YouTube settings
  await interaction.message.edit({
    embeds: [youtubeEmbed],
    components: [youtubeRow, channelRow, backRow]
  });
  
  // Set up collector for YouTube buttons
  const filter = i => i.user.id === interaction.user.id;
  const youtubeCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  youtubeCollector.on('collect', async i => {
    try {
      await i.deferUpdate().catch(err => {
        console.error(`[Dashboard] Failed to defer YouTube button interaction: ${err}`);
      });
      
      // Extra safety check to ensure we have a valid guild and config
      if (!guild || !guild.id) {
        console.error('[Dashboard] Missing guild data in YouTube collector');
        await i.followUp({ 
          content: '❌ An error occurred: Server data could not be loaded. Please try again.', 
          ephemeral: true 
        }).catch(console.error);
        return;
      }
    
      // Handle button interactions
      if (i.customId === 'toggle_imageverification') {
        const newValue = !serverConfig.imageVerification;
        config.updateServerConfig(guild.id, { imageVerification: newValue });
        
        // Create updated button with new state
        const updatedYouTubeRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('toggle_imageverification')
              .setLabel(`${newValue ? 'Disable' : 'Enable'} Image Verification`)
              .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
            ButtonBuilder.from(youtubeRow.components[1])
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...youtubeEmbed };
        updatedEmbed.fields[4].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
                `Automatically analyze verification screenshots`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [updatedYouTubeRow, channelRow, backRow]
          });
        } catch (error) {
          console.error('Error updating message after toggling verification:', error);
        }
      }
      else if (i.customId === 'test_verification') {
        // Create alert message about test mode
        const testAlert = new EmbedBuilder()
          .setTitle('⚙️ Verification System Test')
          .setDescription('Testing the verification system...')
          .setColor(0x3498DB)
          .addFields(
            {
              name: '📋 Status Check',
              value: `YouTube Channel: ${youtubeChannel !== 'Not set' ? '✅' : '❌'}\n` +
                    `Verification Channel: ${verificationChannel !== 'Not set' ? '✅' : '❌'}\n` +
                    `Subscriber Role: ${subscriberRole !== 'Not set' ? '✅' : '❌'}\n` +
                    `Image Verification: ${imageVerificationEnabled ? '✅ Enabled' : '❌ Disabled'}`
            },
            {
              name: '🔍 Test Results',
              value: youtubeChannel !== 'Not set' && verificationChannel !== 'Not set' && subscriberRole !== 'Not set' ?
                    '✅ Verification system is properly configured!' :
                    '❌ Verification system is not fully configured. Please set up all required components.'
            },
            {
              name: '📝 Next Steps',
              value: 'To complete setup, make sure you have:\n' +
                    '1. Set a YouTube channel\n' +
                    '2. Set a verification channel\n' +
                    '3. Set a subscriber role'
            }
          );
        
        // Show temporary alert as followup
        try {
          await i.followUp({
            embeds: [testAlert],
            ephemeral: true
          });
        } catch (error) {
          console.error('Error sending test verification results:', error);
        }
      }
      else if (i.customId === 'setup_youtube') {
        // Create setup guide message
        const setupGuide = new EmbedBuilder()
          .setTitle('📱 YouTube Verification Setup Guide')
          .setDescription('Follow these steps to set up YouTube verification:')
          .setColor(0xFF0000)
          .addFields(
            {
              name: '1️⃣ Set YouTube Channel',
              value: 'Use `/setyoutubechannel <channel-id-or-url>` or `/searchchannel <n>` to find and set the YouTube channel'
            },
            {
              name: '2️⃣ Set Verification Channel',
              value: 'Use `/setverificationchannel #channel` to set where users will post verification screenshots'
            },
            {
              name: '3️⃣ Set Subscriber Role',
              value: 'Use `/setrole @role` to set the role that verified subscribers will receive'
            },
            {
              name: '4️⃣ Set Notification Channel',
              value: 'Use `/setnotificationchannel #channel` to set where verification notifications will be sent'
            },
            {
              name: '5️⃣ Enable Image Verification',
              value: 'Use the "Enable Image Verification" button in the dashboard to automatically scan verification images'
            }
          )
          .setFooter({ text: 'Complete all steps for a fully functional verification system' });
        
        // Show setup guide as followup
        try {
          await i.followUp({
            embeds: [setupGuide],
            ephemeral: true
          });
        } catch (error) {
          console.error('Error sending YouTube setup guide:', error);
        }
      }
      else if (i.customId === 'view_verified') {
        // Get list of verified users
        const verifiedUsers = serverConfig.verifiedUsers || [];
        const recentVerifications = verifiedUsers.slice(-10).reverse(); // Get most recent 10, newest first
        
        // Create verified users embed
        const verifiedEmbed = new EmbedBuilder()
          .setTitle('✅ Verified YouTube Subscribers')
          .setDescription(`${verifiedUsers.length} users have verified their YouTube subscription`)
          .setColor(0x2ECC71);
        
        if (recentVerifications.length > 0) {
          verifiedEmbed.addFields({
            name: '🔍 Recent Verifications',
            value: recentVerifications.map((user, index) => 
              `${index + 1}. <@${user.userId}> - ${new Date(user.verifiedAt).toLocaleString()}`
            ).join('\n')
          });
        } else {
          verifiedEmbed.addFields({
            name: '❌ No Verifications',
            value: 'No users have verified their YouTube subscription yet'
          });
        }
        
        // Add info about full list
        if (verifiedUsers.length > 10) {
          verifiedEmbed.addFields({
            name: '📋 Full List',
            value: `Use \`/listverified\` command to see all ${verifiedUsers.length} verified users`
          });
        }
        
        // Show verified users as followup
        try {
          await i.followUp({
            embeds: [verifiedEmbed],
            ephemeral: true
          });
        } catch (error) {
          console.error('Error showing verified users list:', error);
        }
      }
      else if (i.customId === 'back_to_dashboard') {
        // Go back to main dashboard
        youtubeCollector.stop();
        
        // Recreate main dashboard embed with updated menu
        const dashboardEmbed = {
          title: '🛡️ Phantom Guard Dashboard',
          description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
          color: 0x7289DA,
          fields: [
            {
              name: '🔒 Security Settings',
              value: `Adjust anti-nuke, verification, and raid protection settings`
            },
            {
              name: '🔔 Notification Settings',
              value: `Configure welcome messages, announcements, and log channels`
            },
            {
              name: '🎮 Game & Entertainment',
              value: `Control game features and entertainment options`
            },
            {
              name: '📊 Server Statistics',
              value: `View activity, verification, and security stats`
            }
          ],
          footer: {
            text: 'Select an option from the dropdown menu below'
          }
        };
        
        // Create dashboard menu components
        const dashboardRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('dashboard_menu')
              .setPlaceholder('Select a dashboard option')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('Security Settings')
                  .setDescription('Configure anti-nuke, verification, and raid protection')
                  .setValue('security')
                  .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Notification Settings')
                  .setDescription('Set up welcome messages, logs, and announcements')
                  .setValue('notifications')
                  .setEmoji('🔔'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('YouTube Verification')
                  .setDescription('Configure YouTube verification system and image verification')
                  .setValue('youtube')
                  .setEmoji('📱'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Voice & Counters')
                  .setDescription('Set up voice features and live subscriber counters')
                  .setValue('voice')
                  .setEmoji('🎤'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Game Settings')
                  .setDescription('Manage game features and entertainment options')
                  .setValue('games')
                  .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Server Statistics')
                  .setDescription('View activity and security stats')
                  .setValue('stats')
                  .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Help & Info')
                  .setDescription('Get help and detailed command information')
                  .setValue('help')
                  .setEmoji('❓')
              ])
          );
        
        // Update the message with main dashboard
        try {
          await i.message.edit({
            embeds: [dashboardEmbed],
            components: [dashboardRow]
          });
        } catch (error) {
          console.error('Error returning to main dashboard:', error);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error handling YouTube interaction:', error);
      try {
        if (!i.replied) {
          await i.followUp({ 
            content: '❌ An error occurred processing your request. Please try again.', 
            ephemeral: true 
          }).catch(err => console.error('[Dashboard] Failed to send error message:', err));
        }
      } catch (followUpError) {
        console.error('[Dashboard] Failed to handle error recovery:', followUpError);
      }
    }
  });
}

// Additional handler functions for other dashboard sections
async function handleVoiceSettings(interaction, guild, serverConfig, client) {
  // Get current voice settings
  const voiceChannelId = serverConfig.voiceChannelId || 'Not set';
  const voiceChannelName = voiceChannelId !== 'Not set' 
    ? guild.channels.cache.get(voiceChannelId)?.name || 'Unknown Channel' 
    : 'Not set';
  const voiceFormat = serverConfig.voiceFormat || '{name}: {count} subscribers';
  const updateFrequency = serverConfig.updateFrequency || 300; // Default 5 minutes (300 seconds)
  const announcerEnabled = serverConfig.voiceAnnouncer || false;
  
  // Create voice settings embed
  const voiceEmbed = {
    title: '🎤 Voice & Counter Settings',
    description: `Manage voice features and subscriber counters for ${guild.name}`,
    color: 0x9B59B6, // Purple
    fields: [
      {
        name: '📊 Subscriber Count Channel',
        value: `Channel: ${voiceChannelId !== 'Not set' ? `#${voiceChannelName}` : 'Not set'}\n` +
               `Use \`/setvoicechannelname\` to change`
      },
      {
        name: '🔄 Update Frequency',
        value: `${updateFrequency} seconds\n` +
               `Use \`/setupdatefrequency\` to change`
      },
      {
        name: '📝 Channel Name Format',
        value: `\`${voiceFormat}\`\n` +
               `Variables: {name}, {count}, {abbreviatedCount}`
      },
      {
        name: '🎙️ Voice Announcer',
        value: `Status: ${announcerEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Announces when members join/leave voice channels`
      }
    ],
    footer: {
      text: 'Use the buttons below to manage settings'
    }
  };
  
  // Create buttons for voice settings
  const voiceRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_announcer')
        .setLabel(`${announcerEnabled ? 'Disable' : 'Enable'} Voice Announcer`)
        .setStyle(announcerEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('update_counter')
        .setLabel('Update Sub Count Now')
        .setStyle(ButtonStyle.Primary)
    );
  
  const formatRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('format_default')
        .setLabel('Default Format')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('format_simple')
        .setLabel('Simple Format')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('format_fancy')
        .setLabel('Fancy Format')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with voice settings
  await interaction.message.edit({
    embeds: [voiceEmbed],
    components: [voiceRow, formatRow, backRow]
  });
  
  // Set up collector for voice buttons
  const filter = i => i.user.id === interaction.user.id;
  const voiceCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  voiceCollector.on('collect', async i => {
    try {
      await i.deferUpdate().catch(err => {
        console.error(`[Dashboard] Failed to defer voice button interaction: ${err}`);
      });
      
      // Handle button interactions
      if (i.customId === 'toggle_announcer') {
        const newValue = !serverConfig.voiceAnnouncer;
        config.updateServerConfig(guild.id, { voiceAnnouncer: newValue });
        
        // Create updated button with new state
        const updatedVoiceRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('toggle_announcer')
              .setLabel(`${newValue ? 'Disable' : 'Enable'} Voice Announcer`)
              .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
            ButtonBuilder.from(voiceRow.components[1])
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...voiceEmbed };
        updatedEmbed.fields[3].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `Announces when members join/leave voice channels`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [updatedVoiceRow, formatRow, backRow]
          });
        } catch (error) {
          console.error('Error updating message after toggling announcer:', error);
        }
      }
      else if (i.customId === 'update_counter') {
        // Try to update the subscriber count
        try {
          const updateFn = require('./setVoiceChannelName').updateSubCountChannel;
          const result = await updateFn(client, guild.id);
          
          // Show update result
          if (result && result.success) {
            await i.followUp({
              content: `✅ Successfully updated subscriber count to: ${result.count}`,
              ephemeral: true
            });
          } else {
            await i.followUp({
              content: `❌ Failed to update subscriber count: ${result?.error || 'Unknown error'}`,
              ephemeral: true
            });
          }
        } catch (error) {
          console.error('Error updating subscriber count:', error);
          await i.followUp({
            content: '❌ An error occurred while updating the subscriber count.',
            ephemeral: true
          });
        }
      }
      else if (i.customId.startsWith('format_')) {
        let newFormat = voiceFormat;
        
        // Set the format based on the button clicked
        switch (i.customId) {
          case 'format_default':
            newFormat = '{name}: {count} subscribers';
            break;
          case 'format_simple':
            newFormat = '{count} Subscribers';
            break;
          case 'format_fancy':
            newFormat = '📊 {name} | {abbreviatedCount} subs';
            break;
        }
        
        // Update the config
        config.updateServerConfig(guild.id, { voiceFormat: newFormat });
        
        // Create updated embed with new values
        const updatedEmbed = { ...voiceEmbed };
        updatedEmbed.fields[2].value = `\`${newFormat}\`\n` +
                 `Variables: {name}, {count}, {abbreviatedCount}`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [voiceRow, formatRow, backRow]
          });
          
          // Show format updated message
          await i.followUp({
            content: `✅ Voice channel format updated to: \`${newFormat}\``,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error updating message after changing format:', error);
        }
      }
      else if (i.customId === 'back_to_dashboard') {
        // Go back to main dashboard
        voiceCollector.stop();
        
        // Recreate main dashboard embed with updated menu
        const dashboardEmbed = {
          title: '🛡️ Phantom Guard Dashboard',
          description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
          color: 0x7289DA,
          fields: [
            {
              name: '🔒 Security Settings',
              value: `Adjust anti-nuke, verification, and raid protection settings`
            },
            {
              name: '🔔 Notification Settings',
              value: `Configure welcome messages, announcements, and log channels`
            },
            {
              name: '🎮 Game & Entertainment',
              value: `Control game features and entertainment options`
            },
            {
              name: '📊 Server Statistics',
              value: `View activity, verification, and security stats`
            }
          ],
          footer: {
            text: 'Select an option from the dropdown menu below'
          }
        };
        
        // Create dashboard menu components
        const dashboardRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('dashboard_menu')
              .setPlaceholder('Select a dashboard option')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('Security Settings')
                  .setDescription('Configure anti-nuke, verification, and raid protection')
                  .setValue('security')
                  .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Notification Settings')
                  .setDescription('Set up welcome messages, logs, and announcements')
                  .setValue('notifications')
                  .setEmoji('🔔'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('YouTube Verification')
                  .setDescription('Configure YouTube verification system and image verification')
                  .setValue('youtube')
                  .setEmoji('📱'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Voice & Counters')
                  .setDescription('Set up voice features and live subscriber counters')
                  .setValue('voice')
                  .setEmoji('🎤'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Game Settings')
                  .setDescription('Manage game features and entertainment options')
                  .setValue('games')
                  .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Server Statistics')
                  .setDescription('View activity and security stats')
                  .setValue('stats')
                  .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Help & Info')
                  .setDescription('Get help and detailed command information')
                  .setValue('help')
                  .setEmoji('❓')
              ])
          );
        
        // Update the message with main dashboard
        try {
          await i.message.edit({
            embeds: [dashboardEmbed],
            components: [dashboardRow]
          });
        } catch (error) {
          console.error('Error returning to main dashboard:', error);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error handling voice button:', error);
      try {
        if (!i.replied) {
          await i.followUp({ 
            content: '❌ An error occurred processing your request. Please try again.', 
            ephemeral: true 
          }).catch(err => console.error('[Dashboard] Failed to send error message:', err));
        }
      } catch (followUpError) {
        console.error('[Dashboard] Failed to handle error recovery:', followUpError);
      }
    }
  });
}

async function handleSecuritySettings(interaction, guild, serverConfig, client) {
  // Get current security settings
  const antiNukeEnabled = serverConfig.antiNuke || false;
  const antiNukeThreshold = serverConfig.antiNukeThreshold || 3;
  const verificationRequired = serverConfig.verificationRequired || false;
  const autoModeration = serverConfig.autoModeration || false;
  const punishmentType = serverConfig.punishmentType || 'ban';
  const whitelistedRoles = serverConfig.whitelistedRoles || [];
  
  // Format whitelisted roles
  const whitelistedRolesStr = whitelistedRoles.length > 0 
    ? whitelistedRoles.map(r => `<@&${r}>`).join(', ') 
    : 'None';
  
  // Create security settings embed
  const securityEmbed = {
    title: '🔒 Security Settings',
    description: `Manage security settings for ${guild.name}`,
    color: 0x2ECC71, // Green
    fields: [
      {
        name: '🛡️ Anti-Nuke Protection',
        value: `Status: ${antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Threshold: ${antiNukeThreshold} actions`
      },
      {
        name: '✅ Verification Required',
        value: `Status: ${verificationRequired ? '✅ Enabled' : '❌ Disabled'}\n` +
               `New members must verify before accessing the server`
      },
      {
        name: '🤖 Auto-Moderation',
        value: `Status: ${autoModeration ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Automatically removes spam, invites, and harmful content`
      },
      {
        name: '⚠️ Punishment Type',
        value: `Current setting: \`${punishmentType}\`\n` +
               `Options: ban, kick, timeout`
      },
      {
        name: '👑 Whitelisted Roles',
        value: `These roles are exempt from security measures:\n${whitelistedRolesStr}`
      }
    ],
    footer: {
      text: 'Use the buttons below to manage settings'
    }
  };
  
  // Create buttons for security settings
  const securityRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_antinuke')
        .setLabel(`${antiNukeEnabled ? 'Disable' : 'Enable'} Anti-Nuke`)
        .setStyle(antiNukeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_verification')
        .setLabel(`${verificationRequired ? 'Disable' : 'Enable'} Verification`)
        .setStyle(verificationRequired ? ButtonStyle.Danger : ButtonStyle.Success)
    );
  
  const moderationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_automod')
        .setLabel(`${autoModeration ? 'Disable' : 'Enable'} Auto-Mod`)
        .setStyle(autoModeration ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('set_punishment')
        .setLabel('Change Punishment Type')
        .setStyle(ButtonStyle.Primary)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('manage_whitelist')
        .setLabel('Manage Whitelisted Roles')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with security settings
  await interaction.message.edit({
    embeds: [securityEmbed],
    components: [securityRow, moderationRow, backRow]
  });
  
  // Set up collector for security buttons
  const filter = i => i.user.id === interaction.user.id;
  const securityCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  securityCollector.on('collect', async i => {
    try {
      await i.deferUpdate().catch(err => {
        console.error(`[Dashboard] Failed to defer security button interaction: ${err}`);
      });
      
      // Handle button interactions
      if (i.customId === 'toggle_antinuke') {
        const newValue = !serverConfig.antiNuke;
        config.updateServerConfig(guild.id, { antiNuke: newValue });
        
        // Create updated button with new state
        const updatedSecurityRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('toggle_antinuke')
              .setLabel(`${newValue ? 'Disable' : 'Enable'} Anti-Nuke`)
              .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
            ButtonBuilder.from(securityRow.components[1])
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...securityEmbed };
        updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `Threshold: ${antiNukeThreshold} actions`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [updatedSecurityRow, moderationRow, backRow]
          });
        } catch (error) {
          console.error('Error updating message after toggling anti-nuke:', error);
        }
      }
      else if (i.customId === 'toggle_verification') {
        const newValue = !serverConfig.verificationRequired;
        config.updateServerConfig(guild.id, { verificationRequired: newValue });
        
        // Create updated button with new state
        const updatedSecurityRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(securityRow.components[0]),
            new ButtonBuilder()
              .setCustomId('toggle_verification')
              .setLabel(`${newValue ? 'Disable' : 'Enable'} Verification`)
              .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success)
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...securityEmbed };
        updatedEmbed.fields[1].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `New members must verify before accessing the server`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [updatedSecurityRow, moderationRow, backRow]
          });
        } catch (error) {
          console.error('Error updating message after toggling verification:', error);
        }
      }
      else if (i.customId === 'toggle_automod') {
        const newValue = !serverConfig.autoModeration;
        config.updateServerConfig(guild.id, { autoModeration: newValue });
        
        // Create updated button with new state
        const updatedModerationRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('toggle_automod')
              .setLabel(`${newValue ? 'Disable' : 'Enable'} Auto-Mod`)
              .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
            ButtonBuilder.from(moderationRow.components[1])
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...securityEmbed };
        updatedEmbed.fields[2].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `Automatically removes spam, invites, and harmful content`;
        
        // Update the message
        try {
          await i.message.edit({
            embeds: [updatedEmbed],
            components: [securityRow, updatedModerationRow, backRow]
          });
        } catch (error) {
          console.error('Error updating message after toggling auto-mod:', error);
        }
      }
      else if (i.customId === 'set_punishment') {
        // Create punishment type selection options
        const punishmentEmbed = new EmbedBuilder()
          .setTitle('⚠️ Select Punishment Type')
          .setDescription('Choose what action should be taken when security violations are detected:')
          .setColor(0xE74C3C)
          .addFields(
            {
              name: '🔨 Ban',
              value: 'Permanently removes the user from the server'
            },
            {
              name: '👢 Kick',
              value: 'Removes the user, but they can rejoin with an invite'
            },
            {
              name: '⏱️ Timeout',
              value: 'Temporarily mutes the user for a set period'
            }
          );
        
        const punishmentRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('punishment_ban')
              .setLabel('Ban')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('punishment_kick')
              .setLabel('Kick')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('punishment_timeout')
              .setLabel('Timeout')
              .setStyle(ButtonStyle.Secondary)
          );
        
        // Show punishment selection as followup
        await i.followUp({
          embeds: [punishmentEmbed],
          components: [punishmentRow],
          ephemeral: true
        });
        
        // Set up collector for punishment type selection
        const punishmentFilter = i => i.user.id === interaction.user.id && i.customId.startsWith('punishment_');
        const punishmentCollector = i.channel.createMessageComponentCollector({
          filter: punishmentFilter,
          time: 60000, // 1 minute
          max: 1 // Only collect one response
        });
        
        punishmentCollector.on('collect', async i => {
          try {
            await i.deferUpdate();
            
            // Get selected punishment type
            const punishmentType = i.customId.replace('punishment_', '');
            config.updateServerConfig(guild.id, { punishmentType });
            
            // Create updated embed with new values
            const updatedEmbed = { ...securityEmbed };
            updatedEmbed.fields[3].value = `Current setting: \`${punishmentType}\`\n` +
                     `Options: ban, kick, timeout`;
            
            // Update the main message
            try {
              await interaction.message.edit({
                embeds: [updatedEmbed],
                components: [securityRow, moderationRow, backRow]
              });
              
              // Confirm selection
              await i.editReply({
                content: `✅ Punishment type set to: \`${punishmentType}\``,
                embeds: [],
                components: []
              });
            } catch (error) {
              console.error('Error updating message after changing punishment type:', error);
            }
          } catch (error) {
            console.error('Error handling punishment selection:', error);
          }
        });
      }
      else if (i.customId === 'manage_whitelist') {
        // Show warning about using the command
        await i.followUp({
          content: '⚠️ To manage whitelisted roles, please use the `/whitelist add @role` or `/whitelist remove @role` command.',
          ephemeral: true
        });
      }
      else if (i.customId === 'back_to_dashboard') {
        // Go back to main dashboard
        securityCollector.stop();
        
        // Recreate main dashboard embed with updated menu
        const dashboardEmbed = {
          title: '🛡️ Phantom Guard Dashboard',
          description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
          color: 0x7289DA,
          fields: [
            {
              name: '🔒 Security Settings',
              value: `Adjust anti-nuke, verification, and raid protection settings`
            },
            {
              name: '🔔 Notification Settings',
              value: `Configure welcome messages, announcements, and log channels`
            },
            {
              name: '🎮 Game & Entertainment',
              value: `Control game features and entertainment options`
            },
            {
              name: '📊 Server Statistics',
              value: `View activity, verification, and security stats`
            }
          ],
          footer: {
            text: 'Select an option from the dropdown menu below'
          }
        };
        
        // Create dashboard menu components
        const dashboardRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('dashboard_menu')
              .setPlaceholder('Select a dashboard option')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('Security Settings')
                  .setDescription('Configure anti-nuke, verification, and raid protection')
                  .setValue('security')
                  .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Notification Settings')
                  .setDescription('Set up welcome messages, logs, and announcements')
                  .setValue('notifications')
                  .setEmoji('🔔'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('YouTube Verification')
                  .setDescription('Configure YouTube verification system and image verification')
                  .setValue('youtube')
                  .setEmoji('📱'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Voice & Counters')
                  .setDescription('Set up voice features and live subscriber counters')
                  .setValue('voice')
                  .setEmoji('🎤'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Game Settings')
                  .setDescription('Manage game features and entertainment options')
                  .setValue('games')
                  .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Server Statistics')
                  .setDescription('View activity and security stats')
                  .setValue('stats')
                  .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Help & Info')
                  .setDescription('Get help and detailed command information')
                  .setValue('help')
                  .setEmoji('❓')
              ])
          );
        
        // Update the message with main dashboard
        try {
          await i.message.edit({
            embeds: [dashboardEmbed],
            components: [dashboardRow]
          });
        } catch (error) {
          console.error('Error returning to main dashboard:', error);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error handling security button:', error);
      try {
        if (!i.replied) {
          await i.followUp({ 
            content: '❌ An error occurred processing your request. Please try again.', 
            ephemeral: true 
          }).catch(err => console.error('[Dashboard] Failed to send error message:', err));
        }
      } catch (followUpError) {
        console.error('[Dashboard] Failed to handle error recovery:', followUpError);
      }
    }
  });
}

async function handleNotificationSettings(interaction, guild, serverConfig, client) {
  // TODO: Implement notification settings handler
  await interaction.followUp({
    content: 'Notification settings are not yet implemented. Use `/setlogs`, `/setwelcome`, or `/setannouncer` commands.',
    ephemeral: true
  });
  
  // Return to main dashboard
  await handleHelpInfo(interaction, guild, serverConfig, client);
}

async function handleGameSettings(interaction, guild, serverConfig, client) {
  // TODO: Implement game settings handler
  await interaction.followUp({
    content: 'Game settings are not yet implemented. Use `/game` command to manage games.',
    ephemeral: true
  });
  
  // Return to main dashboard
  await handleHelpInfo(interaction, guild, serverConfig, client);
}

async function handleStatsView(interaction, guild, serverConfig, client) {
  // Get server stats
  const memberCount = guild.memberCount;
  const botCount = guild.members.cache.filter(member => member.user.bot).size;
  const humanCount = memberCount - botCount;
  const channelCount = guild.channels.cache.size;
  const roleCount = guild.roles.cache.size;
  const emojiCount = guild.emojis.cache.size;
  const verifiedCount = serverConfig.verifiedUsers?.length || 0;
  const securityIncidentsCount = serverConfig.securityIncidents?.length || 0;
  
  // Create stats embed
  const statsEmbed = new EmbedBuilder()
    .setTitle(`📊 Server Statistics: ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setColor(0x3498DB)
    .addFields(
      {
        name: '👥 Member Count',
        value: `Total: ${memberCount}\nHumans: ${humanCount}\nBots: ${botCount}`,
        inline: true
      },
      {
        name: '🏗️ Server Structure',
        value: `Channels: ${channelCount}\nRoles: ${roleCount}\nEmojis: ${emojiCount}`,
        inline: true
      },
      {
        name: '✅ Verification',
        value: `Verified Members: ${verifiedCount}`,
        inline: true
      },
      {
        name: '🛡️ Security',
        value: `Incidents Detected: ${securityIncidentsCount}`,
        inline: true
      },
      {
        name: '⏱️ Bot Uptime',
        value: getUptimeString(client),
        inline: true
      }
    )
    .setFooter({ text: 'Stats refreshed at ' + new Date().toLocaleString() });
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_stats')
        .setLabel('Refresh Stats')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  await interaction.message.edit({
    embeds: [statsEmbed],
    components: [backRow]
  });
  
  // Set up collector for stats buttons
  const filter = i => i.user.id === interaction.user.id;
  const statsCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  statsCollector.on('collect', async i => {
    try {
      await i.deferUpdate().catch(err => {
        console.error(`[Dashboard] Failed to defer stats button interaction: ${err}`);
      });
      
      if (i.customId === 'refresh_stats') {
        // Refresh stats and update embed
        await handleStatsView(i, guild, config.getServerConfig(guild.id), client);
      }
      else if (i.customId === 'back_to_dashboard') {
        // Go back to main dashboard
        statsCollector.stop();
        
        // Recreate main dashboard embed with updated menu
        const dashboardEmbed = {
          title: '🛡️ Phantom Guard Dashboard',
          description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
          color: 0x7289DA,
          fields: [
            {
              name: '🔒 Security Settings',
              value: `Adjust anti-nuke, verification, and raid protection settings`
            },
            {
              name: '🔔 Notification Settings',
              value: `Configure welcome messages, announcements, and log channels`
            },
            {
              name: '🎮 Game & Entertainment',
              value: `Control game features and entertainment options`
            },
            {
              name: '📊 Server Statistics',
              value: `View activity, verification, and security stats`
            }
          ],
          footer: {
            text: 'Select an option from the dropdown menu below'
          }
        };
        
        // Create dashboard menu components
        const dashboardRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('dashboard_menu')
              .setPlaceholder('Select a dashboard option')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('Security Settings')
                  .setDescription('Configure anti-nuke, verification, and raid protection')
                  .setValue('security')
                  .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Notification Settings')
                  .setDescription('Set up welcome messages, logs, and announcements')
                  .setValue('notifications')
                  .setEmoji('🔔'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('YouTube Verification')
                  .setDescription('Configure YouTube verification system and image verification')
                  .setValue('youtube')
                  .setEmoji('📱'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Voice & Counters')
                  .setDescription('Set up voice features and live subscriber counters')
                  .setValue('voice')
                  .setEmoji('🎤'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Game Settings')
                  .setDescription('Manage game features and entertainment options')
                  .setValue('games')
                  .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Server Statistics')
                  .setDescription('View activity and security stats')
                  .setValue('stats')
                  .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Help & Info')
                  .setDescription('Get help and detailed command information')
                  .setValue('help')
                  .setEmoji('❓')
              ])
          );
        
        // Update the message with main dashboard
        await i.message.edit({
          embeds: [dashboardEmbed],
          components: [dashboardRow]
        });
      }
    } catch (error) {
      console.error('[Dashboard] Error handling stats button:', error);
      try {
        await i.followUp({ 
          content: '❌ An error occurred processing your request. Please try again.', 
          ephemeral: true 
        });
      } catch (followUpError) {
        console.error('[Dashboard] Failed to handle error recovery:', followUpError);
      }
    }
  });
}

async function handleHelpInfo(interaction, guild, serverConfig, client) {
  // Create help embed
  const helpEmbed = new EmbedBuilder()
    .setTitle('❓ Phantom Guard Help & Information')
    .setDescription('Welcome to the Phantom Guard dashboard help section. Here are some common commands and their usage:')
    .setColor(0xF1C40F)
    .addFields(
      {
        name: '🔒 Security Commands',
        value: '`/security` - Configure security settings\n' +
               '`/whitelist` - Manage whitelisted roles and users\n' +
               '`/setupverification` - Set up verification system'
      },
      {
        name: '📱 YouTube Commands',
        value: '`/setyoutubechannel` - Set the YouTube channel for verification\n' +
               '`/searchchannel` - Search for a YouTube channel\n' +
               '`/setverificationchannel` - Set the verification channel'
      },
      {
        name: '🎤 Voice Commands',
        value: '`/setvoicechannelname` - Set up live subscriber counter\n' +
               '`/setupdatefrequency` - Change update frequency\n' +
               '`/voice` - Voice channel management'
      },
      {
        name: '🎮 Game Commands',
        value: '`/game` - Access mini-games and entertainment'
      },
      {
        name: '📊 Stats Commands',
        value: '`/info` - View bot information\n' +
               '`/premium` - View premium features'
      }
    )
    .setFooter({ text: 'For more information on any command, use /help <command>' });
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  await interaction.message.edit({
    embeds: [helpEmbed],
    components: [backRow]
  });
  
  // Set up collector for help buttons
  const filter = i => i.user.id === interaction.user.id;
  const helpCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  helpCollector.on('collect', async i => {
    try {
      await i.deferUpdate().catch(err => {
        console.error(`[Dashboard] Failed to defer help button interaction: ${err}`);
      });
      
      if (i.customId === 'back_to_dashboard') {
        // Go back to main dashboard
        helpCollector.stop();
        
        // Recreate main dashboard embed with updated menu
        const dashboardEmbed = {
          title: '🛡️ Phantom Guard Dashboard',
          description: `Welcome to the in-Discord dashboard! Use the menu below to manage your server settings.`,
          color: 0x7289DA,
          fields: [
            {
              name: '🔒 Security Settings',
              value: `Adjust anti-nuke, verification, and raid protection settings`
            },
            {
              name: '🔔 Notification Settings',
              value: `Configure welcome messages, announcements, and log channels`
            },
            {
              name: '🎮 Game & Entertainment',
              value: `Control game features and entertainment options`
            },
            {
              name: '📊 Server Statistics',
              value: `View activity, verification, and security stats`
            }
          ],
          footer: {
            text: 'Select an option from the dropdown menu below'
          }
        };
        
        // Create dashboard menu components
        const dashboardRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('dashboard_menu')
              .setPlaceholder('Select a dashboard option')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('Security Settings')
                  .setDescription('Configure anti-nuke, verification, and raid protection')
                  .setValue('security')
                  .setEmoji('🔒'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Notification Settings')
                  .setDescription('Set up welcome messages, logs, and announcements')
                  .setValue('notifications')
                  .setEmoji('🔔'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('YouTube Verification')
                  .setDescription('Configure YouTube verification system and image verification')
                  .setValue('youtube')
                  .setEmoji('📱'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Voice & Counters')
                  .setDescription('Set up voice features and live subscriber counters')
                  .setValue('voice')
                  .setEmoji('🎤'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Game Settings')
                  .setDescription('Manage game features and entertainment options')
                  .setValue('games')
                  .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Server Statistics')
                  .setDescription('View activity and security stats')
                  .setValue('stats')
                  .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Help & Info')
                  .setDescription('Get help and detailed command information')
                  .setValue('help')
                  .setEmoji('❓')
              ])
          );
        
        // Update the message with main dashboard
        await i.message.edit({
          embeds: [dashboardEmbed],
          components: [dashboardRow]
        });
      }
    } catch (error) {
      console.error('[Dashboard] Error handling help button:', error);
      try {
        await i.followUp({ 
          content: '❌ An error occurred processing your request. Please try again.', 
          ephemeral: true 
        });
      } catch (followUpError) {
        console.error('[Dashboard] Failed to handle error recovery:', followUpError);
      }
    }
  });
}

// Helper function to format uptime string
function getUptimeString(client) {
  const uptime = client.uptime;
  const days = Math.floor(uptime / 86400000);
  const hours = Math.floor((uptime % 86400000) / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  
  let uptimeString = '';
  if (days > 0) uptimeString += `${days}d `;
  if (hours > 0) uptimeString += `${hours}h `;
  uptimeString += `${minutes}m`;
  
  return uptimeString;
}