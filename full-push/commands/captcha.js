const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../utils/config');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'captcha',
  description: 'Setup and manage CAPTCHA verification for new members',
  usage: '/captcha [action]',
  options: [
    {
      name: 'action',
      type: 3, // STRING type
      description: 'Action to perform with CAPTCHA',
      required: true,
      choices: [
        {
          name: 'setup',
          value: 'setup'
        },
        {
          name: 'disable',
          value: 'disable'
        },
        {
          name: 'test',
          value: 'test'
        },
        {
          name: 'status',
          value: 'status'
        }
      ]
    },
    {
      name: 'channel',
      type: 7, // CHANNEL type
      description: 'Channel to use for CAPTCHA verification',
      required: false
    },
    {
      name: 'role',
      type: 8, // ROLE type
      description: 'Role to assign after CAPTCHA verification',
      required: false
    },
    {
      name: 'type',
      type: 3, // STRING type
      description: 'Type of CAPTCHA to use',
      required: false,
      choices: [
        {
          name: 'image',
          value: 'image'
        },
        {
          name: 'math',
          value: 'math'
        },
        {
          name: 'text',
          value: 'text'
        }
      ]
    }
  ],
  requiresAdmin: true, // Only admins can use this command
  
  async execute(message, args, client, interaction = null) {
    // Use interaction if available (slash command), otherwise use message (legacy)
    const isSlashCommand = !!interaction;
    
    // Get guild ID and other parameters
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const serverId = guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Get action from args or options
    let action, channel, role, captchaType;
    
    if (isSlashCommand) {
      action = interaction.options.getString('action');
      channel = interaction.options.getChannel('channel');
      role = interaction.options.getRole('role');
      captchaType = interaction.options.getString('type');
      
      // Defer reply since some operations might take time
      await interaction.deferReply();
    } else {
      // Legacy command handling - not needed since we're focusing on slash commands
      return message.reply('Please use the slash command `/captcha` instead.');
    }
    
    // Check if this server has premium features
    const isPremium = serverConfig.premium || false;
    
    // Handle different actions
    switch (action) {
      case 'setup':
        // Check if channel and role are provided
        if (!channel || !role) {
          return await interaction.followUp({
            content: '❌ You need to specify both a channel and a role for CAPTCHA verification.',
            ephemeral: true
          });
        }
        
        // Check if the channel is a text channel
        if (channel.type !== 0) { // 0 is GUILD_TEXT channel type
          return await interaction.followUp({
            content: '❌ The channel must be a text channel.',
            ephemeral: true
          });
        }
        
        // Set up CAPTCHA verification
        const type = captchaType || 'image';
        
        config.updateServerConfig(serverId, {
          captchaEnabled: true,
          captchaSettings: {
            channelId: channel.id,
            roleId: role.id,
            roleName: role.name,
            type: type,
            autoKick: isPremium, // Auto-kick only for premium servers
            timeLimit: isPremium ? 5 : 10, // 5 minutes for premium, 10 for free
            created: Date.now()
          }
        });
        
        // Create CAPTCHA embed
        const setupEmbed = new EmbedBuilder()
          .setTitle('🧩 CAPTCHA Verification System')
          .setDescription(`CAPTCHA verification has been set up in ${channel} with the following settings:`)
          .setColor(0x3498DB)
          .addFields(
            {
              name: '🔹 Verification Channel',
              value: `<#${channel.id}>`,
              inline: true
            },
            {
              name: '🔹 Role After Verification',
              value: `<@&${role.id}>`,
              inline: true
            },
            {
              name: '🔹 CAPTCHA Type',
              value: type === 'image' ? 'Image Recognition' : 
                     type === 'math' ? 'Math Problem' : 
                     'Text Challenge',
              inline: true
            },
            {
              name: '🔹 Auto-Kick',
              value: isPremium ? 'Enabled (after 5 minutes)' : 'Disabled (Premium feature)',
              inline: true
            },
            {
              name: '🔹 Time Limit',
              value: `${isPremium ? '5' : '10'} minutes`,
              inline: true
            }
          )
          .setFooter({ text: isPremium ? 'Premium CAPTCHA System' : 'Basic CAPTCHA System' })
          .setTimestamp();
          
        // Send response
        await interaction.followUp({ embeds: [setupEmbed] });
        
        // Send a test CAPTCHA to the configured channel
        await sendTestCaptcha(guild, serverConfig.captchaSettings);
        
        // Set up member join handler if not already set
        setupCaptchaHandler(client);
        break;
        
      case 'disable':
        // Disable CAPTCHA verification
        config.updateServerConfig(serverId, {
          captchaEnabled: false
        });
        
        // Create disabled embed
        const disabledEmbed = new EmbedBuilder()
          .setTitle('🧩 CAPTCHA Verification System')
          .setDescription('CAPTCHA verification has been disabled.')
          .setColor(0xE74C3C)
          .addFields(
            {
              name: '📝 Note',
              value: 'New members will no longer need to complete a CAPTCHA to access the server.'
            }
          )
          .setFooter({ text: 'CAPTCHA System Disabled' })
          .setTimestamp();
          
        // Send response
        await interaction.followUp({ embeds: [disabledEmbed] });
        break;
        
      case 'test':
        // Check if CAPTCHA is set up
        if (!serverConfig.captchaEnabled || !serverConfig.captchaSettings) {
          return await interaction.followUp({
            content: '❌ CAPTCHA verification is not set up yet. Use `/captcha setup` first.',
            ephemeral: true
          });
        }
        
        // Send a test CAPTCHA
        const testResult = await sendTestCaptcha(guild, serverConfig.captchaSettings);
        
        // Send response
        if (testResult.success) {
          await interaction.followUp({
            content: `✅ Test CAPTCHA sent to <#${serverConfig.captchaSettings.channelId}>. Go check it out!`,
            ephemeral: false
          });
        } else {
          await interaction.followUp({
            content: `❌ Failed to send test CAPTCHA: ${testResult.error}`,
            ephemeral: true
          });
        }
        break;
        
      case 'status':
        // Check if CAPTCHA is set up
        if (!serverConfig.captchaEnabled || !serverConfig.captchaSettings) {
          const noSetupEmbed = new EmbedBuilder()
            .setTitle('🧩 CAPTCHA Verification Status')
            .setDescription('❌ CAPTCHA verification is not set up for this server.')
            .setColor(0xE74C3C)
            .addFields(
              {
                name: '📝 Setup Instructions',
                value: 'Use `/captcha setup` with a channel and role to enable CAPTCHA verification.'
              }
            )
            .setFooter({ text: 'CAPTCHA System' })
            .setTimestamp();
            
          return await interaction.followUp({ embeds: [noSetupEmbed] });
        }
        
        // Get CAPTCHA settings
        const settings = serverConfig.captchaSettings;
        
        // Build status embed
        const statusEmbed = new EmbedBuilder()
          .setTitle('🧩 CAPTCHA Verification Status')
          .setDescription('✅ CAPTCHA verification is active for this server.')
          .setColor(0x2ECC71)
          .addFields(
            {
              name: '🔹 Verification Channel',
              value: `<#${settings.channelId}>`,
              inline: true
            },
            {
              name: '🔹 Role After Verification',
              value: `<@&${settings.roleId}>`,
              inline: true
            },
            {
              name: '🔹 CAPTCHA Type',
              value: settings.type === 'image' ? 'Image Recognition' : 
                     settings.type === 'math' ? 'Math Problem' : 
                     'Text Challenge',
              inline: true
            },
            {
              name: '🔹 Auto-Kick',
              value: settings.autoKick ? 'Enabled' : 'Disabled',
              inline: true
            },
            {
              name: '🔹 Time Limit',
              value: `${settings.timeLimit || 10} minutes`,
              inline: true
            },
            {
              name: '📊 Statistics',
              value: `• Created: <t:${Math.floor((settings.created || Date.now()) / 1000)}:R>\n• Total Verifications: ${serverConfig.captchaStats?.total || 0}\n• Successful: ${serverConfig.captchaStats?.success || 0}\n• Failed: ${serverConfig.captchaStats?.failed || 0}`
            }
          )
          .setFooter({ text: isPremium ? 'Premium CAPTCHA System' : 'Basic CAPTCHA System' })
          .setTimestamp();
          
        // Send response
        await interaction.followUp({ embeds: [statusEmbed] });
        break;
        
      default:
        await interaction.followUp({
          content: '❌ Invalid action! Please use `/captcha setup`, `/captcha disable`, `/captcha test`, or `/captcha status`.',
          ephemeral: true
        });
    }
  }
};

/**
 * Set up CAPTCHA verification handler for new members
 * @param {Client} client Discord client
 */
function setupCaptchaHandler(client) {
  if (client._hasCaptchaHandler) return;
  
  client.on('guildMemberAdd', async (member) => {
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if CAPTCHA is enabled for this server
    if (!serverConfig.captchaEnabled || !serverConfig.captchaSettings) return;
    
    // Get CAPTCHA settings
    const settings = serverConfig.captchaSettings;
    
    try {
      // Get the verification channel
      const channel = member.guild.channels.cache.get(settings.channelId);
      if (!channel) return;
      
      // Generate a CAPTCHA challenge
      const challenge = await generateCaptcha(settings.type);
      
      // Initialize or update captcha sessions for this server
      if (!serverConfig.captchaSessions) {
        config.updateServerConfig(serverId, {
          captchaSessions: {}
        });
      }
      
      // Store the session data
      const captchaSessions = serverConfig.captchaSessions || {};
      captchaSessions[member.id] = {
        userId: member.id,
        solution: challenge.solution,
        type: settings.type,
        timestamp: Date.now(),
        attempts: 0
      };
      
      config.updateServerConfig(serverId, {
        captchaSessions: captchaSessions
      });
      
      // Create CAPTCHA embed
      const captchaEmbed = new EmbedBuilder()
        .setTitle('🧩 CAPTCHA Verification Required')
        .setDescription(`Welcome, ${member}! Please complete this CAPTCHA to gain access to the server.`)
        .setColor(0x3498DB)
        .addFields(
          {
            name: '📝 Instructions',
            value: challenge.instructions
          },
          {
            name: '⏱️ Time Limit',
            value: `You have ${settings.timeLimit || 10} minutes to complete this verification.`,
            inline: true
          },
          {
            name: '🚫 Failure to Verify',
            value: settings.autoKick ? 'You will be automatically kicked if not verified in time.' : 'Your access will remain limited until verified.',
            inline: true
          }
        )
        .setFooter({ text: 'Reply with your answer in this channel' })
        .setTimestamp();
      
      // If there's an image, attach it
      if (challenge.imagePath) {
        captchaEmbed.setImage(`attachment://captcha.png`);
        
        // Send the message with the image
        await channel.send({
          content: `<@${member.id}>`,
          embeds: [captchaEmbed],
          files: [{
            attachment: challenge.imagePath,
            name: 'captcha.png'
          }]
        });
        
        // Delete the temporary image file
        try {
          fs.unlinkSync(challenge.imagePath);
        } catch (error) {
          console.error('Error deleting temporary CAPTCHA image:', error);
        }
      } else {
        // Send the message without an image
        await channel.send({
          content: `<@${member.id}>`,
          embeds: [captchaEmbed]
        });
      }
      
      // Set up a collector for the user's response
      const filter = (m) => m.author.id === member.id;
      const collector = channel.createMessageCollector({ filter, time: (settings.timeLimit || 10) * 60 * 1000 });
      
      collector.on('collect', async (msg) => {
        const userAnswer = msg.content.trim();
        const session = serverConfig.captchaSessions?.[member.id];
        
        if (!session) {
          await msg.reply('❌ Your verification session has expired. Please contact an administrator.');
          collector.stop('expired');
          return;
        }
        
        // Update attempts
        session.attempts++;
        const captchaSessions = serverConfig.captchaSessions || {};
        captchaSessions[member.id] = session;
        
        config.updateServerConfig(serverId, {
          captchaSessions: captchaSessions
        });
        
        // Check if the answer is correct
        if (userAnswer.toLowerCase() === session.solution.toLowerCase()) {
          // Correct answer
          try {
            // Add the role
            await member.roles.add(settings.roleId);
            
            // Update stats
            const captchaStats = serverConfig.captchaStats || { total: 0, success: 0, failed: 0 };
            captchaStats.total++;
            captchaStats.success++;
            
            config.updateServerConfig(serverId, {
              captchaStats: captchaStats
            });
            
            // Send success message
            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Verification Successful')
              .setDescription(`${member}, you have been successfully verified!`)
              .setColor(0x2ECC71)
              .addFields(
                {
                  name: '🔓 Access Granted',
                  value: `You now have access to the server with the ${settings.roleName} role.`
                }
              )
              .setFooter({ text: 'Thank you for verifying' })
              .setTimestamp();
              
            await msg.reply({ embeds: [successEmbed] });
            
            // Remove the session
            const updatedSessions = serverConfig.captchaSessions || {};
            delete updatedSessions[member.id];
            
            config.updateServerConfig(serverId, {
              captchaSessions: updatedSessions
            });
            
            // Stop the collector
            collector.stop('success');
          } catch (error) {
            console.error('Error assigning role after CAPTCHA verification:', error);
            await msg.reply('❌ Verification successful, but there was an error assigning your role. Please contact a server administrator.');
            collector.stop('error');
          }
        } else {
          // Wrong answer
          if (session.attempts >= 3) {
            // Too many attempts
            const failEmbed = new EmbedBuilder()
              .setTitle('❌ Verification Failed')
              .setDescription(`${member}, you have failed the verification after 3 attempts.`)
              .setColor(0xE74C3C)
              .addFields(
                {
                  name: '🔒 Access Denied',
                  value: 'Please contact a server administrator for assistance.'
                }
              )
              .setFooter({ text: 'Failed verification' })
              .setTimestamp();
              
            await msg.reply({ embeds: [failEmbed] });
            
            // Update stats
            const captchaStats = serverConfig.captchaStats || { total: 0, success: 0, failed: 0 };
            captchaStats.total++;
            captchaStats.failed++;
            
            config.updateServerConfig(serverId, {
              captchaStats: captchaStats
            });
            
            // Remove the session
            const updatedSessions = serverConfig.captchaSessions || {};
            delete updatedSessions[member.id];
            
            config.updateServerConfig(serverId, {
              captchaSessions: updatedSessions
            });
            
            // Auto-kick if enabled
            if (settings.autoKick) {
              try {
                await member.kick('Failed CAPTCHA verification after 3 attempts');
              } catch (kickError) {
                console.error('Error kicking member after failed CAPTCHA:', kickError);
              }
            }
            
            // Stop the collector
            collector.stop('failed');
          } else {
            // Still has attempts left
            await msg.reply(`❌ Incorrect answer. You have ${3 - session.attempts} attempts remaining.`);
          }
        }
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          // Timed out
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏱️ Verification Timed Out')
            .setDescription(`${member} did not complete verification in time.`)
            .setColor(0xE74C3C)
            .setFooter({ text: 'Verification expired' })
            .setTimestamp();
            
          await channel.send({ embeds: [timeoutEmbed] });
          
          // Update stats
          const captchaStats = serverConfig.captchaStats || { total: 0, success: 0, failed: 0 };
          captchaStats.total++;
          captchaStats.failed++;
          
          config.updateServerConfig(serverId, {
            captchaStats: captchaStats
          });
          
          // Remove the session
          const updatedSessions = serverConfig.captchaSessions || {};
          delete updatedSessions[member.id];
          
          config.updateServerConfig(serverId, {
            captchaSessions: updatedSessions
          });
          
          // Auto-kick if enabled
          if (settings.autoKick) {
            try {
              await member.kick('Failed to complete CAPTCHA verification in time');
            } catch (kickError) {
              console.error('Error kicking member after CAPTCHA timeout:', kickError);
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Error in CAPTCHA handler:', error);
    }
  });
  
  // Set up message handler for solving CAPTCHAs
  client.on('messageCreate', async (message) => {
    // Skip bot messages
    if (message.author.bot) return;
    
    // Skip if not in a guild
    if (!message.guild) return;
    
    const serverId = message.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if CAPTCHA is enabled and if we have sessions
    if (!serverConfig.captchaEnabled || !serverConfig.captchaSessions) return;
    
    // Check if this is a CAPTCHA channel
    if (message.channel.id !== serverConfig.captchaSettings?.channelId) return;
    
    // Check if the user has a pending CAPTCHA
    const session = serverConfig.captchaSessions[message.author.id];
    if (!session) return;
    
    // This will be handled by the collector we set up
  });
  
  client._hasCaptchaHandler = true;
  console.log('CAPTCHA verification handler has been set up');
}

/**
 * Send a test CAPTCHA to the configured channel
 * @param {Guild} guild Discord guild
 * @param {Object} settings CAPTCHA settings
 * @returns {Object} Result object with success/error
 */
async function sendTestCaptcha(guild, settings) {
  try {
    // Get the channel
    const channel = guild.channels.cache.get(settings.channelId);
    if (!channel) {
      return { success: false, error: 'Verification channel not found' };
    }
    
    // Generate a CAPTCHA challenge
    const challenge = await generateCaptcha(settings.type);
    
    // Create CAPTCHA embed
    const captchaEmbed = new EmbedBuilder()
      .setTitle('🧩 Test CAPTCHA')
      .setDescription('This is a test CAPTCHA. The solution will be shown below.')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '📝 Challenge',
          value: challenge.instructions
        },
        {
          name: '🔑 Solution',
          value: `||${challenge.solution}||`
        },
        {
          name: '📋 Note',
          value: 'This is only a test. Real CAPTCHAs will be sent to new members when they join.'
        }
      )
      .setFooter({ text: 'CAPTCHA Test' })
      .setTimestamp();
    
    // If there's an image, attach it
    if (challenge.imagePath) {
      captchaEmbed.setImage(`attachment://captcha.png`);
      
      // Send the message with the image
      await channel.send({
        embeds: [captchaEmbed],
        files: [{
          attachment: challenge.imagePath,
          name: 'captcha.png'
        }]
      });
      
      // Delete the temporary image file
      try {
        fs.unlinkSync(challenge.imagePath);
      } catch (error) {
        console.error('Error deleting temporary CAPTCHA image:', error);
      }
    } else {
      // Send the message without an image
      await channel.send({ embeds: [captchaEmbed] });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending test CAPTCHA:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a CAPTCHA challenge
 * @param {string} type Type of CAPTCHA ('image', 'math', or 'text')
 * @returns {Object} CAPTCHA challenge object with solution and instructions
 */
async function generateCaptcha(type = 'image') {
  switch (type) {
    case 'image':
      return generateImageCaptcha();
    case 'math':
      return generateMathCaptcha();
    case 'text':
      return generateTextCaptcha();
    default:
      return generateImageCaptcha();
  }
}

/**
 * Generate an image CAPTCHA
 * @returns {Object} CAPTCHA challenge with image path, solution, and instructions
 */
async function generateImageCaptcha() {
  try {
    // Generate a random code (4-6 characters)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let solution = '';
    const length = Math.floor(Math.random() * 3) + 4; // 4-6 characters
    
    for (let i = 0; i < length; i++) {
      solution += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    // Create a unique filename
    const filename = path.join(tempDir, `captcha_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`);
    
    // Generate the image using sharp
    const width = 300;
    const height = 100;
    
    // Create a blank canvas
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        ${Array.from({ length: 10 }).map(() => {
          const x1 = Math.random() * width;
          const y1 = Math.random() * height;
          const x2 = Math.random() * width;
          const y2 = Math.random() * height;
          const color = `rgb(${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)})`;
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;
        }).join('')}
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="36" font-weight="bold" 
          fill="black" text-anchor="middle" dominant-baseline="middle" 
          transform="rotate(${Math.random() * 10 - 5}, ${width / 2}, ${height / 2})">
          ${solution}
        </text>
        ${Array.from({ length: 50 }).map(() => {
          const cx = Math.random() * width;
          const cy = Math.random() * height;
          const r = Math.random() * 3 + 1;
          const color = `rgb(${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)})`;
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
        }).join('')}
      </svg>
    `;
    
    // Convert SVG to PNG and save
    await sharp(Buffer.from(svg)).png().toFile(filename);
    
    return {
      imagePath: filename,
      solution: solution,
      instructions: 'Enter the characters shown in the image (case insensitive).'
    };
  } catch (error) {
    console.error('Error generating image CAPTCHA:', error);
    
    // Fallback to text CAPTCHA if image generation fails
    return generateTextCaptcha();
  }
}

/**
 * Generate a math CAPTCHA
 * @returns {Object} CAPTCHA challenge with solution and instructions
 */
function generateMathCaptcha() {
  // Generate random numbers for the problem
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  
  // Choose a random operation (addition, subtraction, multiplication)
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * 3)];
  
  // Calculate the solution
  let solution;
  let problem;
  
  switch (operation) {
    case '+':
      solution = num1 + num2;
      problem = `${num1} + ${num2}`;
      break;
    case '-':
      // Make sure the result is positive
      if (num1 >= num2) {
        solution = num1 - num2;
        problem = `${num1} - ${num2}`;
      } else {
        solution = num2 - num1;
        problem = `${num2} - ${num1}`;
      }
      break;
    case '*':
      // Use smaller numbers for multiplication
      const factor1 = Math.floor(Math.random() * 10) + 1;
      const factor2 = Math.floor(Math.random() * 10) + 1;
      solution = factor1 * factor2;
      problem = `${factor1} × ${factor2}`;
      break;
  }
  
  return {
    solution: solution.toString(),
    instructions: `Solve this math problem: **${problem} = ?**\n\nEnter just the number as your answer.`
  };
}

/**
 * Generate a text CAPTCHA
 * @returns {Object} CAPTCHA challenge with solution and instructions
 */
function generateTextCaptcha() {
  // Define a set of simple questions with answers
  const questions = [
    { q: 'What color is the sky on a clear day?', a: 'blue' },
    { q: 'How many sides does a triangle have?', a: '3' },
    { q: 'What is 2+2?', a: '4' },
    { q: 'What is the opposite of "hot"?', a: 'cold' },
    { q: 'What is the first letter of the alphabet?', a: 'a' },
    { q: 'How many days are in a week?', a: '7' },
    { q: 'What season comes after winter?', a: 'spring' },
    { q: 'Type the word "verify" to confirm you are human.', a: 'verify' },
    { q: 'What planet do we live on?', a: 'earth' },
    { q: 'What is 5+5?', a: '10' }
  ];
  
  // Select a random question
  const selected = questions[Math.floor(Math.random() * questions.length)];
  
  return {
    solution: selected.a,
    instructions: `Answer this question: **${selected.q}**\n\nEnter your answer in lowercase.`
  };
}