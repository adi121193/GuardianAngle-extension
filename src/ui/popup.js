/**
 * PII Guardian - SPA Logic
 * Handles both Popup (Compact) and Dashboard (Full) interactions.
 */

// DOM Elements container
let elements = {};

// State
let state = {
  settings: {},
  stats: {},
  isPro: false
};

/**
 * Initialize
 */
async function init() {
  console.log('[Popup] Starting initialization...');
  try {
    // Initialize DOM Elements
    console.log('[Popup] Initializing DOM elements...');
    elements = {
      // Navigation
      navItems: document.querySelectorAll('.nav-item'),
      views: document.querySelectorAll('.view'),
      mobileNavToggle: document.getElementById('mobileNavToggle'),
      sidebar: document.querySelector('.sidebar'),

      // Dashboard Inputs
      enableToggle: document.getElementById('enableToggle'),
      nerToggle: document.getElementById('nerToggle'),
      nerStatusChip: document.getElementById('nerStatusChip'),

      // Stats
      stats: {
        totalDetections: document.getElementById('totalDetections'),
        totalMasked: document.getElementById('totalMasked'),
        totalBlocked: document.getElementById('totalBlocked')
      },
      recentList: document.getElementById('recentDetectionsList'),

      // Actions
      dashboardBtn: document.getElementById('dashboardBtn'),
      settingsBtn: document.getElementById('settingsBtn'), // Added settingsBtn
      exportBtn: document.getElementById('exportDataBtn'),

      // Settings Inputs
      settings: {
        autoMask: document.getElementById('autoMask'),
        blockOnDetection: document.getElementById('blockOnDetection'),
        piiChecks: document.querySelectorAll('.pii-check input')
      },

      // License Elements
      tierBadge: document.getElementById('tierBadge'),
      upgradeBtn: document.getElementById('upgradeBtn'),
      licenseActivationForm: document.getElementById('licenseActivationForm'),
      licenseInfoView: document.getElementById('licenseInfoView'),
      licenseKeyInput: document.getElementById('licenseKeyInput'),
      activateLicenseBtn: document.getElementById('activateLicenseBtn'),
      deactivateLicenseBtn: document.getElementById('deactivateLicenseBtn'),
      buyLicenseLink: document.getElementById('buyLicenseLink'),
      licenseError: document.getElementById('licenseError'),
      licenseSuccess: document.getElementById('licenseSuccess')
    };

    console.log('[Popup] DOM elements initialized:', elements);

    // Load settings
    console.log('[Popup] Loading settings...');
    try {
      const { getSettings } = await import('../utils/storage.js');
      state.settings = await getSettings();
      console.log('[Popup] Settings loaded:', state.settings);
    } catch (error) {
      console.error('[Popup] Failed to load settings:', error);
      state.settings = {};
    }

    // Load tier info
    console.log('[Popup] Loading tier info...');
    await loadTierInfo();

    // Load stats
    console.log('[Popup] Loading stats...');
    await loadStats();

    // Render views
    console.log('[Popup] Rendering views...');
    renderDashboard();
    renderSettings();
    renderLicense();

    // Attach listeners
    console.log('[Popup] Attaching listeners...');
    attachListeners();

    // Set initial NER status
    updateNERStatus(state.settings.nerEnabled || false);

    console.log('[Popup] Initialized successfully');
  } catch (error) {
    console.error('[Popup] Init error:', error);
    console.error('[Popup] Error stack:', error.stack);
    renderError(error.message);
  }
}

/**
 * Load Tier Info from background script
 */
async function loadTierInfo() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TIER_INFO' });
    state.tier = response.tier;
    state.isPro = response.tier === 'pro';
    console.log('Tier Info Loaded:', state.tier);
  } catch (error) {
    console.error('Failed to load tier info:', error);
    state.tier = 'free';
    state.isPro = false;
  }
}

/**
 * Load Stats from background script
 */
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    state.stats = response.stats || {};
    console.log('Stats Loaded:', state.stats);
  } catch (error) {
    console.error('Failed to load stats:', error);
    state.stats = {};
  }
}

/**
 * Render Dashboard View
 */
function renderDashboard() {
  // Toggles
  if (state.settings.enabled !== undefined) elements.enableToggle.checked = state.settings.enabled;
  if (state.settings.nerEnabled !== undefined) elements.nerToggle.checked = state.settings.nerEnabled;

  // NER Status
  updateNERStatus(state.settings.nerEnabled);

  // Stats
  if (state.stats) {
    elements.stats.totalDetections.textContent = formatNumber(state.stats.totalDetections || 0);
    elements.stats.totalMasked.textContent = formatNumber(state.stats.totalMasked || 0);
    elements.stats.totalBlocked.textContent = formatNumber(state.stats.totalBlocked || 0);
  }
}

/**
 * Render Settings View
 */
function renderSettings() {
  if (elements.settings.autoMask) elements.settings.autoMask.checked = state.settings.autoMask || false;
  if (elements.settings.blockOnDetection) elements.settings.blockOnDetection.checked = state.settings.blockOnDetection || false;

  // PII Types
  const enabledTypes = state.settings.enabledTypes || [];
  elements.settings.piiChecks.forEach(checkbox => {
    checkbox.checked = enabledTypes.includes(checkbox.value);
  });
}

/**
 * Attach Listeners
 */
/**
 * Attach Listeners (using Event Delegation)
 */
function attachListeners() {
  console.log('[Popup] Attaching global event listeners...');

  document.body.addEventListener('click', (e) => {
    // Helper to find closest button/element
    const target = e.target;
    const btn = target.closest('button') || target.closest('a') || target;

    console.log('[Popup] Click detected on:', btn);

    // Navigation Items & Sidebar Toggle
    if (btn.classList.contains('nav-item')) {
      const view = btn.dataset.view;
      if (view) switchView(view);
      return;
    }

    // Mobile Nav Toggle
    if (btn.id === 'mobileNavToggle') {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.toggle('active');
      return;
    }

    // Dashboard View Button (bottom nav)
    if (btn.id === 'dashboardBtn' || (btn.onclick && btn.onclick.toString().includes('dashboard'))) {
      switchView('dashboard');
      return;
    }

    // Settings View Button (bottom nav)
    if (btn.id === 'settingsBtn' || (btn.onclick && btn.onclick.toString().includes('settings'))) {
      switchView('settings');
      return;
    }

    // Export Button
    if (btn.id === 'exportDataBtn') {
      exportData();
      return;
    }

    // License Activation
    if (btn.id === 'activateLicenseBtn') {
      handleActivation();
      return;
    }

    // License Deactivation
    if (btn.id === 'deactivateLicenseBtn') {
      handleDeactivation();
      return;
    }

    // Upgrade Button
    if (btn.id === 'upgradeBtn') {
      switchView('license');
      return;
    }

    // NER Unlock Button
    if (btn.id === 'nerUnlockBtn') {
      switchView('license');
      return;
    }

    // Buy License Link
    if (btn.id === 'buyLicenseLink') {
      e.preventDefault();
      const checkoutURL = 'https://lemonsqueezy.com/checkout/guardian-angle-pro';
      chrome.tabs.create({ url: checkoutURL });
      return;
    }
  });

  // Toggle Switches (Change events)
  document.body.addEventListener('change', (e) => {
    const target = e.target;
    console.log('[Popup] Change detected on:', target);

    // Enable Toggle
    if (target.id === 'enableToggle') {
      saveSetting('enabled', target.checked);
      return;
    }

    // NER Toggle
    if (target.id === 'nerToggle') {
      saveSetting('nerEnabled', target.checked);
      updateNERStatus(target.checked);
      return;
    }

    // Settings Inputs
    if (target.id === 'autoMask') {
      saveSetting('autoMask', target.checked);
      return;
    }

    if (target.id === 'blockOnDetection') {
      saveSetting('blockOnDetection', target.checked);
      return;
    }

    // PII Checkboxes
    if (target.closest('.pii-check')) {
      // Re-query all checkboxes state
      const checkboxes = document.querySelectorAll('.pii-check input');
      const enabledTypes = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      saveSetting('enabledPIITypes', enabledTypes);
    }
  });

  // Real-time Storage Updates
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        state.settings = newSettings;
        state.stats = newSettings.stats || {};
        state.isPro = newSettings.proEnabled || false;
        renderDashboard();
        renderSettings();
        renderLicense();
      }
    }
  });
}

/**
 * Switch Active View
 */
function switchView(viewName) {
  // Update Nav
  elements.navItems.forEach(btn => {
    if (btn.dataset.view === viewName) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Update Views
  elements.views.forEach(view => {
    if (view.id === `view-${viewName}`) view.classList.add('active');
    else view.classList.remove('active');
  });
}

/**
 * Save Setting to Storage
 */
async function saveSetting(key, value) {
  state.settings[key] = value;
  await chrome.storage.local.set({ settings: state.settings });
}

function updateNERStatus(enabled) {
  if (elements.nerStatusChip) {
    elements.nerStatusChip.textContent = enabled ? 'NER: Active' : 'NER: Disabled';
    elements.nerStatusChip.style.opacity = enabled ? '1' : '0.5';
    // Ideally check actual status from background, but UI feedback is immediate here
  }
}

/**
 * Render License View
 */
function renderLicense() {
  if (!elements.licenseActivationForm || !elements.licenseInfoView) return;

  if (state.isPro) {
    // Show Pro License Info
    elements.licenseActivationForm.style.display = 'none';
    elements.licenseInfoView.style.display = 'block';

    // Update license details
    const customerName = document.getElementById('licenseCustomerName');
    const customerEmail = document.getElementById('licenseCustomerEmail');

    if (customerName) customerName.textContent = state.settings.licenseCustomerName || '-';
    if (customerEmail) customerEmail.textContent = state.settings.licenseCustomerEmail || '-';
  } else {
    // Show Activation Form
    elements.licenseActivationForm.style.display = 'block';
    elements.licenseInfoView.style.display = 'none';

    // Reset form
    if (elements.licenseKeyInput) elements.licenseKeyInput.value = '';
    if (elements.licenseError) elements.licenseError.style.display = 'none';
    if (elements.licenseSuccess) elements.licenseSuccess.style.display = 'none';
  }

  // Update tier badge
  if (elements.tierBadge) {
    elements.tierBadge.textContent = state.isPro ? 'Pro' : 'Free';
    elements.tierBadge.className = `tier-badge ${state.isPro ? 'pro' : 'free'}`;
  }

  // Show/hide upgrade button
  if (elements.upgradeBtn) {
    elements.upgradeBtn.style.display = state.isPro ? 'none' : 'block';
  }

  // Update feature locks
  updateFeatureLocks();
}

/**
 * Update Feature Locks based on tier
 */
function updateFeatureLocks() {
  const nerLock = document.getElementById('nerLockOverlay');
  const nerBadge = document.getElementById('nerProBadge');
  const nerToggle = document.getElementById('nerToggle');

  if (nerLock) {
    nerLock.style.display = state.isPro ? 'none' : 'flex';
  }

  if (nerBadge) {
    nerBadge.style.display = state.isPro ? 'none' : 'inline-block';
  }

  if (nerToggle) {
    nerToggle.disabled = !state.isPro;
  }

  // Add click handler to unlock button
  const unlockBtn = document.getElementById('nerUnlockBtn');
  if (unlockBtn) {
    unlockBtn.onclick = () => {
      switchView('license');
    };
  }
}

/**
 * Handle License Activation
 */
async function handleActivation() {
  const licenseKey = elements.licenseKeyInput.value.trim();

  if (!licenseKey) {
    showLicenseError('Please enter a license key');
    return;
  }

  // Show loading state
  const btn = elements.activateLicenseBtn;
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  btn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-flex';
  elements.licenseError.style.display = 'none';
  elements.licenseSuccess.style.display = 'none';

  try {
    // Import license validation
    const { activateLicense } = await import('../utils/licenseValidation.js');
    const result = await activateLicense(licenseKey);

    if (result.success) {
      // Show success
      elements.licenseSuccess.textContent = 'License activated successfully!';
      elements.licenseSuccess.style.display = 'block';

      // Update state
      state.isPro = true;
      state.settings.proEnabled = true;
      state.settings.licenseKey = licenseKey;

      if (result.customer) {
        state.settings.licenseCustomerName = result.customer.name;
        state.settings.licenseCustomerEmail = result.customer.email;
      }

      // Reload tier info
      await loadTierInfo();

      // Re-render
      setTimeout(() => {
        renderLicense();
      }, 1500);
    } else {
      showLicenseError(result.error || 'Activation failed');
    }
  } catch (error) {
    console.error('[License] Activation error:', error);
    showLicenseError(error.message || 'Activation failed');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
  }
}

/**
 * Handle License Deactivation
 */
async function handleDeactivation() {
  if (!confirm('Are you sure you want to deactivate your Pro license?')) {
    return;
  }

  try {
    const { deactivateLicense } = await import('../utils/licenseValidation.js');
    await deactivateLicense();

    // Update state
    state.isPro = false;
    state.settings.proEnabled = false;
    state.settings.licenseKey = null;
    state.settings.licenseCustomerName = null;
    state.settings.licenseCustomerEmail = null;

    // Reload tier info
    await loadTierInfo();

    // Re-render
    renderLicense();

    alert('License deactivated successfully');
  } catch (error) {
    console.error('[License] Deactivation error:', error);
    alert('Failed to deactivate license: ' + error.message);
  }
}

/**
 * Show License Error
 */
function showLicenseError(msg) {
  if (elements.licenseError) {
    elements.licenseError.textContent = msg;
    elements.licenseError.style.display = 'block';
  }
  if (elements.licenseSuccess) {
    elements.licenseSuccess.style.display = 'none';
  }
}

/**
 * Format Number
 */
function formatNumber(num) {
  return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num;
}

/**
 * Export Data
 */
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.stats));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "pii-guardian-logs.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

/**
 * Render Critical Error UI
 */
function renderError(message) {
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      background: var(--bg-primary);
      color: var(--text-primary);
      text-align: center;
    ">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom: 20px;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2 style="font-size: 20px; margin-bottom: 10px;">Extension Error</h2>
      <p style="color: var(--text-secondary); max-width: 400px;">${message}</p>
      <button 
        onclick="chrome.runtime.reload()" 
        style="
          margin-top: 20px;
          padding: 10px 20px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        "
      >
        Reload Extension
      </button>
    </div>
  `;
}

// Global Error Handler
window.addEventListener('error', (event) => {
  console.error('Global Error caught:', event.error);
  // Only take over UI if body is empty or init failed
  if (!document.querySelector('.app-layout')) {
    renderError(event.error?.message || 'Unknown error');
  }
});

// Run Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch(e => renderError(e.message)));
} else {
  init().catch(e => renderError(e.message));
}
