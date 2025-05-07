const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { inviteTracker } = require('../server/db');
const config = require('../utils/config');

// Cache for guild invites
const guildInvites = new Map();

module.exports = {
  name: 'invitetracker',
  description: 'Set up invite tracking to see who invited whom',
  data: new SlashCommandBuilder()
    .setName('invitetracker')
    .setDescription('Set up invite tracking to see who invited whom')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up invite tracking for this server')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel where invite logs will be sent')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Custom welcome message (use {user}, {inviter}, {invites}, {server})')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show invite statistics for this server'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('Show top inviters leaderboard'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Show who invited a specific user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable invite tracking')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable invite tracking')
            .setRequired(true))),
  async execute(message, args, client, interaction = null) {
    if (!interaction) {
      // Legacy command support
      return message.reply('Please use slash commands instead, like `/invitetracker setup`');
    }

    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'setup':
        await setupInviteTracking(interaction, client);
        break;
      case 'stats':
        await showServerInviteStats(interaction, client);
        break;
      case 'leaderboard':
        await showInviteLeaderboard(interaction, client);
        break;
      case 'info':
        await showUserInviteInfo(interaction, client);
        break;
      case 'toggle':
        await toggleInviteTracking(interaction, client);
        break;
    }
  }
};

/**
 * Set up invite tracking for a server
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function setupInviteTracking(interaction, client) {
  await interaction.deferReply();
  
  try {
    // Get channel and optional welcome message
    const logChannel = interaction.options.getChannel('channel');
    const welcomeMessage = interaction.options.getString('message') || 
      '👋 Welcome {user} to {server}!\n\n' +
      '🎯 You were invited by **{inviter}**\n' +
      '💫 They have invited **{invites}** members';
    
    // Create server config if it doesn't exist
    const serverId = interaction.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Make sure inviteSettings exists in server config
    if (!serverConfig.inviteSettings) {
      serverConfig.inviteSettings = {};
    }
    
    // Update server config
    serverConfig.inviteSettings.logChannelId = logChannel.id;
    serverConfig.inviteSettings.welcomeMessage = welcomeMessage;
    serverConfig.inviteSettings.enabled = true;
    config.saveServerConfig(serverId, serverConfig);
    
    // Save to database
    await inviteTracker.updateServerInviteSettings(serverId, {
      logChannelId: logChannel.id,
      welcomeMessage: welcomeMessage,
      enabled: 1
    });
    
    // Initialize database tables if needed
    await inviteTracker.initializeTables();
    
    // Fetch and cache all guild invites
    const guild = interaction.guild;
    const invites = await guild.invites.fetch();
    guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
    
    // Send success message
    const embed = new EmbedBuilder()
      .setTitle('✅ Invite Tracking Enabled')
      .setDescription(`Invite tracking has been set up for this server.`)
      .addFields(
        { name: '📝 Log Channel', value: `<#${logChannel.id}>`, inline: true },
        { name: '💬 Welcome Message', value: welcomeMessage, inline: false }
      )
      .setColor('#43B581')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    // Log setup in the log channel
    const setupEmbed = new EmbedBuilder()
      .setTitle('🔔 Invite Tracking System Activated')
      .setDescription(`Invite tracking has been enabled for this server. All member joins will now be logged here with invitation information.`)
      .setColor('#5865F2')
      .setFooter({ text: `Set up by ${interaction.user.tag}` })
      .setTimestamp();
    
    await logChannel.send({ embeds: [setupEmbed] });
    
    // Set up invite tracking collectors
    setupInviteTrackingCollector(client);
  } catch (error) {
    console.error('Error setting up invite tracking:', error);
    await interaction.editReply('❌ An error occurred while setting up invite tracking. Please try again.');
  }
}

/**
 * Show server invite statistics
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function showServerInviteStats(interaction, client) {
  await interaction.deferReply();
  
  try {
    const serverId = interaction.guild.id;
    const stats = await inviteTracker.getServerInviteStats(serverId);
    
    if (!stats) {
      return interaction.editReply('❌ Could not retrieve invite statistics. Make sure invite tracking is set up.');
    }
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Server Invite Statistics')
      .setDescription(`Invite statistics for **${interaction.guild.name}**`)
      .addFields(
        { name: '👥 Total Tracked Joins', value: stats.totalInvites.toString(), inline: true },
        { name: '📆 Recent (7 days)', value: stats.recentInvites.toString(), inline: true }
      )
      .setColor('#5865F2')
      .setTimestamp();
    
    if (stats.topInviter) {
      embed.addFields({
        name: '🏆 Top Inviter',
        value: `<@${stats.topInviter.inviter_id}> with **${stats.topInviter.invite_count}** invites`,
        inline: false
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error showing server invite stats:', error);
    await interaction.editReply('❌ An error occurred while retrieving invite statistics.');
  }
}

/**
 * Show invite leaderboard
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function showInviteLeaderboard(interaction, client) {
  await interaction.deferReply();
  
  try {
    const serverId = interaction.guild.id;
    const topInviters = await inviteTracker.getTopInviters(serverId, 10);
    
    if (!topInviters || topInviters.length === 0) {
      return interaction.editReply('❌ No invite data found. Make sure invite tracking is set up and members have joined using invites.');
    }
    
    let leaderboardText = '';
    
    topInviters.forEach((inviter, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      leaderboardText += `${medal} <@${inviter.inviter_id}> - **${inviter.invite_count}** members\n`;
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🏆 Invite Leaderboard')
      .setDescription(leaderboardText)
      .setColor('#5865F2')
      .setFooter({ text: `${interaction.guild.name}` })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error showing invite leaderboard:', error);
    await interaction.editReply('❌ An error occurred while retrieving the invite leaderboard.');
  }
}

/**
 * Show who invited a user
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function showUserInviteInfo(interaction, client) {
  await interaction.deferReply();
  
  try {
    const serverId = interaction.guild.id;
    const user = interaction.options.getUser('user');
    
    const inviterInfo = await inviteTracker.getMemberInviter(serverId, user.id);
    
    if (!inviterInfo) {
      return interaction.editReply(`❌ No invite information found for <@${user.id}>. They might have joined before invite tracking was set up, or through a Discord invite page.`);
    }
    
    const joinedAt = inviterInfo.joinedAt ? new Date(inviterInfo.joinedAt) : new Date();
    const joinTimestamp = Math.floor(joinedAt.getTime() / 1000);
    
    const embed = new EmbedBuilder()
      .setTitle('👋 User Invite Information')
      .setDescription(`Information about who invited <@${user.id}>`)
      .addFields(
        { name: '🎯 Invited By', value: `<@${inviterInfo.inviterId}>`, inline: true },
        { name: '📅 Joined', value: `<t:${joinTimestamp}:R>`, inline: true },
        { name: '🔗 Invite Code', value: `\`${inviterInfo.inviteCode}\``, inline: true }
      )
      .setColor('#5865F2')
      .setTimestamp();
    
    // Add user avatar if available
    if (user.displayAvatarURL()) {
      embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error showing user invite info:', error);
    await interaction.editReply('❌ An error occurred while retrieving user invite information.');
  }
}

/**
 * Toggle invite tracking
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function toggleInviteTracking(interaction, client) {
  await interaction.deferReply();
  
  try {
    const serverId = interaction.guild.id;
    const enabled = interaction.options.getBoolean('enabled');
    
    // Get server config
    const serverConfig = config.getServerConfig(serverId);
    
    // Make sure inviteSettings exists
    if (!serverConfig.inviteSettings) {
      serverConfig.inviteSettings = {};
    }
    
    // Update config
    serverConfig.inviteSettings.enabled = enabled;
    config.saveServerConfig(serverId, serverConfig);
    
    // Update database
    await inviteTracker.updateServerInviteSettings(serverId, {
      enabled: enabled ? 1 : 0
    });
    
    const embed = new EmbedBuilder()
      .setTitle(enabled ? '✅ Invite Tracking Enabled' : '⏸️ Invite Tracking Disabled')
      .setDescription(`Invite tracking has been ${enabled ? 'enabled' : 'disabled'} for this server.`)
      .setColor(enabled ? '#43B581' : '#747F8D')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error toggling invite tracking:', error);
    await interaction.editReply('❌ An error occurred while toggling invite tracking.');
  }
}

/**
 * Set up invite tracking event collectors
 * @param {Object} client Discord client
 */
function setupInviteTrackingCollector(client) {
  // Fetch and cache all guild invites when the bot starts
  client.on('ready', async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const invites = await guild.invites.fetch();
        guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
        console.log(`🔍 Cached invites for ${guild.name}`);
      } catch (error) {
        console.error(`Could not cache invites for ${guild.name}:`, error);
      }
    }
  });
  
  // Update cache when a new invite is created
  client.on('inviteCreate', async invite => {
    try {
      const invites = await invite.guild.invites.fetch();
      guildInvites.set(invite.guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
      
      // Save invite to database
      await inviteTracker.saveInvite(invite);
    } catch (error) {
      console.error('Error handling invite create:', error);
    }
  });
  
  // Track which invite was used when a member joins
  client.on('guildMemberAdd', async member => {
    const { guild } = member;
    const serverId = guild.id;
    
    // Skip if guild has no invites cache
    if (!guildInvites.has(serverId)) return;
    
    try {
      // Get server config
      const serverConfig = config.getServerConfig(serverId);
      
      // Check if invite tracking is enabled
      if (!serverConfig.inviteSettings?.enabled) return;
      
      // Fetch latest invites
      const newInvites = await guild.invites.fetch();
      
      // Get cached invites
      const cachedInvites = guildInvites.get(serverId);
      
      // Find the invite that was used
      const usedInvite = newInvites.find(invite => {
        const cachedUses = cachedInvites.get(invite.code) || 0;
        return invite.uses > cachedUses;
      });
      
      // Update invite cache
      guildInvites.set(serverId, new Map(newInvites.map(invite => [invite.code, invite.uses])));
      
      // Check if invite was found
      if (!usedInvite) {
        console.log(`Could not determine which invite was used for ${member.user.tag} in ${guild.name}`);
        return;
      }
      
      // Get inviter and save to database
      const inviterId = usedInvite.inviter ? usedInvite.inviter.id : '0';
      await inviteTracker.saveInviteJoin(member, usedInvite.code, inviterId);
      
      // Process welcome message
      const logChannelId = serverConfig.inviteSettings?.logChannelId;
      if (!logChannelId) return;
      
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) return;
      
      // Get inviter's total invite count
      const invitedMembers = await inviteTracker.getInvitedMembers(serverId, inviterId);
      const inviteCount = invitedMembers.length;
      
      // Format welcome message
      let welcomeMessage = serverConfig.inviteSettings.welcomeMessage || 
        '👋 Welcome {user} to {server}!\n\n' +
        '🎯 You were invited by **{inviter}**\n' +
        '💫 They have invited **{invites}** members';
      
      welcomeMessage = welcomeMessage
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{server}/g, guild.name)
        .replace(/{inviter}/g, usedInvite.inviter ? `<@${usedInvite.inviter.id}>` : 'Unknown')
        .replace(/{invites}/g, inviteCount.toString())
        .replace(/{invite-code}/g, usedInvite.code)
        .replace(/{invite-url}/g, usedInvite.url);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('👋 New Member Joined')
        .setDescription(welcomeMessage)
        .setColor('#43B581')
        .setTimestamp();
      
      // Add member avatar if available
      if (member.user.displayAvatarURL()) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
      }
      
      // Add fields with additional info
      embed.addFields(
        { name: '👤 Member', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
        { name: '🎯 Invited By', value: usedInvite.inviter ? `<@${usedInvite.inviter.id}>` : 'Unknown', inline: true },
        { name: '📊 Total Invites', value: inviteCount.toString(), inline: true }
      );
      
      // Send welcome message to log channel
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error tracking invite for ${member.user.tag}:`, error);
    }
  });
  
  // Handle members leaving
  client.on('guildMemberRemove', async member => {
    const { guild } = member;
    const serverId = guild.id;
    
    try {
      // Get server config
      const serverConfig = config.getServerConfig(serverId);
      
      // Check if invite tracking is enabled
      if (!serverConfig.inviteSettings?.enabled) return;
      
      // Get log channel
      const logChannelId = serverConfig.inviteSettings?.logChannelId;
      if (!logChannelId) return;
      
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) return;
      
      // Get inviter information for the leaving member
      const inviterInfo = await inviteTracker.getMemberInviter(serverId, member.id);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('👋 Member Left')
        .setDescription(`<@${member.id}> (\`${member.user.tag}\`) has left the server.`)
        .setColor('#F04747')
        .setTimestamp();
      
      // Add member avatar if available
      if (member.user.displayAvatarURL()) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
      }
      
      // Add inviter info if available
      if (inviterInfo) {
        embed.addFields({
          name: '🎯 Was Invited By',
          value: `<@${inviterInfo.inviterId}>`,
          inline: true
        });
      }
      
      // Send message to log channel
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error handling member leave for ${member.user.tag}:`, error);
    }
  });
}

// Export the invite tracking collector setup
module.exports.setupInviteTrackingCollector = setupInviteTrackingCollector;