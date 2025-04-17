const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../utils/config');
const { isPremiumUser } = require('../commands/premium');

// Create a collection of popular Nitro stickers
const nitroStickers = [
  {
    id: 'wumpus_happy',
    name: 'Happy Wumpus',
    url: 'https://cdn.discordapp.com/stickers/749054660769218631.png',
    description: 'Happy Discord mascot'
  },
  {
    id: 'wumpus_sad',
    name: 'Sad Wumpus',
    url: 'https://cdn.discordapp.com/stickers/749054660899553280.png', 
    description: 'Sad Discord mascot'
  },
  {
    id: 'wumpus_love',
    name: 'Love Wumpus',
    url: 'https://cdn.discordapp.com/stickers/749054661276508190.png',
    description: 'Loving Discord mascot'
  },
  {
    id: 'wumpus_party',
    name: 'Party Wumpus',
    url: 'https://cdn.discordapp.com/stickers/749054662065578004.png',
    description: 'Partying Discord mascot'
  },
  {
    id: 'nitro_logo',
    name: 'Discord Nitro',
    url: 'https://cdn.discordapp.com/stickers/749054660736057384.png',
    description: 'Discord Nitro logo'
  },
  {
    id: 'cat_vibing',
    name: 'Vibing Cat',
    url: 'https://cdn.discordapp.com/stickers/816087132447178753.png',
    description: 'Cat vibing with headphones'
  },
  {
    id: 'cat_blob',
    name: 'Blob Cat',
    url: 'https://cdn.discordapp.com/stickers/789289325526351872.png',
    description: 'Cute blob cat'
  },
  {
    id: 'pepe_laugh',
    name: 'Pepe Laugh',
    url: 'https://cdn.discordapp.com/stickers/861364170668097546.png',
    description: 'Laughing pepe'
  },
  {
    id: 'pepe_hype',
    name: 'Pepe Hype',
    url: 'https://cdn.discordapp.com/stickers/859968840321228800.png',
    description: 'Excited pepe'
  },
  {
    id: 'among_us',
    name: 'Among Us',
    url: 'https://cdn.discordapp.com/stickers/774449851684421662.png',
    description: 'Among Us character'
  }
];

// Categories
const stickerCategories = {
  'wumpus': 'Wumpus Stickers',
  'pepe': 'Pepe Stickers',
  'cat': 'Cat Stickers',
  'game': 'Game Stickers',
  'misc': 'Miscellaneous Stickers'
};

module.exports = {
  name: 'stickers',
  description: 'Use premium Discord stickers without Nitro',
  usage: '/stickers [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with stickers',
      required: true,
      choices: [
        {
          name: 'browse',
          value: 'browse'
        },
        {
          name: 'send',
          value: 'send'
        },
        {
          name: 'search',
          value: 'search'
        },
        {
          name: 'favorites',
          value: 'favorites'
        }
      ]
    },
    {
      name: 'query',
      type: 3, // STRING type
      description: 'Search term or sticker name to send',
      required: false
    },
    {
      name: 'category',
      type: 3, // STRING type
      description: 'Category to browse',
      required: false,
      choices: [
        {
          name: 'Wumpus',
          value: 'wumpus'
        },
        {
          name: 'Pepe',
          value: 'pepe'
        },
        {
          name: 'Cats',
          value: 'cat'
        },
        {
          name: 'Games',
          value: 'game'
        },
        {
          name: 'Miscellaneous',
          value: 'misc'
        }
      ]
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    if (!isSlashCommand) {
      return message.reply('Please use the slash command `/stickers` to access premium stickers.');
    }
    
    // Get user and server info
    const userId = interaction.user.id;
    const serverId = interaction.guild?.id;
    
    // Check if the user is a premium user or if the command is used in a premium server
    const isPremium = await isPremiumUser(userId, serverId, client);
    
    // Get action and other parameters
    const action = interaction.options.getString('action');
    const query = interaction.options.getString('query');
    const category = interaction.options.getString('category');
    
    // Defer reply for most actions as they might take time
    await interaction.deferReply();
    
    switch (action) {
      case 'browse':
        await handleBrowseStickers(interaction, isPremium, category);
        break;
        
      case 'send':
        await handleSendSticker(interaction, isPremium, query);
        break;
        
      case 'search':
        await handleSearchStickers(interaction, isPremium, query);
        break;
        
      case 'favorites':
        await handleFavoriteStickers(interaction, isPremium, userId);
        break;
        
      default:
        await interaction.followUp('❌ Invalid action. Please try again with a valid action.');
    }
  }
};

/**
 * Handle browsing stickers by category
 * @param {Object} interaction Discord interaction
 * @param {boolean} isPremium Whether the user has premium access
 * @param {string} category Sticker category to browse
 */
async function handleBrowseStickers(interaction, isPremium, category) {
  try {
    // If no category specified, show the category selection
    if (!category) {
      const categoryRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('sticker_category')
          .setPlaceholder('Select a sticker category')
          .addOptions(Object.entries(stickerCategories).map(([key, name]) => ({
            label: name,
            value: key,
            description: `Browse ${name.toLowerCase()}`
          })))
      );
      
      const categoryEmbed = new EmbedBuilder()
        .setTitle('🎭 Premium Sticker Categories')
        .setDescription('Browse premium Discord stickers by category')
        .setColor(isPremium ? 0x9B59B6 : 0x95A5A6)
        .addFields([
          {
            name: '📋 Available Categories',
            value: Object.values(stickerCategories).map(cat => `• ${cat}`).join('\n')
          },
          {
            name: '💎 Premium Status',
            value: isPremium 
              ? '✅ You have premium access to all stickers!' 
              : '⭐ Some stickers require premium access. Use the `premium` command to learn more.'
          }
        ])
        .setFooter({ text: 'Select a category to browse stickers' });
      
      await interaction.followUp({
        embeds: [categoryEmbed],
        components: [categoryRow]
      });
      
      // Set up collector for category selection
      const filter = i => i.customId === 'sticker_category' && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
      
      collector.on('collect', async i => {
        await i.deferUpdate();
        const selectedCategory = i.values[0];
        
        // Show stickers for the selected category
        await showStickersForCategory(i, isPremium, selectedCategory);
      });
      
      return;
    }
    
    // Show stickers for the specified category
    await showStickersForCategory(interaction, isPremium, category);
    
  } catch (error) {
    console.error('Error browsing stickers:', error);
    await interaction.followUp('❌ An error occurred while browsing stickers. Please try again later.');
  }
}

/**
 * Display stickers for a specific category
 * @param {Object} interaction Discord interaction
 * @param {boolean} isPremium Whether the user has premium access
 * @param {string} category Sticker category
 */
async function showStickersForCategory(interaction, isPremium, category) {
  // Filter stickers by category
  const categoryStickers = nitroStickers.filter(sticker => {
    if (category === 'wumpus') return sticker.id.includes('wumpus');
    if (category === 'pepe') return sticker.id.includes('pepe');
    if (category === 'cat') return sticker.id.includes('cat');
    if (category === 'game') return sticker.id.includes('among') || sticker.id.includes('game');
    if (category === 'misc') return !sticker.id.includes('wumpus') && 
                                 !sticker.id.includes('pepe') && 
                                 !sticker.id.includes('cat') &&
                                 !sticker.id.includes('among');
    return true;
  });
  
  if (categoryStickers.length === 0) {
    await interaction.followUp(`❌ No stickers found in the ${stickerCategories[category]} category.`);
    return;
  }
  
  // Create sticker selection menu
  const stickerRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sticker_select')
      .setPlaceholder('Select a sticker to send')
      .addOptions(categoryStickers.map(sticker => ({
        label: sticker.name,
        value: sticker.id,
        description: sticker.description
      })))
  );
  
  // Create category embed
  const categoryEmbed = new EmbedBuilder()
    .setTitle(`🎭 ${stickerCategories[category]}`)
    .setDescription(`Select a sticker to send to this channel`)
    .setColor(0x9B59B6)
    .addFields([
      {
        name: '📋 Available Stickers',
        value: categoryStickers.map(s => `• ${s.name}`).join('\n')
      },
      {
        name: '💎 Premium Status',
        value: isPremium 
          ? '✅ You have premium access to all stickers!' 
          : '⭐ Some stickers require premium access. Use the `premium` command to learn more.'
      }
    ])
    .setFooter({ text: 'Select a sticker to send it to the channel' });
  
  await interaction.followUp({
    embeds: [categoryEmbed],
    components: [stickerRow]
  });
  
  // Set up collector for sticker selection
  const filter = i => i.customId === 'sticker_select' && i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
  
  collector.on('collect', async i => {
    await i.deferUpdate();
    const selectedStickerId = i.values[0];
    
    // Find the selected sticker
    const selectedSticker = nitroStickers.find(s => s.id === selectedStickerId);
    if (!selectedSticker) {
      await i.followUp({ content: '❌ Sticker not found. Please try again.', ephemeral: true });
      return;
    }
    
    // Send the sticker
    await sendStickerToChannel(i, selectedSticker, interaction.user);
  });
}

/**
 * Handle sending a specific sticker
 * @param {Object} interaction Discord interaction
 * @param {boolean} isPremium Whether the user has premium access
 * @param {string} query Sticker name or ID
 */
async function handleSendSticker(interaction, isPremium, query) {
  if (!query) {
    await interaction.followUp('❌ Please provide a sticker name or ID to send.');
    return;
  }
  
  // Find the sticker by name or ID
  const sticker = nitroStickers.find(s => 
    s.id.toLowerCase() === query.toLowerCase() || 
    s.name.toLowerCase().includes(query.toLowerCase())
  );
  
  if (!sticker) {
    await interaction.followUp(`❌ Could not find a sticker matching "${query}". Try using the browse command to see available stickers.`);
    return;
  }
  
  // Send the sticker
  await sendStickerToChannel(interaction, sticker, interaction.user);
}

/**
 * Handle searching for stickers
 * @param {Object} interaction Discord interaction
 * @param {boolean} isPremium Whether the user has premium access
 * @param {string} query Search query
 */
async function handleSearchStickers(interaction, isPremium, query) {
  if (!query) {
    await interaction.followUp('❌ Please provide a search term to find stickers.');
    return;
  }
  
  // Search for stickers matching the query
  const matchingStickers = nitroStickers.filter(s => 
    s.id.toLowerCase().includes(query.toLowerCase()) || 
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  );
  
  if (matchingStickers.length === 0) {
    await interaction.followUp(`❌ No stickers found matching "${query}". Try a different search term.`);
    return;
  }
  
  // Create sticker selection menu
  const stickerRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sticker_search')
      .setPlaceholder('Select a sticker to send')
      .addOptions(matchingStickers.map(sticker => ({
        label: sticker.name,
        value: sticker.id,
        description: sticker.description
      })))
  );
  
  // Create search results embed
  const searchEmbed = new EmbedBuilder()
    .setTitle(`🔍 Sticker Search Results: "${query}"`)
    .setDescription(`Found ${matchingStickers.length} stickers matching your search`)
    .setColor(0x3498DB)
    .addFields([
      {
        name: '📋 Matching Stickers',
        value: matchingStickers.map(s => `• ${s.name}`).join('\n')
      }
    ])
    .setFooter({ text: 'Select a sticker to send it to the channel' });
  
  await interaction.followUp({
    embeds: [searchEmbed],
    components: [stickerRow]
  });
  
  // Set up collector for sticker selection
  const filter = i => i.customId === 'sticker_search' && i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
  
  collector.on('collect', async i => {
    await i.deferUpdate();
    const selectedStickerId = i.values[0];
    
    // Find the selected sticker
    const selectedSticker = nitroStickers.find(s => s.id === selectedStickerId);
    if (!selectedSticker) {
      await i.followUp({ content: '❌ Sticker not found. Please try again.', ephemeral: true });
      return;
    }
    
    // Send the sticker
    await sendStickerToChannel(i, selectedSticker, interaction.user);
  });
}

/**
 * Handle favorite stickers
 * @param {Object} interaction Discord interaction
 * @param {boolean} isPremium Whether the user has premium access
 * @param {string} userId User ID
 */
async function handleFavoriteStickers(interaction, isPremium, userId) {
  // Get user's favorite stickers from config
  const serverConfig = config.getServerConfig(interaction.guild.id);
  const userFavorites = serverConfig.userFavorites?.[userId] || [];
  
  if (!userFavorites || userFavorites.length === 0) {
    await interaction.followUp('📌 You don\'t have any favorite stickers yet. Use the browse command to find stickers and add them to your favorites!');
    return;
  }
  
  // Get sticker objects for favorites
  const favoriteStickers = userFavorites.map(id => nitroStickers.find(s => s.id === id)).filter(Boolean);
  
  if (favoriteStickers.length === 0) {
    await interaction.followUp('❌ None of your favorite stickers could be found. They may have been removed from the system.');
    return;
  }
  
  // Create sticker selection menu
  const stickerRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sticker_favorite')
      .setPlaceholder('Select a favorite sticker')
      .addOptions(favoriteStickers.map(sticker => ({
        label: sticker.name,
        value: sticker.id,
        description: sticker.description
      })))
  );
  
  // Create favorites embed
  const favoritesEmbed = new EmbedBuilder()
    .setTitle('📌 Your Favorite Stickers')
    .setDescription(`You have ${favoriteStickers.length} favorite stickers`)
    .setColor(0xF1C40F)
    .addFields([
      {
        name: '❤️ Your Favorites',
        value: favoriteStickers.map(s => `• ${s.name}`).join('\n')
      }
    ])
    .setFooter({ text: 'Select a sticker to send it to the channel' });
  
  await interaction.followUp({
    embeds: [favoritesEmbed],
    components: [stickerRow]
  });
  
  // Set up collector for sticker selection
  const filter = i => i.customId === 'sticker_favorite' && i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
  
  collector.on('collect', async i => {
    await i.deferUpdate();
    const selectedStickerId = i.values[0];
    
    // Find the selected sticker
    const selectedSticker = nitroStickers.find(s => s.id === selectedStickerId);
    if (!selectedSticker) {
      await i.followUp({ content: '❌ Sticker not found. Please try again.', ephemeral: true });
      return;
    }
    
    // Send the sticker
    await sendStickerToChannel(i, selectedSticker, interaction.user);
  });
}

/**
 * Send a sticker to the channel
 * @param {Object} interaction Discord interaction
 * @param {Object} sticker Sticker object
 * @param {Object} user User who is sending the sticker
 */
async function sendStickerToChannel(interaction, sticker, user) {
  try {
    // Create the attachment from the sticker URL
    const attachment = new AttachmentBuilder(sticker.url, { name: `${sticker.id}.png` });
    
    // Create the sticker message
    await interaction.channel.send({
      content: `${user} used sticker: **${sticker.name}**`,
      files: [attachment]
    });
    
    // Send confirmation
    await interaction.followUp({
      content: `✅ Sticker **${sticker.name}** sent successfully!`,
      ephemeral: true
    });
    
    // Add to recently used stickers in server config
    const serverId = interaction.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Initialize or update recent stickers
    const recentStickers = serverConfig.recentStickers || [];
    
    // Add current sticker to the front of the list (if not already present, remove it first)
    const existingIndex = recentStickers.findIndex(id => id === sticker.id);
    if (existingIndex !== -1) {
      recentStickers.splice(existingIndex, 1);
    }
    
    recentStickers.unshift(sticker.id);
    
    // Keep only the 10 most recent stickers
    const updatedRecent = recentStickers.slice(0, 10);
    
    // Update server config
    config.updateServerConfig(serverId, { recentStickers: updatedRecent });
    
  } catch (error) {
    console.error('Error sending sticker:', error);
    await interaction.followUp({
      content: `❌ Error sending sticker: ${error.message}`,
      ephemeral: true
    });
  }
}