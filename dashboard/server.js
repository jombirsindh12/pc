/**
 * Dashboard Server for Discord Bot
 * Provides a web interface for managing bot settings
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const ejs = require('ejs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Collection } = require('discord.js');
const config = require('../utils/config');

// Load environment variables
require('dotenv').config();

// Function to initialize the dashboard with the Discord client instance
function initDashboard(client) {
  const app = express();
  const PORT = process.env.DASHBOARD_PORT || 3000;

  // Setup middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "code.jquery.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        imgSrc: ["'self'", "cdn.discordapp.com", "*.discord.com", "data:"],
        connectSrc: ["'self'"]
      }
    }
  }));
  app.use(morgan('dev'));

  // Set up session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'phantom-guard-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60000 * 60 * 24 // 1 day
    }
  }));

  // Set up Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Set view engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Set static folder
  app.use(express.static(path.join(__dirname, 'public')));

  // Setup Discord OAuth2
  passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/auth/discord/callback`,
    scope: ['identify', 'guilds']
  }, function(accessToken, refreshToken, profile, done) {
    // Store the user profile in the session
    process.nextTick(function() {
      return done(null, profile);
    });
  }));

  // Serialize and deserialize user
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  // Auth routes
  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
  }), (req, res) => {
    res.redirect('/dashboard');
  });

  app.get('/logout', (req, res) => {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

  // Middleware to check if user is authenticated
  const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/discord');
  };

  // Routes
  app.get('/', (req, res) => {
    res.render('index', {
      user: req.user,
      client: client
    });
  });

  app.get('/dashboard', checkAuth, (req, res) => {
    // Get the servers the user is in that also have the bot
    const guilds = req.user.guilds.filter(g => {
      // Check if user has admin permissions in the server (Manage Server permission)
      const hasPermission = (g.permissions & 0x20) === 0x20;
      // Check if the bot is in this server
      const botInGuild = client.guilds.cache.has(g.id);
      return hasPermission && botInGuild;
    });

    res.render('dashboard', {
      user: req.user,
      guilds: guilds,
      client: client
    });
  });

  app.get('/dashboard/:guildId', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    
    // Check if the guild exists and the user has permission
    if (!guild) {
      return res.redirect('/dashboard');
    }

    // Check if user has permission in this server
    const userGuild = req.user.guilds.find(g => g.id === req.params.guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) {
      return res.redirect('/dashboard');
    }

    const serverConfig = config.getServerConfig(guild.id);
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => {
      return {
        id: c.id,
        name: c.name
      };
    });
    const roles = guild.roles.cache.map(r => {
      return {
        id: r.id,
        name: r.name,
        color: r.color
      };
    });

    res.render('guild', {
      user: req.user,
      guild: guild,
      serverConfig: serverConfig,
      channels: channels,
      roles: roles,
      client: client
    });
  });

  // API routes for updating bot settings
  app.post('/api/:guildId/updateSettings', checkAuth, (req, res) => {
    const { guildId } = req.params;
    const { setting, value } = req.body;

    // Verify the user has permission
    const userGuild = req.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) {
      return res.status(403).json({ error: 'You do not have permission to change settings for this server' });
    }

    // Update the setting
    try {
      const updatedSettings = {};
      updatedSettings[setting] = value;
      config.updateServerConfig(guildId, updatedSettings);
      
      return res.json({ success: true, message: 'Setting updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ error: 'Failed to update setting' });
    }
  });

  // Premium features API
  app.get('/api/:guildId/premium', checkAuth, (req, res) => {
    const { guildId } = req.params;
    
    // Verify the user has permission
    const userGuild = req.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) {
      return res.status(403).json({ error: 'You do not have permission to view premium status for this server' });
    }

    // Get premium status
    const serverConfig = config.getServerConfig(guildId);
    const premiumStatus = serverConfig.premium || false;
    const premiumFeatures = serverConfig.premiumFeatures || [];

    return res.json({
      premium: premiumStatus,
      features: premiumFeatures
    });
  });

  // Start the server
  const server = app.listen(PORT, () => {
    console.log(`Dashboard is running on port ${PORT}`);
  });

  return {
    app,
    server
  };
}

module.exports = { initDashboard };