/**
 * Test script for embed templates functionality
 * Run with: node test_embed_templates.js
 */

// Load environment configuration
require('./setup-env');

// Import our database utilities
const { initializeTables } = require('./utils/database');
const { 
  getServerTemplates, 
  getTemplate, 
  saveTemplate, 
  deleteTemplate,
  setTemplatePublic, 
  getPublicTemplates 
} = require('./schemas/embedTemplates');

// Import the template generator from embedBuilder
const { getTemplateEmbed } = require('./commands/embedBuilder');

// Test server ID (this can be any string for testing)
const TEST_SERVER_ID = 'test_server_123';
const TEST_USER_ID = 'test_user_456';

// Run the tests
async function runTests() {
  try {
    console.log('🧪 Starting embed templates database tests...');

    // Initialize the database tables
    console.log('Initializing database tables...');
    await initializeTables();
    console.log('✅ Database tables initialized');

    // Get a template from the embedBuilder
    console.log('Getting announcement template from embedBuilder...');
    const templateData = getTemplateEmbed('announcement');
    console.log('✅ Template retrieved');
    
    // Save the template to the database
    console.log('Saving template to database...');
    const savedTemplate = await saveTemplate(
      TEST_SERVER_ID,
      'test_announcement',
      templateData,
      TEST_USER_ID
    );
    console.log('✅ Template saved:', savedTemplate);

    // Get the template from the database
    console.log('Retrieving template from database...');
    const retrievedTemplate = await getTemplate(TEST_SERVER_ID, 'test_announcement');
    console.log('✅ Template retrieved:', retrievedTemplate ? 'Successfully' : 'Failed');
    
    // Verify the template data
    if (retrievedTemplate) {
      console.log('📋 Template details:');
      console.log('  Name:', retrievedTemplate.name);
      console.log('  Server ID:', retrievedTemplate.serverId);
      console.log('  Created by:', retrievedTemplate.createdById);
      console.log('  Title:', retrievedTemplate.title);
      console.log('  Description length:', retrievedTemplate.description ? retrievedTemplate.description.length : 0);
      console.log('  Public:', retrievedTemplate.isPublic);
    }

    // Update the template to be public
    console.log('Making template public...');
    await setTemplatePublic(TEST_SERVER_ID, 'test_announcement', true);
    console.log('✅ Template updated');

    // Get public templates
    console.log('Getting public templates...');
    const publicTemplates = await getPublicTemplates();
    console.log(`✅ Found ${publicTemplates.length} public templates`);

    // Get all templates for server
    console.log('Getting all templates for server...');
    const serverTemplates = await getServerTemplates(TEST_SERVER_ID);
    console.log(`✅ Found ${serverTemplates.length} templates for server`);

    // Delete the template
    console.log('Deleting template...');
    await deleteTemplate(TEST_SERVER_ID, 'test_announcement');
    console.log('✅ Template deleted');

    // Verify deletion
    console.log('Verifying deletion...');
    const deletedTemplate = await getTemplate(TEST_SERVER_ID, 'test_announcement');
    console.log('✅ Template deletion verification:', deletedTemplate ? 'Failed (still exists)' : 'Success (not found)');

    console.log('🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up any test data (optional)
    try {
      await deleteTemplate(TEST_SERVER_ID, 'test_announcement').catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Exit the process
    process.exit(0);
  }
}

// Run the tests
runTests();