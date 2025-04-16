const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const crypto = require('crypto');

// Function to generate a hash for an image
async function generateImageHash(imageBuffer) {
  try {
    // Create a hash of the image data for duplicate detection
    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    return hash;
  } catch (error) {
    console.error('Error generating image hash:', error);
    return null;
  }
}

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
    // Enhanced preprocessing pipeline for better OCR results
    return await sharp(imageBuffer)
      // Convert to grayscale
      .grayscale()
      // Increase contrast
      .normalize()
      // Apply slight sharpening to make text more distinct
      .sharpen({
        sigma: 1.2,
        m1: 0.5,
        m2: 0.5
      })
      // Apply threshold to make text clearer on light backgrounds
      .threshold(180)
      // Resize if necessary to improve OCR
      .resize({
        width: 1600,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true
      })
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
    
    // Generate image hash for duplicate detection
    const imageHash = await generateImageHash(imageBuffer);
    console.log('Generated image hash:', imageHash);
    
    console.log('Preprocessing image...');
    const processedBuffer = await preprocessImage(imageBuffer);
    console.log('Image preprocessing complete');
    
    // Initialize Tesseract OCR with the new API (v6+)
    console.log('Initializing OCR process...');
    
    // Perform OCR on the image using the newer API
    console.log('Performing OCR on image...');
    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR progress: ${Math.floor(m.progress * 100)}%`);
        }
      }
    });
    
    console.log('OCR completed, text length:', result.data.text.length);
    console.log('OCR result text sample:', result.data.text.substring(0, 100));
    console.log('OCR process completed');
    
    // Look for subscription indicators in the text
    const text = result.data.text.toLowerCase();
    console.log('Looking for subscription indicators...');
    
    // Enhanced check for common phrases that indicate a YouTube subscription
    const subscriptionIndicators = [
      'subscribed',
      'subscription',
      'subscriber',
      'bell icon',
      'notifications',
      'joined',
      'following',  // Additional indicators
      'subscrib',   // Partial match for OCR errors
      'joined channel',
      'membership'
    ];
    
    // Use a more flexible detection approach to handle OCR errors
    const foundIndicators = [];
    for (const indicator of subscriptionIndicators) {
      if (text.includes(indicator)) {
        foundIndicators.push(indicator);
      }
    }
    
    // Enhanced checkmark detection
    const checkmarks = ['✓', '√', '✔', 'v', '✅'];
    let hasSubscribeCheckmark = false;
    
    // Check for "subscribe" + any checkmark nearby
    if (text.includes('subscribe')) {
      for (const checkmark of checkmarks) {
        if (text.includes(checkmark)) {
          hasSubscribeCheckmark = true;
          foundIndicators.push(`subscribe with ${checkmark}`);
          break;
        }
      }
    }
    
    // Look for checkmarks in proximity to "subscribe" word
    const subscribePos = text.indexOf('subscribe');
    if (subscribePos !== -1) {
      // Check if there's a checkmark within 20 characters of "subscribe"
      const segment = text.substring(Math.max(0, subscribePos - 10), 
                                    Math.min(text.length, subscribePos + 20));
      
      for (const checkmark of checkmarks) {
        if (segment.includes(checkmark)) {
          hasSubscribeCheckmark = true;
          foundIndicators.push(`subscribe near ${checkmark}`);
          break;
        }
      }
    }
    
    console.log('Found indicators:', foundIndicators);
    
    // Check for "subscribed" button UI elements
    const hasSubscribedButton = text.includes('subscrib') && 
                              (text.includes('button') || text.includes('ed'));
    
    if (hasSubscribedButton) {
      foundIndicators.push('subscribed button detected');
    }
    
    // Calculate final subscription status
    const isSubscribed = foundIndicators.length > 0 || hasSubscribeCheckmark || hasSubscribedButton;
    
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
        text: result.data.text.substring(0, 500), // Limit text length for logging
        imageHash: imageHash // Add hash for duplicate detection
      };
    }
    
    // If no subscription indicators were found
    console.log('Could not detect subscription indicators in the image');
    return {
      success: false,
      message: 'Could not detect subscription indicators in the image',
      text: result.data.text.substring(0, 200), // Limit text length for logging
      imageHash: imageHash // Add hash even for unsuccessful verifications
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
  processImage,
  generateImageHash
};
