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
}

document.addEventListener('DOMContentLoaded', init);
