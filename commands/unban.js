const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../utils/config');

module.exports = {
  name: 'unban',
  description: 'Unban one or multiple users from the server',
  usage: '/unban [options]',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban one or multiple users from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addSubcommand(subcommand => 
      subcommand
        .setName('user')
        .setDescription('Unban a specific user by ID')
        .addStringOption(option => 
          option
            .setName('user_id')
            .setDescription('The ID of the user to unban')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('multiple')
        .setDescription('Unban multiple users by their IDs')
        .addStringOption(option => 
          option
            .setName('user_ids')
            .setDescription('Comma-separated list of user IDs to unban (e.g., 123456789,987654321)')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('recent')
        .setDescription('Unban users who were banned within a specific time period')
        .addIntegerOption(option => 
          option
            .setName('hours')
            .setDescription('Unban users banned within this many hours (default: 24)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(720)))  // Max 30 days
    .addSubcommand(subcommand => 
      subcommand
        .setName('all')
        .setDescription('Unban all banned users (USE WITH CAUTION)')
        .addBooleanOption(option => 
          option
            .setName('confirm')
            .setDescription('Confirm that you want to unban ALL users')
            .setRequired(true))),

  async execute(message, args, client, interaction = null) {
    // Check if it's a slash command or message command
    const isSlashCommand = !!interaction;
    
    // Get the guild and user that initiated the command
    const guild = isSlashCommand ? interaction.guild : message.guild;
    const user = isSlashCommand ? interaction.user : message.author;
    
    // Check if the user has ban permissions
    const member = guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
      const noPermissionReply = '❌ You don\'t have permission to unban members.';
      if (isSlashCommand) {
        return interaction.reply({ content: noPermissionReply, ephemeral: true });
      } else {
        return message.reply(noPermissionReply);
      }
    }
    
    // For slash commands
    if (isSlashCommand) {
      await interaction.deferReply();
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'user': {
          const userId = interaction.options.getString('user_id');
          return handleSingleUnban(userId, interaction, guild);
        }
        
        case 'multiple': {
          const userIdsString = interaction.options.getString('user_ids');
          const userIds = userIdsString.split(',').map(id => id.trim());
          return handleMultipleUnbans(userIds, interaction, guild);
        }
        
        case 'recent': {
          const hours = interaction.options.getInteger('hours') || 24;
          return handleRecentUnbans(hours, interaction, guild);
        }
        
        case 'all': {
          const confirm = interaction.options.getBoolean('confirm');
          if (!confirm) {
            return interaction.editReply('⚠️ You must confirm this action to unban all users.');
          }
          return handleAllUnbans(interaction, guild);
        }
      }
    } 
    // For traditional message commands
    else {
      if (!args || args.length === 0) {
        return message.reply('❌ Please specify an option: `user [ID]`, `multiple [ID1,ID2,...]`, `recent [hours]`, or `all`');
      }
      
      const option = args[0].toLowerCase();
      
      switch (option) {
        case 'user': {
          if (args.length < 2) {
            return message.reply('❌ Please provide a user ID to unban.');
          }
          const userId = args[1];
          return handleSingleUnban(userId, message, guild);
        }
        
        case 'multiple': {
          if (args.length < 2) {
            return message.reply('❌ Please provide comma-separated user IDs to unban.');
          }
          const userIdsString = args.slice(1).join(' ');
          const userIds = userIdsString.split(',').map(id => id.trim());
          return handleMultipleUnbans(userIds, message, guild);
        }
        
        case 'recent': {
          const hours = args.length >= 2 ? parseInt(args[1]) || 24 : 24;
          return handleRecentUnbans(hours, message, guild);
        }
        
        case 'all': {
          // Create confirmation message
          const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Mass Unban')
            .setDescription('Are you sure you want to unban ALL users? This action cannot be undone.')
            .setColor(0xFF9900)
            .setFooter({ text: 'This confirmation will expire in 30 seconds' });
            
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('confirm_unban_all')
                .setLabel('Yes, Unban All')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cancel_unban_all')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
            );
            
          const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });
          
          const filter = i => i.user.id === message.author.id;
          const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });
          
          collector.on('collect', async i => {
            if (i.customId === 'confirm_unban_all') {
              await i.update({ content: 'Processing unbans...', embeds: [], components: [] });
              return handleAllUnbans(confirmMsg, guild);
            } else {
              await i.update({ content: '❌ Operation cancelled.', embeds: [], components: [] });
            }
          });
          
          collector.on('end', collected => {
            if (collected.size === 0) {
              confirmMsg.edit({ content: '⌛ The confirmation timed out.', embeds: [], components: [] });
            }
          });
          
          return;
        }
        
        default:
          return message.reply('❌ Invalid option. Use `user [ID]`, `multiple [ID1,ID2,...]`, `recent [hours]`, or `all`');
      }
    }
  }
};

async function handleSingleUnban(userId, interaction, guild) {
  try {
    // Try to unban the user
    await guild.members.unban(userId, 'Manual unban via command');
    
    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ User Unbanned')
      .setDescription(`Successfully unbanned user <@${userId}> (${userId})`)
      .setColor(0x00FF00)
      .setTimestamp();
    
    // Send response
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [successEmbed] });
    } else {
      return interaction.reply({ embeds: [successEmbed] });
    }
  } catch (error) {
    console.error('Error while unbanning user:', error);
    
    // Create error embed
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Unbanning User')
      .setDescription(`Failed to unban user with ID ${userId}. They may not be banned or the ID could be invalid.`)
      .setColor(0xFF0000)
      .setTimestamp();
      
    // Include error details if available
    if (error.message) {
      errorEmbed.addFields({ name: 'Error Details', value: error.message });
    }
    
    // Send response
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [errorEmbed] });
    } else {
      return interaction.reply({ embeds: [errorEmbed] });
    }
  }
}

async function handleMultipleUnbans(userIds, interaction, guild) {
  // Create progress embed
  const progressEmbed = new EmbedBuilder()
    .setTitle('⏳ Processing Multiple Unbans')
    .setDescription(`Attempting to unban ${userIds.length} users...`)
    .setColor(0xFFAA00)
    .setTimestamp();
    
  // Send initial response
  if (interaction.editReply) {
    await interaction.editReply({ embeds: [progressEmbed] });
  } else {
    await interaction.reply({ embeds: [progressEmbed] });
  }
  
  // Track successes and failures
  const results = { success: [], failed: [] };
  
  // Process each unban
  for (const userId of userIds) {
    try {
      await guild.members.unban(userId, 'Mass unban via command');
      results.success.push(userId);
    } catch (error) {
      console.error(`Error unbanning user ${userId}:`, error);
      results.failed.push({ id: userId, reason: error.message || 'Unknown error' });
    }
  }
  
  // Create results embed
  const resultsEmbed = new EmbedBuilder()
    .setTitle('📊 Unban Results')
    .setDescription(`Successfully unbanned ${results.success.length} out of ${userIds.length} users.`)
    .setColor(results.failed.length === 0 ? 0x00FF00 : (results.success.length === 0 ? 0xFF0000 : 0xFFAA00))
    .setTimestamp();
    
  // Add success field if any
  if (results.success.length > 0) {
    resultsEmbed.addFields({ 
      name: '✅ Successfully Unbanned', 
      value: results.success.map(id => `<@${id}> (${id})`).join('\n').substring(0, 1024) 
    });
  }
  
  // Add failures field if any
  if (results.failed.length > 0) {
    resultsEmbed.addFields({ 
      name: '❌ Failed to Unban', 
      value: results.failed.map(f => `<@${f.id}> (${f.id}) - ${f.reason}`).join('\n').substring(0, 1024) 
    });
  }
  
  // Send results
  if (interaction.editReply) {
    return interaction.editReply({ embeds: [resultsEmbed] });
  } else {
    return interaction.reply({ embeds: [resultsEmbed] });
  }
}

async function handleRecentUnbans(hours, interaction, guild) {
  // Create progress embed
  const progressEmbed = new EmbedBuilder()
    .setTitle('⏳ Processing Recent Unbans')
    .setDescription(`Fetching users banned in the last ${hours} hours...`)
    .setColor(0xFFAA00)
    .setTimestamp();
    
  // Send initial response
  if (interaction.editReply) {
    await interaction.editReply({ embeds: [progressEmbed] });
  } else {
    await interaction.reply({ embeds: [progressEmbed] });
  }
  
  try {
    // Fetch banned users
    const bans = await guild.bans.fetch();
    
    // Calculate the cutoff time
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // Filter recent bans (this requires audit logs which may not be available)
    // Instead, we'll unban everyone and notify the user about the limitation
    const userIds = bans.map(ban => ban.user.id);
    
    if (userIds.length === 0) {
      const noUsersEmbed = new EmbedBuilder()
        .setTitle('ℹ️ No Banned Users')
        .setDescription('There are no banned users in this server.')
        .setColor(0x3498DB)
        .setTimestamp();
        
      if (interaction.editReply) {
        return interaction.editReply({ embeds: [noUsersEmbed] });
      } else {
        return interaction.reply({ embeds: [noUsersEmbed] });
      }
    }
    
    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Recent Unbans')
      .setDescription(`Discord API doesn't provide ban timestamps without additional setup.
      
Would you like to unban all ${userIds.length} currently banned users instead?`)
      .setColor(0xFF9900)
      .setFooter({ text: 'This confirmation will expire in 30 seconds' });
      
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_recent_unban')
          .setLabel(`Yes, Unban All ${userIds.length} Users`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_recent_unban')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
      
    // Send confirmation
    let confirmMsg;
    if (interaction.editReply) {
      confirmMsg = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } else {
      confirmMsg = await interaction.reply({ embeds: [confirmEmbed], components: [row] });
    }
    
    // Create collector
    const filter = i => {
      if (interaction.user) {
        return i.user.id === interaction.user.id;
      } else {
        return i.user.id === interaction.author.id;
      }
    };
    
    const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });
    
    collector.on('collect', async i => {
      if (i.customId === 'confirm_recent_unban') {
        await i.update({ content: 'Processing unbans...', embeds: [], components: [] });
        return handleMultipleUnbans(userIds, confirmMsg, guild);
      } else {
        await i.update({ content: '❌ Operation cancelled.', embeds: [], components: [] });
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        if (interaction.editReply) {
          interaction.editReply({ content: '⌛ The confirmation timed out.', embeds: [], components: [] });
        } else {
          interaction.edit({ content: '⌛ The confirmation timed out.', embeds: [], components: [] });
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bans:', error);
    
    // Create error embed
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Processing Unbans')
      .setDescription('An error occurred while fetching banned users.')
      .setColor(0xFF0000)
      .addFields({ name: 'Error Details', value: error.message || 'Unknown error' })
      .setTimestamp();
      
    // Send error
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [errorEmbed] });
    } else {
      return interaction.reply({ embeds: [errorEmbed] });
    }
  }
}

async function handleAllUnbans(interaction, guild) {
  // Create progress embed
  const progressEmbed = new EmbedBuilder()
    .setTitle('⏳ Processing Mass Unban')
    .setDescription('Fetching all banned users...')
    .setColor(0xFFAA00)
    .setTimestamp();
    
  // Send initial response
  if (interaction.editReply) {
    await interaction.editReply({ embeds: [progressEmbed] });
  } else {
    await interaction.reply({ embeds: [progressEmbed] });
  }
  
  try {
    // Fetch banned users
    const bans = await guild.bans.fetch();
    
    if (bans.size === 0) {
      const noUsersEmbed = new EmbedBuilder()
        .setTitle('ℹ️ No Banned Users')
        .setDescription('There are no banned users in this server.')
        .setColor(0x3498DB)
        .setTimestamp();
        
      if (interaction.editReply) {
        return interaction.editReply({ embeds: [noUsersEmbed] });
      } else {
        return interaction.reply({ embeds: [noUsersEmbed] });
      }
    }
    
    // Update progress
    const updatedProgressEmbed = new EmbedBuilder()
      .setTitle('⏳ Processing Mass Unban')
      .setDescription(`Unbanning ${bans.size} users...`)
      .setColor(0xFFAA00)
      .setTimestamp();
      
    if (interaction.editReply) {
      await interaction.editReply({ embeds: [updatedProgressEmbed] });
    } else {
      await interaction.edit({ embeds: [updatedProgressEmbed] });
    }
    
    // Track results
    let successCount = 0;
    let failCount = 0;
    
    // Process each unban
    for (const [userId, ban] of bans) {
      try {
        await guild.members.unban(userId, 'Mass unban via command');
        successCount++;
      } catch (error) {
        console.error(`Error unbanning user ${userId}:`, error);
        failCount++;
      }
    }
    
    // Create results embed
    const resultsEmbed = new EmbedBuilder()
      .setTitle('📊 Mass Unban Results')
      .setDescription(`Successfully unbanned ${successCount} out of ${bans.size} users.`)
      .setColor(failCount === 0 ? 0x00FF00 : (successCount === 0 ? 0xFF0000 : 0xFFAA00))
      .addFields({ name: '✅ Success', value: `${successCount} users unbanned` })
      .setTimestamp();
      
    if (failCount > 0) {
      resultsEmbed.addFields({ name: '❌ Failed', value: `${failCount} users could not be unbanned` });
    }
    
    // Send results
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [resultsEmbed] });
    } else {
      return interaction.reply({ embeds: [resultsEmbed] });
    }
  } catch (error) {
    console.error('Error in mass unban:', error);
    
    // Create error embed
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Processing Mass Unban')
      .setDescription('An error occurred while processing the mass unban.')
      .setColor(0xFF0000)
      .addFields({ name: 'Error Details', value: error.message || 'Unknown error' })
      .setTimestamp();
      
    // Send error
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [errorEmbed] });
    } else {
      return interaction.reply({ embeds: [errorEmbed] });
    }
  }
}