const config = require('../utils/config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection } = require('discord.js');

// Store active verification collectors
const activeCollectors = new Collection();

// Function to set up verification collectors for all servers
function setupAllVerificationCollectors(client) {
  // Get all server configs
  const allConfigs = config.loadConfig();
  
  for (const serverId in allConfigs) {
    const serverConfig = allConfigs[serverId];
    
    // If this server has reaction verification set up
    if (serverConfig.reactionVerification && serverConfig.reactionVerification.enabled) {
      setupVerificationCollector(client, serverId);
    }
  }
  
  console.log('Setting up verification collectors for all servers');
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

// Export the functions so they can be accessed from index.js
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
        }
      ]
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
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get action from args or options
    let action;
    if (isSlashCommand) {
      action = interaction.options.getString('action');
    } else {
      action = args[0]?.toLowerCase(); 
      
      // Check if a valid action was provided
      if (!action || !['enable', 'disable', 'status'].includes(action)) {
        return message.reply('❌ Please specify a valid action: `enable`, `disable`, or `status`');
      }
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
        
        securityEmbed.description = `**Security Status: ${securityStatus}**\n\nPhantom Guard's advanced security system helps protect your server from various threats.`;
        securityEmbed.color = serverConfig.securityDisabled ? 0xFF0000 : 0x00FF00;
        
        securityEmbed.fields.push(
          {
            name: '🔒 Protection Features',
            value: '• Anti-Nuke: Prevent mass channel deletions\n' +
                   '• Anti-Ban: Prevent mass user bans\n' +
                   '• Anti-Raid: Detect multiple users joining rapidly\n' +
                   '• Spam Detection: Monitor for spam and mention abuse\n' +
                   '• Scam Protection: Detect and block potential scam links'
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
        
      case 'dashboard':
        // Create an interactive security dashboard
        if (!isSlashCommand) {
          return message.reply('❌ Dashboard requires the slash command: `/security dashboard`');
        }
        
        // Defer reply as we'll show a comprehensive dashboard
        await interaction.deferReply();
        
        try {
          // Get various stats from the server
          const guild = interaction.guild;
          const memberCount = guild.memberCount;
          const onlineCount = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
          const botCount = guild.members.cache.filter(m => m.user.bot).size;
          
          // Get verification stats
          const verifiedMembers = serverConfig.buttonVerifications?.length || 0;
          
          // Get security incident stats
          const securityIncidents = serverConfig.securityIncidents || [];
          const totalIncidents = securityIncidents.length;
          
          // Count different types of incidents
          const nukeAttempts = securityIncidents.filter(i => i.type === 'nuke').length;
          const raidAttempts = securityIncidents.filter(i => i.type === 'raid').length;
          const spamAttempts = securityIncidents.filter(i => i.type === 'spam').length;
          
          // Create dashboard embed
          const dashboardEmbed = new EmbedBuilder()
            .setTitle('🛡️ Security Dashboard')
            .setDescription(`Security overview for **${guild.name}**`)
            .setColor(0x3366FF)
            .setThumbnail(guild.iconURL({ dynamic: true }) || null)
            .addFields(
              {
                name: '📊 Server Statistics',
                value: `• Total Members: ${memberCount}\n` +
                       `• Online Members: ${onlineCount}\n` +
                       `• Bots: ${botCount}\n` +
                       `• Verified Users: ${verifiedMembers}`
              },
              {
                name: '🔒 Security Status',
                value: `• Overall Status: ${serverConfig.securityDisabled ? 'Disabled ❌' : 'Enabled ✅'}\n` +
                       `• Anti-Raid: ${serverConfig.antiRaidDisabled ? 'Disabled ❌' : 'Enabled ✅'}\n` +
                       `• Anti-Spam: ${serverConfig.antiSpamDisabled ? 'Disabled ❌' : 'Enabled ✅'}\n` +
                       `• Anti-Scam: ${serverConfig.antiScamDisabled ? 'Disabled ❌' : 'Enabled ✅'}`
              },
              {
                name: '⚠️ Security Incidents',
                value: totalIncidents > 0 ? 
                      `• Total Incidents: ${totalIncidents}\n` +
                      `• Nuke Attempts: ${nukeAttempts}\n` +
                      `• Raid Attempts: ${raidAttempts}\n` +
                      `• Spam Incidents: ${spamAttempts}` :
                      'No security incidents detected yet'
              },
              {
                name: '🔧 Configuration',
                value: `• Notification Channel: ${serverConfig.notificationChannelId ? `<#${serverConfig.notificationChannelId}>` : 'Not set'}\n` +
                       `• Verification: ${serverConfig.reactionVerification?.enabled ? 'Enabled ✅' : 'Disabled ❌'}\n` +
                       `• Verified Role: ${serverConfig.reactionVerification?.roleName || 'Not set'}\n` +
                       `• Unverified Role: ${serverConfig.reactionVerification?.unverifiedRoleName || 'Not set'}`
              }
            )
            .setFooter({ text: 'Phantom Guard Security System • Dashboard' })
            .setTimestamp();
          
          // Send the dashboard
          await interaction.followUp({ embeds: [dashboardEmbed] });
          return;
        } catch (error) {
          console.error('Error showing security dashboard:', error);
          await interaction.followUp({
            content: `❌ Error displaying security dashboard: ${error.message}`,
            ephemeral: true
          });
          return;
        }
        break;
      
      case 'anti_raid':
        // Configure anti-raid measures
        if (!isSlashCommand) {
          return message.reply('❌ Anti-raid configuration requires the slash command: `/security anti_raid`');
        }
        
        // Toggle anti-raid
        const antiRaidCurrent = serverConfig.antiRaidDisabled || false;
        config.updateServerConfig(serverId, {
          antiRaidDisabled: !antiRaidCurrent,
          antiRaidSettings: {
            joinThreshold: 5,  // 5 joins
            timeWindow: 10000, // 10 seconds
            action: 'lockdown' // lockdown server temporarily
          }
        });
        
        // Create anti-raid embed
        const antiRaidEmbed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Raid Protection')
          .setDescription(`Anti-raid protection has been ${antiRaidCurrent ? 'enabled ✅' : 'disabled ❌'}`)
          .setColor(antiRaidCurrent ? 0x00FF00 : 0xFF0000)
          .addFields(
            {
              name: '⚙️ Settings',
              value: `• Action: Lockdown server temporarily\n` +
                     `• Threshold: 5 joins within 10 seconds\n` +
                     `• Notification: Server owner and notification channel`
            },
            {
              name: '📝 Description',
              value: 'Anti-raid protection detects when multiple users join your server within a short time frame. ' +
                    'When triggered, it can temporarily lock down the server to prevent potential damage.'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Raid' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [antiRaidEmbed] });
        return;
        break;
      
      case 'anti_spam':
        // Configure anti-spam measures
        if (!isSlashCommand) {
          return message.reply('❌ Anti-spam configuration requires the slash command: `/security anti_spam`');
        }
        
        // Toggle anti-spam
        const antiSpamCurrent = serverConfig.antiSpamDisabled || false;
        config.updateServerConfig(serverId, {
          antiSpamDisabled: !antiSpamCurrent,
          antiSpamSettings: {
            messageThreshold: 5,  // 5 messages
            timeWindow: 5000,     // 5 seconds
            action: 'warn'        // warn, then mute
          }
        });
        
        // Create anti-spam embed
        const antiSpamEmbed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Spam Protection')
          .setDescription(`Anti-spam protection has been ${antiSpamCurrent ? 'enabled ✅' : 'disabled ❌'}`)
          .setColor(antiSpamCurrent ? 0x00FF00 : 0xFF0000)
          .addFields(
            {
              name: '⚙️ Settings',
              value: `• Action: Warn user, then mute if continued\n` +
                     `• Threshold: 5 messages within 5 seconds\n` +
                     `• Repeat Offenders: Temporarily muted`
            },
            {
              name: '📝 Description',
              value: 'Anti-spam protection detects when users send many messages in a short time frame. ' +
                    'This helps keep your chat clean and prevents spam attacks.'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Spam' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [antiSpamEmbed] });
        return;
        break;
        
      case 'anti_scam':
        // Configure anti-scam measures
        if (!isSlashCommand) {
          return message.reply('❌ Anti-scam configuration requires the slash command: `/security anti_scam`');
        }
        
        // Toggle anti-scam
        const antiScamCurrent = serverConfig.antiScamDisabled || false;
        config.updateServerConfig(serverId, {
          antiScamDisabled: !antiScamCurrent,
          antiScamSettings: {
            deleteMessage: true,
            warnUser: true,
            action: 'delete'  // delete, warn, or mute
          }
        });
        
        // Create anti-scam embed
        const antiScamEmbed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Scam Protection')
          .setDescription(`Anti-scam protection has been ${antiScamCurrent ? 'enabled ✅' : 'disabled ❌'}`)
          .setColor(antiScamCurrent ? 0x00FF00 : 0xFF0000)
          .addFields(
            {
              name: '⚙️ Settings',
              value: `• Action: Delete suspicious messages\n` +
                     `• Detection: Discord nitro scams, phishing links\n` +
                     `• Notification: Warn users about deleted content`
            },
            {
              name: '📝 Description',
              value: 'Anti-scam protection detects suspicious links and common scam patterns. ' +
                    'This helps protect your members from phishing attacks and Discord scams.'
            }
          )
          .setFooter({ text: 'Phantom Guard Security System • Anti-Scam' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [antiScamEmbed] });
        return;
        break;
      
      case 'setup_verification':
        if (!isSlashCommand) {
          return message.reply('❌ Reaction verification setup requires the slash command: `/security setup_verification`');
        }
        
        // Get channel and roles from options
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const unverifiedRole = interaction.options.getRole('unverified_role');
        const customMessage = interaction.options.getString('message');
        
        // Check if channel and role are provided
        if (!channel) {
          return interaction.reply({
            content: '❌ You must specify a channel for verification.',
            ephemeral: true
          });
        }
        
        if (!role) {
          return interaction.reply({
            content: '❌ You must specify a role to assign upon verification.',
            ephemeral: true
          });
        }
        
        // Check if channel is a text channel
        if (channel.type !== 0) { // 0 is GUILD_TEXT
          return interaction.reply({
            content: '❌ The verification channel must be a text channel.',
            ephemeral: true
          });
        }
        
        // Defer reply as we'll be setting up a verification message
        await interaction.deferReply();
        
        try {
          // Default verification message
          const defaultMessage = 
            "# 🔐 Server Verification\n\n" +
            "To gain access to this server, please react with ✅ to verify yourself.\n\n" +
            "This helps us protect our community from bots and spam accounts.\n\n" +
            "After verification, you'll be granted the verified role and access to all channels.";
          
          // Create verification embed
          const verifyEmbed = new EmbedBuilder()
            .setTitle('🔐 Verification Required')
            .setDescription(customMessage || defaultMessage)
            .setColor(0x5865F2) // Discord Blurple
            .addFields(
              { name: 'Instructions', value: 'Click the ✅ button below to verify yourself.' },
              { name: 'Role', value: `You will receive the ${role.name} role upon verification.` }
            )
            .setFooter({ text: 'Phantom Guard Security System • Verification' })
            .setTimestamp();
          
          // Create verify button
          const verifyButton = new ButtonBuilder()
            .setCustomId(`verify_react_${serverId}`)
            .setLabel('Verify')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');
            
          const row = new ActionRowBuilder().addComponents(verifyButton);
          
          // Send verification message to the channel
          const verifyMsg = await channel.send({
            embeds: [verifyEmbed],
            components: [row]
          });
          
          // Store verification settings in server config with unverified role if provided
          const verificationConfig = {
            reactionVerification: {
              enabled: true,
              channelId: channel.id,
              messageId: verifyMsg.id,
              roleId: role.id,
              roleName: role.name
            }
          };
          
          // Add unverified role if provided
          if (unverifiedRole) {
            verificationConfig.reactionVerification.unverifiedRoleId = unverifiedRole.id;
            verificationConfig.reactionVerification.unverifiedRoleName = unverifiedRole.name;
            
            // Add field to embed about unverified role
            verifyEmbed.addFields({
              name: 'Unverified Role',
              value: `New members will receive the ${unverifiedRole.name} role until they verify.`
            });
            
            // Update the message with the new embed
            await verifyMsg.edit({
              embeds: [verifyEmbed],
              components: [row]
            });
          }
          
          config.updateServerConfig(serverId, verificationConfig);
          
          // Set up button collector for verification
          setupVerificationCollector(client, serverId);
          
          // Reply with success message
          await interaction.followUp({
            content: `✅ Reaction verification has been set up in ${channel}!\n\nUsers can now click the verify button to receive the ${role.name} role.`,
            ephemeral: false
          });
          
          return; // Exit to prevent sending securityEmbed
        } catch (error) {
          console.error('Error setting up verification:', error);
          await interaction.followUp({
            content: `❌ Error setting up verification: ${error.message}`,
            ephemeral: true
          });
          return;
        }
        break;
    }
    
    // Send the message via slash command or regular command
    if (isSlashCommand) {
      if (interaction.deferred) {
        interaction.followUp({ embeds: [securityEmbed] });
      } else {
        interaction.reply({ embeds: [securityEmbed] });
      }
    } else {
      message.channel.send({ embeds: [securityEmbed] });
    }
  },
};