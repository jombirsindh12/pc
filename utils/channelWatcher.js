const config = require('./config');
const youtubeAPI = require('./youtubeAPI');

// Store last check results in memory to avoid duplicates
const lastCheckResults = {};

/**
 * Checks for new videos from the configured YouTube channel
 * @param {object} client Discord client
 * @param {string} serverId Discord server ID
 */
async function checkForNewVideos(client, serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    
    // Skip if no YouTube channel or notification channel configured
    if (!serverConfig.youtubeChannelId || !serverConfig.notificationChannelId) {
      return null;
    }
    
    console.log(`Checking for new videos for server ${serverId}, channel ${serverConfig.youtubeChannelId}`);
    
    // Get latest video information
    const latestVideos = await youtubeAPI.getLatestVideos(serverConfig.youtubeChannelId, 3);
    if (!latestVideos || !latestVideos.length) {
      console.log('No videos found or error getting videos');
      return null;
    }
    
    // Get the guild and notification channel
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      console.log(`Guild ${serverId} not found`);
      return null;
    }
    
    const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
    if (!notificationChannel) {
      console.log(`Notification channel ${serverConfig.notificationChannelId} not found in guild ${serverId}`);
      return null;
    }
    
    // If we haven't checked this channel before, initialize it
    if (!lastCheckResults[serverId]) {
      console.log(`First check for ${serverId}, storing latest video IDs`);
      lastCheckResults[serverId] = {
        lastVideoId: latestVideos[0].id,
        lastCheckTime: Date.now()
      };
      return null;
    }
    
    // Check if the newest video is different from what we've seen before
    const newestVideo = latestVideos[0];
    if (newestVideo.id !== lastCheckResults[serverId].lastVideoId) {
      console.log(`New video detected for ${serverId}: ${newestVideo.id}`);
      
      // Check if video is truly new (posted after our last check)
      const videoPublishedTime = new Date(newestVideo.publishedAt).getTime();
      const lastCheckTime = lastCheckResults[serverId].lastCheckTime;
      
      if (videoPublishedTime > lastCheckTime - 600000) { // 10 minute buffer for time discrepancies
        // Get channel info for better notification
        const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
        const channelName = channelInfo?.title || serverConfig.youtubeChannelName || 'YouTube Channel';
        
        // Send notification
        const mentionRole = serverConfig.roleId ? `<@&${serverConfig.roleId}>` : '';
        await notificationChannel.send({
          content: mentionRole ? `${mentionRole} New video from **${channelName}**!` : `New video from **${channelName}**!`,
          embeds: [{
            title: newestVideo.title,
            url: `https://www.youtube.com/watch?v=${newestVideo.id}`,
            description: newestVideo.description ? newestVideo.description.substring(0, 200) + '...' : 'No description',
            color: 0xFF0000, // Red color for YouTube
            fields: [
              { name: 'Channel', value: channelName, inline: true },
              { name: 'Published', value: new Date(newestVideo.publishedAt).toLocaleString(), inline: true }
            ],
            thumbnail: { url: newestVideo.thumbnailUrl },
            footer: { text: 'Click the title to watch the video' }
          }]
        });
        
        console.log(`Notification sent for new video ${newestVideo.id} in server ${serverId}`);
      } else {
        console.log('Video is not recent enough, skipping notification');
      }
      
      // Update the last seen video regardless
      lastCheckResults[serverId].lastVideoId = newestVideo.id;
    }
    
    // Update last check time
    lastCheckResults[serverId].lastCheckTime = Date.now();
    
    return true;
  } catch (error) {
    console.error(`Error checking for new videos for server ${serverId}:`, error);
    return null;
  }
}

/**
 * Starts watching YouTube channels for all servers
 * @param {object} client Discord client
 */
function startWatching(client) {
  console.log('Starting YouTube channel watcher');
  
  // Check all servers every 10 minutes
  setInterval(() => {
    // Get all server IDs from the client
    const serverIds = Array.from(client.guilds.cache.keys());
    
    // Check each server
    for (const serverId of serverIds) {
      checkForNewVideos(client, serverId).catch(error => {
        console.error(`Error in channel watcher for server ${serverId}:`, error);
      });
    }
  }, 10 * 60 * 1000); // Check every 10 minutes
}

module.exports = {
  startWatching,
  checkForNewVideos
};