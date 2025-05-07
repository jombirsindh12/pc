/**
 * Emoji Processing Utility
 * 
 * This module handles emoji processing, fixing malformed emoji formats,
 * and tracking emoji usage statistics.
 */

const { db } = require('./database');
const { emojiPatterns, emojiStats } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');

// Cache for emoji patterns to avoid frequent database lookups
let patternCache = null;
let patternCacheExpiry = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Process text to fix malformed emoji formats
 * @param {string} text - Text to process
 * @param {string} serverId - Server ID for tracking statistics
 * @returns {string} Processed text with fixed emojis
 */
async function processText(text, serverId = null) {
  if (!text) return text;

  try {
    // Get patterns from cache or database
    const patterns = await getPatterns();
    
    let processedText = text;
    
    // Apply simple string replacements first (faster)
    const simplePatterns = patterns.filter(p => !p.isRegex);
    for (const pattern of simplePatterns) {
      if (processedText.includes(pattern.pattern)) {
        processedText = processedText.split(pattern.pattern).join(pattern.replacement);
      }
    }
    
    // Then apply regex patterns (slower but more powerful)
    const regexPatterns = patterns.filter(p => p.isRegex);
    for (const pattern of regexPatterns) {
      try {
        const regex = new RegExp(pattern.pattern, 'g');
        processedText = processedText.replace(regex, pattern.replacement);
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern.pattern}`, error);
      }
    }
    
    // Track emoji usage if server ID is provided
    if (serverId) {
      await trackEmojiUsage(processedText, serverId);
    }
    
    return processedText;
  } catch (error) {
    console.error('Error processing emojis:', error);
    return text; // Return original text if processing fails
  }
}

/**
 * Get emoji patterns from cache or database
 * @returns {Array} Array of patterns
 */
async function getPatterns() {
  const now = Date.now();
  
  // Return cached patterns if available and not expired
  if (patternCache && patternCacheExpiry > now) {
    return patternCache;
  }
  
  try {
    // Fetch patterns from database
    const patterns = await db.query.emojiPatterns.findMany({
      where: eq(emojiPatterns.isEnabled, true),
      orderBy: (emojiPatterns, { asc }) => [asc(emojiPatterns.priority)]
    });
    
    // Update cache
    patternCache = patterns;
    patternCacheExpiry = now + CACHE_DURATION;
    
    return patterns;
  } catch (error) {
    console.error('Error fetching emoji patterns:', error);
    return patternCache || []; // Return cached patterns or empty array if fetch fails
  }
}

/**
 * Extract emojis from text and track their usage
 * @param {string} text - Text containing emojis
 * @param {string} serverId - Server ID for tracking statistics
 */
async function trackEmojiUsage(text, serverId) {
  // Basic regex to find Discord custom emojis: <:name:id> or <a:name:id>
  const customEmojiRegex = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
  const customEmojis = [...text.matchAll(customEmojiRegex)];
  
  // Process each custom emoji
  for (const match of customEmojis) {
    const isAnimated = match[0].startsWith('<a:');
    const emojiName = match[1];
    const emojiId = match[2];
    const format = isAnimated ? 'animated' : 'custom';
    
    await updateEmojiStats(serverId, emojiId, emojiName, format);
  }
  
  // TODO: Add support for tracking Unicode emojis if needed
}

/**
 * Update emoji usage statistics in database
 * @param {string} serverId - Server ID
 * @param {string} emojiId - Emoji ID
 * @param {string} emojiName - Emoji name
 * @param {string} format - Emoji format (unicode, custom, animated)
 */
async function updateEmojiStats(serverId, emojiId, emojiName, format) {
  try {
    // Check if emoji exists in stats
    const existingEmoji = await db.query.emojiStats.findFirst({
      where: and(
        eq(emojiStats.serverId, serverId),
        eq(emojiStats.emojiId, emojiId)
      )
    });
    
    if (existingEmoji) {
      // Update existing emoji stats
      await db.update(emojiStats)
        .set({
          useCount: existingEmoji.useCount + 1,
          lastUsed: new Date()
        })
        .where(eq(emojiStats.id, existingEmoji.id));
    } else {
      // Insert new emoji stats
      await db.insert(emojiStats).values({
        serverId,
        emojiId,
        emojiName,
        emojiFormat: format,
        useCount: 1,
        lastUsed: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating emoji stats:', error);
  }
}

/**
 * Add a new emoji pattern
 * @param {Object} pattern - Pattern object with pattern, replacement, etc.
 * @returns {Object} Newly created pattern
 */
async function addPattern(pattern) {
  try {
    const [newPattern] = await db.insert(emojiPatterns)
      .values(pattern)
      .returning();
    
    // Invalidate cache
    patternCache = null;
    
    return newPattern;
  } catch (error) {
    console.error('Error adding emoji pattern:', error);
    throw error;
  }
}

/**
 * Get emoji usage statistics for a server
 * @param {string} serverId - Server ID
 * @param {number} limit - Maximum number of results
 * @returns {Array} Emoji usage statistics
 */
async function getEmojiStats(serverId, limit = 10) {
  try {
    const stats = await db.query.emojiStats.findMany({
      where: eq(emojiStats.serverId, serverId),
      orderBy: (emojiStats, { desc }) => [desc(emojiStats.useCount)],
      limit
    });
    
    return stats;
  } catch (error) {
    console.error('Error fetching emoji stats:', error);
    return [];
  }
}

/**
 * Fix common emoji format issues directly without looking up patterns
 * For very basic, common patterns to optimize performance
 * @param {string} text - Text to process
 * @returns {string} Processed text with fixed emojis
 */
function quickFix(text) {
  if (!text) return text;
  
  let processed = text;
  
  // Fix doubled animated emoji prefix: <a<a:name:id>
  processed = processed.replace(/<a<a:/g, '<a:');
  
  // Fix doubled regular emoji prefix: <:<:name:id>
  processed = processed.replace(/<:<:/g, '<:');
  
  // Fix trailing ID text: <a:name:id>id>
  processed = processed.replace(/>id>/g, '>');
  
  return processed;
}

module.exports = {
  processText,
  quickFix,
  getPatterns,
  addPattern,
  getEmojiStats
};