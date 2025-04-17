const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'dashboard',
  description: 'Access the in-Discord dashboard for server settings',
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const user = isSlashCommand ? interaction.user : message.author;
    const channel = isSlashCommand ? interaction.channel : message.channel;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    if (!guild) {
      const errorResponse = 'Dashboard can only be used in a server!';
      if (isSlashCommand) {
        return interaction.reply({ content: errorResponse, ephemeral: true });
      } else {
        return message.reply(errorResponse);
      }
    }
    
    // Check if user has admin permissions (Manage Server)
    const member = guild.members.cache.get(user.id);
    if (!member.permissions.has('ManageGuild')) {
      const errorResponse = 'You need the "Manage Server" permission to access the dashboard!';
      if (isSlashCommand) {
        return interaction.reply({ content: errorResponse, ephemeral: true });
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
    
    // Send the initial dashboard message
    let dashboardMessage;
    if (isSlashCommand) {
      if (interaction.deferred) {
        dashboardMessage = await interaction.followUp({ 
          embeds: [dashboardEmbed], 
          components: [dashboardRow],
          fetchReply: true
        });
      } else {
        dashboardMessage = await interaction.reply({ 
          embeds: [dashboardEmbed], 
          components: [dashboardRow],
          fetchReply: true
        });
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
        case 'games':
          await handleGameSettings(i, guild, serverConfig, client);
          break;
        case 'stats':
          await handleStatsView(i, guild, serverConfig, client);
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