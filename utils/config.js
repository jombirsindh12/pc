const fs = require('fs');
const path = require('path');

// Path to the config and server config directories
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const GLOBAL_CONFIG_FILE = path.join(CONFIG_DIR, 'global.json');
const SERVER_CONFIG_DIR = path.join(CONFIG_DIR, 'servers');

// Default server configuration
const DEFAULT_SERVER_CONFIG = {
  prefix: '!',
  notificationChannelId: null,
  verificationChannelId: null,
  youtubeChannelId: null,
  youtubeChannelName: null,
  roleId: null,
  roleName: null,
  verifiedImages: {},  // Store verified images with hash as key and user info as value
  premium: false,
  welcomeEnabled: false,
  welcomeChannelId: null,
  logChannelId: null,
  announcerEnabled: false,
  announcerChannelId: null,
  gameEnabled: false,
  giveawaysEnabled: false,
  pollsEnabled: false,
  gameChannelId: null,
  embedTemplates: {},
  antiNuke: false,
  antiNukeThreshold: 3,
  verificationRequired: false,
  autoModeration: false,
  punishmentType: 'ban',
  whitelistedRoles: [],
  imageVerification: true
};

// Ensure config directories exist
function ensureDirectories() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(SERVER_CONFIG_DIR)) {
    fs.mkdirSync(SERVER_CONFIG_DIR, { recursive: true });
  }
}

// Function to load global configuration
function loadConfig() {
  ensureDirectories();
  
  try {
    // Check if global config file exists
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const data = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      // Create default global config if file doesn't exist
      const defaultConfig = {
        botName: "Phantom Guard",
        version: "1.0.0",
        defaultPrefix: "!",
        ownerIds: []
      };
      saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading global config:', error);
    
    // Log specific error details
    if (error.code === 'ENOENT') {
      console.error('Config file not found at path:', GLOBAL_CONFIG_FILE);
    } else if (error.code === 'EACCES') {
      console.error('Permission denied when accessing config file:', GLOBAL_CONFIG_FILE);
    } else if (error instanceof SyntaxError) {
      console.error('Invalid JSON in config file');
    }
    
    // Return default config on error
    return {
      botName: "Phantom Guard",
      version: "1.0.0",
      defaultPrefix: "!",
      ownerIds: []
    };
  }
}

// Function to save global configuration
function saveConfig(config) {
  ensureDirectories();
  
  try {
    fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving global config:', error);
    
    // Log specific error details
    if (error.code === 'ENOENT') {
      console.error('Directory not found when saving config');
    } else if (error.code === 'EACCES') {
      console.error('Permission denied when saving config file');
    }
    
    return false;
  }
}

// Function to get a server's configuration
function getServerConfig(serverId) {
  if (!serverId) {
    console.error('getServerConfig called with invalid serverId:', serverId);
    return { ...DEFAULT_SERVER_CONFIG };
  }
  
  ensureDirectories();
  
  const serverConfigFile = path.join(SERVER_CONFIG_DIR, `${serverId}.json`);
  
  try {
    // Check if server config file exists
    if (fs.existsSync(serverConfigFile)) {
      const data = fs.readFileSync(serverConfigFile, 'utf8');
      try {
        // Parse server config and merge with defaults to ensure all properties exist
        const serverConfig = JSON.parse(data);
        return { ...DEFAULT_SERVER_CONFIG, ...serverConfig };
      } catch (parseError) {
        console.error(`Error parsing server config for ${serverId}:`, parseError);
        
        // If file exists but is corrupt, create a new one with defaults
        const newConfig = { ...DEFAULT_SERVER_CONFIG };
        fs.writeFileSync(serverConfigFile, JSON.stringify(newConfig, null, 2), 'utf8');
        return newConfig;
      }
    } else {
      // Create new server config with defaults
      const newConfig = { ...DEFAULT_SERVER_CONFIG };
      fs.writeFileSync(serverConfigFile, JSON.stringify(newConfig, null, 2), 'utf8');
      return newConfig;
    }
  } catch (error) {
    console.error(`Error loading server config for ${serverId}:`, error);
    
    // Log specific error details
    if (error.code === 'ENOENT') {
      console.error('Server config directory not found at path:', SERVER_CONFIG_DIR);
    } else if (error.code === 'EACCES') {
      console.error('Permission denied when accessing server config file:', serverConfigFile);
    }
    
    // Return default config on error
    return { ...DEFAULT_SERVER_CONFIG };
  }
}

// Function to update a server's configuration
function updateServerConfig(serverId, updates) {
  if (!serverId) {
    console.error('updateServerConfig called with invalid serverId:', serverId);
    return { ...DEFAULT_SERVER_CONFIG };
  }
  
  ensureDirectories();
  
  const serverConfigFile = path.join(SERVER_CONFIG_DIR, `${serverId}.json`);
  
  try {
    // Get current config
    let currentConfig = getServerConfig(serverId);
    
    // Apply updates
    const updatedConfig = {
      ...currentConfig,
      ...updates
    };
    
    // Save updated config
    fs.writeFileSync(serverConfigFile, JSON.stringify(updatedConfig, null, 2), 'utf8');
    
    // Log successful update
    console.log(`Updated configuration for server ${serverId}`);
    
    return updatedConfig;
  } catch (error) {
    console.error(`Error updating server config for ${serverId}:`, error);
    
    // Log specific error details
    if (error.code === 'ENOENT') {
      console.error('Server config directory not found when updating');
    } else if (error.code === 'EACCES') {
      console.error('Permission denied when updating server config file');
    }
    
    return { ...DEFAULT_SERVER_CONFIG, ...updates };
  }
}

// Function to list all configured servers
function getAllServerIds() {
  ensureDirectories();
  
  try {
    const files = fs.readdirSync(SERVER_CONFIG_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error('Error listing server configs:', error);
    return [];
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getServerConfig,
  updateServerConfig,
  getAllServerIds,
  ensureDirectories
};
