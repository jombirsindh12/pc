/**
 * Embed Template Manager
 * 
 * This module handles the management of embed templates, including:
 * - Creating and saving templates
 * - Loading templates from the database
 * - Sharing templates between servers
 * - Converting template data to Discord embeds
 */

const { db } = require('./database');
const { embedTemplates } = require('../shared/schema');
const { eq, and, or, like } = require('drizzle-orm');
const { EmbedBuilder } = require('discord.js');

/**
 * Save an embed template to the database
 * @param {Object} template - Template data
 * @param {string} template.serverId - Server ID
 * @param {string} template.name - Template name
 * @param {string} template.creatorId - Creator user ID
 * @param {Object} template.embedData - Embed data structure
 * @param {string} template.description - Template description
 * @param {boolean} template.isPublic - Whether the template is public
 * @returns {Object} Saved template
 */
async function saveTemplate(template) {
  try {
    // Check if template with this name already exists for this server
    const existingTemplate = await db.query.embedTemplates.findFirst({
      where: and(
        eq(embedTemplates.serverId, template.serverId),
        eq(embedTemplates.name, template.name)
      )
    });
    
    if (existingTemplate) {
      // Update existing template
      const [updatedTemplate] = await db.update(embedTemplates)
        .set({
          embedData: template.embedData,
          description: template.description,
          isPublic: template.isPublic,
          updatedAt: new Date()
        })
        .where(eq(embedTemplates.id, existingTemplate.id))
        .returning();
      
      return updatedTemplate;
    } else {
      // Create new template
      const [newTemplate] = await db.insert(embedTemplates)
        .values({
          serverId: template.serverId,
          name: template.name,
          creatorId: template.creatorId,
          embedData: template.embedData,
          description: template.description || null,
          isPublic: template.isPublic || false
        })
        .returning();
      
      return newTemplate;
    }
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
}

/**
 * Get a template by name for a specific server
 * @param {string} serverId - Server ID
 * @param {string} name - Template name
 * @returns {Object} Template data or null if not found
 */
async function getTemplate(serverId, name) {
  try {
    const template = await db.query.embedTemplates.findFirst({
      where: and(
        eq(embedTemplates.serverId, serverId),
        eq(embedTemplates.name, name)
      )
    });
    
    return template;
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
}

/**
 * Get all templates for a server
 * @param {string} serverId - Server ID
 * @returns {Array} Array of templates
 */
async function getServerTemplates(serverId) {
  try {
    const templates = await db.query.embedTemplates.findMany({
      where: eq(embedTemplates.serverId, serverId),
      orderBy: (embedTemplates, { asc }) => [asc(embedTemplates.name)]
    });
    
    return templates;
  } catch (error) {
    console.error('Error getting server templates:', error);
    return [];
  }
}

/**
 * Delete a template
 * @param {string} serverId - Server ID
 * @param {string} name - Template name
 * @returns {boolean} Success flag
 */
async function deleteTemplate(serverId, name) {
  try {
    await db.delete(embedTemplates)
      .where(and(
        eq(embedTemplates.serverId, serverId),
        eq(embedTemplates.name, name)
      ));
    
    return true;
  } catch (error) {
    console.error('Error deleting template:', error);
    return false;
  }
}

/**
 * Set a template's public status
 * @param {string} serverId - Server ID
 * @param {string} name - Template name
 * @param {boolean} isPublic - Public status
 * @returns {Object} Updated template
 */
async function setTemplatePublic(serverId, name, isPublic) {
  try {
    const [updatedTemplate] = await db.update(embedTemplates)
      .set({ isPublic })
      .where(and(
        eq(embedTemplates.serverId, serverId),
        eq(embedTemplates.name, name)
      ))
      .returning();
    
    return updatedTemplate;
  } catch (error) {
    console.error('Error updating template public status:', error);
    throw error;
  }
}

/**
 * Get public templates from all servers
 * @param {string} search - Optional search term
 * @param {number} limit - Maximum number of results
 * @returns {Array} Array of public templates
 */
async function getPublicTemplates(search = null, limit = 25) {
  try {
    let query = and(eq(embedTemplates.isPublic, true));
    
    if (search) {
      query = and(
        eq(embedTemplates.isPublic, true),
        or(
          like(embedTemplates.name, `%${search}%`),
          like(embedTemplates.description, `%${search}%`)
        )
      );
    }
    
    const templates = await db.query.embedTemplates.findMany({
      where: query,
      orderBy: (embedTemplates, { desc }) => [desc(embedTemplates.uses)],
      limit
    });
    
    return templates;
  } catch (error) {
    console.error('Error getting public templates:', error);
    return [];
  }
}

/**
 * Increment the use count for a template
 * @param {number} templateId - Template ID
 */
async function incrementTemplateUses(templateId) {
  try {
    const template = await db.query.embedTemplates.findFirst({
      where: eq(embedTemplates.id, templateId)
    });
    
    if (template) {
      await db.update(embedTemplates)
        .set({ uses: template.uses + 1 })
        .where(eq(embedTemplates.id, templateId));
    }
  } catch (error) {
    console.error('Error incrementing template uses:', error);
  }
}

/**
 * Copy a template from one server to another
 * @param {number} templateId - Template ID to copy
 * @param {string} targetServerId - Target server ID
 * @param {string} newName - Optional new name for the template
 * @param {string} creatorId - ID of user copying the template
 * @returns {Object} Newly created template
 */
async function copyTemplate(templateId, targetServerId, newName, creatorId) {
  try {
    const sourceTemplate = await db.query.embedTemplates.findFirst({
      where: eq(embedTemplates.id, templateId)
    });
    
    if (!sourceTemplate) {
      throw new Error('Template not found');
    }
    
    const [newTemplate] = await db.insert(embedTemplates)
      .values({
        serverId: targetServerId,
        name: newName || `Copy of ${sourceTemplate.name}`,
        creatorId: creatorId,
        embedData: sourceTemplate.embedData,
        description: sourceTemplate.description,
        isPublic: false // Copies are private by default
      })
      .returning();
    
    // Increment use count on the source template
    await incrementTemplateUses(templateId);
    
    return newTemplate;
  } catch (error) {
    console.error('Error copying template:', error);
    throw error;
  }
}

/**
 * Convert template data to a Discord.js embed object
 * @param {Object} embedData - Embed data
 * @returns {EmbedBuilder} Discord.js embed
 */
function createEmbed(embedData) {
  const embed = new EmbedBuilder();
  
  // Set basic properties
  if (embedData.title) embed.setTitle(embedData.title);
  if (embedData.description) embed.setDescription(embedData.description);
  if (embedData.color) embed.setColor(embedData.color);
  if (embedData.url) embed.setURL(embedData.url);
  
  // Set timestamp if needed
  if (embedData.timestamp) {
    embed.setTimestamp(embedData.timestamp === true ? new Date() : new Date(embedData.timestamp));
  }
  
  // Set author
  if (embedData.author && embedData.author.name) {
    embed.setAuthor({
      name: embedData.author.name,
      iconURL: embedData.author.iconURL || undefined,
      url: embedData.author.url || undefined
    });
  }
  
  // Set footer
  if (embedData.footer && embedData.footer.text) {
    embed.setFooter({
      text: embedData.footer.text,
      iconURL: embedData.footer.iconURL || undefined
    });
  }
  
  // Set thumbnail
  if (embedData.thumbnail) {
    embed.setThumbnail(embedData.thumbnail);
  }
  
  // Set image
  if (embedData.image) {
    embed.setImage(embedData.image);
  }
  
  // Add fields
  if (embedData.fields && embedData.fields.length > 0) {
    for (const field of embedData.fields) {
      if (field.name && field.value) {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline || false
        });
      }
    }
  }
  
  return embed;
}

/**
 * Get default templates
 * @returns {Array} Array of default template objects
 */
function getDefaultTemplates() {
  return [
    {
      name: "Basic Announcement",
      description: "Simple announcement with title and description",
      embedData: {
        title: "Announcement Title",
        description: "Important announcement details go here. You can add more information as needed.",
        color: "#3498db",
        timestamp: true
      }
    },
    {
      name: "Server Welcome",
      description: "Welcome message for new members",
      embedData: {
        title: "Welcome to the Server!",
        description: "Thanks for joining our community! Please read the rules and have a great time.",
        color: "#2ecc71",
        thumbnail: "https://cdn.discordapp.com/embed/avatars/0.png",
        fields: [
          {
            name: "Rules",
            value: "Check the #rules channel",
            inline: true
          },
          {
            name: "Support",
            value: "Visit #help channel",
            inline: true
          }
        ],
        footer: {
          text: "We're happy to have you here!"
        }
      }
    },
    {
      name: "Event Announcement",
      description: "Template for announcing events",
      embedData: {
        title: "🎉 Upcoming Event",
        description: "Join us for this exciting event! Don't miss out on the fun.",
        color: "#9b59b6",
        fields: [
          {
            name: "📅 Date",
            value: "January 1, 2023",
            inline: true
          },
          {
            name: "⏰ Time",
            value: "8:00 PM EST",
            inline: true
          },
          {
            name: "📍 Location",
            value: "Main Voice Channel",
            inline: true
          },
          {
            name: "📝 Details",
            value: "More information about the event goes here. You can describe what will happen and what to expect."
          }
        ],
        footer: {
          text: "React with ✅ to RSVP"
        }
      }
    },
    {
      name: "Staff Application",
      description: "Template for staff applications",
      embedData: {
        title: "Staff Application",
        description: "We're looking for new staff members to join our team! If you're interested, please fill out the application below.",
        color: "#e74c3c",
        fields: [
          {
            name: "Requirements",
            value: "• 18+ years old\n• Active on Discord\n• Previous moderation experience\n• Good communication skills"
          },
          {
            name: "How to Apply",
            value: "DM a staff member with the following information:\n• Age:\n• Timezone:\n• Previous experience:\n• Why you want to join our staff team:"
          }
        ],
        footer: {
          text: "Applications close on January 15, 2023"
        }
      }
    }
  ];
}

module.exports = {
  saveTemplate,
  getTemplate,
  getServerTemplates,
  deleteTemplate,
  setTemplatePublic,
  getPublicTemplates,
  incrementTemplateUses,
  copyTemplate,
  createEmbed,
  getDefaultTemplates
};