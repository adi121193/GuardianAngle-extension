/**
 * Offscreen Document Worker
 * Handles ML inference in isolated environment
 * Communicates with service worker via chrome.runtime messages
 */

import { NERModel } from './nerModel.js';
import { imageDetectorImplementation } from '../detection/imageDetectorImplementation.js';

// Global model instance
let nerModel = null;
let isInitializing = false;
let initializationPromise = null;

/**
 * Initialize the NER model
 */
async function initializeModel() {
  if (nerModel?.isReady) {
    return { success: true };
  }

  if (isInitializing) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    const startTime = performance.now();

    try {
      // Create model instance
      nerModel = new NERModel();

      // Get model paths using chrome.runtime.getURL
      const modelPath = chrome.runtime.getURL('models/distilbert-ner/model.onnx');
      const vocabPath = chrome.runtime.getURL('models/distilbert-ner/vocab.txt');

      // Load model and vocabulary
      await nerModel.loadModel(modelPath);
      await nerModel.loadVocab(vocabPath);

      // Mark as ready
      nerModel.setReady();

      const totalTime = performance.now() - startTime;

      return {
        success: true,
        initTimeMs: totalTime
      };
    } catch (error) {
      console.error('[Offscreen] Model initialization failed:', error);
      nerModel = null;
      return {
        success: false,
        error: error.message
      };
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Run NER inference on text
 */
async function runNERInference(text, options = {}) {
  try {
    // Ensure model is initialized
    if (!nerModel?.isReady) {
      const initResult = await initializeModel();
      if (!initResult.success) {
        throw new Error('Model initialization failed: ' + initResult.error);
      }
    }

    // Run inference
    const result = await nerModel.runInference(text);

    return {
      success: true,
      entities: result.entities,
      performance: result.performanceMs
    };
  } catch (error) {
    console.error('[Offscreen] Inference failed:', error);
    return {
      success: false,
      error: error.message,
      entities: []
    };
  }
}

/**
 * Handle messages from service worker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages meant for the offscreen document
  // Messages like RUN_NER_INFERENCE are for the service worker, not us
  const handledTypes = ['NER_INIT', 'INIT_NER', 'NER_INFERENCE', 'NER_STATUS', 'NER_DISPOSE', 'OCR_DETECT'];
  if (!handledTypes.includes(message.type)) {
    // Return false to indicate we're not handling this message
    return false;
  }

  // Handle async operations
  (async () => {
    try {
      switch (message.type) {
        case 'NER_INIT':
        case 'INIT_NER':
          const initResult = await initializeModel();
          sendResponse(initResult);
          break;

        case 'NER_INFERENCE':
          // ... (existing NER logic)
          if (!message.text) {
            sendResponse({ success: false, error: 'No text' });
            break;
          }
          const nerRes = await runNERInference(message.text, message.options);
          sendResponse(nerRes);
          break;

        case 'OCR_DETECT':
          try {
            // Ensure initialized
            try {
              await imageDetectorImplementation.initialize();
            } catch (e) { console.error('OCR Init fail', e); }

            // Run detection
            const ocrRes = await imageDetectorImplementation.detect(message.image);
            sendResponse({
              success: !ocrRes.error,
              piiDetected: ocrRes.piiDetected,
              text: ocrRes.text,
              matches: ocrRes.matches,
              count: ocrRes.count,
              error: ocrRes.error
            });
          } catch (err) {
            console.error('OCR Detect Fatal', err);
            sendResponse({ success: false, error: err.message });
          }
          break;

        case 'NER_STATUS':
          sendResponse({
            success: true,
            isReady: nerModel?.isReady || false,
            isInitializing
          });
          break;

        case 'NER_DISPOSE':
          if (nerModel) {
            await nerModel.dispose();
            nerModel = null;
          }
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      console.error('[Offscreen] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

/**
 * Auto-initialize model on load (optional - can be lazy-loaded)
 */
const AUTO_INIT = false; // Set to true to pre-load model

if (AUTO_INIT) {
  initializeModel();
}
