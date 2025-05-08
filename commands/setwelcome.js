const config = require('../utils/config');
const emojiProcessor = require('../utils/emojiProcessor');

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
      description: 'Custom welcome message (includes variables like {user}, {server}, etc.)',
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
      welcomeMessage = '<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Get Free Panel** → #📜・ʀᴜʟᴇs (React Fast For Next Free Panel!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Chat & Chill** → #🌐・ɢᴇɴᴇʀᴀʟ-ᴄʜᴀᴛ (Meet new people & have fun!)<a:greenbolt:1215595223477125120>\n<a:arrow_heartright:1017682681024229377>🔹 **Buy a Panel** → #💸・ᴘʀɪᴄᴇ-ʟɪsᴛ (For premium purchases & services!)<a:greenbolt:1215595223477125120>\n\n**💎 Exclusive Giveaways – Stay active for surprise rewards!**\n\n<a:1z_love:1350454898698178622> **Enjoy your stay & have fun!** <a:1z_love:1350454898698178622>';
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
    
    // Add variable placeholders info
    embed.fields.push({
      name: '📝 Available Variables',
      value: '• `{user}` - Mentions the user with @\n• `{mention}` - Shows username (without @)\n• `{user.tag}` - User tag (e.g., username#1234)\n• `{user.name}` - Username\n• `{server}` - Server name\n• `{server.memberCount}` - Member count\n• `{year}` - Current year'
    });
    
    // Send success message
    await interaction.followUp({ embeds: [embed] });
    
    // Send an example welcome message
    // Also ensure the description doesn't exceed Discord's limits
    const processedDescription = welcomeMessage
      .replace('{user}', `<@${interaction.user.id}>`)
      .replace('{server}', interaction.guild.name)
      .replace('{mention}', `<@${interaction.user.id}>`) // Add support for {mention} as an alternative
      .replace('{user.tag}', interaction.user.tag)
      .replace('{user.name}', interaction.user.username)
      .replace('{server.memberCount}', interaction.guild.memberCount.toString())
      .replace('{year}', new Date().getFullYear().toString());
    
    // Preserve multiple spaces by replacing them with Unicode spaces that Discord will render
    const formattedText = processedDescription.replace(/  +/g, match => {
      return ' ' + '\u2000'.repeat(match.length - 1);  // Use Unicode spaces (En Quad) instead of HTML entities
    });
    
    // Process emoji codes to Discord emoji format using our new emoji processor
    // This needs to be awaited as it's now an async function
    let formattedDescription = await emojiProcessor.processText(formattedText, interaction.guild.id);
    
    // Special direct replacements for known custom emojis and standard emoji codes
    formattedDescription = formattedDescription
      .replace(/:redcrown:/g, '<a:redcrown:1025355756511432776>')
      .replace(/:arrow_heartright:/g, '<a:arrow_heartright:1017682681024229377>')
      .replace(/:greenbolt:/g, '<a:greenbolt:1215595223477125120>')
      .replace(/:1z_love:/g, '<a:1z_love:1216659232003457065>')
      .replace(/:lol:/g, '<a:lol:1301275117434966016>')
      .replace(/:dizzy:/g, '💫')
      .replace(/:sparkles:/g, '✨')
      .replace(/:rocket:/g, '🚀')
      .replace(/:shield:/g, '🛡️')
      .replace(/:scroll:/g, '📜')
      .replace(/:speech_balloon:/g, '💬')
      .replace(/:shopping_cart:/g, '🛒')
      .replace(/:clock2:/g, '🕒');
      
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
      ':dizzy:': '💫',
      ':sparkles:': '✨',
      ':rocket:': '🚀',
      ':shield:': '🛡️',
      ':scroll:': '📜',
      ':speech_balloon:': '💬',
      ':shopping_cart:': '🛒',
      ':clock2:': '🕒',
    };
    
    Object.keys(standardEmojis).forEach(code => {
      formattedDescription = formattedDescription.replace(new RegExp(code, 'g'), standardEmojis[code]);
    });
    
    const truncatedDescription = formattedDescription.length > 4000 
      ? formattedDescription.substring(0, 4000) + '...' 
      : formattedDescription;
      
    // Process the title for emojis and variables
    // Note: Discord doesn't support clickable mentions in embed titles, so we'll use a different approach
    let processedTitle = welcomeTitle
      .replace('{user}', interaction.user.username) // Just username for title as mentions don't work in titles
      .replace('{server}', interaction.guild.name)
      .replace('{mention}', interaction.user.username) // Just username for title
      .replace('{user.tag}', interaction.user.tag)
      .replace('{user.name}', interaction.user.username)
      .replace('{server.memberCount}', interaction.guild.memberCount.toString())
      .replace('{year}', new Date().getFullYear().toString());
    
    // Process emojis in the title
    processedTitle = await emojiProcessor.processText(processedTitle, interaction.guild.id);
    
    // Special emoji replacements for title
    processedTitle = processedTitle
      .replace(/:dizzy:/g, '💫')
      .replace(/:sparkles:/g, '✨')
      .replace(/:rocket:/g, '🚀')
      .replace(/:crown:/g, '👑')
      .replace(/:star:/g, '⭐')
      .replace(/:gem:/g, '💎');
    
    const exampleEmbed = {
      title: processedTitle,
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
    
    // Add example fields to showcase the server info that will be visible
    exampleEmbed.fields = exampleEmbed.fields || [];
    
    // Add server information field example
    exampleEmbed.fields.push({
      name: '🏠 Server Information',
      value: `**Members:** ${interaction.guild.memberCount}\n**Created:** <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`,
      inline: true
    });
    
    // Add user join field example
    exampleEmbed.fields.push({
      name: '📅 Joined',
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true
    });
    
    // Send example
    try {
      // Send the title message first with the clickable mention
      const titleWithMention = welcomeTitle
        .replace('{user}', `<@${interaction.user.id}>`)
        .replace('{mention}', `<@${interaction.user.id}>`)
        .replace('{server}', interaction.guild.name)
        .replace('{user.tag}', interaction.user.tag)
        .replace('{user.name}', interaction.user.username)
        .replace('{server.memberCount}', interaction.guild.memberCount.toString())
        .replace('{year}', new Date().getFullYear().toString());
      
      // Process emojis in the title message
      let formattedTitleWithMention = await emojiProcessor.processText(titleWithMention, interaction.guild.id);
      
      // Apply emoji replacements for title
      formattedTitleWithMention = formattedTitleWithMention
        .replace(/:redcrown:/g, '<a:redcrown:1025355756511432776>')
        .replace(/:arrow_heartright:/g, '<a:arrow_heartright:1017682681024229377>')
        .replace(/:greenbolt:/g, '<a:greenbolt:1215595223477125120>')
        .replace(/:1z_love:/g, '<a:1z_love:1216659232003457065>')
        .replace(/:lol:/g, '<a:lol:1301275117434966016>')
        .replace(/:dizzy:/g, '💫')
        .replace(/:sparkles:/g, '✨')
        .replace(/:rocket:/g, '🚀')
        .replace(/:crown:/g, '👑')
        .replace(/:star:/g, '⭐')
        .replace(/:gem:/g, '💎')
        .replace(/:small_blue_diamond:/g, '🔹')
        .replace(/:large_blue_diamond:/g, '🔷')
        .replace(/:heart:/g, '❤️')
        .replace(/:shield:/g, '🛡️')
        .replace(/:scroll:/g, '📜')
        .replace(/:speech_balloon:/g, '💬')
        .replace(/:shopping_cart:/g, '🛒')
        .replace(/:clock2:/g, '🕒');
        
      await channel.send(formattedTitleWithMention);
      
      // Then send the detailed embed below it
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
  console.log("Welcome handler function running...");
  
  client.on('guildMemberAdd', async member => {
    console.log(`New member joined: ${member.user.tag} (${member.id}) in server: ${member.guild.name}`);
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if welcome messages are enabled
    if (!serverConfig.welcomeSettings?.enabled || !serverConfig.welcomeSettings?.channelId) {
      console.log(`Welcome messages disabled or no channel set for server ${serverId}`);
      return;
    }
    
    console.log(`Processing welcome message for ${member.user.tag} in ${member.guild.name}`);
    
    // Get welcome channel
    const welcomeChannelId = serverConfig.welcomeSettings.channelId;
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) {
      console.log(`Welcome channel ${welcomeChannelId} not found in guild ${serverId}`);
      return;
    }
    
    // Get welcome settings
    const welcomeSettings = serverConfig.welcomeSettings;
    
    // Create welcome embed
    // Ensure description doesn't exceed Discord's limit
    const processedDescription = welcomeSettings.message
      .replace('{user}', `<@${member.id}>`)
      .replace('{server}', member.guild.name)
      .replace('{mention}', `<@${member.id}>`) // Keep mention as is in the body
      .replace('{user.tag}', member.user.tag)
      .replace('{user.name}', member.user.username)
      .replace('{server.memberCount}', member.guild.memberCount.toString())
      .replace('{year}', new Date().getFullYear().toString());
      
    // Preserve multiple spaces by replacing them with Unicode spaces that Discord will render
    const formattedText = processedDescription.replace(/  +/g, match => {
      return ' ' + '\u2000'.repeat(match.length - 1);  // Use Unicode spaces (En Quad) instead of HTML entities
    });
    
    // Process different sticker formats in the message
    const processSticker = (text) => {
      // Process {sticker:name} format
      const braceStickerRegex = /{sticker:([a-zA-Z0-9_]+)}/g;
      let result = text.replace(braceStickerRegex, (match, name) => {
        // Convert to :name: format for the emoji processor
        return `:${name}:`;
      });
      
      // Process [sticker:name] format
      const bracketStickerRegex = /\[sticker:([a-zA-Z0-9_]+)\]/g;
      result = result.replace(bracketStickerRegex, (match, name) => {
        // Convert to :name: format for the emoji processor
        return `:${name}:`;
      });
      
      return result;
    };
    
    // Pre-process sticker formats
    let preProcessedText = processSticker(formattedText);
    
    // Process emoji codes to Discord emoji format using our processor
    let formattedDescription = await emojiProcessor.processText(preProcessedText, member.guild.id);
    
    // Double-check for any nitro stickers that might have been missed
    // Instead of individual replacements, use the animatedEmojis object from emojiProcessor
    const { animatedEmojis } = require('../utils/emojiProcessor');
    Object.keys(animatedEmojis).forEach(code => {
      const emoji = animatedEmojis[code];
      const emojiString = `<a:${emoji.name}:${emoji.id}>`;
      formattedDescription = formattedDescription.replace(new RegExp(code, 'g'), emojiString);
    });
    
    // Make sure we handle the syntax Discord expects for animated emojis 
    formattedDescription = formattedDescription
      .replace(/<a<<a:/g, '<a:')  // Fix double animated prefix
      .replace(/>>(\d+)/g, ':$1>'); // Fix closing format
      
    // Special validation for incomplete emoji syntax in case the above processing missed any
    const incompleteEmojiRegex = /<:([a-zA-Z0-9_]+)(\d{17,20})>/g;
    formattedDescription = formattedDescription.replace(incompleteEmojiRegex, '<:$1:$2>');
    
    // Fix format like <a:emoji1234567> to <a:emoji:1234567>
    const incompleteAnimatedEmojiRegex = /<a:([a-zA-Z0-9_]+)(\d{17,20})>/g;
    formattedDescription = formattedDescription.replace(incompleteAnimatedEmojiRegex, '<a:$1:$2>');
    
    const truncatedDescription = formattedDescription.length > 4000 
      ? formattedDescription.substring(0, 4000) + '...' 
      : formattedDescription;
      
    // Process title with emojis and variables
    let processedTitle = welcomeSettings.title || '👋 Welcome to the server!';
    
    // Replace variables in title
    // Note: Discord doesn't support clickable mentions in embed titles, so we'll use username instead
    processedTitle = processedTitle
      .replace('{user}', member.user.username) // Just username for title as mentions don't work in titles
      .replace('{server}', member.guild.name)
      .replace('{mention}', member.user.username) // Just username for title
      .replace('{user.tag}', member.user.tag)
      .replace('{user.name}', member.user.username)
      .replace('{server.memberCount}', member.guild.memberCount.toString())
      .replace('{year}', new Date().getFullYear().toString());
    
    // Process emojis in title
    processedTitle = await emojiProcessor.processText(processedTitle, member.guild.id);
    
    // Extra emoji replacements for title
    processedTitle = processedTitle
      .replace(/:dizzy:/g, '💫')
      .replace(/:sparkles:/g, '✨')
      .replace(/:rocket:/g, '🚀')
      .replace(/:crown:/g, '👑')
      .replace(/:star:/g, '⭐')
      .replace(/:gem:/g, '💎');
    
    const welcomeEmbed = {
      title: processedTitle,
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
    
    // Add additional server information fields
    welcomeEmbed.fields = welcomeEmbed.fields || [];
    
    // Add server information field
    welcomeEmbed.fields.push({
      name: '🏠 Server Information',
      value: `**Members:** ${member.guild.memberCount}\n**Created:** <t:${Math.floor(member.guild.createdTimestamp / 1000)}:R>`,
      inline: true
    });
    
    // Add user join field
    welcomeEmbed.fields.push({
      name: '📅 Joined',
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true
    });
    
    // Send welcome message
    try {
      // First send the title message with the clickable mention
      const titleWithMention = welcomeSettings.title || '👋 Welcome to the server!';
      
      const processedTitleWithMention = titleWithMention
        .replace('{user}', `<@${member.id}>`)
        .replace('{mention}', `<@${member.id}>`)
        .replace('{server}', member.guild.name)
        .replace('{user.tag}', member.user.tag)
        .replace('{user.name}', member.user.username)
        .replace('{server.memberCount}', member.guild.memberCount.toString())
        .replace('{year}', new Date().getFullYear().toString());
      
      // Process sticker formats first
      let preprocessedTitleWithMention = processSticker(processedTitleWithMention);
      
      // Process emojis in the standalone title
      let formattedTitleWithMention = await emojiProcessor.processText(preprocessedTitleWithMention, member.guild.id);
      
      // Double-check for any nitro stickers that might have been missed
      // Instead of individual replacements, use the animatedEmojis object from emojiProcessor
      Object.keys(animatedEmojis).forEach(code => {
        const emoji = animatedEmojis[code];
        const emojiString = `<a:${emoji.name}:${emoji.id}>`;
        formattedTitleWithMention = formattedTitleWithMention.replace(new RegExp(code, 'g'), emojiString);
      });
      
      // Special validation for incomplete emoji syntax
      formattedTitleWithMention = formattedTitleWithMention
        .replace(/<:([a-zA-Z0-9_]+)(\d{17,20})>/g, '<:$1:$2>')  // Fix regular emoji format
        .replace(/<a:([a-zA-Z0-9_]+)(\d{17,20})>/g, '<a:$1:$2>');  // Fix animated emoji format
        
      // Send title first for proper mention
      await welcomeChannel.send(formattedTitleWithMention);
      
      // Then send the detailed embed below it
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

// Add DM message handler function
function sendDMToNewMember(member, message) {
  try {
    // Replace variables in the message
    const processedMessage = message
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{mention}/g, `<@${member.id}>`)
      .replace(/{server}/g, member.guild.name)
      .replace(/{user\.tag}/g, member.user.tag)
      .replace(/{user\.name}/g, member.user.username)
      .replace(/{server\.memberCount}/g, member.guild.memberCount.toString())
      .replace(/{year}/g, new Date().getFullYear().toString());
    
    // Preserve multiple spaces by replacing them with Unicode spaces that Discord will render
    // Completely new approach for Discord message formatting
    // Use the MessageBuilder utility to properly format the message
    
    // Step 1: Handle line breaks properly
    // Replace explicit \n with actual line breaks
    let formattedText = processedMessage.replace(/\\n/g, '\n');
    
    // Step 2: Convert multiple spaces to non-breaking spaces
    // This ensures multiple spaces are preserved in Discord
    formattedText = formattedText.replace(/ {2,}/g, match => {
      // Use the standard non-breaking space character for Discord
      return ' ' + '\u00A0'.repeat(match.length - 1);
    });
    
    // Step 3: Preserve line separators
    formattedText = formattedText.replace(/━+/g, match => {
      // Ensure Unicode line separators display correctly
      return '━'.repeat(match.length);
    });
    
    // Step 4: Ensure markdown formatting is preserved
    // Discord handles markdown automatically, but we make sure it's properly formatted
    formattedText = formattedText
      .replace(/\*\*(.*?)\*\*/g, '**$1**')   // Bold
      .replace(/\*(.*?)\*/g, '*$1*')         // Italic
      .replace(/__(.*?)__/g, '__$1__')       // Underline
      .replace(/~~(.*?)~~/g, '~~$1~~');      // Strikethrough
      
    // Convert emoji codes to actual emojis
    const standardEmojis = {
      ':gem:': '💎',
      ':small_blue_diamond:': '🔹',
      ':large_blue_diamond:': '🔷',
      ':crown:': '👑',
      ':heart:': '❤️',
      ':dizzy:': '💫',
      ':sparkles:': '✨',
      ':rocket:': '🚀',
      ':shield:': '🛡️',
      ':scroll:': '📜',
      ':speech_balloon:': '💬',
      ':shopping_cart:': '🛒',
      ':clock2:': '🕒',
      ':star:': '⭐',
      ':fire:': '🔥',
      ':tada:': '🎉',
      ':clap:': '👏',
      ':wave:': '👋',
      ':partying_face:': '🥳',
      ':gift:': '🎁',
      ':trophy:': '🏆',
      ':medal:': '🏅',
      ':money_with_wings:': '💸',
      ':100:': '💯',
    };
    
    let finalMessage = formattedText;
    Object.keys(standardEmojis).forEach(code => {
      finalMessage = finalMessage.replace(new RegExp(code, 'g'), standardEmojis[code]);
    });
    
    // Add emoji replacements for animated emojis
    finalMessage = finalMessage
      .replace(/:redcrown:/g, '<a:redcrown:1025355756511432776>')
      .replace(/:arrow_heartright:/g, '<a:arrow_heartright:1017682681024229377>')
      .replace(/:greenbolt:/g, '<a:greenbolt:1215595223477125120>')
      .replace(/:1z_love:/g, '<a:1z_love:1216659232003457065>')
      .replace(/:lol:/g, '<a:lol:1301275117434966016>');
    
    // Fix any formatting issues with animated emojis
    finalMessage = finalMessage
      .replace(/<a<<a:/g, '<a:')  // Fix double animated prefix
      .replace(/>>(\d+)/g, ':$1>'); // Fix closing format
    
    // Send the DM
    console.log(`Sending formatted DM to ${member.user.tag}`);
    return member.send(finalMessage);
  } catch (error) {
    console.error(`Error sending DM to ${member.user.tag}:`, error);
    return Promise.reject(error);
  }
}

// Export the functions
module.exports.setupWelcomeHandler = setupWelcomeHandler;
module.exports.sendDMToNewMember = sendDMToNewMember;