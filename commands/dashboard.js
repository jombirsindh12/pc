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
    
    // IMPORTANT: Force treat interaction as in guild, override previous logic
    // This fixes the issue where commands in servers are detected as DMs
    const guild = isSlashCommand ? interaction.guild : message.guild;
    console.log(`Dashboard command used by ${user.tag} | In guild: ${!!guild} | Guild name: ${guild?.name || 'Unknown'}`);
    
    // ADDITIONAL CHECK: If we're actually in DM (client knows for sure)
    const isDM = channel.type === 'DM';
    console.log(`Channel type: ${channel.type} | Is DM: ${isDM}`);
    
    // Skip permission check for DM, just show a simple dashboard
    if (isDM) {
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
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
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
        .setCustomId('update_subcount')
        .setLabel('Update Sub Count Now')
        .setStyle(ButtonStyle.Primary)
    );
  
  const formatRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('format_standard')
        .setLabel('Standard Format')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('format_minimal')
        .setLabel('Minimal Format')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('format_detailed')
        .setLabel('Detailed Format')
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
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
      // Continue with handling to avoid UX disruption
    }
    
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
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedVoiceRow, formatRow, backRow]
      });
    }
    else if (i.customId === 'update_subcount') {
      // Only proceed if voice channel is set
      if (voiceChannelId === 'Not set') {
        try {
          await i.followUp({
            content: '❌ Cannot update subscriber count: No voice channel set. Use `/setvoicechannelname` to set a channel first.',
            ephemeral: true
          });
        } catch (error) {
          console.error('Error sending voice channel not set message:', error);
        }
        return;
      }
      
      // Check if YouTube API key is set
      const youtubeChannelId = serverConfig.youtubeChannelId;
      if (!youtubeChannelId) {
        try {
          await i.followUp({
            content: '❌ Cannot update subscriber count: No YouTube channel set. Use `/setyoutubechannel` to set a channel first.',
            ephemeral: true
          });
        } catch (error) {
          console.error('Error sending YouTube channel not set message:', error);
        }
        return;
      }
      
      // Send a message indicating update is in progress
      try {
        await i.followUp({
          content: '⏳ Updating subscriber count channel... Please wait.',
          ephemeral: true
        });
      } catch (error) {
        console.error('Error sending update in progress message:', error);
      }
      
      // Try to update the subscriber count
      try {
        // This function should be defined elsewhere in your code
        // Import it from the appropriate file if needed
        const updateSubCountChannel = require('./setVoiceChannelName').updateSubCountChannel;
        
        if (typeof updateSubCountChannel === 'function') {
          await updateSubCountChannel(client, guild.id);
          await i.followUp({
            content: '✅ Subscriber count updated successfully!',
            ephemeral: true
          });
        } else {
          await i.followUp({
            content: '❌ Update function not available. Please use `/setvoicechannelname` command instead.',
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error updating sub count:', error);
        await i.followUp({
          content: `❌ Failed to update subscriber count: ${error.message}`,
          ephemeral: true
        });
      }
    }
    else if (i.customId.startsWith('format_')) {
      let newFormat = serverConfig.voiceFormat || '{name}: {count} subscribers';
      
      // Set the format based on the button clicked
      if (i.customId === 'format_standard') {
        newFormat = '{name}: {count} subscribers';
      } else if (i.customId === 'format_minimal') {
        newFormat = '{abbreviatedCount} subs';
      } else if (i.customId === 'format_detailed') {
        newFormat = '📊 {name} | {count} subscribers';
      }
      
      // Update the server config
      config.updateServerConfig(guild.id, { voiceFormat: newFormat });
      
      // Create updated embed with new values
      const updatedEmbed = { ...voiceEmbed };
      updatedEmbed.fields[2].value = `\`${newFormat}\`\n` +
             `Variables: {name}, {count}, {abbreviatedCount}`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [voiceRow, formatRow, backRow]
      });
      
      // Send confirmation
      try {
        await i.followUp({
          content: `✅ Voice channel format updated to: \`${newFormat}\``,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error sending format update confirmation:', error);
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
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
}

// Add other handler functions here
async function handleSecuritySettings(interaction, guild, serverConfig, client) {
  // Implement security settings UI
  const antiNukeEnabled = serverConfig.antiNukeEnabled || false;
  const verificationEnabled = serverConfig.verificationEnabled || false;
  const securityLevel = serverConfig.securityLevel || 'medium';
  const securityAction = serverConfig.securityAction || 'kick';
  const whitelistedRoles = serverConfig.whitelistedRoles || [];
  const whitelistedUsers = serverConfig.whitelistedUsers || [];
  
  // Format whitelisted items for display
  const formattedRoles = whitelistedRoles.length > 0 
    ? whitelistedRoles.map(r => `<@&${r}>`).join(', ') 
    : 'None';
  
  const formattedUsers = whitelistedUsers.length > 0 
    ? whitelistedUsers.map(u => `<@${u}>`).join(', ') 
    : 'None';
  
  // Create security settings embed
  const securityEmbed = {
    title: '🔒 Security Settings',
    description: `Manage security features for ${guild.name}`,
    color: 0xE74C3C, // Red
    fields: [
      {
        name: '🛡️ Anti-Nuke Protection',
        value: `Status: ${antiNukeEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Protects against mass-bans, channel/role deletions, and other destructive actions`
      },
      {
        name: '✅ Verification System',
        value: `Status: ${verificationEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Requires new members to verify before accessing the server`
      },
      {
        name: '⚙️ Security Level',
        value: `Current: ${securityLevel.charAt(0).toUpperCase() + securityLevel.slice(1)}\n` +
               `Determines sensitivity of security triggers`
      },
      {
        name: '⚡ Security Action',
        value: `Current: ${securityAction.charAt(0).toUpperCase() + securityAction.slice(1)}\n` +
               `Action taken when security is triggered`
      },
      {
        name: '✳️ Whitelisted Roles',
        value: formattedRoles.length > 1000 ? `${formattedRoles.substring(0, 997)}...` : formattedRoles
      },
      {
        name: '👤 Whitelisted Users',
        value: formattedUsers.length > 1000 ? `${formattedUsers.substring(0, 997)}...` : formattedUsers
      }
    ],
    footer: {
      text: 'Use the buttons below to manage security settings'
    }
  };
  
  // Create buttons for security settings
  const toggleRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_antinuke')
        .setLabel(`${antiNukeEnabled ? 'Disable' : 'Enable'} Anti-Nuke`)
        .setStyle(antiNukeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_verification')
        .setLabel(`${verificationEnabled ? 'Disable' : 'Enable'} Verification`)
        .setStyle(verificationEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );
  
  const levelRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('security_level_low')
        .setLabel('Low Security')
        .setStyle(securityLevel === 'low' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('security_level_medium')
        .setLabel('Medium Security')
        .setStyle(securityLevel === 'medium' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('security_level_high')
        .setLabel('High Security')
        .setStyle(securityLevel === 'high' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('security_action_kick')
        .setLabel('Kick')
        .setStyle(securityAction === 'kick' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('security_action_ban')
        .setLabel('Ban')
        .setStyle(securityAction === 'ban' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('whitelist_manage')
        .setLabel('Manage Whitelist')
        .setStyle(ButtonStyle.Secondary)
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
    components: [toggleRow, levelRow, actionRow, backRow]
  });
  
  // Set up collector for security buttons
  const filter = i => i.user.id === interaction.user.id;
  const securityCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  securityCollector.on('collect', async i => {
    try {
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
    }
    
    // Handle toggles for anti-nuke and verification
    if (i.customId === 'toggle_antinuke') {
      const newValue = !serverConfig.antiNukeEnabled;
      config.updateServerConfig(guild.id, { antiNukeEnabled: newValue });
      
      // Update the first button
      const updatedToggleRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_antinuke')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Anti-Nuke`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(toggleRow.components[1])
        );
      
      // Update the embed field
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
             `Protects against mass-bans, channel/role deletions, and other destructive actions`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedToggleRow, levelRow, actionRow, backRow]
      });
      
      // Show confirmation message
      await i.followUp({
        content: `🔒 Anti-Nuke protection is now ${newValue ? 'enabled' : 'disabled'}.`,
        ephemeral: true
      });
    }
    else if (i.customId === 'toggle_verification') {
      const newValue = !serverConfig.verificationEnabled;
      config.updateServerConfig(guild.id, { verificationEnabled: newValue });
      
      // Update the second button
      const updatedToggleRow = new ActionRowBuilder()
        .addComponents(
          ButtonBuilder.from(toggleRow.components[0]),
          new ButtonBuilder()
            .setCustomId('toggle_verification')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Verification`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success)
        );
      
      // Update the embed field
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[1].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
             `Requires new members to verify before accessing the server`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedToggleRow, levelRow, actionRow, backRow]
      });
      
      // Show confirmation message
      await i.followUp({
        content: `✅ Verification system is now ${newValue ? 'enabled' : 'disabled'}.`,
        ephemeral: true
      });
    }
    
    // Handle security level changes
    else if (i.customId.startsWith('security_level_')) {
      const newLevel = i.customId.replace('security_level_', '');
      config.updateServerConfig(guild.id, { securityLevel: newLevel });
      
      // Update the security level buttons
      const updatedLevelRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('security_level_low')
            .setLabel('Low Security')
            .setStyle(newLevel === 'low' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('security_level_medium')
            .setLabel('Medium Security')
            .setStyle(newLevel === 'medium' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('security_level_high')
            .setLabel('High Security')
            .setStyle(newLevel === 'high' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
      
      // Update the embed field
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[2].value = `Current: ${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}\n` +
             `Determines sensitivity of security triggers`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [toggleRow, updatedLevelRow, actionRow, backRow]
      });
      
      // Show confirmation message with explanation
      let explanation = '';
      if (newLevel === 'low') {
        explanation = 'Only the most severe actions will trigger security responses.';
      } else if (newLevel === 'medium') {
        explanation = 'Balanced security that catches most malicious actions while minimizing false positives.';
      } else if (newLevel === 'high') {
        explanation = 'Maximum security that may occasionally trigger on legitimate actions.';
      }
      
      await i.followUp({
        content: `⚙️ Security level set to: ${newLevel.toUpperCase()}\n${explanation}`,
        ephemeral: true
      });
    }
    
    // Handle security action changes
    else if (i.customId.startsWith('security_action_')) {
      const newAction = i.customId.replace('security_action_', '');
      config.updateServerConfig(guild.id, { securityAction: newAction });
      
      // Update the security action buttons
      const updatedActionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('security_action_kick')
            .setLabel('Kick')
            .setStyle(newAction === 'kick' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('security_action_ban')
            .setLabel('Ban')
            .setStyle(newAction === 'ban' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          ButtonBuilder.from(actionRow.components[2])
        );
      
      // Update the embed field
      const updatedEmbed = { ...securityEmbed };
      updatedEmbed.fields[3].value = `Current: ${newAction.charAt(0).toUpperCase() + newAction.slice(1)}\n` +
             `Action taken when security is triggered`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [toggleRow, levelRow, updatedActionRow, backRow]
      });
      
      // Show confirmation message
      await i.followUp({
        content: `⚡ Security action set to: ${newAction.toUpperCase()}\nUsers who trigger security measures will be ${newAction}ed.`,
        ephemeral: true
      });
    }
    
    // Handle whitelist management
    else if (i.customId === 'whitelist_manage') {
      // Create whitelist management embed
      const whitelistEmbed = new EmbedBuilder()
        .setTitle('✅ Whitelist Management')
        .setDescription('Users and roles on the whitelist are exempt from security actions')
        .setColor(0x2ECC71)
        .addFields(
          {
            name: '👤 Whitelisted Users',
            value: formattedUsers.length > 1000 ? 
              `${whitelistedUsers.length} users whitelisted - use \`/whitelist list\` to see all` : 
              formattedUsers || 'None'
          },
          {
            name: '✳️ Whitelisted Roles',
            value: formattedRoles.length > 1000 ? 
              `${whitelistedRoles.length} roles whitelisted - use \`/whitelist list\` to see all` : 
              formattedRoles || 'None'
          },
          {
            name: '📝 How to Manage',
            value: 'Use the following commands to manage the whitelist:\n' +
                   '`/whitelist add @user` - Add a user to whitelist\n' +
                   '`/whitelist add @role` - Add a role to whitelist\n' +
                   '`/whitelist remove @user` - Remove a user from whitelist\n' +
                   '`/whitelist remove @role` - Remove a role from whitelist\n' +
                   '`/whitelist list` - Show all whitelisted users and roles'
          }
        );
      
      // Show whitelist management as followup
      await i.followUp({
        embeds: [whitelistEmbed],
        ephemeral: true
      });
    }
    
    // Handle back to dashboard
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
      await i.message.edit({
        embeds: [dashboardEmbed],
        components: [dashboardRow]
      });
    }
  });
}

// Add other handlers later as needed
async function handleNotificationSettings(interaction, guild, serverConfig, client) {
  // Implementation of notification settings UI
  const welcomeEnabled = serverConfig.welcomeEnabled || false;
  const welcomeChannelId = serverConfig.welcomeChannelId || 'Not set';
  const welcomeMessage = serverConfig.welcomeMessage || 'Welcome {user} to {server}!';
  const logChannelId = serverConfig.logChannelId || 'Not set';
  const announcerEnabled = serverConfig.announcerEnabled || false;
  const announcerChannelId = serverConfig.announcerChannelId || 'Not set';
  
  // Create notification settings embed
  const notificationEmbed = {
    title: '🔔 Notification Settings',
    description: `Manage notification settings for ${guild.name}`,
    color: 0xF1C40F, // Yellow
    fields: [
      {
        name: '👋 Welcome Messages',
        value: `Status: ${welcomeEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Channel: ${welcomeChannelId !== 'Not set' ? `<#${welcomeChannelId}>` : 'Not set'}\n` +
               `Message: ${welcomeMessage.length > 100 ? welcomeMessage.substring(0, 97) + '...' : welcomeMessage}`
      },
      {
        name: '📝 Server Logs',
        value: `Channel: ${logChannelId !== 'Not set' ? `<#${logChannelId}>` : 'Not set'}\n` +
               `Use \`/setlogs\` to configure log channels`
      },
      {
        name: '📢 Announcer',
        value: `Status: ${announcerEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Channel: ${announcerChannelId !== 'Not set' ? `<#${announcerChannelId}>` : 'Not set'}`
      }
    ],
    footer: {
      text: 'Use the buttons below to manage notification settings'
    }
  };
  
  // Create buttons for notification settings
  const welcomeRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_welcome')
        .setLabel(`${welcomeEnabled ? 'Disable' : 'Enable'} Welcome Messages`)
        .setStyle(welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('edit_welcome_message')
        .setLabel('Edit Welcome Message')
        .setStyle(ButtonStyle.Primary)
    );
  
  const announcerRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_announcer')
        .setLabel(`${announcerEnabled ? 'Disable' : 'Enable'} Announcer`)
        .setStyle(announcerEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('configure_logs')
        .setLabel('Configure Logs')
        .setStyle(ButtonStyle.Secondary)
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
    components: [welcomeRow, announcerRow, backRow]
  });
  
  // Set up collector for notification buttons
  const filter = i => i.user.id === interaction.user.id;
  const notificationCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  notificationCollector.on('collect', async i => {
    try {
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
    }
    
    // Handle button interactions
    if (i.customId === 'toggle_welcome') {
      const newValue = !serverConfig.welcomeEnabled;
      config.updateServerConfig(guild.id, { welcomeEnabled: newValue });
      
      // Update the welcome toggle button
      const updatedWelcomeRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_welcome')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Welcome Messages`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(welcomeRow.components[1])
        );
      
      // Update the embed field
      const updatedEmbed = { ...notificationEmbed };
      updatedEmbed.fields[0].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Channel: ${welcomeChannelId !== 'Not set' ? `<#${welcomeChannelId}>` : 'Not set'}\n` +
               `Message: ${welcomeMessage.length > 100 ? welcomeMessage.substring(0, 97) + '...' : welcomeMessage}`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [updatedWelcomeRow, announcerRow, backRow]
      });
      
      // Show confirmation message
      await i.followUp({
        content: `👋 Welcome messages are now ${newValue ? 'enabled' : 'disabled'}.`,
        ephemeral: true
      });
    }
    else if (i.customId === 'edit_welcome_message') {
      // Show welcome message edit info
      const welcomeEditEmbed = new EmbedBuilder()
        .setTitle('✏️ Edit Welcome Message')
        .setDescription('Use the following command to set a custom welcome message:')
        .setColor(0x3498DB)
        .addFields(
          {
            name: '📝 Current Message',
            value: welcomeMessage || 'Welcome {user} to {server}!'
          },
          {
            name: '🔄 How to Change',
            value: 'Use `/setwelcome channel #channel message Your custom message` to update\n\n' +
                   'Available variables:\n' +
                   '`{user}` - Mentions the new member\n' +
                   '`{username}` - Username without mention\n' +
                   '`{server}` - Server name\n' +
                   '`{membercount}` - Current member count'
          },
          {
            name: '🌟 Example',
            value: '`/setwelcome channel #welcome message Welcome {user} to {server}! You are our {membercount}th member!`'
          }
        );
      
      // Show welcome edit info as followup
      await i.followUp({
        embeds: [welcomeEditEmbed],
        ephemeral: true
      });
    }
    else if (i.customId === 'toggle_announcer') {
      const newValue = !serverConfig.announcerEnabled;
      config.updateServerConfig(guild.id, { announcerEnabled: newValue });
      
      // Update the announcer toggle button
      const updatedAnnouncerRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_announcer')
            .setLabel(`${newValue ? 'Disable' : 'Enable'} Announcer`)
            .setStyle(newValue ? ButtonStyle.Danger : ButtonStyle.Success),
          ButtonBuilder.from(announcerRow.components[1])
        );
      
      // Update the embed field
      const updatedEmbed = { ...notificationEmbed };
      updatedEmbed.fields[2].value = `Status: ${newValue ? '✅ Enabled' : '❌ Disabled'}\n` +
               `Channel: ${announcerChannelId !== 'Not set' ? `<#${announcerChannelId}>` : 'Not set'}`;
      
      // Update the message
      await i.message.edit({
        embeds: [updatedEmbed],
        components: [welcomeRow, updatedAnnouncerRow, backRow]
      });
      
      // Show confirmation message
      await i.followUp({
        content: `📢 Announcer is now ${newValue ? 'enabled' : 'disabled'}.`,
        ephemeral: true
      });
    }
    else if (i.customId === 'configure_logs') {
      // Show log configuration info
      const logConfigEmbed = new EmbedBuilder()
        .setTitle('📝 Log Configuration')
        .setDescription('Use the following command to set up log channels:')
        .setColor(0x3498DB)
        .addFields(
          {
            name: '📋 Current Log Channel',
            value: logChannelId !== 'Not set' ? `<#${logChannelId}>` : 'Not set'
          },
          {
            name: '🔄 How to Configure',
            value: 'Use `/setlogs channel #channel` to set a general log channel\n' +
                   'Use `/setlogs type [type] channel #channel` to set a specific log channel\n\n' +
                   'Available log types:\n' +
                   '`member` - Member joins/leaves/updates\n' +
                   '`message` - Message edits/deletes\n' +
                   '`mod` - Moderation actions\n' +
                   '`voice` - Voice channel events\n' +
                   '`server` - Server setting changes'
          },
          {
            name: '🌟 Example',
            value: '`/setlogs type mod channel #mod-logs`'
          }
        );
      
      // Show log configuration info as followup
      await i.followUp({
        embeds: [logConfigEmbed],
        ephemeral: true
      });
    }
    else if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      notificationCollector.stop();
      
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
  });
}

// Placeholder for remaining handler functions
async function handleGameSettings(interaction, guild, serverConfig, client) {
  // Simple implementation for now
  await interaction.message.edit({
    embeds: [{
      title: '🎮 Game Settings',
      description: 'Game settings are coming soon!',
      color: 0x9B59B6
    }],
    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('Back to Main Dashboard')
            .setStyle(ButtonStyle.Secondary)
        )
    ]
  });
  
  // Set up collector for game buttons
  const filter = i => i.user.id === interaction.user.id;
  const gameCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  gameCollector.on('collect', async i => {
    try {
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
    }
    
    if (i.customId === 'back_to_dashboard') {
      // Go back to main dashboard
      gameCollector.stop();
      
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
  });
}

async function handleStatsView(interaction, guild, serverConfig, client) {
  // Simple implementation for now
  await interaction.message.edit({
    embeds: [{
      title: '📊 Server Statistics',
      description: 'Detailed statistics coming soon!',
      color: 0x3498DB,
      fields: [
        {
          name: '👥 Members',
          value: `Total: ${guild.memberCount}\nOnline: ${guild.members.cache.filter(m => m.presence?.status !== 'offline').size || 'Unknown'}`
        },
        {
          name: '🛡️ Security',
          value: `Incidents: ${serverConfig.securityIncidents?.length || 0}\nVerified users: ${serverConfig.verifiedUsers?.length || 0}`
        }
      ]
    }],
    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('Back to Main Dashboard')
            .setStyle(ButtonStyle.Secondary)
        )
    ]
  });
  
  // Set up collector for stats buttons
  const filter = i => i.user.id === interaction.user.id;
  const statsCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  statsCollector.on('collect', async i => {
    try {
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
    }
    
    if (i.customId === 'back_to_dashboard') {
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
  });
}

async function handleHelpInfo(interaction, guild, serverConfig, client) {
  // Simple implementation for now
  await interaction.message.edit({
    embeds: [{
      title: '❓ Help & Information',
      description: 'Quick reference guide for Phantom Guard commands',
      color: 0x1ABC9C,
      fields: [
        {
          name: '🔧 Setup Commands',
          value: '`/setyoutubechannel` - Set YouTube channel for verification\n' +
                 '`/setverificationchannel` - Set channel for verification posts\n' +
                 '`/setrole` - Set role given to verified subscribers\n' +
                 '`/setnotificationchannel` - Set channel for notifications\n' +
                 '`/setvoicechannelname` - Set voice channel for subscriber count'
        },
        {
          name: '🛡️ Security Commands',
          value: '`/whitelist` - Manage security whitelist\n' +
                 '`/security` - Configure security settings\n' +
                 '`/ban` - Ban a user\n' +
                 '`/kick` - Kick a user'
        },
        {
          name: '🔔 Notification Commands',
          value: '`/setwelcome` - Configure welcome messages\n' +
                 '`/setannouncer` - Configure announcer\n' +
                 '`/setlogs` - Configure log channels'
        },
        {
          name: '🤖 Bot Info',
          value: 'Phantom Guard - Advanced security and management bot\n' +
                 'Prefix: `/` (Slash Commands)'
        }
      ]
    }],
    components: [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('detailed_help')
            .setLabel('View All Commands')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('Back to Main Dashboard')
            .setStyle(ButtonStyle.Secondary)
        )
    ]
  });
  
  // Set up collector for help buttons
  const filter = i => i.user.id === interaction.user.id;
  const helpCollector = interaction.message.createMessageComponentCollector({
    filter,
    time: 180000 // 3 minutes
  });
  
  helpCollector.on('collect', async i => {
    try {
      await i.deferUpdate();
    } catch (error) {
      console.error('Error deferring button update:', error);
    }
    
    if (i.customId === 'detailed_help') {
      // Show detailed help as followup
      const detailedHelp = new EmbedBuilder()
        .setTitle('📚 Complete Command List')
        .setDescription('Here are all available commands for Phantom Guard')
        .setColor(0x1ABC9C)
        .addFields(
          {
            name: '🛡️ Security Commands',
            value: '`/security` - Manage server security settings\n' +
                   '`/whitelist add/remove/list` - Manage security exemptions\n' +
                   '`/ban` - Ban a user with reason\n' +
                   '`/kick` - Kick a user with reason'
          },
          {
            name: '📱 YouTube Commands',
            value: '`/setyoutubechannel` - Set YouTube channel for verification\n' +
                   '`/searchchannel` - Search for a YouTube channel\n' +
                   '`/setverificationchannel` - Set verification screenshots channel\n' +
                   '`/setrole` - Set subscriber role\n' +
                   '`/listverified` - List all verified subscribers\n' +
                   '`/livesubcount` - Show current subscriber count'
          },
          {
            name: '🔔 Notification Commands',
            value: '`/setnotificationchannel` - Set notification channel\n' +
                   '`/setwelcome` - Configure welcome messages\n' +
                   '`/setlogs` - Configure log channels\n' +
                   '`/setannouncer` - Configure join/leave announcements'
          },
          {
            name: '🔊 Voice Commands',
            value: '`/setvoicechannelname` - Set subscriber count voice channel\n' +
                   '`/setupdatefrequency` - Set update frequency for sub count\n' +
                   '`/voice` - Manage voice announcements'
          },
          {
            name: '🎮 Fun & Utility',
            value: '`/game` - Start interactive games\n' +
                   '`/stickers` - Use animated stickers\n' +
                   '`/embed` - Create custom embeds\n' +
                   '`/info` - Show bot information'
          }
        )
        .setFooter({ text: 'Use /help for more information about specific commands' });
      
      // Show help message as followup
      await i.followUp({
        embeds: [detailedHelp],
        ephemeral: true
      });
    }
    else if (i.customId === 'back_to_dashboard') {
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
  });
}