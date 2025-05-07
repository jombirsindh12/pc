const config = require('../utils/config');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  name: 'setcontentchannel',
  description: 'Set different notification channels for each YouTube content type',
  usage: '/setcontentchannel',
  
  // Discord.js v14 slash command builder
  data: new SlashCommandBuilder()
    .setName('setcontentchannel')
    .setDescription('Set different notification channels for each YouTube content type')
    .addSubcommand(subcommand =>
      subcommand
        .setName('videos')
        .setDescription('Set a channel for YouTube video notifications')
        .addChannelOption(option =>
          option.setName('channel')
          .setDescription('The channel to send YouTube video notifications to')
          .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shorts')
        .setDescription('Set a channel for YouTube shorts notifications')
        .addChannelOption(option =>
          option.setName('channel')
          .setDescription('The channel to send YouTube shorts notifications to')
          .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('livestreams')
        .setDescription('Set a channel for YouTube livestream notifications')
        .addChannelOption(option =>
          option.setName('channel')
          .setDescription('The channel to send YouTube livestream notifications to')
          .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View the current YouTube notification channel settings')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  guildOnly: true, // This command can only be used in servers
  
  async execute(message, args, client, interaction = null) {
    console.log(`Executing setContentChannel command`);
    
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    let sendReply;
    let serverId;
    
    try {
      if (isSlashCommand) {
        console.log('Processing as slash command');
        serverId = interaction.guild.id;
        
        await interaction.deferReply({ ephemeral: true });
        
        sendReply = async (content, isEmbed = false) => {
          try {
            if (isEmbed) {
              return await interaction.followUp(content);
            }
            return await interaction.followUp({ content, ephemeral: true });
          } catch (error) {
            console.error('Error sending reply:', error);
            try {
              if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply(typeof content === 'string' ? { content, ephemeral: true } : content);
              } else {
                return await interaction.channel.send(typeof content === 'string' ? { content } : content);
              }
            } catch (fallbackError) {
              console.error('Fallback reply also failed:', fallbackError);
            }
          }
        };
        
        // Get the server config
        const serverConfig = config.getServerConfig(serverId);
        
        // Initialize YouTube settings if they don't exist
        if (!serverConfig.youtubeSettings) {
          serverConfig.youtubeSettings = {
            enabled: false,
            channelIds: [],
            notificationChannelId: null,
            videoNotificationChannelId: null,
            shortsNotificationChannelId: null,
            livestreamNotificationChannelId: null,
            notifyOnVideos: true,
            notifyOnShorts: true,
            notifyOnLivestreams: true,
            lastChecked: null
          };
        }
        
        // Get the subcommand
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'view') {
          // Create an embed to display the current settings
          const settingsEmbed = new EmbedBuilder()
            .setTitle('🎬 YouTube Notification Channels')
            .setColor(0xFF0000) // YouTube red color
            .setDescription('Current notification channel settings for YouTube content')
            .addFields(
              { 
                name: '📹 Regular Videos', 
                value: serverConfig.youtubeSettings.videoNotificationChannelId ? 
                  `<#${serverConfig.youtubeSettings.videoNotificationChannelId}>` : 
                  'Not set (using default channel)'
              },
              { 
                name: '📱 Shorts', 
                value: serverConfig.youtubeSettings.shortsNotificationChannelId ? 
                  `<#${serverConfig.youtubeSettings.shortsNotificationChannelId}>` : 
                  'Not set (using default channel)'
              },
              { 
                name: '🔴 Livestreams', 
                value: serverConfig.youtubeSettings.livestreamNotificationChannelId ? 
                  `<#${serverConfig.youtubeSettings.livestreamNotificationChannelId}>` : 
                  'Not set (using default channel)'
              },
              { 
                name: '🔔 Default Channel', 
                value: serverConfig.youtubeSettings.notificationChannelId ? 
                  `<#${serverConfig.youtubeSettings.notificationChannelId}>` : 
                  'Not set'
              }
            )
            .setFooter({ text: 'Use /setcontentchannel videos/shorts/livestreams to set specific channels' })
            .setTimestamp();
            
          await sendReply({ embeds: [settingsEmbed] }, true);
          return;
        }
        
        // Get the channel
        const channel = interaction.options.getChannel('channel');
        if (!channel) {
          await sendReply('❌ Please provide a valid channel.');
          return;
        }
        
        // Make sure the channel is a text channel
        console.log(`Channel type: ${channel.type}`);
        
        // In Discord.js v14, channel types are different
        // 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT, both are valid text channels
        if (channel.type !== 0 && channel.type !== 5) {
          await sendReply('❌ Please select a text channel (not a voice, category, or forum channel).');
          return;
        }
        
        // Update the settings based on the subcommand
        switch (subcommand) {
          case 'videos':
            serverConfig.youtubeSettings.videoNotificationChannelId = channel.id;
            break;
          case 'shorts':
            serverConfig.youtubeSettings.shortsNotificationChannelId = channel.id;
            break;
          case 'livestreams':
            serverConfig.youtubeSettings.livestreamNotificationChannelId = channel.id;
            break;
        }
        
        // Save the config
        config.updateServerConfig(serverId, { youtubeSettings: serverConfig.youtubeSettings });
        
        // Send a confirmation
        const contentType = subcommand.charAt(0).toUpperCase() + subcommand.slice(1); // Capitalize first letter
        const successEmbed = new EmbedBuilder()
          .setTitle(`✅ YouTube ${contentType} Channel Set`)
          .setColor(0x00FF00)
          .setDescription(`YouTube ${contentType} notifications will now be sent to <#${channel.id}>.`)
          .setFooter({ text: 'You can change this at any time with /setcontentchannel' })
          .setTimestamp();
          
        await sendReply({ embeds: [successEmbed] }, true);
        
        // If this is the first YouTube notification channel being set, also set it as the default
        if (!serverConfig.youtubeSettings.notificationChannelId) {
          serverConfig.youtubeSettings.notificationChannelId = channel.id;
          serverConfig.youtubeSettings.enabled = true;
          config.updateServerConfig(serverId, { youtubeSettings: serverConfig.youtubeSettings });
          
          // Inform the user
          const noteEmbed = new EmbedBuilder()
            .setTitle('📝 Note')
            .setColor(0xFFAA00)
            .setDescription(`Since this is the first YouTube notification channel you've set, it has also been set as the default channel for any content types that don't have a specific channel.`)
            .setFooter({ text: 'You can view all settings with /setcontentchannel view' });
            
          await interaction.followUp({ embeds: [noteEmbed], ephemeral: true });
        }
      } else {
        // Legacy command handling - we'll force them to use the slash command
        message.reply('Please use the slash command `/setcontentchannel` to set notification channels.');
      }
    } catch (error) {
      console.error('Error in setContentChannel command:', error);
      
      if (sendReply) {
        await sendReply(`❌ An error occurred: ${error.message}`);
      } else if (message) {
        message.reply(`❌ An error occurred: ${error.message}`);
      }
    }
  }
};