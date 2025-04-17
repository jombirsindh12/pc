/**
 * Security Manager - Advanced security features for server protection
 * Provides anti-nuke, anti-spam, and raid protection features
 */
const config = require('./config');

// Cache to track recent actions by users
const actionCache = new Map();
// Cache to track active security incidents
const activeIncidents = new Map();

// Security thresholds
const SECURITY_THRESHOLDS = {
  // Nuke detection thresholds (high-risk actions in a time period)
  massDelete: { count: 5, timeWindowMs: 10000 }, // 5 deletions in 10 seconds
  massBan: { count: 3, timeWindowMs: 5000 },     // 3 bans in 5 seconds
  massKick: { count: 3, timeWindowMs: 5000 },    // 3 kicks in 5 seconds
  massRoleDelete: { count: 3, timeWindowMs: 8000 }, // 3 role deletions in 8 seconds
  
  // Raid thresholds
  userJoins: { count: 10, timeWindowMs: 30000 },  // 10 joins in 30 seconds
  
  // Spam thresholds
  messageSends: { count: 8, timeWindowMs: 5000 }, // 8 messages in 5 seconds
  mentionSpam: { count: 10, timeWindowMs: 10000 }  // 10 mentions in 10 seconds
};

/**
 * Records an action by a user for security tracking
 * @param {string} serverId - Discord server ID
 * @param {string} userId - User performing the action
 * @param {string} actionType - Type of action (e.g., 'channelDelete', 'ban')
 * @param {Object} details - Additional details about the action
 * @returns {boolean} - True if a security threshold was exceeded
 */
function recordAction(serverId, userId, actionType, details = {}) {
  // Skip system ID (for detecting raids, etc)
  if (userId !== "SYSTEM_RAID_DETECTION") {
    // Get server configuration
    const serverConfig = config.getServerConfig(serverId);
    
    // Skip if security features are disabled for this server
    if (serverConfig.securityDisabled) {
      console.log(`Security skipped for server ${serverId}: Security disabled in config`);
      return false;
    }
    
    // Check if the user is the server owner - server owners are ALWAYS exempt
    if (details.isServerOwner) {
      console.log(`Security action skipped: User ${userId} is the server owner`);
      return false;
    }
    
    // Check if user has a whitelisted role - also fully exempt
    if (details.hasWhitelistedRole) {
      console.log(`Security action skipped: User ${userId} has a whitelisted role`);
      return false;
    }
    
    // Check if user ID matches the server owner ID directly (double check)
    if (serverId && userId && details.ownerId && userId === details.ownerId) {
      console.log(`Security action skipped: User ${userId} is the server owner (by ID)`);
      return false;
    }
    
    // Check if the user is explicitly whitelisted
    const whitelistedUsers = serverConfig.whitelistedUsers || [];
    if (whitelistedUsers.includes(userId)) {
      console.log(`Security action skipped: User ${userId} is explicitly whitelisted`);
      return false;
    }
  }
  
  // Continue with normal security flow if no exemptions apply
  // We already checked all exemption conditions above, so no need to check again
  
  // Create server-specific tracking key
  const serverKey = `${serverId}`;
  
  // Initialize server in action cache if needed
  if (!actionCache.has(serverKey)) {
    actionCache.set(serverKey, new Map());
  }
  
  // Get action cache for this server
  const serverCache = actionCache.get(serverKey);
  
  // Create user-specific tracking key
  const userActionKey = `${userId}:${actionType}`;
  
  // Initialize user action tracking
  if (!serverCache.has(userActionKey)) {
    serverCache.set(userActionKey, []);
  }
  
  // Get user's current actions and add the new one
  const userActions = serverCache.get(userActionKey);
  userActions.push({
    timestamp: Date.now(),
    details: details
  });
  
  // Clean up old actions based on the threshold's time window
  const threshold = SECURITY_THRESHOLDS[actionType];
  if (threshold) {
    const cutoffTime = Date.now() - threshold.timeWindowMs;
    const recentActions = userActions.filter(action => action.timestamp > cutoffTime);
    serverCache.set(userActionKey, recentActions);
    
    // Check if threshold is exceeded
    if (recentActions.length >= threshold.count) {
      // Log the security incident
      console.log(`🚨 SECURITY ALERT: User ${userId} performed ${recentActions.length} ${actionType} actions in ${threshold.timeWindowMs/1000}s`);
      
      // Record the incident
      triggerSecurityIncident(serverId, userId, actionType, recentActions);
      return true;
    }
  }
  
  return false;
}

/**
 * Handles a detected security incident
 * @param {string} serverId - Discord server ID
 * @param {string} userId - User who triggered the incident
 * @param {string} actionType - Type of action that triggered the incident
 * @param {Array} actions - List of actions that triggered the incident
 */
function triggerSecurityIncident(serverId, userId, actionType, actions) {
  // Get server configuration for notification and action
  const serverConfig = config.getServerConfig(serverId);
  
  // Create incident ID
  const incidentId = `${serverId}:${Date.now()}`;
  
  // Store incident information
  activeIncidents.set(incidentId, {
    serverId,
    userId,
    actionType,
    actions,
    timestamp: Date.now(),
    resolved: false
  });
  
  // Update server config with incident
  const incidents = serverConfig.securityIncidents || [];
  incidents.push({
    userId,
    actionType,
    timestamp: Date.now(),
    count: actions.length,
    incidentId
  });
  
  // Limit to last 100 incidents
  while (incidents.length > 100) {
    incidents.shift();
  }
  
  // Save updated incidents to server config
  config.updateServerConfig(serverId, {
    securityIncidents: incidents
  });
  
  // Return the incident ID for reference
  return incidentId;
}

/**
 * Sends a security alert to a server's notification channel
 * @param {Object} client - Discord.js client
 * @param {string} serverId - Discord server ID
 * @param {string} incidentId - ID of the security incident
 * @param {string} message - Alert message to send
 */
async function sendSecurityAlert(client, serverId, incidentId, message) {
  try {
    // Get server configuration
    const serverConfig = config.getServerConfig(serverId);
    
    // If no notification channel is set, we can't send alerts
    if (!serverConfig.notificationChannelId) {
      console.warn(`Cannot send security alert: No notification channel set for server ${serverId}`);
      return;
    }
    
    // Get the guild and notification channel
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      console.warn(`Cannot send security alert: Guild ${serverId} not found`);
      return;
    }
    
    const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
    if (!notificationChannel) {
      console.warn(`Cannot send security alert: Notification channel ${serverConfig.notificationChannelId} not found`);
      return;
    }
    
    // Get the incident
    const incident = activeIncidents.get(incidentId);
    if (!incident) {
      console.warn(`Cannot send security alert: Incident ${incidentId} not found`);
      return;
    }
    
    // Create embed for the security alert
    const alertEmbed = {
      title: '🚨 Security Alert',
      description: message,
      color: 0xFF0000, // Red for alerts
      fields: [
        {
          name: 'Incident Type',
          value: incident.actionType
        },
        {
          name: 'User ID',
          value: incident.userId
        },
        {
          name: 'Timestamp',
          value: new Date(incident.timestamp).toLocaleString()
        },
        {
          name: 'Action Count',
          value: `${incident.actions.length} actions in a short time period`
        }
      ],
      footer: {
        text: `Incident ID: ${incidentId} • Phantom Guard Security System`
      },
      timestamp: new Date()
    };
    
    // Send the alert
    await notificationChannel.send({ embeds: [alertEmbed] });
    console.log(`Security alert sent to channel ${serverConfig.notificationChannelId} for server ${serverId}`);
  } catch (error) {
    console.error('Error sending security alert:', error);
  }
}

/**
 * Starts monitoring a Discord guild's audit logs for security issues
 * @param {Object} client - Discord.js client
 */
/**
 * Activates the advanced anti-nuke system for a server
 * @param {Object} client - Discord.js client
 * @param {string} serverId - Discord server ID
 * @param {number} threshold - Threshold for various anti-nuke checks
 */
function activateAntiNuke(client, serverId, threshold = 3) {
  console.log(`Activating advanced anti-nuke protection for server ${serverId} with threshold ${threshold}`);
  
  // Setup extra audit log watchers
  client.on('guildAuditLogEntryCreate', async (auditLog, guild) => {
    // Only process for the target server
    if (guild.id !== serverId) return;
    
    const { action, executorId, targetId } = auditLog;
    
    // Get server configuration
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if user is server owner
    const isOwner = await isGuildOwner(client, serverId, executorId);
    
    // Check if user has any whitelisted roles
    const whitelistedRoles = serverConfig.whitelistedRoles || [];
    const hasWlRole = await hasWhitelistedRole(guild, executorId, whitelistedRoles);
    
    // Check for mass ban actions
    if (action === 22) { // BAN_ADD
      recordAction(serverId, executorId, 'ban', { 
        targetId,
        isServerOwner: isOwner,
        hasWhitelistedRole: hasWlRole
      });
      
      // Check if this user has triggered too many bans
      const userActions = getRecentActions(serverId, executorId, 'ban', 60000); // Last minute
      if (userActions.length >= threshold) {
        triggerSecurityIncident(serverId, executorId, 'nuke', userActions);
        
        // Apply security action using the new function
        const actionResult = await applySecurityAction(
          client,
          serverId,
          executorId,
          'ANTI-NUKE: Mass ban detected'
        );
        
        // Send alert to notification channel
        if (actionResult.success && serverConfig.notificationChannelId) {
          const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
          if (notificationChannel) {
            await notificationChannel.send({
              content: `🚨 **ANTI-NUKE SYSTEM ACTIVATED**\n\nUser <@${executorId}> has been ${actionResult.action}ed for attempting to mass ban ${userActions.length} members in a short time period.\n\nServer security has been preserved.`,
              allowedMentions: { parse: [] } // Don't ping anyone
            });
          }
        }
      }
    }
    
    // Check for mass channel deletions
    else if (action === 12) { // CHANNEL_DELETE
      recordAction(serverId, executorId, 'channelDelete', { 
        targetId,
        isServerOwner: isOwner,
        hasWhitelistedRole: hasWlRole
      });
      
      // Check if this user has triggered too many channel deletions
      const userActions = getRecentActions(serverId, executorId, 'channelDelete', 60000); // Last minute
      if (userActions.length >= threshold) {
        triggerSecurityIncident(serverId, executorId, 'nuke', userActions);
        
        // Apply security action
        const actionResult = await applySecurityAction(
          client,
          serverId,
          executorId,
          'ANTI-NUKE: Mass channel deletion detected'
        );
        
        // Send alert to notification channel
        if (actionResult.success && serverConfig.notificationChannelId) {
          const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
          if (notificationChannel) {
            await notificationChannel.send({
              content: `🚨 **ANTI-NUKE SYSTEM ACTIVATED**\n\nUser <@${executorId}> has been ${actionResult.action}ed for deleting ${userActions.length} channels in a short time period.\n\nServer security has been preserved.`,
              allowedMentions: { parse: [] } // Don't ping anyone
            });
          }
        }
      }
    }
    
    // Check for mass role deletions
    else if (action === 32) { // ROLE_DELETE
      recordAction(serverId, executorId, 'roleDelete', { 
        targetId,
        isServerOwner: isOwner,
        hasWhitelistedRole: hasWlRole
      });
      
      // Check if this user has triggered too many role deletions
      const userActions = getRecentActions(serverId, executorId, 'roleDelete', 60000); // Last minute
      if (userActions.length >= threshold) {
        triggerSecurityIncident(serverId, executorId, 'nuke', userActions);
        
        // Apply security action
        const actionResult = await applySecurityAction(
          client,
          serverId,
          executorId,
          'ANTI-NUKE: Mass role deletion detected'
        );
        
        // Send alert to notification channel
        if (actionResult.success && serverConfig.notificationChannelId) {
          const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
          if (notificationChannel) {
            await notificationChannel.send({
              content: `🚨 **ANTI-NUKE SYSTEM ACTIVATED**\n\nUser <@${executorId}> has been ${actionResult.action}ed for deleting ${userActions.length} roles in a short time period.\n\nServer security has been preserved.`,
              allowedMentions: { parse: [] } // Don't ping anyone
            });
          }
        }
      }
    }
    
    // Check for mass webhook creations (could be used for spam)
    else if (action === 50) { // WEBHOOK_CREATE
      recordAction(serverId, executorId, 'webhookCreate', { 
        targetId,
        isServerOwner: isOwner,
        hasWhitelistedRole: hasWlRole
      });
      
      // Check if this user has triggered too many webhook creations
      const userActions = getRecentActions(serverId, executorId, 'webhookCreate', 60000);
      if (userActions.length >= threshold) {
        triggerSecurityIncident(serverId, executorId, 'nuke', userActions);
        
        // Apply security action
        const actionResult = await applySecurityAction(
          client,
          serverId,
          executorId,
          'ANTI-NUKE: Mass webhook creation detected'
        );
        
        // Send alert to notification channel
        if (actionResult.success && serverConfig.notificationChannelId) {
          const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
          if (notificationChannel) {
            await notificationChannel.send({
              content: `🚨 **ANTI-NUKE SYSTEM ACTIVATED**\n\nUser <@${executorId}> has been ${actionResult.action}ed for creating ${userActions.length} webhooks in a short time period (potential spam attempt).\n\nServer security has been preserved.`,
              allowedMentions: { parse: [] } // Don't ping anyone
            });
          }
        }
      }
    }
  });
}

/**
 * Get recent actions by a user of a specific type
 * @param {string} serverId - Discord server ID
 * @param {string} userId - User performing the actions
 * @param {string} actionType - Type of action
 * @param {number} timeWindow - Time window in milliseconds
 * @returns {Array} List of recent actions
 */
function getRecentActions(serverId, userId, actionType, timeWindow) {
  // Create server-specific tracking key
  const serverKey = `${serverId}`;
  
  // Initialize server in action cache if needed
  if (!actionCache.has(serverKey)) {
    actionCache.set(serverKey, new Map());
    return [];
  }
  
  // Get action cache for this server
  const serverCache = actionCache.get(serverKey);
  
  // Create user-specific tracking key
  const userActionKey = `${userId}:${actionType}`;
  
  // Return empty array if no actions are recorded
  if (!serverCache.has(userActionKey)) {
    return [];
  }
  
  // Filter by time window
  const userActions = serverCache.get(userActionKey);
  const now = Date.now();
  return userActions.filter(action => 
    (now - action.timestamp) <= timeWindow
  );
}

/**
 * Checks if a user is the owner of a guild
 * @param {Object} client - Discord.js client
 * @param {string} guildId - Discord server ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is the guild owner
 */
async function isGuildOwner(client, guildId, userId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    return guild.ownerId === userId;
  } catch (error) {
    console.error(`Error checking guild owner: ${error}`);
    return false;
  }
}

/**
 * Checks if a user has a whitelisted role
 * @param {Object} guild - Discord.js guild
 * @param {string} userId - User ID to check
 * @param {Array<string>} whitelistedRoles - Array of whitelisted role IDs
 * @returns {Promise<boolean>} True if user has any of the whitelisted roles
 */
async function hasWhitelistedRole(guild, userId, whitelistedRoles) {
  try {
    if (!whitelistedRoles || whitelistedRoles.length === 0) return false;
    
    const member = await guild.members.fetch(userId);
    if (!member) return false;
    
    return member.roles.cache.some(role => whitelistedRoles.includes(role.id));
  } catch (error) {
    console.error(`Error checking whitelisted roles: ${error}`);
    return false;
  }
}

/**
 * Apply security action based on configured punishment type
 * @param {Object} client - Discord.js client
 * @param {string} serverId - Discord server ID 
 * @param {string} userId - User who triggered the action
 * @param {string} reason - Reason for the action
 * @returns {Promise<Object>} Result of the action with success status
 */
/**
 * Apply security action based on configured punishment type
 * @param {Object} client - Discord.js client
 * @param {string} serverId - Discord server ID 
 * @param {string} userId - User who triggered the action
 * @param {string} reason - Reason for the action
 * @returns {Promise<Object>} Result of the action with success status
 */
async function applySecurityAction(client, serverId, userId, reason) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    const guild = await client.guilds.fetch(serverId);
    
    // NEVER apply security actions to the server owner - check before even fetching member
    if (guild.ownerId === userId) {
      console.log(`Security action skipped: User ${userId} is the server owner`);
      return { success: false, reason: 'Cannot perform security actions on server owner', action: 'none' };
    }
    
    // Check if user is in whitelist
    const whitelistedUsers = serverConfig.whitelistedUsers || [];
    if (whitelistedUsers.includes(userId)) {
      console.log(`Security action skipped: User ${userId} is in the whitelist`);
      return { success: false, reason: 'User is in security whitelist', action: 'none' };
    }
    
    // Try to fetch the member (may fail if user left)
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch (fetchError) {
      console.log(`Could not fetch member ${userId}: ${fetchError.message}`);
      return { success: false, reason: 'Could not fetch member - they may have left the server', action: 'none' };
    }
    
    // Default to 'quarantine' if not set
    const actionType = serverConfig.securityActionType || 'quarantine';
    
    // Check if we can perform the action on this user
    if (!member.manageable) {
      console.log(`Security action skipped: User ${userId} is not manageable by the bot`);
      return { success: false, reason: 'User has higher permissions than the bot' };
    }
    
    switch (actionType) {
      case 'ban':
        await member.ban({ reason });
        return { success: true, action: 'ban' };
        
      case 'kick':
        await member.kick(reason);
        return { success: true, action: 'kick' };
        
      case 'quarantine':
        // Quarantine involves removing all roles and adding a quarantine role
        if (serverConfig.quarantineRoleId) {
          // Remove all existing roles
          const rolesToRemove = member.roles.cache.filter(role => role.id !== guild.id); // Don't remove @everyone
          await member.roles.remove(rolesToRemove);
          
          // Add quarantine role
          await member.roles.add(serverConfig.quarantineRoleId);
          return { success: true, action: 'quarantine' };
        } else {
          // If no quarantine role is set, fallback to timeout
          await member.timeout(3600000, reason); // 1 hour timeout
          return { success: true, action: 'timeout' };
        }
        
      case 'timeout':
        // 1 hour timeout
        await member.timeout(3600000, reason);
        return { success: true, action: 'timeout' };
        
      default:
        // Just log the action if no valid action type
        console.log(`No valid action type configured for server ${serverId}, action logged only`);
        return { success: false, action: 'log_only' };
    }
  } catch (error) {
    console.error(`Error applying security action: ${error}`);
    return { success: false, error: error.message };
  }
}

function startSecurityMonitoring(client) {
  console.log(`Starting security monitoring for all servers...`);
  
  // Listen for relevant events
  
  // Channel delete (potential nuke)
  client.on('channelDelete', async (channel) => {
    try {
      if (!channel.guild) return; // Skip DM channels
      
      const serverId = channel.guild.id;
      
      // Fetch audit logs to find who deleted the channel
      const auditLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: 'CHANNEL_DELETE'
      });
      
      const deletionLog = auditLogs.entries.first();
      
      if (deletionLog) {
        const { executor } = deletionLog;
        
        // Skip if it's the client bot itself
        if (executor.id === client.user.id) return;
        
        // Check if user is server owner
        const isOwner = await isGuildOwner(client, serverId, executor.id);
        
        // Check if user has any whitelisted roles
        const serverConfig = config.getServerConfig(serverId);
        const whitelistedRoles = serverConfig.whitelistedRoles || [];
        const hasWlRole = await hasWhitelistedRole(channel.guild, executor.id, whitelistedRoles);
        
        // Record the channel deletion action with additional details
        const thresholdExceeded = recordAction(serverId, executor.id, 'massDelete', {
          channelId: channel.id,
          channelName: channel.name,
          timestamp: Date.now(),
          isServerOwner: isOwner,
          hasWhitelistedRole: hasWlRole,
          ownerId: channel.guild.ownerId // Pass the server owner ID for direct comparison
        });
        
        // If threshold exceeded, send an alert and apply appropriate action
        if (thresholdExceeded) {
          const incidentId = activeIncidents.keys().next().value;
          if (incidentId) {
            // Send alert
            sendSecurityAlert(client, serverId, incidentId, 
              `🚨 **SECURITY ALERT: POTENTIAL NUKE DETECTED** 🚨\nUser <@${executor.id}> has deleted multiple channels in a short time period.`);
            
            // Apply configured security action
            const actionResult = await applySecurityAction(
              client, 
              serverId, 
              executor.id, 
              'Anti-nuke: Mass channel deletion detected'
            );
            
            // Send follow-up message about the action taken
            if (actionResult.success) {
              const notificationChannel = channel.guild.channels.cache.get(serverConfig.notificationChannelId);
              if (notificationChannel) {
                notificationChannel.send({
                  content: `✅ **Security Action Applied**: User <@${executor.id}> has been ${actionResult.action}ed for mass channel deletion.`,
                  allowedMentions: { parse: [] } // Don't ping anyone
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling channelDelete event:', error);
    }
  });
  
  // Listen for bans (potential mass ban)
  client.on('guildBanAdd', async (ban) => {
    try {
      const serverId = ban.guild.id;
      
      // Fetch audit logs to find who banned the user
      const auditLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: 'MEMBER_BAN_ADD'
      });
      
      const banLog = auditLogs.entries.first();
      
      if (banLog) {
        const { executor } = banLog;
        
        // Skip if it's the client bot itself
        if (executor.id === client.user.id) return;
        
        // Check if user is server owner
        const isOwner = await isGuildOwner(client, serverId, executor.id);
        
        // Check if user has any whitelisted roles
        const serverConfig = config.getServerConfig(serverId);
        const whitelistedRoles = serverConfig.whitelistedRoles || [];
        const hasWlRole = await hasWhitelistedRole(ban.guild, executor.id, whitelistedRoles);
        
        // Record the ban action
        const thresholdExceeded = recordAction(serverId, executor.id, 'massBan', {
          userId: ban.user.id,
          username: ban.user.tag,
          timestamp: Date.now(),
          isServerOwner: isOwner,
          hasWhitelistedRole: hasWlRole,
          ownerId: ban.guild.ownerId // Pass the server owner ID for direct comparison
        });
        
        // If threshold exceeded, send an alert and apply action
        if (thresholdExceeded) {
          const incidentId = activeIncidents.keys().next().value;
          if (incidentId) {
            // Send alert
            sendSecurityAlert(client, serverId, incidentId, 
              `🚨 **SECURITY ALERT: MASS BAN DETECTED** 🚨\nUser <@${executor.id}> has banned multiple members in a short time period.`);
            
            // Apply configured security action
            const actionResult = await applySecurityAction(
              client, 
              serverId, 
              executor.id, 
              'Anti-nuke: Mass ban operation detected'
            );
            
            // Send follow-up message about the action taken
            if (actionResult.success) {
              const notificationChannel = ban.guild.channels.cache.get(serverConfig.notificationChannelId);
              if (notificationChannel) {
                notificationChannel.send({
                  content: `✅ **Security Action Applied**: User <@${executor.id}> has been ${actionResult.action}ed for mass ban operation.`,
                  allowedMentions: { parse: [] } // Don't ping anyone
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling guildBanAdd event:', error);
    }
  });
  
  // Monitor for raid attempts (many users joining quickly)
  client.on('guildMemberAdd', (member) => {
    try {
      const serverId = member.guild.id;
      
      // We use a special "SYSTEM" user ID for raid detection since it's not tied to a specific user
      const SYSTEM_ID = "SYSTEM_RAID_DETECTION";
      
      // Record the join action
      const thresholdExceeded = recordAction(serverId, SYSTEM_ID, 'userJoins', {
        userId: member.id,
        username: member.user.tag,
        timestamp: Date.now()
      });
      
      // If threshold exceeded, send an alert
      if (thresholdExceeded) {
        const incidentId = activeIncidents.keys().next().value;
        if (incidentId) {
          sendSecurityAlert(client, serverId, incidentId, 
            `🚨 **RAID ALERT** 🚨\nMultiple users joining the server in rapid succession. Possible raid in progress.`);
        }
      }
    } catch (error) {
      console.error('Error handling guildMemberAdd event:', error);
    }
  });
  
  // Message spam detection
  client.on('messageCreate', (message) => {
    try {
      // Skip messages from bots
      if (message.author.bot) return;
      
      // Skip DM messages
      if (!message.guild) return;
      
      const serverId = message.guild.id;
      const userId = message.author.id;
      
      // Check for mention spam
      if (message.mentions.users.size > 3 || message.mentions.roles.size > 2) {
        recordAction(serverId, userId, 'mentionSpam', {
          messageId: message.id,
          userMentions: message.mentions.users.size,
          roleMentions: message.mentions.roles.size,
          timestamp: Date.now()
        });
      }
      
      // Regular message spam check
      recordAction(serverId, userId, 'messageSends', {
        messageId: message.id,
        channelId: message.channel.id,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error handling messageCreate for spam detection:', error);
    }
  });
  
  console.log('Security monitoring active for all servers - checking for nukes, raids and spam');
}

// Export functions
module.exports = {
  startSecurityMonitoring,
  recordAction,
  sendSecurityAlert,
  activateAntiNuke,
  SECURITY_THRESHOLDS,
  getActiveIncidents: () => Object.fromEntries(activeIncidents),
  getRecentActions,
  isGuildOwner,
  hasWhitelistedRole,
  applySecurityAction
};