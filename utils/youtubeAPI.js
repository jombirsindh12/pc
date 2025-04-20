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
 * @returns {Array} Array of video objects
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
    
    // Format the video data
    const videos = videosResponse.data.items.map(item => {
      return {
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
      };
    });
    
    return videos;
  } catch (error) {
    console.error('Error fetching latest videos:', error.response ? error.response.data : error.message);
    return [];
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
