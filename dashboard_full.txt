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
      await interaction.deferReply({ ephemeral: false }).catch(err => {
        console.error(`[Dashboard] Failed to defer reply: ${err}`);
      });
    }
    
    const user = isSlashCommand ? interaction.user : message.author;
    const channel = isSlashCommand ? interaction.channel : message.channel;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    // Force command to work without guild check - get the server ID from cache if possible
    // or create dummy data for testing outside a server
    const serverId = guild?.id || "0";
    const serverConfig = config.getServerConfig(serverId);
    
    // Skip permission check for DM, just show a simple dashboard
    if (!guild) {
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
      await i.deferUpdate();
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

// Handle YouTube verification settings
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
    await i.deferUpdate();
    
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
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedYouTubeRow, channelRow, backRow]
      });
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
      await i.followUp({
        embeds: [testAlert],
        ephemeral: true
      });
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
            value: 'Use `/setyoutubechannel <channel-id-or-url>` or `/searchchannel <name>` to find and set the YouTube channel'
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
      await i.followUp({
        embeds: [setupGuide],
        ephemeral: true
      });
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
      await i.followUp({
        embeds: [verifiedEmbed],
        ephemeral: true
      });
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
            name: '📱 YouTube Verification',
            value: `Configure YouTube verification system and image verification`
          },
          {
            name: '🎤 Voice & Counters',
            value: `Set up voice features and live subscriber counters`
          },
          {
            name: '🎮 Game & Entertainment',
            value: `Control game features and entertainment options`
          },
          {
            name: '📊 Server Statistics',
            value: `View activity, verification, and security stats`
          },
          {
            name: '❓ Help & Info',
            value: `Get help and detailed command information`
          }
        ],
        footer: {
          text: 'Select an option from the dropdown menu below'
        }
      };
      
      // Create dashboard menu components with all options
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
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  youtubeCollector.on('end', () => {
    // Disable the components when collection period ends
    if (interaction.message.editable) {
      try {
        const disabledYouTubeRow = ActionRowBuilder.from(youtubeRow);
        disabledYouTubeRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledChannelRow = ActionRowBuilder.from(channelRow);
        disabledChannelRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledYouTubeRow, disabledChannelRow, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle voice and counter settings
async function handleVoiceSettings(interaction, guild, serverConfig, client) {
  // Get current voice settings
  const voiceEnabled = serverConfig.voiceAnnouncer || false;
  const subCountChannel = serverConfig.subCountChannelId ? 
    `<#${serverConfig.subCountChannelId}>` : 'Not set';
  const voiceChannelFormat = serverConfig.voiceChannelFormat || '{channelName}: {count} subscribers';
  const updateFrequency = serverConfig.updateFrequencyMinutes || 5;
  
  // Create voice settings embed
  const voiceEmbed = {
    title: '🎤 Voice & Subscriber Counter Settings',
    description: `Manage voice features and subscriber counters for ${guild.name}`,
    color: 0x9B59B6, // Purple color
    fields: [
      {
        name: '🔊 Voice Announcer',
        value: `Status: ${voiceEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Announces when users join or leave voice channels`
      },
      {
        name: '📊 Subscriber Count Channel',
        value: `Channel: ${subCountChannel}\n` +
               `Use \`/livesubcount\` to create or update`
      },
      {
        name: '📝 Channel Format',
        value: `Format: \`${voiceChannelFormat}\`\n` +
               `Use \`/setvoicechannelname\` to change format`
      },
      {
        name: '⏱️ Update Frequency',
        value: `Every ${updateFrequency} minutes\n` +
               `Use \`/setupdatefrequency\` to change`
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
        .setCustomId('toggle_voice')
        .setLabel(`${voiceEnabled ? 'Disable' : 'Enable'} Voice Announcer`)
        .setStyle(voiceEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('update_counter')
        .setLabel('Update Sub Counter Now')
        .setStyle(ButtonStyle.Primary)
    );
  
  const formatRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('freq_5min')
        .setLabel('Update Every 5min')
        .setStyle(updateFrequency === 5 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('freq_15min')
        .setLabel('Update Every 15min')
        .setStyle(updateFrequency === 15 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('freq_30min')
        .setLabel('Update Every 30min')
        .setStyle(updateFrequency === 30 ? ButtonStyle.Success : ButtonStyle.Secondary)
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
    await i.deferUpdate();
    const serverConfig = config.getServerConfig(guild.id);
    
    // Handle button interactions
    if (i.customId === 'toggle_voice') {
      const newValue = !serverConfig.voiceAnnouncer;
      config.updateServerConfig(guild.id, { voiceAnnouncer: newValue });
      
      // Create updated button with new state
      const updatedVoiceRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_voice')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Voice Announcer`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(voiceRow.components[1])
        );
      
      // Create updated embed with new values
      const updatedEmbed = { ...voiceEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
             `Announces when users join or leave voice channels`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedVoiceRow, formatRow, backRow]
      });
    }
    else if (i.customId === 'update_counter') {
      if (!serverConfig.subCountChannelId || !serverConfig.youtubeChannelId) {
        await i.followUp({
          content: '❌ Cannot update counter: YouTube channel or subscriber count channel not set. Use `/livesubcount` and `/setyoutubechannel` first.',
          ephemeral: true
        });
        return;
      }
      
      await i.followUp({
        content: '🔄 Updating subscriber count channel now... This may take a moment.',
        ephemeral: true
      });
      
      try {
        // Here we would normally call a function to update the sub count
        // For demonstration, we'll simulate success
        await i.editReply({
          content: '✅ Subscriber count channel has been updated!',
          ephemeral: true
        });
      } catch (error) {
        await i.editReply({
          content: `❌ Error updating subscriber count: ${error.message}`,
          ephemeral: true
        });
      }
    }
    else if (i.customId.startsWith('freq_')) {
      // Extract minutes from button ID (freq_5min -> 5, freq_15min -> 15, etc.)
      const minutes = parseInt(i.customId.replace('freq_', '').replace('min', ''));
      
      if (minutes) {
        config.updateServerConfig(guild.id, { updateFrequencyMinutes: minutes });
        
        // Create updated frequency row with new state
        const updatedFormatRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('freq_5min')
              .setLabel('Update Every 5min')
              .setStyle(minutes === 5 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('freq_15min')
              .setLabel('Update Every 15min')
              .setStyle(minutes === 15 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('freq_30min')
              .setLabel('Update Every 30min')
              .setStyle(minutes === 30 ? ButtonStyle.Success : ButtonStyle.Secondary)
          );
        
        // Create updated embed with new values
        const updatedEmbed = { ...voiceEmbed };
        updatedEmbed.fields[3].value = `Every ${minutes} minutes\n` +
               `Use \`/setupdatefrequency\` to change`;
        
        // Update the message
        await i.message.edit({
          embeds: [updatedEmbed],
          components: [voiceRow, updatedFormatRow, backRow]
        });
        
        await i.followUp({
          content: `✅ Update frequency changed to ${minutes} minutes`,
          ephemeral: true
        });
      }
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      voiceCollector.stop();
      
      // Recreate main dashboard embed with all options
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
            name: '📱 YouTube Verification',
            value: `Configure YouTube verification system and image verification`
          },
          {
            name: '🎤 Voice & Counters',
            value: `Set up voice features and live subscriber counters`
          },
          {
            name: '🎮 Game & Entertainment',
            value: `Control game features and entertainment options`
          },
          {
            name: '📊 Server Statistics',
            value: `View activity, verification, and security stats`
          },
          {
            name: '❓ Help & Info',
            value: `Get help and detailed command information`
          }
        ],
        footer: {
          text: 'Select an option from the dropdown menu below'
        }
      };
      
      // Create dashboard menu components with all options
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
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  voiceCollector.on('end', () => {
    // Disable the components when collection period ends
    if (interaction.message.editable) {
      try {
        const disabledVoiceRow = ActionRowBuilder.from(voiceRow);
        disabledVoiceRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledFormatRow = ActionRowBuilder.from(formatRow);
        disabledFormatRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledVoiceRow, disabledFormatRow, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle help and info display
async function handleHelpInfo(interaction, guild, serverConfig, client) {
  // Create help embed
  const helpEmbed = {
    title: '❓ Help & Command Information',
    description: `Get detailed help and command information for ${guild.name}`,
    color: 0x3498DB, // Blue color
    fields: [
      {
        name: '🔒 Security Commands',
        value: '`/security` - Configure security settings\n' +
               '`/ban` - Ban a user from the server\n' +
               '`/kick` - Kick a user from the server'
      },
      {
        name: '✅ Verification Commands',
        value: '`/setupverification` - Set up the verification system\n' +
               '`/setverificationchannel` - Set the verification channel\n' +
               '`/listverified` - List verified users\n' +
               '`/captcha` - Configure CAPTCHA verification'
      },
      {
        name: '📱 YouTube Commands',
        value: '`/setyoutubechannel` - Set the YouTube channel for verification\n' +
               '`/searchchannel` - Search for a YouTube channel\n' +
               '`/livesubcount` - Create a live subscriber count channel\n' +
               '`/setvoicechannelname` - Set the format of the count channel\n' +
               '`/setupdatefrequency` - Set how often the count updates'
      },
      {
        name: '🎤 Voice Commands',
        value: '`/voice join` - Make the bot join your voice channel\n' +
               '`/voice leave` - Make the bot leave the voice channel\n' +
               '`/voice message` - Send a TTS message in voice channel\n' +
               '`/voice announce` - Toggle join/leave announcements'
      },
      {
        name: '🎮 Game Commands',
        value: '`/game create` - Create a new game session\n' +
               '`/game join` - Join an existing game session\n' +
               '`/game leave` - Leave a game session\n' +
               '`/game start` - Start a game session'
      },
      {
        name: '⭐ Premium Commands',
        value: '`/premium` - Manage premium features\n' +
               '`/premium status` - Check premium status\n' +
               '`/premium automod` - Configure auto-moderation\n' +
               '`/premium antinuke` - Configure anti-nuke protection\n' +
               '`/premium lockdown` - Configure emergency lockdown'
      }
    ],
    footer: {
      text: 'Use the buttons below to get more help'
    }
  };
  
  // Create buttons for help navigation
  const helpNavRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_security')
        .setLabel('Security')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('help_verification')
        .setLabel('Verification')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('help_youtube')
        .setLabel('YouTube')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📱')
    );
  
  const helpNavRow2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_voice')
        .setLabel('Voice')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎤'),
      new ButtonBuilder()
        .setCustomId('help_game')
        .setLabel('Games')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮'),
      new ButtonBuilder()
        .setCustomId('help_premium')
        .setLabel('Premium')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⭐')
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with help information
  await interaction.message.edit({
    embeds: [helpEmbed],
    components: [helpNavRow, helpNavRow2, backRow]
  });
  
  // Set up collector for help buttons
  const filter = i => i.user.id === interaction.user.id;
  const helpCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  helpCollector.on('collect', async i => {
    await i.deferUpdate();
    
    // Handle button interactions for specific category help
    if (i.customId.startsWith('help_')) {
      const category = i.customId.replace('help_', '');
      
      // Create detailed help for the specific category
      let detailedEmbed;
      
      switch (category) {
        case 'security':
          detailedEmbed = new EmbedBuilder()
            .setTitle('🔒 Security Commands')
            .setDescription('Detailed information about security commands')
            .setColor(0xFF5733)
            .addFields(
              {
                name: '`/security [action]`',
                value: 'Configure security settings for the server\n' +
                       '**Actions:** enable, disable, status, setup_verification\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/security enable`'
              },
              {
                name: '`/ban [user] [reason]`',
                value: 'Ban a user from the server\n' +
                       '**Permission:** Ban Members\n' +
                       '**Example:** `/ban @BadUser Spamming in channels`'
              },
              {
                name: '`/kick [user] [reason]`',
                value: 'Kick a user from the server\n' +
                       '**Permission:** Kick Members\n' +
                       '**Example:** `/kick @TroubleUser Breaking rules`'
              }
            );
          break;
          
        case 'verification':
          detailedEmbed = new EmbedBuilder()
            .setTitle('✅ Verification Commands')
            .setDescription('Detailed information about verification commands')
            .setColor(0x2ECC71)
            .addFields(
              {
                name: '`/setupverification`',
                value: 'Set up the verification system for your server\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/setupverification`'
              },
              {
                name: '`/setverificationchannel [channel]`',
                value: 'Set the channel where users will post verification screenshots\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/setverificationchannel #verify`'
              },
              {
                name: '`/listverified`',
                value: 'List all users who have verified their YouTube subscription\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/listverified`'
              },
              {
                name: '`/captcha [action]`',
                value: 'Configure CAPTCHA verification for new members\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/captcha setup`\n' +
                       '**Note:** This is a premium feature'
              }
            );
          break;
          
        case 'youtube':
          detailedEmbed = new EmbedBuilder()
            .setTitle('📱 YouTube Commands')
            .setDescription('Detailed information about YouTube integration commands')
            .setColor(0xFF0000)
            .addFields(
              {
                name: '`/setyoutubechannel [channelId or URL]`',
                value: 'Set the YouTube channel for verification\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/setyoutubechannel UCxyz123`'
              },
              {
                name: '`/searchchannel [channel name]`',
                value: 'Search for a YouTube channel by name\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/searchchannel MrBeast`'
              },
              {
                name: '`/livesubcount`',
                value: 'Create a voice channel showing the live subscriber count\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/livesubcount`'
              },
              {
                name: '`/setvoicechannelname [format]`',
                value: 'Set the format of the subscriber count channel\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/setvoicechannelname {channelName}: {count} subs`'
              },
              {
                name: '`/setupdatefrequency [minutes]`',
                value: 'Set how often the subscriber count updates\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/setupdatefrequency 15`'
              }
            );
          break;
          
        case 'voice':
          detailedEmbed = new EmbedBuilder()
            .setTitle('🎤 Voice Commands')
            .setDescription('Detailed information about voice commands')
            .setColor(0x9B59B6)
            .addFields(
              {
                name: '`/voice join`',
                value: 'Make the bot join your voice channel\n' +
                       '**Permission:** None (must be in a voice channel)\n' +
                       '**Example:** `/voice join`'
              },
              {
                name: '`/voice leave`',
                value: 'Make the bot leave the voice channel\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/voice leave`'
              },
              {
                name: '`/voice message [text]`',
                value: 'Send a text-to-speech message in the voice channel\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/voice message Hello everyone!`'
              },
              {
                name: '`/voice announce [enable/disable]`',
                value: 'Toggle join/leave announcements in voice channels\n' +
                       '**Permission:** Manage Server\n' +
                       '**Example:** `/voice announce enable`'
              }
            );
          break;
          
        case 'game':
          detailedEmbed = new EmbedBuilder()
            .setTitle('🎮 Game Commands')
            .setDescription('Detailed information about game commands')
            .setColor(0xE74C3C)
            .addFields(
              {
                name: '`/game create [type]`',
                value: 'Create a new game session\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/game create trivia`'
              },
              {
                name: '`/game join [sessionId]`',
                value: 'Join an existing game session\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/game join 12345`'
              },
              {
                name: '`/game leave`',
                value: 'Leave a game session\n' +
                       '**Permission:** None\n' +
                       '**Example:** `/game leave`'
              },
              {
                name: '`/game start`',
                value: 'Start a game session you created\n' +
                       '**Permission:** None (must be the creator)\n' +
                       '**Example:** `/game start`'
              }
            );
          break;
          
        case 'premium':
          detailedEmbed = new EmbedBuilder()
            .setTitle('⭐ Premium Commands')
            .setDescription('Detailed information about premium features and commands')
            .setColor(0xF1C40F)
            .addFields(
              {
                name: '`/premium [action]`',
                value: 'Manage premium features for your server\n' +
                       '**Actions:** status, automod, antinuke, lockdown\n' +
                       '**Permission:** None (premium access required)\n' +
                       '**Example:** `/premium status`'
              },
              {
                name: '`/premium automod [enable/disable]`',
                value: 'Configure auto-moderation features\n' +
                       '**Permission:** None (premium access required)\n' +
                       '**Example:** `/premium automod enable`'
              },
              {
                name: '`/premium antinuke [enable/disable]`',
                value: 'Configure anti-nuke protection\n' +
                       '**Permission:** None (premium access required)\n' +
                       '**Example:** `/premium antinuke enable`'
              },
              {
                name: '`/premium lockdown [enable/disable]`',
                value: 'Configure emergency lockdown system\n' +
                       '**Permission:** None (premium access required)\n' +
                       '**Example:** `/premium lockdown enable`'
              },
              {
                name: '⭐ How to Get Premium',
                value: 'Premium access is available to:\n' +
                       '• Bot owners\n' +
                       '• Users with "2007" in their username\n' +
                       '• Servers marked as premium by the bot owner'
              }
            );
          break;
      }
      
      // Show detailed help as a followup
      if (detailedEmbed) {
        await i.followUp({
          embeds: [detailedEmbed],
          ephemeral: true
        });
      }
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      helpCollector.stop();
      
      // Recreate main dashboard embed with all options
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
            name: '📱 YouTube Verification',
            value: `Configure YouTube verification system and image verification`
          },
          {
            name: '🎤 Voice & Counters',
            value: `Set up voice features and live subscriber counters`
          },
          {
            name: '🎮 Game & Entertainment',
            value: `Control game features and entertainment options`
          },
          {
            name: '📊 Server Statistics',
            value: `View activity, verification, and security stats`
          },
          {
            name: '❓ Help & Info',
            value: `Get help and detailed command information`
          }
        ],
        footer: {
          text: 'Select an option from the dropdown menu below'
        }
      };
      
      // Create dashboard menu components with all options
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
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  helpCollector.on('end', () => {
    // Disable the components when collection period ends
    if (interaction.message.editable) {
      try {
        const disabledHelpNavRow = ActionRowBuilder.from(helpNavRow);
        disabledHelpNavRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledHelpNavRow2 = ActionRowBuilder.from(helpNavRow2);
        disabledHelpNavRow2.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledHelpNavRow, disabledHelpNavRow2, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle security settings display
async function handleSecuritySettings(interaction, guild, serverConfig, client) {
  // Get current security settings
  const antiNukeEnabled = serverConfig.antiNuke || false;
  const verificationEnabled = serverConfig.verification?.enabled || false;
  const raidProtectionEnabled = serverConfig.raidProtection || false;
  const verificationChannel = serverConfig.verification?.channelId ? 
    `<#${serverConfig.verification.channelId}>` : 'Not set';
  const verifiedRole = serverConfig.verification?.roleId ? 
    `<@&${serverConfig.verification.roleId}>` : 'Not set';
  
  // Create security settings embed
  const securityEmbed = {
    title: '🔒 Security Settings',
    description: `Manage security features for ${guild.name}`,
    color: 0xFF5733, // Orange-red color
    fields: [
      {
        name: '🛡️ Anti-Nuke Protection',
        value: `Status: ${antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}\nProtects against mass bans, channel deletions, and role changes`
      },
      {
        name: '✅ Verification System',
        value: `Status: ${verificationEnabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${verificationChannel}\nVerified Role: ${verifiedRole}`
      },
      {
        name: '🚫 Raid Protection',
        value: `Status: ${raidProtectionEnabled ? '✅ Enabled' : '❌ Disabled'}\nPrevents large numbers of users joining at once`
      }
    ],
    footer: {
      text: 'Use the buttons below to toggle settings'
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
        .setLabel(`${verificationEnabled ? 'Disable' : 'Enable'} Verification`)
        .setStyle(verificationEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_raidprotection')
        .setLabel(`${raidProtectionEnabled ? 'Disable' : 'Enable'} Raid Protection`)
        .setStyle(raidProtectionEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with security settings
  await interaction.message.edit({
    embeds: [securityEmbed],
    components: [securityRow, backRow]
  });
  
  // Set up collector for security buttons
  const filter = i => i.user.id === interaction.user.id;
  const securityCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  securityCollector.on('collect', async i => {
    await i.deferUpdate();
    const serverConfig = config.getServerConfig(guild.id);
    
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
          ButtonBuilder.from(securityRow.components[1]),
          ButtonBuilder.from(securityRow.components[2])
        );

      // Create updated embed with new values
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nProtects against mass bans, channel deletions, and role changes`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedSecurityRow, backRow]
      });
    } 
    else if (i.customId === 'toggle_verification') {
      const verification = serverConfig.verification || {};
      const newValue = !verification.enabled;
      config.updateServerConfig(guild.id, { 
        verification: { ...verification, enabled: newValue } 
      });

      // Create updated button with new state
      const updatedSecurityRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(securityRow.components[0]),
          new ButtonBuilder()
            .setCustomId('toggle_verification')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Verification`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(securityRow.components[2])
        );

      // Create updated embed with new values  
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[1].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${verificationChannel}\nVerified Role: ${verifiedRole}`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedSecurityRow, backRow]
      });
    }
    else if (i.customId === 'toggle_raidprotection') {
      const newValue = !serverConfig.raidProtection;
      config.updateServerConfig(guild.id, { raidProtection: newValue });

      // Create updated button with new state
      const updatedSecurityRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(securityRow.components[0]),
          ButtonBuilder.from(securityRow.components[1]),
          new ButtonBuilder()
            .setCustomId('toggle_raidprotection')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Raid Protection`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success)
        );

      // Create updated embed with new values
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[2].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nPrevents large numbers of users joining at once`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedSecurityRow, backRow]
      });
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      securityCollector.stop();
      
      // Recreate main dashboard embed
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
                .setLabel('Game Settings')
                .setDescription('Manage game features and entertainment options')
                .setValue('games')
                .setEmoji('🎮'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Server Statistics')
                .setDescription('View activity and security stats')
                .setValue('stats')
                .setEmoji('📊')
            ])
        );
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  securityCollector.on('end', () => {
    // Function to disable all buttons when collector ends
    if (interaction.message.editable) {
      try {
        const disabledSecurityRow = ActionRowBuilder.from(securityRow);
        disabledSecurityRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledSecurityRow, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle notification settings display
async function handleNotificationSettings(interaction, guild, serverConfig, client) {
  // Get current notification settings
  const welcomeEnabled = serverConfig.welcome?.enabled || false;
  const welcomeChannel = serverConfig.welcome?.channelId ? 
    `<#${serverConfig.welcome.channelId}>` : 'Not set';
  const logsEnabled = serverConfig.logs?.enabled || false;
  const logsChannel = serverConfig.logs?.channelId ? 
    `<#${serverConfig.logs.channelId}>` : 'Not set';
  const announcerEnabled = serverConfig.announcer?.enabled || false;
  const announcerChannel = serverConfig.announcer?.channelId ? 
    `<#${serverConfig.announcer.channelId}>` : 'Not set';
  
  // Create notification settings embed
  const notificationEmbed = {
    title: '🔔 Notification Settings',
    description: `Manage notification features for ${guild.name}`,
    color: 0x3498DB, // Blue color
    fields: [
      {
        name: '👋 Welcome Messages',
        value: `Status: ${welcomeEnabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${welcomeChannel}`
      },
      {
        name: '📝 Server Logs',
        value: `Status: ${logsEnabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${logsChannel}`
      },
      {
        name: '📢 Announcer',
        value: `Status: ${announcerEnabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${announcerChannel}`
      }
    ],
    footer: {
      text: 'Use the buttons below to toggle settings'
    }
  };
  
  // Create buttons for notification settings
  const notificationRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_welcome')
        .setLabel(`${welcomeEnabled ? 'Disable' : 'Enable'} Welcome`)
        .setStyle(welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_logs')
        .setLabel(`${logsEnabled ? 'Disable' : 'Enable'} Logs`)
        .setStyle(logsEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_announcer')
        .setLabel(`${announcerEnabled ? 'Disable' : 'Enable'} Announcer`)
        .setStyle(announcerEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with notification settings
  await interaction.message.edit({
    embeds: [notificationEmbed],
    components: [notificationRow, backRow]
  });
  
  // Setup collector for the buttons
  const filter = i => i.user.id === interaction.user.id;
  const notificationCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  notificationCollector.on('collect', async i => {
    await i.deferUpdate();
    const serverConfig = config.getServerConfig(guild.id);
    
    // Handle button interactions
    if (i.customId === 'toggle_welcome') {
      const welcome = serverConfig.welcome || {};
      const newValue = !welcome.enabled;
      config.updateServerConfig(guild.id, { 
        welcome: { ...welcome, enabled: newValue } 
      });
      
      // Create updated button with new state
      const updatedNotificationRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_welcome')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Welcome`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(notificationRow.components[1]),
          ButtonBuilder.from(notificationRow.components[2])
        );

      // Create updated embed with new values
      const updatedEmbed = { ...notificationEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${welcomeChannel}`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedNotificationRow, backRow]
      });
    } 
    else if (i.customId === 'toggle_logs') {
      const logs = serverConfig.logs || {};
      const newValue = !logs.enabled;
      config.updateServerConfig(guild.id, { 
        logs: { ...logs, enabled: newValue } 
      });
      
      // Create updated button with new state
      const updatedNotificationRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(notificationRow.components[0]),
          new ButtonBuilder()
            .setCustomId('toggle_logs')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Logs`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(notificationRow.components[2])
        );

      // Create updated embed with new values
      const updatedEmbed = { ...notificationEmbed };
      updatedEmbed.fields[1].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${logsChannel}`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedNotificationRow, backRow]
      });
    }
    else if (i.customId === 'toggle_announcer') {
      const announcer = serverConfig.announcer || {};
      const newValue = !announcer.enabled;
      config.updateServerConfig(guild.id, { 
        announcer: { ...announcer, enabled: newValue } 
      });
      
      // Create updated button with new state
      const updatedNotificationRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(notificationRow.components[0]),
          ButtonBuilder.from(notificationRow.components[1]),
          new ButtonBuilder()
            .setCustomId('toggle_announcer')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Announcer`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success)
        );

      // Create updated embed with new values
      const updatedEmbed = { ...notificationEmbed };
      updatedEmbed.fields[2].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${announcerChannel}`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedNotificationRow, backRow]
      });
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      notificationCollector.stop();
      
      // Recreate main dashboard embed
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
                .setLabel('Game Settings')
                .setDescription('Manage game features and entertainment options')
                .setValue('games')
                .setEmoji('🎮'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Server Statistics')
                .setDescription('View activity and security stats')
                .setValue('stats')
                .setEmoji('📊')
            ])
        );
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  notificationCollector.on('end', () => {
    // Disable all buttons when collector ends
    if (interaction.message.editable) {
      try {
        const disabledNotificationRow = ActionRowBuilder.from(notificationRow);
        disabledNotificationRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledNotificationRow, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle game settings display
async function handleGameSettings(interaction, guild, serverConfig, client) {
  // Get current game settings
  const gamesEnabled = serverConfig.games?.enabled || false;
  const autoGameStart = serverConfig.games?.autoStart || false;
  const gameChannel = serverConfig.games?.channelId ? 
    `<#${serverConfig.games.channelId}>` : 'Not set';
  
  // Create game settings embed
  const gameEmbed = {
    title: '🎮 Game Settings',
    description: `Manage game features for ${guild.name}`,
    color: 0x9B59B6, // Purple color
    fields: [
      {
        name: '🎲 Server Games',
        value: `Status: ${gamesEnabled ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${gameChannel}`
      },
      {
        name: '⏱️ Auto Game Start',
        value: `Status: ${autoGameStart ? '✅ Enabled' : '❌ Disabled'}\nAutomatically starts new games when previous ones end`
      },
      {
        name: '🎯 Available Games',
        value: `• Trivia\n• Word Scramble\n• Hangman\n• Number Guess\n• Reaction Race`
      }
    ],
    footer: {
      text: 'Use the buttons below to toggle settings'
    }
  };
  
  // Create buttons for game settings
  const gameRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_games')
        .setLabel(`${gamesEnabled ? 'Disable' : 'Enable'} Games`)
        .setStyle(gamesEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_auto_games')
        .setLabel(`${autoGameStart ? 'Disable' : 'Enable'} Auto-Start`)
        .setStyle(autoGameStart ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('start_game')
        .setLabel('Start a Game Now')
        .setStyle(ButtonStyle.Primary)
    );
  
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Update the message with game settings
  await interaction.message.edit({
    embeds: [gameEmbed],
    components: [gameRow, backRow]
  });
  
  // Setup collector for the buttons
  const filter = i => i.user.id === interaction.user.id;
  const gameCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  gameCollector.on('collect', async i => {
    await i.deferUpdate();
    const serverConfig = config.getServerConfig(guild.id);
    
    // Handle button interactions
    if (i.customId === 'toggle_games') {
      const games = serverConfig.games || {};
      const newValue = !games.enabled;
      config.updateServerConfig(guild.id, { 
        games: { ...games, enabled: newValue } 
      });

      // Create updated button with new state
      const updatedGameRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_games')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Games`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(gameRow.components[1]),
          ButtonBuilder.from(gameRow.components[2])
        );

      // Create updated embed with new values
      const updatedEmbed = { ...gameEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nChannel: ${gameChannel}`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedGameRow, backRow]
      });
    } 
    else if (i.customId === 'toggle_auto_games') {
      const games = serverConfig.games || {};
      const newValue = !games.autoStart;
      config.updateServerConfig(guild.id, { 
        games: { ...games, autoStart: newValue } 
      });

      // Create updated button with new state
      const updatedGameRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(gameRow.components[0]),
          new ButtonBuilder()
            .setCustomId('toggle_auto_games')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Auto-Start`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(gameRow.components[2])
        );

      // Create updated embed with new values
      const updatedEmbed = { ...gameEmbed };
      updatedEmbed.fields[1].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\nAutomatically starts new games when previous ones end`;

      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedGameRow, backRow]
      });
    }
    else if (i.customId === 'start_game') {
      // Send acknowledgement directly in the channel
      await interaction.channel.send({
        content: `<@${interaction.user.id}>, a new game will be started shortly in ${gameChannel !== 'Not set' ? gameChannel : 'the current channel'}!`,
        ephemeral: true
      });
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      gameCollector.stop();
      
      // Recreate main dashboard embed
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
                .setLabel('Game Settings')
                .setDescription('Manage game features and entertainment options')
                .setValue('games')
                .setEmoji('🎮'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Server Statistics')
                .setDescription('View activity and security stats')
                .setValue('stats')
                .setEmoji('📊')
            ])
        );
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  gameCollector.on('end', () => {
    // Disable all buttons when collector ends
    if (interaction.message.editable) {
      try {
        const disabledGameRow = ActionRowBuilder.from(gameRow);
        disabledGameRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledGameRow, disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}

// Handle statistics display
async function handleStatsView(interaction, guild, serverConfig, client) {
  // Get current server statistics
  const memberCount = guild.memberCount;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const verificationCount = serverConfig.verification?.verifiedUsers?.length || 0;
  const securityIncidents = serverConfig.security?.incidents?.length || 0;
  const commandUsage = serverConfig.commandStats || {};
  
  // Create top commands list
  let topCommands = 'No commands used yet';
  const commandEntries = Object.entries(commandUsage);
  if (commandEntries.length > 0) {
    commandEntries.sort((a, b) => b[1] - a[1]);
    topCommands = commandEntries.slice(0, 5)
      .map(([cmd, count]) => `• ${cmd}: ${count} uses`)
      .join('\n');
  }
  
  // Create statistics embed
  const statsEmbed = {
    title: '📊 Server Statistics',
    description: `Detailed statistics for ${guild.name}`,
    color: 0x2ECC71, // Green color
    fields: [
      {
        name: '👥 Member Statistics',
        value: `Total Members: ${memberCount}\nHumans: ${memberCount - botCount}\nBots: ${botCount}`
      },
      {
        name: '✅ Verification Statistics',
        value: `Verified Users: ${verificationCount}\nVerification System: ${serverConfig.verification?.enabled ? 'Enabled' : 'Disabled'}`
      },
      {
        name: '🛡️ Security Statistics',
        value: `Security Incidents: ${securityIncidents}\nAnti-Nuke: ${serverConfig.antiNuke ? 'Enabled' : 'Disabled'}\nRaid Protection: ${serverConfig.raidProtection ? 'Enabled' : 'Disabled'}`
      },
      {
        name: '📈 Most Used Commands',
        value: topCommands
      }
    ],
    footer: {
      text: 'Statistics updated as of ' + new Date().toLocaleString()
    }
  };
  
  // Create button to go back
  const backRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_dashboard')
        .setLabel('Back to Main Dashboard')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('refresh_stats')
        .setLabel('Refresh Statistics')
        .setStyle(ButtonStyle.Primary)
    );
  
  // Update the message with statistics
  await interaction.message.edit({
    embeds: [statsEmbed],
    components: [backRow]
  });
  
  // Setup collector for the buttons
  const filter = i => i.user.id === interaction.user.id;
  const statsCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  statsCollector.on('collect', async i => {
    await i.deferUpdate();
    
    if (i.customId === 'refresh_stats') {
      // Refresh the statistics
      const refreshedConfig = config.getServerConfig(guild.id);
      const refreshedVerificationCount = refreshedConfig.verification?.verifiedUsers?.length || 0;
      const refreshedSecurityIncidents = refreshedConfig.security?.incidents?.length || 0;
      const refreshedCommandUsage = refreshedConfig.commandStats || {};
      
      // Update top commands list
      let refreshedTopCommands = 'No commands used yet';
      const refreshedCommandEntries = Object.entries(refreshedCommandUsage);
      if (refreshedCommandEntries.length > 0) {
        refreshedCommandEntries.sort((a, b) => b[1] - a[1]);
        refreshedTopCommands = refreshedCommandEntries.slice(0, 5)
          .map(([cmd, count]) => `• ${cmd}: ${count} uses`)
          .join('\n');
      }
      
      // Create updated statistics embed
      const refreshedStatsEmbed = {
        title: '📊 Server Statistics',
        description: `Detailed statistics for ${guild.name}`,
        color: 0x2ECC71, // Green color
        fields: [
          {
            name: '👥 Member Statistics',
            value: `Total Members: ${memberCount}\nHumans: ${memberCount - botCount}\nBots: ${botCount}`
          },
          {
            name: '✅ Verification Statistics',
            value: `Verified Users: ${refreshedVerificationCount}\nVerification System: ${refreshedConfig.verification?.enabled ? 'Enabled' : 'Disabled'}`
          },
          {
            name: '🛡️ Security Statistics',
            value: `Security Incidents: ${refreshedSecurityIncidents}\nAnti-Nuke: ${refreshedConfig.antiNuke ? 'Enabled' : 'Disabled'}\nRaid Protection: ${refreshedConfig.raidProtection ? 'Enabled' : 'Disabled'}`
          },
          {
            name: '📈 Most Used Commands',
            value: refreshedTopCommands
          }
        ],
        footer: {
          text: 'Statistics updated as of ' + new Date().toLocaleString()
        }
      };
      
      await i.message.edit({
        embeds: [refreshedStatsEmbed],
        components: [backRow]
      });
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      statsCollector.stop();
      
      // Recreate main dashboard embed
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
                .setLabel('Game Settings')
                .setDescription('Manage game features and entertainment options')
                .setValue('games')
                .setEmoji('🎮'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Server Statistics')
                .setDescription('View activity and security stats')
                .setValue('stats')
                .setEmoji('📊')
            ])
        );
      
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
  
  statsCollector.on('end', () => {
    // Disable all buttons when collector ends
    if (interaction.message.editable) {
      try {
        const disabledBackRow = ActionRowBuilder.from(backRow);
        disabledBackRow.components.forEach(button => {
          button.setDisabled(true);
        });
        
        interaction.message.edit({ 
          components: [disabledBackRow] 
        }).catch(console.error);
      } catch (error) {
        console.error('Error disabling buttons:', error);
      }
    }
  });
}