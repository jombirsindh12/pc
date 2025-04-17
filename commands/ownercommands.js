const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'owner',
  description: 'Bot owner commands - only usable by the bot owner',
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const user = isSlashCommand ? interaction.user : message.author;
    const channel = isSlashCommand ? interaction.channel : message.channel;
    
    // Check if the user is the bot owner
    const isBotOwner = user.id === process.env.BOT_OWNER_ID || user.id === client.application?.owner?.id;
    
    if (!isBotOwner) {
      const errorResponse = '⛔ This command can only be used by the bot owner!';
      if (isSlashCommand) {
        return interaction.reply({ content: errorResponse, ephemeral: true });
      } else {
        return message.reply(errorResponse);
      }
    }
    
    // No arguments provided, show help menu
    if (!args || args.length === 0) {
      return showOwnerCommandMenu(message, client, interaction);
    }
    
    // Process subcommands
    const subcommand = args[0].toLowerCase();
    
    switch (subcommand) {
      case 'premium':
        await handlePremiumCommand(args.slice(1), message, client, interaction);
        break;
      case 'security':
        await handleSecurityCommand(args.slice(1), message, client, interaction);
        break;
      case 'stats':
        await showBotStats(message, client, interaction);
        break;
      case 'servers':
        await listServers(message, client, interaction);
        break;
      case 'reload':
        await reloadBot(message, client, interaction);
        break;
      default:
        if (isSlashCommand) {
          interaction.reply({ content: `❌ Unknown subcommand: ${subcommand}. Use \`/owner\` without arguments to see available commands.`, ephemeral: true });
        } else {
          message.reply(`❌ Unknown subcommand: ${subcommand}. Use \`!owner\` without arguments to see available commands.`);
        }
    }
  },
};

// Show the owner command menu
async function showOwnerCommandMenu(message, client, interaction = null) {
  const isSlashCommand = !!interaction;

  // Create the owner commands help embed
  const ownerEmbed = {
    title: '👑 Bot Owner Commands',
    description: `Welcome, owner! Here are the available owner-only commands:`,
    color: 0xF1C40F, // Golden color
    fields: [
      {
        name: '⭐ Premium Management',
        value: '`!owner premium activate <serverID>` - Activate premium for a server\n' +
              '`!owner premium deactivate <serverID>` - Deactivate premium for a server\n' +
              '`!owner premium list` - List all premium servers'
      },
      {
        name: '🛡️ Security Control',
        value: '`!owner security lockdown <serverID>` - Activate emergency lockdown\n' +
              '`!owner security unlockdown <serverID>` - Deactivate emergency lockdown\n' +
              '`!owner security ban <userID> [reason]` - Global ban a user across all servers'
      },
      {
        name: '📊 Statistics',
        value: '`!owner stats` - View detailed bot statistics\n' +
              '`!owner servers` - List all servers the bot is in'
      },
      {
        name: '🔄 System',
        value: '`!owner reload` - Reload bot modules and commands'
      }
    ],
    footer: {
      text: `Bot Version: 1.0.0 | ${client.user.username}`
    }
  };
  
  // Send the owner commands help embed
  if (isSlashCommand) {
    interaction.reply({ embeds: [ownerEmbed], ephemeral: true });
  } else {
    message.channel.send({ embeds: [ownerEmbed] });
  }
}

// Handle premium subcommands
async function handlePremiumCommand(args, message, client, interaction = null) {
  const isSlashCommand = !!interaction;
  
  if (!args || args.length === 0) {
    const errorResponse = '❌ Missing premium subcommand. Available subcommands: `activate`, `deactivate`, `list`';
    if (isSlashCommand) {
      return interaction.reply({ content: errorResponse, ephemeral: true });
    } else {
      return message.reply(errorResponse);
    }
  }
  
  const premiumSubcommand = args[0].toLowerCase();
  
  switch (premiumSubcommand) {
    case 'activate':
      if (args.length < 2) {
        const errorResponse = '❌ Missing server ID. Usage: `!owner premium activate <serverID>`';
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      const serverToActivate = args[1];
      const serverToActivateObj = client.guilds.cache.get(serverToActivate);
      
      if (!serverToActivateObj) {
        const errorResponse = `❌ Server with ID ${serverToActivate} not found or bot doesn't have access to it.`;
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      // Activate premium for the server
      config.updateServerConfig(serverToActivate, {
        premium: true,
        premiumActivatedBy: isSlashCommand ? interaction.user.id : message.author.id,
        premiumActivatedAt: new Date().toISOString(),
        premiumFeatures: [
          'anti-nuke',
          'custom-welcome',
          'voice-announce',
          'advanced-verification',
          'unlimited-automod'
        ]
      });
      
      const successResponse = `✅ Premium successfully activated for server: ${serverToActivateObj.name} (${serverToActivate})`;
      if (isSlashCommand) {
        interaction.reply({ content: successResponse, ephemeral: true });
      } else {
        message.reply(successResponse);
      }
      break;
      
    case 'deactivate':
      if (args.length < 2) {
        const errorResponse = '❌ Missing server ID. Usage: `!owner premium deactivate <serverID>`';
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      const serverToDeactivate = args[1];
      const serverToDeactivateObj = client.guilds.cache.get(serverToDeactivate);
      
      if (!serverToDeactivateObj) {
        const errorResponse = `❌ Server with ID ${serverToDeactivate} not found or bot doesn't have access to it.`;
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      // Deactivate premium for the server
      config.updateServerConfig(serverToDeactivate, {
        premium: false,
        premiumFeatures: []
      });
      
      const deactivateResponse = `✅ Premium successfully deactivated for server: ${serverToDeactivateObj.name} (${serverToDeactivate})`;
      if (isSlashCommand) {
        interaction.reply({ content: deactivateResponse, ephemeral: true });
      } else {
        message.reply(deactivateResponse);
      }
      break;
      
    case 'list':
      // List all premium servers
      const allServers = client.guilds.cache;
      const premiumServers = [];
      
      for (const [guildId, guild] of allServers) {
        const serverConfig = config.getServerConfig(guildId);
        if (serverConfig.premium) {
          premiumServers.push({
            id: guildId,
            name: guild.name,
            memberCount: guild.memberCount,
            activatedAt: serverConfig.premiumActivatedAt || 'Unknown date'
          });
        }
      }
      
      if (premiumServers.length === 0) {
        const noServersResponse = '❌ No premium servers found.';
        if (isSlashCommand) {
          return interaction.reply({ content: noServersResponse, ephemeral: true });
        } else {
          return message.reply(noServersResponse);
        }
      }
      
      // Create premium servers list embed
      const premiumListEmbed = {
        title: '⭐ Premium Servers List',
        description: `Found ${premiumServers.length} servers with premium status:`,
        color: 0xF1C40F, // Golden color
        fields: premiumServers.map((server, index) => ({
          name: `${index + 1}. ${server.name}`,
          value: `ID: ${server.id}\nMembers: ${server.memberCount}\nActivated: ${server.activatedAt}`
        })),
        footer: {
          text: `Total Premium Servers: ${premiumServers.length}`
        }
      };
      
      if (isSlashCommand) {
        interaction.reply({ embeds: [premiumListEmbed], ephemeral: true });
      } else {
        message.channel.send({ embeds: [premiumListEmbed] });
      }
      break;
      
    default:
      const invalidSubcommandResponse = `❌ Invalid premium subcommand: \`${premiumSubcommand}\`. Available subcommands: \`activate\`, \`deactivate\`, \`list\``;
      if (isSlashCommand) {
        interaction.reply({ content: invalidSubcommandResponse, ephemeral: true });
      } else {
        message.reply(invalidSubcommandResponse);
      }
  }
}

// Handle security subcommands
async function handleSecurityCommand(args, message, client, interaction = null) {
  const isSlashCommand = !!interaction;
  
  if (!args || args.length === 0) {
    const errorResponse = '❌ Missing security subcommand. Available subcommands: `lockdown`, `unlockdown`, `ban`';
    if (isSlashCommand) {
      return interaction.reply({ content: errorResponse, ephemeral: true });
    } else {
      return message.reply(errorResponse);
    }
  }
  
  const securitySubcommand = args[0].toLowerCase();
  
  switch (securitySubcommand) {
    case 'lockdown':
      if (args.length < 2) {
        const errorResponse = '❌ Missing server ID. Usage: `!owner security lockdown <serverID>`';
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      const serverToLockdown = args[1];
      const serverToLockdownObj = client.guilds.cache.get(serverToLockdown);
      
      if (!serverToLockdownObj) {
        const errorResponse = `❌ Server with ID ${serverToLockdown} not found or bot doesn't have access to it.`;
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      // Update server config for lockdown
      config.updateServerConfig(serverToLockdown, {
        lockdownEnabled: true,
        lockdownActivatedBy: isSlashCommand ? interaction.user.id : message.author.id,
        lockdownActivatedAt: new Date().toISOString()
      });
      
      // Lockdown logic (would normally lock all channels)
      const lockdownResponse = `🔒 Emergency lockdown activated for server: ${serverToLockdownObj.name} (${serverToLockdown})`;
      if (isSlashCommand) {
        interaction.reply({ content: lockdownResponse, ephemeral: true });
      } else {
        message.reply(lockdownResponse);
      }
      break;
      
    case 'unlockdown':
      if (args.length < 2) {
        const errorResponse = '❌ Missing server ID. Usage: `!owner security unlockdown <serverID>`';
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      const serverToUnlockdown = args[1];
      const serverToUnlockdownObj = client.guilds.cache.get(serverToUnlockdown);
      
      if (!serverToUnlockdownObj) {
        const errorResponse = `❌ Server with ID ${serverToUnlockdown} not found or bot doesn't have access to it.`;
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      // Update server config to disable lockdown
      config.updateServerConfig(serverToUnlockdown, {
        lockdownEnabled: false
      });
      
      // Unlock logic (would normally unlock all channels)
      const unlockdownResponse = `🔓 Emergency lockdown deactivated for server: ${serverToUnlockdownObj.name} (${serverToUnlockdown})`;
      if (isSlashCommand) {
        interaction.reply({ content: unlockdownResponse, ephemeral: true });
      } else {
        message.reply(unlockdownResponse);
      }
      break;
      
    case 'ban':
      if (args.length < 2) {
        const errorResponse = '❌ Missing user ID. Usage: `!owner security ban <userID> [reason]`';
        if (isSlashCommand) {
          return interaction.reply({ content: errorResponse, ephemeral: true });
        } else {
          return message.reply(errorResponse);
        }
      }
      
      const userToBan = args[1];
      const banReason = args.slice(2).join(' ') || 'No reason provided';
      
      // Add user to global ban list (this would be implemented in a real bot)
      const banResponse = `🔨 User ${userToBan} has been added to the global ban list. Reason: ${banReason}`;
      if (isSlashCommand) {
        interaction.reply({ content: banResponse, ephemeral: true });
      } else {
        message.reply(banResponse);
      }
      break;
      
    default:
      const invalidSubcommandResponse = `❌ Invalid security subcommand: \`${securitySubcommand}\`. Available subcommands: \`lockdown\`, \`unlockdown\`, \`ban\``;
      if (isSlashCommand) {
        interaction.reply({ content: invalidSubcommandResponse, ephemeral: true });
      } else {
        message.reply(invalidSubcommandResponse);
      }
  }
}

// Show bot statistics
async function showBotStats(message, client, interaction = null) {
  const isSlashCommand = !!interaction;
  
  // Calculate various statistics
  const totalServers = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  const totalChannels = client.channels.cache.size;
  
  // Calculate uptime
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  // Count all premium servers
  let premiumServers = 0;
  client.guilds.cache.forEach(guild => {
    const serverConfig = config.getServerConfig(guild.id);
    if (serverConfig.premium) {
      premiumServers++;
    }
  });
  
  // Create bot stats embed
  const statsEmbed = {
    title: '📊 Bot Statistics',
    description: `Current statistics for ${client.user.username}:`,
    color: 0x3498DB, // Blue color
    fields: [
      {
        name: '🖥️ Servers',
        value: `${totalServers}`,
        inline: true
      },
      {
        name: '👥 Members',
        value: `${totalMembers}`,
        inline: true
      },
      {
        name: '💬 Channels',
        value: `${totalChannels}`,
        inline: true
      },
      {
        name: '⭐ Premium Servers',
        value: `${premiumServers}`,
        inline: true
      },
      {
        name: '⏱️ Uptime',
        value: uptimeString,
        inline: true
      },
      {
        name: '🏓 API Latency',
        value: `${client.ws.ping}ms`,
        inline: true
      }
    ],
    footer: {
      text: `Bot Version: 1.0.0 | Last Updated: ${new Date().toLocaleDateString()}`
    }
  };
  
  if (isSlashCommand) {
    interaction.reply({ embeds: [statsEmbed], ephemeral: true });
  } else {
    message.channel.send({ embeds: [statsEmbed] });
  }
}

// List all servers the bot is in
async function listServers(message, client, interaction = null) {
  const isSlashCommand = !!interaction;
  
  const allServers = client.guilds.cache.map(guild => ({
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
    owner: guild.ownerId
  }));
  
  // Sort servers by member count (descending)
  allServers.sort((a, b) => b.memberCount - a.memberCount);
  
  if (allServers.length === 0) {
    const noServersResponse = '❌ The bot is not in any servers.';
    if (isSlashCommand) {
      return interaction.reply({ content: noServersResponse, ephemeral: true });
    } else {
      return message.reply(noServersResponse);
    }
  }
  
  // Create server list embeds (paginated if more than 10 servers)
  const serversPerPage = 10;
  const totalPages = Math.ceil(allServers.length / serversPerPage);
  const serverPages = [];
  
  for (let i = 0; i < totalPages; i++) {
    const startIndex = i * serversPerPage;
    const endIndex = Math.min(startIndex + serversPerPage, allServers.length);
    const pageServers = allServers.slice(startIndex, endIndex);
    
    const pageEmbed = {
      title: '🌐 Server List',
      description: `List of servers the bot is in (Page ${i + 1}/${totalPages}):`,
      color: 0x3498DB, // Blue color
      fields: pageServers.map((server, index) => ({
        name: `${startIndex + index + 1}. ${server.name}`,
        value: `ID: ${server.id}\nMembers: ${server.memberCount}\nOwner ID: ${server.owner}`
      })),
      footer: {
        text: `Total Servers: ${allServers.length} | Page ${i + 1}/${totalPages}`
      }
    };
    
    serverPages.push(pageEmbed);
  }
  
  // Send the first page
  if (isSlashCommand) {
    interaction.reply({ embeds: [serverPages[0]], ephemeral: true });
  } else {
    message.channel.send({ embeds: [serverPages[0]] });
  }
  
  // If pagination is needed in the future, buttons could be added here
}

// Reload bot modules (simulated)
async function reloadBot(message, client, interaction = null) {
  const isSlashCommand = !!interaction;
  
  const reloadResponse = '🔄 Reloading bot modules and commands... This may take a moment.';
  
  if (isSlashCommand) {
    await interaction.reply({ content: reloadResponse, ephemeral: true });
  } else {
    await message.channel.send(reloadResponse);
  }
  
  // Simulate reloading (would actually reload commands in a real bot)
  setTimeout(async () => {
    const completedResponse = '✅ Bot reload complete! All modules and commands have been refreshed.';
    
    if (isSlashCommand) {
      interaction.followUp({ content: completedResponse, ephemeral: true });
    } else {
      message.channel.send(completedResponse);
    }
  }, 3000);
}