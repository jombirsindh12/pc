/**
 * This module helps process emoji codes in messages to Discord's format
 * It supports standard unicode emojis, custom server emojis, and special animated emojis
 */

// Mapping of discord-supported emoji codes to their unicode equivalents
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
  ':gem:': '💎',
  ':crown:': '👑',
  ':small_blue_diamond:': '🔹',
  ':large_blue_diamond:': '🔷',
  ':warning:': '⚠️',
  ':bell:': '🔔',
  ':lock:': '🔒',
  ':key:': '🔑',
  ':tada:': '🎉',
  ':confetti:': '🎊',
  ':trophy:': '🏆',
  ':medal:': '🏅',
  ':ticket:': '🎫',
  ':gift:': '🎁',
  ':dizzy:': '💫',
  ':rocket:': '🚀',
  ':shield:': '🛡️',
  ':scroll:': '📜',
  ':speech_balloon:': '💬',
  ':shopping_cart:': '🛒',
  ':clock2:': '🕒',
  ':white_check_mark:': '✅',
  ':red_circle:': '🔴',
  ':green_circle:': '🟢',
  ':blue_circle:': '🔵',
  ':orange_circle:': '🟠',
  ':link:': '🔗',
  ':crown:': '👑',
  ':pushpin:': '📌',
  ':musical_note:': '🎵',
  ':notes:': '🎶',
  ':loudspeaker:': '📢',
  ':mega:': '📣',
  ':sparkle:': '❇️',
  ':stars:': '🌠',
  ':diamond_shape_with_a_dot_inside:': '💠',
  ':eight_pointed_black_star:': '✴️',
  ':eight_spoked_asterisk:': '✳️',
  ':high_brightness:': '🔆',
  ':low_brightness:': '🔅',
  ':sun_with_face:': '🌞',
  ':sunglasses:': '😎',
  ':rainbow:': '🌈',
  ':cloud:': '☁️',
  ':ocean:': '🌊',
  ':snowflake:': '❄️',
  ':comet:': '☄️',
  ':anchor:': '⚓',
  ':hourglass:': '⌛',
  ':timer_clock:': '⏲️',
  ':alarm_clock:': '⏰',
  ':thought_balloon:': '💭',
  ':calendar:': '📅',
  ':book:': '📕',
  ':books:': '📚',
  ':bulb:': '💡',
  ':pencil2:': '✏️',
  ':checkered_flag:': '🏁',
  ':triangular_flag_on_post:': '🚩',
  ':goal_net:': '🥅',
  ':dart:': '🎯',
  ':gem:': '💎',
  ':moneybag:': '💰',
  ':dollar:': '💵',
  ':chart_with_upwards_trend:': '📈',
  ':globe_with_meridians:': '🌐'
};

// Mapping for animated emoji IDs
const animatedEmojis = {
  // Server-specific animated emojis with their IDs
  ':redcrown:': { name: 'redcrown', id: '1025355756511432776' },
  ':greenbolt:': { name: 'greenbolt', id: '1215595223477125120' },
  ':arrow_heartright:': { name: 'arrow_heartright', id: '1017682681024229377' },
  ':1z_love:': { name: '1z_love', id: '1216659232003457065' },
  ':lol:': { name: 'lol', id: '1301275117434966016' },
  ':partying_face:': { name: 'partying_face', id: '1301275117434966016' },
  ':verified:': { name: 'verified', id: '1242851202434605097' },
  ':wave_animated:': { name: 'wave_animated', id: '1065621149775581244' },
  ':nitro_boost:': { name: 'nitro_boost', id: '1067854919261257822' },
  ':loading:': { name: 'loading', id: '1089242072111329411' },
  ':discordloading:': { name: 'discordloading', id: '1076876224242495588' },
  ':GTALoading:': { name: 'GTALoading', id: '1337142161673814057' },
  
  // Nitro exclusive animated sticker emojis
  ':ablobcathyperkitty:': { name: 'ablobcathyperkitty', id: '1129181853050503198' },
  ':stars_animated:': { name: 'stars_animated', id: '1129181901559484458' },
  ':rainbow_shine:': { name: 'rainbow_shine', id: '1129181904952692887' },
  ':woah_animated:': { name: 'woah_animated', id: '1076876224242495588' },
  ':nitro_badge:': { name: 'nitro_badge', id: '1149211287807234078' },
  ':nitro_rocket:': { name: 'nitro_rocket', id: '1149211290613276752' },
  ':nitro_wumpus:': { name: 'nitro_wumpus', id: '1149211294836871248' },
  ':nitro_fire:': { name: 'nitro_fire', id: '1149211297479835700' },
  ':sparkles_nitro:': { name: 'sparkles_nitro', id: '1129181925471572138' },
  ':blob_vibing:': { name: 'blob_vibing', id: '1129181947365064885' },
  ':cat_dance:': { name: 'cat_dance', id: '1129181959281213531' },
  ':bongocat:': { name: 'bongocat', id: '1129181967594852422' },
  ':doggo_wave:': { name: 'doggo_wave', id: '1129181972489252904' },
  ':duck_dance:': { name: 'duck_dance', id: '1129181979267067985' },
  ':duck_duckdance:': { name: 'duck_duckdance', id: '1129181982295850186' },
  ':welcome_glow:': { name: 'welcome_glow', id: '1129181986427879545' },
  ':welcome_star:': { name: 'welcome_star', id: '1129181990505504808' },
  ':hearts_rainbow:': { name: 'hearts_rainbow', id: '1129182017063501914' },
  ':emoji_hearts:': { name: 'emoji_hearts', id: '1129182021170372638' },
  ':pepe_crown:': { name: 'pepe_crown', id: '1129182028615614504' },
  ':pepe_cool:': { name: 'pepe_cool', id: '1129182034072121426' },
  ':pepe_wave:': { name: 'pepe_wave', id: '1129182037738094804' },
  ':pepe_laugh:': { name: 'pepe_laugh', id: '1129182041832783902' },
  ':pepe_dance:': { name: 'pepe_dance', id: '1129182045281677352' },
  ':pepe_woah:': { name: 'pepe_woah', id: '1129182048939630643' },
  ':amongus_party:': { name: 'amongus_party', id: '1129182052866146445' },
  ':sus_animated:': { name: 'sus_animated', id: '1129182056524091423' },
  ':minecraft_diamond:': { name: 'minecraft_diamond', id: '1129182060136185916' },
  ':minecraft_pickaxe:': { name: 'minecraft_pickaxe', id: '1129182064058703932' },
  ':gaming_controller:': { name: 'gaming_controller', id: '1129182067909115974' },
  ':sonic_run:': { name: 'sonic_run', id: '1129182071932887040' },
  ':mario_coin:': { name: 'mario_coin', id: '1129182076367409222' },
  ':fire_animated:': { name: 'fire_animated', id: '1129182079593783346' },
  ':doge_wow:': { name: 'doge_wow', id: '1129182085809676319' },
  ':tada_celebrate:': { name: 'tada_celebrate', id: '1129182089371451433' },
  ':stonks_up:': { name: 'stonks_up', id: '1129182093298159657' },
  ':stonks_down:': { name: 'stonks_down', id: '1129182096725041256' },
  ':discord_nitro:': { name: 'discord_nitro', id: '1149211297479835700' },
  ':boost_animated:': { name: 'boost_animated', id: '1149211290613276752' },
  ':heart_sparkle:': { name: 'heart_sparkle', id: '1129182105138880542' },
  ':heart_rainbow:': { name: 'heart_rainbow', id: '1129182108775727114' },
  ':heart_blast:': { name: 'heart_blast', id: '1129182112899543190' },
  ':snowfall:': { name: 'snowfall', id: '1129182117023375432' },
  ':snowman_dance:': { name: 'snowman_dance', id: '1129182121499525151' },
  ':confetti_blast:': { name: 'confetti_blast', id: '1129182125426212915' }
};

/**
 * Process emoji codes in a message string to Discord format
 * Enhanced to match Discord's textbox emoji processing
 * Now supports all server emojis including Nitro emojis
 * 
 * @param {string} messageText - The message text to process
 * @param {Collection} serverEmojis - Collection of server emojis from guild.emojis.cache
 * @param {Client} client - Discord client for accessing global emojis across all servers
 * @returns {string} - The processed message with emojis in Discord format
 */
function processEmojis(messageText, serverEmojis = null, client = null) {
  if (!messageText) return messageText;
  
  let processedText = messageText;
  
  // Create a map of all available emojis from all servers the bot is in (for Nitro emojis)
  let allEmojis = new Map();
  if (client && client.guilds && client.guilds.cache) {
    client.guilds.cache.forEach(guild => {
      guild.emojis.cache.forEach(emoji => {
        // Don't override if we already have this emoji name (prioritize current server)
        if (!allEmojis.has(emoji.name)) {
          allEmojis.set(emoji.name, emoji);
        }
      });
    });
    
    // Log available emojis for debugging
    console.log(`Loaded ${allEmojis.size} unique emojis from all servers the bot is in`);
  }
  
  // STEP 1: Pre-process common sticker formats (both {sticker:name} and [sticker:name])
  // Process sticker format {sticker:name}
  processedText = processedText.replace(/{sticker:([a-zA-Z0-9_]+)}/g, (match, name) => {
    // First check if this is a known server emoji
    if (allEmojis.has(name)) {
      const emoji = allEmojis.get(name);
      return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    }
    
    // Check if we have this sticker in our animated emojis collection
    const stickerCode = `:${name}:`;
    const foundEmoji = Object.keys(animatedEmojis).find(key => key === stickerCode);
    
    if (foundEmoji) {
      const emoji = animatedEmojis[foundEmoji];
      return `<a:${emoji.name}:${emoji.id}>`;
    }
    
    // If not found, return as is
    return match;
  });
  
  // Process sticker format [sticker:name]
  processedText = processedText.replace(/\[sticker:([a-zA-Z0-9_]+)\]/g, (match, name) => {
    // First check if this is a known server emoji
    if (allEmojis.has(name)) {
      const emoji = allEmojis.get(name);
      return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    }
    
    // Check if we have this sticker in our animated emojis collection
    const stickerCode = `:${name}:`;
    const foundEmoji = Object.keys(animatedEmojis).find(key => key === stickerCode);
    
    if (foundEmoji) {
      const emoji = animatedEmojis[foundEmoji];
      return `<a:${emoji.name}:${emoji.id}>`;
    }
    
    // If not found, return as is
    return match;
  });
  
  // STEP 2: Process already-formatted Discord emoji codes
  // These are already in Discord's format, just make sure they're well-formed
  // Handle <:name:id> and <a:name:id> formats that are already correct
  
  // STEP 3: Process animated emoji codes first (they take precedence)
  Object.keys(animatedEmojis).forEach(code => {
    const emoji = animatedEmojis[code];
    const emojiString = `<a:${emoji.name}:${emoji.id}>`;
    processedText = processedText.replace(new RegExp(code, 'g'), emojiString);
  });
  
  // STEP 4: Process unicode emojis (standard emojis)
  Object.keys(unicodeEmojis).forEach(code => {
    processedText = processedText.replace(new RegExp(code, 'g'), unicodeEmojis[code]);
  });
  
  // STEP 5: Process server-specific emojis 
  // First current server (if provided)
  if (serverEmojis) {
    serverEmojis.forEach(emoji => {
      const emojiCode = `:${emoji.name}:`;
      const emojiFormat = emoji.animated 
        ? `<a:${emoji.name}:${emoji.id}>` 
        : `<:${emoji.name}:${emoji.id}>`;
      
      // Skip if it looks like it might already have an ID attached
      if (processedText.includes(`<:${emoji.name}:`) || processedText.includes(`<a:${emoji.name}:`)) return;
      
      // Replace all instances
      processedText = processedText.replace(new RegExp(emojiCode, 'g'), emojiFormat);
    });
  }
  
  // Then from all other servers (Nitro emojis)
  if (allEmojis.size > 0) {
    allEmojis.forEach((emoji, name) => {
      const emojiCode = `:${name}:`;
      const emojiFormat = emoji.animated 
        ? `<a:${name}:${emoji.id}>` 
        : `<:${name}:${emoji.id}>`;
      
      // Skip if it looks like it might already have an ID attached
      if (processedText.includes(`<:${name}:`) || processedText.includes(`<a:${name}:`)) return;
      
      // Replace all instances
      processedText = processedText.replace(new RegExp(emojiCode, 'g'), emojiFormat);
    });
  }
  
  // STEP 6: Handle advanced Discord emoji formats
  
  // Handle direct Discord emoji input format (a:name:id)
  processedText = processedText.replace(/\ba:([a-zA-Z0-9_]+):(\d+)\b/g, '<a:$1:$2>');
  
  // Handle static emoji format (:name:id)
  processedText = processedText.replace(/\b:([a-zA-Z0-9_]+):(\d+)\b/g, '<:$1:$2>');
  
  // Handle specific emoji ID format for server emojis
  // Support both formats: :emoji_1234567890123: and :emoji:1234567890123:
  processedText = processedText.replace(/:([a-zA-Z0-9_]+)[_:](\d{10,20}):/g, (match, name, id) => {
    return `<:${name}:${id}>`;
  });
  
  // Turn <<name>> into {sticker:name} format for easier processing later
  processedText = processedText.replace(/<<([a-zA-Z0-9_]+)>>/g, '{sticker:$1}');
  
  // Handle special format: <<a:name:>> and <<:name:>> - try to find emoji by name
  processedText = processedText.replace(/<<(a?):([a-zA-Z0-9_]+):>>/g, (match, animated, name) => {
    // Special case for GTALoading - most reliable approach
    if (name === 'GTALoading') {
      return `<a:GTALoading:1337142161673814057>`;
    }
    
    // Check if we can find this emoji in our collection
    if (allEmojis && allEmojis.has(name)) {
      const emoji = allEmojis.get(name);
      return emoji.animated ? `<a:${name}:${emoji.id}>` : `<:${name}:${emoji.id}>`;
    }
    
    // Check built-in animated emojis
    const stickerCode = `:${name}:`;
    const foundEmoji = Object.keys(animatedEmojis).find(key => key === stickerCode);
    if (foundEmoji) {
      const emoji = animatedEmojis[foundEmoji];
      return `<a:${emoji.name}:${emoji.id}>`;
    }
    
    // If not found, return the original match
    console.log(`Could not find emoji for: ${match}`);
    return match;
  });
  
  // Fix escaped format: &lt;a:name:id&gt;
  processedText = processedText.replace(/&lt;a:([a-zA-Z0-9_]+):(\d+)&gt;/g, (match, name, id) => {
    return `<a:${name}:${id}>`;
  });
  
  // Fix escaped format: &lt;:name:id&gt;
  processedText = processedText.replace(/&lt;:([a-zA-Z0-9_]+):(\d+)&gt;/g, (match, name, id) => {
    return `<:${name}:${id}>`;
  });
  
  // Handle format with double colon: <a:name::id>
  processedText = processedText.replace(/<a:([a-zA-Z0-9_]+)::(\d+)>/g, (match, name, id) => {
    return `<a:${name}:${id}>`;
  });
  
  // Handle format with double colon: <:name::id>
  processedText = processedText.replace(/<:([a-zA-Z0-9_]+)::(\d+)>/g, (match, name, id) => {
    return `<:${name}:${id}>`;
  });
  
  // Special handling for specific emoji IDs that are commonly used
  const specificEmojiIds = {
    ':emoji_1743942949268:': '<:emoji:1743942949268>',
    ':emoji:1743942949268:': '<:emoji:1743942949268>',
    ':emoji_1743942949269:': '<:emoji:1743942949269>',
    ':GTALoading:': '<a:GTALoading:1337142161673814057>',
    '<<a:GTALoading:>>': '<a:GTALoading:1337142161673814057>'
  };
  
  Object.keys(specificEmojiIds).forEach(emojiCode => {
    processedText = processedText.replace(new RegExp(emojiCode, 'g'), specificEmojiIds[emojiCode]);
  });
  
  // Handle utility emoji formats common in servers
  processedText = processedText.replace(/:Utility([a-zA-Z0-9_]+):/g, (match, name) => {
    // If the server has this emoji in cache, we'll use the correct ID
    // Otherwise fallback to a generalized ID
    return `<:Utility${name}:${name.toLowerCase().includes('blue') ? '968856321267245056' : '968856398166388777'}>`;
  });
  
  // Special handler for verification emojis
  processedText = processedText.replace(/:UtilityVerifyBlue:/g, '<:UtilityVerifyBlue:968856321267245056>');
  
  // Handle common utility emojis with proper IDs
  const utilityEmojis = {
    ':utility_toppage:': '<:utility_toppage:968856398166388777>',
    ':utility_verify:': '<:utility_verify:968856321267245056>',
    ':utility_rules:': '<:utility_rules:968856320267234777>',
    ':utility_info:': '<:utility_info:968856319267244888>',
    ':utility_roles:': '<:utility_roles:968856318267245999>'
  };
  
  Object.keys(utilityEmojis).forEach(code => {
    processedText = processedText.replace(new RegExp(code, 'g'), utilityEmojis[code]);
  });
  
  // STEP 7: Fix malformed emoji code formatting
  
  // Fix format like <:emoji1234567> to <:emoji:1234567>
  processedText = processedText.replace(/<:([a-zA-Z0-9_]+)(\d{17,20})>/g, '<:$1:$2>');
  
  // Fix format like <a:emoji1234567> to <a:emoji:1234567>
  processedText = processedText.replace(/<a:([a-zA-Z0-9_]+)(\d{17,20})>/g, '<a:$1:$2>');
  
  // STEP 8: Fix any <a< prefix that might appear
  processedText = processedText.replace(/<a</g, '<a:');
  processedText = processedText.replace(/<a<a:/g, '<a:');
  
  // STEP 9: Fix any trailing duplicate IDs that sometimes happen with double formatting
  processedText = processedText.replace(/:(\d+)>:(\d+)>/g, ':$1>');
  processedText = processedText.replace(/:(\d+)>(\d+)>/g, ':$1>');
  
  // Handle direct use of GTALoading text
  if (processedText.includes('GTALoading')) {
    // Temporarily replace the already-formatted versions
    processedText = processedText.replace(/<a:GTALoading:1337142161673814057>/g, '##GTAPLACEHOLDER##');
    
    // Now perform the specific replacements
    processedText = processedText.replace(/:GTALoading:/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<<a:GTALoading:>>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/{sticker:GTALoading}/g, '<a:GTALoading:1337142161673814057>');
    
    // Replace all other instances but not inside already processed ones
    processedText = processedText.replace(/GTALoading/g, '<a:GTALoading:1337142161673814057>');
    
    // Restore the placeholders
    processedText = processedText.replace(/##GTAPLACEHOLDER##/g, '<a:GTALoading:1337142161673814057>');
    
    // Fix nested tags - all variants
    processedText = processedText.replace(/<a:<a:GTALoading:1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:<a:GTALoading:1337142161673814057>>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:<a:GTALoading:1337142161673814057>:1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:(<a:GTALoading:1337142161673814057>):1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:GTALoading:1337142161673814057>:1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:<a:<a:GTALoading:1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
    processedText = processedText.replace(/<a:<a:<a:GTALoading:1337142161673814057>:1337142161673814057>/g, '<a:GTALoading:1337142161673814057>');
  }
                                      
  // STEP 12: Prevent double-formatting of already formatted emojis
  // Convert double << or >> in emoji code to correct format
  processedText = processedText
    .replace(/<a<<a:/g, '<a:')
    .replace(/>>(\d+)>/g, ':$1>');
  
  return processedText;
}

module.exports = {
  processEmojis,
  unicodeEmojis,
  animatedEmojis
};