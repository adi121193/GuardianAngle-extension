/**
 * PII Validation Utilities
 * Implements strict validation algorithms for Indian PII types
 */

/**
 * Verhoeff Algorithm for Aadhaar Number Validation
 * Official checksum used by UIDAI
 */

// Multiplication table for Verhoeff algorithm
const VERHOEFF_MULTIPLICATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Permutation table for Verhoeff algorithm
const VERHOEFF_PERMUTATION = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

// Inverse table for Verhoeff algorithm
const VERHOEFF_INVERSE = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validate Aadhaar number using Verhoeff checksum algorithm
 * @param {string} aadhaar - Aadhaar number (12 digits, may contain spaces)
 * @returns {boolean} True if valid
 */
export function validateAadhaarChecksum(aadhaar) {
  // Normalize: remove spaces and validate format
  const normalized = aadhaar.replace(/\s/g, '');

  // Must be exactly 12 digits
  if (!/^\d{12}$/.test(normalized)) {
    return false;
  }

  // First digit must be 2-9 (UIDAI rule)
  const firstDigit = parseInt(normalized[0], 10);
  if (firstDigit < 2 || firstDigit > 9) {
    return false;
  }

  // Apply Verhoeff checksum
  let checksum = 0;
  const digits = normalized.split('').map(d => parseInt(d, 10));

  // Process digits from right to left
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i];
    const permuted = VERHOEFF_PERMUTATION[i % 8][digit];
    checksum = VERHOEFF_MULTIPLICATION[checksum][permuted];
  }

  return checksum === 0;
}

/**
 * Normalize phone number by removing formatting characters
 * @param {string} phone - Phone number with possible formatting
 * @returns {string} Normalized digits only
 */
export function normalizePhone(phone) {
  // Remove all non-digit characters except '+'
  let normalized = phone.replace(/[\s\-().]/g, '');

  // Handle country code
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  // Remove leading zeros (Indian mobile numbers)
  normalized = normalized.replace(/^0+/, '');

  return normalized;
}

/**
 * Validate Indian mobile number
 * @param {string} phone - Phone number (may contain formatting)
 * @returns {Object} Validation result with type and confidence
 */
export function validateIndianPhone(phone) {
  const normalized = normalizePhone(phone);

  // Check for Indian country code
  let withoutCountryCode = normalized;
  let hasCountryCode = false;

  if (normalized.startsWith('91') && normalized.length === 12) {
    // +91 prefix
    withoutCountryCode = normalized.substring(2);
    hasCountryCode = true;
  } else if (normalized.length === 10) {
    // No country code
    withoutCountryCode = normalized;
  } else if (normalized.length === 11 && normalized.startsWith('0')) {
    // Leading 0 (trunk prefix)
    withoutCountryCode = normalized.substring(1);
  } else {
    return { valid: false, reason: 'Invalid length' };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = parseInt(withoutCountryCode[0], 10);
  if (firstDigit < 6 || firstDigit > 9) {
    return { valid: false, reason: 'Invalid first digit for Indian mobile' };
  }

  // Must be exactly 10 digits after normalization
  if (withoutCountryCode.length !== 10) {
    return { valid: false, reason: 'Invalid length after normalization' };
  }

  return {
    valid: true,
    normalized: withoutCountryCode,
    hasCountryCode
  };
}

/**
 * Validate international phone number (non-Indian)
 * Supports: US (+1), UK (+44), EU, and other international formats
 * @param {string} phone - Phone number
 * @returns {Object} Validation result
 */
export function validateInternationalPhone(phone) {
  const normalized = normalizePhone(phone);

  // International format: country code + number
  // Minimum 7 digits (some countries have short numbers)
  // Maximum 15 digits (ITU-T E.164)
  if (normalized.length < 7 || normalized.length > 15) {
    return { valid: false, reason: 'Invalid length for international number' };
  }

  // If starts with 91 and length is 12, it's Indian - let Indian validator handle
  if (normalized.startsWith('91') && normalized.length === 12) {
    return { valid: false, reason: 'Looks like Indian number' };
  }

  // Common country codes and their expected lengths
  const countryPatterns = {
    '1': { minLen: 10, maxLen: 11, name: 'US/Canada' },      // +1 xxx-xxx-xxxx
    '44': { minLen: 10, maxLen: 12, name: 'UK' },            // +44 xxxx xxxxxx
    '61': { minLen: 9, maxLen: 11, name: 'Australia' },      // +61 x xxxx xxxx
    '49': { minLen: 10, maxLen: 13, name: 'Germany' },       // +49 xxx xxxxxxx
    '33': { minLen: 9, maxLen: 11, name: 'France' },         // +33 x xx xx xx xx
    '86': { minLen: 11, maxLen: 13, name: 'China' },         // +86 xxx xxxx xxxx
    '81': { minLen: 10, maxLen: 12, name: 'Japan' },         // +81 xx xxxx xxxx
    '82': { minLen: 9, maxLen: 12, name: 'South Korea' },    // +82 xx xxxx xxxx
    '65': { minLen: 8, maxLen: 10, name: 'Singapore' },      // +65 xxxx xxxx
    '971': { minLen: 9, maxLen: 12, name: 'UAE' },           // +971 xx xxx xxxx
  };

  // Check if it matches a known country code pattern
  for (const [code, rules] of Object.entries(countryPatterns)) {
    if (normalized.startsWith(code)) {
      const numberWithoutCode = normalized.substring(code.length);
      if (numberWithoutCode.length >= (rules.minLen - code.length) &&
          normalized.length <= rules.maxLen) {
        return {
          valid: true,
          normalized,
          isInternational: true,
          country: rules.name
        };
      }
    }
  }

  // Generic international: 10-15 digits is likely valid
  if (normalized.length >= 10 && normalized.length <= 15) {
    return {
      valid: true,
      normalized,
      isInternational: true
    };
  }

  // For shorter numbers (7-9 digits), require context or country code prefix
  // These could be local numbers without country code
  if (normalized.length >= 7 && normalized.length <= 9) {
    return {
      valid: true,
      normalized,
      isInternational: true,
      confidence: 'low' // Mark as lower confidence
    };
  }

  return { valid: false, reason: 'Does not match known phone patterns' };
}

/**
 * Detect context cues around a potential PII value
 * @param {string} text - Full text
 * @param {number} index - Position of the match
 * @param {number} contextWindow - Characters to look before/after (default 50)
 * @returns {Object} Context analysis
 */
export function analyzeContext(text, index, contextWindow = 50) {
  const start = Math.max(0, index - contextWindow);
  const end = Math.min(text.length, index + contextWindow);
  const context = text.substring(start, end).toLowerCase();

  // Phone indicators
  const phoneKeywords = ['phone', 'mobile', 'call', 'contact', 'tel', 'number', '+91', 'whatsapp', 'sms'];
  const hasPhoneContext = phoneKeywords.some(kw => context.includes(kw));

  // Aadhaar indicators
  const aadhaarKeywords = ['aadhaar', 'aadhar', 'uid', 'uidai', 'enrollment'];
  const hasAadhaarContext = aadhaarKeywords.some(kw => context.includes(kw));

  // Account number indicators
  const accountKeywords = ['account', 'acc', 'a/c', 'bank', 'ifsc', 'savings', 'current'];
  const hasAccountContext = accountKeywords.some(kw => context.includes(kw));

  // Timestamp/date indicators (suggests phone number in message)
  const timestampPattern = /\d{1,2}:\d{2}|am|pm|today|yesterday|\d{1,2}\/\d{1,2}/i;
  const hasTimestamp = timestampPattern.test(context);

  return {
    hasPhoneContext,
    hasAadhaarContext,
    hasAccountContext,
    hasTimestamp,
    phoneScore: hasPhoneContext ? 0.3 : (hasTimestamp ? 0.15 : 0),
    aadhaarScore: hasAadhaarContext ? 0.3 : 0,
    accountScore: hasAccountContext ? 0.2 : 0
  };
}

/**
 * Validate bank account number
 * @param {string} account - Account number
 * @returns {boolean} True if valid format
 */
export function validateBankAccount(account) {
  const digits = account.replace(/\D/g, '');

  // Indian bank accounts are typically 9-18 digits
  if (digits.length < 9 || digits.length > 18) {
    return false;
  }

  // Should not match Aadhaar pattern (12 digits)
  if (digits.length === 12) {
    // Additional check: if it looks like Aadhaar format, reject
    const firstDigit = parseInt(digits[0], 10);
    if (firstDigit >= 2 && firstDigit <= 9) {
      // Might be Aadhaar, let Aadhaar validator handle it
      return false;
    }
  }

  return true;
}

/**
 * Determine the most likely PII type for a numeric value
 * Priority: Phone > Aadhaar (with checksum) > Account
 * @param {string} value - The detected value
 * @param {string} fullText - Full text for context
 * @param {number} index - Position in text
 * @returns {Object} Classification result
 */
export function classifyNumericPII(value, fullText, index) {
  const normalized = value.replace(/[\s\-+()]/g, '');
  const context = analyzeContext(fullText, index);

  const result = {
    type: null,
    confidence: 0,
    ambiguous: false,
    reasons: []
  };

  // 1. Check if it's a phone number (highest priority with context)
  const indianPhone = validateIndianPhone(value);
  if (indianPhone.valid) {
    result.type = 'phone';
    result.confidence = 0.75 + context.phoneScore;
    result.reasons.push('Matches Indian phone format');
    if (context.hasPhoneContext || context.hasTimestamp) {
      result.confidence += 0.15;
      result.reasons.push('Phone context detected');
    }
    return result;
  }

  // 2. Check if it's an Aadhaar with valid checksum (strict validation)
  if (normalized.length === 12) {
    const isValidAadhaar = validateAadhaarChecksum(value);

    if (isValidAadhaar) {
      result.type = 'aadhaar';
      result.confidence = 0.85 + context.aadhaarScore;
      result.reasons.push('Valid Aadhaar checksum');
      if (context.hasAadhaarContext) {
        result.confidence = Math.min(0.98, result.confidence + 0.1);
        result.reasons.push('Aadhaar context detected');
      }
      return result;
    } else {
      // Failed checksum - mark as ambiguous
      result.type = 'potential_aadhaar';
      result.confidence = 0.3;
      result.ambiguous = true;
      result.reasons.push('12 digits but failed Verhoeff checksum');

      // Could be account number
      if (context.hasAccountContext) {
        result.type = 'potential_account';
        result.confidence = 0.5;
        result.reasons.push('Might be bank account (has context)');
      }
      return result;
    }
  }

  // 3. Check if it's a bank account WITH explicit context FIRST
  // If someone types "Bank account: 12345...", that's clearly a bank account, not a phone
  if (normalized.length >= 9 && normalized.length <= 18 && context.hasAccountContext) {
    if (validateBankAccount(value)) {
      result.type = 'bankAccount';
      result.confidence = 0.7 + context.accountScore;
      result.ambiguous = false;
      result.reasons.push('Matches account number pattern with explicit context');
      return result;
    }
  }

  // 4. Check if it's an international phone (after bank account with context)
  // International phones can be 10-15 digits which overlaps with bank accounts
  const intlPhone = validateInternationalPhone(value);
  if (intlPhone.valid && normalized.length >= 10) {
    result.type = 'phone';
    result.confidence = 0.65 + context.phoneScore;
    result.reasons.push('Matches international phone format');
    if (context.hasPhoneContext || context.hasTimestamp) {
      result.confidence += 0.15;
      result.reasons.push('Phone context detected');
    }
    return result;
  }

  // Unknown numeric pattern
  result.type = null;
  result.confidence = 0;
  result.reasons.push('Does not match known PII patterns');
  return result;
}

/**
 * Luhn algorithm for credit card validation (existing)
 * @param {string} cardNumber - Card number
 * @returns {boolean} True if valid
 */
export function validateLuhnChecksum(cardNumber) {
  const digits = cardNumber.replace(/[\s\-]/g, '');
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

/**
 * Validate PAN card format and checksum
 * @param {string} pan - PAN card number
 * @returns {boolean} True if valid format
 */
export function validatePAN(pan) {
  // Format: ABCDE1234F
  // First 5: letters, next 4: digits, last: letter
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    return false;
  }

  // 4th character indicates type of holder
  const typeChar = pan[3];
  const validTypes = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
  return validTypes.includes(typeChar);
}
