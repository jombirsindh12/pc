const config = require('../utils/config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection } = require('discord.js');
const securityManager = require('../utils/securityManager');

// Store active verification collectors
const activeCollectors = new Collection();

// Function to set up verification collectors for all servers
function setupAllVerificationCollectors(client) {
  console.log('Setting up verification collectors for all servers');
  
  // Process each guild the bot is in
  client.guilds.cache.forEach(guild => {
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // If this server has reaction verification set up
    if (serverConfig.reactionVerification && serverConfig.reactionVerification.enabled) {
      setupVerificationCollector(client, serverId);
    }
  });
  
  console.log('Verification collectors setup complete');
}

// Function to set up verification collectors for a specific server
async function setupVerificationCollector(client, serverId) {
  const serverConfig = config.getServerConfig(serverId);
  
  // Skip if no verification is set up
  if (!serverConfig.reactionVerification || !serverConfig.reactionVerification.enabled) {
    return;
  }
  
  // Get verification info
  const { channelId, messageId, roleId, unverifiedRoleId } = serverConfig.reactionVerification;
  
  // Stop existing collector if any
  if (activeCollectors.has(serverId)) {
    activeCollectors.get(serverId).stop();
  }
  
  try {
    // Get guild, channel, and message
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      console.error(`Cannot set up verification collector: Guild ${serverId} not found`);
      return;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.error(`Cannot set up verification collector: Channel ${channelId} not found in guild ${serverId}`);
      return;
    }
    
    try {
      // Try to fetch the message if not already in cache
      const message = await channel.messages.fetch(messageId);
      
      // Set up button collector
      const collector = channel.createMessageComponentCollector({
        filter: i => i.customId === `verify_react_${serverId}`,
        time: 0 // No time limit (0 = infinite)
      });
      
      collector.on('collect', async i => {
        try {
          // Defer reply as ephemeral to hide it from others
          await i.deferReply({ ephemeral: true });
          
          // Get the user and member
          const user = i.user;
          const member = await guild.members.fetch(user.id);
          
          // Check if user already has the role
          if (member.roles.cache.has(roleId)) {
            return i.followUp({
              content: '✅ You are already verified!',
              ephemeral: true
            });
          }
          
          // Add the verified role with error handling
          try {
            await member.roles.add(roleId);
            
            // Remove unverified role if it exists and is configured
            if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
              await member.roles.remove(unverifiedRoleId);
            }
          } catch (roleError) {
            console.error(`Error handling verification role assignment for ${user.tag}:`, roleError);
            
            // Check if it's a permission error
            if (roleError.code === 50013) {
              return i.followUp({
                content: '❌ **Permission Error:** Bot does not have permission to assign roles. Please ask a server admin to:\n\n1. Make sure the bot role is **higher** than the role it\'s trying to give\n2. Give the bot "Manage Roles" permission',
                ephemeral: true
              });
            }
            
            // Generic error
            return i.followUp({
              content: `❌ Error assigning role: ${roleError.message}. Please contact a server admin.`,
              ephemeral: true
            });
          }
          
          console.log(`User ${user.tag} verified in server ${guild.name}`);
          
          // Send success message
          await i.followUp({
            content: '✅ **Verification Successful!**\nYou have been verified and given access to the server.',
            ephemeral: true
          });
          
          // Send notification if a notification channel is set
          if (serverConfig.notificationChannelId) {
            const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
            if (notificationChannel) {
              notificationChannel.send(`🎉 **${user.tag}** has been verified through button verification!`);
            }
          }
          
          // Track verification in server config
          const verifications = serverConfig.buttonVerifications || [];
          verifications.push({
            userId: user.id,
            username: user.tag,
            timestamp: new Date().toISOString()
          });
          
          config.updateServerConfig(serverId, {
            buttonVerifications: verifications
          });
          
        } catch (error) {
          console.error('Error during verification:', error);
          i.followUp({
            content: `❌ Error during verification: ${error.message}`,
            ephemeral: true
          });
        }
      });
      
      // Store the collector
      activeCollectors.set(serverId, collector);
      console.log(`Verification collector set up for server ${serverId}`);
      
      // Apply unverified role to new members if configured
      if (unverifiedRoleId) {
        // Setup member join event 
        client.on('guildMemberAdd', async member => {
          if (member.guild.id === serverId) {
            try {
              // Add unverified role with error handling
              try {
                await member.roles.add(unverifiedRoleId);
                console.log(`Added unverified role to new member ${member.user.tag} in ${guild.name}`);
              } catch (roleError) {
                console.error(`Error adding unverified role to ${member.user.tag}:`, roleError);
                
                // Check if it's a missing permissions error
                if (roleError.code === 50013) {
                  // Try to find a notification channel to report the error
                  if (serverConfig.notificationChannelId) {
                    const notificationChannel = guild.channels.cache.get(serverConfig.notificationChannelId);
                    if (notificationChannel) {
                      notificationChannel.send(`⚠️ **Permission Error:** Could not add unverified role to new member ${member.user.tag}. Please make sure the bot has "Manage Roles" permission and its role is higher than the unverified role.`);
                    }
                  }
                }
              }
              
              // DM the user with verification instructions
              try {
                await member.send({
                  embeds: [new EmbedBuilder()
                    .setTitle('Verification Required')
                    .setDescription(`Welcome to ${guild.name}! To gain access to the server, please go to <#${channelId}> and click the Verify button.`)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Phantom Guard Verification System' })
                  ]
                });
              } catch (dmError) {
                console.error(`Could not DM verification instructions to ${member.user.tag}:`, dmError);
              }
            } catch (error) {
              console.error(`Error handling new member ${member.user.tag}:`, error);
            }
          }
        });
      }
      
    } catch (error) {
      console.error(`Error fetching verification message in ${serverId}:`, error);
    }
  } catch (error) {
    console.error(`Error setting up verification collector for ${serverId}:`, error);
  }
}

// Export the module
module.exports = {
  setupAllVerificationCollectors,
  setupVerificationCollector,
  name: 'security',
  description: 'Manage advanced security features for the server',
  usage: '/security [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with security features',
      required: true,
      choices: [
        {
          name: 'enable',
          value: 'enable'
        },
        {
          name: 'disable',
          value: 'disable'
        },
        {
          name: 'status',
          value: 'status'
        },
        {
          name: 'setup_verification',
          value: 'setup_verification'
        },
        {
          name: 'dashboard',
          value: 'dashboard'
        },
        {
          name: 'anti_raid',
          value: 'anti_raid'
        },
        {
          name: 'anti_spam',
          value: 'anti_spam'
        },
        {
          name: 'anti_scam',
          value: 'anti_scam'
        },
        {
          name: 'strict_security',
          value: 'strict_security'
        }
      ]
    },
    {
      name: 'option',
      type: 3, // STRING type
      description: 'Additional option for the selected action (e.g., "enable" or "disable" for strict_security)',
      required: false
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Channel to setup verification (required for setup_verification)',
      required: false
    },
    {
      name: 'role',
      type: 8, // ROLE type
      description: 'Role to assign upon verification (required for setup_verification)',
      required: false
    },
    {
      name: 'unverified_role',
      type: 8, // ROLE type
      description: 'Role to assign to unverified users (optional)',
      required: false
    },
    {
      name: 'message',
      type: 3, // STRING type
      description: 'Custom message for verification (optional)',
      required: false
    }
  ],
  guildOnly: true, // This command can only be used in servers
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    const isSlashCommand = interaction ? true : false;
    const channel = isSlashCommand ? interaction.channel : message.channel;
    const user = isSlashCommand ? interaction.user : message.author;
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    const member = isSlashCommand ? interaction.member : message.member;
    
    // Check if user is owner - ONLY allow server owner to manage security
    if (guild.ownerId !== user.id) {
      const ownerOnlyEmbed = {
        title: '🔒 Security Restricted',
        description: '**Security functions are restricted to the server owner only.**',
        color: 0xFF0000,
        fields: [
          {
            name: '⚠️ Access Denied',
            value: 'To prevent security compromise, only the server owner can manage security settings.'
          }
        ]
      };
      
      if (isSlashCommand) {
        return interaction.reply({ embeds: [ownerOnlyEmbed], ephemeral: true });
      } else {
        return message.reply({ embeds: [ownerOnlyEmbed] });
      }
    }
    
    // DEFAULT TO SECURITY OWNER ONLY
    // Update server config if securityOwnerOnly flag doesn't exist
    if (serverConfig.securityOwnerOnly === undefined) {
      config.updateServerConfig(serverId, {
        securityOwnerOnly: true
      });
    }
    
    // Get action from args or options
    let action;
    if (isSlashCommand) {
      action = interaction.options.getString('action');
    } else {
      action = args[0]?.toLowerCase(); 
      
      // Check if a valid action was provided
      if (!action || !['enable', 'disable', 'status', 'strict_security'].includes(action)) {
        return message.reply('❌ Please specify a valid action: `enable`, `disable`, `status`, or `strict_security`');
      }
    }
    
    // Handle strict security mode
    if (action === 'strict_security') {
      // Get the option (enable/disable) 
      let strictOption;
      if (isSlashCommand) {
        strictOption = interaction.options.getString('option') || 'status'; // Default to status if not provided
      } else {
        strictOption = args[1]?.toLowerCase() || 'status';
      }
      
      if (!['enable', 'disable', 'status'].includes(strictOption)) {
        const helpMsg = '❌ Please specify a valid option for strict security: `enable`, `disable`, or `status`';
        if (isSlashCommand) {
          return interaction.reply({ content: helpMsg, ephemeral: true });
        } else {
          return message.reply(helpMsg);
        }
      }
      
      // Create embed for strict security
      const strictSecurityEmbed = new EmbedBuilder()
        .setTitle('🔒 Ultra-Strict Security Mode')
        .setColor(0xFF0000)
        .setFooter({ text: 'Phantom Guard Security System • Owner-Only Protection' })
        .setTimestamp();
      
      // Handle the different options
      if (strictOption === 'enable') {
        // Enable strict security with the securityManager
        try {
          // Defer the reply as this may take a moment
          if (isSlashCommand) {
            await interaction.deferReply();
          } else {
            await message.channel.sendTyping();
          }
          
          // Enable strict security (default to kick action)
          const result = await securityManager.enableStrictSecurity(client, serverId, 'kick');
          
          if (result.success) {
            strictSecurityEmbed
              .setDescription('✅ **Ultra-Strict Security Mode Enabled**\n\nOnly the server owner can now make structural changes to the server.')
              .addFields(
                {
                  name: '🛡️ Protected Actions',
                  value: '• Channel creation, modification, or deletion\n• Server name or icon changes\n• Role changes\n• Permission modifications'
                },
                {
                  name: '⚠️ Warning',
                  value: 'Any server administrator who attempts to perform these actions will be immediately kicked from the server. Use `/security strict_security disable` to turn this off.'
                }
              );
          } else {
            strictSecurityEmbed
              .setDescription('❌ **Error:** Failed to enable Ultra-Strict Security Mode')
              .setColor(0xFF0000)
              .addFields({
                name: '📝 Details',
                value: result.error || 'Unknown error occurred'
              });
          }
        } catch (error) {
          console.error('Error enabling strict security:', error);
          strictSecurityEmbed
            .setDescription('❌ **Error:** Failed to enable Ultra-Strict Security Mode')
            .setColor(0xFF0000)
            .addFields({
              name: '📝 Error Details',
              value: error.message || 'Unknown error occurred'
            });
        }
      } else if (strictOption === 'disable') {
        try {
          // Defer the reply as this may take a moment
          if (isSlashCommand) {
            await interaction.deferReply();
          } else {
            await message.channel.sendTyping();
          }
          
          // Disable strict security
          const result = await securityManager.disableStrictSecurity(client, serverId);
          
          if (result.success) {
            strictSecurityEmbed
              .setDescription('✅ **Ultra-Strict Security Mode Disabled**\n\nServer administrators can now make structural changes to the server.')
              .setColor(0x00FF00)
              .addFields(
                {
                  name: '📝 Information',
                  value: 'Normal anti-nuke security protection remains in place to prevent mass destructive actions.'
                }
              );
          } else {
            strictSecurityEmbed
              .setDescription('❌ **Error:** Failed to disable Ultra-Strict Security Mode')
              .setColor(0xFF0000)
              .addFields({
                name: '📝 Details',
                value: result.error || 'Unknown error occurred'
              });
          }
        } catch (error) {
          console.error('Error disabling strict security:', error);
          strictSecurityEmbed
            .setDescription('❌ **Error:** Failed to disable Ultra-Strict Security Mode')
            .setColor(0xFF0000)
            .addFields({
              name: '📝 Error Details',
              value: error.message || 'Unknown error occurred'
            });
        }
      } else { // status
        // Get current status
        const isStrictEnabled = serverConfig.strictSecurity || false;
        
        strictSecurityEmbed
          .setDescription(`**Ultra-Strict Security Mode: ${isStrictEnabled ? 'Enabled ✅' : 'Disabled ❌'}**`)
          .setColor(isStrictEnabled ? 0xFF0000 : 0x00FF00)
          .addFields(
            {
              name: '📝 Information',
              value: isStrictEnabled ? 
                'Ultra-Strict Security Mode is currently active. Only the server owner can make structural changes to the server.' :
                'Ultra-Strict Security Mode is currently disabled. Server administrators can make structural changes to the server.'
            },
            {
              name: '⚙️ Configuration',
              value: isStrictEnabled ?
                `• Mode: ${serverConfig.strictSecurityAction === 'ban' ? 'Ban violators' : 'Kick violators'}\n` +
                `• Enabled: <t:${Math.floor(serverConfig.strictSecurityEnabled / 1000)}:R>` :
                'Use `/security strict_security enable` to activate this feature.'
            }
          );
      }
      
      // Send the response
      if (isSlashCommand) {
        if (interaction.deferred) {
          await interaction.followUp({ embeds: [strictSecurityEmbed] });
        } else {
          await interaction.reply({ embeds: [strictSecurityEmbed] });
        }
      } else {
        await message.reply({ embeds: [strictSecurityEmbed] });
      }
      
      return;
    }
    
    // Create embeds for showing security status
    const securityEmbed = {
      title: '🛡️ Server Security Settings',
      description: '',
      color: 0x3366FF, // Blue color
      fields: [],
      footer: {
        text: 'Phantom Guard Security System • Advanced Protection'
      }
    };
    
    // Handle different actions
    switch (action) {
      case 'enable':
        // Enable security features
        config.updateServerConfig(serverId, {
          securityDisabled: false
        });
        
        securityEmbed.description = '✅ **Security features have been enabled!**\n\nYour server is now protected against nukes, raids, and spam attacks.';
        securityEmbed.color = 0x00FF00; // Green for success
        
        securityEmbed.fields.push(
          {
            name: '🔒 Active Protections',
            value: '• Anti-Nuke: Prevent mass channel deletions\n' +
                   '• Anti-Ban: Prevent mass user bans\n' +
                   '• Anti-Raid: Detect multiple users joining rapidly\n' +
                   '• Spam Detection: Monitor for spam and mention abuse\n' +
                   '• Scam Protection: Detect and block potential scam links'
          },
          {
            name: '⚙️ Configuration',
            value: 'All security alerts will be sent to your notification channel if set.'
          }
        );
        break;
        
      case 'disable':
        // Disable security features
        config.updateServerConfig(serverId, {
          securityDisabled: true
        });
        
        securityEmbed.description = '⚠️ **Security features have been disabled**\n\nYour server is no longer protected against nukes, raids, and spam attacks.';
        securityEmbed.color = 0xFF0000; // Red for warning
        
        securityEmbed.fields.push(
          {
            name: '🔓 Disabled Protections',
            value: 'All security features are now disabled. It is recommended to enable them again for server protection.'
          }
        );
        break;
        
      case 'status':
        // Show current status
        const securityStatus = serverConfig.securityDisabled ? 'Disabled ❌' : 'Enabled ✅';
        const strictSecurityStatus = serverConfig.strictSecurity ? 'Enabled ✅' : 'Disabled ❌';
        
        securityEmbed.description = `**Security Status: ${securityStatus}**\n\nPhantom Guard's advanced security system helps protect your server from various threats.`;
        securityEmbed.color = serverConfig.securityDisabled ? 0xFF0000 : 0x00FF00;
        
        securityEmbed.fields.push(
          {
            name: '🔒 Protection Features',
            value: '• Anti-Nuke: Prevent mass channel deletions\n' +
                   '• Anti-Ban: Prevent mass user bans\n' +
                   '• Anti-Raid: Detect multiple users joining rapidly\n' +
                   '• Spam Detection: Monitor for spam and mention abuse\n' +
                   '• Scam Protection: Detect and block potential scam links\n' +
                   `• Ultra-Strict Security: ${strictSecurityStatus}`
          },
          {
            name: '📊 Recent Incidents',
            value: serverConfig.securityIncidents && serverConfig.securityIncidents.length > 0 
              ? `${serverConfig.securityIncidents.length} security incidents detected` 
              : 'No security incidents detected yet'
          },
          {
            name: '⚙️ Configuration',
            value: serverConfig.notificationChannelId 
              ? `Security alerts will be sent to <#${serverConfig.notificationChannelId}>` 
              : 'No notification channel set. Use /setnotificationchannel to receive security alerts.'
          }
        );
        break;
    }
    
    // Send the response
    if (isSlashCommand) {
      await interaction.reply({ embeds: [securityEmbed] });
    } else {
      await message.reply({ embeds: [securityEmbed] });
    }
  }
};