/**
 * Image PII Detection (Pro Feature)
 * Uses OCR to extract text from images and detect PII
 */

import { detectPII } from './detectText.js';
import { getProStatus } from '../utils/storage.js';

// OCR state
let ocrReady = false;
let ocrWorker = null;

/**
 * Initialize OCR engine
 * Note: This is a placeholder for actual OCR implementation
 * In production, you would integrate PaddleOCR WASM or Tesseract.js
 */
async function initializeOCR() {
  try {
    // Placeholder for OCR initialization
    // In production, you would load PaddleOCR WASM or Tesseract.js here
    console.log('OCR initialization placeholder');

    // Example for Tesseract.js (if using):
    /*
    if (typeof Tesseract !== 'undefined') {
      ocrWorker = await Tesseract.createWorker();
      await ocrWorker.loadLanguage('eng');
      await ocrWorker.initialize('eng');
      ocrReady = true;
    }
    */

    ocrReady = false; // Set to true when actual OCR is loaded
    return ocrReady;
  } catch (error) {
    console.error('Failed to initialize OCR:', error);
    return false;
  }
}

/**
 * Extract text from image using OCR
 * @param {HTMLImageElement|string} image - Image element or data URL
 * @returns {Promise<Object>} OCR result with text and bounding boxes
 */
async function extractTextFromImage(image) {
  if (!ocrReady) {
    return {
      text: '',
      blocks: [],
      error: 'OCR not initialized'
    };
  }

  try {
    // Placeholder for actual OCR processing
    // In production, you would use PaddleOCR or Tesseract.js here

    /*
    // Example with Tesseract.js:
    const result = await ocrWorker.recognize(image);
    return {
      text: result.data.text,
      blocks: result.data.blocks.map(block => ({
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidence
      }))
    };
    */

    return {
      text: '',
      blocks: [],
      error: 'OCR implementation pending'
    };
  } catch (error) {
    console.error('OCR error:', error);
    return {
      text: '',
      blocks: [],
      error: error.message
    };
  }
}

/**
 * Detect PII in image
 * @param {HTMLImageElement|File|Blob} image - Image to analyze
 * @returns {Promise<Object>} Detection results with bounding boxes
 */
export async function detectPIIInImage(image) {
  try {
    // Check Pro status
    const isPro = await getProStatus();
    if (!isPro) {
      return {
        success: false,
        error: 'Pro feature - upgrade to use image detection',
        piiDetected: false
      };
    }

    // Initialize OCR if needed
    if (!ocrReady) {
      await initializeOCR();
    }

    if (!ocrReady) {
      return {
        success: false,
        error: 'OCR not available',
        piiDetected: false
      };
    }

    // Convert image to data URL if needed
    let imageData = image;
    if (image instanceof File || image instanceof Blob) {
      imageData = await blobToDataURL(image);
    }

    // Extract text using OCR
    const ocrResult = await extractTextFromImage(imageData);

    if (ocrResult.error) {
      return {
        success: false,
        error: ocrResult.error,
        piiDetected: false
      };
    }

    // Detect PII in extracted text
    const detectionResult = await detectPII(ocrResult.text);

    // Map PII matches to image coordinates
    const boundingBoxes = [];
    if (detectionResult.piiDetected) {
      for (const match of detectionResult.matches) {
        // Find corresponding OCR block
        const block = ocrResult.blocks.find(b =>
          b.text.includes(match.value)
        );

        if (block && block.bbox) {
          boundingBoxes.push({
            ...match,
            bbox: block.bbox
          });
        }
      }
    }

    return {
      success: true,
      piiDetected: detectionResult.piiDetected,
      types: detectionResult.types,
      matches: detectionResult.matches,
      boundingBoxes,
      ocrText: ocrResult.text
    };
  } catch (error) {
    console.error('Image PII detection error:', error);
    return {
      success: false,
      error: error.message,
      piiDetected: false
    };
  }
}

/**
 * Blur PII regions in image
 * @param {HTMLImageElement|HTMLCanvasElement} image - Source image
 * @param {Array} boundingBoxes - Bounding boxes to blur
 * @param {number} blurAmount - Blur intensity (default: 20)
 * @returns {Promise<string>} Data URL of blurred image
 */
export async function blurPIIInImage(image, boundingBoxes, blurAmount = 20) {
  try {
    // Check Pro status
    const isPro = await getProStatus();
    if (!isPro) {
      throw new Error('Pro feature - upgrade to use image blurring');
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size to match image
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Blur each bounding box
    for (const box of boundingBoxes) {
      if (!box.bbox) continue;

      const { x0, y0, x1, y1 } = box.bbox;
      const width = x1 - x0;
      const height = y1 - y0;

      // Apply blur effect
      ctx.filter = `blur(${blurAmount}px)`;
      ctx.drawImage(
        canvas,
        x0, y0, width, height,
        x0, y0, width, height
      );
      ctx.filter = 'none';
    }

    // Return blurred image as data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Image blur error:', error);
    throw error;
  }
}

/**
 * Convert Blob to Data URL
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Monitor image uploads and detect PII
 * @param {HTMLInputElement} fileInput - File input element
 * @param {Function} callback - Callback with detection results
 */
export function monitorImageUpload(fileInput, callback) {
  fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const result = await detectPIIInImage(file);

      if (result.success && callback) {
        callback(result, file);
      }
    }
  });
}

/**
 * Get OCR status
 * @returns {Object}
 */
export function getOCRStatus() {
  return {
    ready: ocrReady,
    available: typeof Tesseract !== 'undefined' || ocrWorker !== null
  };
}

// Initialize OCR on load (Pro users only)
if (typeof window !== 'undefined') {
  getProStatus().then(isPro => {
    if (isPro) {
      initializeOCR().catch(err => {
        console.warn('OCR initialization failed:', err);
      });
    }
  });
}
