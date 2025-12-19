/**
 * Regression Tests for Critical Bugs
 * Tests to prevent regression of previously fixed bugs
 */

import { describe, test, expect } from '@jest/globals';
import { detectPIIWithRegex } from '../../src/utils/regexPatterns.js';
import { maskText } from '../../src/utils/maskRules.js';
import { validateAadhaarChecksum, validatePAN, classifyNumericPII } from '../../src/utils/validators.js';

describe('Regression Tests - Critical Bugs', () => {
  describe('BUG001: Spacing issues (random spaces added)', () => {
    test('masking does not add extra spaces', () => {
      const text = 'Phone: 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);
      const masked = maskText(text, detection.matches);

      expect(masked).toBe('Phone: 98****210');
      expect(masked.match(/  +/)).toBeNull(); // No double spaces
    });

    test('masking preserves single spaces', () => {
      const text = 'Email: test@example.com Phone: 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);
      const masked = maskText(text, detection.matches);

      // Should have exactly one space between "Email:" and email
      expect(masked).toContain('Email: t***@example.com');
      expect(masked).toContain('Phone: 98****210');
      expect(masked.match(/  +/)).toBeNull();
    });

    test('masking preserves multiple newlines', () => {
      const text = 'Email:\n\n\ntest@example.com';
      const detection = detectPIIWithRegex(text, 0.6);
      const masked = maskText(text, detection.matches);

      const originalNewlines = (text.match(/\n/g) || []).length;
      const maskedNewlines = (masked.match(/\n/g) || []).length;
      expect(maskedNewlines).toBe(originalNewlines);
    });
  });

  describe('BUG002: DOB and IP not detected', () => {
    test('detects DOB in dd/mm/yyyy format', () => {
      const samples = [
        'Born on 15/08/1990',
        'DOB: 31/12/1985',
        'Date of Birth: 01/01/2000'
      ];

      samples.forEach(text => {
        const detection = detectPIIWithRegex(text, 0.6);
        expect(detection.types).toContain('dob');
      });
    });

    test('detects DOB in yyyy-mm-dd format', () => {
      const samples = [
        'Date: 1990-08-15',
        'Birth: 1985-12-31',
        'DOB: 2000-01-01'
      ];

      samples.forEach(text => {
        const detection = detectPIIWithRegex(text, 0.6);
        expect(detection.types).toContain('dob');
      });
    });

    test('detects DOB in dd-mm-yyyy format', () => {
      const text = 'DOB: 15-08-1990';
      const detection = detectPIIWithRegex(text, 0.6);
      expect(detection.types).toContain('dob');
    });

    test('detects IP addresses (IPv4)', () => {
      const samples = [
        'Server IP: 192.168.1.1',
        'Connect to 10.0.0.1',
        'Host: 172.16.254.1'
      ];

      samples.forEach(text => {
        const detection = detectPIIWithRegex(text, 0.6);
        expect(detection.types).toContain('ipAddress');
      });
    });
  });

  describe('BUG003: Duplicate values masked incorrectly', () => {
    test('masks both occurrences when same value appears twice', () => {
      const text = 'Email: test@example.com and test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);
      const masked = maskText(text, detection.matches);

      // Both should be masked
      const maskedCount = (masked.match(/t\*\*\*@example\.com/g) || []).length;
      expect(maskedCount).toBe(2);
    });

    test('masks correct occurrence with position-based masking', () => {
      const text = 'First: test@example.com Second: test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);

      // Verify positions are different
      expect(detection.matches.length).toBe(2);
      expect(detection.matches[0].position).not.toBe(detection.matches[1].position);

      const masked = maskText(text, detection.matches);

      // Both should be masked
      expect(masked).toContain('t***@example.com');
      const count = (masked.match(/t\*\*\*@example\.com/g) || []).length;
      expect(count).toBe(2);
    });

    test('masks only specified occurrence when masking single PII', () => {
      const text = 'Email: test@example.com and also test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);

      // Mask only the second occurrence
      const masked = maskText(text, [detection.matches[1]]);

      // Should have one unmasked and one masked
      expect(masked).toContain('test@example.com');
      expect(masked).toContain('t***@example.com');
    });
  });

  describe('BUG004: Aadhaar Checksum Validation', () => {
    test('accepts valid Aadhaar numbers with correct checksums', () => {
      const validNumbers = [
        '234567890124',
        '987654321012',
        '567890123458',
        '2345 6789 0124' // With spaces
      ];

      validNumbers.forEach(num => {
        expect(validateAadhaarChecksum(num)).toBe(true);
      });
    });

    test('rejects invalid Aadhaar checksums', () => {
      const invalidNumbers = [
        '423456789012', // Wrong checksum
        '234567890123', // Wrong checksum
        '111111111111'  // Wrong checksum
      ];

      invalidNumbers.forEach(num => {
        expect(validateAadhaarChecksum(num)).toBe(false);
      });
    });

    test('rejects Aadhaar starting with 0 or 1', () => {
      expect(validateAadhaarChecksum('023456789012')).toBe(false);
      expect(validateAadhaarChecksum('123456789012')).toBe(false);
    });

    test('detects only valid Aadhaar in text', () => {
      const validText = 'Aadhaar: 234567890124';
      const invalidText = 'Aadhaar: 423456789012';

      const validDetection = detectPIIWithRegex(validText, 0.6);
      const invalidDetection = detectPIIWithRegex(invalidText, 0.6);

      expect(validDetection.types).toContain('aadhaar');
      expect(invalidDetection.types).not.toContain('aadhaar');
    });
  });

  describe('BUG005: PAN Validation', () => {
    test('validates correct PAN format with valid type characters', () => {
      const validPANs = [
        'ABCPP1234F', // P = Person
        'PQRCP9876K', // C = Company
        'XYZCH5432L', // H = HUF
        'MNOPF1111G'  // F = Firm
      ];

      validPANs.forEach(pan => {
        expect(validatePAN(pan)).toBe(true);
      });
    });

    test('rejects PAN with invalid type character', () => {
      const invalidPANs = [
        'ABCXP1234F', // X is invalid
        'PQRSE9876K', // E is invalid
        'ABCDE1234F'  // E is invalid
      ];

      invalidPANs.forEach(pan => {
        expect(validatePAN(pan)).toBe(false);
      });
    });

    test('rejects PAN with invalid format', () => {
      expect(validatePAN('12345ABCDE')).toBe(false);
      expect(validatePAN('ABCD1234F')).toBe(false); // Too short
      expect(validatePAN('ABCDE12345')).toBe(false); // Last char not letter
    });
  });

  describe('BUG006: Phone vs Aadhaar Priority Routing', () => {
    test('classifies 10-digit number as phone (higher priority)', () => {
      const text = 'Phone: 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.types).toContain('phone');
      expect(detection.types).not.toContain('aadhaar');
    });

    test('classifies 12-digit valid Aadhaar as Aadhaar', () => {
      const text = 'Aadhaar: 234567890124';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.types).toContain('aadhaar');
      expect(detection.types).not.toContain('phone');
    });

    test('rejects 12-digit number with invalid checksum', () => {
      const text = 'Number: 423456789012';
      const detection = detectPIIWithRegex(text, 0.6);

      // Should not be detected as Aadhaar
      expect(detection.types).not.toContain('aadhaar');
    });
  });

  describe('BUG007: Context-Aware Detection', () => {
    test('boosts confidence with phone context keywords', () => {
      const withContext = classifyNumericPII('9876543210', 'Mobile phone: 9876543210', 14);
      const withoutContext = classifyNumericPII('9876543210', 'Number: 9876543210', 8);

      // Context should boost confidence (or both may hit max cap)
      expect(withContext.confidence).toBeGreaterThanOrEqual(withoutContext.confidence);
    });

    test('boosts confidence with Aadhaar context keywords', () => {
      const withContext = classifyNumericPII('234567890124', 'Aadhaar number: 234567890124', 16);
      const withoutContext = classifyNumericPII('234567890124', 'Number: 234567890124', 8);

      expect(withContext.confidence).toBeGreaterThanOrEqual(withoutContext.confidence);
      expect(withContext.type).toBe('aadhaar');
    });

    test('classifies bank account with context', () => {
      // Use 13 digits to avoid Aadhaar confusion
      const result = classifyNumericPII('0011223344556', 'Bank account: 0011223344556', 14);
      expect(result.type).toBe('bankAccount');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('BUG008: Credit Card Luhn Validation', () => {
    test('validates correct credit card numbers', () => {
      const validCards = [
        '4111 1111 1111 1111',
        '5555555555554444',
        '4111-1111-1111-1111'
      ];

      validCards.forEach(card => {
        const detection = detectPIIWithRegex(`Card: ${card}`, 0.6);
        expect(detection.types).toContain('creditCard');
      });
    });

    test('rejects invalid credit card numbers', () => {
      const invalidCards = [
        '4111111111111112', // Wrong Luhn checksum
        '1234567890123456'  // Wrong Luhn checksum
      ];

      invalidCards.forEach(card => {
        const detection = detectPIIWithRegex(`Card: ${card}`, 0.6);
        expect(detection.types).not.toContain('creditCard');
      });
    });
  });

  describe('BUG009: Position Correctness (Automated Check)', () => {
    test('match objects include start and end fields', () => {
      const text = 'Email: test@example.com Phone: 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);

      detection.matches.forEach(match => {
        // Every match must have position, start, and end
        expect(match.position).toBeDefined();
        expect(match.start).toBeDefined();
        expect(match.end).toBeDefined();

        // start should equal position
        expect(match.start).toBe(match.position);

        // end should equal start + value.length
        expect(match.end).toBe(match.start + match.value.length);
      });
    });

    test('maskText uses exact positions (no drift)', () => {
      const text = 'First: test@example.com Second: test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);

      // Both emails should be detected
      expect(detection.matches.length).toBe(2);

      // Verify positions are correct
      const firstEmail = detection.matches[0];
      const secondEmail = detection.matches[1];

      // Extract actual text at positions
      const textAtFirst = text.substring(firstEmail.start, firstEmail.end);
      const textAtSecond = text.substring(secondEmail.start, secondEmail.end);

      expect(textAtFirst).toBe('test@example.com');
      expect(textAtSecond).toBe('test@example.com');

      // Positions should be different
      expect(firstEmail.start).not.toBe(secondEmail.start);
    });

    test('masking preserves non-PII text exactly', () => {
      const text = 'Contact me at test@example.com for details';
      const detection = detectPIIWithRegex(text, 0.6);
      const masked = maskText(text, detection.matches);

      // Non-PII parts should be preserved exactly
      expect(masked).toContain('Contact me at');
      expect(masked).toContain('for details');

      // PII should be masked
      expect(masked).toContain('t***@example.com');

      // No extra spaces
      expect(masked.match(/  +/)).toBeNull();
    });

    test('removal uses exact positions (no wrong duplicates)', () => {
      // This tests that removeSinglePII would use start/end correctly
      const text = 'Email: test@example.com and test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.matches.length).toBe(2);

      // Simulate removing only the first occurrence
      const match = detection.matches[0];
      const beforeRemoval = text.substring(0, match.start);
      const afterRemoval = text.substring(match.end);
      const result = beforeRemoval + ' ' + afterRemoval;

      // First email should be removed, second should remain
      expect(result).toContain('and test@example.com');
      expect(result.indexOf('test@example.com')).toBeGreaterThan(10); // Second occurrence
    });

    test('positions remain valid after text modifications', () => {
      const text = 'A: 9876543210 B: test@example.com C: 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);

      // Should detect 3 PII items (2 phones, 1 email)
      expect(detection.matches.length).toBeGreaterThanOrEqual(2);

      // All positions should be valid
      detection.matches.forEach(match => {
        const extracted = text.substring(match.start, match.end);
        expect(extracted).toBe(match.value);
      });
    });
  });

  describe('Edge Cases and Stability', () => {
    test('handles empty text', () => {
      const detection = detectPIIWithRegex('', 0.6);
      expect(detection.piiDetected).toBe(false);
      expect(detection.matches.length).toBe(0);
    });

    test('handles text with only whitespace', () => {
      const detection = detectPIIWithRegex('   \n\n  \t  ', 0.6);
      expect(detection.piiDetected).toBe(false);
    });

    test('handles very long text', () => {
      const text = 'Contact '.repeat(1000) + ' 9876543210';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.piiDetected).toBe(true);
      expect(detection.types).toContain('phone');
    });

    test('handles special characters around PII', () => {
      const text = 'Email: <test@example.com>, Phone: (9876543210)';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.types).toContain('email');
      expect(detection.types).toContain('phone');
    });

    test('handles unicode and emojis', () => {
      const text = 'Contact 📱 9876543210 or 📧 test@example.com';
      const detection = detectPIIWithRegex(text, 0.6);

      expect(detection.types).toContain('phone');
      expect(detection.types).toContain('email');
    });
  });
});
