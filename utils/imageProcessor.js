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
    console.log('Downloading image...');
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`Downloaded image, size: ${imageBuffer.length} bytes`);
    
    console.log('Preprocessing image...');
    const processedBuffer = await preprocessImage(imageBuffer);
    console.log('Image preprocessing complete');
    
    // Initialize Tesseract OCR worker
    console.log('Initializing OCR worker...');
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    console.log('OCR worker initialized');
    
    // Perform OCR on the image
    console.log('Performing OCR on image...');
    const { data } = await worker.recognize(processedBuffer);
    console.log('OCR completed, text length:', data.text.length);
    console.log('OCR result text sample:', data.text.substring(0, 100));
    
    // Terminate worker
    await worker.terminate();
    console.log('OCR worker terminated');
    
    // Look for subscription indicators in the text
    const text = data.text.toLowerCase();
    console.log('Looking for subscription indicators...');
    
    // Check for common phrases that indicate a YouTube subscription
    const subscriptionIndicators = [
      'subscribed',
      'subscription',
      'subscriber',
      'bell icon',
      'notifications',
      'joined'
    ];
    
    const foundIndicators = subscriptionIndicators.filter(indicator => 
      text.includes(indicator)
    );
    
    const hasSubscribeCheckmark = text.includes('subscribe') && 
                                 (text.includes('✓') || text.includes('√'));
    
    if (hasSubscribeCheckmark) {
      foundIndicators.push('subscribe ✓');
    }
    
    console.log('Found indicators:', foundIndicators);
    
    const isSubscribed = foundIndicators.length > 0 || hasSubscribeCheckmark;
    
    // Look for a YouTube user ID or channel name
    const userIdPatterns = [
      /user\/([a-zA-Z0-9_-]+)/,
      /channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/
    ];
    
    let userId = null;
    for (const pattern of userIdPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        userId = match[1];
        console.log('Found user ID pattern match:', userId);
        break;
      }
    }
    
    // If we found subscription indicators
    if (isSubscribed) {
      console.log('Subscription verification successful');
      return {
        success: true,
        userId: userId,
        hasSubscriptionIndicators: true,
        foundIndicators: foundIndicators,
        text: data.text.substring(0, 500) // Limit text length for logging
      };
    }
    
    // If no subscription indicators were found
    console.log('Could not detect subscription indicators in the image');
    return {
      success: false,
      message: 'Could not detect subscription indicators in the image',
      text: data.text.substring(0, 200) // Limit text length for logging
    };
    
  } catch (error) {
    console.error('Error processing verification image:', error);
    return {
      success: false,
      message: `Error processing image: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  processImage
};
