// This file helps determine the correct Replit URL for the app
const fs = require('fs');
const path = require('path');

function detectReplitUrl() {
  try {
    // Check if we're in a Replit environment
    if (process.env.REPL_ID && process.env.REPL_OWNER) {
      console.log(`Detected Replit environment: ID=${process.env.REPL_ID}, Owner=${process.env.REPL_OWNER}`);
      
      // Construct base Replit URL - using the current Replit URL format
      // Use Replit-provided URL environment variables if available
      if (process.env.REPL_SLUG && process.env.REPLIT_DOMAIN) {
        const baseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAIN}`;
        console.log(`Determined Replit URL from environment: ${baseUrl}`);
        return baseUrl;
      }
      
      // Fallback to the standard format
      const hostname = process.env.REPLIT_CLUSTER_HOST || 'replit.dev';
      const slugParts = hostname.split('.');
      
      // The hostname contains the project slug as the first subdomain
      if (slugParts.length >= 3) {
        const baseUrl = `https://${hostname}`;
        console.log(`Determined Replit URL from hostname: ${baseUrl}`);
        return baseUrl;
      }
      
      // The most reliable approach in Replit is to use webview URL
      console.log('Replit environment detected - using webview URL');
      return 'https://5000-' + process.env.REPL_ID + '.' + process.env.REPL_OWNER + '.repl.co';
    } else {
      console.log('Not running in a Replit environment');
      return 'http://localhost:5000';
    }
  } catch (error) {
    console.error('Error detecting Replit URL:', error);
    return 'http://localhost:5000';
  }
}

module.exports = { detectReplitUrl };