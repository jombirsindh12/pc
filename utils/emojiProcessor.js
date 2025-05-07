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
  ':discordloading:': { name: 'discordloading', id: '1076876224242495588' }
};

/**
 * Process emoji codes in a message string to Discord format
 * @param {string} messageText - The message text to process
 * @param {Collection} serverEmojis - Collection of server emojis from guild.emojis.cache
 * @returns {string} - The processed message with emojis in Discord format
 */
function processEmojis(messageText, serverEmojis = null) {
  let processedText = messageText;
  
  // Process animated emojis first (they take precedence)
  Object.keys(animatedEmojis).forEach(code => {
    const emoji = animatedEmojis[code];
    const emojiString = `<a:${emoji.name}:${emoji.id}>`;
    processedText = processedText.replace(new RegExp(code, 'g'), emojiString);
  });
  
  // Process unicode emojis
  Object.keys(unicodeEmojis).forEach(code => {
    processedText = processedText.replace(new RegExp(code, 'g'), unicodeEmojis[code]);
  });
  
  // Process server-specific emojis if provided
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
  
  // Handle CarlBot style animated emoji format like a:name:id
  const animatedEmojiRegex = /a:([a-zA-Z0-9_]+):(\d+)/g;
  processedText = processedText.replace(animatedEmojiRegex, '<a:$1:$2>');
  
  // Handle CarlBot style static emoji format like :name:id
  const staticEmojiRegex = /:([a-zA-Z0-9_]+):(\d+)/g;
  processedText = processedText.replace(staticEmojiRegex, '<:$1:$2>');
  
  // Handle incomplete emoji code formatting
  // Fix format like <:emoji1234567> to <:emoji:1234567>
  const incompleteEmojiRegex = /<:([a-zA-Z0-9_]+)(\d{17,20})>/g;
  processedText = processedText.replace(incompleteEmojiRegex, '<:$1:$2>');
  
  // Fix format like <a:emoji1234567> to <a:emoji:1234567>
  const incompleteAnimatedEmojiRegex = /<a:([a-zA-Z0-9_]+)(\d{17,20})>/g;
  processedText = processedText.replace(incompleteAnimatedEmojiRegex, '<a:$1:$2>');
  
  return processedText;
}

module.exports = {
  processEmojis,
  unicodeEmojis,
  animatedEmojis
};