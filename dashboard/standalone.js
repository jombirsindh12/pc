/**
 * Standalone Dashboard Server for Discord Bot
 * This file allows running the dashboard separately from the main bot
 */

require('dotenv').config({path: '../.env'});
const { Client, GatewayIntentBits } = require('discord.js');
const { initDashboard } = require('./server');

// Create a simplified client just for the dashboard
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
});

// This function checks the Discord token and starts the dashboard
async function startStandaloneDashboard() {
  try {
    // Check if the Discord token is set
    if (!process.env.DISCORD_TOKEN) {
      console.error('Discord token is missing. Please set DISCORD_TOKEN in your .env file.');
      process.exit(1);
    }

    // Check if Discord OAuth2 credentials are set
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      console.error('Discord OAuth2 credentials are missing. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in your .env file.');
      process.exit(1);
    }

    console.log('Starting standalone dashboard server...');
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`Logged in as ${client.user.tag} for dashboard access`);
    
    // Initialize dashboard after successful login
    const dashboard = initDashboard(client);
    console.log('Dashboard initialized successfully');
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Shutting down dashboard server...');
      dashboard.server.close();
      client.destroy();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start standalone dashboard:', error);
    process.exit(1);
  }
}

// Start the dashboard
startStandaloneDashboard();