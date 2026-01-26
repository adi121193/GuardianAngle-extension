/**
 * Popup Logic
 * Handles user interactions in the extension popup
 */

// DOM Elements
const elements = {
  enableToggle: document.getElementById('enableToggle'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),

  nerToggle: document.getElementById('nerToggle'),
  nerStatusChip: document.getElementById('nerStatusChip'),
  nerInfoBtn: document.getElementById('nerInfoBtn'),
  nerInfoModal: document.getElementById('nerInfoModal'),
  nerModalClose: document.getElementById('nerModalClose'),
  nerModalOk: document.getElementById('nerModalOk'),

  stats: {
    totalDetections: document.getElementById('totalDetections'),
    totalMasked: document.getElementById('totalMasked'),
    totalBlocked: document.getElementById('totalBlocked')
  },

  buttons: {
    dashboard: document.getElementById('dashboardBtn'),
    settings: document.getElementById('settingsBtn'),
    helpToggle: document.getElementById('helpToggle'),
    settings: document.getElementById('settingsBtn'),
    helpToggle: document.getElementById('helpToggle'),
    viewAllHistory: document.getElementById('viewAllHistoryBtn'),
    viewAllHistory: document.getElementById('viewAllHistoryBtn'),
    upgrade: document.getElementById('upgradeBtn')
  },

  proBanner: document.getElementById('proBanner'),
  proStatus: document.getElementById('proStatus'),
  proExpiryText: document.getElementById('proExpiryText'),

  helpContent: document.getElementById('helpContent'),
  recentDetectionsList: document.getElementById('recentDetectionsList')
};

// State
let state = {
  settings: null,
  stats: null
};

/**
 * Initialize Popup
 */
async function init() {
  try {
    // Load settings and stats
    const [settingsResult, statsResult] = await Promise.all([
      chrome.storage.local.get(['settings']),
      chrome.runtime.sendMessage({ type: 'GET_STATS' })
    ]);

    state.settings = settingsResult.settings || {};
    state.stats = statsResult.stats || {};

    // Get Pro Status separately (it's inside settings but accessed via helper usually, 
    // but here we have the full settings object already)
    state.isPro = state.settings.proEnabled || false;
    state.licenseExpiry = state.settings.licenseExpiry;

    // Initialize UI
    renderUI();

    // Attach event listeners
    attachListeners();

    // Check NER status
    checkNERStatus();

  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
}

/**
 * Render UI based on state
 */
function renderUI() {
  // Global Enable Toggle
  if (state.settings.enabled !== undefined) {
    elements.enableToggle.checked = state.settings.enabled;
    updateGlobalStatus(state.settings.enabled);
  }

  // NER Toggle
  if (state.settings.nerEnabled !== undefined) {
    elements.nerToggle.checked = state.settings.nerEnabled;
    updateNERStatus(state.settings.nerEnabled);
  }

  // Stats
  if (state.stats) {
    elements.stats.totalDetections.textContent = formatNumber(state.stats.totalDetections || 0);
    elements.stats.totalMasked.textContent = formatNumber(state.stats.totalMasked || 0);
    elements.stats.totalBlocked.textContent = formatNumber(state.stats.totalBlocked || 0);
  }

  // Pro Status UI
  if (state.isPro) {
    if (elements.proBanner) elements.proBanner.style.display = 'none';
    if (elements.proStatus) {
      elements.proStatus.style.display = 'block';

      // Format expiry
      if (state.licenseExpiry) {
        const date = new Date(state.licenseExpiry);
        elements.proExpiryText.textContent = `Valid until ${date.toLocaleDateString()}`;
      } else {
        elements.proExpiryText.textContent = 'Active Lifetime License';
      }
    }
  } else {
    if (elements.proBanner) elements.proBanner.style.display = 'block';
    if (elements.proStatus) elements.proStatus.style.display = 'none';
  }
}

/**
 * Update Global Status UI
 */
function updateGlobalStatus(enabled) {
  if (enabled) {
    elements.statusDot.className = 'status-dot status-active';
    elements.statusText.textContent = 'Active';
    document.body.classList.remove('extension-disabled');
  } else {
    elements.statusDot.className = 'status-dot status-inactive';
    elements.statusText.textContent = 'Inactive';
    document.body.classList.add('extension-disabled');
  }
}

/**
 * Update NER Status UI
 */
function updateNERStatus(enabled, isReady = true) {
  const chip = elements.nerStatusChip;
  const label = chip.querySelector('.status-label');

  // Remove all status classes
  chip.classList.remove('status-disabled', 'status-ready', 'status-loading', 'status-error');

  if (!enabled) {
    chip.classList.add('status-disabled');
    label.textContent = 'NER: Disabled';
    return;
  }

  if (isReady) {
    chip.classList.add('status-ready');
    label.textContent = 'NER: Ready';
  } else {
    chip.classList.add('status-loading');
    label.textContent = 'NER: Initializing...';
  }
}

/**
 * Attach Event Listeners
 */
function attachListeners() {
  // Global Toggle
  elements.enableToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    state.settings.enabled = enabled;
    updateGlobalStatus(enabled);

    await chrome.storage.local.set({ settings: state.settings });
  });

  // NER Toggle
  elements.nerToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    state.settings.nerEnabled = enabled;

    // Assume bundled model is always "ready" or "initializing"
    updateNERStatus(enabled, false); // Set to initializing first

    await chrome.storage.local.set({ settings: state.settings });

    if (enabled) {
      // Trigger initialization in background
      chrome.runtime.sendMessage({ type: 'INIT_NER' });
    } else {
      // Dispose NER (optional, to save memory)
      chrome.runtime.sendMessage({ type: 'DISPOSE_NER' });
    }
  });

  // Navigation Buttons
  elements.buttons.dashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'html/dashboard.html' });
  });

  elements.buttons.settings.addEventListener('click', () => {
    chrome.tabs.create({ url: 'html/settings.html' });
  });

  // Upgrade Button
  if (elements.buttons.upgrade) {
    elements.buttons.upgrade.addEventListener('click', () => {
      chrome.tabs.create({ url: 'html/license.html' });
    });
  }

  // Help Toggle
  elements.buttons.helpToggle.addEventListener('click', () => {
    const isHidden = elements.helpContent.style.display === 'none';
    elements.helpContent.style.display = isHidden ? 'block' : 'none';
    elements.buttons.helpToggle.querySelector('.chevron').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Info Modal
  elements.nerInfoBtn.addEventListener('click', () => {
    elements.nerInfoModal.style.display = 'flex';
  });

  elements.nerModalClose.addEventListener('click', () => {
    elements.nerInfoModal.style.display = 'none';
  });

  elements.nerModalOk.addEventListener('click', () => {
    elements.nerInfoModal.style.display = 'none';
  });
}

/**
 * Check Actual NER Status from Background
 */
async function checkNERStatus() {
  if (!state.settings.nerEnabled) return;

  try {
    const status = await chrome.runtime.sendMessage({ type: 'NER_STATUS' });
    updateNERStatus(true, status.isReady);
  } catch (e) {
    console.warn('Could not check NER status:', e);
  }
}

/**
 * Format numbers (1.2k)
 */
function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Listen for Status Updates
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'NER_STATUS') {
    if (state.settings.nerEnabled) {
      updateNERStatus(true, message.status === 'ready' || message.isReady);
    }
  }
});

// Start initialization
document.addEventListener('DOMContentLoaded', init);
