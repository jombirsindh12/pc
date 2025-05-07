const config = require('../utils/config');
const { processEmojis } = require('../utils/emojiProcessor');

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
      name: 'image',
      type: 3, // STRING type
      description: 'URL of an image to show in welcome message (supports PNG, JPG, GIF)',
      required: false
    },
    {
      name: 'background',
      type: 3, // STRING type
      description: 'URL of a background image for the welcome message',
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
    let welcomeImage, welcomeBackground;
    
    if (isSlashCommand) {
      channel = interaction.options.getChannel('channel');
      welcomeMessage = interaction.options.getString('message');
      welcomeTitle = interaction.options.getString('title');
      welcomeColor = interaction.options.getString('color');
      welcomeRole = interaction.options.getRole('role');
      disable = interaction.options.getBoolean('disable');
      
      // Get new image and background options
      welcomeImage = interaction.options.getString('image');
      welcomeBackground = interaction.options.getString('background');
      
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
      welcomeMessage = '<a:lol:1301275117434966016> Hey**{mention}**,Do Check Out The Server.<a:lol:1301275117434966016>\n\n<a:arrow_heartright:1017682681024229377>🔹 **Read the Rules** → #📜・ʀᴜʟᴇs(Follow the guidelines & stay safe!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Get Free Panel** → #📜・ʀᴜʟᴇs(React Fast For Next Free Panel!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Stay Updated** → #📊・ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛs(Get the latest news & announcements!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Need Help?** → #❓・sᴜᴘᴘᴏʀᴛ(Facing issues? Get support here!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Chat & Chill** → #🌐・ɢᴇɴᴇʀᴀʟ-ᴄʜᴀᴛ(Meet new people & have fun!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Buy a Panel** → #💸・ᴘʀɪᴄᴇ-ʟɪsᴛ(For premium purchases & services!)<a:greenbolt:1215595223477125120>\n\n**💎 Exclusive Giveaways – Stay active for surprise rewards!**\n\n<a:1z_love:1350454898698178622> **Enjoy your stay & have fun!** <a:1z_love:1350454898698178622>';
    }
    
    // Set default welcome title if none provided
    if (!welcomeTitle) {
      welcomeTitle = '<a:redcrown:1025355756511432776>𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐏𝐇𝐀𝐍𝐓𝐎𝐌 𝐂𝐇𝐄𝐀𝐓𝐒 <a:redcrown:1025355756511432776>';
    }
    
    // Set up welcome settings
    const welcomeSettings = {
      enabled: true,
      channelId: channel.id,
      message: welcomeMessage,
      title: welcomeTitle,
      color: welcomeColor || '5865F2',
      roleId: welcomeRole?.id || null,
      roleName: welcomeRole?.name || null,
      imageUrl: welcomeImage || null,
      backgroundUrl: welcomeBackground || null
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
    
    // Add image info if provided
    if (welcomeImage) {
      embed.fields.push({
        name: '🖼️ Welcome Image',
        value: 'A custom image will be shown in welcome messages.'
      });
    } else {
      embed.fields.push({
        name: '🖼️ Welcome Image',
        value: "Member's profile picture will be displayed as the main image in welcome messages."
      });
    }
    
    // Add background info if provided
    if (welcomeBackground) {
      if (welcomeImage) {
        embed.fields.push({
          name: '🌄 Background Image',
          value: 'A custom background image is configured for welcome messages (shown as link).'
        });
      } else {
        embed.fields.push({
          name: '🌄 Background Image',
          value: 'A custom background image will be shown instead of profile picture.'
        });
      }
    }
    
    // Send success message
    await interaction.followUp({ embeds: [embed] });
    
    // Send an example welcome message
    // Also ensure the description doesn't exceed Discord's limits
    const processedDescription = welcomeMessage
      .replace('{user}', `<@${interaction.user.id}>`)
      .replace('{server}', interaction.guild.name)
      .replace('{mention}', `<@${interaction.user.id}>`); // Add support for {mention} as an alternative
    
    // Preserve multiple spaces by replacing them with HTML entities that Discord will render
    const spacesPreserved = processedDescription.replace(/  +/g, match => {
      return ' ' + '&nbsp;'.repeat(match.length - 1);
    });
    
    // Process emoji codes to Discord emoji format
    // Instead of our previous complex logic, we'll use our new emoji processor
    let formattedDescription = processEmojis(spacesPreserved, interaction.guild.emojis.cache);
    
    // Special direct replacements for known custom emojis
    formattedDescription = formattedDescription
      .replace(/:redcrown:/g, '<a:redcrown:1025355756511432776>')
      .replace(/:arrow_heartright:/g, '<a:arrow_heartright:1017682681024229377>')
      .replace(/:greenbolt:/g, '<a:greenbolt:1215595223477125120>')
      .replace(/:1z_love:/g, '<a:1z_love:1216659232003457065>')
      .replace(/:lol:/g, '<a:lol:1301275117434966016>');
      
    // Make sure we handle the syntax Discord expects for animated emojis 
    formattedDescription = formattedDescription
      .replace(/<a<<a:/g, '<a:')  // Fix double animated prefix
      .replace(/>>(\d+)/g, ':$1>'); // Fix closing format
      
    // Process any remaining standard emojis like :gem: -> 💎
    const standardEmojis = {
      ':gem:': '💎',
      ':small_blue_diamond:': '🔹',
      ':large_blue_diamond:': '🔷',
      ':crown:': '👑',
      ':heart:': '❤️',
    };
    
    Object.keys(standardEmojis).forEach(code => {
      formattedDescription = formattedDescription.replace(new RegExp(code, 'g'), standardEmojis[code]);
    });
    
    const truncatedDescription = formattedDescription.length > 4000 
      ? formattedDescription.substring(0, 4000) + '...' 
      : formattedDescription;
      
    const exampleEmbed = {
      title: welcomeTitle,
      description: truncatedDescription,
      color: parseInt(welcomeColor?.replace('#', '') || '5865F2', 16),
      footer: {
        text: 'This is an example of how welcome messages will look'
      },
      timestamp: new Date()
    };
    
    // Add server icon if available (as thumbnail)
    if (interaction.guild.iconURL()) {
      exampleEmbed.thumbnail = {
        url: interaction.guild.iconURL({ dynamic: true })
      };
    }
    
    // Add image if provided
    if (welcomeImage) {
      exampleEmbed.image = {
        url: welcomeImage
      };
    } 
    // If no custom image is set, use the user's profile picture as the main image
    else {
      exampleEmbed.image = {
        url: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
      };
    }
    
    // Handle background for example embed
    if (welcomeBackground) {
      // If we have a custom image, we can't show both - Discord limitation
      if (welcomeImage) {
        // If we already have a main image, we can add the background URL to the description
        exampleEmbed.description += `\n\n[Click for welcome background](${welcomeBackground})`;
      } 
      // If we're using profile picture as image, prioritize background image if available
      else {
        exampleEmbed.image = {
          url: welcomeBackground
        };
      }
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
      .replace('{server}', member.guild.name)
      .replace('{mention}', `<@${member.id}>`); // Add support for {mention} as alternative
      
    // Preserve multiple spaces by replacing them with HTML entities that Discord will render
    const spacesPreserved = processedDescription.replace(/  +/g, match => {
      return ' ' + '&nbsp;'.repeat(match.length - 1);
    });
    
    // Process emoji codes to Discord emoji format using new processor
    let formattedDescription = processEmojis(spacesPreserved, member.guild.emojis.cache);
    
    // Special direct replacements for known custom emojis
    formattedDescription = formattedDescription
      .replace(/:redcrown:/g, '<a:redcrown:1025355756511432776>')
      .replace(/:arrow_heartright:/g, '<a:arrow_heartright:1017682681024229377>')
      .replace(/:greenbolt:/g, '<a:greenbolt:1215595223477125120>')
      .replace(/:1z_love:/g, '<a:1z_love:1216659232003457065>')
      .replace(/:lol:/g, '<a:lol:1301275117434966016>');
      
    // Make sure we handle the syntax Discord expects for animated emojis 
    formattedDescription = formattedDescription
      .replace(/<a<<a:/g, '<a:')  // Fix double animated prefix
      .replace(/>>(\d+)/g, ':$1>'); // Fix closing format
      
    // Process any remaining standard emojis like :gem: -> 💎
    const standardEmojis = {
      ':gem:': '💎',
      ':small_blue_diamond:': '🔹',
      ':large_blue_diamond:': '🔷',
      ':crown:': '👑',
      ':heart:': '❤️',
    };
    
    Object.keys(standardEmojis).forEach(code => {
      formattedDescription = formattedDescription.replace(new RegExp(code, 'g'), standardEmojis[code]);
    });
    
    const truncatedDescription = formattedDescription.length > 4000 
      ? formattedDescription.substring(0, 4000) + '...' 
      : formattedDescription;
      
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
    
    // Add image if configured
    if (welcomeSettings.imageUrl) {
      welcomeEmbed.image = {
        url: welcomeSettings.imageUrl
      };
    } 
    // If no custom image is set, use the member's profile picture as the main image
    else {
      welcomeEmbed.image = {
        url: member.user.displayAvatarURL({ dynamic: true, size: 512 })
      };
    }
    
    // Handle background (if it's a background URL)
    if (welcomeSettings.backgroundUrl) {
      // If we have a custom image, we can't show both - Discord limitation
      if (welcomeSettings.imageUrl) {
        // If we already have a main image, we can add the background URL to the description
        welcomeEmbed.description += `\n\n[Click for welcome background](${welcomeSettings.backgroundUrl})`;
      } 
      // If we're using profile picture as image, prioritize background image if available
      else {
        welcomeEmbed.image = {
          url: welcomeSettings.backgroundUrl
        };
      }
    }
    
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