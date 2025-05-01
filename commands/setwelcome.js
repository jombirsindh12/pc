const config = require('../utils/config');

module.exports = {
  name: 'setwelcome',
  description: 'Set up welcome messages for new server members',
  usage: '/setwelcome [channel] [message]',
  options: [
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Channel to send welcome messages in',
      required: true
    },
    {
      name: 'message',
      type: 3, // STRING type
      description: 'Custom welcome message (use {user} for mention, {server} for server name)',
      required: false
    },
    {
      name: 'title',
      type: 3, // STRING type
      description: 'Custom title for welcome embed',
      required: false
    },
    {
      name: 'color',
      type: 3, // STRING type
      description: 'Custom color for welcome embed (hex code)',
      required: false
    },
    {
      name: 'role',
      type: 8, // ROLE type
      description: 'Role to give new members automatically',
      required: false
    },
    {
      name: 'disable',
      type: 5, // BOOLEAN type
      description: 'Disable welcome messages',
      required: false
    }
  ],
  guildOnly: true, // This command can only be used in servers
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get parameters
    let channel, welcomeMessage, welcomeTitle, welcomeColor, welcomeRole, disable;
    
    if (isSlashCommand) {
      channel = interaction.options.getChannel('channel');
      welcomeMessage = interaction.options.getString('message');
      welcomeTitle = interaction.options.getString('title');
      welcomeColor = interaction.options.getString('color');
      welcomeRole = interaction.options.getRole('role');
      disable = interaction.options.getBoolean('disable');
      
      // Defer reply
      await interaction.deferReply();
    } else {
      // Legacy command handling - simplified since we're focusing on slash commands
      return message.reply('Please use the slash command `/setwelcome` instead.');
    }
    
    // If disabling welcome messages
    if (disable) {
      config.updateServerConfig(serverId, {
        welcomeSettings: {
          enabled: false
        }
      });
      
      return interaction.followUp('✅ Welcome messages have been disabled.');
    }
    
    // Validate channel is a text channel
    if (channel.type !== 0) { // 0 is GUILD_TEXT channel type
      return interaction.followUp('❌ The channel must be a text channel.');
    }
    
    // Set default welcome message if none provided
    if (!welcomeMessage) {
      welcomeMessage = 'Welcome {user} to {server}! We hope you enjoy your stay.';
    }
    
    // Set default welcome title if none provided
    if (!welcomeTitle) {
      welcomeTitle = '👋 Welcome to the server!';
    }
    
    // Set up welcome settings
    const welcomeSettings = {
      enabled: true,
      channelId: channel.id,
      message: welcomeMessage,
      title: welcomeTitle,
      color: welcomeColor || '5865F2',
      roleId: welcomeRole?.id || null,
      roleName: welcomeRole?.name || null
    };
    
    // Update server config
    config.updateServerConfig(serverId, {
      welcomeSettings: welcomeSettings
    });
    
    // Set up the welcome event handler if not already set
    if (!client._hasWelcomeHandler) {
      setupWelcomeHandler(client);
      client._hasWelcomeHandler = true;
    }
    
    // Create embed for success message
    // Ensure welcome message doesn't exceed Discord's 1024 character limit for embed fields
    const processedWelcomeMessage = welcomeMessage.replace('{user}', '@user').replace('{server}', interaction.guild.name);
    const truncatedMessage = processedWelcomeMessage.length > 1000 
      ? processedWelcomeMessage.substring(0, 1000) + '...' 
      : processedWelcomeMessage;
      
    const embed = {
      title: '✅ Welcome System Set Up',
      description: `Welcome messages will now be sent to <#${channel.id}>.`,
      color: 0x00FF00,
      fields: [
        {
          name: 'Welcome Message',
          value: truncatedMessage
        }
      ]
    };
    
    // Add role info if provided
    if (welcomeRole) {
      embed.fields.push({
        name: 'Auto-Role',
        value: `New members will automatically receive the <@&${welcomeRole.id}> role.`
      });
    }
    
    // Send success message
    await interaction.followUp({ embeds: [embed] });
    
    // Send an example welcome message
    // Also ensure the description doesn't exceed Discord's limits
    const processedDescription = welcomeMessage
      .replace('{user}', `<@${interaction.user.id}>`)
      .replace('{server}', interaction.guild.name);
    const truncatedDescription = processedDescription.length > 4000 
      ? processedDescription.substring(0, 4000) + '...' 
      : processedDescription;
      
    const exampleEmbed = {
      title: welcomeTitle,
      description: truncatedDescription,
      color: parseInt(welcomeColor?.replace('#', '') || '5865F2', 16),
      footer: {
        text: 'This is an example of how welcome messages will look'
      },
      timestamp: new Date()
    };
    
    // Add server icon if available
    if (interaction.guild.iconURL()) {
      exampleEmbed.thumbnail = {
        url: interaction.guild.iconURL({ dynamic: true })
      };
    }
    
    // Send example
    try {
      await channel.send({ embeds: [exampleEmbed] });
    } catch (error) {
      console.error('Error sending example welcome message:', error);
      await interaction.followUp('⚠️ I was able to set up welcome messages, but encountered an error sending a test message. Please check my permissions in that channel.');
    }
  },
};

// Setup welcome event handler
function setupWelcomeHandler(client) {
  const config = require('../utils/config');
  
  client.on('guildMemberAdd', async member => {
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if welcome messages are enabled
    if (!serverConfig.welcomeSettings?.enabled || !serverConfig.welcomeSettings?.channelId) return;
    
    // Get welcome channel
    const welcomeChannelId = serverConfig.welcomeSettings.channelId;
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) return;
    
    // Get welcome settings
    const welcomeSettings = serverConfig.welcomeSettings;
    
    // Create welcome embed
    // Ensure description doesn't exceed Discord's limit
    const processedDescription = welcomeSettings.message
      .replace('{user}', `<@${member.id}>`)
      .replace('{server}', member.guild.name);
    const truncatedDescription = processedDescription.length > 4000 
      ? processedDescription.substring(0, 4000) + '...' 
      : processedDescription;
      
    const welcomeEmbed = {
      title: welcomeSettings.title || '👋 Welcome to the server!',
      description: truncatedDescription,
      color: parseInt(welcomeSettings.color?.replace('#', '') || '5865F2', 16),
      timestamp: new Date()
    };
    
    // Add server icon if available
    if (member.guild.iconURL()) {
      welcomeEmbed.thumbnail = {
        url: member.guild.iconURL({ dynamic: true })
      };
    }
    
    // Add user avatar
    welcomeEmbed.author = {
      name: member.user.tag,
      icon_url: member.user.displayAvatarURL({ dynamic: true })
    };
    
    // Add join position
    welcomeEmbed.footer = {
      text: `Member #${member.guild.memberCount}`
    };
    
    // Send welcome message
    try {
      await welcomeChannel.send({ embeds: [welcomeEmbed] });
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
    
    // Auto-assign role if set
    if (welcomeSettings.roleId) {
      try {
        await member.roles.add(welcomeSettings.roleId);
        console.log(`Auto-assigned role ${welcomeSettings.roleName} to new member ${member.user.tag}`);
      } catch (error) {
        console.error(`Error auto-assigning role to ${member.user.tag}:`, error);
      }
    }
  });
  
  console.log('Welcome event handler has been set up');
}