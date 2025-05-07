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
 * Process emoji codes in text
 * @param {string} text - The text to process
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Client} client - Discord client for Nitro support
 * @returns {string} Processed text with emojis
 */
function processEmojis(text, serverEmojis = null, client = null) {
  if (!text) return text;
  
  let processedText = text;
  
  // STEP 1: Handle special case for GTALoading first
  processedText = processedText.replace(/:GTALoading:/g, '<a:GTALoading:1337142161673814057>');
  processedText = processedText.replace(/\{sticker:GTALoading\}/g, '<a:GTALoading:1337142161673814057>');
  processedText = processedText.replace(/\[sticker:GTALoading\]/g, '<a:GTALoading:1337142161673814057>');
  processedText = processedText.replace(/<<a:GTALoading:>>/g, '<a:GTALoading:1337142161673814057>');
  processedText = processedText.replace(/<<GTALoading>>/g, '<a:GTALoading:1337142161673814057>');
  
  // STEP 2: Process sticker formats first
  processedText = processedText.replace(/\{sticker:([a-zA-Z0-9_]+)\}/g, (match, name) => {
    // Check animated emojis first
    const emojiCode = `:${name}:`;
    if (animatedEmojis[emojiCode]) {
      const emoji = animatedEmojis[emojiCode];
      return `<a:${emoji.name}:${emoji.id}>`;
    }
    
    // Check server emojis if available
    if (serverEmojis) {
      const emoji = serverEmojis.find(e => e.name === name);
      if (emoji) {
        return emoji.animated ? `<a:${name}:${emoji.id}>` : `<:${name}:${emoji.id}>`;
      }
    }
    
    // Check all server emojis if client is provided (Nitro support)
    if (client && client.guilds) {
      let found = null;
      client.guilds.cache.forEach(guild => {
        if (found) return;
        
        const emoji = guild.emojis.cache.find(e => e.name === name);
        if (emoji) found = emoji;
      });
      
      if (found) {
        return found.animated 
          ? `<a:${found.name}:${found.id}>` 
          : `<:${found.name}:${found.id}>`;
      }
    }
    
    return emojiCode; // Return as text if emoji not found
  });
  
  // Process [sticker:name] format
  processedText = processedText.replace(/\[sticker:([a-zA-Z0-9_]+)\]/g, (match, name) => {
    // Check animated emojis first
    const emojiCode = `:${name}:`;
    if (animatedEmojis[emojiCode]) {
      const emoji = animatedEmojis[emojiCode];
      return `<a:${emoji.name}:${emoji.id}>`;
    }
    
    // Check server emojis if available
    if (serverEmojis) {
      const emoji = serverEmojis.find(e => e.name === name);
      if (emoji) {
        return emoji.animated ? `<a:${name}:${emoji.id}>` : `<:${name}:${emoji.id}>`;
      }
    }
    
    // Check all server emojis if client is provided (Nitro support)
    if (client && client.guilds) {
      let found = null;
      client.guilds.cache.forEach(guild => {
        if (found) return;
        
        const emoji = guild.emojis.cache.find(e => e.name === name);
        if (emoji) found = emoji;
      });
      
      if (found) {
        return found.animated 
          ? `<a:${found.name}:${found.id}>` 
          : `<:${found.name}:${found.id}>`;
      }
    }
    
    return emojiCode; // Return as text if emoji not found
  });
  
  // STEP 3: Process animated emojis from predefined list
  Object.keys(animatedEmojis).forEach(code => {
    const emoji = animatedEmojis[code];
    const formatted = `<a:${emoji.name}:${emoji.id}>`;
    processedText = processedText.replace(new RegExp(code, 'g'), formatted);
  });
  
  // STEP 4: Process Unicode emojis
  Object.keys(unicodeEmojis).forEach(code => {
    processedText = processedText.replace(new RegExp(code, 'g'), unicodeEmojis[code]);
  });
  
  // STEP 5: Process server-specific emojis
  if (serverEmojis) {
    serverEmojis.forEach(emoji => {
      const code = `:${emoji.name}:`;
      const formatted = emoji.animated 
        ? `<a:${emoji.name}:${emoji.id}>` 
        : `<:${emoji.name}:${emoji.id}>`;
      
      processedText = processedText.replace(new RegExp(code, 'g'), formatted);
    });
  }
  
  // STEP 6: Process emojis from all servers if client provided (Nitro support)
  if (client && client.guilds) {
    const processedEmojis = new Set(); // Track which emoji names we've already processed
    
    client.guilds.cache.forEach(guild => {
      guild.emojis.cache.forEach(emoji => {
        if (processedEmojis.has(emoji.name)) return; // Skip if already processed
        
        const code = `:${emoji.name}:`;
        const formatted = emoji.animated 
          ? `<a:${emoji.name}:${emoji.id}>` 
          : `<:${emoji.name}:${emoji.id}>`;
        
        processedText = processedText.replace(new RegExp(code, 'g'), formatted);
        processedEmojis.add(emoji.name);
      });
    });
  }
  
  // STEP 7: Fix any malformed emoji formats
  // First pass - fix most common issues
  processedText = processedText.replace(/<a:<a:<a:([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$2>');
  processedText = processedText.replace(/<a:<a:([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$2>');
  processedText = processedText.replace(/<a:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<a:$1:$2>');
  
  // Second pass - clean up any other special cases
  processedText = processedText.replace(/<a:(\w+):(\d+)>:(\d+)>/g, '<a:$1:$2>');
  
  // Additional cleanup for trailing ID numbers  
  processedText = processedText.replace(/:(\d+)>(\d+)>/g, ':$1>');
  processedText = processedText.replace(/:(\d+)>:(\d+)>/g, ':$1>');
  
  // Fix any formatting at start of emoji code
  processedText = processedText.replace(/<a</g, '<a:');
  processedText = processedText.replace(/<a<a:/g, '<a:');
  processedText = processedText.replace(/<<a:/g, '<a:');
  
  // Repeated fixes for stubborn cases
  for (let i = 0; i < 3; i++) {
    // Fix nested tags - all variants (repeat a few times to catch stubborn cases)
    processedText = processedText.replace(/<a:<a:([a-zA-Z0-9_]+):(\d+)>/g, '<a:$1:$2>');
    processedText = processedText.replace(/<a:<a:([a-zA-Z0-9_]+):(\d+)>>/g, '<a:$1:$2>');
    processedText = processedText.replace(/<a:(<a:([a-zA-Z0-9_]+):(\d+)>):(\d+)>/g, '<a:$2:$3>');
    processedText = processedText.replace(/<a:([a-zA-Z0-9_]+):(\d+)>:(\d+)>/g, '<a:$1:$2>');
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