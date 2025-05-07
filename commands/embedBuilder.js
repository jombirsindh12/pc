const { 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { processEmojis, processSticker, unicodeEmojis, animatedEmojis } = require('../utils/emojiProcessor');
const config = require('../utils/config');

module.exports = {
  name: 'embedbuilder',
  description: 'Create beautiful customized Discord embedded messages',
  usage: '/embedbuilder',
  guildOnly: true,
  options: [
    {
      name: 'template',
      type: 3, // STRING type
      description: 'Optional template to start from',
      required: false,
      choices: [
        { name: 'Announcement', value: 'announcement' },
        { name: 'Rules', value: 'rules' },
        { name: 'Welcome', value: 'welcome' },
        { name: 'Giveaway', value: 'giveaway' },
        { name: 'Info', value: 'info' },
        { name: 'Blank', value: 'blank' }
      ]
    }
  ],
  
  // User needs either MANAGE_MESSAGES or Administrator to use this command
  permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.Administrator],
  
  async execute(message, args, client, interaction = null) {
    // Only allow slash command usage
    if (!interaction) {
      return message.reply('Please use the slash command `/embedbuilder` to use this feature.');
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    // Get the template if provided
    const templateChoice = interaction.options.getString('template') || 'blank';
    
    // Create a default embed based on the template
    const embedData = getTemplateEmbed(templateChoice);
    
    // Create the embed builder UI
    await showEmbedBuilder(interaction, client, embedData);
  }
};

/**
 * Shows the embed builder UI with preview and options
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
async function showEmbedBuilder(interaction, client, embedData) {
  try {
    // Process any emojis in the embed content
    processEmbedEmojis(embedData, interaction.guild.emojis.cache, client);
    
    // Create a preview of the current embed
    const previewEmbed = createEmbed(embedData);
    
    // Create the editor components
    const components = createEditorComponents(embedData);
    
    // Send the builder UI
    await interaction.followUp({
      content: '### 📝 Embed Message Builder\nUse the buttons below to customize your embed. Preview appears below:',
      embeds: [previewEmbed],
      components: components,
      ephemeral: true
    });
    
    // Set up button collectors
    setupButtonCollectors(interaction, client, embedData);
    
  } catch (error) {
    console.error('Error in embed builder:', error);
    await interaction.followUp({
      content: `❌ Error creating embed builder: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Create Discord.js embed from our data format
 * @param {Object} embedData - Embed data
 * @returns {EmbedBuilder} Discord.js embed
 */
function createEmbed(embedData) {
  const embed = new EmbedBuilder();
  
  // Set core properties if they exist
  if (embedData.title) embed.setTitle(embedData.title);
  if (embedData.description) embed.setDescription(embedData.description);
  if (embedData.color) embed.setColor(embedData.color);
  if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
  if (embedData.image) embed.setImage(embedData.image);
  
  // Add timestamp if enabled
  if (embedData.timestamp) embed.setTimestamp();
  
  // Add footer if exists
  if (embedData.footer?.text) {
    const footerOptions = { text: embedData.footer.text };
    if (embedData.footer.icon_url) footerOptions.iconURL = embedData.footer.icon_url;
    embed.setFooter(footerOptions);
  }
  
  // Add author if exists
  if (embedData.author?.name) {
    const authorOptions = { name: embedData.author.name };
    if (embedData.author.icon_url) authorOptions.iconURL = embedData.author.icon_url;
    if (embedData.author.url) authorOptions.url = embedData.author.url;
    embed.setAuthor(authorOptions);
  }
  
  // Add fields if they exist
  if (embedData.fields && embedData.fields.length > 0) {
    embedData.fields.forEach(field => {
      embed.addFields({
        name: field.name || '\u200B', // Use zero-width space if no name
        value: field.value || '\u200B',
        inline: field.inline || false
      });
    });
  }
  
  return embed;
}

/**
 * Create the UI components for the embed editor
 * @param {Object} embedData - Current embed data
 * @returns {Array} Array of component rows
 */
function createEditorComponents(embedData) {
  // Row 1: Core properties
  const coreButtonsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_title')
        .setLabel('Edit Title')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('embed_description')
        .setLabel('Edit Description')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📄'),
      new ButtonBuilder()
        .setCustomId('embed_color')
        .setLabel('Change Color')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎨'),
      new ButtonBuilder()
        .setCustomId('embed_images')
        .setLabel('Images')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🖼️')
    );
  
  // Row 2: Additional properties
  const additionalButtonsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_author')
        .setLabel('Author')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('embed_footer')
        .setLabel('Footer')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👣'),
      new ButtonBuilder()
        .setCustomId('embed_field')
        .setLabel('Add Field')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('embed_timestamp')
        .setLabel(embedData.timestamp ? 'Remove Timestamp' : 'Add Timestamp')
        .setStyle(embedData.timestamp ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setEmoji('🕒')
    );
  
  // Row 3: Actions
  const actionsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('embed_preview')
        .setLabel('Preview in Channel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👁️'),
      new ButtonBuilder()
        .setCustomId('embed_send')
        .setLabel('Send to Channel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✉️'),
      new ButtonBuilder()
        .setCustomId('embed_save')
        .setLabel('Save Template')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💾'),
      new ButtonBuilder()
        .setCustomId('embed_reset')
        .setLabel('Reset')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄')
    );
  
  // Row 4: Templates
  const templatesRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('embed_template')
        .setPlaceholder('Load a template...')
        .addOptions([
          { label: 'Announcement', value: 'announcement', emoji: '📢' },
          { label: 'Rules', value: 'rules', emoji: '📜' },
          { label: 'Welcome', value: 'welcome', emoji: '👋' },
          { label: 'Giveaway', value: 'giveaway', emoji: '🎁' },
          { label: 'Info', value: 'info', emoji: 'ℹ️' },
          { label: 'Blank', value: 'blank', emoji: '⬜' }
        ])
    );
  
  return [coreButtonsRow, additionalButtonsRow, actionsRow, templatesRow];
}

/**
 * Set up collectors for the embed builder buttons
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
function setupButtonCollectors(interaction, client, embedData) {
  // Filter for button interactions from the original user
  const filter = i => {
    return i.user.id === interaction.user.id && 
           (i.isButton() || i.isStringSelectMenu() || i.isModalSubmit());
  };
  
  // Create a collector
  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: 900000 // 15 minutes
  });
  
  collector.on('collect', async i => {
    try {
      // Handle different button actions
      switch (i.customId) {
        case 'embed_title':
          await showTitleModal(i, embedData);
          break;
        
        case 'embed_description':
          await showDescriptionModal(i, embedData);
          break;
        
        case 'embed_color':
          await showColorModal(i, embedData);
          break;
        
        case 'embed_images':
          await showImagesModal(i, embedData);
          break;
        
        case 'embed_author':
          await showAuthorModal(i, embedData);
          break;
        
        case 'embed_footer':
          await showFooterModal(i, embedData);
          break;
        
        case 'embed_field':
          await showFieldModal(i, embedData);
          break;
        
        case 'embed_timestamp':
          // Toggle timestamp
          embedData.timestamp = !embedData.timestamp;
          await updateEmbedBuilder(interaction, client, embedData);
          await i.deferUpdate();
          break;
        
        case 'embed_preview':
          await previewEmbed(i, client, embedData);
          break;
        
        case 'embed_send':
          await sendEmbed(i, client, embedData);
          break;
        
        case 'embed_save':
          await showSaveTemplateModal(i, embedData);
          break;
        
        case 'embed_reset':
          // Reset to blank template
          embedData = getTemplateEmbed('blank');
          await updateEmbedBuilder(interaction, client, embedData);
          await i.deferUpdate();
          break;
        
        case 'embed_template':
          // Load template
          embedData = getTemplateEmbed(i.values[0]);
          await updateEmbedBuilder(interaction, client, embedData);
          await i.deferUpdate();
          break;
        
        // Handle modal submissions
        case 'embed_title_modal':
        case 'embed_description_modal':
        case 'embed_color_modal':
        case 'embed_images_modal':
        case 'embed_author_modal':
        case 'embed_footer_modal':
        case 'embed_field_modal':
        case 'embed_save_modal':
          await handleModalSubmit(i, client, embedData);
          break;
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      if (!i.deferred && !i.replied) {
        await i.reply({ 
          content: `❌ Error: ${error.message}`, 
          ephemeral: true 
        });
      }
    }
  });
  
  collector.on('end', collected => {
    console.log(`Collected ${collected.size} interactions for embed builder.`);
  });
}

/**
 * Show title edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showTitleModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_title_modal')
    .setTitle('Edit Embed Title');
  
  const titleInput = new TextInputBuilder()
    .setCustomId('title_input')
    .setLabel('Title (max 256 characters)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setValue(embedData.title || '')
    .setPlaceholder('Enter a title for your embed')
    .setRequired(false);
  
  const titleRow = new ActionRowBuilder().addComponents(titleInput);
  modal.addComponents(titleRow);
  
  await i.showModal(modal);
}

/**
 * Show description edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showDescriptionModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_description_modal')
    .setTitle('Edit Embed Description');
  
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description_input')
    .setLabel('Description (max 4000 characters)')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setValue(embedData.description || '')
    .setPlaceholder('Enter a description for your embed')
    .setRequired(false);
  
  const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
  modal.addComponents(descriptionRow);
  
  await i.showModal(modal);
}

/**
 * Show color picker modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showColorModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_color_modal')
    .setTitle('Change Embed Color');
  
  const colorInput = new TextInputBuilder()
    .setCustomId('color_input')
    .setLabel('Color (hex code like #FF0000 or name)')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.color || '#5865F2')
    .setPlaceholder('#5865F2 (Discord Blue) or RED, GREEN, BLUE, etc')
    .setRequired(false);
  
  const colorRow = new ActionRowBuilder().addComponents(colorInput);
  modal.addComponents(colorRow);
  
  await i.showModal(modal);
}

/**
 * Show images edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showImagesModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_images_modal')
    .setTitle('Edit Embed Images');
  
  const thumbnailInput = new TextInputBuilder()
    .setCustomId('thumbnail_input')
    .setLabel('Thumbnail URL (small image in corner)')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.thumbnail || '')
    .setPlaceholder('https://example.com/thumbnail.png')
    .setRequired(false);
  
  const imageInput = new TextInputBuilder()
    .setCustomId('image_input')
    .setLabel('Main Image URL (large image in embed)')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.image || '')
    .setPlaceholder('https://example.com/image.png')
    .setRequired(false);
  
  const thumbnailRow = new ActionRowBuilder().addComponents(thumbnailInput);
  const imageRow = new ActionRowBuilder().addComponents(imageInput);
  modal.addComponents(thumbnailRow, imageRow);
  
  await i.showModal(modal);
}

/**
 * Show author edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showAuthorModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_author_modal')
    .setTitle('Edit Embed Author');
  
  const authorNameInput = new TextInputBuilder()
    .setCustomId('author_name_input')
    .setLabel('Author Name')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.author?.name || '')
    .setPlaceholder('Author name')
    .setRequired(false);
  
  const authorIconInput = new TextInputBuilder()
    .setCustomId('author_icon_input')
    .setLabel('Author Icon URL')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.author?.icon_url || '')
    .setPlaceholder('https://example.com/author-icon.png')
    .setRequired(false);
  
  const authorUrlInput = new TextInputBuilder()
    .setCustomId('author_url_input')
    .setLabel('Author URL (makes name clickable)')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.author?.url || '')
    .setPlaceholder('https://example.com')
    .setRequired(false);
  
  const nameRow = new ActionRowBuilder().addComponents(authorNameInput);
  const iconRow = new ActionRowBuilder().addComponents(authorIconInput);
  const urlRow = new ActionRowBuilder().addComponents(authorUrlInput);
  modal.addComponents(nameRow, iconRow, urlRow);
  
  await i.showModal(modal);
}

/**
 * Show footer edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showFooterModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_footer_modal')
    .setTitle('Edit Embed Footer');
  
  const footerTextInput = new TextInputBuilder()
    .setCustomId('footer_text_input')
    .setLabel('Footer Text')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.footer?.text || '')
    .setPlaceholder('Footer text')
    .setRequired(false);
  
  const footerIconInput = new TextInputBuilder()
    .setCustomId('footer_icon_input')
    .setLabel('Footer Icon URL')
    .setStyle(TextInputStyle.Short)
    .setValue(embedData.footer?.icon_url || '')
    .setPlaceholder('https://example.com/footer-icon.png')
    .setRequired(false);
  
  const textRow = new ActionRowBuilder().addComponents(footerTextInput);
  const iconRow = new ActionRowBuilder().addComponents(footerIconInput);
  modal.addComponents(textRow, iconRow);
  
  await i.showModal(modal);
}

/**
 * Show field add/edit modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showFieldModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_field_modal')
    .setTitle('Add Embed Field');
  
  const fieldNameInput = new TextInputBuilder()
    .setCustomId('field_name_input')
    .setLabel('Field Name')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setPlaceholder('Field name')
    .setRequired(true);
  
  const fieldValueInput = new TextInputBuilder()
    .setCustomId('field_value_input')
    .setLabel('Field Value')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1024)
    .setPlaceholder('Field value')
    .setRequired(true);
  
  const fieldInlineInput = new TextInputBuilder()
    .setCustomId('field_inline_input')
    .setLabel('Inline? (type "yes" or "no")')
    .setStyle(TextInputStyle.Short)
    .setValue('yes')
    .setPlaceholder('yes')
    .setRequired(false);
  
  const nameRow = new ActionRowBuilder().addComponents(fieldNameInput);
  const valueRow = new ActionRowBuilder().addComponents(fieldValueInput);
  const inlineRow = new ActionRowBuilder().addComponents(fieldInlineInput);
  modal.addComponents(nameRow, valueRow, inlineRow);
  
  await i.showModal(modal);
}

/**
 * Show save template modal
 * @param {Object} i - Interaction
 * @param {Object} embedData - Current embed data
 */
async function showSaveTemplateModal(i, embedData) {
  const modal = new ModalBuilder()
    .setCustomId('embed_save_modal')
    .setTitle('Save Embed Template');
  
  const templateNameInput = new TextInputBuilder()
    .setCustomId('template_name_input')
    .setLabel('Template Name')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setPlaceholder('My Custom Template')
    .setRequired(true);
  
  const nameRow = new ActionRowBuilder().addComponents(templateNameInput);
  modal.addComponents(nameRow);
  
  await i.showModal(modal);
}

/**
 * Preview the current embed in the channel
 * @param {Object} i - Interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
async function previewEmbed(i, client, embedData) {
  try {
    await i.deferReply({ ephemeral: false });
    
    // Process emojis in the embed content
    processEmbedEmojis(embedData, i.guild.emojis.cache, client);
    
    // Create the embed
    const embed = createEmbed(embedData);
    
    // Send preview
    await i.followUp({
      content: '📝 **Embed Preview** (Only visible to everyone for 60 seconds)',
      embeds: [embed]
    });
    
    // Delete preview after 60 seconds
    setTimeout(async () => {
      try {
        await i.deleteReply();
      } catch (error) {
        console.error('Could not delete preview:', error);
      }
    }, 60000);
    
  } catch (error) {
    console.error('Error previewing embed:', error);
    await i.followUp({
      content: `❌ Error previewing embed: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Send the current embed to the channel
 * @param {Object} i - Interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
async function sendEmbed(i, client, embedData) {
  try {
    await i.deferReply({ ephemeral: true });
    
    // Process emojis in the embed content
    processEmbedEmojis(embedData, i.guild.emojis.cache, client);
    
    // Create the embed
    const embed = createEmbed(embedData);
    
    // Send to channel
    await i.channel.send({
      embeds: [embed]
    });
    
    // Confirm to user
    await i.followUp({
      content: '✅ Embed has been sent to this channel!',
      ephemeral: true
    });
    
  } catch (error) {
    console.error('Error sending embed:', error);
    await i.followUp({
      content: `❌ Error sending embed: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Handle various modal submissions
 * @param {Object} i - Modal submission interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
async function handleModalSubmit(i, client, embedData) {
  switch (i.customId) {
    case 'embed_title_modal':
      embedData.title = i.fields.getTextInputValue('title_input') || null;
      break;
    
    case 'embed_description_modal':
      embedData.description = i.fields.getTextInputValue('description_input') || null;
      break;
    
    case 'embed_color_modal':
      embedData.color = i.fields.getTextInputValue('color_input') || null;
      break;
    
    case 'embed_images_modal':
      embedData.thumbnail = i.fields.getTextInputValue('thumbnail_input') || null;
      embedData.image = i.fields.getTextInputValue('image_input') || null;
      break;
    
    case 'embed_author_modal':
      const authorName = i.fields.getTextInputValue('author_name_input');
      if (authorName) {
        embedData.author = {
          name: authorName,
          icon_url: i.fields.getTextInputValue('author_icon_input') || null,
          url: i.fields.getTextInputValue('author_url_input') || null
        };
      } else {
        embedData.author = null;
      }
      break;
    
    case 'embed_footer_modal':
      const footerText = i.fields.getTextInputValue('footer_text_input');
      if (footerText) {
        embedData.footer = {
          text: footerText,
          icon_url: i.fields.getTextInputValue('footer_icon_input') || null
        };
      } else {
        embedData.footer = null;
      }
      break;
    
    case 'embed_field_modal':
      const fieldName = i.fields.getTextInputValue('field_name_input');
      const fieldValue = i.fields.getTextInputValue('field_value_input');
      const fieldInline = i.fields.getTextInputValue('field_inline_input').toLowerCase();
      
      // Initialize fields array if it doesn't exist
      if (!embedData.fields) embedData.fields = [];
      
      // Check if we have room for another field (max 25)
      if (embedData.fields.length >= 25) {
        await i.reply({
          content: '❌ Cannot add more fields - Discord embeds are limited to 25 fields.',
          ephemeral: true
        });
        return;
      }
      
      // Add the field
      embedData.fields.push({
        name: fieldName,
        value: fieldValue,
        inline: fieldInline === 'yes' || fieldInline === 'true'
      });
      break;
    
    case 'embed_save_modal':
      const templateName = i.fields.getTextInputValue('template_name_input');
      await saveCustomTemplate(i, embedData, templateName);
      await i.deferUpdate();
      return;
  }
  
  // Update the embed builder
  await i.deferUpdate();
  await updateEmbedBuilder(i.message.interaction, client, embedData);
}

/**
 * Save a custom template for the server
 * @param {Object} i - Interaction
 * @param {Object} embedData - Embed data to save
 * @param {string} templateName - Name for the template
 */
async function saveCustomTemplate(i, embedData, templateName) {
  try {
    // Get server config
    const serverId = i.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Initialize templates object if it doesn't exist
    if (!serverConfig.embedTemplates) serverConfig.embedTemplates = {};
    
    // Save the template
    serverConfig.embedTemplates[templateName] = JSON.parse(JSON.stringify(embedData));
    
    // Add metadata
    serverConfig.embedTemplates[templateName].createdBy = i.user.id;
    serverConfig.embedTemplates[templateName].createdAt = new Date().toISOString();
    
    // Update server config
    config.updateServerConfig(serverId, {
      embedTemplates: serverConfig.embedTemplates
    });
    
    // Confirm to user
    await i.reply({
      content: `✅ Template "${templateName}" has been saved! You can use it with \`/embedtemplate load:${templateName}\`.`,
      ephemeral: true
    });
    
  } catch (error) {
    console.error('Error saving template:', error);
    await i.reply({
      content: `❌ Error saving template: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Update the embed builder message
 * @param {Object} interaction - Original interaction
 * @param {Object} client - Discord client
 * @param {Object} embedData - Current embed data
 */
async function updateEmbedBuilder(interaction, client, embedData) {
  try {
    // Process emojis in the embed content
    processEmbedEmojis(embedData, interaction.guild.emojis.cache, client);
    
    // Create the preview
    const previewEmbed = createEmbed(embedData);
    
    // Create the editor components
    const components = createEditorComponents(embedData);
    
    // Update the message
    await interaction.editReply({
      content: '### 📝 Embed Message Builder\nUse the buttons below to customize your embed. Preview appears below:',
      embeds: [previewEmbed],
      components: components
    });
    
  } catch (error) {
    console.error('Error updating embed builder:', error);
  }
}

/**
 * Process emojis in all text fields of the embed
 * @param {Object} embedData - Embed data
 * @param {Collection} serverEmojis - Server emojis collection
 * @param {Object} client - Discord client
 */
function processEmbedEmojis(embedData, serverEmojis, client) {
  // Process title
  if (embedData.title) {
    embedData.title = processEmojis(processSticker(embedData.title), serverEmojis, client);
  }
  
  // Process description
  if (embedData.description) {
    embedData.description = processEmojis(processSticker(embedData.description), serverEmojis, client);
  }
  
  // Process author name
  if (embedData.author?.name) {
    embedData.author.name = processEmojis(processSticker(embedData.author.name), serverEmojis, client);
  }
  
  // Process footer text
  if (embedData.footer?.text) {
    embedData.footer.text = processEmojis(processSticker(embedData.footer.text), serverEmojis, client);
  }
  
  // Process fields
  if (embedData.fields?.length > 0) {
    embedData.fields.forEach(field => {
      if (field.name) {
        field.name = processEmojis(processSticker(field.name), serverEmojis, client);
      }
      if (field.value) {
        field.value = processEmojis(processSticker(field.value), serverEmojis, client);
      }
    });
  }
}

/**
 * Get a template embed based on the selected template name
 * @param {string} templateName - Template name
 * @returns {Object} Template embed data
 */
function getTemplateEmbed(templateName) {
  switch (templateName) {
    case 'announcement':
      return {
        title: '📢 Important Announcement',
        description: 'We have some exciting news to share with all server members! Please read below for important information.',
        color: '#FF5555',
        fields: [
          {
            name: '📅 Event Date',
            value: 'Saturday, June 10th, 2023',
            inline: true
          },
          {
            name: '🕒 Event Time',
            value: '8:00 PM EST / 5:00 PM PST',
            inline: true
          },
          {
            name: '📋 Details',
            value: 'Please make sure to read all the information carefully. If you have any questions, feel free to ask in the discussion channel.',
            inline: false
          }
        ],
        footer: {
          text: 'Announcement from the Server Team'
        },
        timestamp: true
      };
    
    case 'rules':
      return {
        title: '📜 Server Rules',
        description: 'Welcome to our server! To ensure everyone has a great time, please follow these rules:',
        color: '#5865F2',
        fields: [
          {
            name: '1️⃣ Be Respectful',
            value: 'Treat everyone with respect. Harassment, hate speech, and discrimination will not be tolerated.',
            inline: false
          },
          {
            name: '2️⃣ No Spamming',
            value: 'Avoid sending repeated messages, excessive emojis, or unnecessary pings.',
            inline: false
          },
          {
            name: '3️⃣ Use Appropriate Channels',
            value: 'Post content in the relevant channels. Check channel descriptions if unsure.',
            inline: false
          },
          {
            name: '4️⃣ No NSFW Content',
            value: 'Keep all content appropriate. NSFW content is strictly prohibited.',
            inline: false
          },
          {
            name: '5️⃣ Follow Discord TOS',
            value: 'Adhere to Discord\'s Terms of Service and Community Guidelines.',
            inline: false
          }
        ],
        footer: {
          text: 'Last Updated: May 2023'
        }
      };
    
    case 'welcome':
      return {
        title: '👋 Welcome to Our Server!',
        description: 'We\'re excited to have you join our community! Take a moment to familiarize yourself with our server.',
        color: '#43B581',
        fields: [
          {
            name: '📜 Rules',
            value: 'Check out our rules in <#RULES_CHANNEL_ID>.',
            inline: true
          },
          {
            name: '🎮 Roles',
            value: 'Get roles in <#ROLES_CHANNEL_ID>.',
            inline: true
          },
          {
            name: '💬 Start Chatting',
            value: 'Introduce yourself in <#INTRO_CHANNEL_ID> and start chatting with our community!',
            inline: false
          }
        ],
        thumbnail: 'https://example.com/server-logo.png',
        footer: {
          text: 'Thanks for joining us!'
        }
      };
    
    case 'giveaway':
      return {
        title: '🎁 GIVEAWAY TIME!',
        description: 'We\'re giving away something special! React with 🎉 to enter!',
        color: '#F47FFF',
        fields: [
          {
            name: '🏆 Prize',
            value: 'Awesome Prize Description',
            inline: false
          },
          {
            name: '⏰ Ends',
            value: 'In 24 hours',
            inline: true
          },
          {
            name: '👥 Winners',
            value: '1 Lucky Winner',
            inline: true
          },
          {
            name: '📋 Requirements',
            value: '• Must be a server member\n• Must react to this message\n• Must follow our rules',
            inline: false
          }
        ],
        footer: {
          text: 'Good luck everyone!'
        },
        timestamp: true
      };
    
    case 'info':
      return {
        title: 'ℹ️ Server Information',
        description: 'Everything you need to know about our server!',
        color: '#3498DB',
        fields: [
          {
            name: '📅 Created',
            value: 'January 1, 2023',
            inline: true
          },
          {
            name: '👥 Members',
            value: '1,000+',
            inline: true
          },
          {
            name: '🌐 Website',
            value: 'https://example.com',
            inline: true
          },
          {
            name: '📚 Resources',
            value: 'Check out these helpful links and resources:\n• [Discord Guidelines](https://discord.com/guidelines)\n• [Our Twitter](https://twitter.com/example)',
            inline: false
          }
        ],
        thumbnail: 'https://example.com/info-icon.png',
        footer: {
          text: 'Type /help for more commands'
        }
      };
    
    case 'blank':
    default:
      return {
        title: '',
        description: '',
        color: '#5865F2',
        fields: [],
        timestamp: false
      };
  }
}

module.exports.getTemplateEmbed = getTemplateEmbed;