/**
 * Advanced Emoji Processor for Discord Bot
 * Handles Unicode emojis, animated emojis, and Discord Nitro emojis across servers
 */

// Standard Unicode emoji mappings
const unicodeEmojis = {
  // Basic emoticons
  ':smile:': '😄',
  ':laughing:': '😆',
  ':blush:': '😊',
  ':smiley:': '😃',
  ':relaxed:': '☺️',
  ':grinning:': '😀',
  ':joy:': '😂',
  ':sweat_smile:': '😅',
  ':sob:': '😭',
  ':rage:': '😡',
  ':triumph:': '😤',
  ':sleepy:': '😪',
  
  // Hearts
  ':heart:': '❤️',
  ':blue_heart:': '💙',
  ':green_heart:': '💚',
  ':purple_heart:': '💜',
  ':yellow_heart:': '💛',
  ':orange_heart:': '🧡',
  ':black_heart:': '🖤',
  ':white_heart:': '🤍',
  ':broken_heart:': '💔',
  ':sparkling_heart:': '💖',
  ':heartbeat:': '💓',
  ':heartpulse:': '💗',
  ':two_hearts:': '💕',
  ':revolving_hearts:': '💞',
  
  // Common symbols
  ':eyes:': '👀',
  ':fire:': '🔥',
  ':sparkles:': '✨',
  ':star:': '⭐',
  ':star2:': '🌟',
  ':zap:': '⚡',
  ':boom:': '💥',
  ':pray:': '🙏',
  ':ok_hand:': '👌',
  ':v:': '✌️',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':100:': '💯',
  ':crown:': '👑',
  ':warning:': '⚠️',
  ':tada:': '🎉',
  ':sparkler:': '🎇',
  ':tickets:': '🎟️',
  ':gem:': '💎',
  
  // Status indicators
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':exclamation:': '❗',
  ':question:': '❓',
  ':grey_question:': '❔',
  ':grey_exclamation:': '❕',
  ':interrobang:': '⁉️',
  
  // Technical
  ':gear:': '⚙️',
  ':wrench:': '🔧',
  ':tools:': '🛠️',
  ':shield:': '🛡️',
  ':lock:': '🔒',
  ':unlock:': '🔓',
  ':key:': '🔑',
  ':bell:': '🔔',
  ':no_bell:': '🔕',
  ':link:': '🔗',
  ':pushpin:': '📌',
  ':bulb:': '💡',
  ':desktop:': '🖥️',
  ':computer:': '💻',
  ':keyboard:': '⌨️',
  ':email:': '📧',
  ':clock:': '🕐',
  
  // Gaming
  ':video_game:': '🎮',
  ':game_die:': '🎲',
  ':chess_pawn:': '♟️',
  ':dart:': '🎯',
  ':joystick:': '🕹️',
  
  // Security
  ':detective:': '🕵️',
  ':shield:': '🛡️',
  ':lock:': '🔒',
  ':key:': '🔑',
  ':police_officer:': '👮'
};

// Animated emoji mappings with IDs
const animatedEmojis = {
  ':redcrown:': { name: 'redcrown', id: '1025355756511432776' },
  ':greenbolt:': { name: 'greenbolt', id: '1215595223477125120' },
  ':GTALoading:': { name: 'GTALoading', id: '1337142161673814057' },
  ':loading:': { name: 'loading', id: '1089242072111329411' },
  ':discordloading:': { name: 'discordloading', id: '1076876224242495588' },
  ':verified:': { name: 'verified', id: '1089242072111329412' },
  ':typing:': { name: 'typing', id: '1076876224242495589' },
  ':boost:': { name: 'boost', id: '1025355756511432777' },
  ':nitro:': { name: 'nitro', id: '1025355756511432778' },
  ':wumpus:': { name: 'wumpus', id: '1025355756511432779' }
};

// Cache for processed emojis to improve performance
const emojiCache = new Map();

/**
 * Advanced emoji processor with error correction, caching and support for all Discord emoji formats
 * @param {string} text - The text to process
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Client} client - Discord client for Nitro support
 * @returns {string} Processed text with properly formatted emojis
 */
function processEmojis(text, serverEmojis = null, client = null) {
  if (!text) return text;
  
  // Check cache first for better performance
  const cacheKey = `${text}_${serverEmojis ? 'server' : 'noserver'}_${client ? 'nitro' : 'nonitro'}`;
  if (emojiCache.has(cacheKey)) {
    return emojiCache.get(cacheKey);
  }
  
  // ------ STAGE 1: Clean up problematic patterns ------
  
  // Fix common formatting errors in emoji syntax
  let cleanedText = text;
  
  // VERY specific fixes for the exact patterns mentioned by user
  if (text.includes('<a<a   1339685501099053097>1339685501099053097>')) {
    cleanedText = cleanedText.replace('<a<a   1339685501099053097>1339685501099053097>', '<a:emoji:1339685501099053097>');
  }
  
  if (text.includes('<<:minecraft_accept:1337142153205518457>1337142153205518457>')) {
    cleanedText = cleanedText.replace('<<:minecraft_accept:1337142153205518457>1337142153205518457>', '<:minecraft_accept:1337142153205518457>');
  }
  
  if (text.includes('<a<a:AI_verify_certified_owo_lol_anim:1337141718377693235>1337141718377693235>')) {
    cleanedText = cleanedText.replace('<a<a:AI_verify_certified_owo_lol_anim:1337141718377693235>1337141718377693235>', '<a:AI_verify_certified_owo_lol_anim:1337141718377693235>');
  }
  
  // Pattern matching for similar issues
  cleanedText = cleanedText
    // Fix double << at the start with emoji name
    .replace(/<<:([a-zA-Z0-9_]+):(\d+)>(\d+)>/g, '<:$1:$2>')
    
    // Fix <a<a: pattern with emoji name
    .replace(/<a<a:([a-zA-Z0-9_]+):(\d+)>(\d+)>/g, '<a:$1:$2>')
    
    // Handle numbered patterns without emoji name
    .replace(/<a<a\s+(\d+)>(\d+)>/g, '<a:emoji:$1>')
    .replace(/<a<a\s*(\d+)>(\d+)>/g, '<a:emoji:$1>')
    
    // General duplicated <a pattern fix (do this after specific fixes)
    .replace(/<a<a/g, '<a:')
    
    // Fix duplicate IDs in emoji patterns 
    .replace(/<a:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<a:$1:$2>')
    .replace(/<a:([a-zA-Z0-9_]+):(\d+)>(\d+)>/g, '<a:$1:$2>')
    .replace(/<:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<:$1:$2>')
    .replace(/<:([a-zA-Z0-9_]+):(\d+)>(\d+)>/g, '<:$1:$2>')
    
    // Replace emojis that are using direct unicode with proper format
    .replace(/<a:⚙️/g, '⚙️')
    .replace(/<a:([^\w:]+)/g, '$1')
    
    // Remove invalid emoji patterns completely
    .replace(/<a:a([_a-zA-Z0-9]+)>/g, '')
    .replace(/<:a([_a-zA-Z0-9]+)>/g, '')
    
    // Correct broken emoji format (missing colon)
    .replace(/<a([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$2>')
    .replace(/<([a-zA-Z0-9_]+):(\d+)>/g, '<:$1:$2>')
    
    // Handle improper nested emoji patterns
    .replace(/<a:([a-zA-Z0-9_]+):<a:([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$3>')
    .replace(/<:([a-zA-Z0-9_]+):<:([a-zA-Z0-9_]+):(\d+)>/g, '<:$1:$3>')
    
    // Catch and fix patterns with incorrect spacing
    .replace(/<a:\s+([a-zA-Z0-9_]+)\s+:(\d+)>/g, '<a:$1:$2>')
    
    // Handle malformed patterns with missing sections
    .replace(/<a:\s*(\d+)>/g, '<a:emoji:$1>')
    
    // Last resort - if we find any patterns matching this specific format, convert them
    .replace(/(\s*)(\d+)>(\d+)>/g, ' <a:emoji:$2>');
  
  let processedText = cleanedText;
  
  // ------ STAGE 2: Process actual emoji replacements ------
  
  // Process standard Unicode emojis
  for (const [code, unicode] of Object.entries(unicodeEmojis)) {
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), unicode);
  }
  
  // Process custom animated emojis - with special case handling
  if (processedText.includes(':GTALoading:')) {
    processedText = processedText.replace(/:GTALoading:/g, '<a:GTALoading:1337142161673814057>');
  }
  
  // Process all other animated emojis from our predefined list
  for (const [code, data] of Object.entries(animatedEmojis)) {
    if (code === ':GTALoading:') continue; // Already handled above
    
    const formatted = `<a:${data.name}:${data.id}>`;
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
  }
  
  // ------ STAGE 3: Process server-specific emojis ------
  
  if (serverEmojis) {
    // Create a Map for faster lookups
    const emojiMap = new Map();
    serverEmojis.forEach(emoji => {
      emojiMap.set(emoji.name, emoji);
    });
    
    // Process server emojis using the Map for better performance
    const serverEmojiRegex = /:([a-zA-Z0-9_]+):/g;
    processedText = processedText.replace(serverEmojiRegex, (match, name) => {
      const emoji = emojiMap.get(name);
      if (emoji) {
        return emoji.animated 
          ? `<a:${emoji.name}:${emoji.id}>` 
          : `<:${emoji.name}:${emoji.id}>`;
      }
      return match; // Return unchanged if no match
    });
  }
  
  // ------ STAGE 4: Process Nitro emojis from all servers (if client provided) ------
  
  if (client && client.guilds) {
    try {
      const allEmojisByName = new Map();
      
      // Collect all emojis from all guilds, keeping only first occurrence of each name
      client.guilds.cache.forEach(guild => {
        guild.emojis.cache.forEach(emoji => {
          if (!allEmojisByName.has(emoji.name)) {
            allEmojisByName.set(emoji.name, emoji);
          }
        });
      });
      
      // Process emojis across all servers the bot is in
      const nitroEmojiRegex = /:([a-zA-Z0-9_]+):/g;
      processedText = processedText.replace(nitroEmojiRegex, (match, name) => {
        const emoji = allEmojisByName.get(name);
        if (emoji) {
          return emoji.animated 
            ? `<a:${name}:${emoji.id}>` 
            : `<:${name}:${emoji.id}>`;
        }
        return match; // Return unchanged if no match
      });
    } catch (error) {
      console.error('Error processing Nitro emojis:', error);
      // Continue with what we have - don't break the entire process for Nitro error
    }
  }
  
  // Store in cache for future use
  emojiCache.set(cacheKey, processedText);
  
  // Limit cache size to prevent memory issues
  if (emojiCache.size > 1000) {
    const keysIterator = emojiCache.keys();
    emojiCache.delete(keysIterator.next().value); // Delete oldest entry
  }
  
  return processedText;
}

/**
 * Process sticker formats and convert them to emoji format
 * @param {string} text - The text to process 
 * @returns {string} Processed text with sticker formats converted to emoji format
 */
function processSticker(text) {
  if (!text) return text;
  
  // Check cache first
  if (emojiCache.has(`sticker_${text}`)) {
    return emojiCache.get(`sticker_${text}`);
  }
  
  let result = text;
  
  // Handle various sticker formats and convert to :name: format for the emoji processor
  
  // Format 1: {sticker:name}
  result = result.replace(/{sticker:([a-zA-Z0-9_]+)}/g, (match, name) => {
    return `:${name}:`;
  });
  
  // Format 2: [sticker:name]
  result = result.replace(/\[sticker:([a-zA-Z0-9_]+)\]/g, (match, name) => {
    return `:${name}:`;
  });
  
  // Format 3: <sticker:name>
  result = result.replace(/<sticker:([a-zA-Z0-9_]+)>/g, (match, name) => {
    return `:${name}:`;
  });
  
  // Store in cache
  emojiCache.set(`sticker_${text}`, result);
  
  return result;
}

/**
 * Helper function to escape special characters in regex patterns
 * @param {string} string - String to escape for regex
 * @returns {string} Escaped string safe for regex
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all available emojis as an object with metadata
 * @param {Client} client - Discord client
 * @returns {Object} Object containing all available emojis with metadata
 */
function getAvailableEmojis(client) {
  const emojis = {
    unicode: Object.keys(unicodeEmojis),
    animated: Object.keys(animatedEmojis),
    server: [],
    nitro: []
  };
  
  // Get all available emojis from servers the bot is in
  if (client && client.guilds) {
    const uniqueEmojis = new Map();
    
    client.guilds.cache.forEach(guild => {
      guild.emojis.cache.forEach(emoji => {
        if (!uniqueEmojis.has(emoji.name)) {
          uniqueEmojis.set(emoji.name, {
            name: emoji.name,
            id: emoji.id,
            animated: emoji.animated,
            guildName: guild.name,
            url: emoji.url
          });
          
          emojis.nitro.push(`:${emoji.name}:`);
        }
      });
    });
  }
  
  return emojis;
}

// Export functions and data
module.exports = {
  processEmojis,
  processSticker,
  unicodeEmojis,
  animatedEmojis,
  getAvailableEmojis
};