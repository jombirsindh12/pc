const config = require('../utils/config');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  name: 'setverificationchannel',
  description: 'Sets the channel where users can post verification images',
  usage: '!setverificationchannel or /setverificationchannel',
  
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('setverificationchannel')
    .setDescription('Sets the channel where users can post verification images')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel to use for verification (defaults to current channel if not specified)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(message, args, client, interaction = null) {
    // Process differently based on whether it's a slash command or message command
    const isSlashCommand = !!interaction;
    
    // If it's a slash command
    if (isSlashCommand) {
      try {
        // Get channel from options (default to current channel if not specified)
        const selectedChannel = interaction.options.getChannel('channel') || interaction.channel;
        const serverId = interaction.guild.id;
        
        // Ensure we have a text channel
        if (selectedChannel.type !== ChannelType.GuildText) {
          return await interaction.reply({
            content: '❌ The channel must be a text channel.',
            ephemeral: true
          });
        }
        
        // Update server config
        config.updateServerConfig(serverId, { verificationChannelId: selectedChannel.id });
        console.log(`Updated configuration for server ${serverId}`);
        
        // Get server config to check for YouTube channel and role
        const serverConfig = config.getServerConfig(serverId);
        let warningMessage = '';
        
        // Check if YouTube channel is set
        if (!serverConfig.youtubeChannelId) {
          warningMessage += '\n\n⚠️ **Warning**: No YouTube channel has been set for verification. Please use `/setyoutubechannel` to set one.';
        }
        
        // Check if role is set
        if (!serverConfig.roleId) {
          warningMessage += '\n\n⚠️ **Warning**: No role has been set for verified subscribers. Please use `/setrole` to set one.';
        }
        
        // Get the actual channel object from the client to make sure we have the proper methods
        const targetChannel = client.channels.cache.get(selectedChannel.id);
        if (!targetChannel) {
          throw new Error(`Could not find channel with ID ${selectedChannel.id} in cache`);
        }
        
        // Send success message as first response
        await interaction.reply({
          content: `✅ Verification channel has been set to <#${selectedChannel.id}>\nUsers can now post screenshots here to verify their YouTube subscription.${warningMessage}`,
          ephemeral: false
        });
        
        // Send an instruction message to the verification channel using the properly fetched channel
        await targetChannel.send({
          content: '📝 **Verification Instructions**\n1. Subscribe to the YouTube channel\n2. Take a screenshot showing your subscription\n3. Post the screenshot in this channel\n4. Wait for verification and role assignment'
        });
        
      } catch (error) {
        console.error('Error setting verification channel (slash command):', error);
        
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the verification channel. Please try again.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ An error occurred while setting the verification channel. Please try again.',
            ephemeral: true
          });
        }
      }
      return;
    }
    
    // Legacy message command handling
    try {
      // Check if user has admin permissions
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need administrator permissions to use this command.');
      }

      // Set the current channel as verification channel
      const channelId = message.channel.id;
      const serverId = message.guild.id;
      
      config.updateServerConfig(serverId, { verificationChannelId: channelId });
      console.log(`Updated configuration for server ${serverId} (message command)`);
      
      message.reply(`✅ Verification channel has been set to <#${channelId}>\nUsers can now post screenshots here to verify their YouTube subscription.`);
      
      // Send an instruction message
      message.channel.send('📝 **Verification Instructions**\n1. Subscribe to the YouTube channel\n2. Take a screenshot showing your subscription\n3. Post the screenshot in this channel\n4. Wait for verification and role assignment');
      
      // Check if YouTube channel is set
      const serverConfig = config.getServerConfig(serverId);
      if (!serverConfig.youtubeChannelId) {
        message.channel.send('⚠️ **Warning**: No YouTube channel has been set for verification. Please use `!setyoutubechannel [channelId]` to set one.');
      }
      
      // Check if role is set
      if (!serverConfig.roleId) {
        message.channel.send('⚠️ **Warning**: No role has been set for verified subscribers. Please use `!setrole [roleName]` to set one.');
      }
    } catch (error) {
      console.error('Error setting verification channel:', error);
      message.reply('❌ An error occurred while setting the verification channel. Please try again.');
    }
  },
};
