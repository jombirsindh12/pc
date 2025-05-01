/**
 * Permission Helper Utility
 * Provides common permission checking functions for command handlers
 */

const config = require('./config');

/**
 * Check if a user has permission to execute a command, with special bypass for bot owner
 * 
 * @param {Object} user - Discord user object
 * @param {Object} guild - Discord guild object 
 * @param {Object} member - Discord guild member object
 * @param {Array} requiredPerms - Array of Discord permission flags required
 * @param {Object} messageOrInteraction - The message or interaction object
 * @param {boolean} isSlashCommand - Whether this is a slash command
 * @returns {boolean} - Whether the user has permission
 */
function hasPermission(user, guild, member, requiredPerms = [], messageOrInteraction, isSlashCommand = false) {
  // Check if user is bot owner - owners bypass all permission checks
  const isOwner = (messageOrInteraction && messageOrInteraction.isOwner) || 
                  (user && user.id && config.isBotOwner(user.id));
  
  // Bot owner always has permission
  if (isOwner) {
    console.log(`Bot owner ${user.tag} (${user.id}) bypassing permission check in server ${guild.name}`);
    return true;
  }
  
  // Server owner always has permission
  if (guild.ownerId === user.id) {
    return true;
  }
  
  // Check if the member has any of the required permissions
  return requiredPerms.length === 0 || requiredPerms.some(perm => member.permissions.has(perm));
}

/**
 * Send a permission denied message
 * 
 * @param {Object} messageOrInteraction - The message or interaction object
 * @param {boolean} isSlashCommand - Whether this is a slash command
 * @param {string} requiredPermString - String describing required permissions
 * @returns {Promise} - Promise resolving to sent message
 */
async function sendPermissionDeniedMessage(messageOrInteraction, isSlashCommand, requiredPermString = 'Administrator') {
  const embedObj = {
    title: '⛔ Permission Denied',
    description: `You need ${requiredPermString} permissions to use this command.`,
    color: 0xFF0000,
    footer: {
      text: 'Phantom Guard Security System'
    }
  };
  
  if (isSlashCommand) {
    return messageOrInteraction.reply({ 
      embeds: [embedObj], 
      ephemeral: true 
    });
  } else {
    return messageOrInteraction.reply({ embeds: [embedObj] });
  }
}

module.exports = {
  hasPermission,
  sendPermissionDeniedMessage
};