/**
 * Backup Manager for Discord Bot
 * Handles server backup operations including channels, roles, permissions, and messages
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Directory to store backups
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('Created backups directory');
  }
}

/**
 * Create a backup of a Discord server
 * @param {Object} guild - Discord.js Guild object
 * @param {Object} options - Backup options like includeMessages, etc.
 * @returns {Object} Backup result with ID and statistics
 */
async function createServerBackup(guild, options = {}) {
  try {
    ensureBackupDir();
    
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Generate backup ID
    const backupId = `BKP-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    
    // Default options
    const backupOptions = {
      includeChannels: true,
      includeRoles: true,
      includeSettings: true,
      includeMessages: options.includeMessages || false,
      messageLimit: options.messageLimit || 50, // Limit messages per channel
      ...options
    };
    
    // Backup container
    const backup = {
      backupId,
      timestamp,
      serverId: guild.id,
      serverName: guild.name,
      serverIcon: guild.iconURL(),
      options: backupOptions,
      data: {
        channels: [],
        roles: [],
        settings: {},
      }
    };
    
    // Backup roles if enabled
    if (backupOptions.includeRoles) {
      console.log(`Backing up roles for server ${guild.name}`);
      guild.roles.cache.forEach(role => {
        // Skip @everyone role
        if (role.id === guild.id) return;
        
        // Add role data to backup
        backup.data.roles.push({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          hoist: role.hoist,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          mentionable: role.mentionable,
          tags: role.tags || null
        });
      });
      
      console.log(`Backed up ${backup.data.roles.length} roles`);
    }
    
    // Backup channels if enabled
    if (backupOptions.includeChannels) {
      console.log(`Backing up channels for server ${guild.name}`);
      
      // Get all channels
      const allChannels = [...guild.channels.cache.values()];
      
      // Organize by category and type
      const categories = allChannels.filter(channel => channel.type === 4); // GUILD_CATEGORY
      const textChannels = allChannels.filter(channel => channel.type === 0); // GUILD_TEXT
      const voiceChannels = allChannels.filter(channel => channel.type === 2); // GUILD_VOICE
      const forumChannels = allChannels.filter(channel => channel.type === 15); // GUILD_FORUM
      const threads = allChannels.filter(channel => [
        10, // PUBLIC_THREAD
        11, // PRIVATE_THREAD
        12  // ANNOUNCEMENT_THREAD
      ].includes(channel.type));
      
      // First backup categories
      for (const category of categories) {
        const categoryData = {
          id: category.id,
          name: category.name,
          type: 'category',
          position: category.position,
          permissions: backupChannelPermissions(category)
        };
        
        backup.data.channels.push(categoryData);
      }
      
      // Then backup text channels
      for (const channel of textChannels) {
        const channelData = {
          id: channel.id,
          name: channel.name,
          type: 'text',
          nsfw: channel.nsfw,
          topic: channel.topic,
          rateLimitPerUser: channel.rateLimitPerUser,
          parentId: channel.parentId,
          position: channel.position,
          permissions: backupChannelPermissions(channel),
          messages: []
        };
        
        // Backup messages if enabled
        if (backupOptions.includeMessages) {
          try {
            const messages = await channel.messages.fetch({ limit: backupOptions.messageLimit });
            messages.forEach(msg => {
              // Skip bot messages
              if (msg.author.bot) return;
              
              channelData.messages.push({
                id: msg.id,
                content: msg.content,
                authorId: msg.author.id,
                authorTag: msg.author.tag,
                timestamp: msg.createdTimestamp,
                attachments: msg.attachments.map(a => ({
                  id: a.id,
                  name: a.name,
                  url: a.url,
                  size: a.size
                })),
                embeds: msg.embeds.map(e => ({
                  title: e.title,
                  description: e.description,
                  fields: e.fields
                }))
              });
            });
          } catch (msgError) {
            console.error(`Error backing up messages in channel ${channel.name}:`, msgError);
          }
        }
        
        backup.data.channels.push(channelData);
      }
      
      // Then backup voice channels
      for (const channel of voiceChannels) {
        const channelData = {
          id: channel.id,
          name: channel.name,
          type: 'voice',
          bitrate: channel.bitrate,
          userLimit: channel.userLimit,
          parentId: channel.parentId,
          position: channel.position,
          permissions: backupChannelPermissions(channel)
        };
        
        backup.data.channels.push(channelData);
      }
      
      // Backup forum channels
      for (const channel of forumChannels) {
        const channelData = {
          id: channel.id,
          name: channel.name,
          type: 'forum',
          topic: channel.topic,
          rateLimitPerUser: channel.rateLimitPerUser,
          parentId: channel.parentId,
          position: channel.position,
          permissions: backupChannelPermissions(channel)
        };
        
        backup.data.channels.push(channelData);
      }
      
      console.log(`Backed up ${backup.data.channels.length} channels`);
    }
    
    // Backup server settings if enabled
    if (backupOptions.includeSettings) {
      console.log(`Backing up settings for server ${guild.name}`);
      
      // Server settings
      backup.data.settings = {
        name: guild.name,
        icon: guild.iconURL(),
        banner: guild.bannerURL(),
        verificationLevel: guild.verificationLevel,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        explicitContentFilter: guild.explicitContentFilter,
        features: guild.features,
        premiumTier: guild.premiumTier,
        systemChannelId: guild.systemChannelId,
        rulesChannelId: guild.rulesChannelId,
        publicUpdatesChannelId: guild.publicUpdatesChannelId,
        preferredLocale: guild.preferredLocale
      };
      
      // Also backup the bot's configuration for this server
      backup.data.botConfig = { ...serverConfig };
      
      console.log(`Backed up server settings`);
    }
    
    // Save the backup to a file
    const backupFilePath = path.join(BACKUP_DIR, `${backupId}-${serverId}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2));
    
    // Update server config with backup info
    const serverBackups = serverConfig.backups || [];
    serverBackups.push({
      backupId,
      timestamp,
      size: backup.data.channels.length + backup.data.roles.length,
      options: backupOptions
    });
    
    // Keep only the configured number of backups
    const maxBackups = serverConfig.backupSettings?.maxBackups || 5;
    while (serverBackups.length > maxBackups) {
      const oldBackup = serverBackups.shift();
      // Try to delete the old backup file
      try {
        const oldBackupPath = path.join(BACKUP_DIR, `${oldBackup.backupId}-${serverId}.json`);
        if (fs.existsSync(oldBackupPath)) {
          fs.unlinkSync(oldBackupPath);
        }
      } catch (error) {
        console.error(`Error deleting old backup ${oldBackup.backupId}:`, error);
      }
    }
    
    // Update server config
    config.updateServerConfig(serverId, {
      backups: serverBackups,
      lastBackupId: backupId,
      lastBackupTime: timestamp
    });
    
    return {
      success: true,
      backupId,
      timestamp,
      statistics: {
        roles: backup.data.roles.length,
        channels: backup.data.channels.length,
        settings: Object.keys(backup.data.settings).length,
        size: fs.statSync(backupFilePath).size
      }
    };
  } catch (error) {
    console.error(`Error creating backup for server ${guild?.name || 'unknown'}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get backup permissions for a channel
 * @param {Object} channel - Discord.js Channel object
 * @returns {Array} Channel permission overwrites
 */
function backupChannelPermissions(channel) {
  const permissions = [];
  
  channel.permissionOverwrites.cache.forEach(overwrite => {
    permissions.push({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield.toString(),
      deny: overwrite.deny.bitfield.toString()
    });
  });
  
  return permissions;
}

/**
 * Restore a server backup
 * @param {Object} guild - Discord.js Guild object
 * @param {string} backupId - ID of the backup to restore
 * @param {Object} options - Restore options
 * @returns {Promise<Object>} Restore result
 */
async function restoreServerBackup(guild, backupId, options = {}) {
  try {
    const serverId = guild.id;
    
    // Find the backup file
    const backupFilePath = path.join(BACKUP_DIR, `${backupId}-${serverId}.json`);
    
    if (!fs.existsSync(backupFilePath)) {
      return {
        success: false,
        error: `Backup ${backupId} not found for server ${serverId}`
      };
    }
    
    // Load the backup
    const backup = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    // Validate backup
    if (backup.serverId !== serverId) {
      return {
        success: false,
        error: `Backup ${backupId} is for a different server`
      };
    }
    
    const restoreOptions = {
      clearExisting: options.clearExisting || false,
      restoreChannels: options.restoreChannels !== false,
      restoreRoles: options.restoreRoles !== false,
      restoreSettings: options.restoreSettings !== false,
      restoreMessages: false, // We don't restore messages
      ...options
    };
    
    const restoreStats = {
      rolesCreated: 0,
      rolesUpdated: 0,
      channelsCreated: 0,
      channelsUpdated: 0,
      settingsApplied: 0
    };
    
    // Restore roles if enabled
    if (restoreOptions.restoreRoles && backup.data.roles && backup.data.roles.length > 0) {
      console.log(`Restoring ${backup.data.roles.length} roles for server ${guild.name}`);
      
      // Clear existing roles if option is set
      if (restoreOptions.clearExisting) {
        const existingRoles = guild.roles.cache.filter(role => role.id !== guild.id); // Skip @everyone
        for (const role of existingRoles.values()) {
          try {
            await role.delete(`Backup restoration ${backupId}`);
          } catch (error) {
            console.error(`Error deleting role ${role.name}:`, error);
          }
        }
      }
      
      // Process roles from lowest to highest position
      const sortedRoles = [...backup.data.roles].sort((a, b) => a.position - b.position);
      
      for (const roleData of sortedRoles) {
        try {
          // Check if role already exists
          let role = guild.roles.cache.get(roleData.id);
          
          if (role) {
            // Update existing role
            await role.edit({
              name: roleData.name,
              color: roleData.color,
              hoist: roleData.hoist,
              permissions: BigInt(roleData.permissions),
              mentionable: roleData.mentionable
            }, `Backup restoration ${backupId}`);
            
            restoreStats.rolesUpdated++;
          } else {
            // Create new role
            role = await guild.roles.create({
              name: roleData.name,
              color: roleData.color,
              hoist: roleData.hoist,
              permissions: BigInt(roleData.permissions),
              mentionable: roleData.mentionable,
              reason: `Backup restoration ${backupId}`
            });
            
            restoreStats.rolesCreated++;
          }
          
          // Try to set position (this might fail due to hierarchy)
          try {
            await role.setPosition(roleData.position);
          } catch (posError) {
            console.warn(`Could not set position for role ${roleData.name}:`, posError.message);
          }
        } catch (error) {
          console.error(`Error restoring role ${roleData.name}:`, error);
        }
      }
    }
    
    // Restore channels if enabled
    if (restoreOptions.restoreChannels && backup.data.channels && backup.data.channels.length > 0) {
      console.log(`Restoring ${backup.data.channels.length} channels for server ${guild.name}`);
      
      // Clear existing channels if option is set
      if (restoreOptions.clearExisting) {
        const existingChannels = guild.channels.cache;
        for (const channel of existingChannels.values()) {
          try {
            await channel.delete(`Backup restoration ${backupId}`);
          } catch (error) {
            console.error(`Error deleting channel ${channel.name}:`, error);
          }
        }
      }
      
      // First restore categories
      const categories = backup.data.channels.filter(ch => ch.type === 'category');
      for (const categoryData of categories) {
        try {
          // Check if category already exists
          let category = guild.channels.cache.get(categoryData.id);
          
          if (!category) {
            // Create new category
            category = await guild.channels.create({
              name: categoryData.name,
              type: 4, // GUILD_CATEGORY
              permissionOverwrites: restoreChannelPermissions(categoryData.permissions, guild),
              reason: `Backup restoration ${backupId}`
            });
            
            restoreStats.channelsCreated++;
          } else {
            // Update existing category
            await category.edit({
              name: categoryData.name,
              permissionOverwrites: restoreChannelPermissions(categoryData.permissions, guild)
            });
            
            restoreStats.channelsUpdated++;
          }
          
          // Try to set position
          try {
            await category.setPosition(categoryData.position);
          } catch (posError) {
            console.warn(`Could not set position for category ${categoryData.name}:`, posError.message);
          }
        } catch (error) {
          console.error(`Error restoring category ${categoryData.name}:`, error);
        }
      }
      
      // Then restore text and voice channels
      const textChannels = backup.data.channels.filter(ch => ch.type === 'text');
      const voiceChannels = backup.data.channels.filter(ch => ch.type === 'voice');
      
      // Restore text channels
      for (const channelData of textChannels) {
        try {
          // Check if channel already exists
          let channel = guild.channels.cache.get(channelData.id);
          
          if (!channel) {
            // Create new channel
            channel = await guild.channels.create({
              name: channelData.name,
              type: 0, // GUILD_TEXT
              topic: channelData.topic,
              nsfw: channelData.nsfw,
              rateLimitPerUser: channelData.rateLimitPerUser,
              parent: channelData.parentId ? guild.channels.cache.get(channelData.parentId) : null,
              permissionOverwrites: restoreChannelPermissions(channelData.permissions, guild),
              reason: `Backup restoration ${backupId}`
            });
            
            restoreStats.channelsCreated++;
          } else {
            // Update existing channel
            await channel.edit({
              name: channelData.name,
              topic: channelData.topic,
              nsfw: channelData.nsfw,
              rateLimitPerUser: channelData.rateLimitPerUser,
              parent: channelData.parentId ? guild.channels.cache.get(channelData.parentId) : null,
              permissionOverwrites: restoreChannelPermissions(channelData.permissions, guild)
            });
            
            restoreStats.channelsUpdated++;
          }
          
          // Try to set position
          try {
            await channel.setPosition(channelData.position);
          } catch (posError) {
            console.warn(`Could not set position for channel ${channelData.name}:`, posError.message);
          }
        } catch (error) {
          console.error(`Error restoring text channel ${channelData.name}:`, error);
        }
      }
      
      // Restore voice channels
      for (const channelData of voiceChannels) {
        try {
          // Check if channel already exists
          let channel = guild.channels.cache.get(channelData.id);
          
          if (!channel) {
            // Create new channel
            channel = await guild.channels.create({
              name: channelData.name,
              type: 2, // GUILD_VOICE
              bitrate: channelData.bitrate,
              userLimit: channelData.userLimit,
              parent: channelData.parentId ? guild.channels.cache.get(channelData.parentId) : null,
              permissionOverwrites: restoreChannelPermissions(channelData.permissions, guild),
              reason: `Backup restoration ${backupId}`
            });
            
            restoreStats.channelsCreated++;
          } else {
            // Update existing channel
            await channel.edit({
              name: channelData.name,
              bitrate: channelData.bitrate,
              userLimit: channelData.userLimit,
              parent: channelData.parentId ? guild.channels.cache.get(channelData.parentId) : null,
              permissionOverwrites: restoreChannelPermissions(channelData.permissions, guild)
            });
            
            restoreStats.channelsUpdated++;
          }
          
          // Try to set position
          try {
            await channel.setPosition(channelData.position);
          } catch (posError) {
            console.warn(`Could not set position for channel ${channelData.name}:`, posError.message);
          }
        } catch (error) {
          console.error(`Error restoring voice channel ${channelData.name}:`, error);
        }
      }
    }
    
    // Restore server settings if enabled
    if (restoreOptions.restoreSettings && backup.data.settings) {
      console.log(`Restoring settings for server ${guild.name}`);
      
      try {
        await guild.edit({
          name: backup.data.settings.name,
          verificationLevel: backup.data.settings.verificationLevel,
          defaultMessageNotifications: backup.data.settings.defaultMessageNotifications,
          explicitContentFilter: backup.data.settings.explicitContentFilter,
          systemChannelId: backup.data.settings.systemChannelId,
          rulesChannelId: backup.data.settings.rulesChannelId,
          publicUpdatesChannelId: backup.data.settings.publicUpdatesChannelId,
          preferredLocale: backup.data.settings.preferredLocale
        }, `Backup restoration ${backupId}`);
        
        restoreStats.settingsApplied++;
      } catch (error) {
        console.error(`Error restoring server settings:`, error);
      }
    }
    
    // Restore bot configuration
    if (backup.data.botConfig) {
      try {
        config.updateServerConfig(serverId, backup.data.botConfig);
      } catch (configError) {
        console.error(`Error restoring bot configuration:`, configError);
      }
    }
    
    return {
      success: true,
      backupId,
      timestamp: backup.timestamp,
      statistics: restoreStats
    };
  } catch (error) {
    console.error(`Error restoring backup ${backupId} for server ${guild.name}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert backup permission format to Discord.js permission overwrites
 * @param {Array} permissions - Backup permission array
 * @param {Object} guild - Discord.js Guild object
 * @returns {Array} Discord.js permission overwrites
 */
function restoreChannelPermissions(permissions, guild) {
  return permissions.map(perm => ({
    id: perm.id,
    type: perm.type,
    allow: BigInt(perm.allow),
    deny: BigInt(perm.deny)
  }));
}

/**
 * Get list of available backups for a server
 * @param {string} serverId - Discord server ID
 * @returns {Array} List of available backups
 */
function getAvailableBackups(serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    return serverConfig.backups || [];
  } catch (error) {
    console.error(`Error getting backups for server ${serverId}:`, error);
    return [];
  }
}

/**
 * Schedule automatic backups for servers
 * @param {Object} client - Discord.js Client
 */
function scheduleAutomaticBackups(client) {
  console.log('Setting up automatic backup scheduler');
  
  // Check every hour for servers that need backups
  setInterval(async () => {
    try {
      const allConfigs = config.loadConfig();
      const now = new Date();
      
      for (const serverId in allConfigs) {
        const serverConfig = allConfigs[serverId];
        
        // Skip if backups are not enabled
        if (!serverConfig.backupEnabled) {
          continue;
        }
        
        // Get backup settings
        const backupSettings = serverConfig.backupSettings || {
          frequency: 'daily',
          includeChannels: true,
          includeRoles: true,
          includeSettings: true,
          maxBackups: 5
        };
        
        // Check if it's time for a backup
        let shouldBackup = false;
        const lastBackupTime = serverConfig.lastBackupTime ? new Date(serverConfig.lastBackupTime) : null;
        
        if (!lastBackupTime) {
          // Never backed up before
          shouldBackup = true;
        } else {
          // Check based on frequency
          const hoursSinceLastBackup = (now - lastBackupTime) / (1000 * 60 * 60);
          
          switch (backupSettings.frequency) {
            case 'hourly':
              shouldBackup = hoursSinceLastBackup >= 1;
              break;
            case 'daily':
              shouldBackup = hoursSinceLastBackup >= 24;
              break;
            case 'weekly':
              shouldBackup = hoursSinceLastBackup >= 168; // 7 days
              break;
            case 'monthly':
              shouldBackup = hoursSinceLastBackup >= 720; // 30 days
              break;
          }
        }
        
        // Create backup if needed
        if (shouldBackup) {
          console.log(`Time for automatic backup of server ${serverId}`);
          
          try {
            // Get the guild
            const guild = client.guilds.cache.get(serverId);
            if (!guild) {
              console.log(`Guild ${serverId} not found, skipping backup`);
              continue;
            }
            
            // Create backup
            const backupResult = await createServerBackup(guild, {
              includeChannels: backupSettings.includeChannels,
              includeRoles: backupSettings.includeRoles,
              includeSettings: backupSettings.includeSettings,
              includeMessages: false // Automatic backups don't include messages
            });
            
            console.log(`Automatic backup completed for ${guild.name}:`, backupResult);
            
            // Notify if there's a notification channel
            if (serverConfig.notificationChannelId) {
              try {
                const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
                
                if (notificationChannel) {
                  await notificationChannel.send({
                    embeds: [{
                      title: '💾 Automatic Backup Created',
                      description: `The server's scheduled backup has been completed.`,
                      color: 0x2ECC71,
                      fields: [
                        {
                          name: '📊 Backup Statistics',
                          value: `• Channels: ${backupResult.statistics.channels}\n• Roles: ${backupResult.statistics.roles}\n• Settings: ${backupResult.statistics.settings}`,
                          inline: true
                        },
                        {
                          name: '⏱️ Backup Details',
                          value: `• Backup ID: ${backupResult.backupId}\n• Date: ${new Date(backupResult.timestamp).toLocaleString()}\n• Type: Automatic`,
                          inline: true
                        }
                      ],
                      footer: {
                        text: 'Premium Feature • Auto-Backup System'
                      },
                      timestamp: new Date()
                    }]
                  });
                }
              } catch (notifyError) {
                console.error(`Error sending backup notification:`, notifyError);
              }
            }
          } catch (backupError) {
            console.error(`Error during automatic backup for ${serverId}:`, backupError);
          }
        }
      }
    } catch (error) {
      console.error('Error in automatic backup scheduler:', error);
    }
  }, 60 * 60 * 1000); // Check every hour
  
  console.log('Automatic backup scheduler is running');
}

module.exports = {
  createServerBackup,
  restoreServerBackup,
  getAvailableBackups,
  scheduleAutomaticBackups
};