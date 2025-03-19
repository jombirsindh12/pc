const config = require('./config');
const youtubeAPI = require('./youtubeAPI');
const { MessageEmbed } = require('discord.js');

// Map to store last video IDs for channels
const lastVideoIds = new Map();

// Map to store the timeout IDs for each server
const watcherTimeouts = new Map();

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
    
    // If we have a new video and we have previously seen a different video
    if (lastVideoId && latestVideo.id !== lastVideoId) {
      console.log(`New video detected for channel ${youtubeChannelId} in server ${serverId}: ${latestVideo.id}`);
      
      // Create a nice embed for the notification
      const embed = {
        title: latestVideo.title,
        description: latestVideo.description.length > 200 
          ? latestVideo.description.substring(0, 200) + '...' 
          : latestVideo.description,
        color: 0xFF0000, // YouTube red
        url: `https://www.youtube.com/watch?v=${latestVideo.id}`,
        author: {
          name: serverConfig.youtubeChannelName || 'YouTube Channel',
          url: `https://www.youtube.com/channel/${youtubeChannelId}`
        },
        thumbnail: {
          url: latestVideo.thumbnailUrl
        },
        timestamp: new Date(latestVideo.publishedAt),
        footer: {
          text: '📺 New YouTube video!'
        }
      };
      
      // Send the notification
      await notificationChannel.send({
        content: serverConfig.mentionRoleId 
          ? `<@&${serverConfig.mentionRoleId}> New video from ${serverConfig.youtubeChannelName || 'your subscribed channel'}!` 
          : `📢 New video from ${serverConfig.youtubeChannelName || 'your subscribed channel'}!`,
        embeds: [embed]
      });
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