/**
 * Unit Tests for Mask Rules
 */

import { describe, test, expect } from '@jest/globals';
import {
  maskAadhaar,
  maskPAN,
  maskPhone,
  maskEmail,
  maskDOB,
  maskCreditCard,
  maskBankAccount,
  maskPassport,
  maskSSN,
  maskIFSC,
  maskIPAddress,
  maskText
} from '../../src/utils/maskRules.js';
import { createMockMatch } from '../utils/testHelpers.js';

describe('Aadhaar Masking', () => {
  test('masks Aadhaar showing last 4 digits', () => {
    expect(maskAadhaar('423456789012')).toBe('XXXXXXXX9012');
  });

  test('preserves original formatting with spaces', () => {
    expect(maskAadhaar('4234 5678 9012')).toBe('XXXX XXXX 9012');
  });

  test('preserves original formatting with dashes', () => {
    expect(maskAadhaar('4234-5678-9012')).toBe('XXXX-XXXX-9012');
  });

  test('does not add extra spaces', () => {
    const masked = maskAadhaar('423456789012');
    expect(masked).not.toContain('  ');
    expect(masked.split(' ').length).toBe(1); // No spaces
  });
});

describe('Phone Masking', () => {
  test('masks phone showing first 2 and last 3 digits', () => {
    expect(maskPhone('9876543210')).toBe('98****210');
  });

  test('preserves country code', () => {
    expect(maskPhone('+919876543210')).toBe('+9198****210');
  });

  test('preserves original formatting', () => {
    expect(maskPhone('987-654-3210')).toBe('98*-***-210');
  });

  test('handles phone with spaces', () => {
    expect(maskPhone('98765 43210')).toBe('98*** *210');
  });
});

describe('Email Masking', () => {
  test('masks email showing first character', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com');
  });

  test('preserves domain', () => {
    expect(maskEmail('john.doe@company.co.in')).toBe('j***@company.co.in');
  });

  test('handles single character username', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });
});

describe('DOB Masking', () => {
  test('masks DOB showing only year (dd/mm/yyyy)', () => {
    expect(maskDOB('15/08/1990')).toBe('XX/XX/1990');
  });

  test('masks DOB with dash separator', () => {
    expect(maskDOB('15-08-1990')).toBe('XX-XX-1990');
  });

  test('masks DOB in yyyy-mm-dd format', () => {
    expect(maskDOB('1990-08-15')).toBe('1990-XX-XX');
  });
});

describe('Credit Card Masking', () => {
  test('masks credit card showing last 4 digits', () => {
    expect(maskCreditCard('4111111111111111')).toBe('XXXX XXXX XXXX 1111');
  });

  test('preserves original formatting with spaces', () => {
    expect(maskCreditCard('4111 1111 1111 1111')).toBe('XXXX XXXX XXXX 1111');
  });

  test('converts dashes to spaces in standard format', () => {
    // Credit card masking normalizes to space-separated format
    expect(maskCreditCard('4111-1111-1111-1111')).toBe('XXXX XXXX XXXX 1111');
  });
});

describe('Bank Account Masking', () => {
  test('masks account showing last 4 digits', () => {
    expect(maskBankAccount('001122334455')).toBe('XXXXXXXX4455');
  });

  test('handles different lengths', () => {
    expect(maskBankAccount('123456789')).toBe('XXXXX6789');
    expect(maskBankAccount('12345678901234')).toBe('XXXXXXXXXX1234');
  });
});

describe('Passport Masking', () => {
  test('masks passport showing last 3 characters', () => {
    expect(maskPassport('Z1234567')).toBe('XXXXX567');
  });
});

describe('SSN Masking', () => {
  test('masks SSN showing last 4 digits', () => {
    expect(maskSSN('123-45-6789')).toBe('XXX-XX-6789');
  });

  test('preserves dash format', () => {
    const masked = maskSSN('123-45-6789');
    expect(masked.split('-').length).toBe(3);
  });
});

describe('IFSC Masking', () => {
  test('masks IFSC showing bank code', () => {
    expect(maskIFSC('HDFC0005523')).toBe('HDFC0XXXXXX');
  });

  test('preserves first 5 characters', () => {
    const masked = maskIFSC('SBIN0001234');
    expect(masked.startsWith('SBIN0')).toBe(true);
  });
});

describe('IP Address Masking', () => {
  test('masks IP showing first octet', () => {
    expect(maskIPAddress('192.168.1.1')).toBe('192.XXX.XXX.XXX');
  });

  test('preserves dot separators', () => {
    const masked = maskIPAddress('10.0.0.1');
    expect(masked.split('.').length).toBe(4);
  });
});

describe('maskText Function', () => {
  test('masks single PII in text', () => {
    const text = 'My phone is 9876543210';
    const matches = [createMockMatch('phone', '9876543210', 12)];

    const masked = maskText(text, matches);
    expect(masked).toBe('My phone is 98****210');
  });

  test('masks multiple PII in text', () => {
    const text = 'Email: test@example.com, Phone: 9876543210';
    const matches = [
      createMockMatch('email', 'test@example.com', 7),
      createMockMatch('phone', '9876543210', 32) // Correct position
    ];

    const masked = maskText(text, matches);
    expect(masked).toContain('t***@example.com');
    expect(masked).toContain('98****210');
  });

  test('preserves original whitespace exactly', () => {
    const text = 'Email:\n\n\ntest@example.com\n\nPhone: 9876543210';
    const matches = [
      createMockMatch('email', 'test@example.com', 9),
      createMockMatch('phone', '9876543210', 35)
    ];

    const masked = maskText(text, matches);

    // Count newlines - should be same
    const originalNewlines = (text.match(/\n/g) || []).length;
    const maskedNewlines = (masked.match(/\n/g) || []).length;
    expect(maskedNewlines).toBe(originalNewlines);
  });

  test('does not add extra spaces', () => {
    const text = 'Aadhaar: 423456789012';
    const matches = [createMockMatch('aadhaar', '423456789012', 9)];

    const masked = maskText(text, matches);
    expect(masked).not.toContain('  '); // No double spaces
  });

  test('handles overlapping positions correctly', () => {
    const text = 'Number: 9876543210';
    const matches = [
      createMockMatch('phone', '9876543210', 8),
      createMockMatch('phone', '9876543210', 8) // Duplicate
    ];

    const masked = maskText(text, matches);
    expect(masked).toBe('Number: 98****210');
  });

  test('returns original text if no matches', () => {
    const text = 'No PII here';
    const masked = maskText(text, []);
    expect(masked).toBe(text);
  });

  test('handles text with only whitespace', () => {
    const text = '   ';
    const masked = maskText(text, []);
    expect(masked).toBe(text);
  });
});

describe('Formatting Preservation', () => {
  test('Aadhaar without spaces stays without spaces after masking', () => {
    const original = '423456789012';
    const masked = maskAadhaar(original);

    const originalSpaces = (original.match(/ /g) || []).length;
    const maskedSpaces = (masked.match(/ /g) || []).length;

    expect(maskedSpaces).toBe(originalSpaces);
  });

  test('Aadhaar with spaces keeps same number of spaces', () => {
    const original = '4234 5678 9012';
    const masked = maskAadhaar(original);

    const originalSpaces = (original.match(/ /g) || []).length;
    const maskedSpaces = (masked.match(/ /g) || []).length;

    expect(maskedSpaces).toBe(originalSpaces);
  });

  test('Phone formatting preservation', () => {
    const original = '+91-98765-43210';
    const masked = maskPhone(original);

    const originalDashes = (original.match(/-/g) || []).length;
    const maskedDashes = (masked.match(/-/g) || []).length;

    expect(maskedDashes).toBe(originalDashes);
  });
});
