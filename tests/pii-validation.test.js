/**
 * Comprehensive tests for PII validation
 * Tests Aadhaar checksum, phone normalization, and edge cases
 */

import {
  validateAadhaarChecksum,
  validateIndianPhone,
  validateInternationalPhone,
  validateBankAccount,
  classifyNumericPII,
  analyzeContext,
  validatePAN
} from '../src/utils/validators.js';

import { detectPIIWithRegex } from '../src/utils/regexPatterns.js';

// Test fixtures

// Valid Aadhaar numbers (with valid Verhoeff checksum)
// These are example numbers with valid checksums (not real Aadhaar numbers)
const VALID_AADHAAR = [
  '234123456789', // Valid checksum
  '2345 6789 0172', // With spaces - valid checksum
  '987654321011', // Another valid one
];

// Invalid Aadhaar numbers (fail checksum or first digit rule)
const INVALID_AADHAAR = [
  '123456789012', // First digit is 1 (invalid)
  '234567890124', // Wrong checksum
  '000000000000', // First digit is 0 (invalid)
  '999999999999', // Likely wrong checksum
];

// Indian phone numbers (various formats)
const VALID_INDIAN_PHONES = [
  '9876543210',      // Standard 10-digit
  '+919876543210',   // With +91
  '919876543210',    // With 91 prefix
  '09876543210',     // With leading 0
  '+91 98765 43210', // With spaces
  '(987) 654-3210',  // US-style formatting
  '8765432109',      // Starting with 8
  '7654321098',      // Starting with 7
  '6543210987',      // Starting with 6
];

// Invalid Indian phones (wrong first digit or length)
const INVALID_INDIAN_PHONES = [
  '1234567890',   // Starts with 1
  '0123456789',   // Starts with 0 (after normalization becomes 9 digits)
  '98765',        // Too short
  '98765432109876', // Too long
  '5876543210',   // Starts with 5 (invalid for Indian mobile)
];

// Numbers that look like Aadhaar but are phone numbers
const PHONE_LIKE_AADHAAR = [
  '917654321098',  // 12 digits starting with 91 (phone with country code)
  '919876543210',  // Another one
];

// Bank account numbers
const VALID_BANK_ACCOUNTS = [
  'Account: 12345678901',      // 11 digits with context
  'Bank acc 987654321',        // 9 digits with context
  'A/C No: 1234567890123456',  // 16 digits with context
];

const INVALID_BANK_ACCOUNTS = [
  '12345678',     // No context
  '123456789012', // 12 digits (could be Aadhaar)
];

// Test context detection
const TEST_CONTEXTS = [
  {
    text: "Call me at 9876543210",
    expected: { hasPhoneContext: true, phoneScore: 0.3 }
  },
  {
    text: "My Aadhaar is 2345 6789 0123",
    expected: { hasAadhaarContext: true, aadhaarScore: 0.3 }
  },
  {
    text: "Message from 9876543210 at 10:30 AM",
    expected: { hasPhoneContext: false, hasTimestamp: true, phoneScore: 0.15 }
  },
  {
    text: "Bank account number: 12345678901",
    expected: { hasAccountContext: true, accountScore: 0.2 }
  }
];

console.log('=== PII VALIDATION TESTS ===\n');

// Test 1: Aadhaar Verhoeff checksum
console.log('TEST 1: Aadhaar Verhoeff Checksum Validation');
console.log('Valid Aadhaar numbers:');
VALID_AADHAAR.forEach(aadhaar => {
  const result = validateAadhaarChecksum(aadhaar);
  console.log(`  ${aadhaar.padEnd(20)} => ${result ? '✓ PASS' : '✗ FAIL'}`);
});

console.log('\nInvalid Aadhaar numbers (should fail):');
INVALID_AADHAAR.forEach(aadhaar => {
  const result = validateAadhaarChecksum(aadhaar);
  console.log(`  ${aadhaar.padEnd(20)} => ${!result ? '✓ PASS (correctly rejected)' : '✗ FAIL (should reject)'}`);
});

// Test 2: Indian phone validation
console.log('\n\nTEST 2: Indian Phone Number Validation');
console.log('Valid Indian phones:');
VALID_INDIAN_PHONES.forEach(phone => {
  const result = validateIndianPhone(phone);
  console.log(`  ${phone.padEnd(20)} => ${result.valid ? '✓ PASS' : '✗ FAIL'} ${result.valid ? `(${result.normalized})` : `(${result.reason})`}`);
});

console.log('\nInvalid Indian phones (should fail):');
INVALID_INDIAN_PHONES.forEach(phone => {
  const result = validateIndianPhone(phone);
  console.log(`  ${phone.padEnd(20)} => ${!result.valid ? '✓ PASS (correctly rejected)' : '✗ FAIL (should reject)'} (${result.reason || ''})`);
});

// Test 3: Disambiguate phone vs Aadhaar (12-digit numbers)
console.log('\n\nTEST 3: Phone vs Aadhaar Disambiguation (12-digit numbers)');
PHONE_LIKE_AADHAAR.forEach(number => {
  const phoneResult = validateIndianPhone(number);
  const aadhaarResult = validateAadhaarChecksum(number);
  const classification = classifyNumericPII(number, `Call me at ${number}`, 11);

  console.log(`  ${number}:`);
  console.log(`    Phone validation: ${phoneResult.valid ? 'YES' : 'NO'}`);
  console.log(`    Aadhaar checksum: ${aadhaarResult ? 'YES' : 'NO'}`);
  console.log(`    Classified as: ${classification.type} (confidence: ${classification.confidence.toFixed(2)})`);
  console.log(`    Expected: phone (because starts with 91 country code)`);
});

// Test 4: Context detection
console.log('\n\nTEST 4: Context Detection');
TEST_CONTEXTS.forEach(({ text, expected }) => {
  const index = text.indexOf(/\d/.exec(text)?.[0] || '');
  const context = analyzeContext(text, index);

  console.log(`  Text: "${text}"`);
  console.log(`    Phone context: ${context.hasPhoneContext} (score: ${context.phoneScore})`);
  console.log(`    Aadhaar context: ${context.hasAadhaarContext} (score: ${context.aadhaarScore})`);
  console.log(`    Account context: ${context.hasAccountContext} (score: ${context.accountScore})`);
  console.log(`    Has timestamp: ${context.hasTimestamp}`);
});

// Test 5: Full integration test
console.log('\n\nTEST 5: Full Integration Test (detectPIIWithRegex)');

const testCases = [
  {
    text: 'My phone is 9876543210',
    expected: { type: 'phone', count: 1, noAadhaar: true }
  },
  {
    text: 'Call +91 9876543210 for details',
    expected: { type: 'phone', count: 1, noAadhaar: true }
  },
  {
    text: 'Aadhaar: 234123456789', // Valid checksum
    expected: { type: 'aadhaar', count: 1 }
  },
  {
    text: '234123456789', // No context, but valid checksum
    expected: { type: 'aadhaar', count: 1 }
  },
  {
    text: '123456789012', // Invalid Aadhaar (first digit), should be rejected
    expected: { count: 0 }
  },
  {
    text: 'Account number: 12345678901',
    expected: { type: 'bankAccount', count: 1 }
  },
  {
    text: '917654321098', // 12 digits, looks like Aadhaar but is phone
    expected: { type: 'phone', count: 1, noAadhaar: true }
  },
  {
    text: 'PAN: ABCPE1234F', // Valid PAN format
    expected: { type: 'pan', count: 1 }
  }
];

testCases.forEach(({ text, expected }, index) => {
  const result = detectPIIWithRegex(text, 0.3); // Lower threshold to catch ambiguous
  const mainMatches = result.matches.filter(m => !m.isAmbiguous);
  const hasExpectedType = expected.type ? mainMatches.some(m => m.type === expected.type) : true;
  const countMatches = mainMatches.length === (expected.count || 0);
  const noAadhaar = expected.noAadhaar ? !mainMatches.some(m => m.type === 'aadhaar') : true;

  const passed = hasExpectedType && countMatches && noAadhaar;

  console.log(`\n  Case ${index + 1}: "${text}"`);
  console.log(`    Expected: ${expected.type || 'no matches'} (count: ${expected.count || 0})`);
  console.log(`    Got: ${mainMatches.map(m => m.type).join(', ') || 'none'} (count: ${mainMatches.length})`);
  if (result.ambiguousMatches.length > 0) {
    console.log(`    Ambiguous: ${result.ambiguousMatches.map(m => `${m.type} (${m.confidence.toFixed(2)})`).join(', ')}`);
  }
  console.log(`    Status: ${passed ? '✓ PASS' : '✗ FAIL'}`);
  if (!passed && mainMatches.length > 0) {
    console.log(`    Details:`, mainMatches.map(m => `${m.type}:${m.confidence.toFixed(2)}`));
  }
});

// Test 6: Edge cases
console.log('\n\nTEST 6: Edge Cases');

const edgeCases = [
  {
    desc: 'Multiple 10-digit numbers (should classify correctly)',
    text: 'Mobile: 9876543210, Account: 1234567890',
    expectPhone: true,
    expectAccount: false // No "account" keyword before the number
  },
  {
    desc: '12-digit number without valid checksum',
    text: '999999999999',
    expectAadhaar: false,
    expectAmbiguous: true
  },
  {
    desc: 'Phone with +91 and spaces',
    text: '+91 98765 43210',
    expectPhone: true,
    expectAadhaar: false
  },
  {
    desc: 'Leading zero phone number',
    text: '09876543210',
    expectPhone: true,
    expectAadhaar: false
  }
];

edgeCases.forEach(({ desc, text, expectPhone, expectAadhaar, expectAccount, expectAmbiguous }) => {
  const result = detectPIIWithRegex(text, 0.3);
  const hasPhone = result.matches.some(m => m.type === 'phone');
  const hasAadhaar = result.matches.some(m => m.type === 'aadhaar');
  const hasAccount = result.matches.some(m => m.type === 'bankAccount');
  const hasAmbiguous = result.ambiguousMatches.length > 0;

  let passed = true;
  if (expectPhone !== undefined && hasPhone !== expectPhone) passed = false;
  if (expectAadhaar !== undefined && hasAadhaar !== expectAadhaar) passed = false;
  if (expectAccount !== undefined && hasAccount !== expectAccount) passed = false;
  if (expectAmbiguous !== undefined && hasAmbiguous !== expectAmbiguous) passed = false;

  console.log(`\n  ${desc}`);
  console.log(`    Text: "${text}"`);
  console.log(`    Matches: ${result.matches.map(m => m.type).join(', ') || 'none'}`);
  console.log(`    Ambiguous: ${result.ambiguousMatches.map(m => m.type).join(', ') || 'none'}`);
  console.log(`    Status: ${passed ? '✓ PASS' : '✗ FAIL'}`);
});

console.log('\n\n=== TESTS COMPLETE ===');
