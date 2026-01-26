/**
 * License Activation Logic
 */

import { setProStatus, getProStatus } from '../utils/storage.js';

const elements = {
  licenseKey: document.getElementById('licenseKey'),
  activateBtn: document.getElementById('activateBtn'),
  errorMsg: document.getElementById('errorMsg'),
  activationForm: document.getElementById('activationForm'),
  successScreen: document.getElementById('successScreen'),
  closeBtn: document.getElementById('closeBtn')
};

/**
 * Initialize
 */
async function init() {
  const isPro = await getProStatus();
  if (isPro) {
    showSuccess();
  }

  elements.activateBtn.addEventListener('click', handleActivation);
  elements.closeBtn.addEventListener('click', () => window.close());

  elements.licenseKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleActivation();
  });
}

/**
 * Handle Activation Logic
 */
async function handleActivation() {
  const key = elements.licenseKey.value.trim();

  elements.activateBtn.textContent = 'Verifying...';
  elements.activateBtn.disabled = true;
  elements.errorMsg.style.display = 'none';

  // Simulate network delay
  await new Promise(r => setTimeout(r, 800));

  // Mock Validation Logic
  // Any key starting with 'PRO-' or 'TEST' is valid for MVP
  // In Phase 2: Call Supabase/Stripe API here
  const isValid = key.toUpperCase().startsWith('PRO-') || key.toUpperCase().startsWith('TEST');

  if (isValid) {
    // Save Pro Status
    // Expiry: 1 year from now
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);

    await setProStatus(true, key, expiry.toISOString());
    showSuccess();
  } else {
    elements.errorMsg.style.display = 'block';
    elements.activateBtn.textContent = 'Activate Now';
    elements.activateBtn.disabled = false;
    elements.licenseKey.classList.add('error-shake');
    setTimeout(() => elements.licenseKey.classList.remove('error-shake'), 500);
  }
}

function showSuccess() {
  elements.activationForm.style.display = 'none';
  elements.successScreen.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', init);
