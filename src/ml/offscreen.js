/**
 * Offscreen Document Worker
 * Handles OCR inference in isolated environment
 * Communicates with service worker via chrome.runtime messages
 * 
 * NER removed - using regex-only detection
 */

import { imageDetectorImplementation } from '../detection/imageDetectorImplementation.js';

// NER imports removed - no longer needed

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

// NER functions removed - using regex-only detection

/**
 * Handle messages from service worker
 */
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // Only handle messages meant for the offscreen document
  // Messages like RUN_NER_INFERENCE are for the service worker, not us
  const handledTypes = ['NER_INIT', 'INIT_NER', 'NER_INFERENCE', 'NER_STATUS', 'NER_DISPOSE', 'OCR_DETECT'];
  if (!handledTypes.includes(message.type)) {
    // Return false to indicate we're not handling this message
    return false;
  }

  // Handle async operations
  // CRITICAL: Return true to keep channel open
  (async () => {
    try {
      switch (message.type) {
        case 'NER_INIT':
        case 'INIT_NER':
          console.log('[Offscreen] NER removed - ignoring initialization');
          sendResponse({ success: false, error: 'NER feature removed' });
          break;

        case 'NER_INFERENCE':
          console.log('[Offscreen] NER removed - ignoring inference request');
          sendResponse({ success: false, error: 'NER feature removed', entities: [] });
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
          console.log('[Offscreen] NER removed - returning not ready');
          sendResponse({
            success: true,
            isReady: false,
            isInitializing: false
          });
          break;

        case 'NER_DISPOSE':
          console.log('[Offscreen] NER removed - nothing to dispose');
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      console.error('[Offscreen] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// NER auto-init removed
