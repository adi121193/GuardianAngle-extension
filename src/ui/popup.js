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
  try {
    // Initialize DOM Elements
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
      exportBtn: document.getElementById('exportDataBtn'),

      // Settings Inputs
      settings: {
        autoMask: document.getElementById('autoMask'),
        blockOnDetection: document.getElementById('blockOnDetection'),
        piiChecks: document.querySelectorAll('.pii-check input')
      },

      // License UI
      license: {
        input: document.getElementById('licenseKeyInput'),
        btn: document.getElementById('activateLicenseBtn'),
        error: document.getElementById('licenseError'),
        startForm: document.getElementById('activationStart'),
        successDiv: document.getElementById('activationSuccess')
      }
    };

    console.log('DOM Initialized', elements);

    // Load Data
    const [settingsRes, statsRes] = await Promise.all([
      chrome.storage.local.get(['settings']),
      chrome.runtime.sendMessage({ type: 'GET_STATS' })
    ]);

    state.settings = settingsRes.settings || {};
    state.stats = statsRes.stats || {};
    state.isPro = state.settings.proEnabled || false;

    renderDashboard();
    renderSettings();
    renderLicense();
    attachListeners();

    // Check query param to open specific view
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view');
    if (initialView) {
      switchView(initialView);
    }
  } catch (e) {
    console.error('Init failed', e);
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
function attachListeners() {
  // Navigation
  elements.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      switchView(viewId);
    });
  });

  // Open Dashboard (New Tab)
  if (elements.dashboardBtn) {
    elements.dashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'html/popup.html' });
    });
  }

  // Toggles
  elements.enableToggle.addEventListener('change', (e) => saveSetting('enabled', e.target.checked));
  elements.nerToggle.addEventListener('change', (e) => {
    saveSetting('nerEnabled', e.target.checked);
    updateNERStatus(e.target.checked);
    // Simple IPC to background
    chrome.runtime.sendMessage({ type: e.target.checked ? 'INIT_NER' : 'DISPOSE_NER' });
  });

  // Settings Inputs
  elements.settings.autoMask.addEventListener('change', (e) => saveSetting('autoMask', e.target.checked));
  elements.settings.blockOnDetection.addEventListener('change', (e) => saveSetting('blockOnDetection', e.target.checked));

  elements.settings.piiChecks.forEach(cb => {
    cb.addEventListener('change', () => {
      // Aggregate all checked values
      const newTypes = Array.from(elements.settings.piiChecks)
        .filter(c => c.checked)
        .map(c => c.value);
      saveSetting('enabledTypes', newTypes);
    });
  });

  // Export
  if (elements.exportBtn) elements.exportBtn.addEventListener('click', exportData);

  // License
  if (elements.license.btn) {
    elements.license.btn.addEventListener('click', handleActivation);
  }

  // Real-time Updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        // Update State
        state.settings = newSettings;
        state.stats = newSettings.stats || {};
        state.isPro = newSettings.proEnabled || false;

        // Re-render
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
  if (!elements.license.successDiv) return;

  if (state.isPro) {
    // Show Success State
    elements.license.startForm.style.display = 'none';
    elements.license.successDiv.style.display = 'block';
  } else {
    // Show Form
    elements.license.startForm.style.display = 'block';
    elements.license.successDiv.style.display = 'none';
    elements.license.input.value = '';
    elements.license.error.style.display = 'none';
  }
}

/**
 * Handle Activation
 */
async function handleActivation() {
  const key = elements.license.input.value.trim();

  // Basic Validation
  if (!key || key.length < 5) {
    showLicenseError('Please enter a valid license key');
    return;
  }

  elements.license.btn.innerText = 'Verifying...';
  elements.license.btn.disabled = true;

  // Simulate Network Request (Mock for now, replacing with API later)
  setTimeout(async () => {
    // Mock Success Pattern: "PRO-"
    if (key.toUpperCase().startsWith('PRO-')) {
      state.isPro = true;
      state.settings.proEnabled = true;
      state.settings.licenseKey = key;
      state.settings.licenseExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 Year

      await chrome.storage.local.set({ settings: state.settings });

      // Re-render
      renderLicense();

      // Feedback
      elements.license.btn.innerText = 'Activated';
    } else {
      showLicenseError('Invalid license key. Try "PRO-DEMO"');
      elements.license.btn.disabled = false;
      elements.license.btn.innerText = 'Activate Now';
    }
  }, 1500);
}

function showLicenseError(msg) {
  elements.license.error.textContent = msg;
  elements.license.error.style.display = 'block';
}



function formatNumber(num) {
  return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num;
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.stats));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "pii_guardian_logs.json");
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
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px;
      background: #0f172a;
      color: #f8fafc;
      font-family: system-ui, sans-serif;
    ">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" style="margin-bottom: 24px;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2 style="font-size: 24px; margin-bottom: 16px;">Guardian Down</h2>
      <p style="color: #94a3b8; max-width: 300px; margin-bottom: 32px; line-height: 1.6;">
        Something went wrong initializing the dashboard.<br>
        <code style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 4px; font-size: 12px; display: block; margin-top: 12px;">${message}</code>
      </p>
      <button onclick="window.location.reload()" style="
        background: #10b981;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      ">
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
