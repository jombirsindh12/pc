const { pgTable, text, timestamp, serial, boolean, json } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { eq, and } = require('drizzle-orm');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const db = drizzle(pool);

// Define the schema for embed templates
const embedTemplatesSchema = pgTable('embed_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  serverId: text('server_id').notNull(),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // Store the complete embed data as JSON
  embedData: json('embed_data').notNull(),
  // Fields for quick access without parsing JSON
  title: text('title'),
  description: text('description'),
  color: text('color'),
  isPublic: boolean('is_public').default(false).notNull()
});

// Function to get all templates for a server
async function getServerTemplates(serverId) {
  try {
    return await db.select().from(embedTemplatesSchema)
      .where(eq(embedTemplatesSchema.serverId, serverId))
      .orderBy(embedTemplatesSchema.name);
  } catch (error) {
    console.error('Error getting server templates:', error);
    return [];
  }
}

// Function to get a specific template
async function getTemplate(serverId, templateName) {
  try {
    const [template] = await db.select().from(embedTemplatesSchema)
      .where(
        and(
          eq(embedTemplatesSchema.serverId, serverId),
          eq(embedTemplatesSchema.name, templateName)
        )
      );
    return template;
  } catch (error) {
    console.error('Error getting template:', error);
    return null;
  }
}

// Function to save a template
async function saveTemplate(serverId, templateName, embedData, createdById) {
  try {
    const existingTemplate = await getTemplate(serverId, templateName);
    
    if (existingTemplate) {
      // Update existing template
      return await db.update(embedTemplatesSchema)
        .set({
          embedData,
          title: embedData.title || null,
          description: embedData.description || null,
          color: embedData.color || null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(embedTemplatesSchema.serverId, serverId),
            eq(embedTemplatesSchema.name, templateName)
          )
        )
        .returning();
    } else {
      // Create new template
      return await db.insert(embedTemplatesSchema)
        .values({
          name: templateName,
          serverId,
          createdById,
          embedData,
          title: embedData.title || null,
          description: embedData.description || null,
          color: embedData.color || null
        })
        .returning();
    }
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
}

// Function to delete a template
async function deleteTemplate(serverId, templateName) {
  try {
    return await db.delete(embedTemplatesSchema)
      .where(
        and(
          eq(embedTemplatesSchema.serverId, serverId),
          eq(embedTemplatesSchema.name, templateName)
        )
      );
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

// Function to make a template public
async function setTemplatePublic(serverId, templateName, isPublic) {
  try {
    return await db.update(embedTemplatesSchema)
      .set({ isPublic })
      .where(
        and(
          eq(embedTemplatesSchema.serverId, serverId),
          eq(embedTemplatesSchema.name, templateName)
        )
      );
  } catch (error) {
    console.error('Error updating template visibility:', error);
    throw error;
  }
}

// Function to get public templates
async function getPublicTemplates() {
  try {
    return await db.select().from(embedTemplatesSchema)
      .where(eq(embedTemplatesSchema.isPublic, true))
      .orderBy(embedTemplatesSchema.name);
  } catch (error) {
    console.error('Error getting public templates:', error);
    return [];
  }
}

module.exports = {
  embedTemplatesSchema,
  getServerTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  setTemplatePublic,
  getPublicTemplates
};