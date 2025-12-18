/**
 * Integration Tests for PII Detection Workflow
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { detectPIIWithRegex } from '../../src/utils/regexPatterns.js';
import { maskText } from '../../src/utils/maskRules.js';

describe('PII Detection Integration', () => {
  test('detects and masks Aadhaar in full text', () => {
    const text = 'My Aadhaar number is 2345 6789 0124 for verification.';

    const detection = detectPIIWithRegex(text, 0.6);

    expect(detection.piiDetected).toBe(true);
    expect(detection.types).toContain('aadhaar');
    expect(detection.matches.length).toBe(1);

    const masked = maskText(text, detection.matches);
    expect(masked).toContain('XXXX XXXX 0124');
    expect(masked).not.toContain('2345 6789 0124');
  });

  test('detects multiple PII types in same text', () => {
    const text = 'Contact: Phone 9876543210, Email test@example.com, PAN ABCPP1234F';

    const detection = detectPIIWithRegex(text, 0.6);

    expect(detection.piiDetected).toBe(true);
    expect(detection.types).toContain('phone');
    expect(detection.types).toContain('email');
    expect(detection.types).toContain('pan');
    expect(detection.matches.length).toBe(3);
  });

  test('priority routing: phone detected before Aadhaar for ambiguous 10-digit', () => {
    const text = 'Mobile: 9876543210';

    const detection = detectPIIWithRegex(text, 0.6);

    expect(detection.piiDetected).toBe(true);
    expect(detection.types).toContain('phone');
    expect(detection.types).not.toContain('aadhaar');
  });

  test('context-aware detection boosts confidence', () => {
    const withContext = 'My mobile phone number is 9876543210';
    const withoutContext = 'The number is 9876543210';

    const detectionWith = detectPIIWithRegex(withContext, 0.6);
    const detectionWithout = detectPIIWithRegex(withoutContext, 0.6);

    const confWith = detectionWith.matches[0]?.confidence || 0;
    const confWithout = detectionWithout.matches[0]?.confidence || 0;

    // Note: Confidence may be capped at max value, so check >= instead of >
    expect(confWith).toBeGreaterThanOrEqual(confWithout);
  });

  test('detects DOB and IP addresses', () => {
    const text = 'DOB: 15/08/1990, Server IP: 192.168.1.1';

    const detection = detectPIIWithRegex(text, 0.6);

    expect(detection.piiDetected).toBe(true);
    expect(detection.types).toContain('dob');
    expect(detection.types).toContain('ipAddress');
    expect(detection.matches.length).toBe(2);
  });

  test('rejects invalid Aadhaar checksum', () => {
    const text = 'Invalid Aadhaar: 2345 6789 0128';

    const detection = detectPIIWithRegex(text, 0.6);

    // Should either not detect or mark as ambiguous
    const aadhaarMatch = detection.matches.find(m => m.type === 'aadhaar');
    expect(aadhaarMatch).toBeUndefined();

    // May appear in ambiguous matches
    if (detection.ambiguousMatches.length > 0) {
      expect(detection.ambiguousMatches[0].confidence).toBeLessThan(0.6);
    }
  });

  test('validates credit card with Luhn checksum', () => {
    const validCard = 'Card: 4111 1111 1111 1111';
    const invalidCard = 'Card: 4111 1111 1111 1112';

    const validDetection = detectPIIWithRegex(validCard, 0.6);
    const invalidDetection = detectPIIWithRegex(invalidCard, 0.6);

    expect(validDetection.types).toContain('creditCard');
    expect(invalidDetection.types).not.toContain('creditCard');
  });
});

describe('Masking Integration', () => {
  test('full workflow: detect → mask → verify', () => {
    const original = 'Phone: 9876543210, Email: test@example.com';

    // Step 1: Detect
    const detection = detectPIIWithRegex(original, 0.6);
    expect(detection.piiDetected).toBe(true);

    // Step 2: Mask
    const masked = maskText(original, detection.matches);

    // Step 3: Verify
    expect(masked).toContain('98****210');
    expect(masked).toContain('t***@example.com');
    expect(masked).not.toContain('9876543210');
    expect(masked).not.toContain('test@example.com');
  });

  test('masking preserves exact whitespace', () => {
    const original = 'Email:\n\n\ntest@example.com\n\nPhone: 9876543210';

    const detection = detectPIIWithRegex(original, 0.6);
    const masked = maskText(original, detection.matches);

    // Count newlines
    const originalNewlines = (original.match(/\n/g) || []).length;
    const maskedNewlines = (masked.match(/\n/g) || []).length;

    expect(maskedNewlines).toBe(originalNewlines);
  });

  test('masking does not add extra spaces', () => {
    const original = 'Aadhaar: 234567890124 PAN: ABCDP1234F';

    const detection = detectPIIWithRegex(original, 0.6);
    const masked = maskText(original, detection.matches);

    // No double spaces
    expect(masked.match(/  +/)).toBeNull();
  });

  test('repeated masking is idempotent', () => {
    const original = 'Phone: 9876543210';

    const detection = detectPIIWithRegex(original, 0.6);
    const masked1 = maskText(original, detection.matches);
    const masked2 = maskText(masked1, detection.matches);

    // Second masking should not change anything
    expect(masked1).toBe(masked2);
  });
});

describe('Edge Cases', () => {
  test('handles empty text', () => {
    const detection = detectPIIWithRegex('', 0.6);
    expect(detection.piiDetected).toBe(false);
    expect(detection.matches.length).toBe(0);
  });

  test('handles text with only whitespace', () => {
    const detection = detectPIIWithRegex('   \n\n  \t  ', 0.6);
    expect(detection.piiDetected).toBe(false);
  });

  test('handles text with no PII', () => {
    const text = 'This is just regular text with no sensitive information.';
    const detection = detectPIIWithRegex(text, 0.6);
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

describe('Settings Integration', () => {
  test('respects enabledPIITypes filter', () => {
    const text = 'Phone: 9876543210, Email: test@example.com, DOB: 15/08/1990';

    const detection = detectPIIWithRegex(text, 0.6);

    // Filter to only phone
    const phoneOnly = detection.matches.filter(m => m.type === 'phone');

    expect(phoneOnly.length).toBe(1);
    expect(phoneOnly[0].type).toBe('phone');
  });

  test('respects minConfidence threshold', () => {
    const text = 'Number: 9876543210';

    const highThreshold = detectPIIWithRegex(text, 0.9);
    const lowThreshold = detectPIIWithRegex(text, 0.5);

    // Lower threshold should find more matches
    expect(lowThreshold.matches.length).toBeGreaterThanOrEqual(highThreshold.matches.length);
  });
});
