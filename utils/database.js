/**
 * Database utilities for the bot
 */
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { embedTemplatesSchema } = require('../schemas/embedTemplates');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize drizzle ORM
const db = drizzle(pool);

/**
 * Initialize database tables
 * This ensures all required tables exist
 */
async function initializeTables() {
  try {
    // Simple push-based schema migration
    // In production, we'd use proper migrations with drizzle-kit
    await db.execute(`
      CREATE TABLE IF NOT EXISTS embed_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        server_id TEXT NOT NULL,
        created_by_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        embed_data JSONB NOT NULL,
        title TEXT,
        description TEXT,
        color TEXT,
        is_public BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    
    console.log("✅ Database tables initialized successfully");
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

module.exports = {
  db,
  pool,
  query,
  initializeTables
};