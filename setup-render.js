/**
 * Render Deployment Setup Script
 * 
 * This script automates the setup process for deploying to Render.com.
 * It creates the necessary configuration files locally without pushing them to GitHub.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Render deployment setup...');

// Create .env.production file template
const envProductionContent = `# Discord Bot Token (Replace with your actual token in Render dashboard)
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE

# Bot Owner ID (for premium and owner-only commands)
BOT_OWNER_ID=YOUR_DISCORD_USER_ID_HERE

# YouTube API Key (needed for channel verification)
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY_HERE

# Service-specific configuration
PORT=6870
NODE_ENV=production`;

// Create render.yaml template
const renderYamlContent = `services:
  - name: phantom-guard-bot
    type: web
    plan: free
    env: node
    buildCommand: npm install
    startCommand: node -r dotenv/config index.js dotenv_config_path=.env.production
    healthCheckPath: /
    envVars:
      - key: DISCORD_TOKEN
        sync: false
      - key: BOT_OWNER_ID
        sync: false
      - key: YOUTUBE_API_KEY
        sync: false
      - key: PORT
        value: 6870
      - key: NODE_ENV
        value: production
    autoDeploy: true`;

// Create the files
try {
  // Write .env.production
  fs.writeFileSync('.env.production', envProductionContent);
  console.log('✅ Created .env.production template');

  // Write render.yaml
  fs.writeFileSync('render.yaml', renderYamlContent);
  console.log('✅ Created render.yaml configuration');

  // Add these files to .gitignore to prevent pushing them
  let gitignoreContent = '';
  try {
    gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  } catch (err) {
    console.log('⚠️ No .gitignore file found, creating new one');
  }

  // Check if these files are already in .gitignore
  if (!gitignoreContent.includes('.env.production')) {
    gitignoreContent += '\n# Render deployment files\n.env.production\n';
  }
  
  fs.writeFileSync('.gitignore', gitignoreContent);
  console.log('✅ Updated .gitignore to exclude sensitive files');

  console.log('\n🎉 Render deployment setup complete!');
  console.log('\n📋 INSTRUCTIONS:');
  console.log('1. Do NOT push .env.production to GitHub');
  console.log('2. When deploying to Render, manually set your environment variables:');
  console.log('   - DISCORD_TOKEN: Your Discord bot token');
  console.log('   - BOT_OWNER_ID: Your Discord user ID');
  console.log('   - YOUTUBE_API_KEY: Your YouTube API key');
  console.log('\n3. Push only render.yaml to GitHub if needed');
  console.log('4. Follow the Render deployment guide in RENDER_DEPLOYMENT.md');

} catch (error) {
  console.error('❌ Error setting up Render deployment:', error);
}