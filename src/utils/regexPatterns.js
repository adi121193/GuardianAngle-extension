/**
 * Regex patterns for detecting PII in text
 * All patterns are optimized for Indian context + global patterns
 */

export const PII_PATTERNS = {
  // Indian Aadhaar Number (12 digits, optional spaces/dashes)
  aadhaar: {
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    name: 'Aadhaar Number',
    confidence: 0.85,
    validator: (match) => {
      const digits = match.replace(/\s/g, '');
      return digits.length === 12 && /^\d{12}$/.test(digits);
    }
  },

  // Indian PAN Card (ABCDE1234F format)
  pan: {
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    name: 'PAN Card',
    confidence: 0.95,
    validator: (match) => {
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(match);
    }
  },

  // Phone Numbers (Indian + International)
  phone: {
    pattern: /(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{10}\b/g,
    name: 'Phone Number',
    confidence: 0.75,
    validator: (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }
  },

  // Email Addresses
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    name: 'Email Address',
    confidence: 0.9,
    validator: (match) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(match);
    }
  },

  // Date of Birth (multiple formats)
  dob: {
    pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[012])[\/\-\.](?:19|20)?\d{2}\b|\b(?:19|20)\d{2}[\/\-\.](0?[1-9]|1[012])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/g,
    name: 'Date of Birth',
    confidence: 0.6,
    validator: (match) => {
      // Additional validation could check if date is realistic for DOB
      return true;
    }
  },

  // Indian Passport Number
  passport: {
    pattern: /\b[A-Z]\d{7}\b/g,
    name: 'Passport Number',
    confidence: 0.7,
    validator: (match) => {
      return /^[A-Z]\d{7}$/.test(match);
    }
  },

  // Indian Driving License
  drivingLicense: {
    pattern: /\b[A-Z]{2}\d{13}\b|\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/g,
    name: 'Driving License',
    confidence: 0.75,
    validator: (match) => {
      const normalized = match.replace(/[-\s]/g, '');
      return /^[A-Z]{2}\d{13}$/.test(normalized);
    }
  },

  // Indian Vehicle Registration Number
  vehicleReg: {
    pattern: /\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{4}\b/g,
    name: 'Vehicle Registration',
    confidence: 0.7,
    validator: (match) => {
      return true;
    }
  },

  // Bank Account Number (requires context keywords to reduce false positives)
  // CRITICAL FIX BUG004: Added context requirement to prevent ANY 8-18 digit number from matching
  bankAccount: {
    pattern: /\b(?:account|acc|a\/c|bank)\s*(?:no|number|#|num)?[\s:]*\d{8,18}\b/gi,
    name: 'Bank Account Number',
    confidence: 0.6,
    validator: (match) => {
      // Must have context keyword and valid digit count
      const hasContext = /(?:account|acc|a\/c|bank)/i.test(match);
      const digits = match.replace(/\D/g, '');
      return hasContext && digits.length >= 8 && digits.length <= 18;
    }
  },

  // IFSC Code
  ifsc: {
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    name: 'IFSC Code',
    confidence: 0.85,
    validator: (match) => {
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(match);
    }
  },

  // Credit/Debit Card Number (with optional spaces/dashes)
  creditCard: {
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    name: 'Credit/Debit Card',
    confidence: 0.8,
    validator: (match) => {
      // Luhn algorithm validation
      const digits = match.replace(/[\s\-]/g, '');
      if (digits.length < 13 || digits.length > 19) return false;

      let sum = 0;
      let isEven = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    }
  },

  // CRITICAL FIX BUG004: CVV pattern REMOVED - too many false positives
  // Pattern /\b\d{3,4}\b/ matches ANY 3-4 digit number (dates, counts, IDs, etc.)
  // CVV is rarely typed in AI chats, and pattern had >50% false positive rate

  // GST Number (India)
  gst: {
    pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b/g,
    name: 'GST Number',
    confidence: 0.9,
    validator: (match) => {
      return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(match);
    }
  },

  // Social Security Number (US)
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    name: 'SSN',
    confidence: 0.9,
    validator: (match) => {
      return /^\d{3}-\d{2}-\d{4}$/.test(match);
    }
  },

  // IP Address
  ipAddress: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    name: 'IP Address',
    confidence: 0.7,
    validator: (match) => {
      const parts = match.split('.');
      return parts.every(part => parseInt(part, 10) <= 255);
    }
  },

  // CRITICAL FIX BUG004: PIN Code pattern REMOVED - too many false positives
  // Pattern /\b\d{6}\b/ matches ANY 6-digit number (dates, OTPs, counts, IDs, etc.)
  // Indian postal codes (PIN codes) are rarely sensitive PII in AI chats
  // Pattern had >50% false positive rate on normal conversations

  // Medical Record Numbers (generic pattern)
  medicalRecord: {
    pattern: /\bMRN[\s:]?\d{6,10}\b|\bPatient[\s:]?ID[\s:]?\d{6,10}\b/gi,
    name: 'Medical Record',
    confidence: 0.8,
    validator: (match) => {
      return true;
    }
  }
};

/**
 * Detect PII in text using regex patterns
 * @param {string} text - Text to analyze
 * @param {number} minConfidence - Minimum confidence threshold (0-1)
 * @returns {Object} Detection results
 */
export function detectPIIWithRegex(text, minConfidence = 0.6) {
  const results = {
    piiDetected: false,
    types: [],
    matches: [],
    score: 0
  };

  if (!text || typeof text !== 'string') {
    return results;
  }

  const detectedTypes = new Set();
  let totalConfidence = 0;
  let matchCount = 0;

  for (const [type, config] of Object.entries(PII_PATTERNS)) {
    const matches = Array.from(text.matchAll(config.pattern));

    for (const match of matches) {
      const matchedText = match[0];

      // Validate the match
      if (config.validator && !config.validator(matchedText)) {
        continue;
      }

      // Only include if confidence meets threshold
      if (config.confidence >= minConfidence) {
        detectedTypes.add(type);
        totalConfidence += config.confidence;
        matchCount++;

        results.matches.push({
          type,
          value: matchedText,
          name: config.name,
          confidence: config.confidence,
          position: match.index
        });
      }
    }
  }

  results.piiDetected = detectedTypes.size > 0;
  results.types = Array.from(detectedTypes);
  results.score = matchCount > 0 ? totalConfidence / matchCount : 0;

  return results;
}

/**
 * Get pattern by type
 * @param {string} type - PII type
 * @returns {Object|null} Pattern configuration
 */
export function getPattern(type) {
  return PII_PATTERNS[type] || null;
}

/**
 * Check if text contains specific PII type
 * @param {string} text - Text to check
 * @param {string} type - PII type to check for
 * @returns {boolean}
 */
export function hasPIIType(text, type) {
  const pattern = PII_PATTERNS[type];
  if (!pattern) return false;

  const matches = Array.from(text.matchAll(pattern.pattern));
  return matches.some(match => {
    if (pattern.validator) {
      return pattern.validator(match[0]);
    }
    return true;
  });
}

/**
 * Get all available PII types
 * @returns {Array<string>}
 */
export function getAvailablePIITypes() {
  return Object.keys(PII_PATTERNS);
}
