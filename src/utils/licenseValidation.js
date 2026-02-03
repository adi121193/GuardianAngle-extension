/**
 * License Validation Module
 * Handles license validation with LemonSqueezy API + offline RSA fallback
 *
 * Primary: LemonSqueezy API validation (online)
 * Fallback: RSA signature validation (offline)
 *
 * License Format: PIIGUARD::PRO::<expiryISO>::<base64-signature>
 * Example: PIIGUARD::PRO::2026-01-01T00:00:00Z::aGVsbG93b3JsZA==
 */

import { verifySignature } from './crypto.js';
import { setProStatus, getSettings, updateSettings } from './storage.js';
import {
  validateLemonSqueezyLicense,
  activateLemonSqueezyLicense,
  deactivateLemonSqueezyLicense,
  getStoredLicense,
  needsRevalidation
} from './lemonSqueezyAPI.js';

/**
 * License key prefix
 */
const LICENSE_PREFIX = 'PIIGUARD';
const LICENSE_PRODUCT = 'PRO';

/**
 * Parse license key
 * @param {string} licenseKey - Raw license key
 * @returns {Object|null} Parsed license data or null if invalid
 */
export function parseLicenseKey(licenseKey) {
  try {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return null;
    }

    const parts = licenseKey.trim().split('::');

    if (parts.length !== 4) {
      return null;
    }

    const [prefix, product, expiry, signature] = parts;

    if (prefix !== LICENSE_PREFIX) {
      return null;
    }

    if (product !== LICENSE_PRODUCT) {
      return null;
    }

    // Validate expiry is a valid ISO date
    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      return null;
    }

    return {
      prefix,
      product,
      expiry,
      expiryDate,
      signature,
      payload: `${prefix}::${product}::${expiry}`
    };
  } catch (error) {
    console.error('Failed to parse license key:', error);
    return null;
  }
}

/**
 * Check if license is expired
 * @param {Date} expiryDate - License expiry date
 * @returns {boolean}
 */
export function isLicenseExpired(expiryDate) {
  const now = new Date();
  return now > expiryDate;
}

/**
 * Validate license key (Hybrid: LemonSqueezy + RSA fallback)
 * @param {string} licenseKey - License key to validate
 * @param {boolean} forceOffline - Force offline validation
 * @returns {Promise<Object>} Validation result
 */
export async function validateLicense(licenseKey, forceOffline = false) {
  const result = {
    valid: false,
    error: null,
    product: null,
    expiry: null,
    daysRemaining: null,
    source: null // 'lemonsqueezy' or 'offline'
  };

  // ---------------------------------------------------------
  // 🧪 TEST KEY BYPASS
  // ---------------------------------------------------------
  if (licenseKey === 'TEST-PRO-LICENSE-2026') {
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + 30); // Valid for 30 days

    result.valid = true;
    result.product = 'PRO';
    result.expiry = expiry.toISOString();
    result.daysRemaining = 30;
    result.source = 'test-bypass';
    return result;
  }

  try {
    // 1. Online Validation (LemonSqueezy)
    if (!forceOffline) {
      const lsValidation = await validateLemonSqueezyLicense(licenseKey);

      if (lsValidation.valid) {
        // LemonSqueezy validation successful
        result.valid = true;
        result.product = lsValidation.product.name;
        result.expiry = lsValidation.expiresAt;
        result.source = 'lemonsqueezy';
        result.customerEmail = lsValidation.customer.email;
        result.customerName = lsValidation.customer.name;

        // Calculate days remaining
        if (lsValidation.expiresAt) {
          const expiryDate = new Date(lsValidation.expiresAt);
          const now = new Date();
          const msRemaining = expiryDate.getTime() - now.getTime();
          result.daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        }

        return result;
      }

      // If LemonSqueezy validation failed but not due to network, return error
      if (!lsValidation.offline) {
        result.error = lsValidation.error;
        return result;
      }

      // Network error - fall through to offline validation
      console.log('[License] LemonSqueezy offline, using RSA fallback');
    }

    // Fallback to offline RSA validation
    const parsed = parseLicenseKey(licenseKey);

    if (!parsed) {
      result.error = 'Invalid license key format';
      return result;
    }

    // Check if expired
    if (isLicenseExpired(parsed.expiryDate)) {
      result.error = 'License has expired';
      result.expiry = parsed.expiry;
      return result;
    }

    // Verify signature
    const signatureValid = await verifySignature(parsed.payload, parsed.signature);

    if (!signatureValid) {
      result.error = 'Invalid license signature';
      return result;
    }

    // Calculate days remaining
    const now = new Date();
    const msRemaining = parsed.expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    // License is valid (offline)
    result.valid = true;
    result.product = parsed.product;
    result.expiry = parsed.expiry;
    result.daysRemaining = daysRemaining;
    result.source = 'offline';

    return result;
  } catch (error) {
    console.error('License validation error:', error);
    result.error = 'Validation failed: ' + error.message;
    return result;
  }
}

/**
 * Activate Pro license (LemonSqueezy)
 * @param {string} licenseKey - License key to activate
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(licenseKey) {
  // ---------------------------------------------------------
  // 🧪 TEST KEY BYPASS
  if (licenseKey === 'TEST-PRO-LICENSE-2026') {
    console.log('[License] Activating TEST KEY bypass...');
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);

    // Explicitly set verified status
    await updateSettings({
      licenseStatus: 'active',
      proEnabled: true, // Force this flag too
      licenseKey: licenseKey,
      licenseExpiry: expiry.toISOString(),
      tier: 'pro'
    });

    // Double check it saved
    console.log('[License] Test key activated. Settings updated.');

    return {
      success: true,
      license: {
        key: licenseKey,
        status: 'active',
        plan: 'pro',
        expires_at: expiry.toISOString()
      }
    };
  }

  // Try LemonSqueezy activation first
  const lsActivation = await activateLemonSqueezyLicense(licenseKey);

  if (lsActivation.activated) {
    return {
      success: true,
      customer: lsActivation.customer,
      source: 'lemonsqueezy'
    };
  }

  // Fallback to offline validation
  const validation = await validateLicense(licenseKey, true);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || lsActivation.error
    };
  }

  // Save to storage (offline mode)
  await setProStatus(true, licenseKey, validation.expiry);

  return {
    success: true,
    product: validation.product,
    expiry: validation.expiry,
    daysRemaining: validation.daysRemaining,
    source: 'offline'
  };
}

/**
 * Deactivate Pro license
 * @returns {Promise<void>}
 */
export async function deactivateLicense() {
  // Try LemonSqueezy deactivation
  const stored = await getStoredLicense();
  if (stored && stored.instanceId) {
    await deactivateLemonSqueezyLicense(stored.licenseKey, stored.instanceId);
  }

  // Clear local storage
  await setProStatus(false, null, null);
}

/**
 * Check current license status (with periodic revalidation)
 * @returns {Promise<Object>} License status
 */
export async function checkLicenseStatus() {
  // ---------------------------------------------------------
  // 🧪 TEST KEY BYPASS (Double Check)
  // ---------------------------------------------------------
  const currentSettings = await getSettings();
  if (currentSettings.licenseKey === 'TEST-PRO-LICENSE-2026') {
    return {
      active: true,
      product: 'PRO',
      expiry: currentSettings.licenseExpiry,
      daysRemaining: 30, // Approximate
      source: 'test-bypass'
    };
  }

  // Check LemonSqueezy stored license first
  const storedLicense = await getStoredLicense();

  if (storedLicense) {
    // Check if needs revalidation (every 24 hours)
    if (needsRevalidation(storedLicense)) {
      console.log('[License] Revalidating with LemonSqueezy...');
      const validation = await validateLicense(storedLicense.licenseKey);

      if (!validation.valid) {
        // License no longer valid, deactivate
        await deactivateLicense();
        return {
          active: false,
          product: null,
          expiry: null,
          daysRemaining: null,
          error: validation.error
        };
      }
    }

    // License is valid
    return {
      active: true,
      product: storedLicense.productName,
      expiry: storedLicense.expiresAt,
      daysRemaining: calculateDaysRemaining(storedLicense.expiresAt),
      customerEmail: storedLicense.customerEmail,
      source: 'lemonsqueezy'
    };
  }

  // Fallback to old storage format
  const settings = await getSettings();

  if (!settings.proEnabled || !settings.licenseKey) {
    return {
      active: false,
      product: null,
      expiry: null,
      daysRemaining: null
    };
  }

  // Validate stored license
  const validation = await validateLicense(settings.licenseKey);

  // If stored license is invalid/expired, deactivate
  if (!validation.valid) {
    await deactivateLicense();
    return {
      active: false,
      product: null,
      expiry: null,
      daysRemaining: null,
      error: validation.error
    };
  }

  return {
    active: true,
    product: validation.product,
    expiry: validation.expiry,
    daysRemaining: validation.daysRemaining,
    source: validation.source
  };
}

/**
 * Calculate days remaining until expiry
 * @param {string} expiryISO - Expiry date in ISO format
 * @returns {number|null} Days remaining or null
 */
function calculateDaysRemaining(expiryISO) {
  if (!expiryISO) return null;

  const expiryDate = new Date(expiryISO);
  const now = new Date();
  const msRemaining = expiryDate.getTime() - now.getTime();

  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

/**
 * Generate license key (server-side only - not included in extension)
 * This is for reference/documentation purposes
 *
 * @param {string} product - Product type (e.g., 'PRO')
 * @param {string} expiryISO - Expiry date in ISO format
 * @param {string} privateKeyPEM - Private key in PEM format
 * @returns {Promise<string>} License key
 */
export async function generateLicenseKey_ServerOnly(product, expiryISO, privateKeyPEM) {
  // This function should only be run on a secure server, never in the extension
  throw new Error('This function should only be used on a secure server for license generation');

  /*
  // Server-side implementation reference:

  const crypto = require('crypto');

  const payload = `${LICENSE_PREFIX}::${product}::${expiryISO}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(payload);
  sign.end();

  const signature = sign.sign(privateKeyPEM, 'base64');

  const licenseKey = `${payload}::${signature}`;

  return licenseKey;
  */
}

/**
 * Get license expiry warning
 * @param {number} daysRemaining - Days remaining until expiry
 * @returns {string|null} Warning message or null
 */
export function getLicenseExpiryWarning(daysRemaining) {
  if (daysRemaining <= 0) {
    return 'Your license has expired';
  }

  if (daysRemaining <= 7) {
    return `Your license expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  }

  if (daysRemaining <= 30) {
    return `Your license expires in ${daysRemaining} days`;
  }

  return null;
}

/**
 * Validate license format (quick check without signature verification)
 * @param {string} licenseKey - License key
 * @returns {boolean}
 */
export function isValidLicenseFormat(licenseKey) {
  const parsed = parseLicenseKey(licenseKey);
  return parsed !== null;
}
