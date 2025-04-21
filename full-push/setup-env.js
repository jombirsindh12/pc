/**
 * Environment Setup Utility
 * 
 * This script helps with automatic environment variable configuration
 * for different deployment environments.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load the base .env file if it exists
try {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
  console.log('✅ Base .env configuration loaded');
} catch (error) {
  console.log('❌ No base .env file found, using system environment variables');
}

// Determine which environment we're in
const environment = process.env.NODE_ENV || 'development';
console.log(`🔄 Setting up environment: ${environment}`);

// Try to load environment-specific config
const envFile = `.env.${environment}`;
try {
  if (fs.existsSync(envFile)) {
    const envConfig = dotenv.parse(fs.readFileSync(envFile));
    for (const key in envConfig) {
      process.env[key] = envConfig[key];
    }
    console.log(`✅ Loaded environment-specific config from ${envFile}`);
  } else {
    console.log(`⚠️ No ${envFile} file found`);
  }
} catch (error) {
  console.error(`❌ Error loading ${envFile}:`, error.message);
}

// Validate critical environment variables
const requiredVars = ['DISCORD_TOKEN', 'BOT_OWNER_ID', 'YOUTUBE_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables in your .env file or deployment environment');
} else {
  console.log('✅ All required environment variables are set');
  
  // Display partial token information for verification
  if (process.env.DISCORD_TOKEN) {
    const token = process.env.DISCORD_TOKEN;
    console.log(`🔑 Discord Token: ${token.substring(0, 6)}...${token.substring(token.length - 4)}`);
  }
  
  if (process.env.YOUTUBE_API_KEY) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    console.log(`🔑 YouTube API Key: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`);
  }
}

console.log('✨ Environment setup complete');

// Export the environment details for use in other modules
module.exports = {
  environment,
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
  isTest: environment === 'test'
};