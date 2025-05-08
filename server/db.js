/**
 * Database Connection Manager
 * 
 * This file manages database connections and provides the Drizzle ORM instance
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('../shared/schema');

// Check for database connection URL
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Invite tracking functionality will be disabled.');
}

// Create connection pool
let pool;
let db;

try {
  // Initialize database connection
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Create Drizzle ORM instance
  db = drizzle(pool, { schema });
  
  console.log('✅ Connected to PostgreSQL database successfully');
} catch (error) {
  console.error('❌ Error connecting to database:', error.message);
}

// Database helper functions
const inviteTracker = {
  /**
   * Initialize database tables if they don't exist
   */
  async initializeTables() {
    if (!pool) return;
    
    try {
      // First create invites table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invites (
          id SERIAL PRIMARY KEY,
          server_id TEXT NOT NULL,
          invite_code TEXT NOT NULL,
          inviter_id TEXT NOT NULL,
          inviter_tag TEXT,
          uses INTEGER NOT NULL DEFAULT 0,
          max_uses INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP
        )
      `);
      
      // Then create invite_joins table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_joins (
          id SERIAL PRIMARY KEY,
          server_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          member_tag TEXT,
          invite_code TEXT NOT NULL,
          inviter_id TEXT NOT NULL,
          inviter_tag TEXT,
          joined_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Finally create invite_settings table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invite_settings (
          server_id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 1,
          log_channel_id TEXT,
          update_channel_id TEXT,
          welcome_message TEXT,
          show_inviter INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database tables:', error.message);
    }
  },
  
  /**
   * Save invite data to the database
   * @param {object} invite Discord invite object
   */
  async saveInvite(invite) {
    if (!pool) return;
    
    try {
      const { guild, code, inviter, uses, maxUses, expiresAt } = invite;
      
      // Check if invite already exists
      const checkQuery = {
        text: `SELECT * FROM invites WHERE invite_code = $1 AND server_id = $2`,
        values: [code, guild.id]
      };
      
      const existingResult = await pool.query(checkQuery);
      
      if (existingResult.rows.length > 0) {
        // Update existing invite
        const updateQuery = {
          text: `
            UPDATE invites 
            SET uses = $1, 
                max_uses = $2, 
                expires_at = $3
            WHERE invite_code = $4 AND server_id = $5
          `,
          values: [
            uses, 
            maxUses || null, 
            expiresAt ? new Date(expiresAt) : null, 
            code, 
            guild.id
          ]
        };
        
        await pool.query(updateQuery);
      } else {
        // Insert new invite
        const insertQuery = {
          text: `
            INSERT INTO invites (
              server_id, 
              invite_code, 
              inviter_id, 
              inviter_tag, 
              uses, 
              max_uses, 
              expires_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7
            )
          `,
          values: [
            guild.id,
            code,
            inviter ? inviter.id : '0',
            inviter ? inviter.tag || inviter.username : 'Unknown',
            uses,
            maxUses || null,
            expiresAt ? new Date(expiresAt) : null
          ]
        };
        
        await pool.query(insertQuery);
      }
      
      console.log(`✅ Saved invite data for code: ${code} in server: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Error saving invite data:`, error.message);
    }
  },
  
  /**
   * Save invite usage when a member joins
   * @param {object} member Discord member object 
   * @param {string} inviteCode Invite code used
   * @param {string} inviterId Discord ID of the inviter
   */
  async saveInviteJoin(member, inviteCode, inviterId) {
    if (!pool) return;
    
    try {
      // Get inviter tag if available
      let inviterTag = 'Unknown';
      
      const inviterQuery = {
        text: `SELECT inviter_tag FROM invites WHERE inviter_id = $1 AND server_id = $2 LIMIT 1`,
        values: [inviterId, member.guild.id]
      };
      
      const inviterResult = await pool.query(inviterQuery);
      if (inviterResult.rows.length > 0) {
        inviterTag = inviterResult.rows[0].inviter_tag;
      }
      
      // Insert invite join record
      const insertQuery = {
        text: `
          INSERT INTO invite_joins (
            server_id, 
            member_id, 
            member_tag, 
            invite_code, 
            inviter_id,
            inviter_tag,
            joined_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        values: [
          member.guild.id,
          member.id,
          member.user.tag || member.user.username,
          inviteCode,
          inviterId,
          inviterTag,
          new Date()
        ]
      };
      
      await pool.query(insertQuery);
      
      // Update invite uses count
      const updateQuery = {
        text: `
          UPDATE invites
          SET uses = uses + 1
          WHERE invite_code = $1 AND server_id = $2
        `,
        values: [inviteCode, member.guild.id]
      };
      
      await pool.query(updateQuery);
      
      console.log(`✅ Saved join record for ${member.user.tag || member.user.username} using invite code ${inviteCode} from inviter ${inviterId}`);
    } catch (error) {
      console.error(`❌ Error saving invite join:`, error.message);
    }
  },
  
  /**
   * Get inviter information for a specific member
   * @param {string} serverId Discord server ID
   * @param {string} memberId Discord member ID
   * @returns {object|null} Inviter information or null
   */
  async getMemberInviter(serverId, memberId) {
    if (!pool) return null;
    
    try {
      // Since we now store inviter_tag in invite_joins directly, we don't need the JOIN
      const query = {
        text: `
          SELECT *
          FROM invite_joins
          WHERE server_id = $1 AND member_id = $2
          ORDER BY joined_at DESC
          LIMIT 1
        `,
        values: [serverId, memberId]
      };
      
      const result = await pool.query(query);
      
      if (!result.rows.length) {
        return null;
      }
      
      // Get joined data
      const joinData = result.rows[0];
      
      return {
        inviterId: joinData.inviter_id,
        inviterTag: joinData.inviter_tag || 'Unknown',
        inviteCode: joinData.invite_code,
        joinedAt: joinData.joined_at
      };
    } catch (error) {
      console.error(`❌ Error getting member inviter:`, error.message);
      return null;
    }
  },
  
  /**
   * Get top inviters for a server
   * @param {string} serverId Discord server ID
   * @param {number} limit Maximum number of inviters to retrieve
   * @returns {array} Array of top inviters
   */
  async getTopInviters(serverId, limit = 10) {
    if (!pool) return [];
    
    try {
      // Get invite join counts by inviter - using direct pool query
      // Use COUNT(DISTINCT member_id) to count unique members invited by each inviter
      // This ensures multiple invites from the same person with different codes are aggregated
      const query = {
        text: `
          SELECT 
            inviter_id,
            COUNT(DISTINCT member_id) as invite_count,
            MAX(inviter_tag) as inviter_tag
          FROM invite_joins
          WHERE server_id = $1
          GROUP BY inviter_id
          ORDER BY invite_count DESC
          LIMIT $2
        `,
        values: [serverId, limit]
      };
      
      const result = await pool.query(query);
      return result.rows || [];
    } catch (error) {
      console.error(`❌ Error getting top inviters:`, error.message);
      return [];
    }
  },
  
  /**
   * Get server invite settings
   * @param {string} serverId Discord server ID
   * @returns {object} Server invite settings
   */
  async getServerInviteSettings(serverId) {
    if (!pool) return null;
    
    try {
      // Use direct SQL query with parameterized values
      const query = {
        text: `SELECT * FROM invite_settings WHERE server_id = $1 LIMIT 1`,
        values: [serverId]
      };
      
      const result = await pool.query(query);
      
      if (!result.rows.length) {
        // Create default settings if none exist
        const defaultSettings = {
          server_id: serverId,
          enabled: 1,
          show_inviter: 1,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        // Insert default settings
        const insertQuery = {
          text: `
            INSERT INTO invite_settings (
              server_id, enabled, show_inviter, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5
            )
          `,
          values: [
            serverId, 
            defaultSettings.enabled,
            defaultSettings.show_inviter,
            defaultSettings.created_at,
            defaultSettings.updated_at
          ]
        };
        
        await pool.query(insertQuery);
        
        // Return camelCase version for JavaScript
        return {
          serverId: defaultSettings.server_id,
          enabled: defaultSettings.enabled,
          showInviter: defaultSettings.show_inviter,
          createdAt: defaultSettings.created_at,
          updatedAt: defaultSettings.updated_at
        };
      }
      
      // Convert snake_case DB fields to camelCase for JavaScript
      const settings = result.rows[0];
      return {
        serverId: settings.server_id,
        enabled: settings.enabled,
        logChannelId: settings.log_channel_id,
        welcomeMessage: settings.welcome_message,
        showInviter: settings.show_inviter,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at
      };
    } catch (error) {
      console.error(`❌ Error getting server invite settings:`, error.message);
      return null;
    }
  },
  
  /**
   * Update server invite settings
   * @param {string} serverId Discord server ID
   * @param {object} settings Updated settings
   * @returns {boolean} Success status
   */
  async updateServerInviteSettings(serverId, settings) {
    if (!pool) return false;
    
    try {
      // Add updated timestamp
      settings.updatedAt = new Date();
      
      // Using direct SQL condition for safer approach
      const existingQuery = {
        text: `SELECT * FROM invite_settings WHERE server_id = $1 LIMIT 1`,
        values: [serverId]
      };
      
      const existingSettings = await pool.query(existingQuery);
      
      if (!existingSettings.rows.length) {
        // Create new settings with direct values
        const insertQuery = {
          text: `
            INSERT INTO invite_settings (
              server_id, 
              enabled, 
              log_channel_id, 
              welcome_message, 
              show_inviter, 
              updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6
            )
          `,
          values: [
            serverId, 
            settings.enabled !== undefined ? settings.enabled : 1,
            settings.logChannelId || null,
            settings.welcomeMessage || null,
            settings.showInviter !== undefined ? settings.showInviter : 1,
            new Date()
          ]
        };
        
        await pool.query(insertQuery);
      } else {
        // Build SET clause dynamically based on what's provided
        let updateQueryText = `UPDATE invite_settings SET updated_at = $1`;
        const values = [new Date()];
        let paramCounter = 2;
        
        if (settings.enabled !== undefined) {
          updateQueryText += `, enabled = $${paramCounter}`;
          values.push(settings.enabled);
          paramCounter++;
        }
        
        if (settings.logChannelId !== undefined) {
          updateQueryText += `, log_channel_id = $${paramCounter}`;
          values.push(settings.logChannelId);
          paramCounter++;
        }
        
        if (settings.welcomeMessage !== undefined) {
          updateQueryText += `, welcome_message = $${paramCounter}`;
          values.push(settings.welcomeMessage);
          paramCounter++;
        }
        
        if (settings.showInviter !== undefined) {
          updateQueryText += `, show_inviter = $${paramCounter}`;
          values.push(settings.showInviter);
          paramCounter++;
        }
        
        updateQueryText += ` WHERE server_id = $${paramCounter}`;
        values.push(serverId);
        
        // Execute update query
        const updateQuery = {
          text: updateQueryText,
          values: values
        };
        
        await pool.query(updateQuery);
      }
      
      console.log(`✅ Successfully updated invite settings for server ${serverId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating server invite settings:`, error.message);
      return false;
    }
  },
  
  /**
   * Get all members invited by a specific user
   * @param {string} serverId Discord server ID
   * @param {string} inviterId Discord ID of the inviter
   * @returns {array} Array of invited members
   */
  async getInvitedMembers(serverId, inviterId) {
    if (!pool) return [];
    
    try {
      // Use direct SQL query with parameterized values
      const query = {
        text: `
          SELECT * 
          FROM invite_joins
          WHERE server_id = $1 AND inviter_id = $2
          ORDER BY joined_at DESC
        `,
        values: [serverId, inviterId]
      };
      
      const result = await pool.query(query);
      
      // Convert the rows to camelCase for JavaScript
      return result.rows.map(row => ({
        serverId: row.server_id,
        memberId: row.member_id,
        inviterId: row.inviter_id,
        inviteCode: row.invite_code,
        memberTag: row.member_tag,
        inviterTag: row.inviter_tag,
        joinedAt: row.joined_at
      }));
    } catch (error) {
      console.error(`❌ Error getting invited members:`, error.message);
      return [];
    }
  },
  
  /**
   * Get server invite statistics
   * @param {string} serverId Discord server ID
   * @returns {object} Invite statistics
   */
  async getServerInviteStats(serverId) {
    if (!pool) return null;
    
    try {
      // Get total invite count with direct SQL - count distinct members to avoid duplicates
      const totalQuery = {
        text: `
          SELECT COUNT(DISTINCT member_id) as total
          FROM invite_joins
          WHERE server_id = $1
        `,
        values: [serverId]
      };
      
      const totalInvitesResult = await pool.query(totalQuery);
      const totalInvites = parseInt(totalInvitesResult.rows[0]?.total || '0', 10);
      
      // Get invites in the last 7 days - count distinct members to avoid duplicates
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const recentQuery = {
        text: `
          SELECT COUNT(DISTINCT member_id) as recent
          FROM invite_joins
          WHERE server_id = $1 AND joined_at > $2
        `,
        values: [serverId, weekAgo]
      };
      
      const recentInvitesResult = await pool.query(recentQuery);
      const recentInvites = parseInt(recentInvitesResult.rows[0]?.recent || '0', 10);
      
      // Get top inviter using optimized SQL - ensure we count distinct members per inviter
      const topInviterQuery = {
        text: `
          SELECT 
            inviter_id,
            COUNT(DISTINCT member_id) as invite_count,
            MAX(inviter_tag) as inviter_tag
          FROM invite_joins
          WHERE server_id = $1
          GROUP BY inviter_id
          ORDER BY invite_count DESC
          LIMIT 1
        `,
        values: [serverId]
      };
      
      const topInviterResult = await pool.query(topInviterQuery);
      const topInviter = topInviterResult.rows[0] || null;
      
      return {
        totalInvites,
        recentInvites,
        topInviter
      };
    } catch (error) {
      console.error(`❌ Error getting server invite stats:`, error.message);
      return null;
    }
  }
};

module.exports = {
  db,
  pool,
  inviteTracker
};