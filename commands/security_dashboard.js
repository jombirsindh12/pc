const { EmbedBuilder } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'securitydashboard',
  description: 'View real-time security statistics and threat monitoring',
  usage: '/securitydashboard',
  options: [
    {
      name: 'type',
      type: 3, // STRING
      description: 'Dashboard type to display',
      required: false,
      choices: [
        { name: 'Overview', value: 'overview' },
        { name: 'Threats', value: 'threats' },
        { name: 'Activity', value: 'activity' },
        { name: 'Audit', value: 'audit' }
      ]
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    const isSlashCommand = !!interaction;
    
    // Get required parameters
    const user = isSlashCommand ? interaction.user : message.author;
    const guildId = isSlashCommand ? interaction.guildId : message.guildId;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    
    if (!guild) {
      const response = "This command can only be used in a server.";
      if (isSlashCommand) {
        return interaction.reply({ content: response, ephemeral: true });
      } else {
        return message.reply(response);
      }
    }
    
    // Defer the reply as generating the dashboard can take some time
    if (isSlashCommand) {
      await interaction.deferReply();
    } else {
      const loadingMessage = await message.channel.send("🔄 Generating security dashboard...");
      message.loadingMessage = loadingMessage;
    }
    
    // Get dashboard type
    const dashboardType = isSlashCommand 
      ? (interaction.options.getString('type') || 'overview')
      : (args[0] || 'overview');
    
    try {
      // Get server config
      const serverConfig = config.getServerConfig(guildId);
      
      // Generate stats
      const securityStats = await generateSecurityStats(guild, serverConfig, client);
      
      // Generate the appropriate dashboard based on type
      let dashboardResult;
      
      switch (dashboardType.toLowerCase()) {
        case 'threats':
          dashboardResult = await generateThreatDashboard(guild, securityStats, serverConfig);
          break;
        case 'activity':
          dashboardResult = await generateActivityDashboard(guild, securityStats, serverConfig);
          break;
        case 'audit':
          dashboardResult = await generateAuditDashboard(guild, securityStats, serverConfig);
          break;
        default:
          dashboardResult = await generateOverviewDashboard(guild, securityStats, serverConfig);
          break;
      }
      
      // Create embed with the dashboard information
      const embed = {
        title: `🛡️ Security Dashboard: ${dashboardType.charAt(0).toUpperCase() + dashboardType.slice(1)}`,
        description: dashboardResult.description,
        color: getSecurityLevelColor(securityStats.securityLevel),
        fields: dashboardResult.fields,
        footer: {
          text: `Phantom Guard Security | Server: ${guild.name}`
        },
        timestamp: new Date()
      };
      
      // Add image attachment if available
      let files = [];
      if (dashboardResult.image) {
        files = [dashboardResult.image];
        embed.image = { url: `attachment://${dashboardResult.image.name}` };
      }
      
      // Send the response
      if (isSlashCommand) {
        await interaction.editReply({ embeds: [embed], files: files });
      } else {
        if (message.loadingMessage) {
          await message.loadingMessage.delete().catch(() => {});
        }
        await message.reply({ embeds: [embed], files: files });
      }
      
    } catch (error) {
      console.error('Error generating security dashboard:', error);
      
      const errorMessage = `An error occurred while generating the security dashboard: ${error.message}`;
      
      if (isSlashCommand) {
        await interaction.editReply({ content: errorMessage });
      } else {
        if (message.loadingMessage) {
          await message.loadingMessage.delete().catch(() => {});
        }
        await message.reply(errorMessage);
      }
    }
  }
};

/**
 * Calculate and return security statistics for the server
 * @param {Object} guild - Discord guild object
 * @param {Object} serverConfig - Server configuration
 * @param {Object} client - Discord client
 * @returns {Object} Security statistics
 */
async function generateSecurityStats(guild, serverConfig, client) {
  // Get basic security status
  const antiSpamEnabled = !serverConfig.antiSpamDisabled;
  const antiRaidEnabled = !serverConfig.antiRaidDisabled;
  const antiNukeEnabled = !serverConfig.antiNukeDisabled;
  const antiScamEnabled = !serverConfig.antiScamDisabled;
  
  // Get recent incidents
  const modLogs = serverConfig.modLogs || [];
  const recentIncidents = modLogs.filter(log => {
    // Check if log happened within the last 7 days
    const logDate = new Date(log.timestamp);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return logDate > sevenDaysAgo;
  });
  
  // Count incident types
  const spamIncidents = recentIncidents.filter(log => 
    log.type === 'antispam' || log.reason?.toLowerCase().includes('spam')).length;
  
  const raidIncidents = recentIncidents.filter(log => 
    log.type === 'antiraid' || log.reason?.toLowerCase().includes('raid')).length;
  
  const nukeIncidents = recentIncidents.filter(log => 
    log.type === 'antinuke' || log.reason?.toLowerCase().includes('nuke')).length;
  
  const scamIncidents = recentIncidents.filter(log => 
    log.type === 'antiscam' || log.reason?.toLowerCase().includes('scam')).length;
  
  // Get number of bans and kicks
  const bans = recentIncidents.filter(log => log.type === 'ban').length;
  const kicks = recentIncidents.filter(log => log.type === 'kick').length;
  
  // Get number of warnings
  const warnings = recentIncidents.filter(log => log.type === 'warning').length;
  
  // Calculate security level (0-10)
  let securityLevel = 5; // Default
  
  // Add points for enabled protections
  if (antiSpamEnabled) securityLevel += 1;
  if (antiRaidEnabled) securityLevel += 1;
  if (antiNukeEnabled) securityLevel += 1;
  if (antiScamEnabled) securityLevel += 1;
  
  // Subtract points for recent incidents
  const totalIncidents = spamIncidents + raidIncidents + nukeIncidents + scamIncidents;
  if (totalIncidents > 10) securityLevel -= 2;
  else if (totalIncidents > 5) securityLevel -= 1;
  
  // Ensure level is within range
  securityLevel = Math.max(0, Math.min(10, securityLevel));
  
  // Get recent suspicious users
  const suspiciousUsers = recentIncidents
    .filter(log => log.type === 'warning' || log.type === 'ban' || log.type === 'kick')
    .map(log => ({ id: log.userId, username: log.username, action: log.type, reason: log.reason }))
    .filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    )
    .slice(0, 5); // Get only 5 most recent
  
  // Return compiled stats
  return {
    antiSpamEnabled,
    antiRaidEnabled,
    antiNukeEnabled,
    antiScamEnabled,
    spamIncidents,
    raidIncidents,
    nukeIncidents,
    scamIncidents,
    totalIncidents,
    bans,
    kicks,
    warnings,
    securityLevel,
    suspiciousUsers,
    recentIncidents
  };
}

/**
 * Generate the overview dashboard
 * @param {Object} guild - Discord guild object
 * @param {Object} stats - Security statistics
 * @param {Object} serverConfig - Server configuration
 * @returns {Object} Dashboard result
 */
async function generateOverviewDashboard(guild, stats, serverConfig) {
  // Generate security level bars
  const securityLevelBar = generateSecurityLevelBar(stats.securityLevel);
  
  // Create fields for the embed
  const fields = [
    {
      name: '🔐 Security Level',
      value: `${securityLevelBar} (${stats.securityLevel}/10)`,
      inline: false
    },
    {
      name: '🛡️ Protection Status',
      value: `Anti-Spam: ${stats.antiSpamEnabled ? '✅' : '❌'}\n` +
             `Anti-Raid: ${stats.antiRaidEnabled ? '✅' : '❌'}\n` +
             `Anti-Nuke: ${stats.antiNukeEnabled ? '✅' : '❌'}\n` +
             `Anti-Scam: ${stats.antiScamEnabled ? '✅' : '❌'}`,
      inline: true
    },
    {
      name: '📊 Recent Incidents',
      value: `Spam: ${stats.spamIncidents}\n` +
             `Raid: ${stats.raidIncidents}\n` +
             `Nuke: ${stats.nukeIncidents}\n` +
             `Scam: ${stats.scamIncidents}`,
      inline: true
    },
    {
      name: '🔨 Moderation Actions',
      value: `Bans: ${stats.bans}\n` +
             `Kicks: ${stats.kicks}\n` +
             `Warnings: ${stats.warnings}`,
      inline: true
    }
  ];
  
  // Add suspicious users field if any
  if (stats.suspiciousUsers.length > 0) {
    const suspiciousUsersText = stats.suspiciousUsers
      .map(user => `<@${user.id}> (${user.action}: ${user.reason || 'No reason'})`)
      .join('\n');
    
    fields.push({
      name: '⚠️ Recently Flagged Users',
      value: suspiciousUsersText.length > 1024 
        ? suspiciousUsersText.substring(0, 1020) + '...' 
        : suspiciousUsersText,
      inline: false
    });
  }
  
  return {
    description: `Security overview for **${guild.name}**. Use the dashboard to monitor threats and security incidents in real-time.`,
    fields: fields,
    image: null
  };
}

/**
 * Generate the threats dashboard
 * @param {Object} guild - Discord guild object
 * @param {Object} stats - Security statistics
 * @param {Object} serverConfig - Server configuration
 * @returns {Object} Dashboard result
 */
async function generateThreatDashboard(guild, stats, serverConfig) {
  // Get recent incidents and organize by time
  const recentIncidents = stats.recentIncidents || [];
  
  // Get threat timeline (last 7 days)
  const timeline = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const dayIncidents = recentIncidents.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= date && logDate < nextDay;
    });
    
    timeline.push({
      date: date,
      displayDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      incidents: dayIncidents.length
    });
  }
  
  // Create fields for the embed
  const fields = [
    {
      name: '🔍 Threat Level',
      value: getThreatLevelDescription(stats),
      inline: false
    },
    {
      name: '📈 Recent Activity',
      value: generateActivityBar(timeline),
      inline: false
    }
  ];
  
  // Add recent incidents
  if (recentIncidents.length > 0) {
    const recentThreatsList = recentIncidents
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(incident => {
        const date = new Date(incident.timestamp).toLocaleString();
        return `• ${date}: ${incident.type.toUpperCase()} - ${incident.reason || 'No reason provided'} (${incident.username || 'Unknown user'})`;
      })
      .join('\n');
    
    fields.push({
      name: '⚠️ Recent Security Incidents',
      value: recentThreatsList || 'No recent security incidents.',
      inline: false
    });
  }
  
  return {
    description: `Threat analysis for **${guild.name}**. This dashboard shows potential security threats and recent security incidents.`,
    fields: fields,
    image: null
  };
}

/**
 * Generate the activity dashboard
 * @param {Object} guild - Discord guild object
 * @param {Object} stats - Security statistics
 * @param {Object} serverConfig - Server configuration
 * @returns {Object} Dashboard result
 */
async function generateActivityDashboard(guild, stats, serverConfig) {
  // Get member count
  const memberCount = guild.memberCount;
  
  // Analyze security events over time
  const recentIncidents = stats.recentIncidents || [];
  
  // Create hourly distribution (last 24 hours)
  const hourlyDistribution = Array(24).fill(0);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  recentIncidents.forEach(incident => {
    const incidentDate = new Date(incident.timestamp);
    if (incidentDate >= yesterday) {
      hourlyDistribution[incidentDate.getHours()]++;
    }
  });
  
  // Find peak activity hours
  const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
  const peakTime = `${peakHour}:00 - ${peakHour + 1}:00`;
  
  // Generate fields
  const fields = [
    {
      name: '👥 Server Size',
      value: `${memberCount} members`,
      inline: true
    },
    {
      name: '⚡ Security Events',
      value: `${recentIncidents.length} events in past 7 days`,
      inline: true
    },
    {
      name: '⏰ Peak Activity Time',
      value: peakTime,
      inline: true
    }
  ];
  
  return {
    description: `Activity monitoring for **${guild.name}**. This dashboard shows server activity patterns and potential security concerns.`,
    fields: fields,
    image: null
  };
}

/**
 * Generate the audit dashboard
 * @param {Object} guild - Discord guild object
 * @param {Object} stats - Security statistics
 * @param {Object} serverConfig - Server configuration
 * @returns {Object} Dashboard result
 */
async function generateAuditDashboard(guild, stats, serverConfig) {
  // Get recent mod actions
  const recentIncidents = stats.recentIncidents || [];
  
  // Get moderator activity
  const moderatorActivity = {};
  recentIncidents.forEach(incident => {
    if (incident.moderatorId) {
      if (!moderatorActivity[incident.moderatorId]) {
        moderatorActivity[incident.moderatorId] = {
          name: incident.moderatorName || 'Unknown',
          actions: 0,
          bans: 0,
          kicks: 0,
          warnings: 0
        };
      }
      
      moderatorActivity[incident.moderatorId].actions++;
      
      if (incident.type === 'ban') moderatorActivity[incident.moderatorId].bans++;
      if (incident.type === 'kick') moderatorActivity[incident.moderatorId].kicks++;
      if (incident.type === 'warning') moderatorActivity[incident.moderatorId].warnings++;
    }
  });
  
  // Sort moderators by activity
  const topModerators = Object.keys(moderatorActivity)
    .map(id => ({ id, ...moderatorActivity[id] }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 5);
  
  // Generate fields
  const fields = [
    {
      name: '📋 Audit Summary',
      value: `Total actions: ${recentIncidents.length}\n` +
             `Bans: ${stats.bans}\n` +
             `Kicks: ${stats.kicks}\n` +
             `Warnings: ${stats.warnings}`,
      inline: false
    }
  ];
  
  // Add top moderators field
  if (topModerators.length > 0) {
    const modList = topModerators
      .map(mod => `<@${mod.id}> - ${mod.actions} actions (${mod.bans} bans, ${mod.kicks} kicks, ${mod.warnings} warnings)`)
      .join('\n');
    
    fields.push({
      name: '👮 Top Moderators',
      value: modList,
      inline: false
    });
  }
  
  // Add recent actions field
  if (recentIncidents.length > 0) {
    const recentActions = recentIncidents
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(incident => {
        const date = new Date(incident.timestamp).toLocaleString();
        return `• ${date}: ${incident.type.toUpperCase()} - ${incident.username || 'Unknown user'} by ${incident.moderatorName || 'System'}`;
      })
      .join('\n');
    
    fields.push({
      name: '🔍 Recent Actions',
      value: recentActions,
      inline: false
    });
  }
  
  return {
    description: `Audit log for **${guild.name}**. This dashboard shows moderation activity and enforcement actions.`,
    fields: fields,
    image: null
  };
}

/**
 * Generate a security level bar
 * @param {number} level - Security level (0-10)
 * @returns {string} Visual bar representation
 */
function generateSecurityLevelBar(level) {
  const totalBars = 10;
  const filledBars = Math.round(level);
  const emptyBars = totalBars - filledBars;
  
  let color;
  if (level <= 3) color = '🔴';
  else if (level <= 7) color = '🟡';
  else color = '🟢';
  
  return color + ' ' + '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

/**
 * Generate an activity bar based on the timeline
 * @param {Array} timeline - Timeline of incidents
 * @returns {string} Visual activity bar
 */
function generateActivityBar(timeline) {
  const maxIncidents = Math.max(...timeline.map(day => day.incidents), 1);
  const bars = timeline.map(day => {
    const barLength = Math.ceil((day.incidents / maxIncidents) * 8);
    return `${day.displayDate}: ${'█'.repeat(barLength)}${' '.repeat(8-barLength)} (${day.incidents})`;
  }).join('\n');
  
  return bars;
}

/**
 * Get threat level description based on stats
 * @param {Object} stats - Security statistics
 * @returns {string} Threat level description
 */
function getThreatLevelDescription(stats) {
  const totalIncidents = stats.totalIncidents;
  
  if (totalIncidents === 0) {
    return '🟢 **Low** - No security incidents detected in the past 7 days.';
  } else if (totalIncidents <= 5) {
    return '🟡 **Moderate** - Some security incidents detected. Server security is functioning normally.';
  } else if (totalIncidents <= 15) {
    return '🟠 **Elevated** - Multiple security incidents detected. Increased vigilance recommended.';
  } else {
    return '🔴 **Critical** - High number of security incidents detected. Immediate security review recommended.';
  }
}

/**
 * Get a color based on security level
 * @param {number} level - Security level (0-10)
 * @returns {number} Discord color integer
 */
function getSecurityLevelColor(level) {
  if (level <= 3) return 0xFF0000; // Red
  if (level <= 5) return 0xFF9900; // Orange
  if (level <= 7) return 0xFFFF00; // Yellow
  return 0x00FF00; // Green
}

/**
 * Generate an overview chart
 * @param {Object} stats - Security statistics
 * @returns {AttachmentBuilder} Discord attachment
 */
async function generateOverviewChart(stats) {
  const width = 800;
  const height = 400;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = '#2F3136';
  ctx.fillRect(0, 0, width, height);
  
  // Draw header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Security Overview', 50, 50);
  
  // Draw security gauge
  drawSecurityGauge(ctx, stats.securityLevel, 400, 150, 120);
  
  // Draw incident bar chart
  drawIncidentBarChart(ctx, stats, 150, 300, 500, 150);
  
  // Convert to attachment
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'security-overview.png' });
}

/**
 * Generate a threat distribution chart
 * @param {Object} stats - Security statistics
 * @returns {AttachmentBuilder} Discord attachment
 */
async function generateThreatChart(stats) {
  const width = 800;
  const height = 400;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = '#2F3136';
  ctx.fillRect(0, 0, width, height);
  
  // Draw header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Threat Distribution', 50, 50);
  
  // Draw pie chart of threat types
  drawThreatPieChart(ctx, stats, 400, 200, 150);
  
  // Convert to attachment
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'threat-distribution.png' });
}

/**
 * Generate an activity chart
 * @param {Array} hourlyDistribution - Distribution of incidents by hour
 * @returns {AttachmentBuilder} Discord attachment
 */
async function generateActivityChart(hourlyDistribution) {
  const width = 800;
  const height = 400;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = '#2F3136';
  ctx.fillRect(0, 0, width, height);
  
  // Draw header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('24-Hour Activity Pattern', 50, 50);
  
  // Draw line chart of hourly activity
  drawActivityLineChart(ctx, hourlyDistribution, 50, 100, 700, 250);
  
  // Convert to attachment
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'activity-pattern.png' });
}

/**
 * Generate an audit chart
 * @param {Object} stats - Security statistics
 * @returns {AttachmentBuilder} Discord attachment
 */
async function generateAuditChart(stats) {
  const width = 800;
  const height = 400;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = '#2F3136';
  ctx.fillRect(0, 0, width, height);
  
  // Draw header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Moderation Actions', 50, 50);
  
  // Draw bar chart of moderation actions
  drawModActionBarChart(ctx, stats, 150, 150, 500, 200);
  
  // Convert to attachment
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'audit-summary.png' });
}

/**
 * Draw a security gauge on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} level - Security level (0-10)
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} radius - Radius of gauge
 */
function drawSecurityGauge(ctx, level, x, y, radius) {
  // Draw gauge background
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI, 0, false);
  ctx.lineWidth = 30;
  ctx.strokeStyle = '#444444';
  ctx.stroke();
  
  // Calculate level as percentage
  const percentage = level / 10;
  
  // Determine color based on level
  let gaugeColor;
  if (level <= 3) gaugeColor = '#FF0000';
  else if (level <= 7) gaugeColor = '#FFFF00';
  else gaugeColor = '#00FF00';
  
  // Draw gauge level
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI, Math.PI * (1 - percentage), false);
  ctx.lineWidth = 30;
  ctx.strokeStyle = gaugeColor;
  ctx.stroke();
  
  // Draw center text
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(`${level}`, x, y + 15);
  ctx.font = '20px Arial';
  ctx.fillText('Security Level', x, y + 45);
}

/**
 * Draw an incident bar chart on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Security statistics
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 */
function drawIncidentBarChart(ctx, stats, x, y, width, height) {
  const data = [
    { label: 'Spam', value: stats.spamIncidents, color: '#FF6384' },
    { label: 'Raid', value: stats.raidIncidents, color: '#36A2EB' },
    { label: 'Nuke', value: stats.nukeIncidents, color: '#FFCE56' },
    { label: 'Scam', value: stats.scamIncidents, color: '#4BC0C0' }
  ];
  
  const maxValue = Math.max(...data.map(item => item.value), 1);
  const barWidth = width / data.length / 2;
  const barSpacing = width / data.length;
  
  // Draw axes
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - height);
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  
  // Draw bars
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * height;
    const barX = x + (barSpacing * index) + (barSpacing / 4);
    
    // Draw bar
    ctx.fillStyle = item.color;
    ctx.fillRect(barX, y - barHeight, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText(item.label, barX + barWidth / 2, y + 20);
    
    // Draw value
    ctx.fillText(item.value.toString(), barX + barWidth / 2, y - barHeight - 10);
  });
  
  // Draw title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Incident Types', x + width / 2, y - height - 10);
}

/**
 * Draw a threat pie chart on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Security statistics
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} radius - Radius of pie chart
 */
function drawThreatPieChart(ctx, stats, x, y, radius) {
  const data = [
    { label: 'Spam', value: stats.spamIncidents, color: '#FF6384' },
    { label: 'Raid', value: stats.raidIncidents, color: '#36A2EB' },
    { label: 'Nuke', value: stats.nukeIncidents, color: '#FFCE56' },
    { label: 'Scam', value: stats.scamIncidents, color: '#4BC0C0' }
  ];
  
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1; // Avoid division by zero
  
  let startAngle = 0;
  
  // Draw pie slices
  data.forEach(item => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    
    ctx.fillStyle = item.color;
    ctx.fill();
    
    // Calculate position for label
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 1.3;
    const labelX = x + Math.cos(labelAngle) * labelRadius;
    const labelY = y + Math.sin(labelAngle) * labelRadius;
    
    // Draw label
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText(`${item.label}: ${item.value}`, labelX, labelY);
    
    startAngle += sliceAngle;
  });
  
  // Draw title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Security Incidents', x, y - radius - 20);
}

/**
 * Draw an activity line chart on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} hourlyData - Hourly incident data
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 */
function drawActivityLineChart(ctx, hourlyData, x, y, width, height) {
  const maxValue = Math.max(...hourlyData, 1);
  const xStep = width / (hourlyData.length - 1);
  
  // Draw axes
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.stroke();
  
  // Draw horizontal grid lines
  ctx.strokeStyle = '#444444';
  ctx.setLineDash([5, 5]);
  for (let i = 0; i <= 5; i++) {
    const gridY = y + height - (height * i / 5);
    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x + width, gridY);
    ctx.stroke();
    
    // Draw y-axis labels
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(Math.round(maxValue * i / 5).toString(), x - 5, gridY + 4);
  }
  ctx.setLineDash([]);
  
  // Draw x-axis labels (hours)
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '12px Arial';
  for (let i = 0; i < hourlyData.length; i += 2) {
    const hour = i.toString().padStart(2, '0') + ':00';
    ctx.fillText(hour, x + i * xStep, y + height + 20);
  }
  
  // Draw line
  ctx.beginPath();
  ctx.moveTo(x, y + height - (hourlyData[0] / maxValue) * height);
  
  for (let i = 1; i < hourlyData.length; i++) {
    const dataY = y + height - (hourlyData[i] / maxValue) * height;
    ctx.lineTo(x + i * xStep, dataY);
  }
  
  ctx.strokeStyle = '#36A2EB';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw area under the line
  ctx.lineTo(x + (hourlyData.length - 1) * xStep, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(54, 162, 235, 0.2)';
  ctx.fill();
  
  // Draw data points
  for (let i = 0; i < hourlyData.length; i++) {
    const dataX = x + i * xStep;
    const dataY = y + height - (hourlyData[i] / maxValue) * height;
    
    ctx.beginPath();
    ctx.arc(dataX, dataY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#36A2EB';
    ctx.fill();
    
    // Show value on hover points
    if (hourlyData[i] > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = '12px Arial';
      ctx.fillText(hourlyData[i].toString(), dataX, dataY - 10);
    }
  }
  
  // Draw title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Activity by Hour (24h)', x + width / 2, y - 10);
}

/**
 * Draw a moderation action bar chart on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Security statistics
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 */
function drawModActionBarChart(ctx, stats, x, y, width, height) {
  const data = [
    { label: 'Bans', value: stats.bans, color: '#FF6384' },
    { label: 'Kicks', value: stats.kicks, color: '#36A2EB' },
    { label: 'Warnings', value: stats.warnings, color: '#FFCE56' }
  ];
  
  const maxValue = Math.max(...data.map(item => item.value), 1);
  const barWidth = width / data.length / 2;
  const barSpacing = width / data.length;
  
  // Draw axes
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.moveTo(x, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.stroke();
  
  // Draw bars
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * height;
    const barX = x + (barSpacing * index) + (barSpacing / 4);
    
    // Draw bar
    ctx.fillStyle = item.color;
    ctx.fillRect(barX, y + height - barHeight, barWidth, barHeight);
    
    // Draw label
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText(item.label, barX + barWidth / 2, y + height + 20);
    
    // Draw value
    ctx.fillText(item.value.toString(), barX + barWidth / 2, y + height - barHeight - 10);
  });
  
  // Draw title
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Moderation Actions', x + width / 2, y - 10);
}