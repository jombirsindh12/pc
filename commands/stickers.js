const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { animatedEmojis } = require('../utils/emojiProcessor');

module.exports = {
  name: 'stickers',
  description: 'Shows a list of available Nitro stickers and how to use them',
  usage: '/stickers',
  
  // Discord.js v14 slash command builder
  data: new SlashCommandBuilder()
    .setName('stickers')
    .setDescription('Shows a list of available Nitro stickers and how to use them'),
  
  async execute(message, args, client, interaction = null) {
    console.log('Executing stickers command');
    
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    
    // Function to send the response
    async function sendResponse(response) {
      if (isSlashCommand) {
        if (interaction.deferred) {
          return await interaction.followUp(response);
        } else {
          return await interaction.reply(response);
        }
      } else {
        return await message.reply(response);
      }
    }
    
    try {
      // Create an array of sticker names by extracting from animatedEmojis
      const stickerEmojis = Object.keys(animatedEmojis)
        // Filter to ones that are likely stickers (exclude basic emojis)
        .filter(key => {
          const name = key.replace(/:/g, '');
          return name.includes('_') || 
                 name.includes('nitro') || 
                 name.includes('pepe') || 
                 name.includes('blob') || 
                 name.includes('cat') || 
                 name.includes('animated') ||
                 name.includes('rainbow') ||
                 name.includes('party');
        })
        // Format names without the colons
        .map(key => {
          const name = key.replace(/:/g, '');
          const emoji = animatedEmojis[key];
          return {
            name,
            id: emoji.id,
            formatted: `<a:${emoji.name}:${emoji.id}>`
          };
        });
      
      // Create the embed for the stickers list
      const embed = new EmbedBuilder()
        .setTitle('✨ Available Nitro Stickers')
        .setDescription(
          'These animated stickers can be used in any message or welcome message.\n\n' +
          'You can use them in three ways:\n' +
          '1. `:sticker_name:` - Standard emoji format\n' +
          '2. `{sticker:sticker_name}` - Curly brace format\n' +
          '3. `[sticker:sticker_name]` - Bracket format\n\n' +
          'For example, to use the heart_rainbow sticker, you can type:\n' +
          '`:heart_rainbow:`, `{sticker:heart_rainbow}`, or `[sticker:heart_rainbow]`'
        )
        .setColor(0xFF73FA) // Nitro purple/pink color
        .setFooter({ text: 'Nitro stickers are premium animated emojis' });
      
      // Create fields for each category of stickers
      const nitroStickers = stickerEmojis.filter(s => 
        s.name.includes('nitro') || 
        s.name.includes('boost') || 
        s.name === 'discord_nitro'
      );
      
      const animalStickers = stickerEmojis.filter(s => 
        s.name.includes('cat') || 
        s.name.includes('dog') || 
        s.name.includes('duck') || 
        s.name.includes('bongocat')
      );
      
      const welcomeStickers = stickerEmojis.filter(s =>
        s.name.includes('welcome') ||
        s.name.includes('wave') ||
        s.name.includes('tada') ||
        s.name.includes('celebration')
      );
      
      const heartStickers = stickerEmojis.filter(s =>
        s.name.includes('heart') ||
        s.name.includes('love') ||
        s.name.includes('hearts')
      );
      
      const gameStickers = stickerEmojis.filter(s =>
        s.name.includes('gaming') ||
        s.name.includes('minecraft') ||
        s.name.includes('among') ||
        s.name.includes('mario') ||
        s.name.includes('sonic')
      );
      
      const memeStickers = stickerEmojis.filter(s =>
        s.name.includes('pepe') ||
        s.name.includes('doge') ||
        s.name.includes('blob') ||
        s.name.includes('stonks')
      );
      
      const specialEffectStickers = stickerEmojis.filter(s =>
        s.name.includes('sparkle') ||
        s.name.includes('rainbow') ||
        s.name.includes('glow') ||
        s.name.includes('shine') ||
        s.name.includes('fire') ||
        s.name.includes('confetti')
      );
      
      // Add fields for each category
      if (nitroStickers.length > 0) {
        embed.addFields({
          name: '🚀 Nitro Stickers',
          value: nitroStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (welcomeStickers.length > 0) {
        embed.addFields({
          name: '👋 Welcome Stickers',
          value: welcomeStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (heartStickers.length > 0) {
        embed.addFields({
          name: '❤️ Heart Stickers',
          value: heartStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (animalStickers.length > 0) {
        embed.addFields({
          name: '🐱 Animal Stickers',
          value: animalStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (gameStickers.length > 0) {
        embed.addFields({
          name: '🎮 Gaming Stickers',
          value: gameStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (memeStickers.length > 0) {
        embed.addFields({
          name: '😂 Meme Stickers',
          value: memeStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      if (specialEffectStickers.length > 0) {
        embed.addFields({
          name: '✨ Special Effect Stickers',
          value: specialEffectStickers.map(s => `${s.formatted} \`:${s.name}:\``).join(' ')
        });
      }
      
      // Create a button for testing stickers
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('test_stickers')
            .setLabel('Test a Sticker')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔍')
        );
      
      // Send the stickers list
      const response = await sendResponse({
        embeds: [embed],
        components: [buttonRow]
      });
      
      // Set up collector for the button
      const filter = i => i.customId === 'test_stickers' && 
        (isSlashCommand ? i.user.id === interaction.user.id : i.user.id === message.author.id);
      
      const collector = response.createMessageComponentCollector({ 
        filter, 
        time: 300000 // 5 minutes
      });
      
      collector.on('collect', async i => {
        await i.reply({
          content: 'Enter a sticker name to test (without the colons), for example `heart_rainbow`',
          ephemeral: true
        });
        
        // Create a message collector to get the user's sticker test input
        const messageFilter = m => 
          (isSlashCommand ? m.author.id === interaction.user.id : m.author.id === message.author.id);
        
        const channel = isSlashCommand ? interaction.channel : message.channel;
        
        const messageCollector = channel.createMessageCollector({ 
          filter: messageFilter, 
          time: 60000, // 1 minute
          max: 1 
        });
        
        messageCollector.on('collect', async m => {
          const stickerName = m.content.trim().replace(/:/g, '');
          const stickerCode = `:${stickerName}:`;
          
          // Find the sticker in our list
          const foundSticker = Object.keys(animatedEmojis).find(key => key === stickerCode);
          
          // Try to delete the user's message to keep the channel clean
          try {
            await m.delete();
          } catch (error) {
            console.log('Could not delete message - missing permissions');
          }
          
          if (foundSticker) {
            const emoji = animatedEmojis[foundSticker];
            const formattedEmoji = `<a:${emoji.name}:${emoji.id}>`;
            
            await i.followUp({
              content: `Here's how the sticker looks: ${formattedEmoji}\n\nYou can use it with any of these formats:\n\`:${stickerName}:\`\n\`{sticker:${stickerName}}\`\n\`[sticker:${stickerName}]\``,
              ephemeral: true
            });
          } else {
            await i.followUp({
              content: `❌ Sticker \`:${stickerName}:\` not found. Please check the name and try again.`,
              ephemeral: true
            });
          }
        });
        
        messageCollector.on('end', collected => {
          if (collected.size === 0) {
            i.followUp({
              content: 'Sticker test canceled - no input received',
              ephemeral: true
            }).catch(console.error);
          }
        });
      });
      
      collector.on('end', () => {
        // Disable the button when the collector ends
        const disabledButtonRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(buttonRow.components[0])
              .setDisabled(true)
          );
        
        response.edit({
          embeds: [embed],
          components: [disabledButtonRow]
        }).catch(console.error);
      });
      
    } catch (error) {
      console.error('Error in stickers command:', error);
      return sendResponse('❌ An error occurred while showing the sticker list.');
    }
  }
};