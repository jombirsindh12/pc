const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');
const emojiProcessor = require('../utils/emojiProcessor');
const { getServerTemplates, getTemplate, saveTemplate, deleteTemplate, setTemplatePublic, getPublicTemplates } = require('../schemas/embedTemplates');
const { getTemplateEmbed } = require('./embedBuilder');

module.exports = {
  name: 'embedtemplate',
  description: 'Manage embed templates for your server',
  usage: '/embedtemplate <action>',
  guildOnly: true,
  options: [
    {
      name: 'list',
      type: 1, // SUB_COMMAND
      description: 'List all available templates for this server'
    },
    {
      name: 'load',
      type: 1,
      description: 'Load a template and edit it',
      options: [
        {
          name: 'template_name',
          type: 3, // STRING
          description: 'Name of the template to load',
          required: true
        }
      ]
    },
    {
      name: 'delete',
      type: 1,
      description: 'Delete a template',
      options: [
        {
          name: 'template_name',
          type: 3,
          description: 'Name of the template to delete',
          required: true
        }
      ]
    },
    {
      name: 'share',
      type: 1,
      description: 'Make a template public or private',
      options: [
        {
          name: 'template_name',
          type: 3,
          description: 'Name of the template to share',
          required: true
        },
        {
          name: 'public',
          type: 5, // BOOLEAN
          description: 'Whether the template should be public or not',
          required: true
        }
      ]
    },
    {
      name: 'explore',
      type: 1,
      description: 'Explore public templates from other servers'
    }
  ],
  
  // User needs either MANAGE_MESSAGES or Administrator to use this command
  permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.Administrator],
  
  async execute(message, args, client, interaction = null) {
    if (!interaction) {
      return message.reply('Please use the slash command `/embedtemplate` to use this feature.');
    }
    
    const subcommand = interaction.options.getSubcommand();
    const serverId = interaction.guild.id;
    
    switch (subcommand) {
      case 'list':
        await this.listTemplates(interaction, serverId);
        break;
        
      case 'load':
        const templateName = interaction.options.getString('template_name');
        await this.loadTemplate(interaction, client, serverId, templateName);
        break;
        
      case 'delete':
        const templateToDelete = interaction.options.getString('template_name');
        await this.deleteTemplate(interaction, serverId, templateToDelete);
        break;
        
      case 'share':
        const templateToShare = interaction.options.getString('template_name');
        const isPublic = interaction.options.getBoolean('public');
        await this.shareTemplate(interaction, serverId, templateToShare, isPublic);
        break;
        
      case 'explore':
        await this.exploreTemplates(interaction, client);
        break;
        
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand. Please use one of the available subcommands.',
          ephemeral: true
        });
    }
  },
  
  /**
   * List all templates for the server
   * @param {Object} interaction Discord interaction
   * @param {string} serverId Server ID
   */
  async listTemplates(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get templates from database
      const templates = await getServerTemplates(serverId);
      
      if (templates.length === 0) {
        return interaction.followUp({
          content: 'No templates found for this server. Create templates using the `/embedbuilder` command and saving them.',
          ephemeral: true
        });
      }
      
      // Create an embed to display the templates
      const embed = new EmbedBuilder()
        .setTitle('📝 Embed Templates for This Server')
        .setDescription('Here are all the saved templates for this server:')
        .setColor('#3498DB');
      
      // Add each template as a field
      templates.forEach(template => {
        embed.addFields({
          name: `${template.name} ${template.isPublic ? '🌐' : '🔒'}`,
          value: `Title: ${template.title || 'None'}\nDescription: ${template.description ? (template.description.length > 50 ? template.description.substring(0, 50) + '...' : template.description) : 'None'}\nCreated by: <@${template.createdById}>\nCreated: ${new Date(template.createdAt).toLocaleString()}`
        });
      });
      
      // Create action buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('refresh_templates')
            .setLabel('Refresh List')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),
          new ButtonBuilder()
            .setCustomId('create_template')
            .setLabel('Create New Template')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➕')
        );
      
      await interaction.followUp({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      // Set up button collector
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 300000 // 5 minutes
      });
      
      collector.on('collect', async i => {
        if (i.customId === 'refresh_templates') {
          await i.deferUpdate();
          await this.listTemplates(interaction, serverId);
        } else if (i.customId === 'create_template') {
          await i.deferUpdate();
          await i.followUp({
            content: 'To create a new template, use the `/embedbuilder` command and save your creation as a template.',
            ephemeral: true
          });
        }
      });
      
    } catch (error) {
      console.error('Error listing templates:', error);
      await interaction.followUp({
        content: `❌ Error listing templates: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  /**
   * Load a template and start editing it
   * @param {Object} interaction Discord interaction
   * @param {Object} client Discord client
   * @param {string} serverId Server ID
   * @param {string} templateName Template name
   */
  async loadTemplate(interaction, client, serverId, templateName) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Check if it's a built-in template
      const builtInTemplates = ['announcement', 'rules', 'welcome', 'giveaway', 'info', 'blank'];
      
      let embedData;
      
      if (builtInTemplates.includes(templateName.toLowerCase())) {
        // Load built-in template
        embedData = getTemplateEmbed(templateName.toLowerCase());
      } else {
        // Load custom template from database
        const template = await getTemplate(serverId, templateName);
        
        if (!template) {
          return interaction.followUp({
            content: `❌ Template "${templateName}" not found. Check the name and try again.`,
            ephemeral: true
          });
        }
        
        embedData = template.embedData;
      }
      
      // Import the embedBuilder command to reuse its UI
      const embedBuilder = require('./embedBuilder');
      
      // Show the embed builder UI with this template
      await embedBuilder.showEmbedBuilder(interaction, client, embedData);
      
    } catch (error) {
      console.error('Error loading template:', error);
      await interaction.followUp({
        content: `❌ Error loading template: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  /**
   * Delete a template
   * @param {Object} interaction Discord interaction
   * @param {string} serverId Server ID
   * @param {string} templateName Template name
   */
  async deleteTemplate(interaction, serverId, templateName) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Check if template exists
      const template = await getTemplate(serverId, templateName);
      
      if (!template) {
        return interaction.followUp({
          content: `❌ Template "${templateName}" not found. Check the name and try again.`,
          ephemeral: true
        });
      }
      
      // Check if user has permission (created the template or is admin)
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isCreator = template.createdById === interaction.user.id;
      
      if (!isAdmin && !isCreator) {
        return interaction.followUp({
          content: '❌ You can only delete templates that you created unless you have Administrator permissions.',
          ephemeral: true
        });
      }
      
      // Create confirmation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_delete')
            .setLabel('Delete Template')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
      
      const response = await interaction.followUp({
        content: `Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`,
        components: [row],
        ephemeral: true
      });
      
      // Set up button collector
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 30000, // 30 seconds
        max: 1
      });
      
      collector.on('collect', async i => {
        if (i.customId === 'confirm_delete') {
          try {
            await deleteTemplate(serverId, templateName);
            await i.update({
              content: `✅ Template "${templateName}" has been deleted successfully.`,
              components: []
            });
          } catch (error) {
            console.error('Error deleting template:', error);
            await i.update({
              content: `❌ Error deleting template: ${error.message}`,
              components: []
            });
          }
        } else if (i.customId === 'cancel_delete') {
          await i.update({
            content: `🛑 Deletion of template "${templateName}" has been cancelled.`,
            components: []
          });
        }
      });
      
      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({
            content: '⏱️ Template deletion timed out. No changes made.',
            components: []
          });
        }
      });
      
    } catch (error) {
      console.error('Error in delete template command:', error);
      await interaction.followUp({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  /**
   * Make a template public or private
   * @param {Object} interaction Discord interaction
   * @param {string} serverId Server ID
   * @param {string} templateName Template name
   * @param {boolean} isPublic Whether the template should be public
   */
  async shareTemplate(interaction, serverId, templateName, isPublic) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Check if template exists
      const template = await getTemplate(serverId, templateName);
      
      if (!template) {
        return interaction.followUp({
          content: `❌ Template "${templateName}" not found. Check the name and try again.`,
          ephemeral: true
        });
      }
      
      // Check if user has permission (created the template or is admin)
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isCreator = template.createdById === interaction.user.id;
      
      if (!isAdmin && !isCreator) {
        return interaction.followUp({
          content: '❌ You can only change sharing settings for templates that you created unless you have Administrator permissions.',
          ephemeral: true
        });
      }
      
      // Update template visibility
      await setTemplatePublic(serverId, templateName, isPublic);
      
      await interaction.followUp({
        content: `✅ Template "${templateName}" is now ${isPublic ? 'public and visible to other servers' : 'private and only visible within this server'}.`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error sharing template:', error);
      await interaction.followUp({
        content: `❌ Error updating template visibility: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  /**
   * Explore public templates from other servers
   * @param {Object} interaction Discord interaction
   * @param {Object} client Discord client
   */
  async exploreTemplates(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get public templates from database
      const templates = await getPublicTemplates();
      
      if (templates.length === 0) {
        return interaction.followUp({
          content: 'No public templates found. Try again later or create your own templates!',
          ephemeral: true
        });
      }
      
      // Create an embed to display the templates
      const embed = new EmbedBuilder()
        .setTitle('🌐 Public Embed Templates')
        .setDescription('Here are public templates shared by other servers:')
        .setColor('#3498DB');
      
      // Add each template as a field
      templates.forEach(template => {
        const serverName = client.guilds.cache.get(template.serverId)?.name || 'Unknown Server';
        
        embed.addFields({
          name: `${template.name} from ${serverName}`,
          value: `Title: ${template.title || 'None'}\nDescription: ${template.description ? (template.description.length > 50 ? template.description.substring(0, 50) + '...' : template.description) : 'None'}\nCreated: ${new Date(template.createdAt).toLocaleString()}`
        });
      });
      
      // Create template selection menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_public_template')
        .setPlaceholder('Select a template to use')
        .addOptions(
          templates.map(template => {
            const serverName = client.guilds.cache.get(template.serverId)?.name || 'Unknown Server';
            return {
              label: template.name,
              description: `From ${serverName}`,
              value: `${template.serverId}:${template.name}`
            };
          })
        );
      
      const row = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.followUp({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      // Set up selection menu collector
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 300000 // 5 minutes
      });
      
      collector.on('collect', async i => {
        if (i.customId === 'select_public_template') {
          await i.deferUpdate();
          
          const [templateServerId, templateName] = i.values[0].split(':');
          
          try {
            // Get the template
            const template = await getTemplate(templateServerId, templateName);
            
            if (!template) {
              return i.followUp({
                content: `❌ Template not found. It may have been removed by its creator.`,
                ephemeral: true
              });
            }
            
            // Import the embedBuilder command to reuse its UI
            const embedBuilder = require('./embedBuilder');
            
            // Show the embed builder UI with this template
            await embedBuilder.showEmbedBuilder(interaction, client, template.embedData);
            
          } catch (error) {
            console.error('Error loading public template:', error);
            await i.followUp({
              content: `❌ Error loading template: ${error.message}`,
              ephemeral: true
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error exploring templates:', error);
      await interaction.followUp({
        content: `❌ Error exploring templates: ${error.message}`,
        ephemeral: true
      });
    }
  }
};