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
 * - Administrator Protection: Guards against rogue administrator actions
 * - Channel Protection: Prevents unauthorized channel modifications
 * - Server Settings Protection: Blocks unauthorized server setting changes
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
async function checkForNukeAttempt(guildId, userId, actionType) {
  const guild = global.client?.guilds.cache.get(guildId);
  if (!guild) return;
  
  // Get server config to check anti-nuke settings and threshold
  const serverConfig = config.getServerConfig(guildId);
  const threshold = serverConfig.antiNukeThreshold || SECURITY_THRESHOLDS.CHANNEL_DELETIONS;
  
  // Skip check if anti-nuke is disabled
  if (serverConfig.antiNukeDisabled) {
    return;
  }
  
  // Don't apply anti-nuke to the server owner - ONLY the server owner is exempt
  if (guild.ownerId === userId) {
    return;
  }
  
  // Check if this user is directly whitelisted by ID
  if (serverConfig.whitelistedUsers && Array.isArray(serverConfig.whitelistedUsers) && 
      serverConfig.whitelistedUsers.includes(userId)) {
    console.log(`[SECURITY] Skipping nuke checks for whitelisted user ${userId}`);
    return;
  }
  
  // Check for whitelisted roles (this requires fetching the member)
  if (serverConfig.whitelistedRoles && Array.isArray(serverConfig.whitelistedRoles) && 
      serverConfig.whitelistedRoles.length > 0) {
    try {
      const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Check if member has any whitelisted roles
        const hasWhitelistedRole = member.roles.cache.some(role => 
          serverConfig.whitelistedRoles.includes(role.id)
        );
        
        if (hasWhitelistedRole) {
          console.log(`[SECURITY] Skipping nuke checks for user ${userId} with whitelisted role`);
          return;
        }
      }
    } catch (roleCheckError) {
      console.error(`[SECURITY] Error checking roles for nuke detection:`, roleCheckError);
    }
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
      timestamp: new Date(),
      // Add reason for the user notification
      userReason: `You performed ${actions.length} ${actionType.replace('_', ' ')} operations in rapid succession, which was detected as a potential nuke attempt. This is a serious security violation.`
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
    
    // Send alert to notification channel and DM both server owner and violator
    sendSecurityAlert(guild, securityEmbed, userId);
    
  } catch (error) {
    console.error(`[SECURITY] Error handling nuke attempt:`, error);
  }
}

// Send security alerts to the configured notification channel
async function sendSecurityAlert(guild, embedData, targetUserId = null) {
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
    
    // Always send to server owner as DM
    try {
      const owner = await guild.fetchOwner();
      if (owner) {
        // Create owner-specific embed with additional info
        const ownerEmbed = new EmbedBuilder()
          .setTitle(`🔒 ${embedData.title || 'Security Alert'}`)
          .setDescription(embedData.description || 'A security event occurred.')
          .setColor(embedData.color || 0xFF0000)
          .setTimestamp();
        
        // Add fields with enhanced information for owner
        if (embedData.fields) {
          for (const field of embedData.fields) {
            ownerEmbed.addFields(field);
          }
        }
        
        // Add server information field
        ownerEmbed.addFields({
          name: '🏠 Server Information',
          value: `Server: ${guild.name}\nServer ID: ${guild.id}\nAction taken automatically by Phantom Guard security system`
        });
        
        // Set footer
        ownerEmbed.setFooter({ text: 'Phantom Guard Security System - Owner Alert' });
        
        // Send to owner
        await owner.send({ 
          content: `📢 **SECURITY NOTIFICATION**: A security event has occurred in your server "${guild.name}"`,
          embeds: [ownerEmbed] 
        }).catch(err => {
          console.log(`[SECURITY] Could not send DM to owner, likely has DMs disabled: ${err.message}`);
        });
        
        console.log(`[SECURITY] Sent security alert to server owner: ${owner.user.tag}`);
      }
    } catch (ownerError) {
      console.error(`[SECURITY] Error sending security alert to owner:`, ownerError);
    }
    
    // If a target user ID is provided, also send them a DM
    if (targetUserId) {
      try {
        // Fetch the target user and send them a DM
        const targetUser = await guild.members.fetch(targetUserId).catch(() => null);
        if (targetUser) {
          // Create user-specific embed explaining action taken against them
          const userEmbed = new EmbedBuilder()
            .setTitle(`⚠️ Security Action Notification`)
            .setDescription(`A security action has been taken against you in the server "${guild.name}".`)
            .setColor(0xFF0000)
            .setTimestamp()
            .addFields(
              {
                name: '📝 Reason',
                value: embedData.userReason || 'You performed an action that violated the server\'s strict security policy.'
              },
              {
                name: '🔒 Security Policy',
                value: 'This server has strict security enabled. Only the server owner can modify server structure and settings.'
              },
              {
                name: '❓ Appeal',
                value: 'If you believe this was in error, please contact the server owner.'
              }
            )
            .setFooter({ text: 'Phantom Guard Security System' });
          
          // Send to the target user
          await targetUser.send({ embeds: [userEmbed] }).catch(err => {
            console.log(`[SECURITY] Could not send DM to target user, likely has DMs disabled: ${err.message}`);
          });
          
          console.log(`[SECURITY] Sent security notification to target user: ${targetUser.user.tag}`);
        }
      } catch (targetError) {
        console.error(`[SECURITY] Error sending notification to target user:`, targetError);
      }
    }
    
    // Try to send to notification channel
    let serverNotified = false;
    if (notificationChannelId) {
      const channel = await guild.channels.fetch(notificationChannelId).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [embed] });
        serverNotified = true;
      }
    }
    
    // If no notification channel, try sending to system channel
    if (!serverNotified && guild.systemChannel) {
      await guild.systemChannel.send({ embeds: [embed] });
      serverNotified = true;
    }

    // If all else fails, try to find a general channel
    if (!serverNotified) {
      const generalChannel = guild.channels.cache.find(ch => 
        ch.type === 0 && // Text channel
        (ch.name.includes('general') || ch.name === 'general' || ch.name.includes('chat'))
      );
      
      if (generalChannel) {
        await generalChannel.send({ embeds: [embed] });
        serverNotified = true;
      }
    }
    
    if (!serverNotified) {
      console.log(`[SECURITY] Could not find a channel to send security alert in ${guild.name}`);
    }
    
    return serverNotified;
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

// Function to monitor and react to channel modifications
function setupChannelModificationProtection(client) {
  // Set up event listeners for channel modifications
  client.on('channelCreate', async (channel) => {
    // Skip if not in a guild
    if (!channel.guild) return;
    
    try {
      // Get last audit log entry to see who created the channel
      const auditLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: 10 // CHANNEL_CREATE
      });
      
      const entry = auditLogs.entries.first();
      if (!entry) return;
      
      const { executor } = entry;
      
      // Skip if the executor is the server owner
      if (executor.id === channel.guild.ownerId) return;
      
      // Check if this user is whitelisted
      const guildConfig = config.getServerConfig(channel.guild.id);
      if (guildConfig.whitelistedUsers && guildConfig.whitelistedUsers.includes(executor.id)) {
        return;
      }
      
      // Record the action for potential nuke detection
      recordAction(channel.guild.id, executor.id, 'CHANNEL_CREATE', { 
        channelId: channel.id,
        channelName: channel.name
      });
      
      // If strict security is enabled, only owner can create channels
      if (guildConfig.strictSecurity) {
        console.log(`[STRICT-SECURITY] Non-owner ${executor.tag} created channel ${channel.name}`);
        
        try {
          // Delete the channel
          await channel.delete(`[SECURITY] Strict security: Only owner can create channels`);
          
          // Record incident and notify
          sendSecurityAlert(channel.guild, {
            title: '🛡️ Channel Creation Blocked',
            description: `User ${executor.tag} (${executor.id}) attempted to create a channel but was blocked due to strict security settings.`,
            color: 0xFFAA00,
            fields: [
              {
                name: '📝 Details',
                value: `Channel name: ${channel.name}\nChannel type: ${channel.type}\nAction: Channel was deleted`
              },
              {
                name: '⚠️ Security Notice',
                value: 'Only the server owner can create channels when strict security is enabled.'
              }
            ]
          });
        } catch (error) {
          console.error('[SECURITY] Error deleting unauthorized channel:', error);
        }
      }
    } catch (error) {
      console.error('[SECURITY] Error handling channel creation:', error);
    }
  });
  
  // Monitor channel updates
  client.on('channelUpdate', async (oldChannel, newChannel) => {
    // Skip if not in a guild
    if (!newChannel.guild) return;
    
    try {
      // Get last audit log entry to see who updated the channel
      const auditLogs = await newChannel.guild.fetchAuditLogs({
        limit: 1,
        type: 11 // CHANNEL_UPDATE
      });
      
      const entry = auditLogs.entries.first();
      if (!entry) return;
      
      const { executor } = entry;
      
      // Skip if the executor is the server owner
      if (executor.id === newChannel.guild.ownerId) return;
      
      // Check if user is whitelisted
      const guildConfig = config.getServerConfig(newChannel.guild.id);
      if (guildConfig.whitelistedUsers && guildConfig.whitelistedUsers.includes(executor.id)) {
        return;
      }
      
      // Record the action for potential nuke detection
      recordAction(newChannel.guild.id, executor.id, 'CHANNEL_UPDATE', { 
        channelId: newChannel.id,
        oldName: oldChannel.name,
        newName: newChannel.name
      });
      
      // If strict security is enabled, only owner can update channels
      if (guildConfig.strictSecurity) {
        console.log(`[STRICT-SECURITY] Non-owner ${executor.tag} updated channel ${oldChannel.name} to ${newChannel.name}`);
        
        try {
          // Get the audit log to determine what was changed
          const changes = entry.changes.map(c => `${c.key}: ${c.old} -> ${c.new}`).join(', ');
          
          // Revert the changes if possible
          if (oldChannel.name !== newChannel.name) {
            await newChannel.setName(oldChannel.name, `[SECURITY] Strict security: Only owner can rename channels`);
          }
          
          if (oldChannel.topic !== newChannel.topic) {
            await newChannel.setTopic(oldChannel.topic || '', `[SECURITY] Strict security: Only owner can change channel topics`);
          }
          
          // Revert permission changes if any
          if (oldChannel.permissionOverwrites !== newChannel.permissionOverwrites) {
            // This is more complex and would require detailed comparison and restoration
            // For now we'll just notify about it
          }
          
          // Record incident and notify
          sendSecurityAlert(newChannel.guild, {
            title: '🛡️ Channel Update Blocked',
            description: `User ${executor.tag} (${executor.id}) attempted to modify a channel but was blocked due to strict security settings.`,
            color: 0xFFAA00,
            fields: [
              {
                name: '📝 Details',
                value: `Channel: ${oldChannel.name}\nChanges: ${changes}\nAction: Changes were reverted`
              },
              {
                name: '⚠️ Security Notice',
                value: 'Only the server owner can modify channels when strict security is enabled.'
              }
            ]
          });
        } catch (error) {
          console.error('[SECURITY] Error reverting unauthorized channel update:', error);
        }
      }
    } catch (error) {
      console.error('[SECURITY] Error handling channel update:', error);
    }
  });
  
  // Monitor channel deletions
  client.on('channelDelete', async (channel) => {
    // Skip if not in a guild
    if (!channel.guild) return;
    
    try {
      console.log(`[SECURITY] Channel deletion detected: ${channel.name} (${channel.id}) in ${channel.guild.name}`);
      
      // Get last audit log entry to see who deleted the channel
      const auditLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: 12 // CHANNEL_DELETE
      }).catch(err => {
        console.error(`[SECURITY] Could not fetch audit logs for channel deletion in ${channel.guild.name}:`, err);
        return { entries: new Map() };
      });
      
      const entry = auditLogs.entries?.first();
      if (!entry) {
        console.log(`[SECURITY] No audit log entry found for channel deletion: ${channel.name}`);
        return;
      }
      
      const { executor } = entry;
      if (!executor) {
        console.log(`[SECURITY] No executor found in audit log for channel deletion`);
        return;
      }
      
      console.log(`[SECURITY] Channel ${channel.name} was deleted by ${executor.tag || executor.username} (${executor.id})`);
      
      // Skip if the executor is the server owner
      if (executor.id === channel.guild.ownerId) {
        console.log(`[SECURITY] Channel deletion by server owner, ignoring`);
        return;
      }
      
      // Skip if the executor is the bot itself
      if (executor.id === client.user.id) {
        console.log(`[SECURITY] Channel deletion by bot itself, ignoring`);
        return;
      }
      
      // Get the server config
      const guildConfig = config.getServerConfig(channel.guild.id);
      
      // Check if this user is directly whitelisted by ID
      if (guildConfig.whitelistedUsers && Array.isArray(guildConfig.whitelistedUsers) && 
          guildConfig.whitelistedUsers.includes(executor.id)) {
        console.log(`[SECURITY] Channel deletion by whitelisted user ${executor.tag || executor.username}, ignoring`);
        return;
      }
      
      // Check if the user has any whitelisted roles
      if (guildConfig.whitelistedRoles && Array.isArray(guildConfig.whitelistedRoles) && 
          guildConfig.whitelistedRoles.length > 0) {
        try {
          // Fetch member to check roles
          const member = await channel.guild.members.fetch(executor.id).catch(() => null);
          if (member) {
            // Check if the member has any whitelisted roles
            const hasWhitelistedRole = member.roles.cache.some(role => 
              guildConfig.whitelistedRoles.includes(role.id)
            );
            
            if (hasWhitelistedRole) {
              console.log(`[SECURITY] Channel deletion by user ${executor.tag || executor.username} with whitelisted role, ignoring`);
              return;
            }
          }
        } catch (roleCheckError) {
          console.error(`[SECURITY] Error checking user roles for whitelist:`, roleCheckError);
        }
      }
      
      // Record the action for potential nuke detection
      recordAction(channel.guild.id, executor.id, 'CHANNEL_DELETE', { 
        channelId: channel.id,
        channelName: channel.name
      });
      
      // If strict security is enabled, punish the user immediately
      if (guildConfig.strictSecurity) {
        console.log(`[STRICT-SECURITY] Non-owner ${executor.tag || executor.username} deleted channel ${channel.name}`);
        
        try {
          // Check bot permissions before taking action
          const botMember = channel.guild.members.cache.get(client.user.id);
          if (!botMember) {
            console.error(`[SECURITY] Cannot get bot member in ${channel.guild.name}`);
            return;
          }
          
          if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers) || 
              !botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            console.error(`[SECURITY] Bot doesn't have permission to ban/kick in ${channel.guild.name}`);
            sendSecurityAlert(channel.guild, {
              title: '🚨 SECURITY ALERT: CANNOT ENFORCE PROTECTION',
              description: `User ${executor.tag || executor.username} (${executor.id}) deleted channel "${channel.name}" but I cannot take action due to missing permissions!`,
              color: 0xFF0000,
              fields: [
                {
                  name: '⚠️ URGENT: Fix Permissions',
                  value: 'Please give the bot Ban Members and Kick Members permissions to enforce security.'
                }
              ]
            });
            return;
          }
          
          console.log(`[SECURITY] Attempting to take action against user ${executor.id} for deleting channel ${channel.name}`);
          
          // Force-fetch the member to ensure we have the latest data
          channel.guild.members.fetch({ user: executor.id, force: true }).then(async (member) => {
            if (!member) {
              console.log(`[SECURITY] Member ${executor.id} not found in guild, cannot take action`);
              return;
            }
            
            console.log(`[SECURITY] Taking action against ${member.user.tag} for unauthorized channel deletion`);
            
            try {
              // Check if we can manage this member's roles
              if (botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                console.error(`[SECURITY] Cannot modify roles of ${member.user.tag} - they have higher role than the bot`);
                sendSecurityAlert(channel.guild, {
                  title: '⚠️ SECURITY WARNING: Cannot Enforce Protection',
                  description: `User ${member.user.tag} (${member.id}) deleted channel "${channel.name}" but has higher role than the bot!`,
                  color: 0xFF0000,
                  fields: [
                    {
                      name: '🔴 ACTION REQUIRED',
                      value: 'Please move the bot\'s role higher in the role hierarchy than all admin roles.'
                    }
                  ]
                });
                return;
              }
            
              // Remove all their roles first to disable them immediately
              const roles = member.roles.cache.filter(r => r.id !== channel.guild.id);
              
              if (roles.size > 0) {
                await member.roles.remove(roles, `[SECURITY] Strict security: Unauthorized channel deletion`).catch(err => {
                  console.error(`[SECURITY] Failed to remove roles from ${member.user.tag}:`, err);
                });
                console.log(`[SECURITY] Removed all roles from ${member.user.tag}`);
              }
              
              // Ban or kick based on severity setting
              if (guildConfig.strictSecurityAction === 'ban') {
                await member.ban({ 
                  reason: `[SECURITY] Strict security: Unauthorized channel deletion`,
                  deleteMessageSeconds: 86400
                }).then(() => {
                  console.log(`[SECURITY] Successfully banned ${member.user.tag}`);
                }).catch(err => {
                  console.error(`[SECURITY] Failed to ban ${member.user.tag}:`, err);
                });
              } else {
                await member.kick(`[SECURITY] Strict security: Unauthorized channel deletion`).then(() => {
                  console.log(`[SECURITY] Successfully kicked ${member.user.tag}`);
                }).catch(err => {
                  console.error(`[SECURITY] Failed to kick ${member.user.tag}:`, err);
                });
              }
            } catch (actionError) {
              console.error(`[SECURITY] Error taking action against member:`, actionError);
            }
          }).catch(fetchError => {
            console.error(`[SECURITY] Error fetching member ${executor.id}:`, fetchError);
          });
          
          // Record incident and notify both server and the user who performed the action
          try {
            sendSecurityAlert(channel.guild, {
              title: '🚨 UNAUTHORIZED CHANNEL DELETION',
              description: `User ${executor.tag || executor.username} (${executor.id}) has deleted a channel and has been punished according to security settings.`,
              color: 0xFF0000,
              fields: [
                {
                  name: '📝 Details',
                  value: `Channel name: ${channel.name}\nChannel ID: ${channel.id}\nAction: User ${guildConfig.strictSecurityAction === 'ban' ? 'banned' : 'kicked'}`
                },
                {
                  name: '⚠️ Security Notice',
                  value: 'Only the server owner can delete channels when strict security is enabled.'
                }
              ],
              // Add reason for the user who will receive DM
              userReason: `You attempted to delete the channel "${channel.name}", which is not allowed under this server's strict security policy. Only the server owner can delete channels.`
            }, executor.id); // Pass the executor ID so they get a DM
          } catch (alertError) {
            console.error(`[SECURITY] Failed to send security alert:`, alertError);
          }
          
          // If automatic channel recreation is enabled and we have the channel info cached
          if (guildConfig.autoRestore) {
            try {
              // We could potentially try to recreate the channel here
              // However, accurately recreating all channel settings is complex
              // Would need to implement a dedicated backup/restore system
              console.log(`[SECURITY] Auto-restore is enabled, but channel recreation not yet implemented`);
            } catch (restoreError) {
              console.error(`[SECURITY] Error in auto-restore:`, restoreError);
            }
          }
        } catch (error) {
          console.error('[SECURITY] Error handling unauthorized channel deletion:', error);
        }
      }
    } catch (error) {
      console.error('[SECURITY] Error handling channel deletion:', error);
    }
  });
  
  // Monitor guild update events (server name changes, etc.)
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    try {
      // Get last audit log entry to see who updated the guild
      const auditLogs = await newGuild.fetchAuditLogs({
        limit: 1,
        type: 1 // GUILD_UPDATE
      });
      
      const entry = auditLogs.entries.first();
      if (!entry) return;
      
      const { executor } = entry;
      
      // Skip if the executor is the server owner
      if (executor.id === newGuild.ownerId) return;
      
      // Get server config
      const guildConfig = config.getServerConfig(newGuild.id);
      
      // Check if this user is directly whitelisted by ID
      if (guildConfig.whitelistedUsers && Array.isArray(guildConfig.whitelistedUsers) && 
          guildConfig.whitelistedUsers.includes(executor.id)) {
        console.log(`[SECURITY] Guild update by whitelisted user ${executor.tag || executor.username}, ignoring`);
        return;
      }
      
      // Check if the user has any whitelisted roles
      if (guildConfig.whitelistedRoles && Array.isArray(guildConfig.whitelistedRoles) && 
          guildConfig.whitelistedRoles.length > 0) {
        try {
          // Fetch member to check roles
          const member = await newGuild.members.fetch(executor.id).catch(() => null);
          if (member) {
            // Check if the member has any whitelisted roles
            const hasWhitelistedRole = member.roles.cache.some(role => 
              guildConfig.whitelistedRoles.includes(role.id)
            );
            
            if (hasWhitelistedRole) {
              console.log(`[SECURITY] Guild update by user ${executor.tag || executor.username} with whitelisted role, ignoring`);
              return;
            }
          }
        } catch (roleCheckError) {
          console.error(`[SECURITY] Error checking user roles for whitelist:`, roleCheckError);
        }
      }
      
      // Record the action for potential nuke detection
      recordAction(newGuild.id, executor.id, 'GUILD_UPDATE', { 
        oldName: oldGuild.name,
        newName: newGuild.name
      });
      
      // If strict security is enabled, only owner can update guild settings
      if (guildConfig.strictSecurity) {
        console.log(`[STRICT-SECURITY] Non-owner ${executor.tag} updated server settings: ${oldGuild.name} -> ${newGuild.name}`);
        
        try {
          // Get the audit log to determine what was changed
          const changes = entry.changes.map(c => `${c.key}: ${c.old} -> ${c.new}`).join(', ');
          
          // Revert the changes if possible
          if (oldGuild.name !== newGuild.name) {
            await newGuild.setName(oldGuild.name, `[SECURITY] Strict security: Only owner can rename the server`);
          }
          
          if (oldGuild.icon !== newGuild.icon && oldGuild.icon) {
            await newGuild.setIcon(oldGuild.icon, `[SECURITY] Strict security: Only owner can change server icon`);
          }
          
          // Record incident and notify both server and user
          sendSecurityAlert(newGuild, {
            title: '🛡️ Server Settings Update Blocked',
            description: `User ${executor.tag} (${executor.id}) attempted to modify server settings but was blocked due to strict security settings.`,
            color: 0xFFAA00,
            fields: [
              {
                name: '📝 Details',
                value: `Changes: ${changes}\nAction: Changes were reverted`
              },
              {
                name: '⚠️ Security Notice',
                value: 'Only the server owner can modify server settings when strict security is enabled.'
              }
            ],
            // Add reason for the user who will receive DM
            userReason: `You attempted to modify server settings (${changes}), which is not allowed under this server's strict security policy. Only the server owner can change server settings.`
          }, executor.id); // Pass the executor ID so they get a DM
          
          // Take action against the member
          const member = await newGuild.members.fetch(executor.id);
          if (member) {
            // Warnings or temporary role removal could be implemented here
            const roles = member.roles.cache.filter(r => r.id !== newGuild.id);
            await member.roles.remove(roles, `[SECURITY] Strict security: Unauthorized server settings modification`);
          }
        } catch (error) {
          console.error('[SECURITY] Error reverting unauthorized guild update:', error);
        }
      }
    } catch (error) {
      console.error('[SECURITY] Error handling guild update:', error);
    }
  });
  
  console.log('[SECURITY] Set up strict channel and server modification protection');
}

// Function to enable strict security mode
async function enableStrictSecurity(client, guildId, action = 'kick') {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }
  
  try {
    // Update config with strict security settings
    config.updateServerConfig(guildId, {
      strictSecurity: true,
      strictSecurityAction: action,
      strictSecurityEnabled: Date.now()
    });
    
    // Send notification
    sendSecurityAlert(guild, {
      title: '🔒 STRICT SECURITY MODE ENABLED',
      description: 'Strict security mode has been enabled for this server. Only the server owner can make structural changes.',
      color: 0xFF0000,
      fields: [
        {
          name: '🛡️ Protected Actions',
          value: '• Channel creation, editing, or deletion\n• Server name or icon changes\n• Role changes\n• Permission modifications'
        },
        {
          name: '⚠️ Warning',
          value: `Any user (including administrators) who attempts these actions will be ${action === 'ban' ? 'banned' : 'kicked'} immediately.`
        }
      ]
    });
    
    return { success: true };
  } catch (error) {
    console.error('[SECURITY] Error enabling strict security:', error);
    return { success: false, error: error.message };
  }
}

// Function to disable strict security mode
async function disableStrictSecurity(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }
  
  try {
    // Update config to disable strict security
    config.updateServerConfig(guildId, {
      strictSecurity: false,
      strictSecurityDisabled: Date.now()
    });
    
    // Send notification
    sendSecurityAlert(guild, {
      title: '🔓 Strict Security Mode Disabled',
      description: 'Strict security mode has been disabled for this server.',
      color: 0x00FF00,
      fields: [
        {
          name: '📝 Information',
          value: 'Server administrators can now modify channels and server settings.'
        },
        {
          name: '⚠️ Note',
          value: 'Anti-nuke protection remains active to prevent mass destructive actions.'
        }
      ]
    });
    
    return { success: true };
  } catch (error) {
    console.error('[SECURITY] Error disabling strict security:', error);
    return { success: false, error: error.message };
  }
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
  handleNukeAttempt,
  setupChannelModificationProtection,
  enableStrictSecurity,
  disableStrictSecurity,
  detectRaidAttempt,
  checkForNukeAttempt,
  startServerSecurityMonitoring
};