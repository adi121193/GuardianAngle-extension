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
};

/**
 * Get settings from storage
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
        const settings = result.settings || DEFAULT_SETTINGS;
        resolve(settings);
      }
    });
  });
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
 * Increment detection counter
 * @param {string} type - PII type detected
 * @returns {Promise<void>}
 */
export async function incrementDetection(type) {
  const settings = await getSettings();

  if (!settings.stats) {
    settings.stats = DEFAULT_SETTINGS.stats;
  }

  settings.stats.totalDetections++;

  if (!settings.stats.detectionsByType[type]) {
    settings.stats.detectionsByType[type] = 0;
  }
  settings.stats.detectionsByType[type]++;

  await saveSettings(settings);
}

/**
 * Increment masked counter
 * @returns {Promise<void>}
 */
export async function incrementMasked() {
  const settings = await getSettings();

  if (!settings.stats) {
    settings.stats = DEFAULT_SETTINGS.stats;
  }

  settings.stats.totalMasked++;
  await saveSettings(settings);
}

/**
 * Increment blocked counter
 * @returns {Promise<void>}
 */
export async function incrementBlocked() {
  const settings = await getSettings();

  if (!settings.stats) {
    settings.stats = DEFAULT_SETTINGS.stats;
  }

  settings.stats.totalBlocked++;
  await saveSettings(settings);
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
