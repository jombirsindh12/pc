/**
 * Test file for emoji processing
 * Run this file with node test_emojis.js to see if the emoji processor is working correctly
 */

const { processEmojis, processSticker } = require('./utils/emojiProcessor');

// Test case for the specific problem mentioned by the user
const problem = '<a<a   1339685501099053097>1339685501099053097>';
console.log('Original:', problem);
console.log('Processed:', processEmojis(problem));

// Test case with various emoji formats
const test1 = 'Hello :smile: :heart: :tada: This is a test!';
console.log('\nOriginal:', test1);
console.log('Processed:', processEmojis(test1));

// Test case with stickers
const test2 = 'Check out this sticker: {sticker:party} and [sticker:fire]';
console.log('\nOriginal:', test2);
console.log('Processed:', processEmojis(processSticker(test2)));

// Test case with malformed emojis
const test3 = '<a:test:123>:123> and <a:another<a:nested:456>';
console.log('\nOriginal:', test3);
console.log('Processed:', processEmojis(test3));

// Test case with different spacing issues
const test4 = '<a: spacedout : 123456> and <a:nospace:123>';
console.log('\nOriginal:', test4);
console.log('Processed:', processEmojis(test4));

console.log('\n✅ Test complete. Check the output above to verify emoji processing is working correctly.');