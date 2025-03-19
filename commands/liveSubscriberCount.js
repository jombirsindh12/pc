const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');
const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'livesubcount',
  description: 'Creates a private voice channel to display live subscriber count',
  usage: '!livesubcount',
  async execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('❌ You need administrator permissions to use this command.');
    }

    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);

    // Check if YouTube channel is configured
    if (!serverConfig.youtubeChannelId) {
      return message.reply('❌ YouTube channel not set. Please use `!setyoutubechannel` first.');
    }

    try {
      // Check if bot has necessary permissions
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply('❌ I need "Manage Channels" permission to create a subscriber count channel.');
      }

      // Get channel info and subscriber count
      const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
      console.log('Channel info for subscriber count:', channelInfo);

      if (!channelInfo || !channelInfo.title) {
        return message.reply('❌ Could not retrieve channel information. Please check the YouTube channel ID.');
      }

      // Create or update the subscriber count channel using custom format if available
      const format = serverConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
      const channelName = format
        .replace('{channelName}', channelInfo.title)
        .replace('{subCount}', channelInfo.subscriberCount || '0');
      
      let subCountChannel;
      
      // Check if we already have a subscriber count channel saved
      if (serverConfig.subCountChannelId) {
        try {
          // Try to get existing channel
          subCountChannel = await message.guild.channels.fetch(serverConfig.subCountChannelId);
          // Update channel name with current count
          await subCountChannel.setName(channelName);
          await message.reply(`✅ Updated subscriber count channel: ${channelName}`);
        } catch (error) {
          console.error('Error updating existing subscriber count channel:', error);
          // If channel doesn't exist anymore, create a new one
          subCountChannel = null;
        }
      }

      // Create a new channel if needed
      if (!subCountChannel) {
        // Create a new voice channel
        subCountChannel = await message.guild.channels.create({
          name: channelName,
          type: 2, // Voice channel type
          permissionOverwrites: [
            {
              // Deny connect permission for @everyone to make it view-only
              id: message.guild.id,
              deny: [PermissionsBitField.Flags.Connect]
            }
          ]
        });

        // Save the channel ID in config
        config.updateServerConfig(serverId, { subCountChannelId: subCountChannel.id });
        
        await message.reply(`✅ Created subscriber count channel: ${channelName}\nThe count will be updated every hour.`);
      }

      // Set up an interval to update the subscriber count
      // Store the interval ID in a client collection to prevent duplicates
      if (!client.subCountIntervals) {
        client.subCountIntervals = new Map();
      }

      // Clear any existing interval for this server
      if (client.subCountIntervals.has(serverId)) {
        clearInterval(client.subCountIntervals.get(serverId));
      }

      // Set a new interval to update every hour
      const intervalId = setInterval(async () => {
        try {
          const channel = await message.guild.channels.fetch(serverConfig.subCountChannelId);
          if (channel) {
            const freshInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
            // Get the format from config
            const serverConfig = config.getServerConfig(serverId);
            const format = serverConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
            const newName = format
              .replace('{channelName}', freshInfo.title)
              .replace('{subCount}', freshInfo.subscriberCount || '0');
            await channel.setName(newName);
            console.log(`Updated subscriber count for ${freshInfo.title} to ${freshInfo.subscriberCount}`);
          }
        } catch (error) {
          console.error('Error updating subscriber count channel:', error);
          // If there's an error, stop the interval
          clearInterval(intervalId);
          client.subCountIntervals.delete(serverId);
        }
      }, (serverConfig.updateFrequencyMinutes || 60) * 60000); // Use configured update frequency or default to 60 minutes

      // Store the interval ID
      client.subCountIntervals.set(serverId, intervalId);

    } catch (error) {
      console.error('Error creating subscriber count channel:', error);
      message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};