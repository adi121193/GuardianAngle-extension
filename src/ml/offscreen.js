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

/** Lazy load Tesseract */
let tesseractWorker = null;
let tesseractCore = null;

async function getOCRWorker() {
  if (tesseractWorker) return tesseractWorker;

  console.log('[Offscreen] Lazy-loading Tesseract...');

  // Import Tesseract dynamically (assuming it's available globally or via importScript in worker context)
  // Since we are in an offscreen document (DOM access), we can use script tags or dynamic imports
  // Standard Tesseract.js usage:
  const { createWorker } = window.Tesseract;

  // Initialize worker
  const worker = await createWorker('eng', 1, {
    logger: m => console.debug(m),
    workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
    corePath: chrome.runtime.getURL('ocr/tesseract-core.wasm.js'),
  });

  tesseractWorker = worker;
  return tesseractWorker;
}
// Helper to send debug logs to main process
function debugLog(type, message, data = null) {
  const logEntry = {
    type: 'DEBUG_LOG',
    source: 'offscreen',
    level: type, // 'info', 'warn', 'error'
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };

  console.log(`[Offscreen:${type}]`, message, data || '');

  // Try to send to runtime (might fail if background closed, but worth trying)
  try {
    chrome.runtime.sendMessage(logEntry).catch(() => { });
  } catch (e) {
    // Ignore send errors
  }
}

/**
 * Initialize the NER model
 */
async function initializeModel() {
  debugLog('info', 'initializeModel called');

  if (nerModel?.isReady) {
    debugLog('info', 'Model already ready');
    return { success: true };
  }

  if (isInitializing) {
    debugLog('info', 'Initialization already in progress');
    return initializationPromise;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    const startTime = performance.now();
    debugLog('info', 'Starting model initialization sequence');

    try {
      // Create model instance
      nerModel = new NERModel();

      // Get model paths using chrome.runtime.getURL
      const modelPath = chrome.runtime.getURL('models/distilbert-ner/model.onnx');
      const vocabPath = chrome.runtime.getURL('models/distilbert-ner/vocab.txt');

      debugLog('info', 'Model Paths resolved', { modelPath, vocabPath });

      // Load model and vocabulary
      debugLog('info', 'Loading model...');
      await nerModel.loadModel(modelPath);
      debugLog('info', 'Model loaded successfully');

      debugLog('info', 'Loading vocab...');
      await nerModel.loadVocab(vocabPath);
      debugLog('info', 'Vocab loaded successfully');

      // Mark as ready
      nerModel.setReady();

      const totalTime = performance.now() - startTime;
      debugLog('info', `Initialization complete in ${totalTime}ms`);

      return {
        success: true,
        initTimeMs: totalTime
      };
    } catch (error) {
      debugLog('error', 'Model initialization FAILED', {
        message: error.message,
        stack: error.stack
      });
      console.error('[Offscreen] Model initialization failed:', error);
      nerModel = null;
      return {
        success: false,
        error: error.message + (error.stack ? `\n${error.stack}` : '')
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
