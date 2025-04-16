const config = require('../utils/config');

module.exports = {
  name: 'kick',
  description: 'Kick a user from the server with optional reason',
  usage: '/kick [user] [reason]',
  options: [
    {
      name: 'user',
      type: 6, // USER type
      description: 'The user to kick',
      required: true
    },
    {
      name: 'reason',
      type: 3, // STRING type
      description: 'Reason for kicking the user',
      required: false
    },
    {
      name: 'notify',
      type: 5, // BOOLEAN type
      description: 'Send the user a DM notification about the kick',
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
    let targetUser, reason, shouldNotify;
    
    if (isSlashCommand) {
      targetUser = interaction.options.getUser('user');
      reason = interaction.options.getString('reason') || 'No reason provided';
      shouldNotify = interaction.options.getBoolean('notify') ?? true; // Default to true
      
      // Defer reply as kicking might take time
      await interaction.deferReply();
    } else {
      // Legacy command not supported for moderation
      return message.reply('Please use the slash command `/kick` for moderation actions.');
    }
    
    // Get the guild and check permissions
    const guild = interaction.guild;
    
    // Get the member to kick
    const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(err => {
      console.error(`Error fetching member ${targetUser.id}:`, err);
      return null;
    });
    
    // Check if target user exists in the guild
    if (!targetMember) {
      return interaction.followUp(`❌ Could not find user ${targetUser.tag} in this server.`);
    }
    
    // Check if bot has permission to kick
    if (!guild.members.me.permissions.has('KickMembers')) {
      return interaction.followUp('❌ I do not have permission to kick members in this server.');
    }
    
    // Check if command user has permission to kick
    if (!interaction.member.permissions.has('KickMembers')) {
      return interaction.followUp('❌ You do not have permission to kick members in this server.');
    }
    
    // Check if target is kickable
    if (!targetMember.kickable) {
      return interaction.followUp(`❌ I cannot kick ${targetUser.tag} as they have higher permissions than me.`);
    }
    
    // Check if trying to kick self
    if (targetUser.id === interaction.user.id) {
      return interaction.followUp('❌ You cannot kick yourself.');
    }
    
    // Check if trying to kick the bot
    if (targetUser.id === client.user.id) {
      return interaction.followUp('❌ I cannot kick myself.');
    }
    
    // Try to DM the user if notify is true
    if (shouldNotify) {
      try {
        const dmEmbed = {
          title: `You've been kicked from ${guild.name}`,
          description: `You have been kicked from **${guild.name}** by ${interaction.user.tag}.`,
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
        // Continue with kick even if DM fails
      }
    }
    
    // Kick the user
    try {
      await targetMember.kick(reason);
      
      // Create embed for success message
      const successEmbed = {
        title: '👢 User Kicked',
        description: `**${targetUser.tag}** has been kicked from the server.`,
        color: 0xFF9900,
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
        type: 'kick',
        userId: targetUser.id,
        username: targetUser.tag,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason: reason,
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
      console.error(`Error kicking user ${targetUser.tag}:`, error);
      await interaction.followUp(`❌ An error occurred while trying to kick ${targetUser.tag}: ${error.message}`);
    }
  },
};