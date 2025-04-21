const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
    console.log('Downloading image from URL:', url);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000 // 10 second timeout
    });
    console.log(`Downloaded image successfully, size: ${response.data.length} bytes`);
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error downloading image:', error.message);
    if (error.response) {
      console.error(`HTTP error status: ${error.response.status}`);
    }
    throw new Error(`Failed to download image for processing: ${error.message}`);
  }
}

// Function to preprocess image for better OCR results
async function preprocessImage(imageBuffer) {
  try {
    console.log('Preprocessing image with enhanced pipeline...');
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save a debug copy of the preprocessed image
    const debugImagePath = path.join(tempDir, `preprocess_debug_${Date.now()}.png`);
    
    // Enhanced preprocessing pipeline for better OCR results with multiple processing attempts
    const processedBuffer = await sharp(imageBuffer)
      // Convert to grayscale
      .grayscale()
      // Increase contrast
      .normalize()
      // Apply slight sharpening to make text more distinct
      .sharpen({
        sigma: 1.5, // Increased sharpening
        m1: 0.7,    // Enhanced edge detection
        m2: 0.3
      })
      // Apply adaptive thresholding
      .threshold(160) // Lower threshold for better text detection
      // Resize while maintaining aspect ratio
      .resize({
        width: 2000,  // Increased resolution
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();
    
    // Save debug image
    try {
      await sharp(processedBuffer).toFile(debugImagePath);
      console.log(`Debug preprocessed image saved to: ${debugImagePath}`);
    } catch (saveError) {
      console.error('Warning: Could not save debug preprocessed image:', saveError.message);
    }
    
    console.log('Image preprocessing complete with enhanced parameters');
    return processedBuffer;
  } catch (error) {
    console.error('Error preprocessing image:', error.message);
    console.log('Falling back to original image due to preprocessing error');
    // Return original buffer if preprocessing fails
    return imageBuffer;
  }
}

// Main function to process verification images
async function processImage(imageUrl) {
  try {
    console.log('Processing image from URL:', imageUrl);
    
    // Create temp directory for debug images if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Download and preprocess the image
    console.log('Downloading image...');
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`Downloaded image, size: ${imageBuffer.length} bytes`);
    
    // Save original image for debugging
    const originalImagePath = path.join(tempDir, `original_image_${Date.now()}.png`);
    try {
      await sharp(imageBuffer).toFile(originalImagePath);
      console.log(`Original image saved for debugging: ${originalImagePath}`);
    } catch (saveError) {
      console.error('Warning: Could not save original image:', saveError.message);
    }
    
    // Generate image hash for duplicate detection
    const imageHash = await generateImageHash(imageBuffer);
    console.log('Generated image hash:', imageHash);
    
    console.log('Preprocessing image...');
    const processedBuffer = await preprocessImage(imageBuffer);
    console.log('Image preprocessing complete');
    
    // Initialize Tesseract OCR with the new API (v6+)
    console.log('Initializing OCR process...');
    
    // Perform OCR on the image using the newer API with improved settings
    console.log('Performing OCR on image with enhanced settings...');
    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      // Tesseract PSM (Page Segmentation Mode): 4 = Assume a single column of text of variable sizes
      // More aggressive settings for better text detection
      tessedit_pageseg_mode: '4',
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@_/.-:',
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR progress: ${Math.floor(m.progress * 100)}%`);
        }
      }
    });
    
    console.log('OCR completed, text length:', result.data.text.length);
    console.log('OCR result text sample:', result.data.text.substring(0, 100));
    console.log('OCR full text:', result.data.text); // Log full text for debugging
    console.log('OCR process completed');
    
    // Save OCR result to a debug file
    const ocrDebugPath = path.join(tempDir, `ocr_result_${Date.now()}.txt`);
    try {
      fs.writeFileSync(ocrDebugPath, result.data.text);
      console.log(`OCR result text saved to: ${ocrDebugPath}`);
    } catch (writeError) {
      console.error('Warning: Could not save OCR result text:', writeError.message);
    }
    
    // Look for subscription indicators in the text with improved detection
    const text = result.data.text.toLowerCase();
    console.log('Looking for subscription indicators with enhanced detection...');
    
    // More comprehensive check for subscription indicators
    const subscriptionIndicators = [
      'subscribed',
      'subscription',
      'subscriber',
      'bell icon',
      'notifications',
      'joined',
      'following',      // Additional indicators
      'subscrib',       // Partial match for OCR errors
      'joined channel',
      'membership',
      'notifi',         // Partial match for notifications
      'bell',           // Bell icon references
      'subscr',         // Even shorter partial match
      'join',           // Shorter partial match
    ];
    
    // Use a more flexible detection approach to handle OCR errors
    const foundIndicators = [];
    for (const indicator of subscriptionIndicators) {
      if (text.includes(indicator)) {
        foundIndicators.push(indicator);
      }
    }
    
    // Enhanced checkmark detection with more characters
    const checkmarks = ['✓', '√', '✔', 'v', '✅', '☑', '■', '□', 'x', 'X'];
    let hasSubscribeCheckmark = false;
    
    // Check for "subscribe" word or variants + any checkmark anywhere in text
    if (text.includes('subscr') || text.includes('join')) {
      for (const checkmark of checkmarks) {
        if (text.includes(checkmark)) {
          hasSubscribeCheckmark = true;
          foundIndicators.push(`subscribe with ${checkmark}`);
          break;
        }
      }
    }
    
    // Look for checkmarks or similar characters in proximity to "subscribe" variants
    const subscribePos = text.indexOf('subscr');
    if (subscribePos !== -1) {
      // Check if there's a checkmark within 30 characters of "subscribe" (increased range)
      const segment = text.substring(Math.max(0, subscribePos - 15), 
                                    Math.min(text.length, subscribePos + 30));
      
      for (const checkmark of checkmarks) {
        if (segment.includes(checkmark)) {
          hasSubscribeCheckmark = true;
          foundIndicators.push(`subscribe near ${checkmark}`);
          break;
        }
      }
    }
    
    // Also check around "join" text
    const joinPos = text.indexOf('join');
    if (joinPos !== -1) {
      const segment = text.substring(Math.max(0, joinPos - 15), 
                                    Math.min(text.length, joinPos + 30));
      
      for (const checkmark of checkmarks) {
        if (segment.includes(checkmark)) {
          hasSubscribeCheckmark = true;
          foundIndicators.push(`join near ${checkmark}`);
          break;
        }
      }
    }
    
    console.log('Found indicators:', foundIndicators);
    
    // Check for "subscribed" button UI elements with more flexible pattern matching
    const hasSubscribedButton = 
      (text.includes('subscr') && (text.includes('button') || text.includes('ed'))) ||
      (text.includes('join') && (text.includes('button') || text.includes('ed')));
    
    if (hasSubscribedButton) {
      foundIndicators.push('subscription button UI detected');
    }
    
    // Additional YouTube-specific UI element detection
    if (text.includes('youtube') && 
        (text.includes('channel') || text.includes('video') || text.includes('watch'))) {
      foundIndicators.push('youtube interface elements detected');
    }
    
    // Calculate final subscription status with a lower threshold
    // If we found any indicator, consider it a success since OCR can be error-prone
    const isSubscribed = foundIndicators.length > 0 || hasSubscribeCheckmark || hasSubscribedButton;
    
    // Enhanced pattern matching for YouTube user IDs or channel names
    const userIdPatterns = [
      /user\/([a-zA-Z0-9_-]+)/,
      /channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /@([a-zA-Z0-9_-]{3,})/,  // Match @username pattern with min 3 chars
      /youtube.*\/([a-zA-Z0-9_-]{10,})/  // Generic YouTube URL pattern
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
      console.log('Subscription verification successful with enhanced detection');
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
    console.log('Could not detect subscription indicators in the image even with enhanced detection');
    return {
      success: false,
      message: 'Could not detect subscription indicators in the image. Please make sure your screenshot clearly shows your subscription status.',
      text: result.data.text.substring(0, 200), // Limit text length for logging
      imageHash: imageHash // Add hash even for unsuccessful verifications
    };
    
  } catch (error) {
    console.error('Error processing verification image:', error);
    return {
      success: false,
      message: `Error processing image: ${error.message}. Please try with a clearer screenshot.`,
      error: error.message
    };
  }
}

module.exports = {
  processImage,
  generateImageHash
};
