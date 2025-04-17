const config = require('../utils/config');

module.exports = {
  name: 'ban',
  description: 'Ban a user from the server with optional reason and delete days',
  usage: '/ban [user] [reason] [delete_days] [notify]',
  guildOnly: true, // This command can only be used in servers
  options: [
    {
      name: 'user',
      type: 6, // USER type
      description: 'The user to ban',
      required: true
    },
    {
      name: 'reason',
      type: 3, // STRING type
      description: 'Reason for banning the user',
      required: false
    },
    {
      name: 'delete_days',
      type: 4, // INTEGER type
      description: 'Number of days of messages to delete (0-7)',
      required: false,
      choices: [
        {
          name: 'None',
          value: 0
        },
        {
          name: '1 Day',
          value: 1
        },
        {
          name: '3 Days',
          value: 3
        },
        {
          name: '7 Days',
          value: 7
        }
      ]
    },
    {
      name: 'notify',
      type: 5, // BOOLEAN type
      description: 'Send the user a DM notification about the ban',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins or moderators can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get parameters
    let targetUser, reason, deleteDays, shouldNotify;
    
    if (isSlashCommand) {
      targetUser = interaction.options.getUser('user');
      reason = interaction.options.getString('reason') || 'No reason provided';
      deleteDays = interaction.options.getInteger('delete_days') ?? 0; // Default to 0
      shouldNotify = interaction.options.getBoolean('notify') ?? true; // Default to true
      
      // Defer reply as banning might take time
      await interaction.deferReply();
    } else {
      // Legacy command not supported for moderation
      return message.reply('Please use the slash command `/ban` for moderation actions.');
    }
    
    // Get the guild and check permissions
    const guild = interaction.guild;
    
    // Get the member to ban
    const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(err => {
      console.error(`Error fetching member ${targetUser.id}:`, err);
      return null;
    });
    
    // Check if bot has permission to ban
    if (!guild.members.me.permissions.has('BanMembers')) {
      return interaction.followUp('❌ I do not have permission to ban members in this server.');
    }
    
    // Check if command user has permission to ban
    if (!interaction.member.permissions.has('BanMembers')) {
      return interaction.followUp('❌ You do not have permission to ban members in this server.');
    }
    
    // Check if trying to ban self
    if (targetUser.id === interaction.user.id) {
      return interaction.followUp('❌ You cannot ban yourself.');
    }
    
    // Check if trying to ban the bot
    if (targetUser.id === client.user.id) {
      return interaction.followUp('❌ I cannot ban myself.');
    }
    
    // Check if target is bannable (if they are a member of the guild)
    if (targetMember && !targetMember.bannable) {
      return interaction.followUp(`❌ I cannot ban ${targetUser.tag} as they have higher permissions than me.`);
    }
    
    // Try to DM the user if notify is true
    if (shouldNotify && targetMember) {
      try {
        const dmEmbed = {
          title: `You've been banned from ${guild.name}`,
          description: `You have been banned from **${guild.name}** by ${interaction.user.tag}.`,
          color: 0xFF0000,
          fields: [
            {
              name: 'Reason',
              value: reason
            }
          ],
          timestamp: new Date()
        };
        
        await targetUser.send({ embeds: [dmEmbed] }).catch(err => {
          console.log(`Could not DM user ${targetUser.tag}:`, err);
        });
      } catch (error) {
        console.error(`Error sending DM to ${targetUser.tag}:`, error);
        // Continue with ban even if DM fails
      }
    }
    
    // Ban the user
    try {
      await guild.members.ban(targetUser.id, { 
        deleteMessageDays: deleteDays,
        reason: `${reason} | Banned by ${interaction.user.tag}`
      });
      
      // Create embed for success message
      const successEmbed = {
        title: '🔨 User Banned',
        description: `**${targetUser.tag}** has been banned from the server.`,
        color: 0xFF0000,
        fields: [
          {
            name: 'User',
            value: `<@${targetUser.id}> (${targetUser.id})`
          },
          {
            name: 'Reason',
            value: reason
          },
          {
            name: 'Message History Deleted',
            value: deleteDays > 0 ? `Last ${deleteDays} day(s)` : 'None'
          },
          {
            name: 'Moderator',
            value: `<@${interaction.user.id}> (${interaction.user.tag})`
          }
        ],
        timestamp: new Date()
      };
      
      // Send success message
      await interaction.followUp({ embeds: [successEmbed] });
      
      // Log action to notification channel if configured
      if (serverConfig.notificationChannelId) {
        const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
        if (notificationChannel) {
          await notificationChannel.send({ embeds: [successEmbed] });
        }
      }
      
      // Store in mod logs
      const modLogs = serverConfig.modLogs || [];
      modLogs.push({
        type: 'ban',
        userId: targetUser.id,
        username: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason: reason,
        deleteDays: deleteDays,
        timestamp: new Date().toISOString()
      });
      
      // Trim logs if too large
      while (modLogs.length > 100) {
        modLogs.shift();
      }
      
      // Save to server config
      config.updateServerConfig(serverId, {
        modLogs: modLogs
      });
      
    } catch (error) {
      console.error(`Error banning user ${targetUser.tag}:`, error);
      await interaction.followUp(`❌ An error occurred while trying to ban ${targetUser.tag}: ${error.message}`);
    }
  },
};