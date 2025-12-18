/**
 * Jest Test Setup
 * Runs before all tests to configure global environment
 */

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};

// Mock performance API for browsers
global.performance = {
  now: () => Date.now(),
};

// Mock window.getSelection for contentEditable tests
global.window.getSelection = jest.fn(() => ({
  removeAllRanges: jest.fn(),
  addRange: jest.fn(),
  getRangeAt: jest.fn(() => ({
    cloneRange: jest.fn(() => ({
      selectNodeContents: jest.fn(),
      setEnd: jest.fn(),
      toString: jest.fn(() => ''),
    })),
    startContainer: document.createTextNode(''),
    startOffset: 0,
  })),
  rangeCount: 1,
}));

// Mock document.createRange for cursor operations
global.document.createRange = jest.fn(() => ({
  setStart: jest.fn(),
  setEnd: jest.fn(),
  collapse: jest.fn(),
  selectNodeContents: jest.fn(),
  cloneRange: jest.fn(),
}));
