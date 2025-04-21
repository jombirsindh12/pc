/**
 * Audio Manager for Discord Bot
 * Handles voice announcements and TTS features
 */

const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { createReadStream } = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const fs = require('fs');
const config = require('./config');

// Store active voice connections
const activeConnections = new Map();
const audioPlayers = new Map();

/**
 * Join a voice channel
 * @param {Object} channel - Discord voice channel
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Voice connection
 */
function joinChannel(channel, guildId) {
  try {
    if (!channel) {
      console.error('No channel provided to join');
      return null;
    }
    
    // Create a voice connection
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false, // Not deafened
      selfMute: false  // Not muted
    });
    
    // Store the connection
    activeConnections.set(guildId, connection);
    
    // Create a new audio player for this connection
    const player = createAudioPlayer();
    audioPlayers.set(guildId, player);
    
    // Subscribe the connection to the audio player
    connection.subscribe(player);
    
    // Set up event listeners
    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`Voice connection ready in guild ${guildId}`);
    });
    
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log(`Voice connection disconnected in guild ${guildId}`);
      
      // Clean up
      activeConnections.delete(guildId);
      audioPlayers.delete(guildId);
    });
    
    return connection;
  } catch (error) {
    console.error('Error joining voice channel:', error);
    return null;
  }
}

/**
 * Leave a voice channel
 * @param {string} guildId - Discord guild ID
 */
function leaveChannel(guildId) {
  try {
    // Get the connection
    const connection = activeConnections.get(guildId);
    
    if (connection) {
      // Destroy the connection
      connection.destroy();
      
      // Remove from our maps
      activeConnections.delete(guildId);
      audioPlayers.delete(guildId);
      
      console.log(`Left voice channel in guild ${guildId}`);
    }
  } catch (error) {
    console.error('Error leaving voice channel:', error);
  }
}

/**
 * Get the URL for text-to-speech
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (e.g., 'en', 'hi', 'es')
 * @returns {string} URL to the TTS audio
 */
function getTTSUrl(text, language = 'en') {
  // Encode text for URL
  const encodedText = encodeURIComponent(text);
  
  // Use Google Translate TTS (this is a simple approach)
  // Note: This is not an official API and might be subject to limitations
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${language}&client=tw-ob`;
}

/**
 * Download a file from a URL
 * @param {string} fileUrl - URL to download
 * @param {string} outputPath - Path to save the file
 * @returns {Promise} Promise that resolves when the file is downloaded
 */
function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    // Create the directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Parse the URL
    const parsedUrl = url.parse(fileUrl);
    
    // Set request options
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    
    // Make the request
    const req = https.request(options, (res) => {
      // Check if response is successful
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${res.statusCode}`));
        return;
      }
      
      // Create write stream
      const file = fs.createWriteStream(outputPath);
      
      // Pipe the response to the file
      res.pipe(file);
      
      // Handle file write completion
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
      
      // Handle errors
      res.on('error', (error) => {
        fs.unlink(outputPath, () => {});
        reject(error);
      });
    });
    
    // Handle request errors
    req.on('error', (error) => {
      fs.unlink(outputPath, () => {});
      reject(error);
    });
    
    // End the request
    req.end();
  });
}

/**
 * Speak text in a voice channel
 * @param {string} guildId - Discord guild ID
 * @param {string} text - Text to speak
 * @param {string} language - Language code (e.g., 'en', 'hi', 'es')
 * @returns {Promise} Promise that resolves when the speech is complete
 */
async function speak(guildId, text, language = 'en') {
  try {
    // Get the connection and player
    const connection = activeConnections.get(guildId);
    const player = audioPlayers.get(guildId);
    
    if (!connection || !player) {
      console.error(`No active voice connection for guild ${guildId}`);
      return false;
    }
    
    // Limit text length to prevent issues
    const maxLength = 200;
    const trimmedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    // Get the TTS URL
    const ttsUrl = getTTSUrl(trimmedText, language);
    
    // Create a temporary file path
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const outputPath = path.join(tempDir, `tts_${Date.now()}.mp3`);
    
    // Download the audio file
    await downloadFile(ttsUrl, outputPath);
    
    // Create an audio resource
    const resource = createAudioResource(createReadStream(outputPath));
    
    // Play the audio
    player.play(resource);
    
    // Return a promise that resolves when the audio is done playing
    return new Promise((resolve) => {
      player.once(AudioPlayerStatus.Idle, () => {
        // Clean up the temporary file
        try {
          fs.unlinkSync(outputPath);
        } catch (error) {
          console.error('Error deleting temporary audio file:', error);
        }
        
        resolve(true);
      });
    });
  } catch (error) {
    console.error('Error speaking in voice channel:', error);
    return false;
  }
}

/**
 * Announce a member joining a voice channel
 * @param {Object} member - Discord guild member
 * @param {Object} channel - Voice channel the member joined
 * @param {string} language - Language code for TTS
 */
async function announceJoin(member, channel, language = 'en') {
  try {
    const guildId = channel.guild.id;
    const connection = activeConnections.get(guildId);
    
    // If we don't have a connection yet, join the channel
    if (!connection) {
      await joinChannel(channel, guildId);
    }
    
    // Get the member's display name (nickname or username)
    const displayName = member.nickname || member.user.username;
    
    // Create the announcement text
    let announcement;
    
    if (language === 'hi') {
      announcement = `${displayName} वॉइस चैनल में जुड़ गए हैं`;
    } else if (language === 'hinglish') {
      announcement = `${displayName} voice channel me join kar liya hai`;
    } else {
      announcement = `${displayName} has joined the voice channel`;
    }
    
    // Speak the announcement
    await speak(guildId, announcement, language);
    
    return true;
  } catch (error) {
    console.error('Error announcing member join:', error);
    return false;
  }
}

/**
 * Announce a member leaving a voice channel
 * @param {Object} member - Discord guild member
 * @param {Object} channel - Voice channel the member left
 * @param {string} language - Language code for TTS
 */
async function announceLeave(member, channel, language = 'en') {
  try {
    const guildId = channel.guild.id;
    const connection = activeConnections.get(guildId);
    
    // If we don't have a connection, we can't announce
    if (!connection) {
      return false;
    }
    
    // Get the member's display name (nickname or username)
    const displayName = member.nickname || member.user.username;
    
    // Create the announcement text
    let announcement;
    
    if (language === 'hi') {
      announcement = `${displayName} वॉइस चैनल से निकल गए हैं`;
    } else if (language === 'hinglish') {
      announcement = `${displayName} voice channel se nikal gaye hain`;
    } else {
      announcement = `${displayName} has left the voice channel`;
    }
    
    // Speak the announcement
    await speak(guildId, announcement, language);
    
    return true;
  } catch (error) {
    console.error('Error announcing member leave:', error);
    return false;
  }
}

/**
 * Send a voice message to a channel
 * @param {string} guildId - Discord guild ID
 * @param {string} message - Message to speak
 * @param {string} language - Language code for TTS
 */
async function sendVoiceMessage(guildId, message, language = 'en') {
  try {
    const connection = activeConnections.get(guildId);
    
    // If we don't have a connection, we can't speak
    if (!connection) {
      console.error(`No active voice connection for guild ${guildId}`);
      return false;
    }
    
    // Speak the message
    await speak(guildId, message, language);
    
    return true;
  } catch (error) {
    console.error('Error sending voice message:', error);
    return false;
  }
}

// Export the functions
module.exports = {
  joinChannel,
  leaveChannel,
  speak,
  announceJoin,
  announceLeave,
  sendVoiceMessage
};