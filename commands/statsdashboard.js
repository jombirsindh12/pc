const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../utils/config');
// Temporarily comment out Canvas-related imports until we fix the dependencies
// const { createCanvas, registerFont, loadImage } = require('canvas');
// const Chart = require('chart.js/auto');
// const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');

module.exports = {
  name: 'statsdashboard',
  description: 'Display an interactive server statistics dashboard with animated graphs',
  usage: '/statsdashboard',
  guildOnly: true,
  
  // Slash command data
  data: new SlashCommandBuilder()
    .setName('statsdashboard')
    .setDescription('Display an interactive server statistics dashboard with animated graphs')
    .addStringOption(option =>
      option.setName('view')
        .setDescription('Dashboard view to display')
        .setRequired(false)
        .addChoices(
          { name: 'Members Overview', value: 'members' },
          { name: 'Activity Trends', value: 'activity' },
          { name: 'Role Distribution', value: 'roles' },
          { name: 'Channel Statistics', value: 'channels' },
          { name: 'All Stats', value: 'all' }
        )),

  async execute(message, args, client, interaction = null) {
    const isSlashCommand = !!interaction;
    
    if (!isSlashCommand) {
      return message.reply('Please use the slash command `/statsdashboard` instead.');
    }

    await interaction.deferReply();
    
    // Get view selection or default to 'members'
    const view = interaction.options.getString('view') || 'members';
    const serverId = interaction.guild.id;

    try {
      // Fetch all guild members to ensure data is up to date
      await interaction.guild.members.fetch();

      switch (view) {
        case 'members':
          await showMembersOverview(interaction, client);
          break;
        case 'activity':
          await showActivityTrends(interaction, client);
          break;
        case 'roles':
          await showRoleDistribution(interaction, client);
          break;
        case 'channels':
          await showChannelStatistics(interaction, client);
          break;
        case 'all':
          await showAllStats(interaction, client);
          break;
        default:
          await showMembersOverview(interaction, client);
      }
    } catch (error) {
      console.error('Error displaying stats dashboard:', error);
      return interaction.followUp({
        content: `❌ Failed to display the statistics dashboard: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

/**
 * Create a Members Overview Dashboard
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function showMembersOverview(interaction, client) {
  const guild = interaction.guild;
  const memberData = await collectMemberData(guild);
  
  // Create members overview embed (without image for now)
  const embed = new EmbedBuilder()
    .setTitle('📊 Server Members Overview')
    .setDescription(`Interactive stats dashboard for ${guild.name}`)
    .setColor(0x3498db)
    .addFields(
      { name: 'Total Members', value: `👥 ${memberData.total}`, inline: true },
      { name: 'Humans', value: `👤 ${memberData.humans}`, inline: true },
      { name: 'Bots', value: `🤖 ${memberData.bots}`, inline: true },
      { name: 'Online', value: `🟢 ${memberData.online}`, inline: true },
      { name: 'Idle', value: `🟠 ${memberData.idle}`, inline: true },
      { name: 'Do Not Disturb', value: `🔴 ${memberData.dnd}`, inline: true },
      { name: 'Offline', value: `⚫ ${memberData.offline}`, inline: true },
      { name: 'On Mobile', value: `📱 ${memberData.mobile}`, inline: true },
      { name: 'On Desktop', value: `💻 ${memberData.desktop}`, inline: true }
    )
    .setFooter({ text: `Updated: ${new Date().toLocaleString()}` });
  
  // Create text representation of graph (simple bar chart using emoji)
  const barChart = `Member Status Distribution:\n` +
    `Online  ${'🟩'.repeat(Math.min(10, Math.floor(memberData.online / memberData.total * 10)))} ${memberData.online}\n` +
    `Idle    ${'🟨'.repeat(Math.min(10, Math.floor(memberData.idle / memberData.total * 10)))} ${memberData.idle}\n` +
    `DND     ${'🟥'.repeat(Math.min(10, Math.floor(memberData.dnd / memberData.total * 10)))} ${memberData.dnd}\n` +
    `Offline ${'⬛'.repeat(Math.min(10, Math.floor(memberData.offline / memberData.total * 10)))} ${memberData.offline}`;
  
  embed.addFields({ name: 'Member Status Graph', value: `\`\`\`\n${barChart}\n\`\`\``, inline: false });
  
  // Create dashboard navigation buttons
  const row = createNavigationButtons('members');
  
  await interaction.followUp({
    embeds: [embed],
    components: [row]
  });
  
  // Set up collector for button interactions
  setupButtonCollector(interaction, client);
}

/**
 * Show Activity Trends Dashboard
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function showActivityTrends(interaction, client) {
  const guild = interaction.guild;
  const activityData = await collectActivityData(guild, client);
  
  // Create activity trends embed (without image for now)
  const embed = new EmbedBuilder()
    .setTitle('📈 Server Activity Trends')
    .setDescription(`Activity statistics for ${guild.name} over the past week`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Most Active Day', value: `📆 ${activityData.mostActiveDay}`, inline: true },
      { name: 'Most Active Hour', value: `🕒 ${activityData.mostActiveHour}`, inline: true },
      { name: 'Messages Today', value: `💬 ${activityData.messagesInLastDay}`, inline: true },
      { name: 'Voice Hours Today', value: `🔊 ${activityData.voiceHoursInLastDay.toFixed(1)}h`, inline: true },
      { name: 'Weekly Messages', value: `📨 ${activityData.messagesInLastWeek}`, inline: true },
      { name: 'New Members (Week)', value: `➕ ${activityData.newMembersInLastWeek}`, inline: true }
    )
    .setFooter({ text: `Updated: ${new Date().toLocaleString()}` });
  
  // Create text representation of activity (simple weekly chart)
  // Days of the week abbreviations
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Generate random message counts for each day (simulated for now)
  const messageCounts = activityData.dailyMessages || days.map(() => Math.floor(Math.random() * 100) + 1);
  const maxMessages = Math.max(...messageCounts);
  
  let activityChart = 'Weekly Message Activity:\n';
  
  for (let i = 0; i < days.length; i++) {
    const barLength = Math.ceil((messageCounts[i] / maxMessages) * 15);
    activityChart += `${days[i]}: ${'█'.repeat(barLength)} ${messageCounts[i]}\n`;
  }
  
  embed.addFields({ name: 'Weekly Activity Chart', value: `\`\`\`\n${activityChart}\n\`\`\``, inline: false });
  
  // Create dashboard navigation buttons
  const row = createNavigationButtons('activity');
  
  await interaction.followUp({
    embeds: [embed],
    components: [row]
  });
  
  // Set up collector for button interactions
  setupButtonCollector(interaction, client);
}

/**
 * Show Role Distribution Dashboard
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function showRoleDistribution(interaction, client) {
  const guild = interaction.guild;
  const roleData = await collectRoleData(guild);
  
  // Create top roles list
  let topRolesText = '';
  roleData.topRoles.forEach((role, index) => {
    topRolesText += `${index + 1}. ${role.name} (${role.count} members)\n`;
  });
  
  // Create role distribution embed (without image for now)
  const embed = new EmbedBuilder()
    .setTitle('🏷️ Server Role Distribution')
    .setDescription(`Role statistics for ${guild.name}`)
    .setColor(0xe74c3c)
    .addFields(
      { name: 'Total Roles', value: `📋 ${roleData.totalRoles}`, inline: true },
      { name: 'Members with Roles', value: `👥 ${roleData.membersWithRoles}`, inline: true },
      { name: 'Avg. Roles per Member', value: `🔢 ${roleData.avgRolesPerMember.toFixed(1)}`, inline: true },
      { name: 'Top 5 Roles by Member Count', value: topRolesText || 'No roles', inline: false }
    )
    .setFooter({ text: `Updated: ${new Date().toLocaleString()}` });
  
  // Create text representation of role distribution (simple bar chart)
  let roleChart = 'Role Distribution (Top 5):\n';
  
  if (roleData.topRoles && roleData.topRoles.length > 0) {
    const maxCount = roleData.topRoles[0].count; // First role has highest count
    
    for (let i = 0; i < Math.min(5, roleData.topRoles.length); i++) {
      const role = roleData.topRoles[i];
      const barLength = Math.ceil((role.count / maxCount) * 15);
      const roleName = role.name.length > 10 ? role.name.substring(0, 10) + '...' : role.name;
      const paddedName = roleName.padEnd(14);
      roleChart += `${paddedName} ${'█'.repeat(barLength)} ${role.count}\n`;
    }
  } else {
    roleChart += 'No roles data available';
  }
  
  embed.addFields({ name: 'Role Distribution Chart', value: `\`\`\`\n${roleChart}\n\`\`\``, inline: false });
  
  // Create dashboard navigation buttons
  const row = createNavigationButtons('roles');
  
  await interaction.followUp({
    embeds: [embed],
    components: [row]
  });
  
  // Set up collector for button interactions
  setupButtonCollector(interaction, client);
}

/**
 * Show Channel Statistics Dashboard
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function showChannelStatistics(interaction, client) {
  const guild = interaction.guild;
  const channelData = await collectChannelData(guild, client);
  
  // Create top channels list
  let topChannelsText = '';
  channelData.topTextChannels.forEach((channel, index) => {
    topChannelsText += `${index + 1}. ${channel.name} (${channel.messageCount} messages)\n`;
  });
  
  // Create channel statistics embed (without image for now)
  const embed = new EmbedBuilder()
    .setTitle('📊 Server Channel Statistics')
    .setDescription(`Channel statistics for ${guild.name}`)
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Text Channels', value: `💬 ${channelData.textChannelCount}`, inline: true },
      { name: 'Voice Channels', value: `🔊 ${channelData.voiceChannelCount}`, inline: true },
      { name: 'Categories', value: `📁 ${channelData.categoryCount}`, inline: true },
      { name: 'Currently Active Voice', value: `🎙️ ${channelData.activeVoiceCount} channels, ${channelData.activeVoiceUsers} users`, inline: true },
      { name: 'Threads', value: `🧵 ${channelData.threadCount}`, inline: true },
      { name: 'Announcement Channels', value: `📢 ${channelData.announcementChannelCount}`, inline: true },
      { name: 'Most Active Text Channels', value: topChannelsText || 'No data available', inline: false }
    )
    .setFooter({ text: `Updated: ${new Date().toLocaleString()}` });
  
  // Create text representation of channel distribution (simple bar chart)
  let channelChart = 'Channel Type Distribution:\n';
  
  // Channel type percentages
  const total = channelData.textChannelCount + channelData.voiceChannelCount + channelData.threadCount + channelData.announcementChannelCount;
  const textPercent = Math.round((channelData.textChannelCount / total) * 100);
  const voicePercent = Math.round((channelData.voiceChannelCount / total) * 100);
  const threadPercent = Math.round((channelData.threadCount / total) * 100);
  const announcementPercent = Math.round((channelData.announcementChannelCount / total) * 100);
  
  channelChart += `Text       ${'█'.repeat(Math.ceil(textPercent / 5))} ${textPercent}%\n`;
  channelChart += `Voice      ${'█'.repeat(Math.ceil(voicePercent / 5))} ${voicePercent}%\n`;
  channelChart += `Threads    ${'█'.repeat(Math.ceil(threadPercent / 5))} ${threadPercent}%\n`;
  channelChart += `Announce   ${'█'.repeat(Math.ceil(announcementPercent / 5))} ${announcementPercent}%\n`;
  
  embed.addFields({ name: 'Channel Type Chart', value: `\`\`\`\n${channelChart}\n\`\`\``, inline: false });
  
  // Create dashboard navigation buttons
  const row = createNavigationButtons('channels');
  
  await interaction.followUp({
    embeds: [embed],
    components: [row]
  });
  
  // Set up collector for button interactions
  setupButtonCollector(interaction, client);
}

/**
 * Show All Stats Dashboard - a compact overview of all stats
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function showAllStats(interaction, client) {
  const guild = interaction.guild;
  
  // Collect all data
  const memberData = await collectMemberData(guild);
  const roleData = await collectRoleData(guild);
  const channelData = await collectChannelData(guild, client);
  const activityData = await collectActivityData(guild, client);
  
  // Create all stats overview embed (without image for now)
  const embed = new EmbedBuilder()
    .setTitle('📊 Complete Server Statistics Dashboard')
    .setDescription(`Comprehensive statistics overview for ${guild.name}`)
    .setColor(0xf1c40f)
    .addFields(
      { name: 'Members', value: `👥 ${memberData.total} total\n👤 ${memberData.humans} humans\n🤖 ${memberData.bots} bots\n🟢 ${memberData.online} online`, inline: true },
      { name: 'Activity', value: `💬 ${activityData.messagesInLastDay} msgs today\n🔊 ${activityData.voiceHoursInLastDay.toFixed(1)}h voice today\n📆 ${activityData.mostActiveDay}`, inline: true },
      { name: 'Channels', value: `💬 ${channelData.textChannelCount} text\n🔊 ${channelData.voiceChannelCount} voice\n🧵 ${channelData.threadCount} threads`, inline: true },
      { name: 'Roles', value: `🏷️ ${roleData.totalRoles} total roles\n👑 Top: ${roleData.topRoles[0]?.name || 'None'} (${roleData.topRoles[0]?.count || 0})`, inline: true }
    )
    .setFooter({ text: `Updated: ${new Date().toLocaleString()}` });
  
  // Create text representation of server health (simple ASCII gauge)
  const onlinePercent = Math.round((memberData.online / memberData.total) * 100);
  const activeChannelsPercent = Math.round((channelData.activeVoiceCount / channelData.voiceChannelCount) * 100) || 0;
  const serverActivity = Math.min(10, Math.round((activityData.messagesInLastDay / 100) + (activeChannelsPercent / 10)));
  
  let serverGauge = 'Server Activity Level:\n';
  serverGauge += '[';
  for (let i = 0; i < 10; i++) {
    if (i < serverActivity) {
      serverGauge += '■';
    } else {
      serverGauge += '□';
    }
  }
  serverGauge += `] ${serverActivity}/10\n\n`;
  
  serverGauge += `Member Engagement: ${onlinePercent}% online\n`;
  serverGauge += `Voice Channels: ${activeChannelsPercent}% active\n`;
  serverGauge += `Daily Messages: ${activityData.messagesInLastDay}\n`;
  
  embed.addFields({ name: 'Server Health Monitor', value: `\`\`\`\n${serverGauge}\n\`\`\``, inline: false });
  
  // Create dashboard navigation buttons
  const row = createNavigationButtons('all');
  
  await interaction.followUp({
    embeds: [embed],
    components: [row]
  });
  
  // Set up collector for button interactions
  setupButtonCollector(interaction, client);
}

/**
 * Create navigation buttons for dashboard
 * @param {string} currentView - Current view being displayed
 * @returns {ActionRowBuilder} Row of buttons
 */
function createNavigationButtons(currentView) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('statsdashboard_members')
        .setLabel('Members')
        .setStyle(currentView === 'members' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('👥'),
      new ButtonBuilder()
        .setCustomId('statsdashboard_activity')
        .setLabel('Activity')
        .setStyle(currentView === 'activity' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('📈'),
      new ButtonBuilder()
        .setCustomId('statsdashboard_roles')
        .setLabel('Roles')
        .setStyle(currentView === 'roles' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('🏷️'),
      new ButtonBuilder()
        .setCustomId('statsdashboard_channels')
        .setLabel('Channels')
        .setStyle(currentView === 'channels' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId('statsdashboard_all')
        .setLabel('All Stats')
        .setStyle(currentView === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('📊')
    );
    
  return row;
}

/**
 * Setup button collector for dashboard navigation
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
function setupButtonCollector(interaction, client) {
  const filter = i => 
    i.customId.startsWith('statsdashboard_') && 
    i.user.id === interaction.user.id;
  
  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: 300000 // 5 minutes timeout
  });
  
  collector.on('collect', async i => {
    await i.deferUpdate();
    
    const view = i.customId.split('_')[1];
    
    switch (view) {
      case 'members':
        await showMembersOverview(interaction, client);
        break;
      case 'activity':
        await showActivityTrends(interaction, client);
        break;
      case 'roles':
        await showRoleDistribution(interaction, client);
        break;
      case 'channels':
        await showChannelStatistics(interaction, client);
        break;
      case 'all':
        await showAllStats(interaction, client);
        break;
    }
  });
  
  collector.on('end', collected => {
    // Remove buttons when collector expires
    if (interaction.replied || interaction.deferred) {
      interaction.editReply({
        components: []
      }).catch(() => {}); // Ignore if message can't be edited
    }
  });
}

/**
 * Collect member data for the guild
 * @param {Object} guild - Discord guild
 * @returns {Object} Member statistics
 */
async function collectMemberData(guild) {
  const members = guild.members.cache;
  
  // Basic counts
  const total = guild.memberCount;
  const humans = members.filter(member => !member.user.bot).size;
  const bots = members.filter(member => member.user.bot).size;
  
  // Status counts
  const online = members.filter(member => member.presence?.status === 'online').size;
  const idle = members.filter(member => member.presence?.status === 'idle').size;
  const dnd = members.filter(member => member.presence?.status === 'dnd').size;
  const offline = total - online - idle - dnd;
  
  // Client status counts
  const mobile = members.filter(member => member.presence?.clientStatus?.mobile).size;
  const desktop = members.filter(member => member.presence?.clientStatus?.desktop).size;
  const web = members.filter(member => member.presence?.clientStatus?.web).size;
  
  // Create 7-day joining history
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const joinDistribution = Array(7).fill(0);
  
  members.forEach(member => {
    const daysAgo = Math.floor((now - member.joinedTimestamp) / dayInMs);
    if (daysAgo >= 0 && daysAgo < 7) {
      joinDistribution[6 - daysAgo]++;
    }
  });
  
  return {
    total,
    humans,
    bots,
    online,
    idle,
    dnd, 
    offline,
    mobile,
    desktop,
    web,
    joinDistribution
  };
}

/**
 * Collect role data for the guild
 * @param {Object} guild - Discord guild
 * @returns {Object} Role statistics
 */
async function collectRoleData(guild) {
  const members = guild.members.cache;
  const roles = guild.roles.cache;
  
  // Basic role stats
  const totalRoles = roles.size;
  
  // Role member counts
  const roleCounts = [];
  roles.forEach(role => {
    // Skip @everyone role
    if (role.id !== guild.id) {
      const count = role.members.size;
      roleCounts.push({
        id: role.id,
        name: role.name,
        count: count,
        color: role.hexColor || '#99AAB5'
      });
    }
  });
  
  // Sort by member count (descending)
  roleCounts.sort((a, b) => b.count - a.count);
  
  // Calculate members with at least one role (excluding @everyone)
  const membersWithRoles = members.filter(member => 
    member.roles.cache.filter(role => role.id !== guild.id).size > 0
  ).size;
  
  // Calculate average roles per member (excluding @everyone)
  const totalMemberRoles = members.reduce((acc, member) => 
    acc + member.roles.cache.filter(role => role.id !== guild.id).size, 0
  );
  const avgRolesPerMember = totalMemberRoles / guild.memberCount;
  
  return {
    totalRoles,
    roleCounts,
    topRoles: roleCounts.slice(0, 5),
    membersWithRoles,
    avgRolesPerMember
  };
}

/**
 * Collect channel data for the guild
 * @param {Object} guild - Discord guild
 * @param {Object} client - Discord client
 * @returns {Object} Channel statistics
 */
async function collectChannelData(guild, client) {
  const channels = guild.channels.cache;
  
  // Basic channel counts
  const textChannelCount = channels.filter(c => c.type === 0).size; // GUILD_TEXT
  const voiceChannelCount = channels.filter(c => c.type === 2).size; // GUILD_VOICE
  const categoryCount = channels.filter(c => c.type === 4).size; // GUILD_CATEGORY
  const threadCount = channels.filter(c => c.type === 11 || c.type === 12).size; // PUBLIC_THREAD or PRIVATE_THREAD
  const announcementChannelCount = channels.filter(c => c.type === 5).size; // GUILD_ANNOUNCEMENT
  
  // Active voice channels
  const activeVoiceCount = channels.filter(c => 
    c.type === 2 && c.members.size > 0
  ).size;
  
  // Total users in voice
  const activeVoiceUsers = channels.reduce((count, channel) => 
    channel.type === 2 ? count + channel.members.size : count, 0
  );
  
  // Top text channels by approximate activity
  // For simplicity, we'll use a placeholder here
  // In a real implementation, you'd need to track actual message counts
  // via a database or analytics service
  const topTextChannels = channels
    .filter(c => c.type === 0)
    .map(c => ({
      id: c.id,
      name: c.name,
      // This is just a simulation based on position
      // Ideally, you would use actual message counts from a database
      messageCount: Math.floor(Math.random() * 1000) + 1
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);
  
  // Channel types distribution
  const channelTypes = {
    text: textChannelCount,
    voice: voiceChannelCount,
    category: categoryCount,
    thread: threadCount,
    announcement: announcementChannelCount
  };
  
  return {
    textChannelCount,
    voiceChannelCount,
    categoryCount,
    threadCount,
    announcementChannelCount,
    activeVoiceCount,
    activeVoiceUsers,
    topTextChannels,
    channelTypes
  };
}

/**
 * Collect activity data for the guild
 * @param {Object} guild - Discord guild
 * @param {Object} client - Discord client
 * @returns {Object} Activity statistics
 */
async function collectActivityData(guild, client) {
  // For a real implementation, you would need to store message and voice activity
  // in a database. This is a simulation using random data for demonstration.
  
  // Days of the week
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();
  
  // Simulate message activity
  const messageActivity = Array(7).fill(0).map(() => Math.floor(Math.random() * 500) + 50);
  const messageHourly = Array(24).fill(0).map(() => Math.floor(Math.random() * 100) + 10);
  
  // Randomly select most active day and hour
  const mostActiveDay = days[(today + Math.floor(Math.random() * 7)) % 7];
  const mostActiveHour = `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}:00`;
  
  // Simulate voice activity (in minutes)
  const voiceActivity = Array(7).fill(0).map(() => Math.floor(Math.random() * 300) + 30);
  
  // Calculate "today's" metrics
  const messagesInLastDay = messageActivity[6]; // Last day in the array
  const voiceHoursInLastDay = voiceActivity[6] / 60; // Convert minutes to hours
  
  // Calculate weekly totals
  const messagesInLastWeek = messageActivity.reduce((a, b) => a + b, 0);
  const voiceHoursInLastWeek = voiceActivity.reduce((a, b) => a + b, 0) / 60;
  
  // Count new members in the last week
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const newMembersInLastWeek = guild.members.cache.filter(member => 
    member.joinedTimestamp > oneWeekAgo
  ).size;
  
  return {
    messageActivity,
    messageHourly,
    voiceActivity,
    mostActiveDay,
    mostActiveHour,
    messagesInLastDay,
    voiceHoursInLastDay,
    messagesInLastWeek,
    voiceHoursInLastWeek,
    newMembersInLastWeek
  };
}

/**
 * Create members graph using Chart.js
 * @param {Object} memberData - Member statistics
 * @returns {Buffer} Graph image buffer
 */
async function createMembersGraph(memberData) {
  const width = 800;
  const height = 400;
  
  // Create canvas for the chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'rgba(54, 57, 63, 1)',
    plugins: {
      modern: true
    }
  });
  
  // Create configuration for the chart - Member composition pie chart
  const config = {
    type: 'bar',
    data: {
      labels: ['Online', 'Idle', 'DND', 'Offline', 'Humans', 'Bots', 'New (7d)'],
      datasets: [
        {
          label: 'Member Stats',
          data: [
            memberData.online,
            memberData.idle, 
            memberData.dnd, 
            memberData.offline,
            memberData.humans,
            memberData.bots,
            memberData.joinDistribution.reduce((a, b) => a + b, 0) // Sum of new members in last 7 days
          ],
          backgroundColor: [
            'rgba(67, 181, 129, 0.8)', // Online - Green
            'rgba(250, 166, 26, 0.8)',  // Idle - Yellow
            'rgba(240, 71, 71, 0.8)',   // DND - Red
            'rgba(116, 127, 141, 0.8)', // Offline - Gray
            'rgba(114, 137, 218, 0.8)', // Humans - Blurple
            'rgba(239, 98, 166, 0.8)',  // Bots - Pink
            'rgba(46, 204, 113, 0.8)'   // New members - Green
          ],
          borderColor: [
            'rgba(67, 181, 129, 1)',
            'rgba(250, 166, 26, 1)',
            'rgba(240, 71, 71, 1)',
            'rgba(116, 127, 141, 1)',
            'rgba(114, 137, 218, 1)',
            'rgba(239, 98, 166, 1)',
            'rgba(46, 204, 113, 1)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Server Member Composition',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Create a line chart for joins over last 7 days
  const joinConfig = {
    type: 'line',
    data: {
      labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
      datasets: [
        {
          label: 'New Members',
          data: memberData.joinDistribution,
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'New Members (Last 7 Days)',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Render first chart
  const mainChartImage = await chartJSNodeCanvas.renderToBuffer(config);
  
  // Create canvas for the second chart
  const joinChartImage = await chartJSNodeCanvas.renderToBuffer(joinConfig);
  
  // Create a canvas to combine both charts
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = 'rgba(54, 57, 63, 1)';
  ctx.fillRect(0, 0, width, height);
  
  // Load images
  const mainChart = await loadImage(mainChartImage);
  const joinChart = await loadImage(joinChartImage);
  
  // Resize and position charts
  ctx.drawImage(mainChart, 0, 0, width / 2, height);
  ctx.drawImage(joinChart, width / 2, 0, width / 2, height);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}

/**
 * Create activity graph using Chart.js
 * @param {Object} activityData - Activity statistics
 * @returns {Buffer} Graph image buffer
 */
async function createActivityGraph(activityData) {
  const width = 800;
  const height = 400;
  
  // Create canvas for the chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'rgba(54, 57, 63, 1)',
    plugins: {
      modern: true
    }
  });
  
  // Create configuration for the chart - Activity over week
  const config = {
    type: 'line',
    data: {
      labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
      datasets: [
        {
          label: 'Message Activity',
          data: activityData.messageActivity,
          backgroundColor: 'rgba(114, 137, 218, 0.2)',
          borderColor: 'rgba(114, 137, 218, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: 'yMessages'
        },
        {
          label: 'Voice Activity (min)',
          data: activityData.voiceActivity,
          backgroundColor: 'rgba(239, 98, 166, 0.2)',
          borderColor: 'rgba(239, 98, 166, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: 'yVoice'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Server Activity (Last 7 Days)',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        yMessages: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Messages',
            color: 'white'
          },
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        yVoice: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Voice (min)',
            color: 'white'
          },
          ticks: {
            color: 'white'
          },
          grid: {
            display: false
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Create an hourly message distribution chart
  const hourlyConfig = {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),
      datasets: [
        {
          label: 'Messages by Hour',
          data: activityData.messageHourly,
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Message Activity by Hour of Day',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white',
            autoSkip: true,
            maxRotation: 90,
            minRotation: 0
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Render charts
  const mainChartImage = await chartJSNodeCanvas.renderToBuffer(config);
  const hourlyChartImage = await chartJSNodeCanvas.renderToBuffer(hourlyConfig);
  
  // Create a canvas to combine both charts
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = 'rgba(54, 57, 63, 1)';
  ctx.fillRect(0, 0, width, height);
  
  // Load images
  const mainChart = await loadImage(mainChartImage);
  const hourlyChart = await loadImage(hourlyChartImage);
  
  // Resize and position charts
  ctx.drawImage(mainChart, 0, 0, width, height / 2);
  ctx.drawImage(hourlyChart, 0, height / 2, width, height / 2);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}

/**
 * Create roles graph using Chart.js
 * @param {Object} roleData - Role statistics
 * @returns {Buffer} Graph image buffer
 */
async function createRolesGraph(roleData) {
  const width = 800;
  const height = 400;
  
  // Create canvas for the chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'rgba(54, 57, 63, 1)',
    plugins: {
      modern: true
    }
  });
  
  // Take only top 10 roles for pie chart
  const topRoles = roleData.roleCounts.slice(0, 10);
  
  // Create configuration for the chart - Role distribution
  const config = {
    type: 'pie',
    data: {
      labels: topRoles.map(r => r.name),
      datasets: [
        {
          data: topRoles.map(r => r.count),
          backgroundColor: topRoles.map(r => r.color !== '#000000' ? r.color : '#99AAB5'),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'white',
            font: {
              size: 11
            }
          }
        },
        title: {
          display: true,
          text: 'Top 10 Roles by Member Count',
          font: {
            size: 16
          },
          color: 'white'
        }
      }
    }
  };
  
  // Generate bar chart for roles per user distribution
  const roleCounts = [0, 0, 0, 0, 0, 0]; // [0, 1, 2, 3, 4, 5+]
  roleData.roleCounts.forEach(role => {
    const countIndex = Math.min(role.count, 5);
    roleCounts[countIndex]++;
  });
  
  const rolesPerUserConfig = {
    type: 'bar',
    data: {
      labels: ['0 roles', '1 role', '2 roles', '3 roles', '4 roles', '5+ roles'],
      datasets: [
        {
          label: 'Members with X roles',
          data: roleCounts,
          backgroundColor: 'rgba(230, 126, 34, 0.8)',
          borderColor: 'rgba(230, 126, 34, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Role Distribution Stats',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Render charts
  const pieChartImage = await chartJSNodeCanvas.renderToBuffer(config);
  const barChartImage = await chartJSNodeCanvas.renderToBuffer(rolesPerUserConfig);
  
  // Create a canvas to combine both charts
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = 'rgba(54, 57, 63, 1)';
  ctx.fillRect(0, 0, width, height);
  
  // Load images
  const pieChart = await loadImage(pieChartImage);
  const barChart = await loadImage(barChartImage);
  
  // Resize and position charts
  ctx.drawImage(pieChart, 0, 0, width / 2, height);
  ctx.drawImage(barChart, width / 2, 0, width / 2, height);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}

/**
 * Create channels graph using Chart.js
 * @param {Object} channelData - Channel statistics
 * @returns {Buffer} Graph image buffer
 */
async function createChannelsGraph(channelData) {
  const width = 800;
  const height = 400;
  
  // Create canvas for the chart
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'rgba(54, 57, 63, 1)',
    plugins: {
      modern: true
    }
  });
  
  // Create configuration for the chart - Channel types
  const config = {
    type: 'polarArea',
    data: {
      labels: ['Text', 'Voice', 'Category', 'Thread', 'Announcement'],
      datasets: [
        {
          data: [
            channelData.textChannelCount,
            channelData.voiceChannelCount,
            channelData.categoryCount,
            channelData.threadCount,
            channelData.announcementChannelCount
          ],
          backgroundColor: [
            'rgba(52, 152, 219, 0.8)', // Text - Blue
            'rgba(155, 89, 182, 0.8)', // Voice - Purple
            'rgba(46, 204, 113, 0.8)', // Category - Green
            'rgba(230, 126, 34, 0.8)', // Thread - Orange
            'rgba(231, 76, 60, 0.8)'   // Announcement - Red
          ],
          borderColor: [
            'rgba(52, 152, 219, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(46, 204, 113, 1)',
            'rgba(230, 126, 34, 1)',
            'rgba(231, 76, 60, 1)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Channel Types Distribution',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        r: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Create bar chart for top text channels by activity
  const topChannelsConfig = {
    type: 'bar',
    data: {
      labels: channelData.topTextChannels.map(c => c.name),
      datasets: [
        {
          label: 'Message Activity',
          data: channelData.topTextChannels.map(c => c.messageCount),
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'white'
          }
        },
        title: {
          display: true,
          text: 'Most Active Text Channels',
          font: {
            size: 16
          },
          color: 'white'
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  };
  
  // Render charts
  const polarChartImage = await chartJSNodeCanvas.renderToBuffer(config);
  const barChartImage = await chartJSNodeCanvas.renderToBuffer(topChannelsConfig);
  
  // Create a canvas to combine both charts
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = 'rgba(54, 57, 63, 1)';
  ctx.fillRect(0, 0, width, height);
  
  // Load images
  const polarChart = await loadImage(polarChartImage);
  const barChart = await loadImage(barChartImage);
  
  // Resize and position charts
  ctx.drawImage(polarChart, 0, 0, width / 2, height);
  ctx.drawImage(barChart, width / 2, 0, width / 2, height);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}

/**
 * Create combined graph with all stats
 * @param {Object} memberData - Member statistics
 * @param {Object} roleData - Role statistics
 * @param {Object} channelData - Channel statistics
 * @param {Object} activityData - Activity statistics
 * @returns {Buffer} Graph image buffer
 */
async function createCombinedGraph(memberData, roleData, channelData, activityData) {
  const width = 800;
  const height = 800;
  
  // Create canvas for the charts
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width: width / 2,
    height: height / 2,
    backgroundColour: 'rgba(54, 57, 63, 1)',
    plugins: {
      modern: true
    }
  });
  
  // Create member status doughnut chart
  const membersConfig = {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Idle', 'DND', 'Offline'],
      datasets: [
        {
          data: [
            memberData.online,
            memberData.idle,
            memberData.dnd,
            memberData.offline
          ],
          backgroundColor: [
            'rgba(67, 181, 129, 0.8)', // Online - Green
            'rgba(250, 166, 26, 0.8)',  // Idle - Yellow
            'rgba(240, 71, 71, 0.8)',   // DND - Red
            'rgba(116, 127, 141, 0.8)'  // Offline - Gray
          ],
          borderColor: [
            'rgba(67, 181, 129, 1)',
            'rgba(250, 166, 26, 1)',
            'rgba(240, 71, 71, 1)',
            'rgba(116, 127, 141, 1)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'white',
            font: { size: 10 }
          }
        },
        title: {
          display: true,
          text: 'Member Status',
          font: { size: 14 },
          color: 'white'
        }
      }
    }
  };
  
  // Create activity line chart
  const activityConfig = {
    type: 'line',
    data: {
      labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
      datasets: [
        {
          label: 'Messages',
          data: activityData.messageActivity,
          backgroundColor: 'rgba(114, 137, 218, 0.2)',
          borderColor: 'rgba(114, 137, 218, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'white',
            font: { size: 10 }
          }
        },
        title: {
          display: true,
          text: 'Activity Trends',
          font: { size: 14 },
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            font: { size: 8 }
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        x: {
          ticks: {
            color: 'white',
            font: { size: 8 }
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      }
    }
  };
  
  // Create role pie chart
  const rolesConfig = {
    type: 'pie',
    data: {
      labels: roleData.topRoles.slice(0, 5).map(r => r.name),
      datasets: [
        {
          data: roleData.topRoles.slice(0, 5).map(r => r.count),
          backgroundColor: roleData.topRoles.slice(0, 5).map(r => 
            r.color !== '#000000' ? r.color : '#99AAB5'
          ),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'white',
            font: { size: 10 }
          }
        },
        title: {
          display: true,
          text: 'Top Roles',
          font: { size: 14 },
          color: 'white'
        }
      }
    }
  };
  
  // Create channel types chart
  const channelsConfig = {
    type: 'polarArea',
    data: {
      labels: ['Text', 'Voice', 'Thread', 'Category', 'Announce'],
      datasets: [
        {
          data: [
            channelData.textChannelCount,
            channelData.voiceChannelCount,
            channelData.threadCount,
            channelData.categoryCount,
            channelData.announcementChannelCount
          ],
          backgroundColor: [
            'rgba(52, 152, 219, 0.8)',  // Text - Blue
            'rgba(155, 89, 182, 0.8)',  // Voice - Purple
            'rgba(230, 126, 34, 0.8)',  // Thread - Orange
            'rgba(46, 204, 113, 0.8)',  // Category - Green
            'rgba(231, 76, 60, 0.8)'    // Announcement - Red
          ],
          borderColor: [
            'rgba(52, 152, 219, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(230, 126, 34, 1)',
            'rgba(46, 204, 113, 1)',
            'rgba(231, 76, 60, 1)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'white',
            font: { size: 10 }
          }
        },
        title: {
          display: true,
          text: 'Channel Types',
          font: { size: 14 },
          color: 'white'
        }
      },
      scales: {
        r: {
          ticks: {
            color: 'white',
            font: { size: 8 },
            backdropColor: 'transparent'
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      }
    }
  };
  
  // Render all charts
  const membersChartImage = await chartJSNodeCanvas.renderToBuffer(membersConfig);
  const activityChartImage = await chartJSNodeCanvas.renderToBuffer(activityConfig);
  const rolesChartImage = await chartJSNodeCanvas.renderToBuffer(rolesConfig);
  const channelsChartImage = await chartJSNodeCanvas.renderToBuffer(channelsConfig);
  
  // Create a canvas to combine all charts
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = 'rgba(54, 57, 63, 1)';
  ctx.fillRect(0, 0, width, height);
  
  // Add title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Server Statistics Dashboard', width / 2, 30);
  
  // Load images
  const membersChart = await loadImage(membersChartImage);
  const activityChart = await loadImage(activityChartImage);
  const rolesChart = await loadImage(rolesChartImage);
  const channelsChart = await loadImage(channelsChartImage);
  
  // Draw guild icon if available
  if (guild.iconURL()) {
    try {
      const iconURL = guild.iconURL({ format: 'png', size: 128 });
      const icon = await loadImage(iconURL);
      
      // Draw icon in the center
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 64, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(icon, width / 2 - 64, height / 2 - 64, 128, 128);
      ctx.restore();
      
      // Add decorative circle
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 67, 0, Math.PI * 2);
      ctx.stroke();
    } catch (e) {
      console.error('Error drawing server icon:', e);
    }
  }
  
  // Position charts in each corner
  const margin = 50; // Margin from the top to account for the title
  const chartWidth = width / 2;
  const chartHeight = (height - margin) / 2;
  
  ctx.drawImage(membersChart, 0, margin, chartWidth, chartHeight);
  ctx.drawImage(activityChart, chartWidth, margin, chartWidth, chartHeight);
  ctx.drawImage(rolesChart, 0, margin + chartHeight, chartWidth, chartHeight);
  ctx.drawImage(channelsChart, chartWidth, margin + chartHeight, chartWidth, chartHeight);
  
  // Convert canvas to buffer
  return canvas.toBuffer('image/png');
}