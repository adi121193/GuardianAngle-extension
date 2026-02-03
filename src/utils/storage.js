/**
 * Storage utility wrapper for chrome.storage.local
 * Provides Promise-based API for extension storage
 */

/**
 * Default settings for the extension
 */
const DEFAULT_SETTINGS = {
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
    // NER-detected entity types
    'person_name',
    'organization',
    'location'
  ],
  notificationSound: true,
  proEnabled: false,
  licenseKey: null,
  licenseExpiry: null,
  imageDetection: false,
  autoBlur: false,
  // NER/ML Detection Settings
  nerEnabled: true,              // Enable NER-based detection
  detectionMode: 'hybrid',        // 'regex_only', 'ner_only', 'hybrid'
  nerAutoInit: false,             // Auto-initialize NER on startup (false = lazy load)
  // v1.3.0: NER Model Download & Popup UI Settings
  nerModelDownloaded: true,       // Track if NER model has been downloaded
  nerNeverAsk: false,             // User chose "Always use regex only" - permanently disable
  nerDownloadPromptShown: false,  // Track if download prompt has been shown
  // History Scanning (Priority 3: Opt-in for performance)
  scanHistory: false,             // Scan page history for PII (may impact performance)
  scanHistoryDepth: 50,           // Max messages to scan if enabled
  stats: {
    totalDetections: 0,
    totalMasked: 0,
    totalBlocked: 0,
    detectionsByType: {},
    // NER-specific stats
    nerDetections: 0,
    regexDetections: 0,
    hybridDetections: 0,
    nerCacheHits: 0,
    avgNerLatency: 0,
    lastReset: Date.now()
  }
};

/**
 * Get settings from storage
 * Merges stored settings with defaults to ensure new settings are always available
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  return new Promise((resolve, reject) => {
    // Safety check for chrome.storage
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      console.warn('PII Guardian: chrome.storage not available, using defaults');
      resolve(DEFAULT_SETTINGS);
      return;
    }

    chrome.storage.local.get(['settings'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        // Merge stored settings with defaults to ensure new default values are included
        // This handles upgrades where new settings are added to defaults
        const storedSettings = result.settings || {};
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...storedSettings,
          // Special handling for arrays - merge enabledPIITypes to include new NER types
          enabledPIITypes: mergeEnabledTypes(
            DEFAULT_SETTINGS.enabledPIITypes,
            storedSettings.enabledPIITypes
          ),
          // Deep merge stats object
          stats: {
            ...DEFAULT_SETTINGS.stats,
            ...(storedSettings.stats || {})
          }
        };
        resolve(mergedSettings);
      }
    });
  });
}

/**
 * Merge enabled PII types, ensuring new default types are included
 * @param {Array} defaultTypes - Default enabled types
 * @param {Array} storedTypes - User's stored types (may be undefined)
 * @returns {Array} Merged types array
 */
function mergeEnabledTypes(defaultTypes, storedTypes) {
  if (!storedTypes || !Array.isArray(storedTypes)) {
    return defaultTypes;
  }
  // Create a Set from stored types, then add any new default types
  const typeSet = new Set(storedTypes);
  // Add NER types that might be missing from old settings
  const nerTypes = ['person_name', 'organization', 'location'];
  for (const nerType of nerTypes) {
    if (defaultTypes.includes(nerType) && !typeSet.has(nerType)) {
      typeSet.add(nerType);
    }
  }
  return Array.from(typeSet);
}

/**
 * Save settings to storage
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    // Safety check for chrome.storage
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      console.warn('PII Guardian: chrome.storage not available, cannot save settings');
      resolve(); // Fail silently to avoid breaking the extension
      return;
    }

    chrome.storage.local.set({ settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update specific setting
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<void>}
 */
export async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await saveSettings(settings);
}

/**
 * Update multiple settings at once
 * @param {Object} updates - Object containing settings to update
 * @returns {Promise<void>}
 */
export async function updateSettings(updates) {
  const settings = await getSettings();
  const newSettings = { ...settings, ...updates };
  await saveSettings(newSettings);
}

/**
 * Reset settings to defaults
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  await saveSettings(DEFAULT_SETTINGS);
}

/**
 * Get Pro status
 * @returns {Promise<boolean>}
 */
export async function getProStatus() {
  const settings = await getSettings();
  return settings.proEnabled || false;
}

/**
 * Set Pro status
 * @param {boolean} enabled - Pro status
 * @param {string} licenseKey - License key
 * @param {string} expiry - Expiry date ISO string
 * @returns {Promise<void>}
 */
export async function setProStatus(enabled, licenseKey = null, expiry = null) {
  const settings = await getSettings();
  settings.proEnabled = enabled;
  settings.licenseKey = licenseKey;
  settings.licenseExpiry = expiry;

  if (enabled) {
    settings.imageDetection = true;
    settings.autoBlur = true;
  }

  await saveSettings(settings);
}

/**
 * Increment detection counter (message-based to avoid race conditions)
 * @param {string} type - PII type detected
 * @returns {Promise<void>}
 */
export async function incrementDetection(type) {
  return new Promise((resolve, reject) => {
    // Safety check for chrome.runtime
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      console.warn('PII Guardian: chrome.runtime not available');
      resolve(); // Fail silently to avoid breaking the extension
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'INCREMENT_DETECTION', piiType: type },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to increment detection:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Increment masked counter (message-based to avoid race conditions)
 * @returns {Promise<void>}
 */
export async function incrementMasked() {
  return new Promise((resolve, reject) => {
    // Safety check for chrome.runtime
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      console.warn('PII Guardian: chrome.runtime not available');
      resolve();
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'INCREMENT_MASKED' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to increment masked:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Increment blocked counter (message-based to avoid race conditions)
 * @returns {Promise<void>}
 */
export async function incrementBlocked() {
  return new Promise((resolve, reject) => {
    // Safety check for chrome.runtime
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      console.warn('PII Guardian: chrome.runtime not available');
      resolve();
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'INCREMENT_BLOCKED' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to increment blocked:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Get statistics
 * @returns {Promise<Object>}
 */
export async function getStats() {
  const settings = await getSettings();
  return settings.stats || DEFAULT_SETTINGS.stats;
}

/**
 * Reset statistics
 * @returns {Promise<void>}
 */
export async function resetStats() {
  const settings = await getSettings();
  settings.stats = {
    totalDetections: 0,
    totalMasked: 0,
    totalBlocked: 0,
    detectionsByType: {},
    lastReset: Date.now()
  };
  await saveSettings(settings);
}

/**
 * Get all data from storage
 * @returns {Promise<Object>}
 */
export async function getAllData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Clear all data from storage
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get specific value from storage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found
 * @returns {Promise<*>}
 */
export async function getValue(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      }
    });
  });
}

/**
 * Set specific value in storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<void>}
 */
export async function setValue(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Check if extension is enabled
 * @returns {Promise<boolean>}
 */
export async function isEnabled() {
  const settings = await getSettings();
  return settings.enabled;
}

/**
 * Toggle extension enabled state
 * @returns {Promise<boolean>} New state
 */
export async function toggleEnabled() {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  await saveSettings(settings);
  return settings.enabled;
}

/**
 * Export all data for backup
 * @returns {Promise<string>} JSON string of all data
 */
export async function exportData() {
  const data = await getAllData();
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from backup
 * @param {string} jsonData - JSON string of data
 * @returns {Promise<void>}
 */
export async function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    throw new Error('Invalid JSON data');
  }
}

/**
 * Listen to storage changes
 * @param {Function} callback - Callback function (changes, areaName)
 */
export function onStorageChanged(callback) {
  chrome.storage.onChanged.addListener(callback);
}

/**
 * Remove storage change listener
 * @param {Function} callback - Callback function to remove
 */
export function removeStorageListener(callback) {
  chrome.storage.onChanged.removeListener(callback);
}

/**
 * Get detection history with optional filtering and limiting
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of events to return
 * @param {number} options.offset - Number of events to skip
 * @param {string} options.platform - Filter by platform name
 * @param {string} options.riskLevel - Filter by risk level
 * @returns {Promise<Array>} Array of detection events
 */
export async function getDetectionHistory(options = {}) {
  const { limit = 50, offset = 0, platform = null, riskLevel = null } = options;

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['detectionHistory'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      let history = result.detectionHistory || [];

      // Apply filters
      if (platform) {
        history = history.filter(event => event.platform === platform);
      }

      if (riskLevel) {
        history = history.filter(event => event.riskLevel === riskLevel);
      }

      // Sort by timestamp descending (most recent first)
      history.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const paginatedHistory = history.slice(offset, offset + limit);

      resolve(paginatedHistory);
    });
  });
}

/**
 * Clear all detection history
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ detectionHistory: [] }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
