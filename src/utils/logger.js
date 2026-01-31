/**
 * Centralized logging utility for PII Guardian
 * Provides environment-aware logging with consistent formatting
 */

const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

// Detect if we're in extension context
const IS_EXTENSION = typeof chrome !== 'undefined' && chrome.runtime?.id;

export const logger = {
    /**
     * Error level - always logged
     */
    error: (...args) => {
        console.error('[PII Guardian ERROR]', ...args);
    },

    /**
     * Warning level - always logged
     */
    warn: (...args) => {
        console.warn('[PII Guardian WARN]', ...args);
    },

    /**
     * Info level - only in development
     */
    info: (...args) => {
        if (IS_DEV) {
            console.info('[PII Guardian INFO]', ...args);
        }
    },

    /**
     * Debug level - only in development
     */
    debug: (...args) => {
        if (IS_DEV) {
            console.log('[PII Guardian DEBUG]', ...args);
        }
    },

    /**
     * Performance timing
     */
    time: (label) => {
        if (IS_DEV) {
            console.time(`[PII Guardian] ${label}`);
        }
    },

    timeEnd: (label) => {
        if (IS_DEV) {
            console.timeEnd(`[PII Guardian] ${label}`);
        }
    }
};

// Export individual functions for tree-shaking
export const { error, warn, info, debug, time, timeEnd } = logger;
