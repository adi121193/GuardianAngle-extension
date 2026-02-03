/**
 * Enhanced Regex patterns for detecting PII in text
 * Optimized for Indian context + global patterns with improved accuracy
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
  // ============= IDENTITY DOCUMENTS =============

  // Indian Aadhaar Number (12 digits, optional spaces/dashes)
  // WITH STRICT VERHOEFF CHECKSUM VALIDATION
  aadhaar: {
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    name: 'Aadhaar Number',
    confidence: 0.85,
    priority: 2,
    validator: (match, fullText, index) => {
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

  // Indian Passport Number (multiple formats)
  passport: {
    pattern: /\b[A-PRZ][1-9]\d{6}\b|\b[A-Z]\d{7}\b/g,
    name: 'Passport Number',
    confidence: 0.8,
    priority: 9,
    validator: (match, fullText, index) => {
      // New format: A-P,R,Z + digit 1-9 + 6 more digits
      // Old format: Letter + 7 digits
      return /^[A-PRZ][1-9]\d{6}$/.test(match) || /^[A-Z]\d{7}$/.test(match);
    }
  },

  // Indian Voter ID
  voterId: {
    pattern: /\b[A-Z]{3}\d{7}\b/g,
    name: 'Voter ID',
    confidence: 0.8,
    priority: 16,
    validator: (match, fullText, index) => {
      return /^[A-Z]{3}\d{7}$/.test(match);
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

  // ============= CONTACT INFORMATION =============

  // Phone Numbers (Indian + International)
  // HIGHEST PRIORITY - checks first with normalization
  phone: {
    pattern: /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{1,4})?|\b\d{10,11}\b|\b\d{5}[\s.-]?\d{5}\b/g,
    name: 'Phone Number',
    confidence: 0.75,
    priority: 1,
    validator: (match, fullText, index) => {
      // Reject dates
      if (/^\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}$/.test(match) ||
        /^\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}$/.test(match)) {
        return false;
      }

      const indianResult = validateIndianPhone(match);
      if (indianResult.valid) return true;

      const intlResult = validateInternationalPhone(match);
      return intlResult.valid;
    },
    contextAware: true
  },

  // Email Addresses (improved pattern)
  email: {
    pattern: /\b[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?/g,
    name: 'Email Address',
    confidence: 0.9,
    priority: 6,
    validator: (match, fullText, index) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(match);
    }
  },

  // ============= FINANCIAL INFORMATION =============

  // Bank Account Number (with context)
  bankAccount: {
    pattern: /\b(?:account|acc|a\/c|bank)\s*(?:no|number|#|num)?[\s:]*\d{8,18}\b/gi,
    name: 'Bank Account Number',
    confidence: 0.6,
    priority: 3,
    validator: (match, fullText, index) => {
      const hasContext = /(?:account|acc|a\/c|bank)/i.test(match);
      const digits = match.replace(/\D/g, '');
      const valid = hasContext && validateBankAccount(digits);

      // Don't match if it's Aadhaar
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

  // Credit/Debit Card Number
  creditCard: {
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    name: 'Credit/Debit Card',
    confidence: 0.8,
    priority: 4,
    validator: (match, fullText, index) => {
      return validateLuhnChecksum(match);
    }
  },

  // UPI ID
  upi: {
    pattern: /\b[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+\b/g,
    name: 'UPI ID',
    confidence: 0.7,
    priority: 17,
    validator: (match, fullText, index) => {
      // Must have @ and end with known UPI handles
      const upiHandles = ['paytm', 'phonepe', 'gpay', 'googlepay', 'ybl', 'okaxis', 'okhdfcbank', 'okicici', 'oksbi', 'ibl', 'axl'];
      const parts = match.split('@');
      if (parts.length !== 2) return false;

      const handle = parts[1].toLowerCase();
      return upiHandles.some(h => handle.includes(h));
    }
  },

  // Cryptocurrency Addresses (Bitcoin, Ethereum)
  cryptoAddress: {
    pattern: /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b|\b0x[a-fA-F0-9]{40}\b/g,
    name: 'Crypto Address',
    confidence: 0.85,
    priority: 18,
    validator: (match, fullText, index) => {
      // Bitcoin (P2PKH, P2SH, Bech32)
      if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(match)) return true;
      // Ethereum
      if (/^0x[a-fA-F0-9]{40}$/.test(match)) return true;
      return false;
    }
  },

  // ============= TAX & GOVERNMENT =============

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

  // Tax Identification Number (TIN - India)
  tin: {
    pattern: /\b\d{11}\b/g,
    name: 'TIN',
    confidence: 0.5,
    priority: 20,
    validator: (match, fullText, index) => {
      // Must have "TIN" keyword nearby
      const context = fullText.substring(Math.max(0, index - 50), Math.min(fullText.length, index + 50));
      return /\bTIN\b/i.test(context);
    },
    contextAware: true
  },

  // ============= US/INTERNATIONAL =============

  // Social Security Number (US)
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    name: 'SSN',
    confidence: 0.9,
    priority: 13,
    validator: (match, fullText, index) => {
      const parts = match.split('-');
      // SSN validation: first part can't be 000, 666, or 900-999
      const first = parseInt(parts[0]);
      if (first === 0 || first === 666 || first >= 900) return false;
      // Second part can't be 00
      if (parseInt(parts[1]) === 0) return false;
      // Third part can't be 0000
      if (parseInt(parts[2]) === 0) return false;
      return true;
    }
  },

  // National Insurance Number (UK)
  nino: {
    pattern: /\b[A-Z]{2}\d{6}[A-D]\b/g,
    name: 'National Insurance Number',
    confidence: 0.85,
    priority: 19,
    validator: (match, fullText, index) => {
      // First two letters can't be BG, GB, KN, NK, NT, TN, ZZ
      const invalidPrefixes = ['BG', 'GB', 'KN', 'NK', 'NT', 'TN', 'ZZ'];
      const prefix = match.substring(0, 2);
      return !invalidPrefixes.includes(prefix);
    }
  },

  // ============= DATES & PERSONAL =============

  // Date of Birth (multiple formats)
  dob: {
    pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[012])[\/\-\.](?:19|20)?\d{2}\b|\b(?:19|20)\d{2}[\/\-\.](0?[1-9]|1[012])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/g,
    name: 'Date of Birth',
    confidence: 0.6,
    priority: 7,
    validator: (match, fullText, index) => {
      // Must have DOB/birth/born keyword nearby
      const context = fullText.substring(Math.max(0, index - 30), Math.min(fullText.length, index + 30));
      return /\b(dob|birth|born)\b/i.test(context);
    },
    contextAware: true
  },

  // ============= VEHICLE & PROPERTY =============

  // Indian Vehicle Registration Number
  vehicleReg: {
    pattern: /\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{4}\b/g,
    name: 'Vehicle Registration',
    confidence: 0.7,
    priority: 11,
    validator: (match, fullText, index) => {
      const normalized = match.replace(/\s/g, '');
      return /^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$/.test(normalized);
    }
  },

  // ============= TECHNICAL =============

  // IP Address (IPv4)
  ipAddress: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    name: 'IP Address',
    confidence: 0.7,
    priority: 8,
    validator: (match, fullText, index) => {
      const parts = match.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
  },

  // API Keys (generic patterns)
  apiKey: {
    pattern: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    name: 'API Key',
    confidence: 0.9,
    priority: 21,
    validator: (match, fullText, index) => {
      // Extract the actual key part
      const keyMatch = match.match(/['"]?([a-zA-Z0-9_\-]{20,})['"]?$/);
      return keyMatch && keyMatch[1].length >= 20;
    }
  },

  // AWS Access Keys
  awsKey: {
    pattern: /\b(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    name: 'AWS Access Key',
    confidence: 0.95,
    priority: 22,
    validator: (match, fullText, index) => {
      return /^(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}$/.test(match);
    }
  },

  // JWT Tokens
  jwtToken: {
    pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    name: 'JWT Token',
    confidence: 0.9,
    priority: 23,
    validator: (match, fullText, index) => {
      // JWT has 3 parts separated by dots
      const parts = match.split('.');
      return parts.length === 3 && parts.every(p => p.length > 0);
    }
  },

  // ============= MEDICAL =============

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
    ambiguousMatches: [],
    score: 0
  };

  if (!text || typeof text !== 'string') {
    return results;
  }

  const detectedTypes = new Set();
  const processedPositions = new Set();
  let totalConfidence = 0;
  let matchCount = 0;

  // Sort patterns by priority
  const sortedPatterns = Object.entries(PII_PATTERNS).sort((a, b) => {
    const priorityA = a[1].priority || 999;
    const priorityB = b[1].priority || 999;
    return priorityA - priorityB;
  });

  // Collect all matches
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

  // Process matches with priority and context
  for (const matchInfo of allMatches) {
    const { type, config, matchedText, position, endPosition } = matchInfo;

    // Check for overlaps
    let overlaps = false;
    for (const processedPos of processedPositions) {
      const [start, end] = processedPos.split('-').map(Number);
      if ((position >= start && position < end) || (endPosition > start && endPosition <= end)) {
        overlaps = true;
        break;
      }
    }

    if (overlaps) continue;

    // Validate
    let finalConfidence = config.confidence;
    let validationResult = true;

    if (config.validator) {
      validationResult = config.validator(matchedText, text, position);

      if (!validationResult) {
        // Add to ambiguous for certain types
        if (['pan', 'aadhaar'].includes(type)) {
          results.ambiguousMatches.push({
            type,
            value: matchedText,
            name: config.name,
            confidence: 0.4,
            position,
            start: position,
            end: endPosition,
            isAmbiguous: true,
            reasons: [`Failed ${type} validation but matches pattern`]
          });
        }
        continue;
      }
    }

    // Context scoring
    if (config.contextAware) {
      const context = analyzeContext(text, position);

      if (type === 'phone' && (context.hasPhoneContext || context.hasTimestamp)) {
        finalConfidence += 0.15;
      } else if (type === 'aadhaar' && context.hasAadhaarContext) {
        finalConfidence += 0.1;
      } else if (type === 'bankAccount' && context.hasAccountContext) {
        finalConfidence += 0.1;
      }
    }

    // Smart classification for numeric patterns
    if (['aadhaar', 'phone', 'bankAccount'].includes(type)) {
      const classification = classifyNumericPII(matchedText, text, position);

      if (classification.type && classification.type !== type) {
        continue;
      }

      if (classification.ambiguous) {
        const ambiguousType = classification.type || type || 'unknown';
        results.ambiguousMatches.push({
          type: ambiguousType,
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

      if (classification.confidence > 0) {
        finalConfidence = Math.min(0.98, classification.confidence);
      }
    }

    // Add if meets threshold
    if (finalConfidence >= minConfidence) {
      if (!type) {
        console.warn('[regexPatterns] Skipping match with undefined type:', matchedText);
        continue;
      }

      detectedTypes.add(type);
      totalConfidence += finalConfidence;
      matchCount++;

      results.matches.push({
        type,
        value: matchedText,
        name: config.name,
        confidence: finalConfidence,
        position,
        start: position,
        end: endPosition
      });

      processedPositions.add(`${position}-${endPosition}`);
    } else if (finalConfidence >= 0.3) {
      if (!type) continue;

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
 */
export function getPattern(type) {
  return PII_PATTERNS[type] || null;
}

/**
 * Check if text contains specific PII type
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
 */
export function getAvailablePIITypes() {
  return Object.keys(PII_PATTERNS);
}
