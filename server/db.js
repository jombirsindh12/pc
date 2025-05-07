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
    if (!db) return;
    
    try {
      // Check if tables exist
      await db.execute(`
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
        );
        
        CREATE TABLE IF NOT EXISTS invite_joins (
          id SERIAL PRIMARY KEY,
          server_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          member_tag TEXT,
          invite_code TEXT NOT NULL,
          inviter_id TEXT NOT NULL,
          joined_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS invite_settings (
          server_id TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 1,
          log_channel_id TEXT,
          update_channel_id TEXT,
          welcome_message TEXT,
          show_inviter INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
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
    if (!db) return;
    
    try {
      const { guild, code, inviter, uses, maxUses, expiresAt } = invite;
      
      // Check if invite already exists
      const existingInvites = await db.select()
        .from(schema.invites)
        .where(`invite_code = '${code}' AND server_id = '${guild.id}'`);
      
      if (existingInvites.length > 0) {
        // Update existing invite
        await db.update(schema.invites)
          .set({
            uses: uses,
            maxUses: maxUses || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null
          })
          .where(`invite_code = '${code}' AND server_id = '${guild.id}'`);
      } else {
        // Insert new invite
        await db.insert(schema.invites)
          .values({
            serverId: guild.id,
            inviteCode: code,
            inviterId: inviter ? inviter.id : '0',
            inviterTag: inviter ? inviter.tag : 'Unknown',
            uses: uses,
            maxUses: maxUses || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null
          });
      }
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
    if (!db) return;
    
    try {
      // Insert invite join record
      await db.insert(schema.inviteJoins)
        .values({
          serverId: member.guild.id,
          memberId: member.id,
          memberTag: member.user.tag,
          inviteCode: inviteCode,
          inviterId: inviterId
        });
      
      // Update invite uses count
      await db.execute(`
        UPDATE invites
        SET uses = uses + 1
        WHERE invite_code = '${inviteCode}' AND server_id = '${member.guild.id}'
      `);
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
    if (!db) return null;
    
    try {
      // Get the most recent invite join for the member
      const joins = await db.select()
        .from(schema.inviteJoins)
        .where(`server_id = '${serverId}' AND member_id = '${memberId}'`)
        .orderBy('joined_at DESC')
        .limit(1);
      
      if (joins.length === 0) {
        return null;
      }
      
      // Find inviter details
      const inviter = await db.select()
        .from(schema.invites)
        .where(`server_id = '${serverId}' AND inviter_id = '${joins[0].inviterId}'`)
        .limit(1);
      
      return {
        inviterId: joins[0].inviterId,
        inviterTag: inviter.length > 0 ? inviter[0].inviterTag : 'Unknown',
        inviteCode: joins[0].inviteCode,
        joinedAt: joins[0].joinedAt
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
    if (!db) return [];
    
    try {
      // Get invite join counts by inviter
      const result = await db.execute(`
        SELECT 
          inviter_id,
          COUNT(*) as invite_count,
          MAX(inviter_tag) as inviter_tag
        FROM (
          SELECT DISTINCT
            ij.inviter_id,
            ij.member_id,
            i.inviter_tag
          FROM invite_joins ij
          JOIN invites i ON i.inviter_id = ij.inviter_id AND i.server_id = ij.server_id
          WHERE ij.server_id = '${serverId}'
        ) AS unique_invites
        GROUP BY inviter_id
        ORDER BY invite_count DESC
        LIMIT ${limit}
      `);
      
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
    if (!db) return null;
    
    try {
      const settings = await db.select()
        .from(schema.inviteSettings)
        .where(`server_id = '${serverId}'`);
      
      if (settings.length === 0) {
        // Create default settings if none exist
        const defaultSettings = {
          serverId: serverId,
          enabled: 1,
          showInviter: 1
        };
        
        await db.insert(schema.inviteSettings)
          .values(defaultSettings);
        
        return defaultSettings;
      }
      
      return settings[0];
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
    if (!db) return false;
    
    try {
      // Add updated timestamp
      settings.updatedAt = new Date();
      
      // Check if settings exist
      const existingSettings = await db.select()
        .from(schema.inviteSettings)
        .where(`server_id = '${serverId}'`);
      
      if (existingSettings.length === 0) {
        // Create new settings
        await db.insert(schema.inviteSettings)
          .values({
            serverId: serverId,
            ...settings
          });
      } else {
        // Update existing settings
        await db.update(schema.inviteSettings)
          .set(settings)
          .where(`server_id = '${serverId}'`);
      }
      
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
    if (!db) return [];
    
    try {
      const members = await db.select()
        .from(schema.inviteJoins)
        .where(`server_id = '${serverId}' AND inviter_id = '${inviterId}'`)
        .orderBy('joined_at DESC');
      
      return members;
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
    if (!db) return null;
    
    try {
      // Get total invite count
      const totalInvitesResult = await db.execute(`
        SELECT COUNT(DISTINCT member_id) as total
        FROM invite_joins
        WHERE server_id = '${serverId}'
      `);
      
      const totalInvites = totalInvitesResult.rows[0]?.total || 0;
      
      // Get invites in the last 7 days
      const recentInvitesResult = await db.execute(`
        SELECT COUNT(DISTINCT member_id) as recent
        FROM invite_joins
        WHERE server_id = '${serverId}'
        AND joined_at > NOW() - INTERVAL '7 days'
      `);
      
      const recentInvites = recentInvitesResult.rows[0]?.recent || 0;
      
      // Get top inviter
      const topInviterResult = await db.execute(`
        SELECT 
          inviter_id,
          COUNT(*) as invite_count,
          MAX(inviter_tag) as inviter_tag
        FROM (
          SELECT DISTINCT
            ij.inviter_id,
            ij.member_id,
            i.inviter_tag
          FROM invite_joins ij
          JOIN invites i ON i.inviter_id = ij.inviter_id AND i.server_id = ij.server_id
          WHERE ij.server_id = '${serverId}'
        ) AS unique_invites
        GROUP BY inviter_id
        ORDER BY invite_count DESC
        LIMIT 1
      `);
      
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