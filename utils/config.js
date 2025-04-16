const fs = require('fs');
const path = require('path');

// Path to the config file
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// Default server configuration
const DEFAULT_SERVER_CONFIG = {
  prefix: '!',
  notificationChannelId: null,
  verificationChannelId: null,
  youtubeChannelId: null,
  youtubeChannelName: null,
  roleId: null,
  roleName: null,
  verifiedImages: {}  // Store verified images with hash as key and user info as value
};

// Function to load all configurations
function loadConfig() {
  try {
    // Check if config file exists
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      // Create default config if file doesn't exist
      const defaultConfig = {};
      saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error);
    // Return empty config on error
    return {};
  }
}

// Function to save all configurations
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

// Function to get a server's configuration
function getServerConfig(serverId) {
  const config = loadConfig();
  
  // Create default config for server if it doesn't exist
  if (!config[serverId]) {
    config[serverId] = { ...DEFAULT_SERVER_CONFIG };
    saveConfig(config);
  }
  
  return config[serverId];
}

// Function to update a server's configuration
function updateServerConfig(serverId, updates) {
  const config = loadConfig();
  
  // Create default config for server if it doesn't exist
  if (!config[serverId]) {
    config[serverId] = { ...DEFAULT_SERVER_CONFIG };
  }
  
  // Apply updates
  config[serverId] = {
    ...config[serverId],
    ...updates
  };
  
  // Save updated config
  saveConfig(config);
  
  return config[serverId];
}

module.exports = {
  loadConfig,
  saveConfig,
  getServerConfig,
  updateServerConfig
};
