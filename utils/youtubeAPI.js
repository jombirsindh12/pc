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

// Function to verify subscription (Note: This is limited by YouTube API restrictions)
async function verifySubscription(userId, channelId) {
  // Note: YouTube API doesn't allow checking other users' subscriptions
  // This is a limitation of the YouTube API for privacy reasons
  
  // For a real implementation, we would need to use OAuth to have users authenticate
  // and give permission to check their subscriptions
  
  // Since we can't actually verify subscriptions through the API without OAuth,
  // we'll simply simulate verification based on the image processing results
  
  console.log(`Simulating verification of user subscription: userId=${userId}, channelId=${channelId}`);
  
  // For demonstration purposes, we'll assume the image processing was accurate
  // In a real implementation with OAuth, you would use:
  // GET https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&forChannelId={channelId}&mine=true
  
  // Return true if we have a userId (from image processing), otherwise 70% chance of success
  return userId ? true : Math.random() < 0.7;
}

module.exports = {
  validateChannel,
  getChannelInfo,
  verifySubscription
};
