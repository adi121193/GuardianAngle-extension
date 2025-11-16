/**
 * Service Worker (Background Script)
 * Handles background operations and extension lifecycle
 */

// Track injected tabs to avoid duplicate injection
const injectedTabs = new Set();

// Track blocked requests to avoid duplicate notifications
const blockedRequests = new Set();

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

// PII detection patterns (copied from detectText.js for service worker use)
const PII_PATTERNS = {
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  phone: /(?:^|[^\d])\d{10}(?:[^\d]|$)/g,
  email: /\b[\w.]+@[\w.]+\.\w{2,}\b/g,
  creditCard: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  passport: /\b[A-Z]\d{7}\b/g,
  bankAccount: /\b\d{9,18}\b/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  gst: /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b/g
};

/**
 * Check if URL is an AI platform
 */
function isAIPlatform(url) {
  if (!url) return false;
  return AI_PLATFORMS.some(platform => url.includes(platform));
}

/**
 * Detect PII in text using regex patterns
 */
function detectPIIInText(text) {
  if (!text || typeof text !== 'string') return { detected: false, types: [] };

  const detectedTypes = [];
  const matches = [];

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const found = text.match(pattern);
    if (found && found.length > 0) {
      detectedTypes.push(type);
      matches.push(...found);
    }
  }

  return {
    detected: detectedTypes.length > 0,
    types: detectedTypes,
    matches: matches,
    count: matches.length
  };
}

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
 */
async function injectContentScript(tabId) {
  // Prevent duplicate injection
  if (injectedTabs.has(tabId)) {
    console.log('PII Guardian: Already injected into tab', tabId);
    return;
  }

  try {
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/monitorInputs.js']
    });

    injectedTabs.add(tabId);
    console.log('PII Guardian: Content script injected into tab', tabId);
  } catch (error) {
    console.error('PII Guardian: Failed to inject content script:', error);
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
          'gst'
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
  }

  // Inject into existing tabs (on both install and update)
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isAIPlatform(tab.url) && tab.id) {
      // Small delay to ensure page is ready
      setTimeout(() => {
        injectContentScript(tab.id);
      }, 1000);
    }
  }
});

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

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
