const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');
const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'livesubcount',
  description: 'Creates a private voice channel to display live subscriber count',
  usage: '!livesubcount',
  async execute(message, args, client, interaction = null) {
    const isSlashCommand = !!interaction;
    
    // Handle different sources (slash command or message)
    const user = isSlashCommand ? interaction.user : message.author;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    // Early exit if not in a guild/server
    if (!guild) {
      const response = '❌ This command must be used in a server to manage voice channels!';
      
      if (isSlashCommand) {
        // Check if we need to defer first
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        return interaction.followUp({ content: response, ephemeral: true });
      } else {
        return message.reply(response);
      }
    }
    
    // Get the member for permission checking
    let member;
    try {
      member = guild.members.cache.get(user.id);
    } catch (err) {
      console.error("Error getting member:", err);
      
      const errorMsg = "❌ Error: Couldn't verify your server permissions. Please try again.";
      if (isSlashCommand) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        return interaction.followUp({ content: errorMsg, ephemeral: true });
      } else {
        return message.reply(errorMsg);
      }
    }
    
    // Check if user has admin permissions
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const permError = '❌ You need administrator permissions to use this command.';
      
      if (isSlashCommand) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        return interaction.followUp({ content: permError, ephemeral: true });
      } else {
        return message.reply(permError);
      }
    }

    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);

    // Check if YouTube channel is configured
    if (!serverConfig.youtubeChannelId) {
      const noChannelMsg = '❌ YouTube channel not set. Please use `/setyoutubechannel` first.';
      
      if (isSlashCommand) {
        return interaction.followUp({ content: noChannelMsg, ephemeral: true });
      } else {
        return message.reply(noChannelMsg);
      }
    }

    try {
      // Check if bot has necessary permissions
      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        const permMsg = '❌ I need "Manage Channels" permission to create a subscriber count channel.';
        
        if (isSlashCommand) {
          return interaction.followUp({ content: permMsg, ephemeral: true });
        } else {
          return message.reply(permMsg);
        }
      }

      // Get channel info and subscriber count
      const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
      console.log('Channel info for subscriber count:', channelInfo);

      if (!channelInfo || !channelInfo.title) {
        const errorMsg = '❌ Could not retrieve channel information. Please check the YouTube channel ID.';
        
        if (isSlashCommand) {
          return interaction.followUp({ content: errorMsg, ephemeral: true });
        } else {
          return message.reply(errorMsg);
        }
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
          subCountChannel = await guild.channels.fetch(serverConfig.subCountChannelId);
          // Update channel name with current count
          await subCountChannel.setName(channelName);
          
          const successMsg = `✅ Updated subscriber count channel: ${channelName}`;
          if (isSlashCommand) {
            await interaction.followUp({ content: successMsg, ephemeral: false });
          } else {
            await message.reply(successMsg);
          }
        } catch (error) {
          console.error('Error updating existing subscriber count channel:', error);
          // If channel doesn't exist anymore, create a new one
          subCountChannel = null;
        }
      }

      // Create a new channel if needed
      if (!subCountChannel) {
        // Create a new voice channel
        subCountChannel = await guild.channels.create({
          name: channelName,
          type: 2, // Voice channel type
          permissionOverwrites: [
            {
              // Deny connect permission for @everyone to make it view-only
              id: guild.id,
              deny: [PermissionsBitField.Flags.Connect]
            }
          ]
        });

        // Save the channel ID in config
        config.updateServerConfig(serverId, { subCountChannelId: subCountChannel.id });
        
        const createMsg = `✅ Created subscriber count channel: ${channelName}\nThe count will be updated every hour.`;
        if (isSlashCommand) {
          await interaction.followUp({ content: createMsg, ephemeral: false });
        } else {
          await message.reply(createMsg);
        }
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
          const currentGuild = client.guilds.cache.get(serverId);
          if (!currentGuild) {
            console.log(`Guild ${serverId} not found for subscriber count update`);
            return;
          }
          
          const channel = await currentGuild.channels.fetch(serverConfig.subCountChannelId);
          if (channel) {
            const freshInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
            // Get the format from config
            const currentConfig = config.getServerConfig(serverId);
            const format = currentConfig.voiceChannelFormat || '📊 {channelName}: {subCount} subs';
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
      const errorMsg = `❌ An error occurred: ${error.message}`;
      
      if (isSlashCommand) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        await interaction.followUp({ content: errorMsg, ephemeral: true });
      } else {
        await message.reply(errorMsg);
      }
    }
  },
};