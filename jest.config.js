/**
 * Jest Configuration for PII Guardian Extension
 * Supports ES modules, Chrome extension APIs, and JSDOM
 */

export default {
  // Use JSDOM environment to simulate browser
  testEnvironment: 'jsdom',

  // Support ES modules
  transform: {},

  // Module resolution
  moduleNameMapper: {
    // Mock Chrome APIs
    '^chrome$': '<rootDir>/tests/mocks/chrome.js',
  },

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/ml/offscreen.js', // Exclude offscreen (runs in worker)
    '!src/ml-test/**', // Exclude test pages
  ],

  // Coverage thresholds (start low, increase over time)
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 40,
      lines: 50
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/models/'
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,

  // Timeout for async tests
  testTimeout: 10000
};
