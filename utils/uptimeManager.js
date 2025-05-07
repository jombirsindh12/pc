/**
 * Uptime management for 24/7 operation
 * This utility helps keep the bot running continuously by integrating with UptimeRobot
 * and implementing advanced reconnection logic
 */
const http = require('http');
const url = require('url');

// Keep track of the bot's uptime
let startTime;
let pingCount = 0;
let client;

/**
 * Configure uptime and reconnection management for the Discord bot
 * @param {Client} client - Discord.js client instance
 */
function setupUptimeManager(discordClient) {
  client = discordClient;
  startTime = new Date();
  
  // Set up disconnect handling
  client.on('disconnect', (event) => {
    console.log(`[UptimeManager] Bot disconnected with code ${event.code}. Reason: ${event.reason}`);
    console.log('[UptimeManager] Attempting to reconnect automatically...');
  });
  
  client.on('reconnecting', () => {
    console.log('[UptimeManager] Bot is reconnecting to Discord...');
  });
  
  client.on('resume', (replayed) => {
    console.log(`[UptimeManager] Bot reconnected. ${replayed} events replayed.`);
  });
  
  client.on('error', (error) => {
    console.error('[UptimeManager] Discord client error:', error);
  });
  
  // Log when we're ready
  client.once('ready', () => {
    console.log(`[UptimeManager] Bot reconnected: ${client.user.tag}`);
  });
  
  // Handle process-level errors to prevent crashes
  process.on('uncaughtException', (error) => {
    console.error('[UptimeManager] Uncaught exception:', error);
  });
  
  process.on('unhandledRejection', (error) => {
    console.error('[UptimeManager] Unhandled promise rejection:', error);
  });
  
  console.log('[UptimeManager] Setting up uptime manager for 24/7 operation');
  
  // Start the uptime HTTP server on port 6872
  const server = createUptimeServer();
  server.listen(6872, '0.0.0.0', () => {
    console.log('Enhanced uptime monitoring server running on port 6872');
    console.log('Bot is configured for 24/7 operation with automatic reconnection');
  });
}

/**
 * Create an extended HTTP server with health checks and status endpoints
 * This allows services like UptimeRobot to ping the bot and keep it running
 * @returns {http.Server} HTTP server instance
 */
function createUptimeServer() {
  // Create a more robust HTTP server
  const server = http.createServer((req, res) => {
    const route = url.parse(req.url).pathname;
    pingCount++;
    
    // Basic health endpoint
    if (route === '/health' || route === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      // Calculate uptime
      const uptime = Math.floor((new Date() - startTime) / 1000);
      const uptimeStr = formatUptime(uptime);
      
      res.end(JSON.stringify({
        status: 'online',
        uptime: uptimeStr,
        botUser: client && client.user ? client.user.tag : 'Not logged in',
        pingCount: pingCount,
        serverCount: client && client.guilds ? client.guilds.cache.size : 0,
        message: 'Discord Bot is running!'
      }));
    // Bot status endpoint
    } else if (route === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      // Collect some useful stats
      const guildCount = client && client.guilds ? client.guilds.cache.size : 0;
      const guildNames = client && client.guilds ? Array.from(client.guilds.cache.values()).map(g => g.name) : [];
      
      res.end(JSON.stringify({
        online: client && client.user ? true : false,
        username: client && client.user ? client.user.username : 'Not logged in',
        discriminator: client && client.user ? client.user.discriminator : '0000',
        guildCount: guildCount,
        guildNames: guildNames,
        commandCount: client && client.commands ? client.commands.size : 0,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        uptimeSecs: Math.floor((new Date() - startTime) / 1000)
      }));
    // Special endpoint for UptimeRobot service - optimized for monitoring
    } else if (route === '/uptimerobot') {
      // Send a very quick response for ping services
      res.writeHead(200, { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end('OK');
    // Interface for UptimeRobot or similar services
    } else if (route === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('pong');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('[UptimeManager] HTTP server error:', err);
    
    // Try to recover by restarting the server if it crashes
    if (err.code === 'EADDRINUSE') {
      console.log('[UptimeManager] Port already in use, trying again in 10 seconds...');
      setTimeout(() => {
        server.close();
        server.listen(6872, '0.0.0.0');
      }, 10000);
    }
  });
  
  return server;
}

/**
 * Helper function to format uptime in a human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
  setupUptimeManager,
  createUptimeServer,
  formatUptime
};