const config = require('../utils/config');
const youtubeAPI = require('../utils/youtubeAPI');
const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'setvoicechannelname',
  description: 'Customizes the format of the subscriber count voice channel name',
  usage: '/setvoicechannelname [format]',
  options: [
    {
      name: 'format',
      type: 3, // STRING type
      description: 'Format for voice channel name',
      required: true
    }
  ],
  data: new SlashCommandBuilder()
    .setName('setvoicechannelname')
    .setDescription('Customizes the format of the subscriber count voice channel name')
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Format for voice channel name with placeholders: {channel}, {count}, {short_count}')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  guildOnly: true, // This command can only be used in servers
  
  async execute(message, args, client, interaction = null) {
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    let format, serverId, serverConfig;
    
    try {
      if (isSlashCommand) {
        // Slash command handling
        await interaction.deferReply();
        
        serverId = interaction.guild.id;
        serverConfig = config.getServerConfig(serverId);
        format = interaction.options.getString('format');
        
        // Display current format if requested
        if (format === 'show') {
          const currentFormat = serverConfig.voiceChannelFormat || '📊 {channel}: {count} subs';
          await interaction.followUp({
            embeds: [{
              title: '🔊 Voice Channel Name Format',
              description: `The current voice channel name format is:\n\`${currentFormat}\`\n\nAvailable placeholders:\n• \`{channel}\` - YouTube channel name\n• \`{count}\` - Subscriber count\n• \`{short_count}\` - Shortened count (e.g., 1.5M)\n\nExample: \`📊 {channel}: {count} subs\``,
              color: 0x7289DA
            }]
          });
          return;
        }
        
        // Validate format contains at least one placeholder
        if (!format.includes('{count}') && !format.includes('{short_count}') && !format.includes('{channel}')) {
          return interaction.followUp('❌ The format must include at least one placeholder: `{channel}`, `{count}`, or `{short_count}`.');
        }
        
        // Check if format is too long for a Discord channel name (max 100 characters)
        if (format.length > 90) {
          return interaction.followUp('❌ The format is too long. Discord channel names can\'t exceed 100 characters.');
        }
        
        // Update config
        config.updateServerConfig(serverId, { voiceChannelFormat: format });
        
        // Update the voice channel if it exists
        if (serverConfig.subCountChannelId) {
          updateSubCountChannel(client, serverId).catch(error => {
            console.error('Error updating voice channel after format change:', error);
          });
        }
        
        return interaction.followUp(`✅ Voice channel name format updated to: \`${format}\``);
        
      } else {
        // Legacy message command handling
        // Check if user has admin permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply('❌ You need to have Administrator permissions to use this command.');
        }
        
        serverId = message.guild.id;
        serverConfig = config.getServerConfig(serverId);
        
        // Display current format if no arguments provided
        if (!args.length) {
          const currentFormat = serverConfig.voiceChannelFormat || '📊 {channel}: {count} subs';
          return message.reply({
            embeds: [{
              title: '🔊 Voice Channel Name Format',
              description: `The current voice channel name format is:\n\`${currentFormat}\`\n\nAvailable placeholders:\n• \`{channel}\` - YouTube channel name\n• \`{count}\` - Subscriber count\n• \`{short_count}\` - Shortened count (e.g., 1.5M)\n\nExample: \`📊 {channel}: {count} subs\``,
              color: 0x7289DA
            }]
          });
        }
        
        // Join args to get the full format
        format = args.join(' ');
        
        // Validate format contains at least one placeholder
        if (!format.includes('{count}') && !format.includes('{short_count}') && !format.includes('{channel}')) {
          return message.reply('❌ The format must include at least one placeholder: `{channel}`, `{count}`, or `{short_count}`.');
        }
        
        // Check if format is too long for a Discord channel name (max 100 characters)
        if (format.length > 90) {
          return message.reply('❌ The format is too long. Discord channel names can\'t exceed 100 characters.');
        }
        
        // Update config
        config.updateServerConfig(serverId, { voiceChannelFormat: format });
        
        // Update the voice channel if it exists
        if (serverConfig.subCountChannelId) {
          updateSubCountChannel(client, serverId).catch(error => {
            console.error('Error updating voice channel after format change:', error);
          });
        }
        
        return message.reply(`✅ Voice channel name format updated to: \`${format}\``);
      }
    } catch (error) {
      console.error('Error in setVoiceChannelName command:', error);
      const responseMsg = `❌ An error occurred: ${error.message}`;
      
      if (isSlashCommand) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: responseMsg, ephemeral: true });
        } else {
          await interaction.followUp({ content: responseMsg, ephemeral: true });
        }
      } else if (message) {
        await message.reply(responseMsg);
      }
    }
  },
};

/**
 * Updates the subscriber count voice channel with the latest count
 * @param {object} client Discord client
 * @param {string} serverId Discord server ID
 */
async function updateSubCountChannel(client, serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    
    if (!serverConfig.youtubeChannelId || !serverConfig.subCountChannelId) {
      return;
    }
    
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return;
    
    // Get the channel
    const voiceChannel = guild.channels.cache.get(serverConfig.subCountChannelId);
    if (!voiceChannel) {
      console.log(`Voice channel ${serverConfig.subCountChannelId} not found for server ${serverId}`);
      return;
    }
    
    // Get channel info from YouTube
    const channelInfo = await youtubeAPI.getChannelInfo(serverConfig.youtubeChannelId);
    if (!channelInfo) {
      console.log(`Could not get info for YouTube channel ${serverConfig.youtubeChannelId}`);
      return;
    }
    
    // Format the channel name using the custom format or default
    const channelName = formatSubCountChannelName(channelInfo, serverConfig);
    
    // Update the channel name
    await voiceChannel.setName(channelName);
    console.log(`Updated voice channel name to: ${channelName}`);
  } catch (error) {
    console.error('Error updating subscriber count channel:', error);
  }
}

/**
 * Formats the subscriber count channel name based on the server's format setting
 * @param {object} channelInfo YouTube channel info
 * @param {object} serverConfig Server configuration
 * @returns {string} Formatted channel name
 */
function formatSubCountChannelName(channelInfo, serverConfig) {
  const format = serverConfig.voiceChannelFormat || '📊 {channel}: {count} subs';
  const channelName = channelInfo.title;
  const subCount = channelInfo.subscriberCount || 0;
  
  // Format shortened count (e.g., 1.5M, 100K)
  let shortCount;
  if (subCount >= 1000000) {
    shortCount = (subCount / 1000000).toFixed(1) + 'M';
  } else if (subCount >= 1000) {
    shortCount = (subCount / 1000).toFixed(1) + 'K';
  } else {
    shortCount = subCount.toString();
  }
  
  // Replace placeholders
  return format
    .replace('{channel}', channelName)
    .replace('{count}', subCount.toLocaleString())
    .replace('{short_count}', shortCount);
}

module.exports.updateSubCountChannel = updateSubCountChannel;