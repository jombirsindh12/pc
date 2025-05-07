const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../utils/config');
const { processEmojis } = require('../utils/emojiProcessor');

module.exports = {
  name: 'ticketpanel',
  description: 'Create a ticket support panel with server emojis',
  usage: '/ticketpanel',
  guildOnly: true,
  options: [
    {
      name: 'title',
      type: 3, // STRING type
      description: 'Title for the ticket panel',
      required: true
    },
    {
      name: 'description',
      type: 3, // STRING type
      description: 'Description for the ticket panel',
      required: true
    },
    {
      name: 'color',
      type: 3, // STRING type
      description: 'Color hex code (e.g., #FF0000 for red)',
      required: false
    },
    {
      name: 'image',
      type: 3, // STRING type
      description: 'URL of image to display',
      required: false
    },
    {
      name: 'footer',
      type: 3, // STRING type
      description: 'Footer text',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get embed parameters
    let title, description, color, imageUrl, footerText;
    
    if (isSlashCommand) {
      // Get parameters from slash command
      title = interaction.options.getString('title');
      description = interaction.options.getString('description');
      color = interaction.options.getString('color');
      imageUrl = interaction.options.getString('image');
      footerText = interaction.options.getString('footer');
      
      // Defer reply as creating embeds might take time
      await interaction.deferReply();
    } else {
      // Legacy command not supported for complex embed creation
      return message.reply('Please use the slash command `/ticketpanel` for creating ticket panels.');
    }
    
    // Convert hex color to decimal if provided
    let colorDecimal;
    if (color) {
      // Remove # if present
      const colorCode = color.startsWith('#') ? color.substring(1) : color;
      // Parse hex to decimal
      colorDecimal = parseInt(colorCode, 16);
      // Default to Discord blurple if invalid
      if (isNaN(colorDecimal)) {
        colorDecimal = 0x5865F2; // Discord blurple
      }
    } else {
      colorDecimal = 0x5865F2; // Default to Discord blurple
    }
    
    // Process sticker formats and emojis with Nitro support
    // Process sticker formats in title and description
    const processSticker = (text) => {
      // Process {sticker:name} format
      const braceStickerRegex = /{sticker:([a-zA-Z0-9_]+)}/g;
      let result = text.replace(braceStickerRegex, (match, name) => {
        // Convert to :name: format for the emoji processor
        return `:${name}:`;
      });
      
      // Process [sticker:name] format
      const bracketStickerRegex = /\[sticker:([a-zA-Z0-9_]+)\]/g;
      result = result.replace(bracketStickerRegex, (match, name) => {
        // Convert to :name: format for the emoji processor
        return `:${name}:`;
      });
      
      return result;
    };
    
    // Pre-process stickers and emojis in the title and description
    let processedTitle = title;
    let processedDescription = description;
    
    // First, pre-process any sticker formats
    processedTitle = processSticker(processedTitle);
    processedDescription = processSticker(processedDescription);
    
    // Process emoji codes using our enhanced emoji processor (with Nitro support)
    const serverEmojis = isSlashCommand ? interaction.guild.emojis.cache : message.guild.emojis.cache;
    const discordClient = client; // Pass client for accessing all server emojis (Nitro support)
    processedTitle = processEmojis(processedTitle, serverEmojis, discordClient);
    processedDescription = processEmojis(processedDescription, serverEmojis, discordClient);
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle(processedTitle)
      .setDescription(processedDescription)
      .setColor(colorDecimal)
      .setTimestamp();
    
    // Add optional fields if provided
    if (imageUrl) {
      embed.setImage(imageUrl);
    }
    
    if (footerText) {
      // Process emojis in footer text too (with Nitro support)
      const processedFooter = processEmojis(processSticker(footerText), serverEmojis, discordClient);
      embed.setFooter({ text: processedFooter });
    }
    
    // Create a button row for ticket options
    const ticketButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_general')
          .setLabel('General Support')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫'),
          
        new ButtonBuilder()
          .setCustomId('ticket_account')
          .setLabel('Account Issues')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👤'),
          
        new ButtonBuilder()
          .setCustomId('ticket_report')
          .setLabel('Report a User')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🛡️')
      );
    
    // Create a second button row for more ticket options
    const moreTicketButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_bug')
          .setLabel('Report a Bug')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🐛'),
          
        new ButtonBuilder()
          .setCustomId('ticket_suggestion')
          .setLabel('Suggestion')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💡')
      );
    
    // Send the panel
    try {
      // Get the channel where the command was executed
      const targetChannel = isSlashCommand 
        ? interaction.guild.channels.cache.get(interaction.channelId)
        : message.channel;
        
      if (!targetChannel) {
        throw new Error('Could not resolve channel');
      }
      
      // Send the panel to the channel
      await targetChannel.send({ 
        embeds: [embed],
        components: [ticketButtons, moreTicketButtons]
      });
      
      // Configure the server to track tickets if not already set up
      if (!serverConfig.ticketSystem) {
        config.updateServerConfig(serverId, {
          ticketSystem: {
            enabled: true,
            categoryId: null, // Will use this to organize ticket channels
            ticketCounter: 0,
            staffRoleId: null,
            transcriptChannelId: null
          }
        });
      }
      
      // Reply to the interaction
      if (isSlashCommand) {
        await interaction.followUp({ 
          content: '✅ Ticket panel created successfully! Users can now click the buttons to open tickets.',
          ephemeral: true
        });
      }
      
    } catch (error) {
      console.error('Error creating ticket panel:', error);
      if (isSlashCommand) {
        if (!interaction.replied) {
          await interaction.reply({ 
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        } else {
          await interaction.followUp({ 
            content: `❌ An error occurred: ${error.message}`,
            ephemeral: true
          });
        }
      } else if (message) {
        await message.reply(`❌ An error occurred: ${error.message}`);
      }
    }
  },
};

// Set up the ticket button handler
// To fully implement the ticket system, you'd need to handle these button clicks in index.js
// Here's a template of how the handler would look:
/**
 * client.on('interactionCreate', async (interaction) => {
 *   if (!interaction.isButton()) return;
 *   
 *   if (interaction.customId.startsWith('ticket_')) {
 *     const ticketType = interaction.customId.replace('ticket_', '');
 *     await handleTicketCreation(interaction, ticketType);
 *   }
 * });
 * 
 * async function handleTicketCreation(interaction, ticketType) {
 *   // This is where you'd implement the code to create a new ticket channel
 *   // and set up permissions for the user who clicked the button
 * }
 */