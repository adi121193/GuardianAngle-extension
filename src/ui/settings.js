import { getSettings, saveSettings, resetSettings, resetStats, exportData } from '../utils/storage.js';

async function init() {
  const settings = await getSettings();

  // Load settings into UI
  document.getElementById('autoMask').checked = settings.autoMask;
  document.getElementById('blockOnDetection').checked = settings.blockOnDetection;
  document.getElementById('notificationSound').checked = settings.notificationSound;
  document.getElementById('minConfidence').value = settings.minConfidence * 100;
  document.getElementById('confidenceValue').textContent = Math.round(settings.minConfidence * 100);

  // Load enabled PII types
  document.querySelectorAll('.pii-type').forEach(checkbox => {
    checkbox.checked = settings.enabledPIITypes.includes(checkbox.value);
  });

  // Load NER settings
  document.getElementById('nerEnabled').checked = settings.nerEnabled !== false;
  document.getElementById('detectionMode').value = settings.detectionMode || 'hybrid';
  document.getElementById('nerAutoInit').checked = settings.nerAutoInit || false;

  // Load Advanced settings (history scanning)
  document.getElementById('scanHistory').checked = settings.scanHistory || false;
  document.getElementById('scanHistoryDepth').value = settings.scanHistoryDepth || 50;

  // Check NER status
  checkNERStatus();

  // Event listeners
  document.getElementById('minConfidence').addEventListener('input', (e) => {
    document.getElementById('confidenceValue').textContent = e.target.value;
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const enabledTypes = Array.from(document.querySelectorAll('.pii-type:checked')).map(cb => cb.value);

    settings.autoMask = document.getElementById('autoMask').checked;
    settings.blockOnDetection = document.getElementById('blockOnDetection').checked;
    settings.notificationSound = document.getElementById('notificationSound').checked;
    settings.minConfidence = document.getElementById('minConfidence').value / 100;
    settings.enabledPIITypes = enabledTypes;

    // Save NER settings
    settings.nerEnabled = document.getElementById('nerEnabled').checked;
    settings.detectionMode = document.getElementById('detectionMode').value;
    settings.nerAutoInit = document.getElementById('nerAutoInit').checked;

    // Save Advanced settings (history scanning)
    settings.scanHistory = document.getElementById('scanHistory').checked;
    settings.scanHistoryDepth = parseInt(document.getElementById('scanHistoryDepth').value, 10);

    await saveSettings(settings);
    alert('Settings saved!');
  });

  document.getElementById('resetStatsBtn').addEventListener('click', async () => {
    if (confirm('Reset all statistics?')) {
      await resetStats();
      alert('Statistics reset!');
    }
  });

  document.getElementById('exportDataBtn').addEventListener('click', async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pii-guardian-backup.json';
    a.click();
  });

  document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults?')) {
      await resetSettings();
      alert('Settings reset!');
      window.location.reload();
    }
  });

  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });

  // NER initialization button
  document.getElementById('initNerBtn').addEventListener('click', async () => {
    const btn = document.getElementById('initNerBtn');
    const statusValue = document.getElementById('nerStatusValue');

    btn.disabled = true;
    btn.textContent = 'Initializing...';
    statusValue.textContent = 'Initializing...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'INIT_NER' });

      if (response && response.success) {
        // Success - update UI and refresh settings to reflect persisted state
        statusValue.textContent = 'Ready ✅';
        statusValue.style.color = '#10b981';
        btn.textContent = 'Initialized';
        btn.style.display = 'none';

        // Reload settings from storage to get the updated nerModelDownloaded flag
        setTimeout(() => {
          chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
              console.log('[Settings] NER model downloaded:', result.settings.nerModelDownloaded);
            }
          });
          checkNERStatus();
        }, 500);
      } else {
        statusValue.textContent = 'Failed ❌';
        statusValue.style.color = '#ef4444';
        btn.disabled = false;
        btn.textContent = 'Retry';
      }
    } catch (error) {
      console.error('NER init error:', error);
      statusValue.textContent = 'Error ❌';
      statusValue.style.color = '#ef4444';
      btn.disabled = false;
      btn.textContent = 'Retry';
    }
  });
}

/**
 * Check NER model status
 */
async function checkNERStatus() {
  const statusValue = document.getElementById('nerStatusValue');
  const initBtn = document.getElementById('initNerBtn');

  try {
    // Try to get status from background script
    const response = await chrome.runtime.sendMessage({ type: 'NER_STATUS' });

    if (response && response.isReady) {
      statusValue.textContent = 'Ready ✅';
      statusValue.style.color = '#10b981';
      initBtn.style.display = 'none';
    } else if (response && response.isInitializing) {
      statusValue.textContent = 'Initializing...';
      statusValue.style.color = '#f59e0b';
      initBtn.disabled = true;
    } else {
      statusValue.textContent = 'Not initialized';
      statusValue.style.color = '#6b7280';
      initBtn.style.display = 'inline-block';
      initBtn.disabled = false;
    }
  } catch (error) {
    // Background script might not have NER status handler yet
    statusValue.textContent = 'Unknown';
    statusValue.style.color = '#6b7280';
  }
}

document.addEventListener('DOMContentLoaded', init);
