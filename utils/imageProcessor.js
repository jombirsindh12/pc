const axios = require('axios');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

// Function to download an image from URL
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error('Failed to download image for processing');
  }
}

// Function to preprocess image for better OCR results
async function preprocessImage(imageBuffer) {
  try {
    // Convert to grayscale and increase contrast for better text recognition
    return await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .toBuffer();
  } catch (error) {
    console.error('Error preprocessing image:', error);
    // Return original buffer if preprocessing fails
    return imageBuffer;
  }
}

// Main function to process verification images
async function processImage(imageUrl) {
  try {
    console.log('Processing image from URL:', imageUrl);
    
    // Download and preprocess the image
    const imageBuffer = await downloadImage(imageUrl);
    const processedBuffer = await preprocessImage(imageBuffer);
    
    // Initialize Tesseract OCR worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Perform OCR on the image
    const { data } = await worker.recognize(processedBuffer);
    console.log('OCR result:', data.text);
    
    // Terminate worker
    await worker.terminate();
    
    // Look for subscription indicators in the text
    const text = data.text.toLowerCase();
    
    // Check for common phrases that indicate a YouTube subscription
    const isSubscribed = text.includes('subscribed') || 
                        text.includes('subscription') || 
                        text.includes('subscriber') ||
                        (text.includes('subscribe') && text.includes('✓')) ||
                        text.includes('notifications') ||
                        text.includes('bell icon');
    
    // Look for a YouTube user ID or channel name
    const userIdMatch = text.match(/user\/([a-zA-Z0-9_-]+)/) || 
                        text.match(/channel\/([a-zA-Z0-9_-]+)/);
    
    const userId = userIdMatch ? userIdMatch[1] : null;
    
    // If we found subscription indicators
    if (isSubscribed) {
      return {
        success: true,
        userId: userId,
        hasSubscriptionIndicators: true,
        text: data.text
      };
    }
    
    // If no subscription indicators were found
    return {
      success: false,
      message: 'Could not detect subscription indicators in the image',
      text: data.text
    };
    
  } catch (error) {
    console.error('Error processing verification image:', error);
    throw new Error('Failed to process verification image');
  }
}

module.exports = {
  processImage
};
