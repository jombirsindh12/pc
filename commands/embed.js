const config = require('../utils/config');
const emojiProcessor = require('../utils/emojiProcessor');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Basic emoji data for the emoji list feature
const animatedEmojis = {
  ':loading:': { name: 'loading', id: '1234567890', animated: true },
  ':typing:': { name: 'typing', id: '1234567891', animated: true },
  ':dance:': { name: 'dance', id: '1234567892', animated: true },
  ':wave:': { name: 'wave', id: '1234567893', animated: true }
};

// Define some basic unicode emojis for the emoji list feature
const unicodeEmojis = {
  ':smile:': '😄',
  ':heart:': '❤️',
  ':fire:': '🔥',
  ':star:': '⭐',
  ':thumbsup:': '👍',
  ':tada:': '🎉',
  ':rocket:': '🚀',
  ':sparkles:': '✨',
  ':trophy:': '🏆',
  ':100:': '💯'
};

module.exports = {
  name: 'embed',
  description: 'Create a custom embed message with Nitro emoji support',
  usage: '/embed',
  guildOnly: true, // This command can only be used in servers
  options: [
    {
      name: 'title',
      type: 3, // STRING type
      description: 'Title for the embed',
      required: true
    },
    {
      name: 'description',
      type: 3, // STRING type
      description: 'Description for the embed',
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
      name: 'thumbnail',
      type: 3, // STRING type
      description: 'URL of thumbnail to display',
      required: false
    },
    {
      name: 'footer',
      type: 3, // STRING type
      description: 'Footer text',
      required: false
    },
    {
      name: 'save',
      type: 3, // STRING type
      description: 'Save this embed as a template with this name',
      required: false
    },
    {
      name: 'use_nitro_emoji',
      type: 5, // BOOLEAN type
      description: 'Use Nitro emojis from all servers bot is in (default: true)',
      required: false
    },
    {
      name: 'use_builder',
      type: 5, // BOOLEAN type
      description: 'Use the advanced embed builder interface instead',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if the user wants to use the advanced builder
    if (isSlashCommand && interaction.options.getBoolean('use_builder')) {
      try {
        // Import the embedBuilder command
        const embedBuilder = require('./embedBuilder');
        
        // Create a blank embed template
        const templateData = embedBuilder.getTemplateEmbed('blank');
        
        // Set any provided values in the template
        if (interaction.options.getString('title')) {
          templateData.title = interaction.options.getString('title');
        }
        
        if (interaction.options.getString('description')) {
          templateData.description = interaction.options.getString('description');
        }
        
        if (interaction.options.getString('color')) {
          templateData.color = interaction.options.getString('color');
        }
        
        if (interaction.options.getString('image')) {
          templateData.image = interaction.options.getString('image');
        }
        
        if (interaction.options.getString('thumbnail')) {
          templateData.thumbnail = interaction.options.getString('thumbnail');
        }
        
        // Show the embed builder UI with the template
        return await embedBuilder.showEmbedBuilder(interaction, client, templateData);
      } catch (error) {
        console.error('Error opening embed builder:', error);
        return interaction.reply({ 
          content: `❌ Error opening embed builder: ${error.message}`, 
          ephemeral: true 
        });
      }
    }
    
    // Get embed parameters
    let title, description, color, imageUrl, thumbnailUrl, footerText, saveTemplateName;
    
    if (isSlashCommand) {
      // Get parameters from slash command
      title = interaction.options.getString('title');
      description = interaction.options.getString('description');
      color = interaction.options.getString('color');
      imageUrl = interaction.options.getString('image');
      thumbnailUrl = interaction.options.getString('thumbnail');
      footerText = interaction.options.getString('footer');
      saveTemplateName = interaction.options.getString('save');
      
      // Defer reply as creating embeds might take time
      await interaction.deferReply();
    } else {
      // Legacy command not supported for complex embed creation
      return message.reply('Please use the slash command `/embed` for creating custom embeds.');
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
    
    // Check if Nitro emoji should be used (default to true)
    const useNitroEmoji = interaction.options.getBoolean('use_nitro_emoji') ?? true;
    
    // Pre-process stickers and emojis in the title and description
    let processedTitle = title;
    let processedDescription = description;
    
    // First, pre-process any sticker formats
    processedTitle = processSticker(processedTitle);
    processedDescription = processSticker(processedDescription);
    
    // Process emoji codes using our enhanced emoji processor
    const serverEmojis = isSlashCommand ? interaction.guild.emojis.cache : message.guild.emojis.cache;
    
    // Only pass client if Nitro emoji support is requested
    const discordClient = useNitroEmoji ? client : null;
    console.log(`Embed command: Using ${useNitroEmoji ? 'ALL servers' : 'ONLY current server'} for emoji processing`);
    
    // Now run the emoji processor (which handles all emoji patterns)
    processedTitle = await emojiProcessor.processText(processedTitle, serverId);
    processedDescription = await emojiProcessor.processText(processedDescription, serverId);
    
    // Create the embed with processed content
    const embed = {
      title: processedTitle,
      description: processedDescription,
      color: colorDecimal
    };
    
    // Add optional fields if provided
    if (imageUrl) {
      embed.image = { url: imageUrl };
    }
    
    if (thumbnailUrl) {
      embed.thumbnail = { url: thumbnailUrl };
    }
    
    if (footerText) {
        // Process emojis in footer text too
      const processedFooter = await emojiProcessor.processText(processSticker(footerText), serverId);
      embed.footer = { text: processedFooter };
    }
    
    // Add timestamp
    embed.timestamp = new Date();
    
    // Save as template if requested
    if (saveTemplateName) {
      // Get existing templates or initialize
      const embedTemplates = serverConfig.embedTemplates || {};
      
      // Save the current embed as a template
      embedTemplates[saveTemplateName] = {
        title,
        description,
        color: color || '#5865F2',
        imageUrl,
        thumbnailUrl,
        footerText,
        createdAt: new Date().toISOString(),
        createdBy: isSlashCommand ? interaction.user.id : message.author.id
      };
      
      // Update server config
      config.updateServerConfig(serverId, {
        embedTemplates: embedTemplates
      });
      
      // Add note about saving
      if (!embed.footer) {
        embed.footer = { text: `Saved as template: ${saveTemplateName}` };
      } else {
        embed.footer.text += ` | Saved as template: ${saveTemplateName}`;
      }
    }
    
    // Send the embed
    try {
      // In Discord.js v14, we need to handle channels differently
      if (isSlashCommand) {
        // For slash commands, we should use the channelId to fetch the proper channel
        const resolvedChannel = interaction.guild.channels.cache.get(interaction.channelId);
        if (!resolvedChannel) {
          throw new Error('Could not resolve channel from interaction');
        }
        
        // Send the embed to the channel
        await resolvedChannel.send({ embeds: [embed] });
      } else {
        // For legacy commands
        await message.channel.send({ embeds: [embed] });
      }
      
      // Send confirmation - make sure it also includes guidance about stickers and emojis
      const confirmationEmbed = {
        title: '✅ Embed Created',
        description: 'Your custom embed has been created and sent to this channel.\n\n' +
                     '**Tip:** You can use emojis and stickers in your embeds with these formats:\n' +
                     '• `{sticker:name}` - Example: `{sticker:discord_nitro}`\n' + 
                     '• `[sticker:name]` - Example: `[sticker:heart_blast]`\n' +
                     '• Standard emoji codes like `:fire:` are also supported\n' +
                     '• Custom server emojis like `:emoji_12345678:` now work\n' +
                     '• Server emoji IDs can be used directly with `:name:id`\n' +
                     '• Nitro emojis from all servers the bot is in are ' + (useNitroEmoji ? '**enabled**' : 'available (use `use_nitro_emoji: true`)') + '\n\n' +
                     '**Discord supports all these formats in your embeds now!**',
        color: 0x00FF00, // Green
        fields: []
      };
      
      // Add info about saved template
      if (saveTemplateName) {
        confirmationEmbed.fields.push({
          name: '💾 Template Saved',
          value: `This embed has been saved as a template named \`${saveTemplateName}\`.\nYou can use it with the \`/embedtemplate\` command.`
        });
      }
      
      // Send confirmation
      await interaction.followUp({ embeds: [confirmationEmbed], ephemeral: true });
      
    } catch (error) {
      console.error('Error creating embed:', error);
      
      // Send error message
      const errorMessage = `❌ Error creating embed: ${error.message}`;
      
      if (isSlashCommand) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await message.reply(errorMessage);
      }
    }
    
    // Add a collector for emoji picking - this will allow users to add more emojis easily
    try {
      // Add an emoji picker button at the end of the confirmation message
      const emojiPickerRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('emoji_list_button')
            .setLabel('Show Available Emojis')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
          new ButtonBuilder()
            .setCustomId('create_new_embed')
            .setLabel('Create New Embed')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️')
        );
      
      // Send the emoji picker button
      const pickerMessage = await interaction.followUp({ 
        content: 'Want to see what emojis are available to use?',
        components: [emojiPickerRow],
        ephemeral: true 
      });
      
      // Set up collector for the emoji list button
      const filter = i => i.user.id === interaction.user.id && 
                           (i.customId === 'emoji_list_button' || i.customId === 'create_new_embed');
      
      const collector = pickerMessage.createMessageComponentCollector({ 
        filter, 
        time: 300000 // 5 minute timeout
      });
      
      collector.on('collect', async i => {
        if (i.customId === 'emoji_list_button') {
          // Get total emoji count
          let emojiCount = 0;
          client.guilds.cache.forEach(guild => {
            emojiCount += guild.emojis.cache.size;
          });
          
          // Create a list of server emojis (display first 30)
          let serverEmojiList = '';
          let count = 0;
          
          // Create a Map for efficient emoji lookups
          const allEmojis = new Map();
          client.guilds.cache.forEach(guild => {
            guild.emojis.cache.forEach(emoji => {
              if (!allEmojis.has(emoji.name)) {
                allEmojis.set(emoji.name, emoji);
              }
            });
          });
          
          // Display server emojis (limited to 30)
          allEmojis.forEach((emoji, name) => {
            if (count < 30) {
              const emojiString = emoji.animated ? `<a:${name}:${emoji.id}>` : `<:${name}:${emoji.id}>`;
              serverEmojiList += `${emojiString} - \`:${name}:\`\n`;
              count++;
            }
          });
          
          // If there are more emojis than displayed, show a count
          if (allEmojis.size > 30) {
            serverEmojiList += `\n...and ${allEmojis.size - 30} more server emojis available`;
          }
          
          // Create a list of built-in animated emojis
          let animatedEmojiList = '';
          count = 0;
          
          for (const [code, data] of Object.entries(animatedEmojis)) {
            if (count < 10) {
              animatedEmojiList += `<a:${data.name}:${data.id}> - \`${code}\` or \`{sticker:${data.name}}\`\n`;
              count++;
            }
          }
          
          // Create a list of standard emoji examples (show 10)
          const unicodeKeys = Object.keys(unicodeEmojis);
          let unicodeList = '';
          for (let i = 0; i < Math.min(10, unicodeKeys.length); i++) {
            const code = unicodeKeys[i];
            unicodeList += `${unicodeEmojis[code]} - \`${code}\`\n`;
          }
          
          // Send the emoji list with all categories
          await i.reply({
            embeds: [{
              title: '🎭 Available Emojis for Embeds',
              description: 'Here are the emojis you can use in your embeds:',
              color: 0xFF9900,
              fields: [
                {
                  name: '🌟 Server Emojis (use `:name:` format)',
                  value: serverEmojiList || 'No server emojis available',
                  inline: false
                },
                {
                  name: '✨ Animated Stickers (use `{sticker:name}` format)',
                  value: animatedEmojiList || 'No animated stickers available',
                  inline: false
                },
                {
                  name: '😊 Standard Discord Emojis (examples)',
                  value: unicodeList + '\n...and many more standard emojis available',
                  inline: false
                },
                {
                  name: '💡 Emoji Tips',
                  value: '• You can use any standard Discord emoji code like `:smile:` or `:heart:` 💖\n' +
                         '• Use sticker format like `{sticker:name}` or `[sticker:name]`\n' +
                         '• All emojis from servers the bot is in are available with Nitro support\n' +
                         '• Try using emoji categories: hearts, technical, gaming, security',
                  inline: false
                }
              ],
              footer: {
                text: `Total server emojis available: ${emojiCount} | Enhanced emoji support enabled`
              }
            }],
            ephemeral: true
          });
        } else if (i.customId === 'create_new_embed') {
          // Show a modal for quick embed creation
          const modal = new ModalBuilder()
            .setCustomId('quick_embed_modal')
            .setTitle('Create Quick Embed');
            
          // Add title input component
          const titleInput = new TextInputBuilder()
            .setCustomId('modal_title')
            .setLabel('Embed Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter a title for your embed');
            
          // Add description input component
          const descriptionInput = new TextInputBuilder()
            .setCustomId('modal_description')
            .setLabel('Embed Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Enter a description (supports emojis like :fire: and {sticker:name})');
            
          // Add color input component  
          const colorInput = new TextInputBuilder()
            .setCustomId('modal_color')
            .setLabel('Color (hex code)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('#5865F2');
          
          // Create action rows with the inputs
          const titleRow = new ActionRowBuilder().addComponents(titleInput);
          const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
          const colorRow = new ActionRowBuilder().addComponents(colorInput);
          
          // Add the components to the modal
          modal.addComponents(titleRow, descriptionRow, colorRow);
          
          // Show the modal to the user
          await i.showModal(modal);
        }
      });
    } catch (error) {
      console.error('Error setting up emoji picker:', error);
    }
  },
};