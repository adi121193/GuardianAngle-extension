/**
 * Masking rules for different PII types
 * Implements deterministic masking to protect sensitive data
 */

import {
  normalizeText,
  findNthOccurrence,
  findClosestOccurrence,
  getOccurrenceIndex,
  enhanceMatch
} from './textNormalization.js';

/**
 * Mask Aadhaar number - show last 4 digits
 * @param {string} aadhaar - Aadhaar number
 * @returns {string} Masked Aadhaar
 * @example "1234 5678 9012" -> "XXXX XXXX 9012"
 */
export function maskAadhaar(aadhaar) {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return aadhaar;

  const maskedDigits = 'XXXXXXXX' + digits.slice(-4);
  return applyOriginalFormatting(aadhaar, maskedDigits);
}

/**
 * Mask PAN card - show last 4 characters
 * @param {string} pan - PAN card number
 * @returns {string} Masked PAN
 * @example "ABCDE1234F" -> "XXXXX1234F"
 */
export function maskPAN(pan) {
  if (pan.length !== 10) return pan;

  const last4 = pan.slice(-4);
  return `XXXXX${last4}`;
}

/**
 * Mask phone number - show last 3 digits and country code
 * @param {string} phone - Phone number
 * @returns {string} Masked phone
 * @example "+91 9876543210" -> "+91 98****210"
 * @example "9876543210" -> "98****210"
 */
export function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;

  const codeLength = Math.max(0, digits.length - 10);
  const country = digits.slice(0, codeLength);
  const number = digits.slice(codeLength);

  const maskedNumber = number.slice(0, 2) + '****' + number.slice(-3);
  const maskedDigits = (country ? country : '') + maskedNumber;

  return applyOriginalFormatting(phone, maskedDigits);
}

/**
 * Mask email address - show first character and domain
 * @param {string} email - Email address
 * @returns {string} Masked email
 * @example "john.doe@example.com" -> "j***@example.com"
 */
export function maskEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [username, domain] = parts;
  if (username.length === 0) return email;

  const maskedUsername = username[0] + '***';
  return `${maskedUsername}@${domain}`;
}

/**
 * Mask date of birth - show only year
 * @param {string} dob - Date of birth
 * @returns {string} Masked DOB
 * @example "15/08/1990" -> "XX/XX/1990"
 * @example "1990-08-15" -> "XXXX-XX-15"
 */
export function maskDOB(dob) {
  // Handle multiple formats
  if (dob.includes('/')) {
    const parts = dob.split('/');
    if (parts.length === 3) {
      return `XX/XX/${parts[2]}`;
    }
  } else if (dob.includes('-')) {
    const parts = dob.split('-');
    if (parts.length === 3) {
      // Check if year is first or last
      if (parts[0].length === 4) {
        return `${parts[0]}-XX-XX`;
      } else {
        return `XX-XX-${parts[2]}`;
      }
    }
  }

  return dob;
}

/**
 * Mask credit card number - show last 4 digits
 * @param {string} cardNumber - Credit card number
 * @returns {string} Masked card number
 * @example "1234 5678 9012 3456" -> "XXXX XXXX XXXX 3456"
 */
export function maskCreditCard(cardNumber) {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return cardNumber;

  const last4 = cleaned.slice(-4);
  return `XXXX XXXX XXXX ${last4}`;
}

/**
 * Mask bank account number - show last 4 digits
 * @param {string} accountNumber - Bank account number
 * @returns {string} Masked account number
 * @example "12345678901234" -> "XXXXXXXXXX1234"
 */
export function maskBankAccount(accountNumber) {
  if (accountNumber.length < 8) return accountNumber;

  const last4 = accountNumber.slice(-4);
  const maskedPart = 'X'.repeat(accountNumber.length - 4);
  return maskedPart + last4;
}

/**
 * Mask passport number - show last 3 characters
 * @param {string} passport - Passport number
 * @returns {string} Masked passport
 * @example "A1234567" -> "XXXXX567"
 */
export function maskPassport(passport) {
  if (passport.length < 7) return passport;

  const last3 = passport.slice(-3);
  const maskedPart = 'X'.repeat(passport.length - 3);
  return maskedPart + last3;
}

/**
 * Mask SSN - show last 4 digits
 * @param {string} ssn - Social Security Number
 * @returns {string} Masked SSN
 * @example "123-45-6789" -> "XXX-XX-6789"
 */
export function maskSSN(ssn) {
  const parts = ssn.split('-');
  if (parts.length !== 3) return ssn;

  return `XXX-XX-${parts[2]}`;
}

/**
 * Mask IFSC code - show first 4 characters (bank code)
 * @param {string} ifsc - IFSC code
 * @returns {string} Masked IFSC
 * @example "SBIN0001234" -> "SBIN0XXXXXX"
 */
export function maskIFSC(ifsc) {
  if (ifsc.length !== 11) return ifsc;

  const first5 = ifsc.slice(0, 5);
  return `${first5}XXXXXX`;
}

/**
 * Mask GST number - show first 2 digits (state code)
 * @param {string} gst - GST number
 * @returns {string} Masked GST
 * @example "29ABCDE1234F1Z5" -> "29XXXXXXXXXXX"
 */
export function maskGST(gst) {
  if (gst.length !== 15) return gst;

  const first2 = gst.slice(0, 2);
  return `${first2}${'X'.repeat(13)}`;
}

/**
 * Mask driving license - show state code
 * @param {string} license - Driving license number
 * @returns {string} Masked license
 * @example "MH1234567890123" -> "MHXXXXXXXXXXXXX"
 */
export function maskDrivingLicense(license) {
  const cleaned = license.replace(/[-\s]/g, '');
  if (cleaned.length < 10) return license;

  const first2 = cleaned.slice(0, 2);
  return `${first2}${'X'.repeat(cleaned.length - 2)}`;
}

/**
 * Mask IP address - show first octet
 * @param {string} ip - IP address
 * @returns {string} Masked IP
 * @example "192.168.1.1" -> "192.XXX.XXX.XXX"
 */
export function maskIPAddress(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;

  return `${parts[0]}.XXX.XXX.XXX`;
}

/**
 * Apply the original formatting (non-digit chars) to a masked digit string.
 * Preserves original separators/spaces to avoid adding new whitespace.
 * @param {string} original
 * @param {string} maskedDigits - digits only, same length as original digits
 * @returns {string}
 */
function applyOriginalFormatting(original, maskedDigits) {
  let digitIndex = 0;
  const maskedChars = [];

  for (const ch of original) {
    if (/\d/.test(ch)) {
      maskedChars.push(maskedDigits[digitIndex] || '');
      digitIndex++;
    } else {
      maskedChars.push(ch);
    }
  }

  return maskedChars.join('');
}

/**
 * Generic complete masking
 * @param {string} value - Value to mask
 * @returns {string} Fully masked value
 */
export function maskCompletely(value) {
  return 'X'.repeat(Math.min(value.length, 10));
}

/**
 * Mask PII in text based on detection results
 * RESILIENT VERSION: Handles contenteditable quirks (NBSP, zero-width chars, position drift)
 * @param {string} text - Original text
 * @param {Array} matches - Array of PII matches from detection
 * @param {Object} options - Options for masking
 * @param {string} options.originalText - Original text at detection time (for position mapping)
 * @returns {string} Text with masked PII
 */
export function maskText(text, matches, options = {}) {
  if (!matches || matches.length === 0) {
    return text;
  }

  const { originalText } = options;

  // Normalize current text for consistent processing
  const normalizedText = normalizeText(text);

  // Enhance matches with occurrence tracking
  const enhancedMatches = matches.map(match => {
    // If we have original text, use it to determine occurrence
    const referenceText = originalText || text;
    return enhanceMatch(match, referenceText);
  });

  // Sort by position descending to avoid index shifts during replacement
  const sortedMatches = [...enhancedMatches].sort((a, b) => {
    const posA = a.start ?? a.position ?? 0;
    const posB = b.start ?? b.position ?? 0;
    return posB - posA;
  });

  let maskedText = text;
  const processedRanges = [];

  for (const match of sortedMatches) {
    const { type, value, normalizedValue, occurrence, start, position } = match;
    const actualStart = start ?? position ?? -1;

    // Strategy 1: Try exact position match
    if (actualStart >= 0 && actualStart + value.length <= maskedText.length) {
      const textAtPosition = maskedText.substring(actualStart, actualStart + value.length);

      if (textAtPosition === value) {
        // Exact match at expected position
        const maskedValue = maskValueByType(value, type);
        maskedText = maskedText.substring(0, actualStart) +
                     maskedValue +
                     maskedText.substring(actualStart + value.length);

        processedRanges.push({ start: actualStart, end: actualStart + value.length });
        continue;
      }

      // Try with normalized comparison (handles NBSP differences)
      const normalizedAtPosition = normalizeText(textAtPosition);
      if (normalizedAtPosition === normalizedValue) {
        const maskedValue = maskValueByType(textAtPosition, type); // Mask actual text, preserving formatting
        maskedText = maskedText.substring(0, actualStart) +
                     maskedValue +
                     maskedText.substring(actualStart + textAtPosition.length);

        processedRanges.push({ start: actualStart, end: actualStart + textAtPosition.length });
        continue;
      }
    }

    // Strategy 2: Try nth-occurrence matching (position-independent, robust for duplicates)
    if (occurrence >= 0) {
      console.log(`[maskText] Position mismatch for "${value}", trying nth-occurrence (${occurrence})`);

      const nthMatch = findNthOccurrence(maskedText, value, occurrence);

      if (nthMatch) {
        // Check if this range was already processed
        const isProcessed = processedRanges.some(range =>
          nthMatch.start >= range.start && nthMatch.start < range.end
        );

        if (!isProcessed) {
          const maskedValue = maskValueByType(value, type);
          maskedText = maskedText.substring(0, nthMatch.start) +
                       maskedValue +
                       maskedText.substring(nthMatch.end);

          processedRanges.push({ start: nthMatch.start, end: nthMatch.end });
          continue;
        }
      }

      // Try with normalized text
      const normalizedCurrent = normalizeText(maskedText);
      const nthNormMatch = findNthOccurrence(normalizedCurrent, normalizedValue, occurrence);

      if (nthNormMatch) {
        // Map normalized position back to actual text
        // Find the actual text at this normalized position
        let actualPos = 0;
        let normPos = 0;

        for (let i = 0; i < maskedText.length && normPos < nthNormMatch.start; i++) {
          const char = maskedText[i];
          const normChar = normalizeText(char);
          if (normChar) normPos += normChar.length;
          actualPos = i + 1;
        }

        // Extract actual text matching the normalized value
        const actualExtract = maskedText.substring(actualPos, actualPos + value.length + 10);
        const actualNormalized = normalizeText(actualExtract);
        const matchLength = actualNormalized.indexOf(normalizedValue) >= 0
          ? normalizedValue.length
          : value.length;

        if (actualPos >= 0 && actualPos + matchLength <= maskedText.length) {
          const actualValue = maskedText.substring(actualPos, actualPos + matchLength);
          const maskedValue = maskValueByType(actualValue, type);
          maskedText = maskedText.substring(0, actualPos) +
                       maskedValue +
                       maskedText.substring(actualPos + matchLength);

          processedRanges.push({ start: actualPos, end: actualPos + matchLength });
          continue;
        }
      }
    }

    // Strategy 3: Find closest occurrence to expected position
    if (actualStart >= 0) {
      console.log(`[maskText] Trying closest occurrence for "${value}" near position ${actualStart}`);

      const closestMatch = findClosestOccurrence(maskedText, value, actualStart, 200);

      if (closestMatch) {
        const isProcessed = processedRanges.some(range =>
          closestMatch.start >= range.start && closestMatch.start < range.end
        );

        if (!isProcessed) {
          const maskedValue = maskValueByType(value, type);
          maskedText = maskedText.substring(0, closestMatch.start) +
                       maskedValue +
                       maskedText.substring(closestMatch.end);

          processedRanges.push({ start: closestMatch.start, end: closestMatch.end });
          console.log(`[maskText] Masked at corrected position ${closestMatch.start} (drift: ${closestMatch.distance} chars)`);
          continue;
        }
      }
    }

    // Strategy 4: Last resort - find any unprocessed occurrence
    let foundUnprocessed = false;
    let searchIndex = 0;

    while (searchIndex < maskedText.length) {
      const index = maskedText.indexOf(value, searchIndex);
      if (index === -1) break;

      const isProcessed = processedRanges.some(range =>
        index >= range.start && index < range.end
      );

      if (!isProcessed) {
        const maskedValue = maskValueByType(value, type);
        maskedText = maskedText.substring(0, index) +
                     maskedValue +
                     maskedText.substring(index + value.length);

        processedRanges.push({ start: index, end: index + value.length });
        console.log(`[maskText] Fallback: masked first unprocessed occurrence of "${value}" at ${index}`);
        foundUnprocessed = true;
        break;
      }

      searchIndex = index + 1;
    }

    if (!foundUnprocessed) {
      console.warn(`[maskText] FAILED to mask "${value}" - not found in current text or all occurrences processed`);
    }
  }

  return maskedText;
}

/**
 * Helper function to mask a value based on its type
 * @param {string} value - The value to mask
 * @param {string} type - The PII type
 * @returns {string} Masked value
 */
function maskValueByType(value, type) {
  switch (type) {
    case 'aadhaar':
      return maskAadhaar(value);
    case 'pan':
      return maskPAN(value);
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
    case 'dob':
      return maskDOB(value);
    case 'creditCard':
      return maskCreditCard(value);
    case 'bankAccount':
      return maskBankAccount(value);
    case 'passport':
      return maskPassport(value);
    case 'ssn':
      return maskSSN(value);
    case 'ifsc':
      return maskIFSC(value);
    case 'gst':
      return maskGST(value);
    case 'drivingLicense':
      return maskDrivingLicense(value);
    case 'ipAddress':
      return maskIPAddress(value);
    default:
      return maskCompletely(value);
  }
}

/**
 * Mask rule mapping for programmatic access
 */
export const MASK_FUNCTIONS = {
  aadhaar: maskAadhaar,
  pan: maskPAN,
  phone: maskPhone,
  email: maskEmail,
  dob: maskDOB,
  creditCard: maskCreditCard,
  bankAccount: maskBankAccount,
  passport: maskPassport,
  ssn: maskSSN,
  ifsc: maskIFSC,
  gst: maskGST,
  drivingLicense: maskDrivingLicense,
  ipAddress: maskIPAddress,
  default: maskCompletely
};

/**
 * Get masking function for a specific PII type
 * @param {string} type - PII type
 * @returns {Function} Masking function
 */
export function getMaskFunction(type) {
  return MASK_FUNCTIONS[type] || MASK_FUNCTIONS.default;
}
