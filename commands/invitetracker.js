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
            .setDescription('Custom welcome message with placeholders like {user}, {inviter}, etc.')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Get detailed help with custom welcome messages and placeholders'))
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
      case 'help':
        await showInviteTrackingHelp(interaction, client);
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
    
    // Preserve spaces and linebreaks in welcome message
    let welcomeMessage = interaction.options.getString('message');
    
    // Use default message if none provided
    if (!welcomeMessage) {
      welcomeMessage = '👋 Welcome {user} to {server}!\n\n' +
        '🎯 You were invited by **{inviter}**\n' +
        '💫 They have invited **{invites}** members';
    }
    
    // Make sure the message will work by properly handling any special characters
    welcomeMessage = welcomeMessage.replace(/\\n/g, '\n');
    
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
    config.updateServerConfig(serverId, {
      inviteSettings: serverConfig.inviteSettings
    });
    
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
        { name: '💬 Welcome Message', value: welcomeMessage, inline: false },
        { name: '📚 Available Placeholders', value: `You can use these placeholders in your welcome message:
• \`{user}\` - Mention the new member
• \`{username}\` - Member's username without mention
• \`{tag}\` - Member's full Discord tag
• \`{server}\` - Server name
• \`{servercount}\` - Number of members
• \`{inviter}\` - Mention of who invited them
• \`{invitername}\` - Username of who invited them
• \`{invitag}\` - Full Discord tag of who invited them
• \`{invites}\` - How many people the inviter has invited
• \`{invite-code}\` - The invite code used
• \`{date}\` - Current date
• \`{time}\` - Current time
        
Use \`\\n\` for a new line in your message.`, inline: false }
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
 * Show detailed help for invite tracking and custom welcome messages
 * @param {Object} interaction Discord interaction
 * @param {Object} client Discord client
 */
async function showInviteTrackingHelp(interaction, client) {
  await interaction.deferReply();
  
  try {
    const embed = new EmbedBuilder()
      .setTitle('🔍 Invite Tracking System Help')
      .setDescription('The invite tracking system allows you to track who invites new members to your server and customize welcome messages.')
      .addFields(
        { 
          name: '📋 Available Commands', 
          value: `
• \`/invitetracker setup\` - Set up invite tracking with a custom welcome message
• \`/invitetracker toggle\` - Enable or disable invite tracking
• \`/invitetracker stats\` - View server invite statistics
• \`/invitetracker leaderboard\` - See top inviters ranking
• \`/invitetracker info\` - Check who invited a specific user
• \`/invitetracker help\` - Show this help message
          `,
          inline: false 
        },
        { 
          name: '✨ Custom Welcome Messages', 
          value: `
You can create custom welcome messages with dynamic placeholders that will be replaced with actual data when a member joins.

**Example message:**
\`\`\`
👋 Welcome {user} to {server}!
You were invited by {inviter}
They have invited {invites} members so far
\`\`\`

You can use \`\\n\` for line breaks in your message.
          `,
          inline: false 
        },
        { 
          name: '📚 Available Placeholders', 
          value: `
• \`{user}\` - Mention the new member
• \`{username}\` - Member's username without mention
• \`{tag}\` - Member's full Discord tag
• \`{server}\` - Server name
• \`{servercount}\` - Number of members
• \`{inviter}\` - Mention of who invited them
• \`{invitername}\` - Username of who invited them
• \`{invitag}\` - Full Discord tag of who invited them
• \`{invites}\` - How many people the inviter has invited
• \`{invite-code}\` - The invite code used
• \`{date}\` - Current date
• \`{time}\` - Current time
          `,
          inline: false 
        },
        {
          name: '🔧 Setup Instructions',
          value: `
1. Run \`/invitetracker setup\` and select a channel for invite logs
2. Optionally add a custom welcome message with placeholders
3. The bot will log all new joins with invite information
4. Use \`/invitetracker stats\` to see who's inviting the most members
          `,
          inline: false
        },
        {
          name: '💡 Tips',
          value: `
• Make your welcome messages engaging with emojis and formatting
• Use the leaderboard to create invite competitions
• Use {invite-code} to track which invite links are most effective
• You can customize the welcome message anytime by running setup again
          `,
          inline: false
        }
      )
      .setColor('#5865F2')
      .setFooter({ text: 'Invite Tracking System v1.2' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error showing invite tracking help:', error);
    await interaction.editReply('❌ An error occurred while retrieving help information.');
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
    config.updateServerConfig(serverId, {
      inviteSettings: serverConfig.inviteSettings
    });
    
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
  // Set up invites cache once at startup
  let initialSetupDone = false;
  
  // Fetch and cache all guild invites when the bot starts
  client.on('ready', async () => {
    if (initialSetupDone) return;
    
    console.log("Initializing invite tracking system...");
    for (const guild of client.guilds.cache.values()) {
      try {
        // Get server config to check if invite tracking is enabled
        const serverId = guild.id;
        const serverConfig = config.getServerConfig(serverId);
        
        // Only cache invites if tracking is enabled for this server
        if (serverConfig.inviteSettings?.enabled) {
          const invites = await guild.invites.fetch();
          guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
          console.log(`🔍 Cached invites for ${guild.name} (${invites.size} invites)`);
          
          // Initialize the database tables if needed
          await inviteTracker.initializeTables();
          
          // Save all current invites to database for tracking
          for (const invite of invites.values()) {
            await inviteTracker.saveInvite(invite);
          }
        }
      } catch (error) {
        console.error(`Could not cache invites for ${guild.name}:`, error);
      }
    }
    console.log("✅ Invite tracking system initialized successfully");
    initialSetupDone = true;
  });
  
  // Update cache when a new invite is created
  client.on('inviteCreate', async invite => {
    try {
      const serverId = invite.guild.id;
      const serverConfig = config.getServerConfig(serverId);
      
      // Only process if invite tracking is enabled for this server
      if (!serverConfig.inviteSettings?.enabled) return;
      
      // Fetch and update cache
      const invites = await invite.guild.invites.fetch();
      guildInvites.set(invite.guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
      
      // Save new invite to database
      await inviteTracker.saveInvite(invite);
      
      console.log(`New invite created in ${invite.guild.name}: ${invite.code} by ${invite.inviter?.tag || 'Unknown'}`);
    } catch (error) {
      console.error('Error handling invite create:', error);
    }
  });
  
  // Track which invite was used when a member joins
  client.on('guildMemberAdd', async member => {
    const { guild } = member;
    const serverId = guild.id;
    
    console.log(`🔎 Member ${member.user.tag} joined ${guild.name} (${serverId}) - processing invite tracking`);
    
    // Skip if guild has no invites cache
    if (!guildInvites.has(serverId)) {
      try {
        // Try to initialize the cache for this guild
        console.log(`📥 No invite cache found for ${guild.name} - initializing now`);
        const invites = await guild.invites.fetch();
        guildInvites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
        console.log(`✅ Late-initialized invite cache for ${guild.name} with ${invites.size} invites`);
      } catch (error) {
        console.error(`❌ Could not initialize invite cache for ${guild.name}:`, error);
        // Don't return here - we should still continue with welcome message even if invite tracking fails
      }
    }
    
    try {
      // Get server config
      const serverConfig = config.getServerConfig(serverId);
      console.log(`📋 Loaded server config for ${guild.name} - invite tracking enabled: ${serverConfig.inviteSettings?.enabled ? 'Yes' : 'No'}`);
      
      // Define usedInvite variable at the beginning to avoid scope issues
      let usedInvite = null;

      // Check if invite tracking is enabled
      if (!serverConfig.inviteSettings?.enabled) {
        console.log(`⏩ Invite tracking disabled for ${guild.name} - skipping invite tracking`);
        // Don't return here - this should only skip the invite tracking part, not the welcome message
      } else {
        try {
          // Fetch latest invites
          console.log(`🔍 Fetching latest invites for ${guild.name}`);
          const newInvites = await guild.invites.fetch();
          console.log(`📊 Fetched ${newInvites.size} current invites for ${guild.name}`);
          
          // Get cached invites
          const cachedInvites = guildInvites.get(serverId);
          
          // Find the invite that was used by comparing uses count
          usedInvite = newInvites.find(invite => {
            const cachedUses = cachedInvites.get(invite.code) || 0;
            const currentUses = invite.uses || 0;
            const wasUsed = currentUses > cachedUses;
            
            if (wasUsed) {
              console.log(`🎯 Found used invite: ${invite.code} (uses: ${cachedUses} → ${currentUses})`);
            }
            
            return wasUsed;
          });
          
          // If no invite was found (could happen with vanity URLs), use the first invite as fallback
          if (!usedInvite && newInvites.size > 0) {
            console.log(`⚠️ Could not find specific invite for ${member.user.tag} in ${guild.name} - using fallback`);
            usedInvite = newInvites.first();
          }
          
          // Update invite cache with the latest uses counts
          guildInvites.set(serverId, new Map(newInvites.map(invite => [invite.code, invite.uses])));
          console.log(`🔄 Updated invite cache for ${guild.name}`);
          
          // If still no invite found, log but continue (don't return)
          if (!usedInvite) {
            console.log(`⚠️ Could not determine which invite was used for ${member.user.tag} in ${guild.name}`);
            // Note: Don't return here; we should continue to welcome message
          } else {
            // Process the invite that was used
            console.log(`✅ Determined that ${member.user.tag} used invite code ${usedInvite.code}`);
          }
        } catch (inviteError) {
          console.error(`❌ Error processing invites for ${guild.name}:`, inviteError);
          // Continue execution even if invite processing fails
        }
      }
      
      // Only if we have a valid invite, save it and process invite tracking logic
      if (usedInvite) {
        // Get inviter and save join record to database
        const inviterId = usedInvite.inviter ? usedInvite.inviter.id : '0';
        try {
          await inviteTracker.saveInviteJoin(member, usedInvite.code, inviterId);
          console.log(`✅ Saved invite join record for ${member.user.tag} (Invite: ${usedInvite.code}, Inviter: ${usedInvite.inviter?.tag || 'Unknown'})`);
        } catch (dbError) {
          console.error(`❌ Failed to save invite join record:`, dbError);
          // Continue anyway - we want the welcome message to work even if DB operations fail
        }
        
        console.log(`👋 Member ${member.user.tag} joined ${guild.name} using invite code ${usedInvite.code} from ${usedInvite.inviter?.tag || 'Unknown'}`);
        
        // Process welcome message if a log channel is configured
        const logChannelId = serverConfig.inviteSettings?.logChannelId;
        console.log(`🔍 Looking for log channel ID ${logChannelId || 'none'} in server ${guild.name}`);
        
        if (!logChannelId) {
          console.log(`⚠️ No log channel configured for invite tracking in ${guild.name}`);
        } else {
          const logChannel = guild.channels.cache.get(logChannelId);
          if (!logChannel) {
            console.log(`❌ Invite log channel ${logChannelId} not found in guild ${serverId}`);
          } else {
            console.log(`✅ Found log channel #${logChannel.name} for invite tracking`);
          }
        }
      } else {
        console.log(`⚠️ No valid invite found for ${member.user.tag} in ${guild.name} - skipping invite tracking`);
      }
      
      // Always check if the guild has a welcome channel configured in the main welcome settings
      // This should run regardless of invite tracking status
      if (serverConfig.welcomeSettings?.enabled && serverConfig.welcomeSettings?.channelId) {
        console.log(`✓ Welcome messages are enabled for ${guild.name} in channel ${serverConfig.welcomeSettings.channelId}`);
      } else {
        console.log(`✗ Welcome messages not enabled or no channel set for ${guild.name}`);
      }
      
      // If no invite tracking channel is set but we found a valid invite, continue with welcome logic
      const logChannelId = serverConfig.inviteSettings?.logChannelId;
      if (!logChannelId) {
        console.log(`⏩ No invite tracking log channel set - skipping invite tracking welcome message`);
        return;
      }
      
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        console.log(`⏩ Invite log channel ${logChannelId} not found in guild ${serverId} - skipping invite welcome message`);
        return;
      }
      
      // Make sure we have a valid invite to proceed
      if (!usedInvite) {
        console.log(`⏩ No valid invite found for sending welcome message in ${guild.name}`);
        return;
      }
      
      // Get inviter ID
      const inviterId = usedInvite.inviter ? usedInvite.inviter.id : '0';
      
      // Get inviter's total invite count
      let inviteCount = 0;
      try {
        const invitedMembers = await inviteTracker.getInvitedMembers(serverId, inviterId);
        inviteCount = invitedMembers.length;
        console.log(`📊 Fetched invite count for ${usedInvite.inviter?.tag || 'Unknown'}: ${inviteCount} members invited`);
      } catch (error) {
        console.error(`❌ Error getting invited members:`, error);
        // Continue with inviteCount = 0
      }
      
      // Format welcome message
      let welcomeMessage = serverConfig.inviteSettings.welcomeMessage || 
        '👋 Welcome {user} to {server}!\n\n' +
        '🎯 You were invited by **{inviter}**\n' +
        '💫 They have invited **{invites}** members';
        
      // Parse and replace all placeholders with proper data
      try {
        // Handle any escaped newlines
        welcomeMessage = welcomeMessage.replace(/\\n/g, '\n');
        
        // Replace all placeholders
        welcomeMessage = welcomeMessage
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, member.user.username)
          .replace(/{tag}/g, member.user.tag)
          .replace(/{server}/g, guild.name)
          .replace(/{servercount}/g, guild.memberCount.toString())
          .replace(/{inviter}/g, usedInvite.inviter ? `<@${usedInvite.inviter.id}>` : 'Unknown')
          .replace(/{invitername}/g, usedInvite.inviter ? usedInvite.inviter.username : 'Unknown')
          .replace(/{invitag}/g, usedInvite.inviter ? usedInvite.inviter.tag : 'Unknown')
          .replace(/{invites}/g, inviteCount.toString())
          .replace(/{invite-code}/g, usedInvite.code)
          .replace(/{invite-url}/g, usedInvite.url)
          .replace(/{date}/g, new Date().toLocaleDateString())
          .replace(/{time}/g, new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error formatting welcome message:', error);
        
        // Fallback to simple message if formatting fails
        welcomeMessage = `Welcome <@${member.id}> to ${guild.name}!`;
      }
      
      // Create embed with rich member join information
      const embed = new EmbedBuilder()
        .setTitle('👋 New Member Joined')
        .setDescription(welcomeMessage)
        .setColor('#43B581')
        .setTimestamp();
      
      // Add member avatar as thumbnail
      if (member.user.displayAvatarURL()) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
      }
      
      // Add detailed fields about the user and invite
      embed.addFields([
        { name: '👤 Member', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
        { name: '🎯 Invited By', value: usedInvite.inviter ? `<@${usedInvite.inviter.id}>` : 'Unknown', inline: true },
        { name: '📊 Total Invites', value: inviteCount.toString(), inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🔗 Invite Code', value: `\`${usedInvite.code}\``, inline: true }
      ]);
      
      // Send welcome/tracking message to log channel
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error tracking invite for ${member.user.tag}:`, error);
    }
  });
  
  // Handle invite deleted event
  client.on('inviteDelete', async invite => {
    try {
      const serverId = invite.guild.id;
      const serverConfig = config.getServerConfig(serverId);
      
      // Only process if invite tracking is enabled for this server
      if (!serverConfig.inviteSettings?.enabled) return;
      
      console.log(`Invite deleted in ${invite.guild.name}: ${invite.code}`);
      
      // Update cache by fetching all guild invites
      try {
        const invites = await invite.guild.invites.fetch();
        guildInvites.set(invite.guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
      } catch (error) {
        console.error(`Error fetching invites after delete: ${error.message}`);
        
        // If fetching fails, at least remove the deleted invite from cache
        const cachedInvites = guildInvites.get(invite.guild.id);
        if (cachedInvites) {
          cachedInvites.delete(invite.code);
        }
      }
    } catch (error) {
      console.error('Error handling invite delete:', error);
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