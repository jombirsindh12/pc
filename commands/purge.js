const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'purge',
  description: 'Delete a specific number of messages from the channel',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a specific number of messages from the channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (between 1 and 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('contains')
        .setDescription('Only delete messages containing this text')
        .setRequired(false)),
  
  async execute(message, args, client, interaction = null) {
    // Handle slash command
    if (interaction) {
      await handlePurgeCommand(interaction);
      return;
    }
    
    // Handle regular command
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ You need the **Manage Messages** permission to use this command.');
    }
    
    if (!args[0] || isNaN(args[0])) {
      return message.reply('❌ Please specify the number of messages to delete.');
    }
    
    const amount = parseInt(args[0]);
    if (amount < 1 || amount > 100) {
      return message.reply('❌ You can only delete between 1 and 100 messages at a time.');
    }
    
    try {
      // Delete the command message first
      await message.delete();
      
      // Check for user filter
      let userFilter = null;
      if (args[1] && args[1].startsWith('<@') && args[1].endsWith('>')) {
        const userId = args[1].replace(/[<@!>]/g, '');
        userFilter = userId;
      }
      
      // Delete messages
      const messages = await message.channel.messages.fetch({ limit: amount });
      
      // Apply user filter if specified
      let filteredMessages = messages;
      if (userFilter) {
        filteredMessages = messages.filter(msg => msg.author.id === userFilter);
      }
      
      // Bulk delete messages
      const deleted = await message.channel.bulkDelete(filteredMessages, true);
      
      // Send success message
      const successMessage = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🧹 Messages Deleted')
            .setDescription(`Successfully deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}${userFilter ? ` from <@${userFilter}>` : ''}.`)
            .setColor('#43B581')
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp()
        ]
      });
      
      // Auto-delete success message after 5 seconds
      setTimeout(() => {
        successMessage.delete().catch(console.error);
      }, 5000);
    } catch (error) {
      console.error('Error deleting messages:', error);
      message.channel.send('❌ An error occurred while deleting messages. Make sure the messages are not older than 14 days.').then(msg => {
        setTimeout(() => {
          msg.delete().catch(console.error);
        }, 5000);
      });
    }
  }
};

/**
 * Handle slash command version of purge
 * @param {Object} interaction Slash command interaction
 */
async function handlePurgeCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    const containsText = interaction.options.getString('contains');
    
    // Fetch messages
    const messages = await interaction.channel.messages.fetch({ limit: amount });
    
    // Apply filters
    let filteredMessages = messages;
    
    // Filter by user if specified
    if (user) {
      filteredMessages = filteredMessages.filter(msg => msg.author.id === user.id);
    }
    
    // Filter by content if specified
    if (containsText) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.content.toLowerCase().includes(containsText.toLowerCase())
      );
    }
    
    // Check if there are any messages to delete
    if (filteredMessages.size === 0) {
      await interaction.editReply('❌ No messages found matching your criteria.');
      return;
    }
    
    // Bulk delete messages
    const deleted = await interaction.channel.bulkDelete(filteredMessages, true);
    
    // Send success message
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🧹 Messages Deleted')
          .setDescription(`Successfully deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}${user ? ` from ${user.tag}` : ''}${containsText ? ` containing "${containsText}"` : ''}.`)
          .setColor('#43B581')
          .setFooter({ text: `Requested by ${interaction.user.tag}` })
          .setTimestamp()
      ]
    });
    
    // Send a public notification that will auto-delete after 5 seconds
    const publicNotification = await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`🧹 ${interaction.user.tag} purged ${deleted.size} message${deleted.size === 1 ? '' : 's'} from this channel.`)
          .setColor('#43B581')
          .setTimestamp()
      ]
    });
    
    // Auto-delete public notification after 5 seconds
    setTimeout(() => {
      publicNotification.delete().catch(console.error);
    }, 5000);
  } catch (error) {
    console.error('Error handling purge command:', error);
    
    if (error.code === 50034) {
      // Discord API error for messages older than 14 days
      await interaction.editReply('❌ Cannot delete messages older than 14 days.');
    } else {
      await interaction.editReply('❌ An error occurred while deleting messages.');
    }
  }
}