require('dotenv').config();
const fs = require('fs');

// Get Discord bot token and extract the client ID from it
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Error: No Discord token found in .env file');
  console.log('Please make sure your DISCORD_TOKEN is set in the .env file');
  process.exit(1);
}

// Extract the client ID from the token (first part before the first dot)
let clientId;
try {
  clientId = token.split('.')[0];
  // Convert from base64 if needed
  if (clientId.length > 18) {
    const buff = Buffer.from(clientId, 'base64');
    clientId = buff.toString('ascii');
  }
} catch (error) {
  console.error('Error extracting client ID from token:', error);
  console.log('Please add your CLIENT_ID directly to the .env file');
  process.exit(1);
}

// Define the permissions needed
const permissions = [
  // General permissions
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'USE_EXTERNAL_EMOJIS',
  
  // Voice permissions
  'CONNECT',
  'SPEAK',
  
  // Moderation permissions
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MANAGE_MESSAGES',
  
  // For role management
  'MANAGE_ROLES',
  
  // For verification system
  'MANAGE_CHANNELS',
];

// Calculate the permission integer
let permissionInteger = 0;
const PERMISSION_FLAGS = {
  'ADMINISTRATOR': 1 << 3,
  'VIEW_CHANNEL': 1 << 10,
  'MANAGE_CHANNELS': 1 << 4,
  'MANAGE_ROLES': 1 << 28,
  'MANAGE_MESSAGES': 1 << 13,
  'KICK_MEMBERS': 1 << 1,
  'BAN_MEMBERS': 1 << 2,
  'SEND_MESSAGES': 1 << 11,
  'EMBED_LINKS': 1 << 14,
  'ATTACH_FILES': 1 << 15,
  'READ_MESSAGE_HISTORY': 1 << 16,
  'USE_EXTERNAL_EMOJIS': 1 << 18,
  'CONNECT': 1 << 20,
  'SPEAK': 1 << 21,
};

for (const permission of permissions) {
  if (PERMISSION_FLAGS[permission]) {
    permissionInteger |= PERMISSION_FLAGS[permission];
  }
}

// Alternative: Use Administrator permission (includes all permissions)
// permissionInteger = PERMISSION_FLAGS['ADMINISTRATOR'];

// Generate the invite URL
const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissionInteger}&scope=bot%20applications.commands`;

console.log('\n===============================');
console.log('PHANTOM GUARD BOT INVITE LINK');
console.log('===============================\n');
console.log(`Client ID: ${clientId}`);
console.log('\nInvite URL:');
console.log(inviteUrl);
console.log('\n===============================');
console.log('Instructions:');
console.log('1. Copy the above URL');
console.log('2. Open it in your web browser');
console.log('3. Select the server you want to add the bot to');
console.log('4. Authorize the bot with the requested permissions');
console.log('5. Complete any verification steps if required');
console.log('===============================\n');

// Save to a file for easy access
fs.writeFileSync('bot-invite-link.txt', `PHANTOM GUARD BOT INVITE LINK

Client ID: ${clientId}

Invite URL:
${inviteUrl}

Instructions:
1. Copy the above URL
2. Open it in your web browser
3. Select the server you want to add the bot to
4. Authorize the bot with the requested permissions
5. Complete any verification steps if required
`);

console.log('Invite link also saved to bot-invite-link.txt');