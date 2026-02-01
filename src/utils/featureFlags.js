/**
 * Feature Flags - Runtime License-Based Feature Gating
 * Controls which features are available based on license activation
 */

import { checkLicenseStatus } from './licenseValidation.js';

// Cache for license status (refreshed periodically)
let cachedLicenseStatus = null;
let lastCheck = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current tier based on license status
 * @returns {Promise<string>} 'free' or 'pro'
 */
export async function getTier() {
    const now = Date.now();

    // Use cache if fresh
    if (cachedLicenseStatus && (now - lastCheck) < CACHE_DURATION) {
        return cachedLicenseStatus.active ? 'pro' : 'free';
    }

    // Check license status
    try {
        const status = await checkLicenseStatus();
        cachedLicenseStatus = status;
        lastCheck = now;
        return status.active ? 'pro' : 'free';
    } catch (error) {
        console.error('[Feature Flags] Error checking license:', error);
        return 'free'; // Default to free on error
    }
}

/**
 * Get features based on tier
 * @param {string} tier - 'free' or 'pro'
 * @returns {Object} Feature flags
 */
function getFeaturesForTier(tier) {
    const isPro = tier === 'pro';

    return {
        // Detection capabilities
        NER_MODEL: isPro,
        OCR_DETECTION: isPro,
        HYBRID_DETECTION: isPro,

        // UI features
        UNLIMITED_HISTORY: isPro,
        EXPORT_REPORTS: isPro,
        CUSTOM_RULES: isPro,
        AUTO_MASKING: isPro,
        ADVANCED_SETTINGS: isPro,
        DETECTION_HISTORY: isPro,

        // Limits
        DAILY_SCAN_LIMIT: isPro ? Infinity : 50,
        MAX_ACTIVE_SITES: isPro ? Infinity : 5,
        HISTORY_LIMIT: isPro ? Infinity : 10,

        // Support
        PRIORITY_SUPPORT: isPro,
        FEATURE_REQUESTS: isPro
    };
}

/**
 * Get all features for current tier
 * @returns {Promise<Object>} Feature flags
 */
export async function getFeatures() {
    const tier = await getTier();
    return getFeaturesForTier(tier);
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature to check
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(featureName) {
    const features = await getFeatures();
    return features[featureName] === true || features[featureName] === Infinity;
}

/**
 * Get feature limit
 * @param {string} featureName - Feature to check
 * @returns {Promise<number|boolean>}
 */
export async function getFeatureLimit(featureName) {
    const features = await getFeatures();
    return features[featureName];
}

/**
 * Get tier information
 * @returns {Promise<Object>} Tier info
 */
export async function getTierInfo() {
    const tier = await getTier();
    const features = getFeaturesForTier(tier);
    const licenseStatus = cachedLicenseStatus || await checkLicenseStatus();

    return {
        name: tier === 'pro' ? 'Guardian Angle Pro' : 'Guardian Angle - Free',
        tier,
        isPro: tier === 'pro',
        isFree: tier === 'free',
        features: Object.keys(features).filter(key => features[key] === true),
        licenseExpiry: licenseStatus.expiry,
        daysRemaining: licenseStatus.daysRemaining
    };
}

/**
 * Force refresh license status
 * Call this after license activation/deactivation
 */
export async function refreshLicenseStatus() {
    cachedLicenseStatus = null;
    lastCheck = 0;
    return await getTier();
}

/**
 * Synchronous feature check (uses cache, may be stale)
 * Use only when async is not possible
 * @param {string} featureName - Feature to check
 * @returns {boolean}
 */
export function isFeatureEnabledSync(featureName) {
    if (!cachedLicenseStatus) {
        // No cache, assume free tier
        const features = getFeaturesForTier('free');
        return features[featureName] === true || features[featureName] === Infinity;
    }

    const tier = cachedLicenseStatus.active ? 'pro' : 'free';
    const features = getFeaturesForTier(tier);
    return features[featureName] === true || features[featureName] === Infinity;
}

// Initialize cache on load
(async () => {
    try {
        const tier = await getTier();
        console.log(`[Guardian Angle] Running in ${tier.toUpperCase()} tier`);
        const info = await getTierInfo();
        console.log(`[Guardian Angle] Enabled features:`, info.features);
        if (info.daysRemaining) {
            console.log(`[Guardian Angle] License expires in ${info.daysRemaining} days`);
        }
    } catch (error) {
        console.error('[Guardian Angle] Failed to initialize feature flags:', error);
    }
})();
