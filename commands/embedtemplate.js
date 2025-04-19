const config = require('../utils/config');

module.exports = {
  name: 'embedtemplate',
  description: 'Use or manage saved embed templates',
  usage: '/embedtemplate [action] [name]',
  guildOnly: true, // This command can only be used in servers
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with templates',
      required: true,
      choices: [
        {
          name: 'use',
          value: 'use'
        },
        {
          name: 'list',
          value: 'list'
        },
        {
          name: 'delete',
          value: 'delete'
        }
      ]
    },
    {
      name: 'name',
      type: 3, // STRING type
      description: 'Name of the template to use or delete',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get templates or initialize
    const embedTemplates = serverConfig.embedTemplates || {};
    
    // Get parameters
    let action, templateName;
    
    if (isSlashCommand) {
      action = interaction.options.getString('action');
      templateName = interaction.options.getString('name');
      
      // Defer reply for list action to ensure we have time to build the response
      if (action === 'list') {
        await interaction.deferReply();
      }
    } else {
      // Legacy command handling - simplified since we're focusing on slash commands
      return message.reply('Please use the slash command `/embedtemplate` instead.');
    }
    
    // Handle different actions
    switch (action) {
      case 'list':
        // List all templates
        const templateList = {
          title: '📋 Saved Embed Templates',
          description: Object.keys(embedTemplates).length > 0 
            ? 'The following embed templates are available:' 
            : 'No embed templates have been saved yet.',
          color: 0x5865F2, // Discord blurple
          fields: []
        };
        
        // Add each template to the list
        Object.entries(embedTemplates).forEach(([name, template]) => {
          const createdDate = new Date(template.createdAt).toLocaleDateString();
          
          templateList.fields.push({
            name: `📝 ${name}`,
            value: `Title: ${template.title}\n` +
                  `Created: ${createdDate}\n` +
                  `Color: ${template.color || 'Default'}`
          });
        });
        
        // Send the list
        await interaction.followUp({ embeds: [templateList] });
        break;
        
      case 'use':
        // Check if template name was provided
        if (!templateName) {
          return interaction.reply({ 
            content: '❌ Please provide a template name to use. Use `/embedtemplate list` to see available templates.',
            ephemeral: true
          });
        }
        
        // Check if template exists
        if (!embedTemplates[templateName]) {
          return interaction.reply({ 
            content: `❌ Template "${templateName}" does not exist. Use \`/embedtemplate list\` to see available templates.`,
            ephemeral: true
          });
        }
        
        // Get the template
        const template = embedTemplates[templateName];
        
        // Create embed from template
        const embed = {
          title: template.title,
          description: template.description,
          color: parseInt(template.color?.replace('#', '') || '5865F2', 16),
          timestamp: new Date()
        };
        
        // Add optional fields if present in template
        if (template.imageUrl) {
          embed.image = { url: template.imageUrl };
        }
        
        if (template.thumbnailUrl) {
          embed.thumbnail = { url: template.thumbnailUrl };
        }
        
        if (template.footerText) {
          embed.footer = { text: template.footerText };
        }
        
        // Send the embed
        try {
          // Defer the reply first
          await interaction.deferReply();
          
          // Get the proper channel from the guild
          const resolvedChannel = interaction.guild.channels.cache.get(interaction.channelId);
          if (!resolvedChannel) {
            throw new Error('Could not resolve channel from interaction');
          }
          
          // Send embed to proper channel
          await resolvedChannel.send({ embeds: [embed] });
          
          // Send confirmation
          await interaction.followUp({ 
            content: `✅ Template "${templateName}" has been used to create an embed in this channel.`,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error using embed template:', error);
          await interaction.followUp({ 
            content: `❌ Error using template: ${error.message}`,
            ephemeral: true
          });
        }
        break;
        
      case 'delete':
        // Check if template name was provided
        if (!templateName) {
          return interaction.reply({ 
            content: '❌ Please provide a template name to delete. Use `/embedtemplate list` to see available templates.',
            ephemeral: true
          });
        }
        
        // Check if template exists
        if (!embedTemplates[templateName]) {
          return interaction.reply({ 
            content: `❌ Template "${templateName}" does not exist. Use \`/embedtemplate list\` to see available templates.`,
            ephemeral: true
          });
        }
        
        // Delete the template
        delete embedTemplates[templateName];
        
        // Update server config
        config.updateServerConfig(serverId, {
          embedTemplates: embedTemplates
        });
        
        // Send confirmation
        await interaction.reply({ 
          content: `✅ Template "${templateName}" has been deleted.`,
          ephemeral: true
        });
        break;
        
      default:
        await interaction.reply({ 
          content: '❌ Invalid action. Please use `list`, `use`, or `delete`.',
          ephemeral: true
        });
    }
  },
};