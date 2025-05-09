const config = require('./config');
const youtubeAPI = require('./youtubeAPI');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map to store last video IDs for channels
const lastVideoIds = new Map();

// Map to store the timeout IDs for each server
const watcherTimeouts = new Map();

// Map to store active livestreams to avoid duplicate notifications
const activeLivestreams = new Map();

/**
 * Checks for new videos from the configured YouTube channel
 * @param {object} client Discord client
 * @param {string} serverId Discord server ID
 */
async function checkForNewVideos(client, serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    
    // Only proceed if we have the necessary configuration
    if (!serverConfig || !serverConfig.youtubeChannelId || 
        (!serverConfig.notificationChannelId && !serverConfig.youtubeSettings?.notificationChannelId)) {
      return;
    }
    
    const youtubeChannelId = serverConfig.youtubeChannelId;
    
    // Get the notification settings from youtubeSettings or use defaults
    const youtubeSettings = serverConfig.youtubeSettings || {};
    const notificationSettings = serverConfig.youtubeNotificationSettings || {
      videos: youtubeSettings.notifyOnVideos !== false,
      shorts: youtubeSettings.notifyOnShorts !== false,
      livestreams: youtubeSettings.notifyOnLivestreams !== false,
      scheduledStreams: true
    };
    
    // Get the guild
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;
    
    // Determine which notification channel to use based on content type
    // We'll set default channels for each type, but we'll override them when we check content types
    const defaultChannelId = youtubeSettings.notificationChannelId || serverConfig.notificationChannelId;
    const videoChannelId = youtubeSettings.videoNotificationChannelId || defaultChannelId;
    const shortsChannelId = youtubeSettings.shortsNotificationChannelId || defaultChannelId;
    const livestreamChannelId = youtubeSettings.livestreamNotificationChannelId || defaultChannelId;
    
    console.log(`[YouTube Channel Config] Server: ${serverId}`);
    console.log(`- Default channel ID: ${defaultChannelId}`);
    console.log(`- Video channel ID: ${videoChannelId}`);
    console.log(`- Shorts channel ID: ${shortsChannelId}`);
    console.log(`- Livestream channel ID: ${livestreamChannelId}`);
    
    // Get the default notification channel (we still need this for validation)
    const defaultChannel = guild.channels.cache.get(defaultChannelId);
    if (!defaultChannel) {
      console.log(`Default notification channel ${defaultChannelId} not found for server ${serverId}`);
      return;
    }
    
    // Validate and cache all the specialized channels
    const channels = {
      video: guild.channels.cache.get(videoChannelId),
      shorts: guild.channels.cache.get(shortsChannelId),
      livestream: guild.channels.cache.get(livestreamChannelId),
      default: defaultChannel
    };
    
    console.log(`[YouTube Channels Loaded]`);
    console.log(`- Default channel: ${channels.default.name}`);
    console.log(`- Video channel: ${channels.video ? channels.video.name : 'Same as default'}`);
    console.log(`- Shorts channel: ${channels.shorts ? channels.shorts.name : 'Same as default'}`);
    console.log(`- Livestream channel: ${channels.livestream ? channels.livestream.name : 'Same as default'}`);
    
    // Get the latest videos from the YouTube channel
    const latestVideos = await youtubeAPI.getLatestVideos(youtubeChannelId, 3);
    if (!latestVideos || latestVideos.length === 0) {
      console.log(`No videos found for channel ${youtubeChannelId}`);
      return;
    }
    
    // Get the most recent video
    const latestVideo = latestVideos[0];
    
    // Check if we already notified about this video
    const lastVideoId = lastVideoIds.get(`${serverId}:${youtubeChannelId}`);
    
    // Process each of the latest videos (focus on most recent)
    for (const video of latestVideos.slice(0, 1)) {  // Just check the most recent for now
      // Skip videos we've already seen or notified about
      const videoKey = `${serverId}:${youtubeChannelId}:${video.id}`;
      
      // If this is a brand new video or we haven't seen any videos yet
      const isNewVideo = lastVideoId && video.id !== lastVideoId;
      
      // For livestreams, we need special handling
      const isLivestream = video.videoType === 'live' || video.videoType === 'upcoming_live';
      const livestreamKey = `${serverId}:${youtubeChannelId}:live:${video.id}`;
      const isActiveLivestream = activeLivestreams.has(livestreamKey);
      
      // Add a debug log to see what's happening
      console.log(`Processing video ${video.id} | Type: ${video.videoType} | isNewVideo: ${isNewVideo} | isLivestream: ${isLivestream}`);
      
      // Temporarily disable the skip logic for testing
      // if (!isNewVideo && !isLivestream) {
      //   continue;
      // }
      
      // For livestreams, only notify once when they first go live
      // if (isLivestream && isActiveLivestream) {
      //   continue;
      // }
      
      // Check if the notification type is enabled in settings
      if (
        (video.videoType === 'short' && !notificationSettings.shorts) ||
        (video.videoType === 'live' && !notificationSettings.livestreams) ||
        (video.videoType === 'upcoming_live' && !notificationSettings.scheduledStreams) ||
        (video.videoType === 'video' && !notificationSettings.videos)
      ) {
        console.log(`Skipping notification for ${video.videoType} (ID: ${video.id}) - notification type disabled in server settings`);
        continue;
      }
      
      console.log(`New content detected for channel ${youtubeChannelId} in server ${serverId}: ${video.id} (type: ${video.videoType})`);
      
      // Create a button row for the notification
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Watch Now')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.youtube.com/watch?v=${video.id}`)
          .setEmoji('▶️'),
        new ButtonBuilder()
          .setLabel('Channel')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.youtube.com/channel/${youtubeChannelId}`)
          .setEmoji('📺')
      );
      
      // Create an embed based on the content type
      let embed;
      let notificationContent;
      
      if (video.videoType === 'short') {
        // YouTube Short
        embed = new EmbedBuilder()
          .setTitle(`${video.title}`)
          .setDescription(video.description.length > 100 
            ? video.description.substring(0, 100) + '...' 
            : video.description)
          .setColor(0xFF0000) // YouTube red
          .setURL(`https://www.youtube.com/shorts/${video.id}`)
          .setAuthor({
            name: `${serverConfig.youtubeChannelName || 'YouTube Channel'} posted a Short!`,
            url: `https://www.youtube.com/channel/${youtubeChannelId}`,
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          })
          .setImage(video.thumbnailUrl)
          .setTimestamp(new Date(video.publishedAt))
          .setFooter({
            text: `#Shorts • ${video.viewCount} views`,
            iconURL: 'https://i.imgur.com/8oQWZ0x.png' // YouTube Shorts icon
          });
          
        notificationContent = serverConfig.mentionRoleId 
          ? `<@&${serverConfig.mentionRoleId}> **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** just posted a new Short! 📱`
          : `📱 **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** just posted a new Short!`;
      }
      else if (video.videoType === 'live') {
        // Live Stream
        embed = new EmbedBuilder()
          .setTitle(`🔴 LIVE: ${video.title}`)
          .setDescription(video.description.length > 150 
            ? video.description.substring(0, 150) + '...' 
            : video.description)
          .setColor(0xFF0000) // YouTube red
          .setURL(`https://www.youtube.com/watch?v=${video.id}`)
          .setAuthor({
            name: `${serverConfig.youtubeChannelName || 'YouTube Channel'} is LIVE NOW!`,
            url: `https://www.youtube.com/channel/${youtubeChannelId}`,
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          })
          .setImage(video.thumbnailUrl)
          .setTimestamp()
          .addFields(
            { name: '👁️ Watching', value: `${video.liveStatus?.concurrentViewers || 'N/A'}`, inline: true },
            { name: '⏰ Started', value: `<t:${Math.floor(new Date(video.liveStatus?.actualStartTime).getTime() / 1000)}:R>`, inline: true }
          )
          .setFooter({
            text: '🔴 LIVE NOW!',
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          });
          
        notificationContent = serverConfig.mentionRoleId 
          ? `<@&${serverConfig.mentionRoleId}> 🔴 **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** is LIVE NOW! Don't miss it!`
          : `🔴 **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** is LIVE NOW! Don't miss it!`;
          
        // Mark this livestream as active to avoid duplicate notifications
        activeLivestreams.set(livestreamKey, true);
      }
      else if (video.videoType === 'upcoming_live') {
        // Scheduled Stream
        embed = new EmbedBuilder()
          .setTitle(`🗓️ SCHEDULED: ${video.title}`)
          .setDescription(video.description.length > 150 
            ? video.description.substring(0, 150) + '...' 
            : video.description)
          .setColor(0x3498DB) // Blue color for scheduled
          .setURL(`https://www.youtube.com/watch?v=${video.id}`)
          .setAuthor({
            name: `${serverConfig.youtubeChannelName || 'YouTube Channel'} scheduled a stream!`,
            url: `https://www.youtube.com/channel/${youtubeChannelId}`,
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          })
          .setImage(video.thumbnailUrl)
          .setTimestamp(new Date(video.liveStatus?.scheduledStartTime))
          .addFields(
            { name: '⏰ Starting', value: `<t:${Math.floor(new Date(video.liveStatus?.scheduledStartTime).getTime() / 1000)}:R>`, inline: true }
          )
          .setFooter({
            text: '🗓️ Upcoming Stream',
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          });
          
        notificationContent = serverConfig.mentionRoleId 
          ? `<@&${serverConfig.mentionRoleId}> 🗓️ **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** scheduled a live stream!`
          : `🗓️ **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** scheduled a live stream!`;
      }
      else {
        // Regular Video
        embed = new EmbedBuilder()
          .setTitle(video.title)
          .setDescription(video.description.length > 200 
            ? video.description.substring(0, 200) + '...' 
            : video.description)
          .setColor(0xFF0000) // YouTube red
          .setURL(`https://www.youtube.com/watch?v=${video.id}`)
          .setAuthor({
            name: `${serverConfig.youtubeChannelName || 'YouTube Channel'} uploaded a new video!`,
            url: `https://www.youtube.com/channel/${youtubeChannelId}`,
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          })
          .setImage(video.thumbnailUrl)
          .setTimestamp(new Date(video.publishedAt))
          .addFields(
            { name: '⏱️ Duration', value: video.durationFormatted, inline: true },
            { name: '👁️ Views', value: video.viewCount.toString(), inline: true }
          )
          .setFooter({
            text: '📺 New YouTube Video',
            iconURL: 'https://i.imgur.com/uPJDGNX.png' // YouTube logo
          });
          
        notificationContent = serverConfig.mentionRoleId 
          ? `<@&${serverConfig.mentionRoleId}> **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** just uploaded a new video! 🎬`
          : `🎬 **${serverConfig.youtubeChannelName || 'Your subscribed channel'}** just uploaded a new video!`;
      }
      
      // Determine which channel to send the notification to based on content type
      let targetChannel;
      
      if (video.videoType === 'short') {
        targetChannel = channels.shorts || channels.default;
      } else if (video.videoType === 'live' || video.videoType === 'upcoming_live') {
        targetChannel = channels.livestream || channels.default;
      } else {
        targetChannel = channels.video || channels.default;
      }
      
      // Send the notification with the appropriate embed and buttons
      try {
        await targetChannel.send({
          content: notificationContent,
          embeds: [embed],
          components: [buttonRow]
        });
        console.log(`Sent notification for ${video.videoType} with ID ${video.id} to channel ${targetChannel.id}`);
      } catch (error) {
        console.error(`Error sending notification for ${video.id}:`, error);
        // Try sending to the default channel as a fallback
        if (targetChannel.id !== channels.default.id) {
          try {
            await channels.default.send({
              content: notificationContent + `\n*(Note: Failed to send to the configured ${video.videoType} channel, so sending here instead)*`,
              embeds: [embed],
              components: [buttonRow]
            });
            console.log(`Sent fallback notification for ${video.videoType} with ID ${video.id} to default channel ${channels.default.id}`);
          } catch (fallbackError) {
            console.error(`Error sending fallback notification for ${video.id}:`, fallbackError);
          }
        }
      }
    }
    
    // Update the last video ID
    lastVideoIds.set(`${serverId}:${youtubeChannelId}`, latestVideo.id);
    
  } catch (error) {
    console.error(`Error checking for new videos for server ${serverId}:`, error);
  }
  
  // Schedule the next check based on the server's configuration
  scheduleNextCheck(client, serverId);
}

/**
 * Schedules the next video check based on server configuration
 * @param {object} client Discord client
 * @param {string} serverId Discord server ID
 */
function scheduleNextCheck(client, serverId) {
  // Clear any existing timeout for this server
  if (watcherTimeouts.has(serverId)) {
    clearTimeout(watcherTimeouts.get(serverId));
  }
  
  const serverConfig = config.getServerConfig(serverId);
  // Default to 60 minutes if not configured
  const checkFrequency = (serverConfig && serverConfig.videoCheckFrequency) 
    ? serverConfig.videoCheckFrequency * 60 * 1000 
    : 60 * 60 * 1000;
  
  // Schedule the next check
  const timeoutId = setTimeout(() => {
    checkForNewVideos(client, serverId);
  }, checkFrequency);
  
  // Store the timeout ID
  watcherTimeouts.set(serverId, timeoutId);
}

/**
 * Starts watching YouTube channels for all servers
 * @param {object} client Discord client
 */
function startWatching(client) {
  // Get all servers
  const allConfigs = config.loadConfig();
  
  // Start watching for each server
  for (const serverId in allConfigs) {
    // Do an initial check
    checkForNewVideos(client, serverId);
  }
  
  // Also set up checking when the bot joins a new server
  client.on('guildCreate', (guild) => {
    console.log(`Joined new server: ${guild.name} (${guild.id})`);
    checkForNewVideos(client, guild.id);
  });
  
  console.log('YouTube channel watcher started');
}

module.exports = {
  startWatching,
  checkForNewVideos
};