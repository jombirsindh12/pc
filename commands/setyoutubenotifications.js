const config = require('../utils/config');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  name: 'setyoutubenotifications',
  description: 'Configure which types of YouTube content trigger notifications',
  usage: '/setyoutubenotifications',
  
  // Discord.js v14 slash command builder
  data: new SlashCommandBuilder()
    .setName('setyoutubenotifications')
    .setDescription('Configure which types of YouTube content trigger notifications')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  guildOnly: true, // This command can only be used in servers
  
  async execute(message, args, client, interaction = null) {
    console.log(`Executing setYouTubeNotifications command`);
    
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    let sendReply;
    let serverId;
    
    try {
      if (isSlashCommand) {
        console.log('Processing as slash command');
        serverId = interaction.guild.id;
        
        await interaction.deferReply({ ephemeral: false });
        
        sendReply = async (content, isEmbed = false) => {
          try {
            if (isEmbed) {
              return await interaction.followUp(content);
            }
            return await interaction.followUp({ content });
          } catch (error) {
            console.error('Error sending reply:', error);
            try {
              if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply(typeof content === 'string' ? { content } : content);
              } else {
                return await interaction.channel.send(typeof content === 'string' ? { content } : content);
              }
            } catch (fallbackError) {
              console.error('Fallback reply also failed:', fallbackError);
            }
          }
        };
      } else {
        // Legacy command handling
        console.log(`Executing setYouTubeNotifications message command`);
        
        if (!message.guild) {
          console.error('Error: message.guild is undefined');
          return message.reply('This command can only be used in a server.');
        }
        
        serverId = message.guild.id;
        
        // Check if user has management permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          console.log('Permission denied: User does not have manage server permissions');
          return message.reply('❌ You need "Manage Server" permissions to use this command.');
        }
        
        sendReply = async (content, isEmbed = false) => {
          try {
            if (isEmbed) {
              return await message.channel.send(content);
            }
            return await message.reply(typeof content === 'string' ? { content } : content);
          } catch (error) {
            console.error('Error sending reply in message command:', error);
            try {
              return await message.channel.send(typeof content === 'string' ? { content } : content);
            } catch (fallbackError) {
              console.error('Fallback message reply also failed:', fallbackError);
            }
          }
        };
      }
      
      // Get the current server configuration
      const serverConfig = config.getServerConfig(serverId);
      
      // Check if YouTube channel is set up
      if (!serverConfig || !serverConfig.youtubeChannelId) {
        return await sendReply('❌ No YouTube channel has been set up. Please use `/setyoutubechannel` first.');
      }
      
      // We don't need to check for notification channel since we'll use the current channel
      
      // Get the current notification settings or set defaults
      const notificationSettings = serverConfig.youtubeNotificationSettings || {
        videos: true,
        shorts: true,
        livestreams: true,
        scheduledStreams: true
      };
      
      // Create the settings select menu
      const settingsRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('youtube_notification_settings')
            .setPlaceholder('Select which content should trigger notifications')
            .setMinValues(0)
            .setMaxValues(4)
            .addOptions([
              {
                label: 'Regular Videos',
                description: 'Get notifications for regular YouTube videos',
                value: 'videos',
                emoji: '🎬',
                default: notificationSettings.videos
              },
              {
                label: 'YouTube Shorts',
                description: 'Get notifications for YouTube Shorts',
                value: 'shorts',
                emoji: '📱',
                default: notificationSettings.shorts
              },
              {
                label: 'Live Streams',
                description: 'Get notifications when channel goes live',
                value: 'livestreams',
                emoji: '🔴',
                default: notificationSettings.livestreams
              },
              {
                label: 'Scheduled Streams',
                description: 'Get notifications for upcoming scheduled streams',
                value: 'scheduledStreams',
                emoji: '🗓️',
                default: notificationSettings.scheduledStreams
              }
            ])
        );
      
      // Create test button to generate sample notification for each type
      const testRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('test_video_notification')
            .setLabel('Test Video')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎬'),
          new ButtonBuilder()
            .setCustomId('test_short_notification')
            .setLabel('Test Short')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📱'),
          new ButtonBuilder()
            .setCustomId('test_livestream_notification')
            .setLabel('Test Live')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔴')
        );
      
      // Create a status embed showing the current settings
      const settingsEmbed = new EmbedBuilder()
        .setTitle('🔔 YouTube Notification Settings')
        .setDescription(`Configure which types of YouTube content will trigger notifications in your server.`)
        .setColor(0xFF0000) // YouTube red
        .addFields(
          { 
            name: 'Current Settings', 
            value: `
🎬 Regular Videos: ${notificationSettings.videos ? '✅ Enabled' : '❌ Disabled'}
📱 YouTube Shorts: ${notificationSettings.shorts ? '✅ Enabled' : '❌ Disabled'}
🔴 Live Streams: ${notificationSettings.livestreams ? '✅ Enabled' : '❌ Disabled'}
🗓️ Scheduled Streams: ${notificationSettings.scheduledStreams ? '✅ Enabled' : '❌ Disabled'}
            ` 
          },
          {
            name: 'YouTube Channel',
            value: serverConfig.youtubeChannelName || 'Unknown',
            inline: true
          },
          {
            name: 'Notification Channel',
            value: isSlashCommand 
              ? `<#${interaction.channelId}> (this channel)` 
              : `<#${message.channel.id}> (this channel)`,
            inline: true
          }
        )
        .setFooter({ text: 'Select options below to update your notification preferences' });
      
      // Send the settings message
      const settingsMessage = await sendReply({
        embeds: [settingsEmbed],
        components: [settingsRow, testRow]
      }, true);
      
      // Set up the collector for the select menu
      const filter = i => 
        i.customId === 'youtube_notification_settings' || 
        i.customId.startsWith('test_') && 
        (isSlashCommand ? i.user.id === interaction.user.id : i.user.id === message.author.id);
      
      const collector = settingsMessage.createMessageComponentCollector({ 
        filter, 
        time: 300000 // 5 minutes timeout
      });
      
      collector.on('collect', async i => {
        // Handle select menu
        if (i.customId === 'youtube_notification_settings') {
          const selectedValues = i.values;
          
          // Update notification settings
          const updatedSettings = {
            videos: selectedValues.includes('videos'),
            shorts: selectedValues.includes('shorts'),
            livestreams: selectedValues.includes('livestreams'),
            scheduledStreams: selectedValues.includes('scheduledStreams')
          };
          
          // Update server config with new settings and send notifications to the current channel
          const youtubeSettings = serverConfig.youtubeSettings || {};
          
          // Use the channel where the command was executed
          const currentChannelId = isSlashCommand 
            ? interaction.channelId 
            : message.channel.id;
          
          // Update server config - set all notification channel IDs to the current channel
          config.updateServerConfig(serverId, { 
            youtubeNotificationSettings: updatedSettings,
            youtubeSettings: {
              ...youtubeSettings,
              enabled: true,
              notificationChannelId: currentChannelId,
              videoNotificationChannelId: currentChannelId,
              shortsNotificationChannelId: currentChannelId,
              livestreamNotificationChannelId: currentChannelId
            }
          });
          
          console.log(`[YouTube Notification] Updated settings for server ${serverId}:`);
          console.log(`- Using channel ID ${currentChannelId} for all YouTube content types`);
          
          // Update the embed
          const updatedEmbed = EmbedBuilder.from(settingsMessage.embeds[0])
            .spliceFields(0, 1, { 
              name: 'Current Settings', 
              value: `
🎬 Regular Videos: ${updatedSettings.videos ? '✅ Enabled' : '❌ Disabled'}
📱 YouTube Shorts: ${updatedSettings.shorts ? '✅ Enabled' : '❌ Disabled'}
🔴 Live Streams: ${updatedSettings.livestreams ? '✅ Enabled' : '❌ Disabled'}
🗓️ Scheduled Streams: ${updatedSettings.scheduledStreams ? '✅ Enabled' : '❌ Disabled'}
              ` 
            });
          
          // Update the select menu with new defaults
          const updatedSettingsRow = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('youtube_notification_settings')
                .setPlaceholder('Select which content should trigger notifications')
                .setMinValues(0)
                .setMaxValues(4)
                .addOptions([
                  {
                    label: 'Regular Videos',
                    description: 'Get notifications for regular YouTube videos',
                    value: 'videos',
                    emoji: '🎬',
                    default: updatedSettings.videos
                  },
                  {
                    label: 'YouTube Shorts',
                    description: 'Get notifications for YouTube Shorts',
                    value: 'shorts',
                    emoji: '📱',
                    default: updatedSettings.shorts
                  },
                  {
                    label: 'Live Streams',
                    description: 'Get notifications when channel goes live',
                    value: 'livestreams',
                    emoji: '🔴',
                    default: updatedSettings.livestreams
                  },
                  {
                    label: 'Scheduled Streams',
                    description: 'Get notifications for upcoming scheduled streams',
                    value: 'scheduledStreams',
                    emoji: '🗓️',
                    default: updatedSettings.scheduledStreams
                  }
                ])
            );
          
          // Update the message with new settings
          await i.update({
            embeds: [updatedEmbed],
            components: [updatedSettingsRow, testRow]
          });
        }
        // Handle test buttons
        else if (i.customId.startsWith('test_')) {
          // Defer the update to avoid interaction timeout
          await i.deferUpdate();
          
          // Get the notification channel (use current channel)
          const guild = client.guilds.cache.get(serverId);
          if (!guild) {
            return await i.followUp({ content: '❌ Error: Could not find server.', ephemeral: true });
          }
          
          // Use the channel where the command is being executed for the test
          const currentChannelId = isSlashCommand 
            ? interaction.channelId 
            : message.channel.id;
          
          const notificationChannel = guild.channels.cache.get(currentChannelId);
          if (!notificationChannel) {
            return await i.followUp({ 
              content: '❌ Error: Could not find the current channel for testing.', 
              ephemeral: true 
            });
          }
          
          // Generate a sample video based on the test type
          const sampleVideo = generateSampleVideo(i.customId.replace('test_', ''));
          
          // Create button row
          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Sample Button - Watch Now')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
              .setEmoji('▶️'),
            new ButtonBuilder()
              .setLabel('Sample Button - Channel')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw`)
              .setEmoji('📺')
          );
          
          // Create the embed based on the test type
          let embed;
          let notificationContent;
          
          if (i.customId === 'test_short_notification') {
            // YouTube Short test
            embed = new EmbedBuilder()
              .setTitle(`${sampleVideo.title}`)
              .setDescription('This is a sample YouTube Short notification. Shorts typically have vertical format and are under 60 seconds.')
              .setColor(0xFF0000) // YouTube red
              .setURL(`https://www.youtube.com/shorts/dQw4w9WgXcQ`)
              .setAuthor({
                name: `${serverConfig.youtubeChannelName || 'Example Channel'} posted a Short!`,
                url: `https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw`,
                iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
              })
              .setImage('https://i.imgur.com/kKHpBVv.jpg') // Sample thumbnail
              .setTimestamp()
              .setFooter({
                text: `#Shorts • 1,234 views`,
                iconURL: 'https://i.imgur.com/8oQWZ0x.png' // YouTube Shorts icon
              });
              
            notificationContent = serverConfig.mentionRoleId 
              ? `<@&${serverConfig.mentionRoleId}> **${serverConfig.youtubeChannelName || 'Example Channel'}** just posted a new Short! 📱`
              : `📱 **${serverConfig.youtubeChannelName || 'Example Channel'}** just posted a new Short!`;
          }
          else if (i.customId === 'test_livestream_notification') {
            // Live Stream test
            embed = new EmbedBuilder()
              .setTitle(`🔴 LIVE: ${sampleVideo.title}`)
              .setDescription('This is a sample livestream notification. When a channel goes live, subscribers will receive this alert.')
              .setColor(0xFF0000) // YouTube red
              .setURL(`https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
              .setAuthor({
                name: `${serverConfig.youtubeChannelName || 'Example Channel'} is LIVE NOW!`,
                url: `https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw`,
                iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
              })
              .setImage('https://i.imgur.com/kKHpBVv.jpg') // Sample thumbnail
              .setTimestamp()
              .addFields(
                { name: '👁️ Watching', value: `1,234`, inline: true },
                { name: '⏰ Started', value: `<t:${Math.floor(Date.now() / 1000) - 600}:R>`, inline: true }
              )
              .setFooter({
                text: '🔴 LIVE NOW!',
                iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
              });
              
            notificationContent = serverConfig.mentionRoleId 
              ? `<@&${serverConfig.mentionRoleId}> 🔴 **${serverConfig.youtubeChannelName || 'Example Channel'}** is LIVE NOW! Don't miss it!`
              : `🔴 **${serverConfig.youtubeChannelName || 'Example Channel'}** is LIVE NOW! Don't miss it!`;
          }
          else {
            // Regular Video test
            embed = new EmbedBuilder()
              .setTitle(sampleVideo.title)
              .setDescription('This is a sample video notification. When a new video is uploaded, subscribers will receive this alert.')
              .setColor(0xFF0000) // YouTube red
              .setURL(`https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
              .setAuthor({
                name: `${serverConfig.youtubeChannelName || 'Example Channel'} uploaded a new video!`,
                url: `https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw`,
                iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
              })
              .setImage('https://i.imgur.com/kKHpBVv.jpg') // Sample thumbnail
              .setTimestamp()
              .addFields(
                { name: '⏱️ Duration', value: '3:32', inline: true },
                { name: '👁️ Views', value: '1,234', inline: true }
              )
              .setFooter({
                text: '📺 New YouTube Video',
                iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
              });
              
            notificationContent = serverConfig.mentionRoleId 
              ? `<@&${serverConfig.mentionRoleId}> **${serverConfig.youtubeChannelName || 'Example Channel'}** just uploaded a new video! 🎬`
              : `🎬 **${serverConfig.youtubeChannelName || 'Example Channel'}** just uploaded a new video!`;
          }
          
          // Send the test notification to the notification channel
          await notificationChannel.send({
            content: `**TEST NOTIFICATION:** ${notificationContent}`,
            embeds: [embed],
            components: [buttonRow]
          });
          
          // Let the user know the test was sent
          await i.followUp({ 
            content: `✅ Test notification sent to ${notificationChannel}! This is just a sample to preview the format.`,
            ephemeral: true
          });
        }
      });
      
      collector.on('end', async (collected) => {
        // Make the buttons disabled when timeout
        if (settingsMessage.editable) {
          // Get the components and disable them
          const disabledSettingsRow = ActionRowBuilder.from(settingsMessage.components[0])
            .setComponents(
              StringSelectMenuBuilder.from(settingsMessage.components[0].components[0])
                .setDisabled(true)
            );
          
          const disabledTestRow = ActionRowBuilder.from(settingsMessage.components[1])
            .setComponents(
              ButtonBuilder.from(settingsMessage.components[1].components[0]).setDisabled(true),
              ButtonBuilder.from(settingsMessage.components[1].components[1]).setDisabled(true),
              ButtonBuilder.from(settingsMessage.components[1].components[2]).setDisabled(true)
            );
          
          await settingsMessage.edit({
            components: [disabledSettingsRow, disabledTestRow],
            content: settingsMessage.content,
            embeds: settingsMessage.embeds
          }).catch(console.error);
        }
      });
      
    } catch (error) {
      console.error('Error in setYouTubeNotifications command:', error);
      
      try {
        if (isSlashCommand) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: `❌ An error occurred: ${error.message}`,
              ephemeral: true
            });
          } else {
            await interaction.followUp({ 
              content: `❌ An error occurred: ${error.message}`,
              ephemeral: true
            });
          }
        } else if (message && message.channel) {
          await message.channel.send(`❌ An error occurred: ${error.message}`);
        }
      } catch (finalError) {
        console.error('Could not send error message:', finalError);
      }
    }
  },
};

/**
 * Generate a sample video for testing notifications
 * @param {string} type The type of video to generate (video, short, livestream)
 * @returns {Object} A sample video object
 */
function generateSampleVideo(type) {
  const videoTitles = {
    'video': 'How to Build an Amazing Discord Bot in 10 Minutes',
    'short': 'Discord Bot Tutorial #shorts',
    'livestream': 'Let\'s Build a Discord Bot LIVE!'
  };
  
  return {
    id: 'dQw4w9WgXcQ', // Sample YouTube ID
    title: videoTitles[type] || 'Sample YouTube Video',
    description: 'This is a sample video description for testing notifications.',
    videoType: type,
    publishedAt: new Date().toISOString()
  };
}