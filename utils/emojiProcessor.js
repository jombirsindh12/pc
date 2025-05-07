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
 * Completely rewritten emoji processor using a more reliable approach
 * @param {string} text - The text to process
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Client} client - Discord client for Nitro support
 * @returns {string} Processed text with emojis
 */
function processEmojis(text, serverEmojis = null, client = null) {
  if (!text) return text;
  
  let processedText = text;
  
  // STEP 1: Handle GTALoading first (high priority case)
  const gtaEmoji = '<a:GTALoading:1337142161673814057>';
  processedText = processedText.replace(/:GTALoading:/g, gtaEmoji);
  processedText = processedText.replace(/\{sticker:GTALoading\}/g, gtaEmoji);
  processedText = processedText.replace(/\[sticker:GTALoading\]/g, gtaEmoji);
  processedText = processedText.replace(/<<a:GTALoading:>>/g, gtaEmoji);
  processedText = processedText.replace(/<<GTALoading>>/g, gtaEmoji);
  processedText = processedText.replace(/<a:GTALoading:/g, gtaEmoji);
  processedText = processedText.replace(/<a:GTALoading>/g, gtaEmoji);
  
  // STEP 2: Process sticker formats - only extract the name for later processing
  const stickerNames = [];
  
  // Find {sticker:name} format
  const stickerPattern1 = /\{sticker:([a-zA-Z0-9_]+)\}/g;
  let match;
  while ((match = stickerPattern1.exec(processedText)) !== null) {
    stickerNames.push(match[1]);
  }
  
  // Find [sticker:name] format
  const stickerPattern2 = /\[sticker:([a-zA-Z0-9_]+)\]/g;
  while ((match = stickerPattern2.exec(processedText)) !== null) {
    stickerNames.push(match[1]);
  }
  
  // Process each sticker name only once
  const processedStickers = new Set();
  for (const name of stickerNames) {
    if (processedStickers.has(name)) continue;
    processedStickers.add(name);
    
    // Create patterns for this sticker name
    const pattern1 = new RegExp(`\\{sticker:${name}\\}`, 'g');
    const pattern2 = new RegExp(`\\[sticker:${name}\\]`, 'g');
    const emojiCode = `:${name}:`;
    
    // Find the emoji
    let emoji = null;
    
    // Check predefined animated emojis first
    if (animatedEmojis[emojiCode]) {
      emoji = animatedEmojis[emojiCode];
      const formatted = `<a:${emoji.name}:${emoji.id}>`;
      processedText = processedText.replace(pattern1, formatted);
      processedText = processedText.replace(pattern2, formatted);
      continue; // Skip further checking for this name
    }
    
    // Check server emojis if available
    if (serverEmojis) {
      emoji = serverEmojis.find(e => e.name === name);
      if (emoji) {
        const formatted = emoji.animated 
          ? `<a:${emoji.name}:${emoji.id}>` 
          : `<:${emoji.name}:${emoji.id}>`;
        processedText = processedText.replace(pattern1, formatted);
        processedText = processedText.replace(pattern2, formatted);
        continue; // Skip further checking for this name
      }
    }
    
    // Check all server emojis if client is provided (Nitro support)
    if (client && client.guilds) {
      let found = null;
      client.guilds.cache.forEach(guild => {
        if (found) return;
        const guildEmoji = guild.emojis.cache.find(e => e.name === name);
        if (guildEmoji) found = guildEmoji;
      });
      
      if (found) {
        const formatted = found.animated 
          ? `<a:${found.name}:${found.id}>` 
          : `<:${found.name}:${found.id}>`;
        processedText = processedText.replace(pattern1, formatted);
        processedText = processedText.replace(pattern2, formatted);
        continue; // Skip further checking for this name
      }
    }
    
    // If no emoji found, just replace with emoji code
    processedText = processedText.replace(pattern1, emojiCode);
    processedText = processedText.replace(pattern2, emojiCode);
  }
  
  // STEP 3: Process predefined Unicode emojis (simple text replacement)
  for (const [code, unicode] of Object.entries(unicodeEmojis)) {
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), unicode);
  }
  
  // STEP 4: Process predefined animated emojis
  for (const [code, data] of Object.entries(animatedEmojis)) {
    const formatted = `<a:${data.name}:${data.id}>`;
    processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
  }
  
  // STEP 5: Process server emojis
  if (serverEmojis) {
    serverEmojis.forEach(emoji => {
      const code = `:${emoji.name}:`;
      const formatted = emoji.animated 
        ? `<a:${emoji.name}:${emoji.id}>` 
        : `<:${emoji.name}:${emoji.id}>`;
      
      processedText = processedText.replace(new RegExp(escapeRegExp(code), 'g'), formatted);
    });
  }
  
  // STEP 6: Process Nitro emojis from all servers
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
  
  // STEP 7: Clean up malformed emoji formats 
  // This completely rewrites the format with correct Discord format
  
  // Extract all emoji tags for cleanup
  const emojiTagPattern = /<a?:[a-zA-Z0-9_]+:(\d+)>/g;
  const foundEmojis = [];
  
  while ((match = emojiTagPattern.exec(processedText)) !== null) {
    let emojiTag = match[0];
    // Parse emoji details
    const emojiMatch = /<(a)?:([a-zA-Z0-9_]+):(\d+)>/.exec(emojiTag);
    if (emojiMatch) {
      const isAnimated = emojiMatch[1] === 'a';
      const name = emojiMatch[2];
      const id = emojiMatch[3];
      
      // Create properly formatted emoji
      const properEmoji = isAnimated ? `<a:${name}:${id}>` : `<:${name}:${id}>`;
      
      // Add to list with original text and replacement
      foundEmojis.push({
        original: match[0],
        replacement: properEmoji
      });
    }
  }
  
  // Replace all emojis with their proper format
  for (const emoji of foundEmojis) {
    // Use a global replace for this specific emoji tag
    const safeOriginal = escapeRegExp(emoji.original);
    const pattern = new RegExp(safeOriginal, 'g');
    processedText = processedText.replace(pattern, emoji.replacement);
  }
  
  // Fix any remaining issues with emoji formatting
  
  // Fix incorrect start of emoji tags
  processedText = processedText.replace(/<a</g, '<a:');
  processedText = processedText.replace(/<a:a:/g, '<a:');
  processedText = processedText.replace(/<<a:/g, '<a:');
  processedText = processedText.replace(/<::/g, '<:');
  processedText = processedText.replace(/<<:/g, '<:');
  
  // Fix multiple IDs at the end of emoji tags
  processedText = processedText.replace(/:(\d+)>(\d+)>/g, ':$1>');
  processedText = processedText.replace(/:(\d+)>:(\d+)>/g, ':$1>');
  
  // Fix nested emojis
  processedText = processedText.replace(/<a:<a:([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$2>');
  processedText = processedText.replace(/<a:<a:([a-zA-Z0-9_]+):(\d+)>>/g, '<a:$1:$2>');
  processedText = processedText.replace(/<:(<:([a-zA-Z0-9_]+):(\d+)>):/g, '<:$2:');
  processedText = processedText.replace(/<:(<:([a-zA-Z0-9_]+):(\d+)>):(\d+)>/g, '<:$2:$3>');
  
  // Fix leading and trailing tags
  processedText = processedText.replace(/^<a:a:/g, '<a:');
  processedText = processedText.replace(/^<a<:/g, '<a:');
  
  // Do final format cleanup - repeat for tough cases
  for (let i = 0; i < 3; i++) {
    // Replace any remaining malformed emojis with their proper format
    processedText = processedText.replace(/<a:([a-zA-Z0-9_]+)[^:]*:(\d+)>/, '<a:$1:$2>');
    processedText = processedText.replace(/<:([a-zA-Z0-9_]+)[^:]*:(\d+)>/, '<:$1:$2>');
    processedText = processedText.replace(/<a:([a-zA-Z0-9_]+):(\d+)>[^<](\d+)>/, '<a:$1:$2>');
    processedText = processedText.replace(/<:([a-zA-Z0-9_]+):(\d+)>[^<](\d+)>/, '<:$1:$2>');
    
    // Fix common issues with nesting and extra IDs
    processedText = processedText.replace(/<a:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<a:$1:$2>');
    processedText = processedText.replace(/<:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<:$1:$2>');
    
    // Fix emoji IDs that have extra characters
    processedText = processedText.replace(/<a:([a-zA-Z0-9_]+):(\d+)[^>]*>/g, '<a:$1:$2>');
    processedText = processedText.replace(/<:([a-zA-Z0-9_]+):(\d+)[^>]*>/g, '<:$1:$2>');
  }
  
  // Helper function to escape special characters in regex patterns
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // FINAL CLEANUP - Handle malformed emoji patterns
  
  // 1. Replace problematic <a:⚙️ pattern (gear emoji)
  processedText = processedText.replace(/<a:⚙️/g, '⚙️');
  
  // 2. Replace any <a:a style prefixes
  processedText = processedText.replace(/<a:a/g, '');
  
  // 3. Handle standalone <a:
  processedText = processedText.replace(/^<a:/g, '');
  
  // 4. Remove special cases when they are the entire content
  if (processedText === '<a:a') {
    processedText = '';
  }
  if (processedText === '<a:') {
    processedText = '';
  }
  if (processedText === '<a') {
    processedText = '';
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