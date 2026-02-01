/**
 * LemonSqueezy API Integration
 * Handles license verification and subscription management
 * 
 * Docs: https://docs.lemonsqueezy.com/api
 */

const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';

// TODO: Replace with your actual LemonSqueezy credentials
const LEMONSQUEEZY_STORE_ID = 'YOUR_STORE_ID_HERE';
const LEMONSQUEEZY_API_KEY = 'YOUR_API_KEY_HERE'; // Keep this secure!

/**
 * Validate license key with LemonSqueezy
 * @param {string} licenseKey - License key to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateLemonSqueezyLicense(licenseKey) {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/licenses/validate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_id: await getInstanceId() // Unique browser instance ID
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                valid: false,
                error: data.error || 'License validation failed'
            };
        }

        // LemonSqueezy response structure
        if (data.valid) {
            return {
                valid: true,
                licenseKey: data.license_key.key,
                status: data.license_key.status, // 'active', 'inactive', 'expired', 'disabled'
                activationLimit: data.license_key.activation_limit,
                activationUsage: data.license_key.activation_usage,
                expiresAt: data.license_key.expires_at,
                customer: {
                    name: data.meta.customer_name,
                    email: data.meta.customer_email
                },
                product: {
                    name: data.meta.product_name,
                    id: data.meta.variant_id
                },
                instance: {
                    id: data.instance.id,
                    name: data.instance.name
                }
            };
        }

        return {
            valid: false,
            error: data.error || 'Invalid license key'
        };
    } catch (error) {
        console.error('[LemonSqueezy] Validation error:', error);
        return {
            valid: false,
            error: 'Network error: ' + error.message,
            offline: true // Flag for offline fallback
        };
    }
}

/**
 * Activate license instance
 * @param {string} licenseKey - License key
 * @param {string} instanceName - Instance name (e.g., "Chrome Browser")
 * @returns {Promise<Object>} Activation result
 */
export async function activateLemonSqueezyLicense(licenseKey, instanceName = 'Chrome Browser') {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/licenses/activate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_name: instanceName
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                activated: false,
                error: data.error || 'Activation failed'
            };
        }

        if (data.activated) {
            // Store license data
            await storeLicenseData({
                licenseKey: data.license_key.key,
                instanceId: data.instance.id,
                instanceName: data.instance.name,
                status: data.license_key.status,
                expiresAt: data.license_key.expires_at,
                customerEmail: data.meta.customer_email,
                customerName: data.meta.customer_name,
                productName: data.meta.product_name,
                activatedAt: new Date().toISOString()
            });

            return {
                activated: true,
                instance: data.instance,
                customer: {
                    name: data.meta.customer_name,
                    email: data.meta.customer_email
                }
            };
        }

        return {
            activated: false,
            error: 'Activation failed'
        };
    } catch (error) {
        console.error('[LemonSqueezy] Activation error:', error);
        return {
            activated: false,
            error: 'Network error: ' + error.message
        };
    }
}

/**
 * Deactivate license instance
 * @param {string} licenseKey - License key
 * @param {string} instanceId - Instance ID to deactivate
 * @returns {Promise<Object>} Deactivation result
 */
export async function deactivateLemonSqueezyLicense(licenseKey, instanceId) {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/licenses/deactivate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`
            },
            body: JSON.stringify({
                license_key: licenseKey,
                instance_id: instanceId
            })
        });

        const data = await response.json();

        if (data.deactivated) {
            await clearLicenseData();
            return {
                deactivated: true
            };
        }

        return {
            deactivated: false,
            error: data.error || 'Deactivation failed'
        };
    } catch (error) {
        console.error('[LemonSqueezy] Deactivation error:', error);
        return {
            deactivated: false,
            error: 'Network error: ' + error.message
        };
    }
}

/**
 * Check subscription status
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Subscription status
 */
export async function checkSubscriptionStatus(subscriptionId) {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/subscriptions/${subscriptionId}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`
            }
        });

        const data = await response.json();

        if (response.ok && data.data) {
            const subscription = data.data.attributes;
            return {
                active: subscription.status === 'active',
                status: subscription.status, // 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired'
                renewsAt: subscription.renews_at,
                endsAt: subscription.ends_at,
                trialEndsAt: subscription.trial_ends_at,
                productName: subscription.product_name,
                variantName: subscription.variant_name
            };
        }

        return {
            active: false,
            error: 'Subscription not found'
        };
    } catch (error) {
        console.error('[LemonSqueezy] Subscription check error:', error);
        return {
            active: false,
            error: 'Network error: ' + error.message
        };
    }
}

/**
 * Get or create unique instance ID for this browser
 * @returns {Promise<string>} Instance ID
 */
async function getInstanceId() {
    const stored = await chrome.storage.local.get('instanceId');

    if (stored.instanceId) {
        return stored.instanceId;
    }

    // Generate new instance ID
    const instanceId = `chrome-${crypto.randomUUID()}`;
    await chrome.storage.local.set({ instanceId });

    return instanceId;
}

/**
 * Store license data in chrome.storage
 * @param {Object} licenseData - License data to store
 */
async function storeLicenseData(licenseData) {
    await chrome.storage.local.set({
        proLicense: licenseData.licenseKey,
        proEnabled: true,
        licenseInstanceId: licenseData.instanceId,
        licenseStatus: licenseData.status,
        licenseExpiresAt: licenseData.expiresAt,
        licenseCustomerEmail: licenseData.customerEmail,
        licenseCustomerName: licenseData.customerName,
        licenseProductName: licenseData.productName,
        licenseActivatedAt: licenseData.activatedAt,
        licenseLastValidated: new Date().toISOString()
    });
}

/**
 * Clear license data from chrome.storage
 */
async function clearLicenseData() {
    await chrome.storage.local.remove([
        'proLicense',
        'proEnabled',
        'licenseInstanceId',
        'licenseStatus',
        'licenseExpiresAt',
        'licenseCustomerEmail',
        'licenseCustomerName',
        'licenseProductName',
        'licenseActivatedAt',
        'licenseLastValidated'
    ]);
}

/**
 * Get stored license data
 * @returns {Promise<Object|null>} License data or null
 */
export async function getStoredLicense() {
    const data = await chrome.storage.local.get([
        'proLicense',
        'proEnabled',
        'licenseInstanceId',
        'licenseStatus',
        'licenseExpiresAt',
        'licenseCustomerEmail',
        'licenseCustomerName',
        'licenseProductName',
        'licenseActivatedAt',
        'licenseLastValidated'
    ]);

    if (!data.proLicense || !data.proEnabled) {
        return null;
    }

    return {
        licenseKey: data.proLicense,
        instanceId: data.licenseInstanceId,
        status: data.licenseStatus,
        expiresAt: data.licenseExpiresAt,
        customerEmail: data.licenseCustomerEmail,
        customerName: data.licenseCustomerName,
        productName: data.licenseProductName,
        activatedAt: data.licenseActivatedAt,
        lastValidated: data.licenseLastValidated
    };
}

/**
 * Check if license needs revalidation
 * @param {Object} storedLicense - Stored license data
 * @returns {boolean} True if needs revalidation
 */
export function needsRevalidation(storedLicense) {
    if (!storedLicense || !storedLicense.lastValidated) {
        return true;
    }

    const lastValidated = new Date(storedLicense.lastValidated);
    const now = new Date();
    const hoursSinceValidation = (now - lastValidated) / (1000 * 60 * 60);

    // Revalidate every 24 hours
    return hoursSinceValidation >= 24;
}

/**
 * Get checkout URL for purchasing
 * @param {string} variantId - Product variant ID
 * @param {string} email - Customer email (optional)
 * @returns {string} Checkout URL
 */
export function getCheckoutURL(variantId, email = '') {
    const params = new URLSearchParams({
        checkout: variantId
    });

    if (email) {
        params.append('checkout[email]', email);
    }

    // Add custom data to track extension installs
    params.append('checkout[custom][source]', 'chrome-extension');

    return `https://${LEMONSQUEEZY_STORE_ID}.lemonsqueezy.com/checkout?${params.toString()}`;
}
