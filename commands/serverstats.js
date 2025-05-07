const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'serverstats',
  description: 'Set up server statistics channels (members, online, roles, etc.)',
  usage: '/serverstats [action]',
  guildOnly: true,
  requiresAdmin: true,
  
  // Slash command data
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Set up server statistics channels (members, online, roles, etc.)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up statistics channels in a category')
        .addChannelOption(option => 
          option.setName('category')
            .setDescription('Category to create stats channels in')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('prefix')
            .setDescription('Prefix for stat channel names (default: "📊")')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Create a channel showing member count for a specific role')
        .addRoleOption(option => 
          option.setName('role')
            .setDescription('Role to track member count for')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('format')
            .setDescription('Format for the channel name. Use {role} and {count} as placeholders.')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('custom')
        .setDescription('Create a custom stat channel')
        .addStringOption(option => 
          option.setName('type')
            .setDescription('Type of stat to display')
            .setRequired(true)
            .addChoices(
              { name: 'Total Members', value: 'members' },
              { name: 'Online Members', value: 'online' },
              { name: 'Offline Members', value: 'offline' },
              { name: 'Bots', value: 'bots' },
              { name: 'Humans', value: 'humans' },
              { name: 'Voice Users', value: 'voice' },
              { name: 'Channels', value: 'channels' },
              { name: 'Roles', value: 'roles' },
              { name: 'Boosts', value: 'boosts' },
              { name: 'Boost Level', value: 'boost_level' }
            ))
        .addStringOption(option =>
          option.setName('format')
            .setDescription('Format for the channel name. Use {count} as placeholder.')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('Manually update all stat channels')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable server stats and delete all stat channels')
    ),
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Defer reply for slash commands
    if (isSlashCommand) {
      await interaction.deferReply();
    } else {
      // Legacy command handling - simplified since we're focusing on slash commands
      return message.reply('Please use the slash command `/serverstats` instead.');
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'setup':
        await setupStatsChannels(interaction, client);
        break;
      case 'role':
        await setupRoleCounter(interaction, client);
        break;
      case 'custom':
        await setupCustomCounter(interaction, client);
        break;
      case 'update':
        await updateStatsChannels(interaction, client);
        break;
      case 'disable':
        await disableStatsChannels(interaction, client);
        break;
    }
  }
};

/**
 * Set up a full suite of statistics channels in the specified category
 * @param {Object} interaction - Discord interaction object
 * @param {Object} client - Discord client
 */
async function setupStatsChannels(interaction, client) {
  const category = interaction.options.getChannel('category');
  const prefix = interaction.options.getString('prefix') || '📊';
  const serverId = interaction.guild.id;
  
  // Validate that the selected channel is a category
  if (category.type !== 4) { // 4 is the type for GUILD_CATEGORY
    return interaction.followUp('❌ Please select a category channel where stats channels will be created.');
  }
  
  try {
    const statsConfig = {
      enabled: true,
      categoryId: category.id,
      prefix: prefix,
      channels: {},
      updateInterval: 5, // Default update interval in minutes
      lastUpdate: Date.now()
    };
    
    // Get existing config to preserve any custom stats
    const serverConfig = config.getServerConfig(serverId);
    if (serverConfig.statsConfig?.channels) {
      statsConfig.channels = serverConfig.statsConfig.channels;
    }
    
    // Create basic stats channels
    const totalMembersChannel = await interaction.guild.channels.create({
      name: `${prefix} Members: ${interaction.guild.memberCount}`,
      type: 2, // GUILD_VOICE for stats channels
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect] // Prevent members from joining these voice channels
        }
      ]
    });
    
    // Store channel ID in config
    statsConfig.channels.totalMembers = {
      id: totalMembersChannel.id,
      format: `${prefix} Members: {count}`
    };
    
    // Count online members
    const onlineMembers = interaction.guild.members.cache.filter(member => 
      member.presence?.status === 'online' || 
      member.presence?.status === 'idle' || 
      member.presence?.status === 'dnd'
    ).size;
    
    const onlineMembersChannel = await interaction.guild.channels.create({
      name: `${prefix} Online: ${onlineMembers}`,
      type: 2, // GUILD_VOICE
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect]
        }
      ]
    });
    
    // Store channel ID in config
    statsConfig.channels.onlineMembers = {
      id: onlineMembersChannel.id,
      format: `${prefix} Online: {count}`
    };
    
    // Count bots
    const botCount = interaction.guild.members.cache.filter(member => member.user.bot).size;
    
    const botsChannel = await interaction.guild.channels.create({
      name: `${prefix} Bots: ${botCount}`,
      type: 2, // GUILD_VOICE
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect]
        }
      ]
    });
    
    // Store channel ID in config
    statsConfig.channels.bots = {
      id: botsChannel.id,
      format: `${prefix} Bots: {count}`
    };
    
    // Update server config
    config.updateServerConfig(serverId, {
      statsConfig: statsConfig
    });
    
    // Set up interval for updating stats
    setupStatsUpdateInterval(client);
    
    return interaction.followUp({
      embeds: [{
        title: '✅ Server Stats Setup Complete',
        description: `Server statistics channels have been created in the ${category.name} category.`,
        color: 0x00FF00,
        fields: [
          {
            name: '📊 Stats Channels Created',
            value: `• Total Members Counter\n• Online Members Counter\n• Bot Counter`
          },
          {
            name: '⏱️ Update Interval',
            value: `Stats will be updated every ${statsConfig.updateInterval} minutes.`
          },
          {
            name: '➕ Additional Stats',
            value: `Use \`/serverstats role\` to create role member counters\nUse \`/serverstats custom\` to create other specialized counters`
          }
        ]
      }]
    });
  } catch (error) {
    console.error('Error setting up stats channels:', error);
    return interaction.followUp({
      content: `❌ Failed to set up stats channels: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Set up a channel to count members with a specific role
 * @param {Object} interaction - Discord interaction object
 * @param {Object} client - Discord client
 */
async function setupRoleCounter(interaction, client) {
  const role = interaction.options.getRole('role');
  const format = interaction.options.getString('format') || '📊 {role}: {count}';
  const serverId = interaction.guild.id;
  
  try {
    // Get existing stats config or create new one
    const serverConfig = config.getServerConfig(serverId);
    let statsConfig = serverConfig.statsConfig || {
      enabled: true,
      channels: {},
      updateInterval: 5,
      lastUpdate: Date.now()
    };
    
    // Count members with role
    const roleMembers = interaction.guild.members.cache.filter(member => 
      member.roles.cache.has(role.id)
    ).size;
    
    // Format channel name
    const channelName = format
      .replace('{role}', role.name)
      .replace('{count}', roleMembers);
    
    // Determine parent category
    const parentId = statsConfig.categoryId || null;
    
    // Create the role count channel
    const roleChannel = await interaction.guild.channels.create({
      name: channelName,
      type: 2, // GUILD_VOICE
      parent: parentId,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect]
        }
      ]
    });
    
    // Store role channel in config
    const roleKey = `role_${role.id}`;
    statsConfig.channels[roleKey] = {
      id: roleChannel.id,
      format: format,
      roleId: role.id
    };
    
    // Update server config
    config.updateServerConfig(serverId, {
      statsConfig: statsConfig
    });
    
    // Set up interval for updating stats if not already done
    setupStatsUpdateInterval(client);
    
    return interaction.followUp({
      embeds: [{
        title: '✅ Role Counter Created',
        description: `A statistics channel has been created to track members with the ${role.name} role.`,
        color: 0x00FF00,
        fields: [
          {
            name: '📊 Channel',
            value: channelName
          },
          {
            name: '🔄 Updates',
            value: `This counter will update every ${statsConfig.updateInterval} minutes.`
          }
        ]
      }]
    });
  } catch (error) {
    console.error('Error setting up role counter:', error);
    return interaction.followUp({
      content: `❌ Failed to set up role counter: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Set up a custom stats counter channel
 * @param {Object} interaction - Discord interaction object
 * @param {Object} client - Discord client
 */
async function setupCustomCounter(interaction, client) {
  const type = interaction.options.getString('type');
  let format = interaction.options.getString('format');
  const serverId = interaction.guild.id;
  
  // Set default format based on type if not provided
  if (!format) {
    switch (type) {
      case 'members':
        format = '📊 Members: {count}';
        break;
      case 'online':
        format = '🟢 Online: {count}';
        break;
      case 'offline':
        format = '⚫ Offline: {count}';
        break;
      case 'bots':
        format = '🤖 Bots: {count}';
        break;
      case 'humans':
        format = '👤 Humans: {count}';
        break;
      case 'voice':
        format = '🔊 In Voice: {count}';
        break;
      case 'channels':
        format = '📂 Channels: {count}';
        break;
      case 'roles':
        format = '🏷️ Roles: {count}';
        break;
      case 'boosts':
        format = '💎 Boosts: {count}';
        break;
      case 'boost_level':
        format = '🚀 Server Level: {count}';
        break;
      default:
        format = '📊 {type}: {count}';
    }
  }
  
  try {
    // Get existing stats config or create new one
    const serverConfig = config.getServerConfig(serverId);
    let statsConfig = serverConfig.statsConfig || {
      enabled: true,
      channels: {},
      updateInterval: 5,
      lastUpdate: Date.now()
    };
    
    // Get current count based on type
    let count = 0;
    switch (type) {
      case 'members':
        count = interaction.guild.memberCount;
        break;
      case 'online':
        count = interaction.guild.members.cache.filter(member => 
          member.presence?.status === 'online' || 
          member.presence?.status === 'idle' || 
          member.presence?.status === 'dnd'
        ).size;
        break;
      case 'offline':
        count = interaction.guild.memberCount - interaction.guild.members.cache.filter(member => 
          member.presence?.status === 'online' || 
          member.presence?.status === 'idle' || 
          member.presence?.status === 'dnd'
        ).size;
        break;
      case 'bots':
        count = interaction.guild.members.cache.filter(member => member.user.bot).size;
        break;
      case 'humans':
        count = interaction.guild.members.cache.filter(member => !member.user.bot).size;
        break;
      case 'voice':
        count = interaction.guild.members.cache.filter(member => 
          member.voice.channelId !== null
        ).size;
        break;
      case 'channels':
        count = interaction.guild.channels.cache.size;
        break;
      case 'roles':
        count = interaction.guild.roles.cache.size;
        break;
      case 'boosts':
        count = interaction.guild.premiumSubscriptionCount || 0;
        break;
      case 'boost_level':
        count = interaction.guild.premiumTier;
        break;
    }
    
    // Format channel name
    const channelName = format
      .replace('{type}', type)
      .replace('{count}', count);
    
    // Determine parent category
    const parentId = statsConfig.categoryId || null;
    
    // Create the custom stats channel
    const statsChannel = await interaction.guild.channels.create({
      name: channelName,
      type: 2, // GUILD_VOICE
      parent: parentId,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.Connect]
        }
      ]
    });
    
    // Store custom channel in config
    statsConfig.channels[type] = {
      id: statsChannel.id,
      format: format,
      type: type
    };
    
    // Update server config
    config.updateServerConfig(serverId, {
      statsConfig: statsConfig
    });
    
    // Set up interval for updating stats if not already done
    setupStatsUpdateInterval(client);
    
    return interaction.followUp({
      embeds: [{
        title: '✅ Custom Stats Counter Created',
        description: `A custom statistics channel has been created to track ${type}.`,
        color: 0x00FF00,
        fields: [
          {
            name: '📊 Channel',
            value: channelName
          },
          {
            name: '🔄 Updates',
            value: `This counter will update every ${statsConfig.updateInterval} minutes.`
          }
        ]
      }]
    });
  } catch (error) {
    console.error('Error setting up custom counter:', error);
    return interaction.followUp({
      content: `❌ Failed to set up custom counter: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Manually trigger an update of all stats channels
 * @param {Object} interaction - Discord interaction object
 * @param {Object} client - Discord client
 */
async function updateStatsChannels(interaction, client) {
  const serverId = interaction.guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  if (!serverConfig.statsConfig?.enabled) {
    return interaction.followUp('❌ Server statistics are not enabled for this server. Use `/serverstats setup` first.');
  }
  
  try {
    // Call the update function
    const result = await updateAllServerStats(client, serverId);
    
    if (result.success) {
      return interaction.followUp({
        embeds: [{
          title: '✅ Stats Channels Updated',
          description: 'All server statistics channels have been manually updated.',
          color: 0x00FF00,
          fields: [
            {
              name: '📊 Updated Channels',
              value: result.updated.join('\n') || 'No channels were updated'
            }
          ]
        }]
      });
    } else {
      return interaction.followUp({
        content: `❌ Failed to update stats channels: ${result.error}`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error updating stats channels:', error);
    return interaction.followUp({
      content: `❌ Failed to update stats channels: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Disable all stats channels and remove them
 * @param {Object} interaction - Discord interaction object
 * @param {Object} client - Discord client
 */
async function disableStatsChannels(interaction, client) {
  const serverId = interaction.guild.id;
  const serverConfig = config.getServerConfig(serverId);
  
  if (!serverConfig.statsConfig?.enabled) {
    return interaction.followUp('❌ Server statistics are not enabled for this server.');
  }
  
  try {
    const statsConfig = serverConfig.statsConfig;
    const deletedChannels = [];
    
    // Delete all stats channels
    for (const [channelType, channelData] of Object.entries(statsConfig.channels)) {
      try {
        const channel = await interaction.guild.channels.fetch(channelData.id).catch(() => null);
        if (channel) {
          await channel.delete();
          deletedChannels.push(channel.name);
        }
      } catch (error) {
        console.error(`Error deleting stats channel ${channelType}:`, error);
      }
    }
    
    // Update config to disable stats
    config.updateServerConfig(serverId, {
      statsConfig: {
        enabled: false,
        channels: {}
      }
    });
    
    return interaction.followUp({
      embeds: [{
        title: '✅ Server Stats Disabled',
        description: 'Server statistics have been disabled and all stats channels have been deleted.',
        color: 0x00FF00,
        fields: [
          {
            name: '🗑️ Deleted Channels',
            value: deletedChannels.join('\n') || 'No channels were deleted'
          }
        ]
      }]
    });
  } catch (error) {
    console.error('Error disabling stats channels:', error);
    return interaction.followUp({
      content: `❌ Failed to disable stats channels: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Set up the interval for updating server stats
 * @param {Object} client - Discord client
 */
function setupStatsUpdateInterval(client) {
  // Avoid duplicate intervals
  if (client.statsUpdateInterval) {
    return;
  }
  
  // Create interval for updating stats (every minute)
  client.statsUpdateInterval = setInterval(async () => {
    try {
      // Get all guilds the bot is in
      const guilds = client.guilds.cache;
      
      // Update stats for each guild
      for (const [guildId, guild] of guilds) {
        const serverConfig = config.getServerConfig(guildId);
        
        // Skip servers without stats or with disabled stats
        if (!serverConfig.statsConfig?.enabled) continue;
        
        // Check if it's time to update based on interval
        const lastUpdate = serverConfig.statsConfig.lastUpdate || 0;
        const updateInterval = serverConfig.statsConfig.updateInterval || 5; // Default 5 minutes
        const updateIntervalMs = updateInterval * 60 * 1000;
        
        if (Date.now() - lastUpdate >= updateIntervalMs) {
          await updateAllServerStats(client, guildId);
        }
      }
    } catch (error) {
      console.error('Error in stats update interval:', error);
    }
  }, 60000); // Check every minute
  
  console.log('Server stats update interval has been set up');
}

/**
 * Update all stats channels for a specific server
 * @param {Object} client - Discord client
 * @param {string} serverId - Discord server ID
 * @returns {Object} Result of the update
 */
async function updateAllServerStats(client, serverId) {
  try {
    const serverConfig = config.getServerConfig(serverId);
    if (!serverConfig.statsConfig?.enabled) {
      return { success: false, error: 'Stats not enabled for this server' };
    }
    
    // Get the guild
    const guild = await client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
      return { success: false, error: 'Guild not found' };
    }
    
    // Fetch all members to ensure presence data is available
    await guild.members.fetch();
    
    const statsConfig = serverConfig.statsConfig;
    const updatedChannels = [];
    
    // Update all stats channels
    for (const [channelType, channelData] of Object.entries(statsConfig.channels)) {
      try {
        // Get the channel
        const channel = await guild.channels.fetch(channelData.id).catch(() => null);
        if (!channel) continue;
        
        // Calculate the current count based on channel type
        let count = 0;
        
        if (channelType === 'totalMembers') {
          count = guild.memberCount;
        } else if (channelType === 'onlineMembers') {
          count = guild.members.cache.filter(member => 
            member.presence?.status === 'online' || 
            member.presence?.status === 'idle' || 
            member.presence?.status === 'dnd'
          ).size;
        } else if (channelType === 'bots') {
          count = guild.members.cache.filter(member => member.user.bot).size;
        } else if (channelType === 'humans') {
          count = guild.members.cache.filter(member => !member.user.bot).size;
        } else if (channelType === 'voice') {
          count = guild.members.cache.filter(member => 
            member.voice.channelId !== null
          ).size;
        } else if (channelType === 'channels') {
          count = guild.channels.cache.size;
        } else if (channelType === 'roles') {
          count = guild.roles.cache.size;
        } else if (channelType === 'boosts') {
          count = guild.premiumSubscriptionCount || 0;
        } else if (channelType === 'boost_level') {
          count = guild.premiumTier;
        } else if (channelType === 'offline') {
          count = guild.memberCount - guild.members.cache.filter(member => 
            member.presence?.status === 'online' || 
            member.presence?.status === 'idle' || 
            member.presence?.status === 'dnd'
          ).size;
        } else if (channelType.startsWith('role_')) {
          // Handle role counter
          const roleId = channelData.roleId;
          if (roleId) {
            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (role) {
              count = guild.members.cache.filter(member => 
                member.roles.cache.has(roleId)
              ).size;
              
              // Format channel name with role name
              const channelName = channelData.format
                .replace('{role}', role.name)
                .replace('{count}', count);
              
              await channel.setName(channelName);
              updatedChannels.push(channelName);
              continue;
            }
          }
        }
        
        // Format channel name
        const channelName = channelData.format
          .replace('{type}', channelType)
          .replace('{count}', count);
        
        // Update channel name
        await channel.setName(channelName);
        updatedChannels.push(channelName);
      } catch (error) {
        console.error(`Error updating stats channel ${channelType}:`, error);
      }
    }
    
    // Update last update timestamp
    statsConfig.lastUpdate = Date.now();
    config.updateServerConfig(serverId, {
      statsConfig: statsConfig
    });
    
    return { 
      success: true, 
      updated: updatedChannels
    };
  } catch (error) {
    console.error('Error updating server stats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

module.exports.setupStatsUpdateInterval = setupStatsUpdateInterval;