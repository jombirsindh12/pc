/**
 * Configuration Manager for Discord Bot
 * 
 * Handles per-server configuration storage and access.
 * Configurations are stored in both memory and on disk.
 */

const fs = require('fs');
const path = require('path');

// Cache server configs in memory
const serverConfigs = new Map();

// Directory for server config files
const configDir = path.join(process.cwd(), 'config', 'servers');

// Global config file
const globalConfigPath = path.join(process.cwd(), 'config', 'global.json');

// Global config defaults
const DEFAULT_GLOBAL_CONFIG = {
  botName: '👑 Phantom Guard',
  version: '1.5.0',
  defaultPrefix: '!',
  ownerIds: [],
  premiumServers: []
};

// Per-server config defaults
const DEFAULT_SERVER_CONFIG = {
  prefix: '!',
  welcomeEnabled: false,
  securityEnabled: true, 
  securityDisabled: false,
  antiRaidEnabled: true,
  antiRaidDisabled: false,
  antiSpamEnabled: true,
  antiSpamDisabled: false,
  antiScamEnabled: true,
  antiScamDisabled: false,
  securityOwnerOnly: true, // Only owner can change security settings
  antiNukeThreshold: 3, // Number of suspicious actions to trigger anti-nuke
  antiNukeEnabled: true,
  antiNukeDisabled: false
};

// Ensure config directories exist
function ensureConfigDirs() {
  if (!fs.existsSync(path.join(process.cwd(), 'config'))) {
    fs.mkdirSync(path.join(process.cwd(), 'config'));
  }
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
}

// Load global config
function loadGlobalConfig() {
  ensureConfigDirs();
  
  let globalConfig = { ...DEFAULT_GLOBAL_CONFIG };
  
  try {
    if (fs.existsSync(globalConfigPath)) {
      const fileData = fs.readFileSync(globalConfigPath, 'utf8');
      const loadedConfig = JSON.parse(fileData);
      globalConfig = { ...globalConfig, ...loadedConfig };
    } else {
      // Create default global config
      fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      console.log('Created default global config file');
    }
  } catch (error) {
    console.error('Error loading global config:', error);
  }
  
  return globalConfig;
}

// Save global config
function saveGlobalConfig(config) {
  ensureConfigDirs();
  
  try {
    fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving global config:', error);
    return false;
  }
}

// Get server config
function getServerConfig(serverId) {
  // Return from cache if available
  if (serverConfigs.has(serverId)) {
    return serverConfigs.get(serverId);
  }
  
  // Load from disk
  let config = { ...DEFAULT_SERVER_CONFIG };
  
  try {
    ensureConfigDirs();
    
    const configPath = path.join(configDir, `${serverId}.json`);
    
    if (fs.existsSync(configPath)) {
      const fileData = fs.readFileSync(configPath, 'utf8');
      const loadedConfig = JSON.parse(fileData);
      config = { ...config, ...loadedConfig };
    }
  } catch (error) {
    console.error(`Error loading config for server ${serverId}:`, error);
  }
  
  // Cache the config
  serverConfigs.set(serverId, config);
  
  return config;
}

// Update server config
function updateServerConfig(serverId, updates) {
  // Get current config
  const currentConfig = getServerConfig(serverId);
  
  // Merge updates
  const updatedConfig = { ...currentConfig, ...updates };
  
  // Save to cache
  serverConfigs.set(serverId, updatedConfig);
  
  // Save to disk
  try {
    ensureConfigDirs();
    
    const configPath = path.join(configDir, `${serverId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
    
    return true;
  } catch (error) {
    console.error(`Error saving config for server ${serverId}:`, error);
    return false;
  }
}

// Check if a user is a bot owner
function isBotOwner(userId) {
  if (!userId) return false;
  
  // Hard-coded owner ID for maximum reliability
  if (userId === '1155442418309673000') {
    return true;
  }
  
  // Check for owner ID in environment variables
  if (process.env.BOT_OWNER_ID && userId === process.env.BOT_OWNER_ID) {
    return true;
  }
  
  // Check for specific username identifier (a method previously used in commands)
  if (userId.includes('2007')) {
    return true;
  }
  
  // Check the global config
  const globalConfig = loadGlobalConfig();
  return globalConfig.ownerIds.includes(userId);
}

// Get premium status for a server
function isPremiumServer(serverId) {
  const globalConfig = loadGlobalConfig();
  return globalConfig.premiumServers.includes(serverId);
}

// Set premium status for a server
function setPremiumStatus(serverId, isPremium) {
  const globalConfig = loadGlobalConfig();
  
  if (isPremium && !globalConfig.premiumServers.includes(serverId)) {
    globalConfig.premiumServers.push(serverId);
    saveGlobalConfig(globalConfig);
    return true;
  }
  
  if (!isPremium && globalConfig.premiumServers.includes(serverId)) {
    globalConfig.premiumServers = globalConfig.premiumServers.filter(id => id !== serverId);
    saveGlobalConfig(globalConfig);
    return true;
  }
  
  return false;
}

// Export config functions
module.exports = {
  getServerConfig,
  updateServerConfig,
  loadGlobalConfig,
  saveGlobalConfig,
  isPremiumServer,
  setPremiumStatus,
  isBotOwner,
  DEFAULT_SERVER_CONFIG,
  DEFAULT_GLOBAL_CONFIG
};