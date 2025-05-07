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
 * Completely rewritten emoji processor with minimal approach
 * @param {string} text - The text to process
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Client} client - Discord client for Nitro support
 * @returns {string} Processed text with emojis
 */
function processEmojis(text, serverEmojis = null, client = null) {
  if (!text) return text;
  
  // Remove problematic prefixes at the beginning of the text
  if (text.startsWith('<a:a')) {
    text = text.substring(4);
  } else if (text.startsWith('<a:')) {
    // Special handling for gear emoji
    if (text.startsWith('<a:⚙️')) {
      text = '⚙️' + text.substring(5);
    }
  }
  
  let processedText = text;
  
  // STEP 1: Process predefined Unicode emojis (simple text replacement)
  for (const [code, unicode] of Object.entries(unicodeEmojis)) {
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), unicode);
  }
  
  // STEP 2: Process predefined animated emojis
  for (const [code, data] of Object.entries(animatedEmojis)) {
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