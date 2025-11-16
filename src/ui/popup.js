/**
 * Popup UI Script
 */

import { getSettings, toggleEnabled, getStats, getDetectionHistory } from '../utils/storage.js';
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
let recentDetectionsList;
let viewAllHistoryBtn;
let helpToggle;
let helpContent;

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
  recentDetectionsList = document.getElementById('recentDetectionsList');
  viewAllHistoryBtn = document.getElementById('viewAllHistoryBtn');
  helpToggle = document.getElementById('helpToggle');
  helpContent = document.getElementById('helpContent');

  // Load current state
  await loadState();

  // Attach event listeners
  attachListeners();

  // Add real-time storage change listener for live updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;

      // Update stats if they changed
      if (newSettings?.stats) {
        updateStats(newSettings.stats);
      }

      // Update enabled status if it changed
      if (newSettings?.enabled !== undefined) {
        enableToggle.checked = newSettings.enabled;
        updateStatusIndicator(newSettings.enabled);
      }

      // Update Pro status if it changed
      if (newSettings?.proEnabled !== undefined || newSettings?.licenseExpiry !== undefined) {
        checkLicenseStatus().then(licenseStatus => {
          updateProStatus(licenseStatus);
        });
      }
    }

    // Update history if it changed
    if (areaName === 'local' && changes.detectionHistory) {
      loadRecentDetections();
    }
  });
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

    // Load recent detections
    await loadRecentDetections();
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
 * Update statistics display with optional animation
 */
function updateStats(stats) {
  const newDetections = stats.totalDetections || 0;
  const newMasked = stats.totalMasked || 0;
  const newBlocked = stats.totalBlocked || 0;

  // Check if values actually changed
  const detectionsChanged = totalDetections.textContent !== formatNumber(newDetections);
  const maskedChanged = totalMasked.textContent !== formatNumber(newMasked);
  const blockedChanged = totalBlocked.textContent !== formatNumber(newBlocked);

  // Update values
  totalDetections.textContent = formatNumber(newDetections);
  totalMasked.textContent = formatNumber(newMasked);
  totalBlocked.textContent = formatNumber(newBlocked);

  // Add brief highlight animation when value changes
  if (detectionsChanged && newDetections > 0) {
    totalDetections.parentElement.classList.add('stat-updated');
    setTimeout(() => {
      totalDetections.parentElement.classList.remove('stat-updated');
    }, 1000);
  }

  if (maskedChanged && newMasked > 0) {
    totalMasked.parentElement.classList.add('stat-updated');
    setTimeout(() => {
      totalMasked.parentElement.classList.remove('stat-updated');
    }, 1000);
  }

  if (blockedChanged && newBlocked > 0) {
    totalBlocked.parentElement.classList.add('stat-updated');
    setTimeout(() => {
      totalBlocked.parentElement.classList.remove('stat-updated');
    }, 1000);
  }
}

/**
 * Update Pro status display
 */
function updateProStatus(licenseStatus) {
  if (licenseStatus.active) {
    proBanner.style.display = 'none';
    proStatus.style.display = 'block';

    if (licenseStatus.daysRemaining <= 7) {
      proExpiryText.textContent = `Expires in ${licenseStatus.daysRemaining} days`;
      proExpiryText.style.fontWeight = '600';
    } else {
      proExpiryText.textContent = 'Active';
      proExpiryText.style.fontWeight = 'normal';
    }
  } else {
    proBanner.style.display = 'block';
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
 * Load and display recent detections
 */
async function loadRecentDetections() {
  try {
    const history = await getDetectionHistory({ limit: 5 });

    if (history.length === 0) {
      // Show empty state
      recentDetectionsList.innerHTML = `
        <div class="detections-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No detections yet</p>
          <small>PII detections will appear here</small>
        </div>
      `;
      return;
    }

    // Build detection items HTML
    const detectionItems = history.map(event => createDetectionItem(event)).join('');
    recentDetectionsList.innerHTML = detectionItems;
  } catch (error) {
    console.error('Failed to load recent detections:', error);
  }
}

/**
 * Create HTML for a single detection item
 * @param {Object} event - Detection event
 * @returns {string} HTML string
 */
function createDetectionItem(event) {
  const timeAgo = formatTimeAgo(event.timestamp);
  const riskColor = getRiskColor(event.riskLevel);
  const actionIcon = getActionIcon(event.userAction);
  const actionText = getActionText(event.userAction);

  return `
    <div class="detection-item" data-risk="${event.riskLevel}">
      <div class="detection-header">
        <div class="detection-platform">
          <span class="platform-icon">${getPlatformIcon(event.platform)}</span>
          <span class="platform-name">${event.platform}</span>
        </div>
        <div class="detection-time">${timeAgo}</div>
      </div>

      <div class="detection-body">
        <div class="detection-types">
          ${event.piiTypes.map(type => `
            <span class="pii-type-badge">${formatPIIType(type)}</span>
          `).join('')}
        </div>

        <div class="detection-action" style="color: ${riskColor}">
          ${actionIcon}
          <span>${actionText}</span>
        </div>
      </div>

      ${event.excerpt ? `
        <div class="detection-excerpt">
          <small>${event.excerpt}</small>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Format timestamp as time ago
 * @param {number} timestamp - Timestamp
 * @returns {string} Formatted time
 */
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get risk level color
 * @param {string} level - Risk level
 * @returns {string} Color code
 */
function getRiskColor(level) {
  const colors = {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#FF5722',
    critical: '#D32F2F'
  };
  return colors[level] || colors.medium;
}

/**
 * Get action icon SVG
 * @param {string} action - User action
 * @returns {string} SVG HTML
 */
function getActionIcon(action) {
  const icons = {
    blocked: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    masked: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    sent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    detected: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };
  return icons[action] || icons.detected;
}

/**
 * Get action text
 * @param {string} action - User action
 * @returns {string} Action text
 */
function getActionText(action) {
  const texts = {
    blocked: 'Blocked',
    masked: 'Masked',
    sent: 'Sent anyway',
    detected: 'Detected'
  };
  return texts[action] || 'Detected';
}

/**
 * Get platform icon
 * @param {string} platform - Platform name
 * @returns {string} Icon emoji or text
 */
function getPlatformIcon(platform) {
  const icons = {
    'ChatGPT': '🤖',
    'Claude': '🔮',
    'Gemini': '✨',
    'Perplexity': '🔍',
    'Unknown': '❓'
  };
  return icons[platform] || icons['Unknown'];
}

/**
 * Format PII type for display
 * @param {string} type - PII type
 * @returns {string} Formatted type
 */
function formatPIIType(type) {
  const formatted = {
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    phone: 'Phone',
    email: 'Email',
    creditCard: 'Credit Card',
    bankAccount: 'Bank Account',
    passport: 'Passport',
    ssn: 'SSN',
    ifsc: 'IFSC',
    gst: 'GST'
  };
  return formatted[type] || type;
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

  // View all history button
  viewAllHistoryBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('html/history.html')
    });
  });

  // Help toggle
  helpToggle.addEventListener('click', () => {
    const isVisible = helpContent.style.display !== 'none';
    helpContent.style.display = isVisible ? 'none' : 'block';
    helpToggle.classList.toggle('active', !isVisible);
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
