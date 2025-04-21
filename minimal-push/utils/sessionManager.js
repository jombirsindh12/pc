/**
 * Session Manager for Discord Bot
 * Handles user sessions, tracking commands, and managing timeouts
 */
const crypto = require('crypto');
const config = require('./config');

// Generate a random session secret if not already created
let SESSION_SECRET;
try {
  SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
} catch (error) {
  console.error('Error generating session secret:', error);
  SESSION_SECRET = 'phantom-guard-default-secret-key-' + Date.now();
}

// Session cache
const sessions = new Map();
const commandHistory = new Map();

/**
 * Create or get a session for a user
 * @param {string} userId Discord user ID
 * @param {string} guildId Discord guild/server ID
 * @returns {Object} Session object
 */
function getSession(userId, guildId) {
  const sessionKey = `${userId}:${guildId}`;
  
  if (!sessions.has(sessionKey)) {
    // Create new session
    const sessionToken = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(sessionKey + Date.now())
      .digest('hex');
    
    sessions.set(sessionKey, {
      userId,
      guildId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      sessionToken,
      data: {}
    });
  } else {
    // Update last activity time
    const session = sessions.get(sessionKey);
    session.lastActivity = Date.now();
  }
  
  return sessions.get(sessionKey);
}

/**
 * Store data in a user's session
 * @param {string} userId Discord user ID
 * @param {string} guildId Discord guild/server ID 
 * @param {string} key Data key
 * @param {any} value Data value
 */
function setSessionData(userId, guildId, key, value) {
  const session = getSession(userId, guildId);
  session.data[key] = value;
}

/**
 * Get data from a user's session
 * @param {string} userId Discord user ID
 * @param {string} guildId Discord guild/server ID
 * @param {string} key Data key
 * @returns {any} Stored value or null if not found
 */
function getSessionData(userId, guildId, key) {
  const session = getSession(userId, guildId);
  return session.data[key] || null;
}

/**
 * Track a command execution in the history
 * @param {string} userId Discord user ID
 * @param {string} guildId Discord guild/server ID
 * @param {string} commandName Name of command executed
 * @param {Object} options Command options/arguments
 */
function trackCommand(userId, guildId, commandName, options = {}) {
  const userKey = `${userId}:${guildId}`;
  
  if (!commandHistory.has(userKey)) {
    commandHistory.set(userKey, []);
  }
  
  const history = commandHistory.get(userKey);
  
  // Add command to history
  history.push({
    commandName,
    options,
    timestamp: Date.now()
  });
  
  // Limit history size (keep last 50 commands)
  while (history.length > 50) {
    history.shift();
  }
  
  // Update last activity in session
  const session = getSession(userId, guildId);
  session.lastActivity = Date.now();
}

/**
 * Get command history for a user
 * @param {string} userId Discord user ID
 * @param {string} guildId Discord guild/server ID
 * @param {number} limit Maximum number of items to return
 * @returns {Array} Command history
 */
function getCommandHistory(userId, guildId, limit = 10) {
  const userKey = `${userId}:${guildId}`;
  
  if (!commandHistory.has(userKey)) {
    return [];
  }
  
  const history = commandHistory.get(userKey);
  return history.slice(-limit).reverse(); // Return most recent first
}

/**
 * Clean up inactive sessions (older than 24 hours)
 */
function cleanupSessions() {
  const now = Date.now();
  const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivity > inactiveThreshold) {
      sessions.delete(key);
    }
  }
  
  console.log(`Session cleanup: ${sessions.size} active sessions remaining`);
}

// Set up periodic cleanup
setInterval(cleanupSessions, 3600000); // Clean up every hour

// Export functions
module.exports = {
  getSession,
  setSessionData,
  getSessionData,
  trackCommand,
  getCommandHistory
};