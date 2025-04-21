const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'info',
  description: 'Show detailed information about bot commands',
  usage: '/info [command]',
  guildOnly: false, // Allow this command to work in DMs
  options: [
    {
      name: 'command',
      description: 'The command to get information about',
      type: 3, // STRING type
      required: false
    }
  ],
  async execute(message, args, client, interaction = null) {
    const isSlashCommand = !!interaction;
    
    // Always defer the reply for slash commands to prevent timeout
    if (isSlashCommand && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(err => {
        console.error(`[Info] Failed to defer reply: ${err}`);
      });
    }
    
    // SIMPLIFIED SERVER DETECTION - Direct approach
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const user = isSlashCommand ? interaction.user : message.author;
    
    // Log server detection results
    console.log(`[Info] Command used by ${user.tag} in ${guild?.name || 'DM'}`);
    
    const commandName = isSlashCommand 
      ? interaction.options.getString('command')
      : args && args[0] ? args[0].toLowerCase() : null;
    
    // Command information database - this provides detailed information about each command
    const commandDetails = {
      'ban': {
        description: 'Ban a user from the server',
        usage: '/ban [user] [reason]',
        example: '/ban @BadUser Spamming in channels',
        cooldown: '5 seconds',
        permissions: 'Ban Members',
        category: 'moderation',
        longDescription: 'Bans a user from the server with an optional reason. The banned user will not be able to rejoin unless unbanned by an administrator. The ban will be logged if log channel is set.',
        premium: false
      },
      'kick': {
        description: 'Kick a user from the server',
        usage: '/kick [user] [reason]',
        example: '/kick @TroubleUser Breaking rules',
        cooldown: '5 seconds',
        permissions: 'Kick Members',
        category: 'moderation',
        longDescription: 'Kicks a user from the server with an optional reason. The kicked user can rejoin the server with a new invite. The kick will be logged if log channel is set.',
        premium: false
      },
      'security': {
        description: 'Configure server security options',
        usage: '/security [action]',
        example: '/security enable',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'moderation',
        longDescription: 'Controls server security settings like anti-raid, anti-nuke, and verification systems. Use this to protect your server from malicious actions and automated attacks.',
        premium: false
      },
      'setupverification': {
        description: 'Set up user verification system',
        usage: '/setupverification',
        example: '/setupverification',
        cooldown: '30 seconds',
        permissions: 'Manage Server',
        category: 'verification',
        longDescription: 'Creates a verification system where new members must verify before getting access to the server. Helps protect against bot raids and improves server security.',
        premium: false
      },
      'setverificationchannel': {
        description: 'Set the verification channel',
        usage: '/setverificationchannel [channel]',
        example: '/setverificationchannel #verify',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'verification',
        longDescription: 'Sets the channel where users will verify themselves. This should typically be a channel that new users can see, but with limited permissions for unverified users.',
        premium: false
      },
      'listverified': {
        description: 'List all verified users',
        usage: '/listverified',
        example: '/listverified',
        cooldown: '30 seconds',
        permissions: 'Manage Server',
        category: 'verification',
        longDescription: 'Displays a list of all users who have been verified through the bot\'s verification system. Useful for auditing who has access to your server.',
        premium: false
      },
      'captcha': {
        description: 'Configure CAPTCHA verification',
        usage: '/captcha [action]',
        example: '/captcha setup',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'verification',
        longDescription: 'Sets up CAPTCHA verification for your server to protect against automated bot accounts. Supports image, text, and math CAPTCHAs.',
        premium: true
      },
      'premium': {
        description: 'Manage premium features',
        usage: '/premium [action]',
        example: '/premium status',
        cooldown: '5 seconds',
        permissions: 'None',
        category: 'premium',
        longDescription: 'View and manage premium features for your server. Premium includes advanced security, auto-moderation, enhanced verification, and more features.',
        premium: false
      },
      'dashboard': {
        description: 'Open the in-Discord dashboard',
        usage: '/dashboard',
        example: '/dashboard',
        cooldown: '5 seconds',
        permissions: 'Manage Server',
        category: 'utility',
        longDescription: 'Opens an interactive dashboard directly in Discord to manage all bot settings including security, notifications, games, and statistics.',
        premium: false
      },
      'help': {
        description: 'Shows help for all commands',
        usage: '/help [command]',
        example: '/help premium',
        cooldown: '5 seconds',
        permissions: 'None',
        category: 'utility',
        longDescription: 'Displays a list of all commands or detailed information about a specific command including usage, examples, and required permissions.',
        premium: false
      },
      'owner': {
        description: 'Bot owner commands',
        usage: '/owner [action]',
        example: '/owner stats',
        cooldown: '5 seconds',
        permissions: 'Bot Owner or username with 2007',
        category: 'owner',
        longDescription: 'Special commands only available to the bot owner or users with "2007" in their username. Includes server management, premium control, and bot statistics.',
        premium: false
      },
      'searchchannel': {
        description: 'Search for YouTube channels',
        usage: '/searchchannel [query]',
        example: '/searchchannel MrBeast',
        cooldown: '10 seconds',
        permissions: 'None',
        category: 'youtube',
        longDescription: 'Search for YouTube channels by name to find their channel ID. Use this command before setting up YouTube verification to find the correct channel.',
        premium: false
      },
      'setyoutubechannel': {
        description: 'Set the YouTube channel for verification',
        usage: '/setyoutubechannel [channel ID or URL]',
        example: '/setyoutubechannel UCX6OQ3DkcsbYNE6H8uQQuVA',
        cooldown: '30 seconds',
        permissions: 'Manage Server',
        category: 'youtube',
        longDescription: 'Sets the YouTube channel that users need to be subscribed to for verification. Use this command with a YouTube channel ID or URL.',
        premium: false
      },
      'setrole': {
        description: 'Set the role for verified subscribers',
        usage: '/setrole [role]',
        example: '/setrole @Subscribers',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'verification',
        longDescription: 'Sets the role that will be given to users who verify their YouTube subscription. This role should have permissions to access the server content.',
        premium: false
      },
      'setnotificationchannel': {
        description: 'Set the notification channel',
        usage: '/setnotificationchannel [channel]',
        example: '/setnotificationchannel #notifications',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'notification',
        longDescription: 'Sets the channel where verification notifications will be sent. Use this to keep track of new verified subscribers in a dedicated channel.',
        premium: false
      },
      'livesubcount': {
        description: 'Create a live subscriber count channel',
        usage: '/livesubcount',
        example: '/livesubcount',
        cooldown: '30 seconds',
        permissions: 'Manage Server',
        category: 'youtube',
        longDescription: 'Creates a voice channel that shows the YouTube channel\'s live subscriber count. This channel will automatically update based on the update frequency setting.',
        premium: false
      },
      'setvoicechannelname': {
        description: 'Set the format for subscriber count channel',
        usage: '/setvoicechannelname [format]',
        example: '/setvoicechannelname {channelName}: {count} subs',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'youtube',
        longDescription: 'Customizes the format of the subscriber count voice channel. Use placeholders like {channelName} and {count} to format the channel name.',
        premium: false
      },
      'setupdatefrequency': {
        description: 'Set how often the subscriber count updates',
        usage: '/setupdatefrequency [minutes]',
        example: '/setupdatefrequency 15',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'youtube',
        longDescription: 'Sets how frequently the subscriber count channel updates, in minutes. More frequent updates may be subject to YouTube API limits.',
        premium: false
      },
      'voice': {
        description: 'Voice channel commands',
        usage: '/voice [action]',
        example: '/voice join',
        cooldown: '5 seconds',
        permissions: 'None (must be in a voice channel for some actions)',
        category: 'voice',
        longDescription: 'Controls voice channel features including join/leave announcements, voice messages, and voice channel management.',
        premium: false
      },
      'game': {
        description: 'Play games in your server',
        usage: '/game [action]',
        example: '/game create trivia',
        cooldown: '10 seconds',
        permissions: 'None',
        category: 'games',
        longDescription: 'Creates and manages games in your server including trivia, word games, and multiplayer challenges. Use this to add entertainment to your server.',
        premium: false
      },
      'setannouncer': {
        description: 'Configure the voice announcer',
        usage: '/setannouncer [channel]',
        example: '/setannouncer #voice-general',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'voice',
        longDescription: 'Sets up the voice announcer feature which announces when users join or leave voice channels. You can customize which channels are announced.',
        premium: false
      },
      'setlogs': {
        description: 'Configure server logs',
        usage: '/setlogs [channel]',
        example: '/setlogs #server-logs',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'notification',
        longDescription: 'Sets up a channel for server logs to track important server events like kicks, bans, role changes, and channel updates. Helps monitor server activity.',
        premium: false
      },
      'setwelcome': {
        description: 'Configure welcome messages',
        usage: '/setwelcome [channel]',
        example: '/setwelcome #welcome',
        cooldown: '10 seconds',
        permissions: 'Manage Server',
        category: 'notification',
        longDescription: 'Sets up welcome messages for new members joining your server. You can customize the welcome message and the channel where it\'s sent.',
        premium: false
      },
      'info': {
        description: 'Shows detailed information about commands',
        usage: '/info [command]',
        example: '/info premium',
        cooldown: '5 seconds',
        permissions: 'None',
        category: 'utility',
        longDescription: 'Provides detailed information about specific commands including usage, examples, permissions, and cooldowns. Use this to learn how to use commands correctly.',
        premium: false
      }
    };
    
    // If a specific command was requested
    if (commandName) {
      const commandInfo = commandDetails[commandName.toLowerCase()];
      
      if (commandInfo) {
        // Create an embed with detailed command information
        const embed = new EmbedBuilder()
          .setTitle(`Command: /${commandName}`)
          .setDescription(commandInfo.longDescription || commandInfo.description)
          .setColor(0x3498DB)
          .addFields([
            { name: '📝 Usage', value: commandInfo.usage, inline: true },
            { name: '💡 Example', value: commandInfo.example, inline: true },
            { name: '⏱️ Cooldown', value: commandInfo.cooldown, inline: true },
            { name: '🔒 Permissions', value: commandInfo.permissions, inline: true },
            { name: '📂 Category', value: commandInfo.category.charAt(0).toUpperCase() + commandInfo.category.slice(1), inline: true },
            { name: '⭐ Premium', value: commandInfo.premium ? 'Yes' : 'No', inline: true }
          ]);
          
        // Send the command information
        if (isSlashCommand) {
          await interaction.editReply({ embeds: [embed] });
        } else {
          await message.channel.send({ embeds: [embed] });
        }
      } else {
        // Command not found
        const response = `Command \`${commandName}\` not found. Use \`/info\` without parameters to see a list of all commands.`;
        
        if (isSlashCommand) {
          await interaction.reply({ content: response, ephemeral: true });
        } else {
          await message.reply(response);
        }
      }
    } else {
      // If no specific command was requested, show categories
      const categoriesEmbed = new EmbedBuilder()
        .setTitle('📚 Command Categories')
        .setDescription('Select a category to see its commands, or use `/info [command]` to get detailed information about a specific command.')
        .setColor(0x3498DB);
      
      // Group commands by category
      const categories = {
        'moderation': 'Moderation',
        'verification': 'Verification',
        'notification': 'Notifications',
        'youtube': 'YouTube',
        'voice': 'Voice',
        'utility': 'Utility',
        'games': 'Games',
        'premium': 'Premium',
        'owner': 'Owner'
      };
      
      // Create buttons for categories
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('category_moderation')
            .setLabel('Moderation')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
          new ButtonBuilder()
            .setCustomId('category_verification')
            .setLabel('Verification')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('category_notification')
            .setLabel('Notifications')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔')
        );
      
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('category_youtube')
            .setLabel('YouTube')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📱'),
          new ButtonBuilder()
            .setCustomId('category_voice')
            .setLabel('Voice')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎤'),
          new ButtonBuilder()
            .setCustomId('category_utility')
            .setLabel('Utility')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛠️')
        );
        
      const row3 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('category_games')
            .setLabel('Games')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎮'),
          new ButtonBuilder()
            .setCustomId('category_premium')
            .setLabel('Premium')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐'),
          new ButtonBuilder()
            .setCustomId('category_owner')
            .setLabel('Owner')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👑')
        );
      
      // Send the embed with buttons
      let sentMessage;
      if (isSlashCommand) {
        sentMessage = await interaction.reply({ 
          embeds: [categoriesEmbed], 
          components: [row1, row2, row3],
          fetchReply: true 
        });
      } else {
        sentMessage = await message.channel.send({ 
          embeds: [categoriesEmbed], 
          components: [row1, row2, row3] 
        });
      }
      
      // Set up collector for button interactions
      const filter = i => i.customId.startsWith('category_') && 
                         (isSlashCommand ? i.user.id === interaction.user.id : i.user.id === message.author.id);
      
      const collector = sentMessage.createMessageComponentCollector({
        filter,
        time: 300000 // 5 minutes
      });
      
      collector.on('collect', async i => {
        await i.deferUpdate();
        
        // Get the category from the button
        const category = i.customId.replace('category_', '');
        
        // Filter commands for this category
        const categoryCommands = Object.entries(commandDetails)
          .filter(([name, cmd]) => cmd.category === category)
          .map(([name, cmd]) => ({ name, ...cmd }));
        
        if (categoryCommands.length > 0) {
          // Create an embed for the category
          const categoryEmbed = new EmbedBuilder()
            .setTitle(`${getEmojiForCategory(category)} ${categories[category]} Commands`)
            .setDescription(`Here are all the ${categories[category].toLowerCase()} commands.\nUse \`/info [command]\` to get detailed information about a specific command.`)
            .setColor(0x3498DB);
          
          // Add commands to the embed
          categoryCommands.forEach(cmd => {
            categoryEmbed.addFields({
              name: `/${cmd.name}${cmd.premium ? ' ⭐' : ''}`,
              value: `${cmd.description}\nUsage: \`${cmd.usage}\``,
              inline: false
            });
          });
          
          // Create a button to go back
          const backRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('back_to_categories')
                .setLabel('Back to Categories')
                .setStyle(ButtonStyle.Secondary)
            );
          
          // Update the message with the category embed
          await i.message.edit({
            embeds: [categoryEmbed],
            components: [backRow]
          });
        } else {
          // No commands in this category
          await i.followUp({
            content: `No commands found in the ${categories[category]} category.`,
            ephemeral: true
          });
        }
      });
      
      // Handle back button
      collector.on('collect', async i => {
        if (i.customId === 'back_to_categories') {
          await i.deferUpdate();
          
          // Go back to categories view
          await i.message.edit({
            embeds: [categoriesEmbed],
            components: [row1, row2, row3]
          });
        }
      });
      
      // When the collector times out, disable all buttons
      collector.on('end', async () => {
        // Disable all buttons
        const disabledRow1 = ActionRowBuilder.from(row1);
        const disabledRow2 = ActionRowBuilder.from(row2);
        const disabledRow3 = ActionRowBuilder.from(row3);
        
        for (const row of [disabledRow1, disabledRow2, disabledRow3]) {
          for (const component of row.components) {
            component.setDisabled(true);
          }
        }
        
        // Update the message with disabled buttons
        if (sentMessage.editable) {
          await sentMessage.edit({
            embeds: [categoriesEmbed],
            components: [disabledRow1, disabledRow2, disabledRow3]
          }).catch(console.error);
        }
      });
    }
  }
};

// Helper function to get emoji for category
function getEmojiForCategory(category) {
  const emojis = {
    'moderation': '🛡️',
    'verification': '✅',
    'notification': '🔔',
    'youtube': '📱',
    'voice': '🎤',
    'utility': '🛠️',
    'games': '🎮',
    'premium': '⭐',
    'owner': '👑'
  };
  
  return emojis[category] || '📝';
}