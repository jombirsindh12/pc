const { processEmojis, processSticker, getAvailableEmojis, unicodeEmojis, animatedEmojis } = require('../utils/emojiProcessor');
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

module.exports = {
  name: 'emoji',
  description: 'Emoji system showcase & utilities',
  usage: '/emoji',
  guildOnly: true,
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'What do you want to do with emojis?',
      required: true,
      choices: [
        { name: 'View emoji gallery', value: 'gallery' },
        { name: 'Convert emoji text', value: 'convert' },
        { name: 'List categories', value: 'categories' },
        { name: 'Search emojis', value: 'search' },
        { name: 'Test emoji rendering', value: 'test' }
      ]
    },
    {
      name: 'text',
      type: 3, // STRING type
      description: 'Text input for the selected action (for conversion, search, etc.)',
      required: false
    },
    {
      name: 'category',
      type: 3, // STRING type
      description: 'Emoji category (for gallery view)',
      required: false,
      choices: [
        { name: 'Basic emoticons', value: 'emoticons' },
        { name: 'Hearts & Love', value: 'hearts' },
        { name: 'Symbols', value: 'symbols' },
        { name: 'Technical', value: 'technical' },
        { name: 'Gaming', value: 'gaming' },
        { name: 'Security', value: 'security' },
        { name: 'Animated', value: 'animated' },
        { name: 'Server emojis', value: 'server' }
      ]
    }
  ],

  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get parameters
    let action, text, category;
    
    if (isSlashCommand) {
      // Get parameters from slash command
      action = interaction.options.getString('action');
      text = interaction.options.getString('text');
      category = interaction.options.getString('category');
      
      // Defer reply to avoid timeouts
      await interaction.deferReply();
    } else {
      // Legacy command not supported
      return message.reply('Please use the slash command `/emoji` for emoji utilities.');
    }
    
    // Get available emojis
    const availableEmojis = getAvailableEmojis(client);
    
    // Handle different actions
    switch (action) {
      case 'gallery':
        await handleGallery(interaction, client, category);
        break;
      case 'convert':
        await handleTextConversion(interaction, client, text);
        break;
      case 'categories':
        await handleCategories(interaction, client);
        break;
      case 'search':
        await handleSearch(interaction, client, text);
        break;
      case 'test':
        await handleTestRendering(interaction, client, text);
        break;
      default:
        await interaction.followUp('Please select a valid action.');
    }
  }
};

/**
 * Handle the gallery view action - shows different emoji categories
 * @param {Object} interaction The Discord interaction
 * @param {Object} client The Discord client
 * @param {string} category Category to display
 */
async function handleGallery(interaction, client, category = 'emoticons') {
  // Create a map of emoji categories
  const categories = {
    emoticons: Object.entries(unicodeEmojis).filter(([code]) => 
      [':smile:', ':laughing:', ':blush:', ':smiley:', ':relaxed:', ':grinning:', 
       ':joy:', ':sweat_smile:', ':sob:', ':rage:', ':triumph:', ':sleepy:'].includes(code)),
    
    hearts: Object.entries(unicodeEmojis).filter(([code]) => 
      code.includes('heart') || [':sparkling_heart:', ':heartbeat:', ':heartpulse:', 
                                ':two_hearts:', ':revolving_hearts:'].includes(code)),
    
    symbols: Object.entries(unicodeEmojis).filter(([code]) => 
      [':100:', ':fire:', ':sparkles:', ':star:', ':star2:', ':zap:', ':boom:', 
       ':pray:', ':ok_hand:', ':v:', ':thumbsup:', ':thumbsdown:', ':crown:', 
       ':warning:', ':tada:', ':sparkler:', ':tickets:', ':gem:'].includes(code)),
    
    technical: Object.entries(unicodeEmojis).filter(([code]) => 
      [':gear:', ':wrench:', ':tools:', ':shield:', ':lock:', ':unlock:', ':key:', 
       ':bell:', ':no_bell:', ':link:', ':pushpin:', ':bulb:', ':desktop:', 
       ':computer:', ':keyboard:', ':email:', ':clock:'].includes(code)),
    
    gaming: Object.entries(unicodeEmojis).filter(([code]) => 
      [':video_game:', ':game_die:', ':chess_pawn:', ':dart:', ':joystick:'].includes(code)),
    
    security: Object.entries(unicodeEmojis).filter(([code]) => 
      [':detective:', ':shield:', ':lock:', ':key:', ':police_officer:'].includes(code)),
    
    animated: Object.entries(animatedEmojis)
  };
  
  // Get server emojis
  const serverEmojis = [];
  client.guilds.cache.forEach(guild => {
    guild.emojis.cache.forEach(emoji => {
      serverEmojis.push([`:${emoji.name}:`, {
        name: emoji.name,
        id: emoji.id,
        animated: emoji.animated,
        guildName: guild.name
      }]);
    });
  });
  
  // Add server emojis to categories
  categories.server = serverEmojis.slice(0, 20); // Limit to 20 to avoid message size limits
  
  // If category not provided or invalid, default to emoticons
  if (!category || !categories[category]) {
    category = 'emoticons';
  }
  
  // Get selected category
  const selectedCategory = categories[category];
  
  // Create embed with emojis from selected category
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)} Gallery`)
    .setDescription('Here are the emojis in this category:')
    .setFooter({ text: 'Use the dropdown menu below to view different categories' });
  
  // Create emoji list
  let emojiListContent = '';
  
  // For server & animated emojis (have different structure)
  if (category === 'server' || category === 'animated') {
    for (const [code, data] of selectedCategory) {
      const display = category === 'server' 
        ? (data.animated ? `<a:${data.name}:${data.id}>` : `<:${data.name}:${data.id}>`)
        : `<a:${data.name}:${data.id}>`;
        
      emojiListContent += `${display} - \`${code}\`\n`;
    }
    
    // Add note about server emojis or animated emojis
    if (category === 'server') {
      emojiListContent += `\n*Showing ${selectedCategory.length} of ${serverEmojis.length} server emojis*`;
    } else {
      emojiListContent += `\n*These can also be used with \`{sticker:name}\` format*`;
    }
  } else {
    // For unicode emojis
    for (const [code, unicode] of selectedCategory) {
      emojiListContent += `${unicode} - \`${code}\`\n`;
    }
  }
  
  // Add emoji field
  embed.addFields({ name: 'Available Emojis', value: emojiListContent || 'No emojis in this category' });
  
  // Add usage instructions field
  embed.addFields({
    name: '💡 How to Use',
    value: category === 'server' || category === 'animated'
      ? 'In messages and embeds, type the emoji code (e.g., `:smile:`) or use sticker format `{sticker:name}`'
      : 'In messages and embeds, type the emoji code (e.g., `:smile:` for 😄)'
  });
  
  // Create category select menu
  const categorySelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('emoji_category_select')
      .setPlaceholder('Select a category')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Basic Emoticons')
          .setValue('emoticons')
          .setDescription('Basic smiley faces and expressions')
          .setEmoji('😄'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Hearts & Love')
          .setValue('hearts')
          .setDescription('Heart emojis and love symbols')
          .setEmoji('❤️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Common Symbols')
          .setValue('symbols')
          .setDescription('Common symbols and indicators')
          .setEmoji('✨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Technical')
          .setValue('technical')
          .setDescription('Technical and tool emojis')
          .setEmoji('⚙️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Gaming')
          .setValue('gaming')
          .setDescription('Gaming related emojis')
          .setEmoji('🎮'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Security')
          .setValue('security')
          .setDescription('Security related emojis')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Animated Emojis')
          .setValue('animated')
          .setDescription('Animated custom emojis')
          .setEmoji('🎭'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Server Emojis')
          .setValue('server')
          .setDescription('Emojis from servers the bot is in')
          .setEmoji('🌐')
      ])
  );
  
  // Add utility buttons
  const utilityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('emoji_convert_button')
      .setLabel('Convert Text')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('emoji_test_button')
      .setLabel('Test Emoji')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍')
  );
  
  // Send the response
  const response = await interaction.followUp({
    embeds: [embed],
    components: [categorySelect, utilityRow]
  });
  
  // Set up collector for component interactions
  const filter = i => i.user.id === interaction.user.id && 
                     (i.customId === 'emoji_category_select' || 
                      i.customId === 'emoji_convert_button' || 
                      i.customId === 'emoji_test_button');
  
  const collector = response.createMessageComponentCollector({
    filter,
    time: 300000 // 5 minute timeout
  });
  
  collector.on('collect', async i => {
    if (i.customId === 'emoji_category_select') {
      // Handle category selection
      const selectedCategory = i.values[0];
      await i.deferUpdate();
      await handleGallery(interaction, client, selectedCategory);
    } else if (i.customId === 'emoji_convert_button') {
      // Show modal for text conversion
      const modal = {
        title: 'Convert Text with Emojis',
        custom_id: 'emoji_convert_modal',
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 4, // Text Input
                custom_id: 'emoji_text_input',
                label: 'Enter text with emoji codes',
                style: 2, // Paragraph
                placeholder: 'Enter text with emoji codes like :smile: or {sticker:name}',
                required: true
              }
            ]
          }
        ]
      };
      
      await i.showModal(modal);
    } else if (i.customId === 'emoji_test_button') {
      // Show modal for emoji testing
      const modal = {
        title: 'Test Emoji Rendering',
        custom_id: 'emoji_test_modal',
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 4, // Text Input
                custom_id: 'emoji_test_input',
                label: 'Enter emoji code to test',
                style: 1, // Short
                placeholder: 'Enter an emoji code like :heart: or :server_emoji:',
                required: true
              }
            ]
          }
        ]
      };
      
      await i.showModal(modal);
    }
  });
  
  // Set up collector for modal submissions
  const modalFilter = i => i.user.id === interaction.user.id && 
                           (i.customId === 'emoji_convert_modal' || 
                            i.customId === 'emoji_test_modal');
  
  interaction.client.on('interactionCreate', async i => {
    if (!i.isModalSubmit() || !modalFilter(i)) return;
    
    if (i.customId === 'emoji_convert_modal') {
      // Handle text conversion
      const text = i.fields.getTextInputValue('emoji_text_input');
      await i.deferReply({ ephemeral: true });
      await handleTextConversion(i, client, text);
    } else if (i.customId === 'emoji_test_modal') {
      // Handle emoji testing
      const text = i.fields.getTextInputValue('emoji_test_input');
      await i.deferReply({ ephemeral: true });
      await handleTestRendering(i, client, text);
    }
  });
}

/**
 * Handle text conversion action
 * @param {Object} interaction The Discord interaction
 * @param {Object} client The Discord client
 * @param {string} text The text to convert
 */
async function handleTextConversion(interaction, client, text) {
  if (!text) {
    return interaction.followUp({
      content: '❌ Please provide some text to convert.',
      ephemeral: true
    });
  }
  
  // Process stickers and emojis
  const processedText = processEmojis(processSticker(text), null, client);
  
  // Create response embed
  const embed = new EmbedBuilder()
    .setColor(0x00b894)
    .setTitle('✅ Emoji Conversion Result')
    .addFields(
      { name: 'Original Text', value: `\`\`\`\n${text}\n\`\`\`` },
      { name: 'Converted Text', value: processedText }
    )
    .setFooter({ text: 'All emoji codes and sticker formats have been processed' });
  
  // Send response
  await interaction.followUp({
    embeds: [embed],
    ephemeral: true
  });
}

/**
 * Handle categories action - shows all emoji categories
 * @param {Object} interaction The Discord interaction
 * @param {Object} client The Discord client
 */
async function handleCategories(interaction, client) {
  // Create counts for each category
  const emoticonsCount = Object.entries(unicodeEmojis).filter(([code]) => 
    [':smile:', ':laughing:', ':blush:', ':smiley:', ':relaxed:', ':grinning:', 
     ':joy:', ':sweat_smile:', ':sob:', ':rage:', ':triumph:', ':sleepy:'].includes(code)).length;
  
  const heartsCount = Object.entries(unicodeEmojis).filter(([code]) => 
    code.includes('heart') || [':sparkling_heart:', ':heartbeat:', ':heartpulse:', 
                             ':two_hearts:', ':revolving_hearts:'].includes(code)).length;
  
  const symbolsCount = Object.entries(unicodeEmojis).filter(([code]) => 
    [':100:', ':fire:', ':sparkles:', ':star:', ':star2:', ':zap:', ':boom:', 
     ':pray:', ':ok_hand:', ':v:', ':thumbsup:', ':thumbsdown:', ':crown:', 
     ':warning:', ':tada:', ':sparkler:', ':tickets:', ':gem:'].includes(code)).length;
  
  const technicalCount = Object.entries(unicodeEmojis).filter(([code]) => 
    [':gear:', ':wrench:', ':tools:', ':shield:', ':lock:', ':unlock:', ':key:', 
     ':bell:', ':no_bell:', ':link:', ':pushpin:', ':bulb:', ':desktop:', 
     ':computer:', ':keyboard:', ':email:', ':clock:'].includes(code)).length;
  
  const gamingCount = Object.entries(unicodeEmojis).filter(([code]) => 
    [':video_game:', ':game_die:', ':chess_pawn:', ':dart:', ':joystick:'].includes(code)).length;
  
  const securityCount = Object.entries(unicodeEmojis).filter(([code]) => 
    [':detective:', ':shield:', ':lock:', ':key:', ':police_officer:'].includes(code)).length;
  
  const animatedCount = Object.entries(animatedEmojis).length;
  
  // Count server emojis
  let serverCount = 0;
  client.guilds.cache.forEach(guild => {
    serverCount += guild.emojis.cache.size;
  });
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('📋 Emoji Categories')
    .setDescription('Here are all the available emoji categories:')
    .addFields(
      { 
        name: '😄 Basic Emoticons', 
        value: `${emoticonsCount} emojis - Basic smiley faces and expressions`,
        inline: true
      },
      { 
        name: '❤️ Hearts & Love', 
        value: `${heartsCount} emojis - Heart emojis and love symbols`,
        inline: true
      },
      { 
        name: '✨ Common Symbols', 
        value: `${symbolsCount} emojis - Common symbols and indicators`,
        inline: true
      },
      { 
        name: '⚙️ Technical', 
        value: `${technicalCount} emojis - Technical and tool emojis`,
        inline: true
      },
      { 
        name: '🎮 Gaming', 
        value: `${gamingCount} emojis - Gaming related emojis`,
        inline: true
      },
      { 
        name: '🛡️ Security', 
        value: `${securityCount} emojis - Security related emojis`,
        inline: true
      },
      { 
        name: '🎭 Animated Emojis', 
        value: `${animatedCount} emojis - Animated custom emojis`,
        inline: true
      },
      { 
        name: '🌐 Server Emojis', 
        value: `${serverCount} emojis - Emojis from servers the bot is in`,
        inline: true
      }
    )
    .setFooter({ text: 'Use the /emoji gallery command to view emojis in each category' });
  
  // Send response
  await interaction.followUp({
    embeds: [embed]
  });
}

/**
 * Handle search action - searches for emojis matching query
 * @param {Object} interaction The Discord interaction
 * @param {Object} client The Discord client
 * @param {string} query The search query
 */
async function handleSearch(interaction, client, query) {
  if (!query) {
    return interaction.followUp({
      content: '❌ Please provide a search term.',
      ephemeral: true
    });
  }
  
  const searchTerm = query.toLowerCase();
  const results = {
    unicode: [],
    animated: [],
    server: []
  };
  
  // Search unicode emojis
  for (const [code, unicode] of Object.entries(unicodeEmojis)) {
    if (code.toLowerCase().includes(searchTerm)) {
      results.unicode.push({ code, unicode });
    }
  }
  
  // Search animated emojis
  for (const [code, data] of Object.entries(animatedEmojis)) {
    if (code.toLowerCase().includes(searchTerm) || data.name.toLowerCase().includes(searchTerm)) {
      results.animated.push({ code, data });
    }
  }
  
  // Search server emojis
  client.guilds.cache.forEach(guild => {
    guild.emojis.cache.forEach(emoji => {
      if (emoji.name.toLowerCase().includes(searchTerm)) {
        results.server.push({
          code: `:${emoji.name}:`,
          data: {
            name: emoji.name,
            id: emoji.id,
            animated: emoji.animated,
            guildName: guild.name
          }
        });
      }
    });
  });
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🔍 Emoji Search: "${query}"`)
    .setDescription(`Found ${results.unicode.length + results.animated.length + results.server.length} emojis matching your search.`);
  
  // Add unicode emoji results
  if (results.unicode.length > 0) {
    const unicodeResults = results.unicode
      .slice(0, 10)
      .map(r => `${r.unicode} - \`${r.code}\``)
      .join('\n');
    
    embed.addFields({
      name: '😊 Standard Emojis',
      value: unicodeResults + (results.unicode.length > 10 ? `\n...and ${results.unicode.length - 10} more` : '')
    });
  }
  
  // Add animated emoji results
  if (results.animated.length > 0) {
    const animatedResults = results.animated
      .slice(0, 10)
      .map(r => `<a:${r.data.name}:${r.data.id}> - \`${r.code}\``)
      .join('\n');
    
    embed.addFields({
      name: '🎭 Animated Emojis',
      value: animatedResults + (results.animated.length > 10 ? `\n...and ${results.animated.length - 10} more` : '')
    });
  }
  
  // Add server emoji results
  if (results.server.length > 0) {
    const serverResults = results.server
      .slice(0, 10)
      .map(r => `${r.data.animated ? 
        `<a:${r.data.name}:${r.data.id}>` : 
        `<:${r.data.name}:${r.data.id}>`} - \`${r.code}\``)
      .join('\n');
    
    embed.addFields({
      name: '🌐 Server Emojis',
      value: serverResults + (results.server.length > 10 ? `\n...and ${results.server.length - 10} more` : '')
    });
  }
  
  // No results found
  if (results.unicode.length === 0 && results.animated.length === 0 && results.server.length === 0) {
    embed.setDescription(`No emojis found matching "${query}". Try a different search term.`);
  }
  
  // Send response
  await interaction.followUp({
    embeds: [embed]
  });
}

/**
 * Handle test rendering action - tests emoji rendering
 * @param {Object} interaction The Discord interaction
 * @param {Object} client The Discord client
 * @param {string} text The emoji to test
 */
async function handleTestRendering(interaction, client, text) {
  if (!text) {
    return interaction.followUp({
      content: '❌ Please provide an emoji code to test.',
      ephemeral: true
    });
  }
  
  // Process the emoji
  const processedEmoji = processEmojis(processSticker(text), null, client);
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🧪 Emoji Rendering Test')
    .addFields(
      { name: 'Input', value: `\`${text}\`` },
      { name: 'Rendered Result', value: processedEmoji },
      { 
        name: 'Diagnosis', 
        value: processedEmoji === text ? 
          '❌ The emoji code was not recognized or processed correctly.' : 
          '✅ The emoji was processed successfully!' 
      }
    );
  
  // Add troubleshooting tips if unsuccessful
  if (processedEmoji === text) {
    embed.addFields({
      name: '💡 Troubleshooting Tips',
      value: '• Make sure you\'re using the correct emoji format (e.g., `:smile:`)\n' +
             '• For custom server emojis, use the format `:emoji_name:`\n' +
             '• For animated stickers, try `{sticker:name}` format\n' +
             '• Check if the emoji name is spelled correctly\n' +
             '• Some emojis may only be available in certain servers'
    });
  }
  
  // Send response
  await interaction.followUp({
    embeds: [embed],
    ephemeral: true
  });
}

/**
 * Get an emoji representing a category
 * @param {string} category Category name
 * @returns {string} Emoji for the category
 */
function getCategoryEmoji(category) {
  const categoryEmojis = {
    emoticons: '😄',
    hearts: '❤️',
    symbols: '✨',
    technical: '⚙️',
    gaming: '🎮',
    security: '🛡️',
    animated: '🎭',
    server: '🌐'
  };
  
  return categoryEmojis[category] || '📋';
}

/**
 * Get a formatted name for a category
 * @param {string} category Category ID
 * @returns {string} Formatted category name
 */
function getCategoryName(category) {
  const categoryNames = {
    emoticons: 'Basic Emoticons',
    hearts: 'Hearts & Love',
    symbols: 'Common Symbols',
    technical: 'Technical',
    gaming: 'Gaming',
    security: 'Security',
    animated: 'Animated Emojis',
    server: 'Server Emojis'
  };
  
  return categoryNames[category] || 'Emoji Category';
}