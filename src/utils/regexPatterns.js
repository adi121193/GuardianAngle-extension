/**
 * Regex patterns for detecting PII in text
 * All patterns are optimized for Indian context + global patterns
 */

import {
  validateAadhaarChecksum,
  validateIndianPhone,
  validateInternationalPhone,
  validateBankAccount,
  validateLuhnChecksum,
  validatePAN,
  classifyNumericPII,
  analyzeContext
} from './validators.js';

export const PII_PATTERNS = {
  // Indian Aadhaar Number (12 digits, optional spaces/dashes)
  // NOW WITH STRICT VERHOEFF CHECKSUM VALIDATION
  aadhaar: {
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    name: 'Aadhaar Number',
    confidence: 0.85,
    priority: 2, // Lower priority than phone
    validator: (match, fullText, index) => {
      // CRITICAL: Must pass Verhoeff checksum
      return validateAadhaarChecksum(match);
    },
    contextAware: true
  },

  // Indian PAN Card (ABCDE1234F format)
  pan: {
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    name: 'PAN Card',
    confidence: 0.95,
    priority: 5,
    validator: (match, fullText, index) => {
      return validatePAN(match);
    }
  },

  // Phone Numbers (Indian + International)
  // HIGHEST PRIORITY - checks first with normalization
  phone: {
    pattern: /(?:\+91[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b0?\d{10}\b)/g,
    name: 'Phone Number',
    confidence: 0.75,
    priority: 1, // HIGHEST PRIORITY
    validator: (match, fullText, index) => {
      // Try Indian phone first
      const indianResult = validateIndianPhone(match);
      if (indianResult.valid) {
        return true;
      }

      // Try international phone
      const intlResult = validateInternationalPhone(match);
      return intlResult.valid;
    },
    contextAware: true
  },

  // Email Addresses
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    name: 'Email Address',
    confidence: 0.9,
    priority: 6,
    validator: (match, fullText, index) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(match);
    }
  },

  // Date of Birth (multiple formats)
  dob: {
    pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[012])[\/\-\.](?:19|20)?\d{2}\b|\b(?:19|20)\d{2}[\/\-\.](0?[1-9]|1[012])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/g,
    name: 'Date of Birth',
    confidence: 0.6,
    priority: 7,
    validator: (match, fullText, index) => {
      // Additional validation could check if date is realistic for DOB
      return true;
    }
  },

  // Indian Passport Number
  passport: {
    pattern: /\b[A-Z]\d{7}\b/g,
    name: 'Passport Number',
    confidence: 0.7,
    priority: 9,
    validator: (match, fullText, index) => {
      return /^[A-Z]\d{7}$/.test(match);
    }
  },

  // Indian Driving License
  drivingLicense: {
    pattern: /\b[A-Z]{2}\d{13}\b|\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/g,
    name: 'Driving License',
    confidence: 0.75,
    priority: 10,
    validator: (match, fullText, index) => {
      const normalized = match.replace(/[-\s]/g, '');
      return /^[A-Z]{2}\d{13}$/.test(normalized);
    }
  },

  // Indian Vehicle Registration Number
  vehicleReg: {
    pattern: /\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{4}\b/g,
    name: 'Vehicle Registration',
    confidence: 0.7,
    priority: 11,
    validator: (match, fullText, index) => {
      return true;
    }
  },

  // Bank Account Number (requires context keywords to reduce false positives)
  // CRITICAL FIX BUG004: Added context requirement to prevent ANY 8-18 digit number from matching
  bankAccount: {
    pattern: /\b(?:account|acc|a\/c|bank)\s*(?:no|number|#|num)?[\s:]*\d{8,18}\b/gi,
    name: 'Bank Account Number',
    confidence: 0.6,
    priority: 3, // Lower than phone, higher than low-confidence
    validator: (match, fullText, index) => {
      // Must have context keyword and valid digit count
      const hasContext = /(?:account|acc|a\/c|bank)/i.test(match);
      const digits = match.replace(/\D/g, '');
      const valid = hasContext && validateBankAccount(digits);

      // Don't match if it could be Aadhaar
      if (digits.length === 12 && validateAadhaarChecksum(digits)) {
        return false;
      }

      return valid;
    },
    contextAware: true
  },

  // IFSC Code
  ifsc: {
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    name: 'IFSC Code',
    confidence: 0.85,
    priority: 15,
    validator: (match, fullText, index) => {
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(match);
    }
  },

  // Credit/Debit Card Number (with optional spaces/dashes)
  creditCard: {
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    name: 'Credit/Debit Card',
    confidence: 0.8,
    priority: 4,
    validator: (match, fullText, index) => {
      return validateLuhnChecksum(match);
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
    priority: 12,
    validator: (match, fullText, index) => {
      return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(match);
    }
  },

  // Social Security Number (US)
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    name: 'SSN',
    confidence: 0.9,
    priority: 13,
    validator: (match, fullText, index) => {
      return /^\d{3}-\d{2}-\d{4}$/.test(match);
    }
  },

  // IP Address
  ipAddress: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    name: 'IP Address',
    confidence: 0.7,
    priority: 8,
    validator: (match, fullText, index) => {
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
    priority: 14,
    validator: (match, fullText, index) => {
      return true;
    }
  }
};

/**
 * Detect PII in text using regex patterns with priority-based routing
 * @param {string} text - Text to analyze
 * @param {number} minConfidence - Minimum confidence threshold (0-1)
 * @returns {Object} Detection results
 */
export function detectPIIWithRegex(text, minConfidence = 0.6) {
  const results = {
    piiDetected: false,
    types: [],
    matches: [],
    ambiguousMatches: [], // NEW: low-confidence matches
    score: 0
  };

  if (!text || typeof text !== 'string') {
    return results;
  }

  const detectedTypes = new Set();
  const processedPositions = new Set(); // Track positions to avoid duplicates
  let totalConfidence = 0;
  let matchCount = 0;

  // Sort patterns by priority (lower number = higher priority)
  const sortedPatterns = Object.entries(PII_PATTERNS).sort((a, b) => {
    const priorityA = a[1].priority || 999;
    const priorityB = b[1].priority || 999;
    return priorityA - priorityB;
  });

  // First pass: collect all potential matches with positions
  const allMatches = [];

  for (const [type, config] of sortedPatterns) {
    const matches = Array.from(text.matchAll(config.pattern));

    for (const match of matches) {
      const matchedText = match[0];
      const position = match.index;

      allMatches.push({
        type,
        config,
        matchedText,
        position,
        endPosition: position + matchedText.length
      });
    }
  }

  // Second pass: process matches with priority and context
  for (const matchInfo of allMatches) {
    const { type, config, matchedText, position, endPosition } = matchInfo;

    // Skip if this position was already matched by higher-priority pattern
    let overlaps = false;
    for (const processedPos of processedPositions) {
      const [start, end] = processedPos.split('-').map(Number);
      if ((position >= start && position < end) || (endPosition > start && endPosition <= end)) {
        overlaps = true;
        break;
      }
    }

    if (overlaps) {
      continue;
    }

    // Context-aware validation
    let finalConfidence = config.confidence;
    let validationResult = true;

    if (config.validator) {
      validationResult = config.validator(matchedText, text, position);

      // If validation failed, skip this match
      if (!validationResult) {
        continue;
      }
    }

    // Apply context scoring for context-aware patterns
    if (config.contextAware) {
      const context = analyzeContext(text, position);

      // Adjust confidence based on context
      if (type === 'phone' && (context.hasPhoneContext || context.hasTimestamp)) {
        finalConfidence += 0.15;
      } else if (type === 'aadhaar' && context.hasAadhaarContext) {
        finalConfidence += 0.1;
      } else if (type === 'bankAccount' && context.hasAccountContext) {
        finalConfidence += 0.1;
      }
    }

    // Use smart classification for numeric patterns
    if (type === 'aadhaar' || type === 'phone' || type === 'bankAccount') {
      const classification = classifyNumericPII(matchedText, text, position);

      if (classification.type && classification.type !== type) {
        // Smart classifier says it's a different type
        continue; // Skip, let the correct pattern handle it
      }

      if (classification.ambiguous) {
        // Low confidence / ambiguous match
        results.ambiguousMatches.push({
          type: classification.type || 'unknown',
          value: matchedText,
          name: config.name,
          confidence: classification.confidence,
          position,
          start: position,
          end: endPosition,
          reasons: classification.reasons,
          isAmbiguous: true
        });
        continue;
      }

      // Update confidence from classifier if available
      if (classification.confidence > 0) {
        finalConfidence = Math.min(0.98, classification.confidence);
      }
    }

    // Only include if confidence meets threshold
    if (finalConfidence >= minConfidence) {
      detectedTypes.add(type);
      totalConfidence += finalConfidence;
      matchCount++;

      results.matches.push({
        type,
        value: matchedText,
        name: config.name,
        confidence: finalConfidence,
        position,
        start: position,  // Alias for compatibility
        end: endPosition   // End position for precise masking/removal
      });

      // Mark this position as processed
      processedPositions.add(`${position}-${endPosition}`);
    } else if (finalConfidence >= 0.3) {
      // Low confidence but not completely invalid
      results.ambiguousMatches.push({
        type,
        value: matchedText,
        name: config.name,
        confidence: finalConfidence,
        position,
        start: position,
        end: endPosition,
        isAmbiguous: true
      });
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
