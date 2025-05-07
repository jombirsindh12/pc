const config = require('../utils/config');
const { sendDMToNewMember } = require('./setwelcome');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'setdm',
  description: 'Configure DM messages for new members',
  usage: '/setdm [message]',
  options: [
    {
      name: 'message',
      type: 3, // STRING type
      description: 'Custom DM message (includes variables like {user}, {server}, etc.)',
      required: true
    },
    {
      name: 'enabled',
      type: 5, // BOOLEAN type
      description: 'Enable or disable sending DMs to new members',
      required: false
    },
    {
      name: 'test',
      type: 5, // BOOLEAN type
      description: 'Send a test DM to yourself',
      required: false
    }
  ],
  
  async execute(message, args, client, interaction = null) {
    // Handle slash command
    if (interaction) {
      await interaction.deferReply();
      
      try {
        const serverId = interaction.guild.id;
        const serverConfig = config.getServerConfig(serverId);
        
        // Create dmSettings if it doesn't exist
        if (!serverConfig.dmSettings) {
          serverConfig.dmSettings = {};
        }
        
        // Get DM message
        const dmMessage = interaction.options.getString('message');
        
        // Check if message is too long
        if (dmMessage.length > 2000) {
          return interaction.editReply('❌ DM message is too long! Please keep it under 2000 characters.');
        }
        
        // Get enabled setting
        const enabled = interaction.options.getBoolean('enabled') ?? true;
        
        // Update server config
        serverConfig.dmSettings.message = dmMessage;
        serverConfig.dmSettings.enabled = enabled;
        
        // Save config
        config.updateServerConfig(serverId, {
          dmSettings: serverConfig.dmSettings
        });
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('📨 DM Message Settings')
          .setDescription(`DM messages for new members have been ${enabled ? 'enabled' : 'disabled'}.`)
          .addFields(
            { name: '💬 Message', value: dmMessage, inline: false }
          )
          .setColor('#5865F2')
          .setTimestamp();
        
        // Send response
        await interaction.editReply({ embeds: [embed] });
        
        // Test DM if requested
        const testDM = interaction.options.getBoolean('test');
        if (testDM) {
          try {
            await sendDMToNewMember(interaction.member, dmMessage);
            await interaction.followUp({ content: '✅ Test DM sent! Check your direct messages.', ephemeral: true });
          } catch (error) {
            console.error('Error sending test DM:', error);
            await interaction.followUp({ content: '❌ Failed to send test DM. Do you have DMs enabled from server members?', ephemeral: true });
          }
        }
      } catch (error) {
        console.error('Error in setdm command:', error);
        await interaction.editReply('❌ An error occurred while setting up DM messages.');
      }
    }
    // Handle text command
    else {
      message.reply('This command is only available as a slash command. Please use `/setdm` instead.');
    }
  }
};

// Setup DM event handler
function setupDMHandler(client) {
  const config = require('../utils/config');
  console.log("DM handler function running...");
  
  client.on('guildMemberAdd', async member => {
    const serverId = member.guild.id;
    const serverConfig = config.getServerConfig(serverId);
    
    // Check if DM messages are enabled
    if (!serverConfig.dmSettings?.enabled || !serverConfig.dmSettings?.message) {
      return;
    }
    
    console.log(`Sending DM to new member: ${member.user.tag} in ${member.guild.name}`);
    
    try {
      // Send DM
      await sendDMToNewMember(member, serverConfig.dmSettings.message);
      console.log(`Successfully sent DM to ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to send DM to ${member.user.tag}:`, error);
    }
  });
  
  console.log('DM handler has been set up');
}

// Export the setup function
module.exports.setupDMHandler = setupDMHandler;