const config = require('../utils/config');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'setrole',
  description: 'Sets the role to be assigned to verified subscribers',
  usage: '!setrole [roleName] or /setrole [role]',
  
  // Slash command options definition
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Sets the role to be assigned to verified subscribers')
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('The role to assign to verified subscribers')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  guildOnly: true, // This command can only be used in servers
  
  async execute(message, args, client, interaction = null) {
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const serverId = guild.id;
    
    // Handle slash command
    if (isSlashCommand) {
      try {
        // Get role from options
        const role = interaction.options.getRole('role');
        
        if (!role) {
          return await interaction.reply({
            content: '❌ Please provide a valid role.',
            ephemeral: true
          });
        }
        
        // Save the role ID to server config
        config.updateServerConfig(serverId, { 
          roleId: role.id,
          roleName: role.name
        });
        
        // Check bot permissions
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({
            content: '⚠️ **Warning**: I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission for role assignment to work.\n\n✅ Subscriber role has been set to **' + role.name + '**\nThis role will be assigned to users who verify their YouTube subscription.',
            ephemeral: true
          });
          return;
        }
        
        // Check role hierarchy
        if (guild.members.me.roles.highest.position <= role.position) {
          await interaction.reply({
            content: '⚠️ **Warning**: The selected role is higher than or equal to my highest role. Please move my role above this role in the server settings for role assignment to work.\n\n✅ Subscriber role has been set to **' + role.name + '**\nThis role will be assigned to users who verify their YouTube subscription.',
            ephemeral: true
          });
          return;
        }
        
        await interaction.reply({
          content: `✅ Subscriber role has been set to **${role.name}**\nThis role will be assigned to users who verify their YouTube subscription.`,
          ephemeral: false
        });
        
      } catch (error) {
        console.error('Error setting subscriber role (slash command):', error);
        
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the subscriber role. Please try again.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ An error occurred while setting the subscriber role. Please try again.',
            ephemeral: true
          });
        }
      }
      return;
    }
    
    // Legacy message command handling
    try {
      // Check if user has admin permissions
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need administrator permissions to use this command.');
      }

      // Check if a role name was provided
      if (!args.length) {
        return message.reply('❌ Please provide a role name. Usage: `!setrole [roleName]`');
      }

      const roleInput = args.join(' ');
      console.log(`Role input: "${roleInput}"`);
      
      // Check if the input is a role mention or ID
      let role;
      const roleMention = roleInput.match(/<@&(\d+)>/);
      
      if (roleMention) {
        // If it's a role mention, extract the ID
        const roleId = roleMention[1];
        console.log(`Detected role mention, ID: ${roleId}`);
        role = message.guild.roles.cache.get(roleId);
      } else if (/^\d+$/.test(roleInput)) {
        // If it's a numeric ID
        console.log(`Attempting to find role by ID: ${roleInput}`);
        role = message.guild.roles.cache.get(roleInput);
      } else {
        // Otherwise try to find by name
        console.log(`Attempting to find role by name: ${roleInput}`);
        role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());
      }
      
      console.log(`Role found:`, role ? `${role.name} (${role.id})` : 'No role found');

      if (!role) {
        return message.reply(`❌ Could not find role with name "${roleInput}". Please check the role name and try again.`);
      }

      // Save the role ID to server config
      config.updateServerConfig(serverId, { 
        roleId: role.id,
        roleName: role.name
      });
      
      message.reply(`✅ Subscriber role has been set to **${role.name}**\nThis role will be assigned to users who verify their YouTube subscription.`);
      
      // Check bot permissions
      if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        message.channel.send('⚠️ **Warning**: I don\'t have permission to manage roles. Please grant me the "Manage Roles" permission for role assignment to work.');
      }
      
      // Check role hierarchy
      if (message.guild.members.me.roles.highest.position <= role.position) {
        message.channel.send('⚠️ **Warning**: The selected role is higher than or equal to my highest role. Please move my role above this role in the server settings for role assignment to work.');
      }
    } catch (error) {
      console.error('Error setting subscriber role:', error);
      message.reply('❌ An error occurred while setting the subscriber role. Please try again.');
    }
  },
};
