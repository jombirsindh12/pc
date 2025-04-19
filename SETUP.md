# Phantom Guard Discord Bot - Setup Guide

This guide will help you set up the Phantom Guard bot on your own server or hosting environment.

## Prerequisites

- Node.js v16.9.0 or higher
- A Discord account and a registered Discord application with a bot
- (Optional) Google account for YouTube API features
- (Optional) PostgreSQL database for advanced data storage

## Setup Steps

### 1. Clone the Repository

First, download or clone this repository to your local machine or hosting environment.

```bash
git clone <repository-url>
cd phantom-guard-bot
```

### 2. Install Dependencies

Install all the required Node.js packages:

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file with your own values:

- `DISCORD_TOKEN`: Your Discord bot token (required)
- `CLIENT_ID`: Your Discord application client ID (required)
- `YOUTUBE_API_KEY`: Your YouTube Data API key (required for YouTube features)
- Other variables as needed

### 4. Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select your existing one
3. Go to the "Bot" section and create a bot if you haven't already
4. Enable all "Privileged Gateway Intents":
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
5. Copy your bot token and add it to your `.env` file
6. Go to the "OAuth2" section and copy your Client ID to your `.env` file

### 5. YouTube API Setup (Optional)

If you want to use YouTube features:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the "YouTube Data API v3"
4. Create an API Key
5. Add the API key to your `.env` file as `YOUTUBE_API_KEY`

### 6. Configure the Bot

The bot stores server configurations in the `config/servers` directory. These will be created automatically when the bot joins a server.

### 7. Start the Bot

Run the bot with:

```bash
node index.js
```

### 8. Invite the Bot to Your Server

1. Go to the Discord Developer Portal > OAuth2 > URL Generator
2. Select the following scopes:
   - `bot`
   - `applications.commands`
3. Select the necessary bot permissions:
   - Administrator (for all features)
   - Or select individual permissions as needed
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Multiple Server Support

Phantom Guard supports multiple servers with separate configurations for each server. Each server's settings are stored in separate files in the `config/servers` directory.

## Deploying to a Hosting Service

### Replit

1. Create a new Repl and import this repository
2. Add your environment variables in the Repl's Secrets tab
3. Run the bot with "Run" button

### Heroku

1. Create a new Heroku app
2. Connect your repository
3. Add environment variables in the Settings > Config Vars section
4. Deploy the app

### VPS or Dedicated Server

1. Follow the regular setup steps above
2. Use a process manager like PM2 to keep the bot running:

```bash
npm install -g pm2
pm2 start index.js --name phantom-guard
```

## Troubleshooting

### Bot Won't Connect

- Verify your Discord token is correct
- Ensure all Privileged Gateway Intents are enabled
- Check your internet connection

### Command Not Working

- Ensure the bot has the necessary permissions in your server
- Check the console for error messages
- Verify your server configuration is correct

### YouTube Features Not Working

- Check that your YouTube API key is correct
- Verify the API key has access to the YouTube Data API v3
- Check for any quota limitations

## Support

If you need assistance, please create an issue in the repository or contact the bot developer.

## License

This project is licensed under the MIT License - see the LICENSE file for details.