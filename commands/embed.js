const config = require('../utils/config');

module.exports = {
  name: 'embed',
  description: 'Create a custom embed message',
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
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
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
    
    // Create the embed
    const embed = {
      title: title,
      description: description,
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
      embed.footer = { text: footerText };
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
      
      // Send confirmation
      const confirmationEmbed = {
        title: '✅ Embed Created',
        description: 'Your custom embed has been created and sent to this channel.',
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
  },
};