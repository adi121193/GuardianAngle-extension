/**
 * Service Worker (Background Script)
 * Handles background operations and extension lifecycle
 */

import { offscreenManager } from '../ml/offscreenManager.js';
import { detectPIIWithRegex } from '../utils/regexPatterns.js';

// Build timestamp for cache busting (set at build time)
const BUILD_VERSION = Date.now();
console.log('[ServiceWorker] Starting with build version:', BUILD_VERSION);

// Track injected tabs to avoid duplicate injection
const injectedTabs = new Set();

// Track blocked requests to avoid duplicate notifications
const blockedRequests = new Set();

/**
 * Clean up on service worker startup
 * This runs when extension is loaded/reloaded
 */
async function cleanupOnStartup() {
  console.log('[ServiceWorker] Running startup cleanup...');

  // Clear injected tabs tracking (pages need re-injection after reload)
  injectedTabs.clear();
  blockedRequests.clear();

  // Close any existing offscreen documents to ensure clean state
  try {
    const hasDoc = await offscreenManager.hasDocument();
    if (hasDoc) {
      console.log('[ServiceWorker] Closing stale offscreen document...');
      await offscreenManager.closeDocument();
    }
  } catch (error) {
    console.warn('[ServiceWorker] Error closing offscreen document:', error);
  }

  console.log('[ServiceWorker] Startup cleanup complete');
}

// Run cleanup immediately when service worker starts
cleanupOnStartup();

// Default settings (used for stats initialization)
const DEFAULT_SETTINGS = {
  stats: {
    totalDetections: 0,
    totalMasked: 0,
    totalBlocked: 0,
    detectionsByType: {},
    lastReset: Date.now()
  }
};

// Supported AI platforms
const AI_PLATFORMS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'www.perplexity.ai',
  'x.com',
  'twitter.com'
];

/**
 * Check if URL is an AI platform
 */
function isAIPlatform(url) {
  if (!url) return false;
  return AI_PLATFORMS.some(platform => url.includes(platform));
}

/**
 * Detect PII in text using strict validators
 * Now uses the same detection logic as content scripts with:
 * - Verhoeff checksum for Aadhaar
 * - Priority-based routing
 * - Context-aware detection
 */
function detectPIIInText(text) {
  if (!text || typeof text !== 'string') return { detected: false, types: [] };

  try {
    // Verify detectPIIWithRegex is available
    if (typeof detectPIIWithRegex !== 'function') {
      console.error('[ServiceWorker] detectPIIWithRegex not available, using fallback');
      return { detected: false, types: [], error: 'Validator not loaded' };
    }

    // Use the strict validator from regexPatterns
    const result = detectPIIWithRegex(text, 0.6);

    console.log(`[ServiceWorker] PII detection: ${result.piiDetected ? 'detected' : 'none'}, types: ${result.types.join(', ')}`);

    return {
      detected: result.piiDetected,
      types: result.types,
      matches: result.matches.map(m => m.value),
      count: result.matches.length,
      details: result.matches,
      ambiguous: result.ambiguousMatches || []
    };
  } catch (error) {
    console.error('[ServiceWorker] Error in detectPIIInText:', error);
    return { detected: false, types: [], error: error.message };
  }
}

// Expose detection helpers to avoid tree-shaking and keep background logic aligned with content
self.__detectPIIInText = detectPIIInText;
self.__detectPIIWithRegexAvailable = typeof detectPIIWithRegex === 'function';

/**
 * Extract text from request body (handles various formats)
 */
function extractTextFromRequestBody(requestBody) {
  if (!requestBody) return '';

  let text = '';

  try {
    // Handle FormData
    if (requestBody.formData) {
      for (const [key, values] of Object.entries(requestBody.formData)) {
        text += values.join(' ') + ' ';
      }
    }

    // Handle raw data
    if (requestBody.raw) {
      for (const rawData of requestBody.raw) {
        if (rawData.bytes) {
          const decoder = new TextDecoder();
          text += decoder.decode(rawData.bytes) + ' ';
        }
      }
    }

    // Try to parse as JSON if it looks like JSON
    if (text.includes('{') || text.includes('[')) {
      try {
        const jsonData = JSON.parse(text);
        text = JSON.stringify(jsonData);
      } catch (e) {
        // Not JSON, use as-is
      }
    }
  } catch (error) {
    console.error('Error extracting text from request body:', error);
  }

  return text;
}

/**
 * Inject content script into tab
 * @param {number} tabId - Tab ID to inject into
 * @param {boolean} forceReload - Force re-injection even if already tracked
 */
async function injectContentScript(tabId, forceReload = false) {
  // Check if we've already injected (unless force reload)
  if (!forceReload && injectedTabs.has(tabId)) {
    // Verify the content script is still responding
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (response?.alive) {
        console.log('PII Guardian: Content script still active in tab', tabId);
        return;
      }
    } catch (error) {
      // Content script not responding - needs re-injection
      console.log('PII Guardian: Content script not responding, will re-inject into tab', tabId);
      injectedTabs.delete(tabId);
    }
  }

  try {
    // First, try to get tab info to ensure it's ready
    const tab = await chrome.tabs.get(tabId);
    if (!tab || tab.status !== 'complete') {
      console.log('PII Guardian: Tab not ready, skipping injection for tab', tabId);
      return;
    }

    console.log('PII Guardian: Injecting content script into tab', tabId, tab.url);

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/monitorInputs.js']
    });

    injectedTabs.add(tabId);
    console.log('PII Guardian: Content script injected successfully into tab', tabId);
  } catch (error) {
    console.error('PII Guardian: Failed to inject content script into tab', tabId, ':', error.message);

    // If injection fails, show notification to user
    if (forceReload && error.message?.includes('Cannot access')) {
      console.log('PII Guardian: Showing refresh notification for tab', tabId);
      // Try to show a notification or badge
      try {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
      } catch (e) {
        // Ignore badge errors
      }
    }
  }
}

// Extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('PII Guardian installed/updated');

  if (details.reason === 'install') {
    // First install - initialize default settings
    chrome.storage.local.set({
      settings: {
        enabled: true,
        autoMask: true,
        blockOnDetection: false,
        minConfidence: 0.6,
        enabledPIITypes: [
          'aadhaar',
          'pan',
          'phone',
          'email',
          'creditCard',
          'bankAccount',
          'passport',
          'ssn',
          'ifsc',
          'gst',
          'dob',
          'ipAddress',
          'drivingLicense',
          'vehicleReg',
          'medicalRecord'
        ],
        notificationSound: true,
        proEnabled: false,
        licenseKey: null,
        licenseExpiry: null,
        imageDetection: false,
        autoBlur: false,
        stats: {
          totalDetections: 0,
          totalMasked: 0,
          totalBlocked: 0,
          detectionsByType: {},
          lastReset: Date.now()
        }
      }
    });

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('html/popup.html')
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated from', details.previousVersion);

    // Migration: Add new PII types to existing users' settings
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings && result.settings.enabledPIITypes) {
        const currentTypes = result.settings.enabledPIITypes;
        const newTypes = ['dob', 'ipAddress', 'drivingLicense', 'vehicleReg', 'medicalRecord'];

        // Add any missing types
        let updated = false;
        for (const type of newTypes) {
          if (!currentTypes.includes(type)) {
            currentTypes.push(type);
            updated = true;
          }
        }

        if (updated) {
          chrome.storage.local.set({ settings: result.settings }, () => {
            console.log('Settings migrated: Added new PII types', newTypes);
          });
        }
      }
    });
  }

  // Handle existing AI platform tabs
  const tabs = await chrome.tabs.query({});
  const aiTabs = tabs.filter(tab => tab.url && isAIPlatform(tab.url) && tab.id);

  if (details.reason === 'update' && aiTabs.length > 0) {
    // On extension update/reload, refresh AI platform tabs to get fresh content scripts
    // This is more reliable than trying to inject into existing pages
    console.log(`PII Guardian: Refreshing ${aiTabs.length} AI platform tab(s) after update...`);

    for (const tab of aiTabs) {
      try {
        console.log(`PII Guardian: Refreshing tab ${tab.id} (${tab.url})`);
        await chrome.tabs.reload(tab.id);
      } catch (error) {
        console.error(`PII Guardian: Failed to refresh tab ${tab.id}:`, error.message);
      }
    }
  } else if (details.reason === 'install') {
    // On fresh install, inject into existing tabs
    for (const tab of aiTabs) {
      setTimeout(() => {
        injectContentScript(tab.id, false);
      }, 1000);
    }
  }
});

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  // Ignore messages meant ONLY for offscreen document
  // Note: INIT_NER and NER_STATUS are handled by a separate listener below
  const offscreenOnlyMessages = ['NER_INIT', 'NER_INFERENCE', 'NER_DISPOSE', 'NER_STATUS_CHANGED'];
  if (offscreenOnlyMessages.includes(message.type)) {
    // These are handled by offscreen document, not service worker
    return false;
  }

  switch (message.type) {
    case 'GET_SETTINGS':
      chrome.storage.local.get(['settings'], (result) => {
        sendResponse({ settings: result.settings });
      });
      return true; // Keep channel open for async response

    case 'UPDATE_SETTINGS':
      chrome.storage.local.set({ settings: message.settings }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'GET_STATS':
      chrome.storage.local.get(['settings'], (result) => {
        sendResponse({ stats: result.settings?.stats || {} });
      });
      return true;

    case 'RESET_STATS':
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.stats = {
          totalDetections: 0,
          totalMasked: 0,
          totalBlocked: 0,
          detectionsByType: {},
          lastReset: Date.now()
        };
        chrome.storage.local.set({ settings }, () => {
          sendResponse({ success: true });
        });
      });
      return true;

    case 'VALIDATE_LICENSE':
      // License validation is handled client-side
      sendResponse({ success: true });
      return false;

    case 'PING':
      sendResponse({ success: true });
      return false;

    case 'INCREMENT_DETECTION':
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;

        if (!settings.stats) {
          settings.stats = DEFAULT_SETTINGS.stats;
        }

        // Increment total
        settings.stats.totalDetections++;

        // Increment by type
        const piiType = message.piiType;
        if (piiType) {
          if (!settings.stats.detectionsByType[piiType]) {
            settings.stats.detectionsByType[piiType] = 0;
          }
          settings.stats.detectionsByType[piiType]++;
        }

        chrome.storage.local.set({ settings }, () => {
          sendResponse({ success: true, totalDetections: settings.stats.totalDetections });
        });
      });
      return true;

    case 'INCREMENT_MASKED':
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;

        if (!settings.stats) {
          settings.stats = DEFAULT_SETTINGS.stats;
        }

        settings.stats.totalMasked++;

        chrome.storage.local.set({ settings }, () => {
          sendResponse({ success: true, totalMasked: settings.stats.totalMasked });
        });
      });
      return true;

    case 'INCREMENT_BLOCKED':
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;

        if (!settings.stats) {
          settings.stats = DEFAULT_SETTINGS.stats;
        }

        settings.stats.totalBlocked++;

        chrome.storage.local.set({ settings }, () => {
          sendResponse({ success: true, totalBlocked: settings.stats.totalBlocked });
        });
      });
      return true;

    case 'UPDATE_HYBRID_STATS':
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;

        if (!settings.stats) {
          settings.stats = DEFAULT_SETTINGS.stats;
        }

        // Update NER-specific stats
        const { sources, performance, detectionMode } = message;

        if (sources) {
          if (sources.regex > 0) {
            settings.stats.regexDetections = (settings.stats.regexDetections || 0) + sources.regex;
          }
          if (sources.ner > 0) {
            settings.stats.nerDetections = (settings.stats.nerDetections || 0) + sources.ner;
          }
          if (detectionMode === 'hybrid') {
            settings.stats.hybridDetections = (settings.stats.hybridDetections || 0) + 1;
          }
        }

        if (performance && performance.nerCached) {
          settings.stats.nerCacheHits = (settings.stats.nerCacheHits || 0) + 1;
        }

        if (performance && performance.ner > 0) {
          // Update average NER latency
          const currentAvg = settings.stats.avgNerLatency || 0;
          const totalInferences = settings.stats.nerDetections || 1;
          settings.stats.avgNerLatency = ((currentAvg * (totalInferences - 1)) + performance.ner) / totalInferences;
        }

        chrome.storage.local.set({ settings }, () => {
          sendResponse({ success: true });
        });
      });
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');
});

// Badge update based on detections
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;

    if (newSettings?.stats) {
      const totalDetections = newSettings.stats.totalDetections || 0;

      // Update badge
      if (totalDetections > 0) {
        chrome.action.setBadgeText({
          text: totalDetections > 99 ? '99+' : totalDetections.toString()
        });
        chrome.action.setBadgeBackgroundColor({
          color: '#FF9800'
        });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }

    // Update icon based on enabled state
    if (newSettings?.enabled === false) {
      chrome.action.setIcon({
        path: {
          16: 'assets/icons/icon16.png',
          32: 'assets/icons/icon32.png',
          48: 'assets/icons/icon48.png',
          128: 'assets/icons/icon128.png'
        }
      });
    }
  }
});

// Handle alarm for periodic tasks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'license-check') {
    // Perform license check
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings;

    if (settings?.proEnabled && settings?.licenseExpiry) {
      const expiryDate = new Date(settings.licenseExpiry);
      const now = new Date();

      // If license expired, disable Pro
      if (now > expiryDate) {
        settings.proEnabled = false;
        settings.imageDetection = false;
        settings.autoBlur = false;
        await chrome.storage.local.set({ settings });

        console.log('License expired - Pro features disabled');

        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
          title: 'PII Guardian - License Expired',
          message: 'Your Pro license has expired. Please renew to continue using Pro features.'
        });
      }
    }
  }
});

// Create periodic alarms
chrome.alarms.create('license-check', {
  periodInMinutes: 60 // Check every hour
});

// Auto-inject content script when tab is updated (navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only inject when page has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    if (isAIPlatform(tab.url)) {
      await injectContentScript(tabId);
    }
  }
});

// Auto-inject when tab is activated (user switches to tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && isAIPlatform(tab.url)) {
    await injectContentScript(activeInfo.tabId);
  }
});

// Clean up injected tabs when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Network interception - Monitor outgoing requests to AI platforms
// NOTE: Currently disabled due to false positives and Manifest V3 limitations
// The webRequest API in MV3 doesn't support blocking with async operations
// We're relying on content script detection instead
/*
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Synchronous handler only - no async/await allowed
    // This is a Manifest V3 limitation
    return { cancel: false };
  },
  {
    urls: [
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*'
    ]
  },
  ['requestBody']
);
*/

console.log('PII Guardian service worker initialized');

/**
 * Initialize NER model (lazy loading)
 * Model will be initialized when first needed
 */
async function initializeNER() {
  try {
    console.log('[ServiceWorker] Initializing NER model...');
    const result = await offscreenManager.initializeModel();

    if (result.success) {
      console.log(`[ServiceWorker] NER model initialized in ${result.initTimeMs}ms`);

      // CRITICAL: Persist success state to storage so UI reflects the ready state
      // Use Promise to ensure storage is written before returning
      await new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (storageResult) => {
          const settings = storageResult.settings || DEFAULT_SETTINGS;
          settings.nerModelDownloaded = true;
          settings.nerEnabled = true;

          chrome.storage.local.set({ settings }, () => {
            console.log('[ServiceWorker] NER model status persisted to storage');
            resolve();
          });
        });
      });

      // Notify content scripts that NER is ready
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id && isAIPlatform(tab.url)) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'NER_READY',
              offscreenManager: true
            }).catch(() => {
              // Tab might not be ready yet, that's OK
            });
          }
        });
      });

      // Notify popup to update status chip
      chrome.runtime.sendMessage({
        type: 'NER_STATUS',
        status: 'ready',
        initialized: true
      }).catch(() => {
        // Popup may not be open, that's OK
      });

      return { success: true };
    } else {
      console.error('[ServiceWorker] NER initialization failed:', result.error);

      // Notify popup of error
      chrome.runtime.sendMessage({
        type: 'NER_STATUS',
        status: 'error',
        initialized: false,
        error: result.error
      }).catch(() => {
        // Popup may not be open, that's OK
      });

      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[ServiceWorker] NER initialization error:', error);
    return { success: false, error: error.message };
  }
}

// Initialize NER on extension startup (lazy)
// Uncomment to pre-load model on startup
// initializeNER();

// Handle messages requesting NER initialization and status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ONLY handle INIT_NER from popup - NER_INIT goes to offscreen document
  // This is critical: NER_INIT must NOT be handled here or the offscreen document won't receive it
  if (message.type === 'INIT_NER') {
    const forceDownload = message.forceDownload || false;

    console.log(`[ServiceWorker] NER initialization requested from UI (forceDownload: ${forceDownload})`);

    // Optional: Send progress updates to popup
    if (forceDownload && sender.tab) {
      // Simulate progress for user download experience
      // In real implementation, this would track actual model download
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 100) {
          chrome.runtime.sendMessage({
            type: 'NER_DOWNLOAD_PROGRESS',
            progress: progress
          }).catch(() => clearInterval(progressInterval));
        } else {
          clearInterval(progressInterval);
        }
      }, 300);
    }

    initializeNER().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }

  // Dispose NER model and reset flags (used by settings reset)
  if (message.type === 'DISPOSE_NER') {
    (async () => {
      try {
        const disposed = await offscreenManager.disposeModel();

        await new Promise((resolve) => {
          chrome.storage.local.get(['settings'], (storageResult) => {
            const settings = storageResult.settings || DEFAULT_SETTINGS;
            settings.nerModelDownloaded = false;
            settings.nerEnabled = false;
            chrome.storage.local.set({ settings }, resolve);
          });
        });

        sendResponse({ success: disposed });
      } catch (error) {
        console.error('[ServiceWorker] Failed to dispose NER model:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Async response
  }

  if (message.type === 'NER_STATUS') {
    offscreenManager.getStatus().then(status => {
      sendResponse(status);
    }).catch(error => {
      sendResponse({ success: false, isReady: false, isInitializing: false });
    });
    return true; // Async response
  }

  // Handle NER inference requests from content scripts
  if (message.type === 'RUN_NER_INFERENCE') {
    console.log(`[ServiceWorker] Received NER inference request (${message.text?.length || 0} chars)`);

    (async () => {
      try {
        const result = await offscreenManager.runInference(message.text);
        console.log(`[ServiceWorker] NER inference complete: ${result.success ? 'success' : 'failed'}`);
        sendResponse(result);
      } catch (error) {
        console.error('[ServiceWorker] NER inference error:', error);
        sendResponse({
          success: false,
          error: error.message,
          entities: []
        });
      }
    })();

    return true; // Keep channel open for async response
  }
});
