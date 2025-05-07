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
    if (!serverConfig || !serverConfig.youtubeChannelId || !serverConfig.notificationChannelId) {
      return;
    }
    
    const youtubeChannelId = serverConfig.youtubeChannelId;
    const notificationChannelId = serverConfig.notificationChannelId;
    
    // Get the notification settings or use defaults
    const notificationSettings = serverConfig.youtubeNotificationSettings || {
      videos: true,
      shorts: true,
      livestreams: true,
      scheduledStreams: true
    };
    
    // Get the notification channel from the server
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;
    
    const notificationChannel = guild.channels.cache.get(notificationChannelId);
    if (!notificationChannel) {
      console.log(`Notification channel ${notificationChannelId} not found for server ${serverId}`);
      return;
    }
    
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
      
      // Skip if we've already processed this video unless it's a livestream status change
      if (!isNewVideo && !isLivestream) {
        continue;
      }
      
      // For livestreams, only notify once when they first go live
      if (isLivestream && isActiveLivestream) {
        continue;
      }
      
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
      
      // Send the notification with the appropriate embed and buttons
      try {
        await notificationChannel.send({
          content: notificationContent,
          embeds: [embed],
          components: [buttonRow]
        });
        console.log(`Sent notification for ${video.videoType} with ID ${video.id} to channel ${notificationChannelId}`);
      } catch (error) {
        console.error(`Error sending notification for ${video.id}:`, error);
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