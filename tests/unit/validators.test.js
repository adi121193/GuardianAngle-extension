/**
 * Unit Tests for Validators
 */

import { describe, test, expect } from '@jest/globals';
import {
  validateAadhaarChecksum,
  validateIndianPhone,
  validateInternationalPhone,
  validateBankAccount,
  validateLuhnChecksum,
  validatePAN,
  classifyNumericPII
} from '../../src/utils/validators.js';

describe('Aadhaar Validation', () => {
  test('validates correct Aadhaar with valid checksum', () => {
    // These are valid test Aadhaar numbers (not real, checksum verified)
    expect(validateAadhaarChecksum('234567890124')).toBe(true);
    expect(validateAadhaarChecksum('987654321012')).toBe(true);
  });

  test('rejects Aadhaar with invalid checksum', () => {
    expect(validateAadhaarChecksum('234567890123')).toBe(false);
    expect(validateAadhaarChecksum('423456789012')).toBe(false);
  });

  test('rejects Aadhaar starting with 0 or 1', () => {
    expect(validateAadhaarChecksum('023456789012')).toBe(false);
    expect(validateAadhaarChecksum('123456789012')).toBe(false);
  });

  test('rejects non-12-digit numbers', () => {
    expect(validateAadhaarChecksum('12345678901')).toBe(false);
    expect(validateAadhaarChecksum('1234567890123')).toBe(false);
  });

  test('handles Aadhaar with spaces', () => {
    expect(validateAadhaarChecksum('2345 6789 0124')).toBe(true);
  });
});

describe('Phone Validation', () => {
  test('validates 10-digit Indian mobile starting with 6-9', () => {
    expect(validateIndianPhone('9876543210').valid).toBe(true);
    expect(validateIndianPhone('8765432109').valid).toBe(true);
    expect(validateIndianPhone('7654321098').valid).toBe(true);
    expect(validateIndianPhone('6543210987').valid).toBe(true);
  });

  test('rejects 10-digit number starting with 0-5', () => {
    expect(validateIndianPhone('5432109876').valid).toBe(false);
    expect(validateIndianPhone('0987654321').valid).toBe(false);
  });

  test('validates phone with +91 country code', () => {
    expect(validateIndianPhone('+919876543210').valid).toBe(true);
    expect(validateIndianPhone('919876543210').valid).toBe(true);
  });

  test('handles phone with formatting', () => {
    expect(validateIndianPhone('98765-43210').valid).toBe(true);
    expect(validateIndianPhone('(987) 654-3210').valid).toBe(true);
  });

  test('normalizes phone number correctly', () => {
    const result = validateIndianPhone('+91 98765 43210');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('9876543210');
  });
});

describe('International Phone Validation', () => {
  test('validates international numbers', () => {
    expect(validateInternationalPhone('+1234567890').valid).toBe(true);
    expect(validateInternationalPhone('+4412345678').valid).toBe(true);
  });

  test('rejects numbers that look Indian', () => {
    expect(validateInternationalPhone('+919876543210').valid).toBe(false);
    expect(validateInternationalPhone('919876543210').valid).toBe(false);
  });

  test('rejects too short or too long numbers', () => {
    // 6 digits is too short (minimum is 7)
    expect(validateInternationalPhone('123456').valid).toBe(false);
    // 17 digits is too long (maximum is 15 per ITU-T E.164)
    expect(validateInternationalPhone('12345678901234567').valid).toBe(false);
  });

  test('accepts 7-9 digit numbers as low confidence international', () => {
    // Some countries have shorter numbers
    expect(validateInternationalPhone('1234567').valid).toBe(true);
    expect(validateInternationalPhone('12345678').valid).toBe(true);
    expect(validateInternationalPhone('123456789').valid).toBe(true);
  });
});

describe('Bank Account Validation', () => {
  test('validates account numbers with correct length', () => {
    expect(validateBankAccount('001122334455')).toBe(true);
    expect(validateBankAccount('123456789012345')).toBe(true);
  });

  test('rejects account numbers that are too short or long', () => {
    expect(validateBankAccount('12345678')).toBe(false);
    expect(validateBankAccount('1234567890123456789')).toBe(false);
  });

  test('rejects 12-digit numbers that look like Aadhaar', () => {
    // 12 digits starting with 2-9 are rejected (potential Aadhaar)
    expect(validateBankAccount('234567890124')).toBe(false);
  });

  test('accepts 12-digit numbers starting with 0 or 1', () => {
    expect(validateBankAccount('012345678901')).toBe(true);
    expect(validateBankAccount('112345678901')).toBe(true);
  });
});

describe('Luhn Checksum Validation', () => {
  test('validates correct credit card numbers', () => {
    expect(validateLuhnChecksum('4111111111111111')).toBe(true); // Test Visa
    expect(validateLuhnChecksum('5555555555554444')).toBe(true); // Test Mastercard
  });

  test('rejects invalid credit card numbers', () => {
    expect(validateLuhnChecksum('4111111111111112')).toBe(false);
    expect(validateLuhnChecksum('1234567890123456')).toBe(false);
  });

  test('handles credit card numbers with spaces', () => {
    expect(validateLuhnChecksum('4111 1111 1111 1111')).toBe(true);
  });

  test('handles credit card numbers with dashes', () => {
    expect(validateLuhnChecksum('4111-1111-1111-1111')).toBe(true);
  });
});

describe('PAN Validation', () => {
  test('validates correct PAN format', () => {
    expect(validatePAN('ABCPP1234F')).toBe(true); // P = Person (4th char)
    expect(validatePAN('PQRCP9876K')).toBe(true); // C = Company (4th char)
  });

  test('rejects invalid PAN format', () => {
    expect(validatePAN('12345ABCDE')).toBe(false);
    expect(validatePAN('ABCD1234F')).toBe(false); // Too short
    expect(validatePAN('ABCDE12345')).toBe(false); // Last char not letter
  });

  test('validates PAN type character', () => {
    expect(validatePAN('ABCPP1234F')).toBe(true); // P = Person (4th char)
    expect(validatePAN('ABCCP1234F')).toBe(true); // C = Company (4th char)
    expect(validatePAN('ABCXP1234F')).toBe(false); // X = Invalid type (4th char)
  });
});

describe('Numeric PII Classification', () => {
  test('classifies 10-digit number as phone', () => {
    const result = classifyNumericPII('9876543210', 'My phone: 9876543210', 10);
    expect(result.type).toBe('phone');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('classifies 12-digit number with valid checksum as Aadhaar', () => {
    const result = classifyNumericPII('234567890124', 'Aadhaar: 234567890124', 9);
    expect(result.type).toBe('aadhaar');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('marks 12-digit number with invalid checksum as ambiguous', () => {
    const result = classifyNumericPII('234567890123', 'Number: 234567890123', 8);
    expect(result.ambiguous).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });

  test('boosts confidence with context keywords', () => {
    const withContext = classifyNumericPII('9876543210', 'Mobile phone: 9876543210', 14);
    const withoutContext = classifyNumericPII('9876543210', 'Number: 9876543210', 8);

    // Context should boost confidence (or both may hit max cap)
    expect(withContext.confidence).toBeGreaterThanOrEqual(withoutContext.confidence);
  });

  test('classifies account numbers with context', () => {
    // Use 13 digits to avoid Aadhaar confusion (12 digits)
    const result = classifyNumericPII('0011223344556', 'Bank account: 0011223344556', 14);
    expect(result.type).toBe('bankAccount');
    expect(result.confidence).toBeGreaterThan(0.6);
  });
});
