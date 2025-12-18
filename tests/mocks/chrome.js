/**
 * Mock Chrome Extension APIs for Testing
 */

import { jest } from '@jest/globals';

const createMockStorage = () => {
  let store = {};

  return {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = store[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = store[key];
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(key => {
            result[key] = store[key] || keys[key];
          });
        } else {
          Object.assign(result, store);
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      }),

      set: jest.fn((items, callback) => {
        Object.assign(store, items);
        if (callback) callback();
        return Promise.resolve();
      }),

      remove: jest.fn((keys, callback) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => delete store[key]);
        if (callback) callback();
        return Promise.resolve();
      }),

      clear: jest.fn((callback) => {
        store = {};
        if (callback) callback();
        return Promise.resolve();
      }),
    },
  };
};

const chrome = {
  storage: createMockStorage(),

  runtime: {
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),

    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },

    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),

    lastError: null,
  },

  tabs: {
    query: jest.fn((queryInfo, callback) => {
      const tabs = [];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),

    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),

    onUpdated: {
      addListener: jest.fn(),
    },

    onActivated: {
      addListener: jest.fn(),
    },

    onRemoved: {
      addListener: jest.fn(),
    },
  },

  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setIcon: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },

  offscreen: {
    createDocument: jest.fn(() => Promise.resolve()),
    closeDocument: jest.fn(() => Promise.resolve()),
    Reason: {
      WORKERS: 'WORKERS',
    },
  },

  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: true }])),
  },

  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },

  notifications: {
    create: jest.fn((id, options, callback) => {
      if (callback) callback('notification-id');
      return Promise.resolve('notification-id');
    }),
  },
};

// Make chrome global
global.chrome = chrome;

export default chrome;
