const { ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'setupverification',
  description: 'Setup advanced verification system with button or image-based verification',
  usage: '/setupverification [type] [channel] [role]',
  options: [
    {
      name: 'type',
      type: 3, // STRING type
      description: 'Type of verification to setup',
      required: true,
      choices: [
        {
          name: 'button',
          value: 'button'
        },
        {
          name: 'image',
          value: 'image'
        },
        {
          name: 'both',
          value: 'both'
        }
      ]
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Channel for verification',
      required: true
    },
    {
      name: 'role',
      type: 8, // ROLE type
      description: 'Role to assign after verification',
      required: true
    },
    {
      name: 'title',
      type: 3, // STRING type
      description: 'Custom title for verification embed',
      required: false
    },
    {
      name: 'description',
      type: 3, // STRING type
      description: 'Custom description for verification embed',
      required: false
    },
    {
      name: 'color',
      type: 3, // STRING type
      description: 'Custom color for verification embed (hex code)',
      required: false
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get guild ID and other parameters
    const serverId = isSlashCommand ? interaction.guild.id : message.guild.id;
    let verificationType, channel, role, customTitle, customDescription, customColor;
    
    // Get parameters based on command type
    if (isSlashCommand) {
      verificationType = interaction.options.getString('type');
      channel = interaction.options.getChannel('channel');
      role = interaction.options.getRole('role');
      customTitle = interaction.options.getString('title');
      customDescription = interaction.options.getString('description');
      customColor = interaction.options.getString('color');
      
      // Defer reply since we'll be doing multiple operations
      await interaction.deferReply();
    } else {
      // Legacy command handling - not needed since we're focusing on slash commands
      return message.reply('Please use the slash command `/setupverification` instead.');
    }
    
    // Validate channel is a text channel
    if (channel.type !== 0) { // 0 is GUILD_TEXT channel type
      return interaction.followUp('❌ The channel must be a text channel.');
    }
    
    // Update server config
    config.updateServerConfig(serverId, {
      verificationChannelId: channel.id,
      verificationChannelName: channel.name,
      roleId: role.id,
      roleName: role.name,
      verificationType: verificationType,
      verificationSettings: {
        title: customTitle || '✅ Server Verification',
        description: customDescription || 'Please verify yourself to access the server.',
        color: customColor || '5865F2' // Discord Blurple color
      }
    });
    
    // Create verification embed
    const verificationEmbed = {
      title: customTitle || '✅ Server Verification',
      description: customDescription || 'Please verify yourself to access the server.',
      color: parseInt(customColor?.replace('#', '') || '5865F2', 16),
      fields: []
    };
    
    // Add different fields based on verification type
    if (verificationType === 'button' || verificationType === 'both') {
      verificationEmbed.fields.push({
        name: '🔘 Button Verification',
        value: 'Click the verify button below to get access to the server.'
      });
    }
    
    if (verificationType === 'image' || verificationType === 'both') {
      verificationEmbed.fields.push({
        name: '📱 YouTube Subscription Verification',
        value: `Upload a screenshot showing that you are subscribed to our YouTube channel to get the ${role.name} role.`
      });
    }
    
    // Add footer
    verificationEmbed.footer = {
      text: `Verified users will receive the ${role.name} role`
    };
    
    // Create button components if needed
    let components = [];
    if (verificationType === 'button' || verificationType === 'both') {
      const verifyButton = new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify Me')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
      
      const buttonRow = new ActionRowBuilder().addComponents(verifyButton);
      components = [buttonRow];
    }
    
    // Send the verification message to the channel
    try {
      await channel.send({ 
        embeds: [verificationEmbed],
        components: components
      });
      
      // Respond to the command
      const successEmbed = {
        title: '✅ Verification System Setup',
        description: `Verification system has been set up in ${channel} with the following settings:`,
        color: 0x00FF00,
        fields: [
          {
            name: 'Verification Type',
            value: verificationType === 'button' ? 'Button Verification' : 
                  verificationType === 'image' ? 'Image Verification' : 'Both Button and Image Verification'
          },
          {
            name: 'Verification Channel',
            value: `<#${channel.id}>`
          },
          {
            name: 'Role After Verification',
            value: `<@&${role.id}>`
          }
        ]
      };
      
      // Reply with success message
      await interaction.followUp({ embeds: [successEmbed] });
      
      // Set up button interaction listener in the client (if not already set)
      if (!client._hasVerificationListener && (verificationType === 'button' || verificationType === 'both')) {
        client.on('interactionCreate', async buttonInteraction => {
          if (!buttonInteraction.isButton()) return;
          
          if (buttonInteraction.customId === 'verify_button') {
            try {
              // Get server config for this guild
              const buttonServerId = buttonInteraction.guild.id;
              const serverConfig = config.getServerConfig(buttonServerId);
              
              // If the server has a verification role set
              if (serverConfig.roleId) {
                // Check if user already has the role
                const member = buttonInteraction.member;
                if (member.roles.cache.has(serverConfig.roleId)) {
                  return buttonInteraction.reply({ 
                    content: '✅ You are already verified!', 
                    ephemeral: true 
                  });
                }
                
                // Add the role with error handling
                try {
                  await member.roles.add(serverConfig.roleId);
                } catch (roleError) {
                  console.error(`Error assigning role to user ${buttonInteraction.user.tag}:`, roleError);
                  
                  // Check if it's a permission error
                  if (roleError.code === 50013) {
                    return buttonInteraction.reply({
                      content: '❌ **Permission Error:** Bot does not have permission to assign roles. Please ask a server admin to:\n\n1. Make sure the bot role is **higher** than the role it\'s trying to give\n2. Give the bot "Manage Roles" permission',
                      ephemeral: true
                    });
                  }
                  
                  // Generic error
                  return buttonInteraction.reply({
                    content: `❌ Error assigning role: ${roleError.message}. Please contact a server admin.`,
                    ephemeral: true
                  });
                }
                
                // Send success message
                await buttonInteraction.reply({ 
                  content: `✅ You have been verified and given the ${serverConfig.roleName || 'verified'} role!`, 
                  ephemeral: true 
                });
                
                // Log verification if notification channel is set
                if (serverConfig.notificationChannelId) {
                  const notificationChannel = buttonInteraction.guild.channels.cache.get(serverConfig.notificationChannelId);
                  if (notificationChannel) {
                    notificationChannel.send(`🎉 **${buttonInteraction.user.tag}** has been verified through button verification!`);
                  }
                }
                
                // Store verification record
                const verifiedUsers = serverConfig.verifiedUsers || {};
                verifiedUsers[buttonInteraction.user.id] = {
                  userId: buttonInteraction.user.id,
                  username: buttonInteraction.user.tag,
                  timestamp: new Date().toISOString(),
                  method: 'button',
                  guildId: buttonInteraction.guild.id
                };
                
                // Update server config with verification record
                config.updateServerConfig(buttonServerId, {
                  verifiedUsers: verifiedUsers
                });
              } else {
                // No role set
                await buttonInteraction.reply({ 
                  content: '⚠️ Verification role is not set up yet. Please contact an administrator.', 
                  ephemeral: true 
                });
              }
            } catch (error) {
              console.error('Error handling verification button interaction:', error);
              await buttonInteraction.reply({ 
                content: '❌ An error occurred during verification. Please try again later or contact an administrator.', 
                ephemeral: true 
              });
            }
          }
        });
        
        // Mark that we've set up the listener
        client._hasVerificationListener = true;
        console.log('Button verification listener has been set up');
      }
      
    } catch (error) {
      console.error('Error setting up verification system:', error);
      await interaction.followUp('❌ An error occurred while setting up the verification system. Please try again later.');
    }
  },
};