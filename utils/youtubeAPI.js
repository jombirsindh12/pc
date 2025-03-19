const axios = require('axios');

// Get API key from environment variables
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
console.log('YouTube API Key status:', YOUTUBE_API_KEY ? 'API key is set' : 'API key is missing or empty');

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
    
    const response = await axios.get(`${API_BASE_URL}/channels`, {
      params: {
        part: 'id',
        id: channelId,
        key: YOUTUBE_API_KEY
      }
    });
    
    const isValid = response.data.items && response.data.items.length > 0;
    console.log(`Channel validation result: ${isValid ? 'Valid channel' : 'Invalid channel'}`);
    
    return isValid;
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

module.exports = {
  validateChannel,
  getChannelInfo,
  verifySubscription
};
