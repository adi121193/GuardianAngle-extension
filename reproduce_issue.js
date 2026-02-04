
import { detectPIIWithRegex } from './src/utils/regexPatterns.js';

const samples = [
  'Date: 1990-08-15',
  'Birth: 1985-12-31',
  'DOB: 2000-01-01'
];

console.log('Testing DOB detection...');

samples.forEach((text, i) => {
  const detection = detectPIIWithRegex(text, 0.6);
  console.log(`\nSample ${i + 1}: "${text}"`);
  console.log('Detected PII:', detection.piiDetected);
  console.log('Types:', detection.types);
  
  if (!detection.types.includes('dob')) {
    console.error('FAILED: expected dob to be detected');
  } else {
    console.log('PASSED');
  }
});
