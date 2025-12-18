/**
 * Test Helper Utilities
 */

/**
 * Create a mock contentEditable element
 */
export function createContentEditableElement(content = '') {
  const element = document.createElement('div');
  element.contentEditable = 'true';
  element.textContent = content;
  document.body.appendChild(element);
  return element;
}

/**
 * Create a mock textarea element
 */
export function createTextareaElement(content = '') {
  const element = document.createElement('textarea');
  element.value = content;
  document.body.appendChild(element);
  return element;
}

/**
 * Clean up DOM elements after test
 */
export function cleanupElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Wait for async operations
 */
export function waitFor(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock settings object
 */
export function createMockSettings(overrides = {}) {
  return {
    enabled: true,
    autoMask: true,
    blockOnDetection: false,
    minConfidence: 0.6,
    enabledPIITypes: [
      'aadhaar',
      'pan',
      'phone',
      'email',
      'creditCard',
      'bankAccount',
      'passport',
      'ssn',
      'ifsc',
      'gst',
      'dob',
      'ipAddress',
      'drivingLicense',
      'vehicleReg',
      'medicalRecord'
    ],
    notificationSound: true,
    proEnabled: false,
    licenseKey: null,
    licenseExpiry: null,
    imageDetection: false,
    autoBlur: false,
    stats: {
      totalDetections: 0,
      totalMasked: 0,
      totalBlocked: 0,
      detectionsByType: {},
      lastReset: Date.now()
    },
    ...overrides
  };
}

/**
 * Mock detection result
 */
export function createMockDetectionResult(matches = []) {
  return {
    piiDetected: matches.length > 0,
    types: [...new Set(matches.map(m => m.type))],
    matches,
    ambiguousMatches: [],
    score: matches.length > 0 ? 0.8 : 0
  };
}

/**
 * Create mock PII match
 */
export function createMockMatch(type, value, position = 0, confidence = 0.9) {
  return {
    type,
    value,
    position,
    confidence,
    name: getPIIName(type)
  };
}

/**
 * Get PII type name
 */
function getPIIName(type) {
  const names = {
    aadhaar: 'Aadhaar Number',
    pan: 'PAN Card',
    phone: 'Phone Number',
    email: 'Email Address',
    dob: 'Date of Birth',
    ipAddress: 'IP Address',
    creditCard: 'Credit/Debit Card',
    passport: 'Passport Number',
    ssn: 'SSN',
    bankAccount: 'Bank Account Number'
  };
  return names[type] || type;
}

/**
 * Assert no extra whitespace
 */
export function assertNoExtraWhitespace(text) {
  // Check for double spaces
  expect(text.match(/  +/)).toBeNull();

  // Check for multiple newlines (more than 2)
  expect(text.match(/\n{3,}/)).toBeNull();

  // Check for leading/trailing whitespace
  expect(text).toBe(text.trim());
}

/**
 * Count whitespace in string
 */
export function countWhitespace(text) {
  return {
    spaces: (text.match(/ /g) || []).length,
    newlines: (text.match(/\n/g) || []).length,
    tabs: (text.match(/\t/g) || []).length,
    total: (text.match(/\s/g) || []).length
  };
}
