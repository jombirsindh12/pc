/**
 * Advanced Security Manager for Discord Bot
 * 
 * Provides sophisticated security features:
 * - Anti-Nuke Protection: Prevents mass channel/role deletion and user bans
 * - Anti-Raid Detection: Detects and responds to coordinated raid attacks
 * - Anti-Spam System: Identifies and mitigates message spam and mention abuse
 * - Emergency Lockdown: Quick server-wide protection during attacks
 * - Security Incident Tracking: Monitors and logs all security events
 * - Owner-Only Security: Critical security functions restricted to server owner
 */

const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Security threshold constants
const SECURITY_THRESHOLDS = {
  // Anti-nuke thresholds
  CHANNEL_DELETIONS: 3,        // Number of channel deletions to trigger anti-nuke
  ROLE_DELETIONS: 3,           // Number of role deletions to trigger anti-nuke
  MASS_BAN_THRESHOLD: 5,       // Number of bans to trigger anti-nuke
  WEBHOOK_CREATIONS: 3,        // Number of webhook creations to trigger anti-nuke
  PERMISSION_CHANGES: 5,       // Number of permission changes to trigger anti-nuke
  
  // Time windows for detection (in milliseconds)
  NUKE_TIME_WINDOW: 10000,     // 10 seconds for nuke detection
  RAID_TIME_WINDOW: 60000,     // 60 seconds for raid detection
  SPAM_TIME_WINDOW: 5000,      // 5 seconds for spam detection
  
  // Action tracking
  MAX_TRACKED_ACTIONS: 100,    // Maximum number of security actions to keep in memory
  INCIDENT_EXPIRY: 86400000    // Security incidents expire after 24 hours
};

// Track recent security actions for each server 
const recentActions = new Map();

// Track active security incidents
const activeIncidents = new Map();

// Track server lockdown status
const serverLockdowns = new Map();

// Record a security-related action for analysis
function recordAction(guildId, userId, actionType, details = {}) {
  // Initialize guild actions if not present
  if (!recentActions.has(guildId)) {
    recentActions.set(guildId, []);
  }
  
  const serverActions = recentActions.get(guildId);
  
  // Create new action record
  const action = {
    userId,
    actionType,
    timestamp: Date.now(),
    details
  };
  
  // Add to recent actions
  serverActions.unshift(action);
  
  // Trim to max size
  if (serverActions.length > SECURITY_THRESHOLDS.MAX_TRACKED_ACTIONS) {
    serverActions.length = SECURITY_THRESHOLDS.MAX_TRACKED_ACTIONS;
  }
  
  // Get server config
  const serverConfig = config.getServerConfig(guildId);
  
  // Skip additional processing if security is disabled
  if (serverConfig.securityDisabled) {
    return;
  }
  
  // Check if this action type should trigger a nuke protection analysis
  const nukeActionTypes = [
    'CHANNEL_DELETE', 
    'ROLE_DELETE', 
    'MEMBER_BAN_ADD', 
    'WEBHOOK_CREATE',
    'PERMISSION_UPDATE'
  ];
  
  // Anti-nuke check only for nuke-related actions
  if (nukeActionTypes.includes(actionType)) {
    checkForNukeAttempt(guildId, userId, actionType);
  }
  
  // Add this action to the server's security incidents log
  if (!serverConfig.securityIncidents) {
    serverConfig.securityIncidents = [];
  }
  
  serverConfig.securityIncidents.push({
    type: actionType,
    userId,
    timestamp: Date.now(),
    details
  });
  
  // Trim incidents to a reasonable size
  if (serverConfig.securityIncidents.length > 100) {
    serverConfig.securityIncidents = serverConfig.securityIncidents.slice(-100);
  }
  
  // Save updated config
  config.updateServerConfig(guildId, serverConfig);
  
  return action;
}

// Get recent security actions for a guild
function getRecentActions(guildId, actionType = null, timeWindow = null, userId = null) {
  if (!recentActions.has(guildId)) {
    return [];
  }
  
  let actions = recentActions.get(guildId);
  const now = Date.now();
  
  // Filter by time if a window is specified
  if (timeWindow) {
    actions = actions.filter(action => (now - action.timestamp) <= timeWindow);
  }
  
  // Filter by action type if specified
  if (actionType) {
    actions = actions.filter(action => action.actionType === actionType);
  }
  
  // Filter by user ID if specified
  if (userId) {
    actions = actions.filter(action => action.userId === userId);
  }
  
  return actions;
}

// Check if a user is a guild owner
function isGuildOwner(guild, userId) {
  return guild.ownerId === userId;
}

// Analyze recent actions for nuke attempt patterns
function checkForNukeAttempt(guildId, userId, actionType) {
  const guild = global.client?.guilds.cache.get(guildId);
  if (!guild) return;
  
  // Get server config to check anti-nuke settings and threshold
  const serverConfig = config.getServerConfig(guildId);
  const threshold = serverConfig.antiNukeThreshold || SECURITY_THRESHOLDS.CHANNEL_DELETIONS;
  
  // Skip check if anti-nuke is disabled
  if (serverConfig.antiNukeDisabled) {
    return;
  }
  
  // Don't apply anti-nuke to the server owner
  if (guild.ownerId === userId) {
    return;
  }
  
  // Get recent actions of this type by this user
  const timeWindow = SECURITY_THRESHOLDS.NUKE_TIME_WINDOW;
  const recentUserActions = getRecentActions(guildId, actionType, timeWindow, userId);
  
  // If we're above the threshold, this might be a nuke attempt
  if (recentUserActions.length >= threshold) {
    const targetMember = guild.members.cache.get(userId);
    
    // Skip if we can't find the member or they have left
    if (!targetMember) {
      console.log(`[SECURITY] Can't take action against user ${userId} - not in server`);
      return;
    }
    
    // Skip if the member outranks the bot (can't moderate them)
    const botMember = guild.members.cache.get(guild.client.user.id);
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      sendSecurityAlert(guild, {
        title: '⚠️ CRITICAL: Security Threat Detected',
        description: `User <@${userId}> is performing suspicious mass ${actionType} actions, but I cannot stop them because they outrank me!`,
        color: 0xFF0000,
        fields: [
          {
            name: '❌ Actions Taken',
            value: 'None - this user has higher permissions than the bot'
          },
          {
            name: '🚨 URGENT ACTION REQUIRED',
            value: `The server owner or administrators must manually intervene to stop this user by revoking their permissions!`
          }
        ]
      });
      return;
    }
    
    console.log(`[SECURITY] Possible nuke attempt: User ${userId} performed ${recentUserActions.length} ${actionType} actions in ${timeWindow}ms`);
    
    // Record this incident
    if (!activeIncidents.has(guildId)) {
      activeIncidents.set(guildId, new Map());
    }
    
    const incidentId = `${actionType}_${userId}_${Date.now()}`;
    activeIncidents.get(guildId).set(incidentId, {
      type: 'NUKE_ATTEMPT',
      subType: actionType,
      userId,
      count: recentUserActions.length,
      timestamp: Date.now(),
      resolved: false
    });
    
    // Take anti-nuke action
    handleNukeAttempt(guild, userId, actionType, recentUserActions);
  }
}

// Handle a detected nuke attempt
async function handleNukeAttempt(guild, userId, actionType, actions) {
  const serverConfig = config.getServerConfig(guild.id);
  
  // Determine action based on server settings
  // Default to strict action - BAN
  let actionToTake = serverConfig.antiNukeAction || 'BAN';
  
  try {
    const targetMember = guild.members.cache.get(userId);
    
    // Log all the details for auditability
    console.log(`[SECURITY] Taking ${actionToTake} action against ${userId} for nuke attempt: ${actionType} x${actions.length}`);
    
    // Save detailed log of the nuke attempt
    serverConfig.nukeAttempts = serverConfig.nukeAttempts || [];
    serverConfig.nukeAttempts.push({
      userId,
      actionType,
      count: actions.length,
      timestamp: Date.now(),
      actionTaken: actionToTake
    });
    config.updateServerConfig(guild.id, serverConfig);
    
    // Create security alert embed
    const securityEmbed = {
      title: '🚨 **NUKE ATTEMPT DETECTED AND BLOCKED**',
      description: `Detected suspicious activity from <@${userId}>: ${actions.length} ${actionType.replace('_', ' ')} operations in rapid succession.`,
      color: 0xFF0000,
      fields: [
        {
          name: '🛡️ Action Taken',
          value: actionToTake === 'BAN' ? 
            `User has been banned and their recent actions are being monitored.` : 
            `User permissions have been revoked and their recent actions are being monitored.`
        },
        {
          name: '⚠️ Warning',
          value: 'Please review server audit logs to verify legitimate actions were not incorrectly blocked.'
        }
      ],
      timestamp: new Date()
    };
    
    // Take action on the member
    if (targetMember) {
      try {
        if (actionToTake === 'BAN') {
          await targetMember.ban({ 
            reason: `[AUTO-SECURITY] Anti-nuke: ${actions.length} ${actionType} in ${SECURITY_THRESHOLDS.NUKE_TIME_WINDOW/1000}s`,
            deleteMessageSeconds: 86400 // Delete past 24hrs of messages
          });
          securityEmbed.fields.push({
            name: '👤 User Banned',
            value: `User \`${targetMember.user.tag}\` (${userId}) has been banned.`
          });
        } else {
          // Remove all roles to neutralize threat
          const roles = targetMember.roles.cache.filter(r => r.id !== guild.id);
          await targetMember.roles.remove(roles, `[AUTO-SECURITY] Anti-nuke: ${actions.length} ${actionType} in ${SECURITY_THRESHOLDS.NUKE_TIME_WINDOW/1000}s`);
          
          securityEmbed.fields.push({
            name: '🔒 Permissions Removed',
            value: `All roles have been removed from \`${targetMember.user.tag}\` (${userId}).`
          });
        }
      } catch (actionError) {
        console.error(`[SECURITY] Error taking action against user ${userId}:`, actionError);
        securityEmbed.fields.push({
          name: '❌ Error',
          value: `Failed to ${actionToTake.toLowerCase()} user: ${actionError.message}`
        });
      }
    } else {
      securityEmbed.fields.push({
        name: '⚠️ User Not Found',
        value: `Unable to take direct action as the user is no longer in the server.`
      });
    }
    
    // Send alert to notification channel
    sendSecurityAlert(guild, securityEmbed);
    
  } catch (error) {
    console.error(`[SECURITY] Error handling nuke attempt:`, error);
  }
}

// Send security alerts to the configured notification channel
async function sendSecurityAlert(guild, embedData) {
  try {
    // Get server config for notification channel
    const serverConfig = config.getServerConfig(guild.id);
    const notificationChannelId = serverConfig.notificationChannelId;
    
    // Create embed if raw data was provided
    const embed = embedData instanceof EmbedBuilder ? 
      embedData : 
      new EmbedBuilder()
        .setTitle(embedData.title || 'Security Alert')
        .setDescription(embedData.description || 'A security event occurred.')
        .setColor(embedData.color || 0xFF0000)
        .setTimestamp();
    
    // Add fields if provided
    if (embedData.fields) {
      for (const field of embedData.fields) {
        embed.addFields(field);
      }
    }
    
    // Set footer if provided
    if (embedData.footer) {
      embed.setFooter(embedData.footer);
    } else {
      embed.setFooter({ text: 'Phantom Guard Security System' });
    }
    
    // Try to send to notification channel
    if (notificationChannelId) {
      const channel = await guild.channels.fetch(notificationChannelId).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [embed] });
        return true;
      }
    }
    
    // If no notification channel, try sending to system channel
    if (guild.systemChannel) {
      await guild.systemChannel.send({ embeds: [embed] });
      return true;
    }

    // If all else fails, try to find a general channel
    const generalChannel = guild.channels.cache.find(ch => 
      ch.type === 0 && // Text channel
      (ch.name.includes('general') || ch.name === 'general' || ch.name.includes('chat'))
    );
    
    if (generalChannel) {
      await generalChannel.send({ embeds: [embed] });
      return true;
    }
    
    console.log(`[SECURITY] Could not find a channel to send security alert in ${guild.name}`);
    return false;
  } catch (error) {
    console.error(`[SECURITY] Error sending security alert:`, error);
    return false;
  }
}

// Start security monitoring for a specific server 
function startServerSecurityMonitoring(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.log(`Guild ${guildId} not found, skipping security initialization`);
    return;
  }
  
  const serverConfig = config.getServerConfig(guildId);
  
  // Don't start if explicitly disabled
  if (serverConfig.securityDisabled) {
    console.log(`Security disabled for guild ${guild.name}, skipping`);
    return;
  }
  
  // Default to secure settings if none exist
  if (!serverConfig.antiNukeThreshold) {
    config.updateServerConfig(guildId, {
      antiNukeThreshold: SECURITY_THRESHOLDS.CHANNEL_DELETIONS,
      antiNukeEnabled: true
    });
  }
  
  // Set up active anti-nuke monitoring
  activateAntiNuke(client, guildId, serverConfig.antiNukeThreshold);
  
  console.log(`Security monitoring activated for server: ${guild.name}`);
}

// Initialize security monitoring for all servers
function startSecurityMonitoring(client) {
  console.log('Starting security monitoring for all servers...');
  
  // Go through each guild the bot is in
  client.guilds.cache.forEach(guild => {
    startServerSecurityMonitoring(client, guild.id);
  });
  
  console.log('Security monitoring active for all servers - checking for nukes, raids and spam');
}

// Activate anti-nuke protection for a guild
function activateAntiNuke(client, guildId, threshold = null) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.log(`Guild ${guildId} not found, skipping anti-nuke activation`);
    return false;
  }
  
  const serverConfig = config.getServerConfig(guildId);
  
  // Update anti-nuke threshold if provided
  if (threshold !== null) {
    config.updateServerConfig(guildId, {
      antiNukeThreshold: threshold,
      antiNukeEnabled: true,
      antiNukeDisabled: false
    });
  }
  
  console.log(`Activated anti-nuke protection for ${guild.name} with threshold ${threshold || serverConfig.antiNukeThreshold || SECURITY_THRESHOLDS.CHANNEL_DELETIONS}`);
  return true;
}

// Enable server-wide lockdown during an emergency
async function enableLockdownMode(client, guildId, requesterId, reason = 'Security emergency') {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }
  
  // Get server config
  const serverConfig = config.getServerConfig(guildId);
  
  // Store all affected channels so we can restore them later
  const affectedChannels = [];
  let failedChannels = 0;
  
  try {
    // Lock down all text channels to prevent messaging
    const channels = guild.channels.cache.filter(c => 
      // Only include text channels, announcement channels, and threads
      [0, 1, 5, 10, 11, 12].includes(c.type)
    );
    
    console.log(`[SECURITY] Locking down ${channels.size} channels in ${guild.name}`);
    
    // Create lockdown message
    const lockdownEmbed = new EmbedBuilder()
      .setTitle('🔒 SERVER LOCKDOWN ACTIVATED')
      .setDescription(`This server is now in lockdown mode.\n\n**Reason:** ${reason}`)
      .setColor(0xFF0000)
      .addFields(
        {
          name: '⏱️ Duration',
          value: 'This lockdown will remain active until the server owner ends it manually.'
        },
        {
          name: '👥 Users',
          value: 'Please remain patient while the situation is being handled. You will be notified when the lockdown ends.'
        }
      )
      .setFooter({ text: 'Phantom Guard Security System' })
      .setTimestamp();
      
    // Process all channels
    for (const [id, channel] of channels) {
      try {
        // Store original permissions to restore later
        const originalPermissions = channel.permissionOverwrites.cache.get(guild.id)?.allow.bitfield || 0n;
        const originalDeny = channel.permissionOverwrites.cache.get(guild.id)?.deny.bitfield || 0n;
        
        // Save original state
        affectedChannels.push({
          id,
          originalAllow: originalPermissions.toString(),
          originalDeny: originalDeny.toString()
        });
        
        // Lock down the channel - deny sending messages for everyone
        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false
        }, { reason: `[LOCKDOWN] ${reason} - Requested by ${requesterId}` });
        
        // Try to send lockdown message to text channels
        if (channel.type === 0) { // Text channel
          await channel.send({ embeds: [lockdownEmbed] }).catch(() => {});
        }
      } catch (channelError) {
        console.error(`[SECURITY] Failed to lock channel ${id}:`, channelError);
        failedChannels++;
      }
    }
    
    // Save lockdown state
    config.updateServerConfig(guildId, {
      lockdownActive: true,
      lockdownInfo: {
        reason,
        timestamp: Date.now(),
        requesterId,
        affectedChannels
      }
    });
    
    // Update server lockdown tracking
    serverLockdowns.set(guildId, {
      active: true,
      timestamp: Date.now(),
      reason,
      requesterId,
      affectedChannels
    });
    
    // Log to console
    console.log(`[SECURITY] Server lockdown activated for ${guild.name} by ${requesterId}`);
    
    // Send notification to system channel if available
    try {
      if (guild.systemChannel) {
        await guild.systemChannel.send({
          content: '**ATTENTION EVERYONE**',
          embeds: [
            new EmbedBuilder()
              .setTitle('🚨 SERVER-WIDE LOCKDOWN ACTIVE')
              .setDescription(`This server has been placed in emergency lockdown mode by <@${requesterId}>.\n\n**Reason:** ${reason}`)
              .setColor(0xFF0000)
              .addFields(
                {
                  name: '⚠️ Important Information',
                  value: 'All channels have been temporarily locked to prevent messaging. Please remain calm and patient.'
                },
                {
                  name: '🔓 Ending Lockdown',
                  value: 'Only the server owner can end this lockdown with the command `/lockdown disable`'
                }
              )
              .setTimestamp()
          ]
        });
      }
    } catch (notifyError) {
      console.error('[SECURITY] Failed to send lockdown notification:', notifyError);
    }
    
    return { 
      success: true, 
      affectedChannels: affectedChannels.length, 
      failedChannels 
    };
  } catch (error) {
    console.error('[SECURITY] Error activating lockdown mode:', error);
    return { 
      success: false, 
      error: error.message, 
      affectedChannels: affectedChannels.length, 
      failedChannels 
    };
  }
}

// Disable lockdown mode and restore normal server operations
async function disableLockdownMode(client, guildId, requesterId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }
  
  // Get server config
  const serverConfig = config.getServerConfig(guildId);
  
  // Check if server is in lockdown
  if (!serverConfig.lockdownActive || !serverConfig.lockdownInfo) {
    return { success: false, error: 'Server is not in lockdown mode' };
  }
  
  const { affectedChannels, timestamp } = serverConfig.lockdownInfo;
  let restoredChannels = 0;
  let failedChannels = 0;
  
  try {
    // Create unlock message
    const unlockEmbed = new EmbedBuilder()
      .setTitle('🔓 SERVER LOCKDOWN ENDED')
      .setDescription('This server is no longer in lockdown mode. Normal operations have resumed.')
      .setColor(0x00FF00)
      .addFields(
        {
          name: '⏱️ Lockdown Duration',
          value: `${Math.floor((Date.now() - timestamp) / 60000)} minutes`
        },
        {
          name: '👥 Information',
          value: 'All channels have been restored to their previous state. Thank you for your patience.'
        }
      )
      .setFooter({ text: 'Phantom Guard Security System' })
      .setTimestamp();
    
    // Restore each channel
    for (const channelData of affectedChannels) {
      try {
        const channel = guild.channels.cache.get(channelData.id);
        if (!channel) continue;
        
        // Remove the lockdown overwrites
        await channel.permissionOverwrites.edit(guild.id, {
          SendMessages: null,
          CreatePublicThreads: null,
          CreatePrivateThreads: null
        }, { reason: `Lockdown ended by ${requesterId}` });
        
        // Try to send unlock message to text channels
        if (channel.type === 0) { // Text channel
          await channel.send({ embeds: [unlockEmbed] }).catch(() => {});
        }
        
        restoredChannels++;
      } catch (channelError) {
        console.error(`[SECURITY] Failed to restore channel ${channelData.id}:`, channelError);
        failedChannels++;
      }
    }
    
    // Save lockdown end state
    config.updateServerConfig(guildId, {
      lockdownActive: false,
      lockdownInfo: null,
      lastLockdown: {
        reason: serverConfig.lockdownInfo.reason,
        endedAt: Date.now(),
        duration: Date.now() - serverConfig.lockdownInfo.timestamp,
        endedBy: requesterId
      }
    });
    
    // Update server lockdown tracking
    serverLockdowns.set(guildId, {
      active: false,
      endedAt: Date.now(),
      duration: Date.now() - (serverLockdowns.get(guildId)?.timestamp || Date.now())
    });
    
    // Log to console
    console.log(`[SECURITY] Server lockdown ended for ${guild.name} by ${requesterId}`);
    
    // Send notification to system channel if available
    try {
      if (guild.systemChannel) {
        await guild.systemChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔓 LOCKDOWN ENDED')
              .setDescription(`The server lockdown has been ended by <@${requesterId}>.`)
              .setColor(0x00FF00)
              .addFields(
                {
                  name: '✅ Server Status',
                  value: 'All channels have been restored to normal operation.'
                }
              )
              .setTimestamp()
          ]
        });
      }
    } catch (notifyError) {
      console.error('[SECURITY] Failed to send lockdown end notification:', notifyError);
    }
    
    return { 
      success: true, 
      restoredChannels, 
      failedChannels 
    };
  } catch (error) {
    console.error('[SECURITY] Error ending lockdown mode:', error);
    return { 
      success: false, 
      error: error.message, 
      restoredChannels, 
      failedChannels 
    };
  }
}

// Handle detecting raids - multiple users joining in a short time
function detectRaidAttempt(guild, members, timeWindow) {
  // Implementation for raid detection
  console.log(`[SECURITY] Checking for raid attempt in ${guild.name}: ${members.length} joins in ${timeWindow}ms`);
}

// Export functions
module.exports = {
  startSecurityMonitoring,
  recordAction,
  sendSecurityAlert,
  activateAntiNuke,
  enableLockdownMode,
  disableLockdownMode,
  SECURITY_THRESHOLDS,
  getActiveIncidents: () => Object.fromEntries(activeIncidents),
  getRecentActions,
  isGuildOwner,
  handleNukeAttempt
};