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

// v1.3.0: NER UI Elements
let nerToggle;
let nerStatusChip;
let nerInfoBtn;
let nerInfoModal;
let nerInfoModalClose;
let nerInfoModalOk;
let nerDownloadModal;
let nerDownloadConfirm;
let nerDownloadCancel;
let nerDownloadNever;
let nerDownloadClose;
let nerDownloadProgress;
let nerProgressFill;
let nerProgressText;

/**
 * Initialize popup
 */
async function init() {
  try {
    console.log('[Popup] Initializing...');

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

    // v1.3.0: Get NER UI elements
    nerToggle = document.getElementById('nerToggle');
    nerStatusChip = document.getElementById('nerStatusChip');
    nerInfoBtn = document.getElementById('nerInfoBtn');
    nerInfoModal = document.getElementById('nerInfoModal');
    nerInfoModalClose = document.getElementById('nerModalClose');
    nerInfoModalOk = document.getElementById('nerModalOk');
    nerDownloadModal = document.getElementById('nerDownloadModal');
    nerDownloadConfirm = document.getElementById('nerDownloadConfirm');
    nerDownloadCancel = document.getElementById('nerDownloadCancel');
    nerDownloadNever = document.getElementById('nerDownloadNever');
    nerDownloadClose = document.getElementById('nerDownloadClose');
    nerDownloadProgress = document.getElementById('nerDownloadProgress');
    nerProgressFill = document.getElementById('nerProgressFill');
    nerProgressText = document.getElementById('nerProgressText');

    console.log('[Popup] DOM elements loaded');

    // Load current state
    console.log('[Popup] Loading state...');
    await loadState();
    console.log('[Popup] State loaded');

    // Attach event listeners
    console.log('[Popup] Attaching listeners...');
    attachListeners();
    console.log('[Popup] Listeners attached - Popup ready!');

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

  } catch (error) {
    console.error('[Popup] FATAL ERROR during initialization:', error);
    console.error('[Popup] Stack trace:', error.stack);

    // Show error message to user
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #D32F2F; font-family: -apple-system, system-ui, sans-serif;">
        <h2 style="margin-bottom: 10px;">⚠️ Popup Failed to Load</h2>
        <p style="font-size: 14px; margin: 10px 0; color: #424242;">Error: ${error.message}</p>
        <p style="font-size: 12px; color: #757575; margin: 10px 0;">Check the console (F12) for details</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; font-size: 14px; font-weight: 600;">
          Reload Popup
        </button>
        <br>
        <a href="html/dashboard.html" style="color: #2196F3; text-decoration: none; font-size: 13px; margin-top: 10px; display: inline-block;">
          Or try Dashboard instead
        </a>
      </div>
    `;
  }
}

/**
 * Load current state from storage
 */
async function loadState() {
  try {
    console.log('[Popup] loadState() called');
    const settings = await getSettings();
    const stats = await getStats();
    const licenseStatus = await checkLicenseStatus();

    console.log('[Popup] Settings loaded:', settings);

    // Update toggle
    if (enableToggle) {
      enableToggle.checked = settings.enabled;
    } else {
      console.warn('[Popup] enableToggle element not found');
    }

    // Update status indicator
    updateStatusIndicator(settings.enabled);

    // Update stats
    updateStats(stats);

    // Update Pro status
    updateProStatus(licenseStatus);

    // Load recent detections
    await loadRecentDetections();

    // v1.3.0: Load NER state
    await loadNERState(settings);
  } catch (error) {
    console.error('[Popup] Failed to load state:', error);
    console.error('[Popup] Error stack:', error.stack);
    throw error; // Re-throw to be caught by init's try-catch
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

// ============================================================================
// v1.3.0: NER UI Functions
// ============================================================================

/**
 * Load NER state from settings
 */
async function loadNERState(settings) {
  const nerDisabledBanner = document.getElementById('nerDisabledBanner');

  // Set toggle state
  if (nerToggle) {
    nerToggle.checked = settings.nerEnabled || false;

    // Disable if user chose "never ask"
    if (settings.nerNeverAsk) {
      nerToggle.disabled = true;
      nerToggle.title = 'NER permanently disabled. Click Reset button below to enable.';

      // Show disabled banner
      if (nerDisabledBanner) {
        nerDisabledBanner.style.display = 'flex';
      }
    } else {
      nerToggle.disabled = false;
      nerToggle.title = 'Enable enhanced NER detection';

      // Hide disabled banner
      if (nerDisabledBanner) {
        nerDisabledBanner.style.display = 'none';
      }
    }
  }

  // Update status chip
  await updateNERStatusChip(settings);
}

/**
 * Update NER status chip based on current state
 */
async function updateNERStatusChip(settings) {
  if (!nerStatusChip) return;

  const statusLabel = nerStatusChip.querySelector('.status-label');
  const statusIcon = nerStatusChip.querySelector('.status-icon');

  // Remove all status classes
  nerStatusChip.className = 'status-chip';

  if (!settings.nerEnabled) {
    nerStatusChip.classList.add('status-disabled');
    if (statusLabel) statusLabel.textContent = 'NER: Disabled';
    if (statusIcon) statusIcon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
  } else if (!settings.nerModelDownloaded) {
    nerStatusChip.classList.add('status-error');
    if (statusLabel) statusLabel.textContent = 'NER: Model Not Downloaded';
    if (statusIcon) statusIcon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
  } else {
    // Check actual NER status from background
    try {
      const response = await chrome.runtime.sendMessage({ type: 'NER_STATUS' });
      if (response && response.initialized) {
        nerStatusChip.classList.add('status-ready');
        if (statusLabel) statusLabel.textContent = 'NER: Ready';
        if (statusIcon) statusIcon.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
      } else {
        nerStatusChip.classList.add('status-loading');
        if (statusLabel) statusLabel.textContent = 'NER: Loading...';
        if (statusIcon) statusIcon.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        `;
      }
    } catch (error) {
      nerStatusChip.classList.add('status-error');
      if (statusLabel) statusLabel.textContent = 'NER: Error';
      if (statusIcon) statusIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    }
  }
}

/**
 * Show NER download modal
 */
function showNERDownloadModal() {
  if (nerDownloadModal) {
    nerDownloadModal.style.display = 'flex';
  }
}

/**
 * Hide NER download modal
 */
function hideNERDownloadModal() {
  if (nerDownloadModal) {
    nerDownloadModal.style.display = 'none';
    // Reset progress bar
    if (nerDownloadProgress) nerDownloadProgress.style.display = 'none';
    if (nerProgressFill) nerProgressFill.style.width = '0%';
    if (nerProgressText) nerProgressText.textContent = 'Downloading... 0%';
  }
}

/**
 * Start NER model download
 */
async function startNERModelDownload() {
  if (!nerDownloadProgress || !nerProgressFill || !nerProgressText) return;

  // Show progress bar, hide buttons
  nerDownloadProgress.style.display = 'block';
  const buttons = nerDownloadModal.querySelectorAll('.modal-footer button');
  buttons.forEach(btn => btn.style.display = 'none');

  try {
    // Request NER initialization from background script
    chrome.runtime.sendMessage({
      type: 'INIT_NER',
      forceDownload: true
    });

    // Simulate progress (real progress tracking can be added later)
    for (let i = 0; i <= 100; i += 10) {
      nerProgressFill.style.width = `${i}%`;
      nerProgressText.textContent = `Downloading... ${i}%`;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Save state
    const settings = await getSettings();
    settings.nerModelDownloaded = true;
    settings.nerEnabled = true;
    await chrome.storage.local.set({ settings });

    // Update UI
    if (nerToggle) nerToggle.checked = true;
    await updateNERStatusChip(settings);

    // Close modal
    hideNERDownloadModal();

    // Show success toast
    showToast('NER model downloaded successfully!', 'success');
  } catch (error) {
    console.error('NER download error:', error);
    showToast('Failed to download NER model. Try again later.', 'error');

    // Reset modal
    nerDownloadProgress.style.display = 'none';
    buttons.forEach(btn => btn.style.display = '');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

  // v1.3.0: NER Toggle
  if (nerToggle) {
    nerToggle.addEventListener('change', async (e) => {
      console.log('[Popup] NER toggle clicked:', e.target.checked);

      try {
        const settings = await getSettings();
        console.log('[Popup] Current settings:', settings);

        if (e.target.checked) {
          // Enabling NER
          console.log('[Popup] Attempting to enable NER');

          if (settings.nerNeverAsk) {
            console.log('[Popup] NER permanently disabled by user');
            showToast('NER disabled by user preference', 'info');
            e.target.checked = false;
            return;
          }

          if (!settings.nerModelDownloaded) {
            console.log('[Popup] Model not downloaded, showing prompt');
            // Show download prompt
            showNERDownloadModal();
            // Revert toggle until download completes
            e.target.checked = false;
          } else {
            console.log('[Popup] Model already downloaded, enabling NER');
            // Model already downloaded, just enable
            settings.nerEnabled = true;
            await chrome.storage.local.set({ settings });
            await updateNERStatusChip(settings);

            // Notify background to initialize if needed
            chrome.runtime.sendMessage({ type: 'INIT_NER' });
          }
        } else {
          // Disabling NER
          console.log('[Popup] Disabling NER');
          settings.nerEnabled = false;
          await chrome.storage.local.set({ settings });
          await updateNERStatusChip(settings);
        }
      } catch (error) {
        console.error('[Popup] Error in NER toggle handler:', error);
        showToast('Error toggling NER: ' + error.message, 'error');
        e.target.checked = !e.target.checked; // Revert toggle
      }
    });
  }

  // v1.3.0: NER Info Button
  if (nerInfoBtn) {
    nerInfoBtn.addEventListener('click', () => {
      if (nerInfoModal) nerInfoModal.style.display = 'flex';
    });
  }

  // v1.3.0: NER Info Modal Close Buttons
  if (nerInfoModalClose) {
    nerInfoModalClose.addEventListener('click', () => {
      if (nerInfoModal) nerInfoModal.style.display = 'none';
    });
  }

  if (nerInfoModalOk) {
    nerInfoModalOk.addEventListener('click', () => {
      if (nerInfoModal) nerInfoModal.style.display = 'none';
    });
  }

  // v1.3.0: Close modal on overlay click
  if (nerInfoModal) {
    nerInfoModal.addEventListener('click', (e) => {
      if (e.target === nerInfoModal) {
        nerInfoModal.style.display = 'none';
      }
    });
  }

  // v1.3.0: NER Download Confirm Button
  if (nerDownloadConfirm) {
    nerDownloadConfirm.addEventListener('click', async () => {
      await startNERModelDownload();
    });
  }

  // v1.3.0: NER Download Cancel Button
  if (nerDownloadCancel) {
    nerDownloadCancel.addEventListener('click', () => {
      hideNERDownloadModal();
      if (nerToggle) nerToggle.checked = false;
    });
  }

  // v1.3.0: NER Download Never Button
  if (nerDownloadNever) {
    nerDownloadNever.addEventListener('click', async () => {
      const settings = await getSettings();
      settings.nerNeverAsk = true;
      settings.nerEnabled = false;
      await chrome.storage.local.set({ settings });

      hideNERDownloadModal();
      if (nerToggle) {
        nerToggle.checked = false;
        nerToggle.disabled = true;
        nerToggle.title = 'You chose to always use regex only. Reset in settings to enable.';
      }

      showToast('NER permanently disabled. Reset in settings if needed.', 'info');
    });
  }

  // v1.3.0: NER Download Modal Close Button
  if (nerDownloadClose) {
    nerDownloadClose.addEventListener('click', () => {
      hideNERDownloadModal();
      if (nerToggle) nerToggle.checked = false;
    });
  }

  // v1.3.0: Close download modal on overlay click
  if (nerDownloadModal) {
    nerDownloadModal.addEventListener('click', (e) => {
      if (e.target === nerDownloadModal) {
        hideNERDownloadModal();
        if (nerToggle) nerToggle.checked = false;
      }
    });
  }

  // v1.3.0: NER Reset Button
  const nerResetBtn = document.getElementById('nerResetBtn');
  if (nerResetBtn) {
    nerResetBtn.addEventListener('click', async () => {
      console.log('[Popup] Resetting NER preferences');

      try {
        const settings = await getSettings();

        // Reset the "never ask" flag
        settings.nerNeverAsk = false;
        settings.nerDownloadPromptShown = false;
        settings.nerEnabled = false; // Keep disabled but allow user to enable

        await chrome.storage.local.set({ settings });

        // Re-enable toggle
        if (nerToggle) {
          nerToggle.disabled = false;
          nerToggle.checked = false;
          nerToggle.title = 'Enable enhanced NER detection';
        }

        // Hide banner
        const nerDisabledBanner = document.getElementById('nerDisabledBanner');
        if (nerDisabledBanner) {
          nerDisabledBanner.style.display = 'none';
        }

        showToast('NER preferences reset. You can now enable NER.', 'success');

        // Reload NER state
        await loadNERState(settings);

      } catch (error) {
        console.error('[Popup] Error resetting NER:', error);
        showToast('Error resetting NER: ' + error.message, 'error');
      }
    });
  }
}

// Listen for NER status changes from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NER_STATUS_CHANGED') {
    console.log('[Popup] NER status changed:', message.status);

    // Reload settings to get updated state
    chrome.storage.local.get(['settings'], async (result) => {
      const settings = result.settings || {};
      await updateNERStatusChip(settings);
    });

    sendResponse({ success: true });
  }

  if (message.type === 'NER_DOWNLOAD_PROGRESS') {
    console.log('[Popup] NER download progress:', message.progress);

    // Update progress bar if visible
    if (nerProgressFill && nerProgressText) {
      nerProgressFill.style.width = `${message.progress}%`;
      nerProgressText.textContent = `Downloading... ${message.progress}%`;
    }
  }

  return false;
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
