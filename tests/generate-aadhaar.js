/**
 * Generate valid Aadhaar test numbers with correct Verhoeff checksum
 */

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

const VERHOEFF_INVERSE = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function calculateVerhoeffChecksum(number) {
  let checksum = 0;
  const digits = number.split('').map(d => parseInt(d, 10));

  for (let i = 0; i < digits.length; i++) {
    const digit = digits[digits.length - 1 - i];
    const permuted = VERHOEFF_PERMUTATION[i % 8][digit];
    checksum = VERHOEFF_MULTIPLICATION[checksum][permuted];
  }

  return VERHOEFF_INVERSE[checksum];
}

function generateValidAadhaar(prefix) {
  // Ensure first digit is 2-9
  if (prefix[0] < '2' || prefix[0] > '9') {
    prefix = '2' + prefix.substring(1);
  }

  // Pad to 11 digits if needed
  while (prefix.length < 11) {
    prefix += Math.floor(Math.random() * 10);
  }
  prefix = prefix.substring(0, 11);

  const checkDigit = calculateVerhoeffChecksum(prefix);
  return prefix + checkDigit;
}

// Generate some test Aadhaar numbers
console.log('Valid Aadhaar numbers for testing:');
console.log(generateValidAadhaar('23412345678')); // Specific prefix
console.log(generateValidAadhaar('23456789017')); // With spaces format
console.log(generateValidAadhaar('98765432101')); // Another
console.log(generateValidAadhaar('55555555555')); // Pattern
console.log(generateValidAadhaar('77777777777')); // Pattern
