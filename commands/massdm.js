const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../utils/config');
const fs = require('fs');
const path = require('path');

// Owner-only command
module.exports = {
  name: 'massdm',
  description: 'Send a direct message to all members in a server (Owner Only)',
  usage: '/massdm',
  ownerOnly: true, // This will be used to hide it from help command
  data: new SlashCommandBuilder()
    .setName('massdm')
    .setDescription('Send a direct message to all members in a server (Owner Only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Send a DM to all members in the current server')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('The message to send (supports basic markdown)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Send a DM to all members across all servers')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('The message to send (supports basic markdown)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('interactive')
        .setDescription('Open an interactive message builder to craft the perfect DM'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the status of ongoing DM operations')),

  async execute(message, args, client, interaction = null) {
    // Check if it's a slash command or message command
    const isSlashCommand = !!interaction;
    
    // Get the user
    const user = isSlashCommand ? interaction.user : message.author;
    
    // Load bot config to check owner
    let botConfig = {};
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      if (fs.existsSync(configPath)) {
        botConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading bot config:', error);
    }
    
    // Verify if the user is the bot owner
    const isOwner = user.id === (botConfig.ownerId || process.env.OWNER_ID);
    
    if (!isOwner) {
      const errorMessage = '🔒 **ACCESS DENIED**: This command is restricted to the bot owner only.';
      if (isSlashCommand) {
        return interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        return message.reply(errorMessage);
      }
    }
    
    // For slash commands
    if (isSlashCommand) {
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'server':
          await interaction.deferReply({ ephemeral: true });
          const serverMessage = interaction.options.getString('message');
          return handleServerDM(interaction, client, serverMessage, interaction.guild);
        
        case 'all':
          await interaction.deferReply({ ephemeral: true });
          const allMessage = interaction.options.getString('message');
          return handleAllServersDM(interaction, client, allMessage);
        
        case 'interactive':
          return handleInteractiveDM(interaction, client);
        
        case 'status':
          await interaction.deferReply({ ephemeral: true });
          return handleDMStatus(interaction, client);
      }
    } 
    // For traditional message commands
    else {
      if (!args || args.length === 0) {
        return message.reply('❌ Please specify an option: `server [message]`, `all [message]`, `interactive`, or `status`');
      }
      
      const option = args[0].toLowerCase();
      
      switch (option) {
        case 'server':
          if (args.length < 2) {
            return message.reply('❌ Please provide a message to send.');
          }
          const serverMessage = args.slice(1).join(' ');
          return handleServerDM(message, client, serverMessage, message.guild);
        
        case 'all':
          if (args.length < 2) {
            return message.reply('❌ Please provide a message to send.');
          }
          const allMessage = args.slice(1).join(' ');
          return handleAllServersDM(message, client, allMessage);
        
        case 'interactive':
          return message.reply('❌ Interactive mode is only available via slash command. Please use `/massdm interactive`.');
        
        case 'status':
          return handleDMStatus(message, client);
        
        default:
          return message.reply('❌ Invalid option. Use `server [message]`, `all [message]`, `interactive`, or `status`');
      }
    }
  }
};

// Tracking for ongoing DM operations
const activeDMOperations = new Map();

async function handleServerDM(interaction, client, message, guild) {
  // Create a confirmation embed
  const memberCount = guild.memberCount;
  const estimatedTime = Math.ceil(memberCount / 40); // ~40 DMs per minute is safe
  
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Mass DM')
    .setDescription(`Are you sure you want to send a DM to **all ${memberCount} members** in **${guild.name}**?
    
**Message Preview:**
${message.substring(0, 1000)}${message.length > 1000 ? '...' : ''}`)
    .setColor(0xFF9900)
    .addFields({ 
      name: '⏱️ Estimated Time', 
      value: `~${estimatedTime} minute${estimatedTime !== 1 ? 's' : ''}` 
    })
    .addFields({ 
      name: '⚠️ Warning', 
      value: 'Mass DMing members can result in your bot being rate limited or reported. Use this feature responsibly and only when necessary.' 
    })
    .setFooter({ text: 'This confirmation will expire in 60 seconds' })
    .setTimestamp();
    
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_dm_server')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_dm_server')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    
  // Send confirmation
  const reply = interaction.editReply ? 
    await interaction.editReply({ embeds: [confirmEmbed], components: [row] }) :
    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  
  // Create collector
  const serverDmFilter = i => i.user.id === (interaction.user ? interaction.user.id : interaction.author.id);
  const collector = reply.createMessageComponentCollector({ serverDmFilter, time: 60000 });
  
  collector.on('collect', async i => {
    if (i.customId === 'confirm_dm_server') {
      await i.update({ content: 'Starting DM process...', embeds: [], components: [] });
      
      // Create a unique operation ID
      const operationId = Date.now().toString();
      
      // Setup tracking
      activeDMOperations.set(operationId, {
        type: 'server',
        guildId: guild.id,
        guildName: guild.name,
        message: message,
        startTime: Date.now(),
        total: memberCount,
        sent: 0,
        failed: 0,
        status: 'running'
      });
      
      // Start the DMing process in the background
      processDMs(client, guild, message, operationId, i).catch(console.error);
      
      // Immediately respond to the user
      const startedEmbed = new EmbedBuilder()
        .setTitle('📤 Mass DM Started')
        .setDescription(`Started sending DMs to all members in **${guild.name}**.`)
        .setColor(0x00FF00)
        .addFields({ 
          name: '📝 Operation Details', 
          value: `Operation ID: ${operationId}\nTotal Recipients: ${memberCount}\nCheck status with \`/massdm status\`` 
        })
        .setTimestamp();
      
      await i.editReply({ embeds: [startedEmbed], components: [] });
    } else {
      await i.update({ content: '❌ Mass DM cancelled.', embeds: [], components: [] });
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
}

async function handleAllServersDM(interaction, client, message) {
  // Calculate total member count across all servers
  let totalMembers = 0;
  const guilds = client.guilds.cache;
  guilds.forEach(guild => {
    totalMembers += guild.memberCount;
  });
  
  const estimatedTime = Math.ceil(totalMembers / 40); // ~40 DMs per minute
  
  // Create a confirmation embed
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Global Mass DM')
    .setDescription(`Are you sure you want to send a DM to **all ${totalMembers} members** across **${guilds.size} servers**?
    
**Message Preview:**
${message.substring(0, 1000)}${message.length > 1000 ? '...' : ''}`)
    .setColor(0xFF0000)
    .addFields({ 
      name: '⏱️ Estimated Time', 
      value: `~${estimatedTime} minute${estimatedTime !== 1 ? 's' : ''}` 
    })
    .addFields({ 
      name: '⚠️ WARNING: HIGH RISK OPERATION', 
      value: 'Mass DMing across all servers is extremely risky and could trigger Discord\'s anti-spam measures. Your bot account could be flagged or disabled. Use this feature with extreme caution.' 
    })
    .setFooter({ text: 'This confirmation will expire in 60 seconds' })
    .setTimestamp();
    
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_dm_all')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_dm_all')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    
  // Send confirmation
  const reply = interaction.editReply ? 
    await interaction.editReply({ embeds: [confirmEmbed], components: [row] }) :
    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
  
  // Create collector
  const allDmFilter = i => i.user.id === (interaction.user ? interaction.user.id : interaction.author.id);
  const collector = reply.createMessageComponentCollector({ allDmFilter, time: 60000 });
  
  collector.on('collect', async i => {
    if (i.customId === 'confirm_dm_all') {
      await i.update({ content: 'Starting global DM process...', embeds: [], components: [] });
      
      // Create a unique operation ID
      const operationId = Date.now().toString();
      
      // Setup tracking
      activeDMOperations.set(operationId, {
        type: 'all',
        message: message,
        startTime: Date.now(),
        total: totalMembers,
        sent: 0,
        failed: 0,
        status: 'running',
        guilds: guilds.size
      });
      
      // Start the DMing process in the background
      processAllServersDMs(client, message, operationId, i).catch(console.error);
      
      // Immediately respond to the user
      const startedEmbed = new EmbedBuilder()
        .setTitle('📤 Global Mass DM Started')
        .setDescription(`Started sending DMs to all members across all servers.`)
        .setColor(0x00FF00)
        .addFields({ 
          name: '📝 Operation Details', 
          value: `Operation ID: ${operationId}\nTotal Recipients: ${totalMembers}\nServers: ${guilds.size}\nCheck status with \`/massdm status\`` 
        })
        .setTimestamp();
      
      await i.editReply({ embeds: [startedEmbed], components: [] });
    } else {
      await i.update({ content: '❌ Global Mass DM cancelled.', embeds: [], components: [] });
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
}

async function handleInteractiveDM(interaction, client) {
  // Create and show a modal for the DM content
  const modal = new ModalBuilder()
    .setCustomId('interactive_dm_modal')
    .setTitle('Create Mass DM Message');
    
  // Add content input
  const contentInput = new TextInputBuilder()
    .setCustomId('dm_content')
    .setLabel('Message Content')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter the message you want to send to all members...')
    .setRequired(true)
    .setMaxLength(2000);
    
  // Add title input
  const titleInput = new TextInputBuilder()
    .setCustomId('dm_title')
    .setLabel('Embed Title (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Leave blank for a regular message')
    .setRequired(false)
    .setMaxLength(256);
    
  // Create action rows
  const contentRow = new ActionRowBuilder().addComponents(contentInput);
  const titleRow = new ActionRowBuilder().addComponents(titleInput);
  
  // Add inputs to the modal
  modal.addComponents(contentRow, titleRow);
  
  // Show the modal
  await interaction.showModal(modal);
  
  // Wait for modal submission
  try {
    const modalFilter = i => i.customId === 'interactive_dm_modal';
    const submission = await interaction.awaitModalSubmit({ filter: modalFilter, time: 300000 }); // 5 minute timeout
    
    // Get the values
    const content = submission.fields.getTextInputValue('dm_content');
    const title = submission.fields.getTextInputValue('dm_title');
    
    // Defer reply
    await submission.deferReply({ ephemeral: true });
    
    // Create a message preview
    const previewEmbed = new EmbedBuilder()
      .setTitle('📝 Message Preview')
      .setColor(0x3498DB);
      
    // Show different previews based on if title is provided
    if (title && title.trim()) {
      // With embed
      previewEmbed.setDescription('Your message will be sent as an embed:');
      
      const dmPreview = new EmbedBuilder()
        .setTitle(title)
        .setDescription(content)
        .setColor(0x3498DB)
        .setTimestamp();
        
      // Add server selection options
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('dm_this_server')
            .setLabel('Send to Current Server')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('dm_all_servers')
            .setLabel('Send to All Servers')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('dm_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        
      await submission.editReply({ embeds: [previewEmbed, dmPreview], components: [selectRow] });
    } else {
      // Plain text message
      previewEmbed.setDescription('Your message will be sent as a plain text message:');
      
      // Add server selection options
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('dm_this_server')
            .setLabel('Send to Current Server')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('dm_all_servers')
            .setLabel('Send to All Servers')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('dm_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        
      await submission.editReply({ embeds: [previewEmbed], content: content, components: [selectRow] });
    }
    
    // Create collector for the selection
    const buttonFilter = i => i.user.id === interaction.user.id;
    const collector = submission.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });
    
    collector.on('collect', async i => {
      if (i.customId === 'dm_this_server') {
        await i.update({ content: 'Processing server selection...', embeds: [], components: [] });
        
        // Pass formatted message for this server
        let messageToSend;
        if (title && title.trim()) {
          messageToSend = { embeds: [new EmbedBuilder().setTitle(title).setDescription(content).setColor(0x3498DB).setTimestamp()] };
        } else {
          messageToSend = content;
        }
        
        return handleServerDM(i, client, messageToSend, interaction.guild);
      } 
      else if (i.customId === 'dm_all_servers') {
        await i.update({ content: 'Processing global selection...', embeds: [], components: [] });
        
        // Pass formatted message for all servers
        let messageToSend;
        if (title && title.trim()) {
          messageToSend = { embeds: [new EmbedBuilder().setTitle(title).setDescription(content).setColor(0x3498DB).setTimestamp()] };
        } else {
          messageToSend = content;
        }
        
        return handleAllServersDM(i, client, messageToSend);
      } 
      else {
        await i.update({ content: '❌ Mass DM cancelled.', embeds: [], components: [] });
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        submission.editReply({ content: '⌛ The selection timed out.', embeds: [], components: [] });
      }
    });
  } catch (error) {
    console.error('Error with interactive DM:', error);
    // If there was a timeout or other error
    return;
  }
}

async function handleDMStatus(interaction, client) {
  if (activeDMOperations.size === 0) {
    const noOpsEmbed = new EmbedBuilder()
      .setTitle('📊 DM Operations Status')
      .setDescription('There are no active or recent DM operations.')
      .setColor(0x3498DB)
      .setTimestamp();
      
    if (interaction.editReply) {
      return interaction.editReply({ embeds: [noOpsEmbed] });
    } else {
      return interaction.reply({ embeds: [noOpsEmbed] });
    }
  }
  
  // Create status embed
  const statusEmbed = new EmbedBuilder()
    .setTitle('📊 DM Operations Status')
    .setColor(0x3498DB)
    .setTimestamp();
    
  // Add each operation
  const operations = Array.from(activeDMOperations.entries()).slice(-10); // Show last 10 operations
  
  for (const [id, op] of operations) {
    let duration = '';
    if (op.status === 'running') {
      duration = `${Math.floor((Date.now() - op.startTime) / 60000)} minutes`;
    } else if (op.status === 'completed' || op.status === 'failed') {
      duration = `${Math.floor((op.endTime - op.startTime) / 60000)} minutes`;
    }
    
    let statusText;
    if (op.status === 'running') {
      statusText = `⏳ Running (${op.sent}/${op.total} sent, ${op.failed} failed)`;
    } else if (op.status === 'completed') {
      statusText = `✅ Completed (${op.sent}/${op.total} sent, ${op.failed} failed)`;
    } else if (op.status === 'failed') {
      statusText = `❌ Failed (${op.sent}/${op.total} sent, ${op.failed} failed)`;
    }
    
    const fieldTitle = op.type === 'server' ? 
      `Operation ${id} - ${op.guildName}` : 
      `Operation ${id} - All Servers (${op.guilds})`;
      
    statusEmbed.addFields({ 
      name: fieldTitle,
      value: `Status: ${statusText}\nDuration: ${duration}\nMessage: \`${op.message.substring(0, 50)}${op.message.length > 50 ? '...' : ''}\``
    });
  }
  
  // Add note if there are more operations
  if (activeDMOperations.size > 10) {
    statusEmbed.setFooter({ text: `Showing 10 of ${activeDMOperations.size} operations` });
  }
  
  if (interaction.editReply) {
    return interaction.editReply({ embeds: [statusEmbed] });
  } else {
    return interaction.reply({ embeds: [statusEmbed] });
  }
}

async function processDMs(client, guild, message, operationId, interaction) {
  try {
    // Get operation
    const operation = activeDMOperations.get(operationId);
    if (!operation) return;
    
    console.log(`[MASS-DM] Starting operation ${operationId} for guild ${guild.name} (${guild.id})`);
    
    // Fetch members
    let members;
    try {
      members = await guild.members.fetch();
    } catch (fetchError) {
      console.error(`[MASS-DM] Error fetching members for guild ${guild.id}:`, fetchError);
      
      // Update operation status
      operation.status = 'failed';
      operation.endTime = Date.now();
      operation.error = fetchError.message;
      activeDMOperations.set(operationId, operation);
      
      return;
    }
    
    // Filter out bots
    members = members.filter(member => !member.user.bot);
    
    console.log(`[MASS-DM] Processing ${members.size} members for guild ${guild.name}`);
    
    // Process in chunks to avoid rate limits (40 DMs per minute is safe)
    const chunkSize = 40;
    const delayBetweenChunks = 60000; // 1 minute
    
    // Convert to array
    const membersArray = Array.from(members.values());
    
    // Process in chunks
    for (let i = 0; i < membersArray.length; i += chunkSize) {
      const chunk = membersArray.slice(i, i + chunkSize);
      
      // Update operation progress before processing chunk
      operation.progress = `Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(membersArray.length / chunkSize)}`;
      activeDMOperations.set(operationId, operation);
      
      // Process each member in the chunk
      for (const member of chunk) {
        try {
          await member.send(message);
          operation.sent++;
        } catch (dmError) {
          console.error(`[MASS-DM] Error DMing user ${member.user.tag}:`, dmError);
          operation.failed++;
        }
        
        // Update operation
        activeDMOperations.set(operationId, operation);
        
        // Small delay between DMs to reduce rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // If there are more chunks, pause before the next one
      if (i + chunkSize < membersArray.length) {
        console.log(`[MASS-DM] Pausing for ${delayBetweenChunks / 1000} seconds before next chunk`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
      }
    }
    
    // Complete the operation
    operation.status = 'completed';
    operation.endTime = Date.now();
    activeDMOperations.set(operationId, operation);
    
    console.log(`[MASS-DM] Completed operation ${operationId} for guild ${guild.name}`);
  } catch (error) {
    console.error(`[MASS-DM] Unhandled error in operation ${operationId}:`, error);
    
    // Update operation status
    const operation = activeDMOperations.get(operationId);
    if (operation) {
      operation.status = 'failed';
      operation.endTime = Date.now();
      operation.error = error.message;
      activeDMOperations.set(operationId, operation);
    }
  }
}

async function processAllServersDMs(client, message, operationId, interaction) {
  try {
    // Get operation
    const operation = activeDMOperations.get(operationId);
    if (!operation) return;
    
    console.log(`[MASS-DM] Starting global operation ${operationId} across all servers`);
    
    // Get all guilds
    const guilds = client.guilds.cache;
    
    // Process each guild
    let guildCount = 0;
    for (const [guildId, guild] of guilds) {
      guildCount++;
      console.log(`[MASS-DM] Processing guild ${guildCount}/${guilds.size}: ${guild.name} (${guild.id})`);
      
      // Update operation progress
      operation.progress = `Processing guild ${guildCount}/${guilds.size}`;
      activeDMOperations.set(operationId, operation);
      
      try {
        // Fetch members
        let members;
        try {
          members = await guild.members.fetch();
        } catch (fetchError) {
          console.error(`[MASS-DM] Error fetching members for guild ${guild.id}:`, fetchError);
          continue; // Skip to next guild
        }
        
        // Filter out bots
        members = members.filter(member => !member.user.bot);
        
        // Process in chunks to avoid rate limits (40 DMs per minute is safe)
        const chunkSize = 40;
        const delayBetweenChunks = 60000; // 1 minute
        
        // Convert to array
        const membersArray = Array.from(members.values());
        
        // Process in chunks
        for (let i = 0; i < membersArray.length; i += chunkSize) {
          const chunk = membersArray.slice(i, i + chunkSize);
          
          // Process each member in the chunk
          for (const member of chunk) {
            try {
              await member.send(message);
              operation.sent++;
            } catch (dmError) {
              console.error(`[MASS-DM] Error DMing user ${member.user.tag}:`, dmError);
              operation.failed++;
            }
            
            // Update operation
            activeDMOperations.set(operationId, operation);
            
            // Small delay between DMs to reduce rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // If there are more chunks, pause before the next one
          if (i + chunkSize < membersArray.length) {
            console.log(`[MASS-DM] Pausing for ${delayBetweenChunks / 1000} seconds before next chunk`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
          }
        }
      } catch (guildError) {
        console.error(`[MASS-DM] Error processing guild ${guild.id}:`, guildError);
        continue; // Skip to next guild
      }
      
      // Add a delay between guilds to reduce rate limiting
      if (guildCount < guilds.size) {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute between guilds
      }
    }
    
    // Complete the operation
    operation.status = 'completed';
    operation.endTime = Date.now();
    activeDMOperations.set(operationId, operation);
    
    console.log(`[MASS-DM] Completed global operation ${operationId}`);
  } catch (error) {
    console.error(`[MASS-DM] Unhandled error in global operation ${operationId}:`, error);
    
    // Update operation status
    const operation = activeDMOperations.get(operationId);
    if (operation) {
      operation.status = 'failed';
      operation.endTime = Date.now();
      operation.error = error.message;
      activeDMOperations.set(operationId, operation);
    }
  }
}