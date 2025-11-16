/**
 * Offscreen Document Worker
 * Handles ML inference in isolated environment
 * Communicates with service worker via chrome.runtime messages
 */

import { NERModel } from './nerModel.js';

// Global model instance
let nerModel = null;
let isInitializing = false;
let initializationPromise = null;

/**
 * Initialize the NER model
 */
async function initializeModel() {
  if (nerModel?.isReady) {
    console.log('[Offscreen] Model already initialized');
    return { success: true };
  }

  if (isInitializing) {
    console.log('[Offscreen] Model initialization already in progress');
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    console.log('[Offscreen] Starting model initialization...');
    const startTime = performance.now();

    try {
      // Create model instance
      nerModel = new NERModel();

      // Get model paths using chrome.runtime.getURL
      const modelPath = chrome.runtime.getURL('models/distilbert-ner/model.onnx');
      const vocabPath = chrome.runtime.getURL('models/distilbert-ner/vocab.txt');

      console.log('[Offscreen] Model path:', modelPath);
      console.log('[Offscreen] Vocab path:', vocabPath);

      // Load model and vocabulary
      await nerModel.loadModel(modelPath);
      await nerModel.loadVocab(vocabPath);

      // Mark as ready
      nerModel.setReady();

      const totalTime = performance.now() - startTime;
      console.log(`[Offscreen] Model initialization complete in ${totalTime.toFixed(0)}ms`);

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
  console.log('[Offscreen] Running NER inference on text:', text.substring(0, 100) + '...');

  try {
    // Ensure model is initialized
    if (!nerModel?.isReady) {
      console.log('[Offscreen] Model not ready, initializing...');
      const initResult = await initializeModel();
      if (!initResult.success) {
        throw new Error('Model initialization failed: ' + initResult.error);
      }
    }

    // Run inference
    const result = await nerModel.runInference(text);

    console.log(`[Offscreen] Found ${result.entities.length} entities`);

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
  console.log('[Offscreen] Received message:', message.type);

  // Handle async operations
  (async () => {
    try {
      switch (message.type) {
        case 'NER_INIT':
          const initResult = await initializeModel();
          sendResponse(initResult);
          break;

        case 'NER_INFERENCE':
          if (!message.text) {
            sendResponse({
              success: false,
              error: 'No text provided',
              entities: []
            });
            break;
          }

          const inferenceResult = await runNERInference(message.text, message.options);
          sendResponse(inferenceResult);
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

        default:
          console.warn('[Offscreen] Unknown message type:', message.type);
          sendResponse({
            success: false,
            error: 'Unknown message type'
          });
      }
    } catch (error) {
      console.error('[Offscreen] Error handling message:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Auto-initialize model on load (optional - can be lazy-loaded)
 */
const AUTO_INIT = false; // Set to true to pre-load model

if (AUTO_INIT) {
  console.log('[Offscreen] Auto-initializing model...');
  initializeModel().then(result => {
    if (result.success) {
      console.log('[Offscreen] Auto-initialization successful');
    } else {
      console.error('[Offscreen] Auto-initialization failed:', result.error);
    }
  });
}

console.log('[Offscreen] ML Worker ready');
