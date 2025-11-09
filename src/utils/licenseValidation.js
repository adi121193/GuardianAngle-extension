/**
 * License Validation Module
 * Handles offline license key validation using RSA signatures
 *
 * License Format: PIIGUARD::PRO::<expiryISO>::<base64-signature>
 * Example: PIIGUARD::PRO::2026-01-01T00:00:00Z::aGVsbG93b3JsZA==
 */

import { verifySignature } from './crypto.js';
import { setProStatus, getSettings } from './storage.js';

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
 * Validate license key
 * @param {string} licenseKey - License key to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateLicense(licenseKey) {
  const result = {
    valid: false,
    error: null,
    product: null,
    expiry: null,
    daysRemaining: null
  };

  try {
    // Parse license key
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

    // License is valid
    result.valid = true;
    result.product = parsed.product;
    result.expiry = parsed.expiry;
    result.daysRemaining = daysRemaining;

    return result;
  } catch (error) {
    console.error('License validation error:', error);
    result.error = 'Validation failed: ' + error.message;
    return result;
  }
}

/**
 * Activate Pro license
 * @param {string} licenseKey - License key to activate
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(licenseKey) {
  const validation = await validateLicense(licenseKey);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  // Save to storage
  await setProStatus(true, licenseKey, validation.expiry);

  return {
    success: true,
    product: validation.product,
    expiry: validation.expiry,
    daysRemaining: validation.daysRemaining
  };
}

/**
 * Deactivate Pro license
 * @returns {Promise<void>}
 */
export async function deactivateLicense() {
  await setProStatus(false, null, null);
}

/**
 * Check current license status
 * @returns {Promise<Object>} License status
 */
export async function checkLicenseStatus() {
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
    daysRemaining: validation.daysRemaining
  };
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
