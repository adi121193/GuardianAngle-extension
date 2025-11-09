/**
 * Service Worker (Background Script)
 * Handles background operations and extension lifecycle
 */

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
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

// Periodic license check (every hour)
setInterval(async () => {
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
}, 60 * 60 * 1000); // Check every hour

// Handle alarm for periodic tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'license-check') {
    // Trigger license check
  }
});

// Create periodic alarms
chrome.alarms.create('license-check', {
  periodInMinutes: 60 // Check every hour
});

console.log('PII Guardian service worker initialized');
