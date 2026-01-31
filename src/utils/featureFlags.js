// Feature flags for tier differentiation
// This file controls which features are available in Free vs Pro tiers

export const TIER = process.env.EXTENSION_TIER || 'free'; // 'free' or 'pro'

export const FEATURES = {
    // Detection capabilities
    NER_MODEL: TIER === 'pro',
    OCR_DETECTION: TIER === 'pro',
    HYBRID_DETECTION: TIER === 'pro',

    // UI features
    UNLIMITED_HISTORY: TIER === 'pro',
    EXPORT_REPORTS: TIER === 'pro',
    CUSTOM_RULES: TIER === 'pro',
    AUTO_MASKING: TIER === 'pro',
    ADVANCED_SETTINGS: TIER === 'pro',
    DETECTION_HISTORY: TIER === 'pro',

    // Limits
    DAILY_SCAN_LIMIT: TIER === 'free' ? 50 : Infinity,
    MAX_ACTIVE_SITES: TIER === 'free' ? 5 : Infinity,
    HISTORY_LIMIT: TIER === 'free' ? 10 : Infinity,

    // Support
    PRIORITY_SUPPORT: TIER === 'pro',
    FEATURE_REQUESTS: TIER === 'pro'
};

// Tier information
export const TIER_INFO = {
    name: TIER === 'pro' ? 'Guardian Angle Pro' : 'Guardian Angle - Free',
    version: TIER,
    isPro: TIER === 'pro',
    isFree: TIER === 'free',
    features: Object.keys(FEATURES).filter(key => FEATURES[key] === true)
};

// Check if a feature is enabled
export function isFeatureEnabled(featureName) {
    return FEATURES[featureName] === true || FEATURES[featureName] === Infinity;
}

// Get feature limit
export function getFeatureLimit(featureName) {
    return FEATURES[featureName];
}

// Log tier info (for debugging)
if (typeof console !== 'undefined') {
    console.log(`[Guardian Angle] Running in ${TIER.toUpperCase()} tier`);
    console.log(`[Guardian Angle] Enabled features:`, TIER_INFO.features);
}
