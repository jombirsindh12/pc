/**
 * Simple emoji processor for Discord messages
 * Based on the ticket panel implementation approach
 */

// Common emoji mappings
const unicodeEmojis = {
  // Standard emojis
  ':smile:': '😄',
  ':laughing:': '😆',
  ':blush:': '😊',
  ':smiley:': '😃',
  ':relaxed:': '☺️',
  ':heart:': '❤️',
  ':blue_heart:': '💙',
  ':green_heart:': '💚',
  ':purple_heart:': '💜',
  ':yellow_heart:': '💛',
  ':rage:': '😡',
  ':triumph:': '😤',
  ':sleepy:': '😪',
  ':grinning:': '😀',
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
  ':sob:': '😭',
  ':joy:': '😂',
  ':sweat_smile:': '😅',
  ':crown:': '👑',
  ':warning:': '⚠️',
  ':tada:': '🎉'
};

// Animated emoji mapping
const animatedEmojis = {
  ':redcrown:': { name: 'redcrown', id: '1025355756511432776' },
  ':greenbolt:': { name: 'greenbolt', id: '1215595223477125120' },
  ':GTALoading:': { name: 'GTALoading', id: '1337142161673814057' },
  ':loading:': { name: 'loading', id: '1089242072111329411' },
  ':discordloading:': { name: 'discordloading', id: '1076876224242495588' }
};

/**
 * Very simple emoji processor with direct string manipulation
 * This version is designed to specifically target common problems
 * @param {string} text - The text to process
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Client} client - Discord client for Nitro support
 * @returns {string} Processed text with emojis
 */
function processEmojis(text, serverEmojis = null, client = null) {
  if (!text) return text;
  
  // Direct string replacement when we know exactly what's wrong
  // IMPORTANT: Clean all problematic patterns first
  
  // Fix 1: Remove <a:a patterns (primary problem)
  text = text.replace(/<a:a/g, '');
  
  // Fix 2: Fix emoji patterns that show ID numbers
  text = text.replace(/<a:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<a:$1:$2>');
  text = text.replace(/<a:([a-zA-Z0-9_]+):(\d+)>(\d+)>/g, '<a:$1:$2>');
  
  // Fix 3: Replace gear emoji specially
  text = text.replace(/<a:⚙️/g, '⚙️');
  
  // Fix 4: Additional pattern fix for issue shown in screenshot
  text = text.replace(/<a:a([_a-zA-Z0-9]+)>/g, '');
  
  let processedText = text;
  
  // Now proceed with normal emoji processing
  // STEP 1: Process predefined Unicode emojis (simple text replacement)
  for (const [code, unicode] of Object.entries(unicodeEmojis)) {
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), unicode);
  }
  
  // STEP 2: Process predefined animated emojis - special case for GTALoading
  if (processedText.includes(':GTALoading:')) {
    processedText = processedText.replace(/:GTALoading:/g, '<a:GTALoading:1337142161673814057>');
  }
  
  // Process remaining animated emojis
  for (const [code, data] of Object.entries(animatedEmojis)) {
    if (code === ':GTALoading:') continue; // Already handled
    
    const formatted = `<a:${data.name}:${data.id}>`;
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
  }
  
  // STEP 3: Process server emojis
  if (serverEmojis) {
    serverEmojis.forEach(emoji => {
      const code = `:${emoji.name}:`;
      const formatted = emoji.animated 
        ? `<a:${emoji.name}:${emoji.id}>` 
        : `<:${emoji.name}:${emoji.id}>`;
      
      processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
    });
  }
  
  // STEP 4: Process Nitro emojis from all servers
  if (client && client.guilds) {
    const allEmojisByName = new Map();
    
    // Collect all emojis, keeping only first occurrence of each name
    client.guilds.cache.forEach(guild => {
      guild.emojis.cache.forEach(emoji => {
        if (!allEmojisByName.has(emoji.name)) {
          allEmojisByName.set(emoji.name, emoji);
        }
      });
    });
    
    // Process each unique emoji
    allEmojisByName.forEach((emoji, name) => {
      const code = `:${name}:`;
      const formatted = emoji.animated 
        ? `<a:${name}:${emoji.id}>` 
        : `<:${name}:${emoji.id}>`;
      
      processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
    });
  }
  
  // Helper function to escape special characters in regex patterns
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  return processedText;
}

/**
 * Simple pre-processor for sticker formats
 * @param {string} text - The text to process 
 * @returns {string} Processed text with sticker formats converted
 */
function processSticker(text) {
  if (!text) return text;
  
  let result = text;
  
  // Convert {sticker:name} to :name: format
  result = result.replace(/{sticker:([a-zA-Z0-9_]+)}/g, (match, name) => {
    return `:${name}:`;
  });
  
  // Convert [sticker:name] to :name: format
  result = result.replace(/\[sticker:([a-zA-Z0-9_]+)\]/g, (match, name) => {
    return `:${name}:`;
  });
  
  return result;
}

module.exports = {
  processEmojis,
  processSticker,
  unicodeEmojis,
  animatedEmojis
};