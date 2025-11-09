/**
 * Text PII Detection Engine
 * Combines regex patterns and ONNX model for comprehensive detection
 */

import { detectPIIWithRegex } from '../utils/regexPatterns.js';

// ONNX model state
let onnxSession = null;
let modelLoaded = false;
let modelLoadError = null;

/**
 * Initialize ONNX model
 * @returns {Promise<boolean>}
 */
async function initializeONNXModel() {
  try {
    // Only load in browsers that support onnxruntime-web
    if (typeof ort === 'undefined') {
      console.warn('ONNX Runtime not available, using regex-only detection');
      return false;
    }

    const modelPath = chrome.runtime.getURL('src/models/pii-tiny.onnx');

    // For now, we'll skip actual ONNX loading as we need the model file
    // This is a placeholder for when the model is added
    console.log('ONNX model path:', modelPath);

    modelLoaded = false; // Set to true when actual model is loaded
    return modelLoaded;
  } catch (error) {
    console.error('Failed to load ONNX model:', error);
    modelLoadError = error;
    return false;
  }
}

/**
 * Detect PII using ONNX model
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} Detection results
 */
async function detectWithONNX(text) {
  if (!modelLoaded || !onnxSession) {
    return {
      piiDetected: false,
      types: [],
      score: 0,
      method: 'onnx-unavailable'
    };
  }

  try {
    // Placeholder for actual ONNX inference
    // This would involve:
    // 1. Tokenize text
    // 2. Convert to tensor
    // 3. Run inference
    // 4. Process output

    // For now, return empty result
    return {
      piiDetected: false,
      types: [],
      score: 0,
      method: 'onnx'
    };
  } catch (error) {
    console.error('ONNX inference error:', error);
    return {
      piiDetected: false,
      types: [],
      score: 0,
      method: 'onnx-error',
      error: error.message
    };
  }
}

/**
 * Main detection function combining regex and ONNX
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Combined detection results
 */
export async function detectPII(text, options = {}) {
  const {
    minConfidence = 0.6,
    useONNX = false,
    enabledTypes = null
  } = options;

  // Start with regex detection (fast and reliable)
  const regexResults = detectPIIWithRegex(text, minConfidence);

  // If ONNX is requested and available, combine results
  let onnxResults = null;
  if (useONNX && modelLoaded) {
    onnxResults = await detectWithONNX(text);
  }

  // Combine results
  let combinedResults = {
    piiDetected: regexResults.piiDetected,
    types: [...regexResults.types],
    matches: [...regexResults.matches],
    score: regexResults.score,
    methods: ['regex']
  };

  // Merge ONNX results if available
  if (onnxResults && onnxResults.piiDetected) {
    combinedResults.methods.push('onnx');

    // Merge types
    const allTypes = new Set([...combinedResults.types, ...onnxResults.types]);
    combinedResults.types = Array.from(allTypes);

    // Update detection flag
    combinedResults.piiDetected = combinedResults.piiDetected || onnxResults.piiDetected;

    // Combine scores (weighted average)
    const regexWeight = 0.7;
    const onnxWeight = 0.3;
    combinedResults.score = (regexResults.score * regexWeight) + (onnxResults.score * onnxWeight);
  }

  // Filter by enabled types if specified
  if (enabledTypes && enabledTypes.length > 0) {
    combinedResults.matches = combinedResults.matches.filter(
      match => enabledTypes.includes(match.type)
    );

    combinedResults.types = combinedResults.types.filter(
      type => enabledTypes.includes(type)
    );

    combinedResults.piiDetected = combinedResults.matches.length > 0;
  }

  return combinedResults;
}

/**
 * Quick check if text contains any PII (optimized for performance)
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function quickPIICheck(text) {
  if (!text || text.length < 5) {
    return false;
  }

  // Quick regex checks for most common PII patterns
  const quickPatterns = [
    /\b\d{4}\s?\d{4}\s?\d{4}\b/,        // Aadhaar-like
    /\b[A-Z]{5}\d{4}[A-Z]\b/,           // PAN-like
    /\b\d{10}\b/,                        // Phone-like
    /\b[\w.]+@[\w.]+\.\w{2,}\b/,        // Email
    /\b(?:\d{4}[\s\-]?){3}\d{4}\b/     // Credit card-like
  ];

  return quickPatterns.some(pattern => pattern.test(text));
}

/**
 * Get detection status
 * @returns {Object} Status information
 */
export function getDetectionStatus() {
  return {
    modelLoaded,
    modelLoadError: modelLoadError ? modelLoadError.message : null,
    regexAvailable: true,
    onnxAvailable: modelLoaded
  };
}

/**
 * Batch detect PII in multiple texts
 * @param {Array<string>} texts - Array of texts to analyze
 * @param {Object} options - Detection options
 * @returns {Promise<Array<Object>>} Array of detection results
 */
export async function batchDetectPII(texts, options = {}) {
  const results = [];

  for (const text of texts) {
    const result = await detectPII(text, options);
    results.push(result);
  }

  return results;
}

/**
 * Analyze text and provide detailed report
 * @param {string} text - Text to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Detailed analysis report
 */
export async function analyzeText(text, options = {}) {
  const detectionResult = await detectPII(text, options);

  // Calculate additional metrics
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;

  const report = {
    ...detectionResult,
    textLength: charCount,
    wordCount: wordCount,
    piiDensity: detectionResult.matches.length / Math.max(wordCount, 1),
    timestamp: Date.now(),
    risk: calculateRisk(detectionResult)
  };

  return report;
}

/**
 * Calculate risk level based on detection results
 * @param {Object} detectionResult - Detection results
 * @returns {string} Risk level: 'low', 'medium', 'high', 'critical'
 */
function calculateRisk(detectionResult) {
  if (!detectionResult.piiDetected) {
    return 'low';
  }

  const matchCount = detectionResult.matches.length;
  const uniqueTypes = detectionResult.types.length;
  const avgScore = detectionResult.score;

  // Critical: Multiple high-confidence matches of sensitive types
  const criticalTypes = ['aadhaar', 'pan', 'ssn', 'creditCard', 'passport'];
  const hasCriticalType = detectionResult.types.some(type => criticalTypes.includes(type));

  if (hasCriticalType && avgScore > 0.8) {
    return 'critical';
  }

  // High: Multiple matches or high confidence
  if (matchCount >= 3 || (avgScore > 0.75 && uniqueTypes >= 2)) {
    return 'high';
  }

  // Medium: Some matches with decent confidence
  if (matchCount >= 1 && avgScore > 0.6) {
    return 'medium';
  }

  return 'low';
}

// Initialize ONNX model on load (non-blocking)
if (typeof window !== 'undefined') {
  initializeONNXModel().catch(err => {
    console.warn('ONNX model initialization failed:', err);
  });
}
