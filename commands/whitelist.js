const { EmbedBuilder, PermissionFlagsBits, ApplicationCommandOptionType } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'whitelist',
  description: 'Whitelist users or roles from security checks',
  guildOnly: false, // Allow usage anywhere with proper error handling
  requiresAdmin: true,
  options: [
    {
      name: 'add_user',
      description: 'Add a user to the security whitelist',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to whitelist',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    },
    {
      name: 'remove_user',
      description: 'Remove a user from the security whitelist',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to remove from whitelist',
          type: ApplicationCommandOptionType.User,
          required: true
        }
      ]
    },
    {
      name: 'add_role',
      description: 'Add a role to the security whitelist',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'The role to whitelist',
          type: ApplicationCommandOptionType.Role,
          required: true
        }
      ]
    },
    {
      name: 'remove_role',
      description: 'Remove a role from the security whitelist',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'The role to remove from whitelist',
          type: ApplicationCommandOptionType.Role,
          required: true
        }
      ]
    },
    {
      name: 'list',
      description: 'Show current whitelist',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'set_action',
      description: 'Set the action to take when security issues are detected',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'action',
          description: 'The action to take',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' },
            { name: 'Quarantine', value: 'quarantine' },
            { name: 'Timeout (1 hour)', value: 'timeout' },
            { name: 'Log Only', value: 'log_only' }
          ]
        }
      ]
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Always defer reply for slash commands to prevent timeout
    if (isSlashCommand && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(err => {
        console.error(`[Whitelist] Failed to defer reply: ${err}`);
      });
    }
    
    // Get the guild ID from message or interaction
    const serverId = interaction?.guild?.id || message?.guild?.id;
    
    // Handle command used outside a server gracefully
    if (!serverId) {
      console.log('Whitelist command used outside a server - providing helpful response');
      if (isSlashCommand) {
        return interaction.followUp({ 
          content: '👋 This command is designed for server security, so it needs to be used in a server where you want to whitelist users or roles. Please try again in your Discord server!', 
          ephemeral: true 
        });
      } else {
        return message.reply('👋 This command is designed for server security, so it needs to be used in a server where you want to whitelist users or roles. Please try again in your Discord server!');
      }
    }
    
    // Check for admin permissions
    const member = interaction?.member || message?.member;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction
        ? interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true })
        : message.reply('❌ You need Administrator permissions to use this command!');
    }
    
    // For slash commands
    if (interaction) {
      // We've already deferred the reply above, no need to defer again
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      // Load server config
      const serverConfig = config.getServerConfig(serverId);
      
      switch (subcommand) {
        case 'add_user': {
          const user = interaction.options.getUser('user');
          
          // Initialize the whitelist array if needed
          if (!serverConfig.whitelistedUsers) {
            serverConfig.whitelistedUsers = [];
          }
          
          // Check if user is already whitelisted
          if (serverConfig.whitelistedUsers.includes(user.id)) {
            return interaction.followUp(`⚠️ User ${user.tag} is already whitelisted!`);
          }
          
          // Add user to whitelist
          serverConfig.whitelistedUsers.push(user.id);
          config.updateServerConfig(serverId, { whitelistedUsers: serverConfig.whitelistedUsers });
          
          return interaction.followUp(`✅ User **${user.tag}** added to security whitelist!`);
        }
        
        case 'remove_user': {
          const user = interaction.options.getUser('user');
          
          // Check if whitelist exists
          if (!serverConfig.whitelistedUsers || !serverConfig.whitelistedUsers.includes(user.id)) {
            return interaction.followUp(`⚠️ User ${user.tag} is not in the whitelist!`);
          }
          
          // Remove user from whitelist
          serverConfig.whitelistedUsers = serverConfig.whitelistedUsers.filter(id => id !== user.id);
          config.updateServerConfig(serverId, { whitelistedUsers: serverConfig.whitelistedUsers });
          
          return interaction.followUp(`🗑️ User **${user.tag}** removed from security whitelist!`);
        }
        
        case 'add_role': {
          const role = interaction.options.getRole('role');
          
          // Initialize the whitelist array if needed
          if (!serverConfig.whitelistedRoles) {
            serverConfig.whitelistedRoles = [];
          }
          
          // Check if role is already whitelisted
          if (serverConfig.whitelistedRoles.includes(role.id)) {
            return interaction.followUp(`⚠️ Role ${role.name} is already whitelisted!`);
          }
          
          // Add role to whitelist
          serverConfig.whitelistedRoles.push(role.id);
          config.updateServerConfig(serverId, { whitelistedRoles: serverConfig.whitelistedRoles });
          
          return interaction.followUp(`✅ Role **${role.name}** added to security whitelist!`);
        }
        
        case 'remove_role': {
          const role = interaction.options.getRole('role');
          
          // Check if whitelist exists
          if (!serverConfig.whitelistedRoles || !serverConfig.whitelistedRoles.includes(role.id)) {
            return interaction.followUp(`⚠️ Role ${role.name} is not in the whitelist!`);
          }
          
          // Remove role from whitelist
          serverConfig.whitelistedRoles = serverConfig.whitelistedRoles.filter(id => id !== role.id);
          config.updateServerConfig(serverId, { whitelistedRoles: serverConfig.whitelistedRoles });
          
          return interaction.followUp(`🗑️ Role **${role.name}** removed from security whitelist!`);
        }
        
        case 'list': {
          // Create embed for whitelist information
          const whitelistEmbed = new EmbedBuilder()
            .setTitle('🛡️ Security Whitelist')
            .setColor(0x3498DB)
            .setDescription('Users and roles in the whitelist are exempt from security checks and actions.')
            .setFooter({ text: 'Phantom Guard Security System' })
            .setTimestamp();
            
          // Add whitelisted users
          const whitelistedUsers = serverConfig.whitelistedUsers || [];
          let userListText = 'No users whitelisted';
          
          if (whitelistedUsers.length > 0) {
            userListText = '';
            for (const userId of whitelistedUsers) {
              userListText += `• <@${userId}>\n`;
            }
          }
          
          whitelistEmbed.addFields({ name: '👤 Whitelisted Users', value: userListText });
          
          // Add whitelisted roles
          const whitelistedRoles = serverConfig.whitelistedRoles || [];
          let roleListText = 'No roles whitelisted';
          
          if (whitelistedRoles.length > 0) {
            roleListText = '';
            for (const roleId of whitelistedRoles) {
              roleListText += `• <@&${roleId}>\n`;
            }
          }
          
          whitelistEmbed.addFields({ name: '🏷️ Whitelisted Roles', value: roleListText });
          
          // Add current security action
          const actionType = serverConfig.securityActionType || 'quarantine';
          whitelistEmbed.addFields({ 
            name: '⚙️ Security Action',
            value: `Current action: **${actionType}**\n\nThis action is taken when security issues are detected.`
          });
          
          return interaction.followUp({ embeds: [whitelistEmbed] });
        }
        
        case 'set_action': {
          const action = interaction.options.getString('action');
          
          // Update the security action
          config.updateServerConfig(serverId, { securityActionType: action });
          
          // Create user-friendly action name
          let actionName;
          switch (action) {
            case 'ban': actionName = 'Ban'; break;
            case 'kick': actionName = 'Kick'; break;
            case 'quarantine': actionName = 'Quarantine'; break;
            case 'timeout': actionName = 'Timeout (1 hour)'; break;
            case 'log_only': actionName = 'Log Only (no action)'; break;
            default: actionName = action;
          }
          
          // Create confirmation embed
          const actionEmbed = new EmbedBuilder()
            .setTitle('⚙️ Security Action Updated')
            .setColor(0x2ECC71)
            .setDescription(`Security action set to: **${actionName}**\n\nThis action will be taken when security issues are detected.`)
            .setFooter({ text: 'Phantom Guard Security System' })
            .setTimestamp();
            
          // If quarantine is selected, check if a role is set
          if (action === 'quarantine' && !serverConfig.quarantineRoleId) {
            actionEmbed.addFields({
              name: '⚠️ Quarantine Role Not Set',
              value: `No quarantine role is configured. Please set one with \`/setup quarantine_role\` or the bot will use timeouts instead.`
            });
          }
            
          return interaction.followUp({ embeds: [actionEmbed] });
        }
      }
    } else {
      // For regular command usage (!whitelist)
      return message.reply('This command requires the slash command format: `/whitelist` with appropriate options.');
    }
  }
};