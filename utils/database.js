/**
 * Database utilities for the bot
 */
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('../shared/schema');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize drizzle ORM
const db = drizzle(pool, { schema });

/**
 * Initialize database tables
 * This ensures all required tables exist
 */
async function initializeTables() {
  try {
    // Create tables for embed templates
    await db.execute(`
      CREATE TABLE IF NOT EXISTS embed_templates (
        id SERIAL PRIMARY KEY,
        server_id TEXT NOT NULL,
        name TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT,
        embed_data JSONB NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create tables for emoji statistics
    await db.execute(`
      CREATE TABLE IF NOT EXISTS emoji_stats (
        id SERIAL PRIMARY KEY,
        server_id TEXT NOT NULL,
        emoji_id TEXT,
        emoji_name TEXT NOT NULL,
        emoji_format TEXT NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create tables for emoji patterns
    await db.execute(`
      CREATE TABLE IF NOT EXISTS emoji_patterns (
        id SERIAL PRIMARY KEY,
        pattern TEXT NOT NULL,
        replacement TEXT NOT NULL,
        description TEXT,
        is_regex BOOLEAN NOT NULL DEFAULT FALSE,
        priority INTEGER NOT NULL DEFAULT 10,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log("✅ Database tables initialized successfully");
    console.log("✅ Embed templates database initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing database tables:", error.message);
    return false;
  }
}

/**
 * Execute a simple query and return the results
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Array} Query results
 */
async function query(query, params = []) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Check database connection
 * @returns {boolean} True if connected successfully
 */
async function checkConnection() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

/**
 * Initialize preset emoji patterns
 * These patterns help fix common emoji formatting issues
 */
async function initializeEmojiPatterns() {
  try {
    // First check if patterns already exist
    const existingPatterns = await db.query.emojiPatterns.findMany();
    
    if (existingPatterns.length === 0) {
      // Add default patterns for fixing common emoji issues
      await db.insert(schema.emojiPatterns).values([
        {
          pattern: "<a<a:",
          replacement: "<a:",
          description: "Fix double animated emoji prefix",
          isRegex: false,
          priority: 1,
          isEnabled: true
        },
        {
          pattern: "<:<:",
          replacement: "<:",
          description: "Fix double regular emoji prefix",
          isRegex: false,
          priority: 1,
          isEnabled: true
        },
        {
          pattern: ">id>",
          replacement: ">",
          description: "Fix trailing ID text in emoji",
          isRegex: false,
          priority: 2,
          isEnabled: true
        }
      ]);
      
      console.log("✅ Default emoji patterns initialized successfully");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error initializing emoji patterns:", error.message);
    return false;
  }
}

module.exports = {
  db,
  pool,
  query,
  initializeTables,
  checkConnection,
  initializeEmojiPatterns
};