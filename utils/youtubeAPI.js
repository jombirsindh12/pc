const axios = require('axios');
const dotenv = require('dotenv');

// Force reload environment variables
dotenv.config({ override: true });

// Get API key from environment variables
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
console.log('YouTube API Key status:', YOUTUBE_API_KEY ? 'API key is set' : 'API key is missing or empty');
if (YOUTUBE_API_KEY) {
  console.log('API Key Length:', YOUTUBE_API_KEY.length);
  console.log('API Key First 4 chars:', YOUTUBE_API_KEY.substring(0, 4));
  console.log('API Key Last 4 chars:', YOUTUBE_API_KEY.substring(YOUTUBE_API_KEY.length - 4));
}

// YouTube API base URL
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Function to validate if a channel ID exists
async function validateChannel(channelId) {
  console.log(`Attempting to validate YouTube channel ID: ${channelId}`);
  
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not found in environment variables');
    return false;
  }
  
  try {
    console.log(`Making API request to validate channel: ${channelId}`);
    console.log(`Using API Key: ${YOUTUBE_API_KEY ? 'API key is set' : 'API key is missing'}`);
    
    // First try with the direct ID
    let response = await axios.get(`${API_BASE_URL}/channels`, {
      params: {
        part: 'id',
        id: channelId,
        key: YOUTUBE_API_KEY
      }
    });
    
    let isValid = response.data.items && response.data.items.length > 0;
    
    // If not found, try with forUsername parameter (for legacy usernames)
    if (!isValid) {
      console.log(`Channel not found with ID, trying forUsername: ${channelId}`);
      
      response = await axios.get(`${API_BASE_URL}/channels`, {
        params: {
          part: 'id',
          forUsername: channelId,
          key: YOUTUBE_API_KEY
        }
      });
      
      isValid = response.data.items && response.data.items.length > 0;
      
      // If found by username, store the actual channel ID for future use
      if (isValid) {
        console.log(`Channel found by username: ${channelId}`);
        // Return the actual channel ID
        return response.data.items[0].id;
      }
    } else {
      console.log(`Channel found directly with ID: ${channelId}`);
    }
    
    // If still not found, try with search endpoint as a last resort
    if (!isValid) {
      console.log(`Channel not found with ID or username, trying search for: ${channelId}`);
      
      // Try to search for the channel
      response = await axios.get(`${API_BASE_URL}/search`, {
        params: {
          part: 'snippet',
          q: channelId,
          type: 'channel',
          maxResults: 1,
          key: YOUTUBE_API_KEY
        }
      });
      
      isValid = response.data.items && response.data.items.length > 0;
      
      if (isValid) {
        console.log(`Channel found via search: ${channelId}`);
        // Return the actual channel ID
        return response.data.items[0].id.channelId;
      } else {
        console.log(`No channel found for: ${channelId}`);
      }
    }
    
    console.log(`Final channel validation result: ${isValid ? 'Valid channel' : 'Invalid channel'}`);
    
    return isValid ? channelId : false;
  } catch (error) {
    console.error('Error validating YouTube channel:', error.response ? error.response.data : error.message);
    return false;
  }
}

// Function to get channel information
async function getChannelInfo(channelId) {
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not found in environment variables');
    return {
      title: 'Unknown Channel',
      description: 'Could not fetch channel info - API key missing',
      thumbnailUrl: null,
      subscriberCount: 'Unknown'
    };
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/channels`, {
      params: {
        part: 'snippet,statistics',
        id: channelId,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      return {
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails.default.url,
        subscriberCount: channel.statistics.subscriberCount
      };
    } else {
      return {
        title: 'Unknown Channel',
        description: 'Channel not found',
        thumbnailUrl: null,
        subscriberCount: 'Unknown'
      };
    }
  } catch (error) {
    console.error('Error fetching YouTube channel info:', error.response ? error.response.data : error.message);
    return {
      title: 'Unknown Channel',
      description: 'Error fetching channel info',
      thumbnailUrl: null,
      subscriberCount: 'Unknown'
    };
  }
}

// Function to verify subscription based on image processing results
async function verifySubscription(userId, channelId) {
  // Note: YouTube API doesn't allow checking other users' subscriptions
  // This is a limitation of the YouTube API for privacy reasons
  
  // For a real implementation, we would need to use OAuth to have users authenticate
  // and give permission to check their subscriptions
  
  console.log(`Verifying subscription based on image processing: userId=${userId}, channelId=${channelId}`);
  
  // If we detected a specific channel ID in the image processing
  if (userId) {
    try {
      // We can at least validate that the detected channel exists
      const isValidChannel = await validateChannel(userId);
      console.log(`Detected channel ID validation: ${isValidChannel ? 'Valid channel' : 'Invalid channel'}`);
      
      // If the channel in the image is the same as the required channel
      if (userId.toLowerCase() === channelId.toLowerCase()) {
        console.log('Channel ID in image matches required channel ID - EXACT MATCH');
        return true;
      }
      
      // Here we're accepting the image verification result as proof of subscription
      return isValidChannel;
    } catch (error) {
      console.error('Error validating detected channel ID:', error);
      // Fall back to image verification results only
      return true;
    }
  }
  
  // If we don't have a specific channel ID from the image,
  // we trust the image verification results (which detected subscription indicators)
  console.log('No channel ID detected in image, trusting image processing results');
  return true;
}

/**
 * Get the latest videos from a YouTube channel
 * @param {string} channelId - YouTube channel ID
 * @param {number} maxResults - Maximum number of videos to return
 * @returns {Array} Array of video objects with details including type (video, short, live)
 */
async function getLatestVideos(channelId, maxResults = 5) {
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not found in environment variables');
    return [];
  }
  
  try {
    // First get the uploads playlist ID for the channel
    const channelResponse = await axios.get(`${API_BASE_URL}/channels`, {
      params: {
        part: 'contentDetails',
        id: channelId,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      console.log(`No channel found with ID: ${channelId}`);
      return [];
    }
    
    const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
    
    // Now get the videos from the uploads playlist
    const videosResponse = await axios.get(`${API_BASE_URL}/playlistItems`, {
      params: {
        part: 'snippet',
        playlistId: uploadsPlaylistId,
        maxResults: maxResults,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
      console.log(`No videos found for channel: ${channelId}`);
      return [];
    }
    
    // Get the video IDs to fetch more details
    const videoIds = videosResponse.data.items.map(item => item.snippet.resourceId.videoId).join(',');
    
    // Get additional video details to determine if it's a short, live, etc.
    const videoDetailsResponse = await axios.get(`${API_BASE_URL}/videos`, {
      params: {
        part: 'snippet,contentDetails,statistics,liveStreamingDetails',
        id: videoIds,
        key: YOUTUBE_API_KEY
      }
    });
    
    // Create a map for quick lookup of video details
    const videoDetailsMap = {};
    if (videoDetailsResponse.data.items) {
      videoDetailsResponse.data.items.forEach(item => {
        videoDetailsMap[item.id] = item;
      });
    }
    
    // Format the video data with additional details
    const videos = videosResponse.data.items.map(item => {
      const videoId = item.snippet.resourceId.videoId;
      const details = videoDetailsMap[videoId] || {};
      
      // Determine if this is a short, live, or regular video
      let videoType = 'video'; // Default type
      
      if (details.contentDetails) {
        // YouTube Shorts are typically vertical videos with duration less than 60 seconds
        const duration = details.contentDetails.duration || '';
        const durationInSeconds = parseDuration(duration);
        
        // Check if it's a short (vertical ratio and short duration)
        if (durationInSeconds <= 60) {
          // YouTube shorts usually have #shorts in the title or description
          const isShort = 
            item.snippet.title.toLowerCase().includes('#shorts') || 
            item.snippet.description.toLowerCase().includes('#shorts');
            
          if (isShort) {
            videoType = 'short';
          }
        }
      }
      
      // Check if it's a livestream
      if (details.liveStreamingDetails) {
        if (details.liveStreamingDetails.actualEndTime) {
          videoType = 'completed_live'; // Completed livestream
        } else if (details.liveStreamingDetails.scheduledStartTime) {
          if (!details.liveStreamingDetails.actualStartTime) {
            videoType = 'upcoming_live'; // Scheduled but not yet started
          } else {
            videoType = 'live'; // Currently live
          }
        }
      }
      
      return {
        id: videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.high?.url || 
                     item.snippet.thumbnails.medium?.url || 
                     item.snippet.thumbnails.default?.url,
        videoType: videoType,
        viewCount: details.statistics?.viewCount || '0',
        likeCount: details.statistics?.likeCount || '0',
        duration: details.contentDetails?.duration || '',
        durationFormatted: formatDuration(details.contentDetails?.duration || ''),
        liveStatus: details.liveStreamingDetails ? {
          isLive: !!details.liveStreamingDetails.actualStartTime && !details.liveStreamingDetails.actualEndTime,
          scheduledStartTime: details.liveStreamingDetails.scheduledStartTime,
          actualStartTime: details.liveStreamingDetails.actualStartTime,
          actualEndTime: details.liveStreamingDetails.actualEndTime,
          concurrentViewers: details.liveStreamingDetails.concurrentViewers
        } : null
      };
    });
    
    return videos;
  } catch (error) {
    console.error('Error fetching latest videos:', error.response ? error.response.data : error.message);
    return [];
  }
}

/**
 * Parse ISO 8601 duration format to seconds
 * @param {string} duration - ISO 8601 duration string (e.g., PT1H30M15S)
 * @returns {number} Duration in seconds
 */
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format ISO 8601 duration to human-readable format
 * @param {string} duration - ISO 8601 duration string (e.g., PT1H30M15S)
 * @returns {string} Formatted duration (e.g., 1:30:15)
 */
function formatDuration(duration) {
  if (!duration) return '0:00';
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Search for YouTube channels by keyword
 * @param {string} query - Search query
 * @returns {Array} Array of channel objects
 */
async function searchChannels(query) {
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not found in environment variables');
    return [];
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        type: 'channel',
        q: query,
        maxResults: 5,
        key: YOUTUBE_API_KEY
      }
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      return [];
    }
    
    // Format the channel data
    const channels = response.data.items.map(item => {
      return {
        id: item.id.channelId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails.default.url
      };
    });
    
    return channels;
  } catch (error) {
    console.error('Error searching channels:', error.response ? error.response.data : error.message);
    return [];
  }
}

module.exports = {
  validateChannel,
  getChannelInfo,
  verifySubscription,
  getLatestVideos,
  searchChannels
};
