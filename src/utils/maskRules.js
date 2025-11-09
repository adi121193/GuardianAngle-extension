/**
 * Masking rules for different PII types
 * Implements deterministic masking to protect sensitive data
 */

/**
 * Mask Aadhaar number - show last 4 digits
 * @param {string} aadhaar - Aadhaar number
 * @returns {string} Masked Aadhaar
 * @example "1234 5678 9012" -> "XXXX XXXX 9012"
 */
export function maskAadhaar(aadhaar) {
  const cleaned = aadhaar.replace(/\s/g, '');
  if (cleaned.length !== 12) return aadhaar;

  const last4 = cleaned.slice(-4);
  return `XXXX XXXX ${last4}`;
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
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length < 10) return phone;

  // Check for country code
  let countryCode = '';
  let number = cleaned;

  if (cleaned.length > 10) {
    const codeLength = cleaned.length - 10;
    countryCode = '+' + cleaned.slice(0, codeLength) + ' ';
    number = cleaned.slice(codeLength);
  }

  const first2 = number.slice(0, 2);
  const last3 = number.slice(-3);
  const masked = `${first2}****${last3}`;

  return countryCode + masked;
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
 * Generic complete masking
 * @param {string} value - Value to mask
 * @returns {string} Fully masked value
 */
export function maskCompletely(value) {
  return 'X'.repeat(Math.min(value.length, 10));
}

/**
 * Mask PII in text based on detection results
 * @param {string} text - Original text
 * @param {Array} matches - Array of PII matches from detection
 * @returns {string} Text with masked PII
 */
export function maskText(text, matches) {
  if (!matches || matches.length === 0) {
    return text;
  }

  // Sort matches by position (descending) to avoid index shifts
  const sortedMatches = [...matches].sort((a, b) => b.position - a.position);

  let maskedText = text;

  for (const match of sortedMatches) {
    const { type, value, position } = match;
    let maskedValue;

    // Apply appropriate masking based on PII type
    switch (type) {
      case 'aadhaar':
        maskedValue = maskAadhaar(value);
        break;
      case 'pan':
        maskedValue = maskPAN(value);
        break;
      case 'phone':
        maskedValue = maskPhone(value);
        break;
      case 'email':
        maskedValue = maskEmail(value);
        break;
      case 'dob':
        maskedValue = maskDOB(value);
        break;
      case 'creditCard':
        maskedValue = maskCreditCard(value);
        break;
      case 'bankAccount':
        maskedValue = maskBankAccount(value);
        break;
      case 'passport':
        maskedValue = maskPassport(value);
        break;
      case 'ssn':
        maskedValue = maskSSN(value);
        break;
      case 'ifsc':
        maskedValue = maskIFSC(value);
        break;
      case 'gst':
        maskedValue = maskGST(value);
        break;
      case 'drivingLicense':
        maskedValue = maskDrivingLicense(value);
        break;
      case 'ipAddress':
        maskedValue = maskIPAddress(value);
        break;
      default:
        maskedValue = maskCompletely(value);
    }

    // Replace in text
    maskedText = maskedText.substring(0, position) +
                 maskedValue +
                 maskedText.substring(position + value.length);
  }

  return maskedText;
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
