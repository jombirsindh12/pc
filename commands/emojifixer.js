/**
 * Emoji Fixer Command
 * 
 * This command allows users to fix malformed emoji patterns in text.
 */

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const emojiProcessor = require('../utils/emojiProcessor');

module.exports = {
  name: 'emojifixer',
  description: 'Fix malformed emoji patterns in text',
  
  // Modern slash command definition
  data: new SlashCommandBuilder()
    .setName('emojifixer')
    .setDescription('Fix malformed emoji patterns in text')
    .addStringOption(option => 
      option.setName('text')
        .setDescription('The text with emojis to fix')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('private')
        .setDescription('Whether to show the result only to you')
        .setRequired(false)),
  
  async execute(message, args, client, interaction = null) {
    // Handle both slash commands and legacy commands
    const isSlashCommand = !!interaction;
    
    if (isSlashCommand) {
      await interaction.deferReply({
        ephemeral: interaction.options.getBoolean('private') || false
      });
      
      const text = interaction.options.getString('text');
      
      // Process text with emoji processor to fix malformed patterns
      const processedText = await emojiProcessor.processText(text, interaction.guild.id);
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setColor('#00a8ff')
        .setTitle('🔧 Emoji Fixer Result')
        .setDescription('Fixed any malformed emoji patterns in your text')
        .addFields(
          { name: 'Original Text', value: text },
          { name: 'Fixed Text', value: processedText }
        )
        .setFooter({ text: 'Fixed using advanced emoji pattern recognition' });
      
      // Add diagnosis field
      if (text === processedText) {
        embed.addFields({
          name: 'Diagnosis',
          value: '✅ No malformed emoji patterns detected'
        });
      } else {
        embed.addFields({
          name: 'Diagnosis',
          value: '🔧 Fixed malformed emoji patterns in your text'
        });
      }
      
      // Send response
      await interaction.followUp({
        embeds: [embed],
        ephemeral: interaction.options.getBoolean('private') || false
      });
    } else {
      // Legacy command format
      if (!args.length) {
        return message.reply('Please provide text with emojis to fix.');
      }
      
      const text = args.join(' ');
      
      // Process text with emoji processor
      const processedText = await emojiProcessor.processText(text, message.guild.id);
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setColor('#00a8ff')
        .setTitle('🔧 Emoji Fixer Result')
        .setDescription('Fixed any malformed emoji patterns in your text')
        .addFields(
          { name: 'Original Text', value: text },
          { name: 'Fixed Text', value: processedText }
        )
        .setFooter({ text: 'Fixed using advanced emoji pattern recognition' });
      
      // Add diagnosis field
      if (text === processedText) {
        embed.addFields({
          name: 'Diagnosis',
          value: '✅ No malformed emoji patterns detected'
        });
      } else {
        embed.addFields({
          name: 'Diagnosis',
          value: '🔧 Fixed malformed emoji patterns in your text'
        });
      }
      
      // Send response
      await message.reply({ embeds: [embed] });
    }
  }
};