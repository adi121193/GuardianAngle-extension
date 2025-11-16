/**
 * Text PII Detection Engine
 * Uses hybrid detection (regex + NER) for comprehensive PII detection
 */

import { detectPIIWithRegex } from '../utils/regexPatterns.js';
import { hybridDetector } from '../detection/hybridDetector.js';

// Global flag for NER availability
let nerEnabled = false;

/**
 * Enable NER detection (called when offscreen manager is ready)
 */
export function enableNER(offscreenManager) {
  if (offscreenManager) {
    hybridDetector.setOffscreenManager(offscreenManager);
    nerEnabled = true;
    console.log('[detectText] NER detection enabled');
  }
}

/**
 * Main detection function using hybrid approach
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Detection results
 */
export async function detectPII(text, options = {}) {
  const {
    minConfidence = 0.6,
    enabledTypes = null,
    useNER = nerEnabled
  } = options;

  let results;

  // Use hybrid detection if NER is enabled
  if (useNER && nerEnabled) {
    const hybridResults = await hybridDetector.detect(text, options);

    // Convert hybrid results to existing format
    results = {
      piiDetected: hybridResults.count > 0,
      matches: hybridResults.detections.map(d => ({
        type: d.type.toLowerCase(),
        value: d.value,
        confidence: d.confidence,
        category: d.category,
        source: d.source,
        nerEntity: d.nerEntity
      })),
      types: [...new Set(hybridResults.detections.map(d => d.type.toLowerCase()))],
      score: hybridResults.count > 0
        ? hybridResults.detections.reduce((sum, d) => sum + d.confidence, 0) / hybridResults.count
        : 0,
      methods: ['regex', 'ner'],
      performance: hybridResults.performance,
      sources: hybridResults.sources
    };
  } else {
    // Fallback to regex-only detection
    results = detectPIIWithRegex(text, minConfidence);
    results.methods = ['regex'];
  }

  // Filter by enabled types if specified
  if (enabledTypes && enabledTypes.length > 0) {
    results.matches = results.matches.filter(
      match => enabledTypes.includes(match.type)
    );

    results.types = results.types.filter(
      type => enabledTypes.includes(type)
    );

    results.piiDetected = results.matches.length > 0;
  }

  return results;
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
    /(?:^|[^\d])\d{10}(?:[^\d]|$)/,     // Phone-like (fixed to handle punctuation)
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
    regexAvailable: true,
    detectionMethod: 'regex'
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
