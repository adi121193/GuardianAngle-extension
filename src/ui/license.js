import { activateLicense, deactivateLicense, checkLicenseStatus } from '../utils/licenseValidation.js';

async function init() {
  await loadLicenseStatus();

  document.getElementById('activateBtn').addEventListener('click', async () => {
    const licenseKey = document.getElementById('licenseKeyInput').value.trim();
    const statusMessage = document.getElementById('statusMessage');

    if (!licenseKey) {
      showMessage('Please enter a license key', 'error');
      return;
    }

    const result = await activateLicense(licenseKey);

    if (result.success) {
      showMessage('License activated successfully!', 'success');
      await loadLicenseStatus();
      document.getElementById('licenseKeyInput').value = '';
    } else {
      showMessage('Activation failed: ' + result.error, 'error');
    }
  });

  document.getElementById('deactivateBtn').addEventListener('click', async () => {
    if (confirm('Deactivate Pro license?')) {
      await deactivateLicense();
      showMessage('License deactivated', 'success');
      await loadLicenseStatus();
    }
  });

  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
}

async function loadLicenseStatus() {
  const status = await checkLicenseStatus();
  const currentSection = document.getElementById('currentLicenseSection');

  if (status.active) {
    currentSection.style.display = 'block';
    document.getElementById('licenseProduct').textContent = status.product;
    document.getElementById('licenseExpiry').textContent = new Date(status.expiry).toLocaleDateString();
    document.getElementById('licenseDaysRemaining').textContent = status.daysRemaining;
  } else {
    currentSection.style.display = 'none';
  }
}

function showMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.style.display = 'block';
  statusMessage.style.backgroundColor = type === 'success' ? '#e8f5e9' : '#ffebee';
  statusMessage.style.color = type === 'success' ? '#2e7d32' : '#c62828';
}

document.addEventListener('DOMContentLoaded', init);
