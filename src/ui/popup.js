/**
 * Popup UI Script
 */

import { getSettings, toggleEnabled, getStats } from '../utils/storage.js';
import { checkLicenseStatus } from '../utils/licenseValidation.js';

// DOM Elements
let enableToggle;
let statusDot;
let statusText;
let totalDetections;
let totalMasked;
let totalBlocked;
let dashboardBtn;
let settingsBtn;
let upgradeBtn;
let proBanner;
let proStatus;
let proExpiryText;

/**
 * Initialize popup
 */
async function init() {
  // Get DOM elements
  enableToggle = document.getElementById('enableToggle');
  statusDot = document.getElementById('statusDot');
  statusText = document.getElementById('statusText');
  totalDetections = document.getElementById('totalDetections');
  totalMasked = document.getElementById('totalMasked');
  totalBlocked = document.getElementById('totalBlocked');
  dashboardBtn = document.getElementById('dashboardBtn');
  settingsBtn = document.getElementById('settingsBtn');
  upgradeBtn = document.getElementById('upgradeBtn');
  proBanner = document.getElementById('proBanner');
  proStatus = document.getElementById('proStatus');
  proExpiryText = document.getElementById('proExpiryText');

  // Load current state
  await loadState();

  // Attach event listeners
  attachListeners();
}

/**
 * Load current state from storage
 */
async function loadState() {
  try {
    const settings = await getSettings();
    const stats = await getStats();
    const licenseStatus = await checkLicenseStatus();

    // Update toggle
    enableToggle.checked = settings.enabled;

    // Update status indicator
    updateStatusIndicator(settings.enabled);

    // Update stats
    updateStats(stats);

    // Update Pro status
    updateProStatus(licenseStatus);
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

/**
 * Update status indicator
 */
function updateStatusIndicator(enabled) {
  if (enabled) {
    statusDot.classList.add('active');
    statusText.textContent = 'Active';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Inactive';
  }
}

/**
 * Update statistics display
 */
function updateStats(stats) {
  totalDetections.textContent = formatNumber(stats.totalDetections || 0);
  totalMasked.textContent = formatNumber(stats.totalMasked || 0);
  totalBlocked.textContent = formatNumber(stats.totalBlocked || 0);
}

/**
 * Update Pro status display
 */
function updateProStatus(licenseStatus) {
  if (licenseStatus.active) {
    proBanner.style.display = 'none';
    proStatus.style.display = 'flex';

    if (licenseStatus.daysRemaining <= 7) {
      proExpiryText.textContent = `Expires in ${licenseStatus.daysRemaining} days`;
      proExpiryText.style.color = '#FF9800';
    } else {
      proExpiryText.textContent = 'Active';
      proExpiryText.style.color = '#4CAF50';
    }
  } else {
    proBanner.style.display = 'flex';
    proStatus.style.display = 'none';
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Attach event listeners
 */
function attachListeners() {
  // Enable toggle
  enableToggle.addEventListener('change', async (e) => {
    const newState = await toggleEnabled();
    updateStatusIndicator(newState);
  });

  // Dashboard button
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('html/dashboard.html')
    });
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('html/settings.html')
    });
  });

  // Upgrade button
  upgradeBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('html/license.html')
    });
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
