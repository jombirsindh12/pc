const config = require('../utils/config');

module.exports = {
  name: 'setrole',
  description: 'Sets the role to be assigned to verified subscribers',
  usage: '!setrole [roleName]',
  guildOnly: true, // This command can only be used in servers
  execute(message, args, client) {
    // Check if user has admin permissions
    if (!message.member.permissions.has('ADMINISTRATOR')) {
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

    const serverId = message.guild.id;
    
    try {
      // Save the role ID to server config
      config.updateServerConfig(serverId, { 
        roleId: role.id,
        roleName: role.name
      });
      
      message.reply(`✅ Subscriber role has been set to **${role.name}**\nThis role will be assigned to users who verify their YouTube subscription.`);
      
      // Check bot permissions
      if (!message.guild.members.me.permissions.has('MANAGE_ROLES')) {
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
