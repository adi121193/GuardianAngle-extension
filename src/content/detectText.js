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
 * @param {Object|boolean} offscreenManagerOrFlag - Offscreen manager instance or boolean flag
 */
export function enableNER(offscreenManagerOrFlag) {
  if (offscreenManagerOrFlag === true) {
    // Called from content script - just set flag
    // hybridDetector will communicate with background script via messaging
    nerEnabled = true;
    console.log('[detectText] NER detection enabled (content script mode)');
  } else if (offscreenManagerOrFlag) {
    // Called with actual offscreen manager instance
    hybridDetector.setOffscreenManager(offscreenManagerOrFlag);
    nerEnabled = true;
    console.log('[detectText] NER detection enabled (direct mode)');
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
    useNER = nerEnabled,
    detectionMode = 'hybrid',
    mode = detectionMode  // Map detectionMode to mode for backward compatibility
  } = options;

  let results;

  // CRITICAL DEBUG: Use console.warn for higher visibility
  console.warn('[detectText] >>> detectPII() ENTRY <<<', {
    textLength: text?.length,
    textPreview: text?.substring(0, 50),
    mode,
    useNER,
    nerEnabled,
    minConfidence,
    hybridDetectorState: hybridDetector?.getStats?.()
  });

  // Determine detection method based on mode
  const shouldUseNER = (mode === 'hybrid' || mode === 'ner') && useNER && nerEnabled;
  const shouldUseRegex = mode === 'hybrid' || mode === 'regex';

  console.log('[detectText] Detection strategy:', { shouldUseNER, shouldUseRegex });

  // Use hybrid detection if NER is enabled and mode allows it
  if (shouldUseNER) {
    try {
      const hybridResults = await hybridDetector.detect(text, {
        ...options,
        mode,
        minConfidence
      });

      console.log('[detectText] Hybrid detection results:', {
        count: hybridResults.count,
        regexCount: hybridResults.sources?.regex,
        nerCount: hybridResults.sources?.ner,
        detections: hybridResults.detections,
        detectionsLength: hybridResults.detections?.length
      });

      // Convert hybrid results to existing format with positions
      results = {
        piiDetected: hybridResults.count > 0,
        matches: hybridResults.detections
          .filter(d => d.type && d.value)  // Guard: skip if type or value missing
          .map(d => ({
            type: d.type.toLowerCase(),
            value: d.value,
            confidence: d.confidence,
            category: d.category,
            source: d.source,
            nerEntity: d.nerEntity,
            position: d.start || d.position || 0,  // Include position for masking/highlighting
            start: d.start,
            end: d.end
          })),
        ambiguousMatches: hybridResults.ambiguousDetections || [],
        types: [...new Set(hybridResults.detections
          .filter(d => d.type)  // Guard: skip if type missing
          .map(d => d.type.toLowerCase()))],
        score: hybridResults.count > 0
          ? hybridResults.detections.reduce((sum, d) => sum + d.confidence, 0) / hybridResults.count
          : 0,
        methods: shouldUseRegex ? ['regex', 'ner'] : ['ner'],
        performance: hybridResults.performance,
        sources: hybridResults.sources
      };

      // CRITICAL FIX: If hybrid detection returned empty but regex should work, fallback
      if (!results.piiDetected && shouldUseRegex) {
        console.log('[detectText] Hybrid returned empty, trying regex fallback...');
        const regexResults = detectPIIWithRegex(text, minConfidence);
        if (regexResults.piiDetected) {
          console.log('[detectText] Regex fallback found PII:', regexResults.types);
          results = regexResults;
          results.methods = ['regex'];
        }
      }
    } catch (error) {
      console.error('[detectText] Hybrid detection failed, using regex fallback:', error);
      results = detectPIIWithRegex(text, minConfidence);
      results.methods = ['regex'];
    }
  } else {
    // Fallback to regex-only detection
    console.log('[detectText] Using regex-only detection');
    results = detectPIIWithRegex(text, minConfidence);
    results.methods = ['regex'];
  }

  console.log('[detectText] Final results:', {
    piiDetected: results.piiDetected,
    matchCount: results.matches?.length,
    types: results.types,
    methods: results.methods
  });

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
    console.log('[detectText] quickPIICheck: text too short or empty');
    return false;
  }

  // Quick regex checks for most common PII patterns
  // IMPORTANT: Keep this list comprehensive to avoid skipping detections
  const quickPatterns = [
    /\b\d{4}\s?\d{4}\s?\d{4}\b/,        // Aadhaar-like
    /\b[A-Z]{5}\d{4}[A-Z]\b/,           // PAN-like
    /(?:^|[^\d])\d{10,11}(?:[^\d]|$)/,  // Phone-like (10-11 digits)
    /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/, // International phone with +
    /\b[\w.]+@[\w.]+\.\w{2,}\b/,        // Email
    /\b(?:\d{4}[\s\-]?){3}\d{4}\b/,    // Credit card-like
    /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/, // DOB-like (dd/mm/yyyy, etc.)
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,      // IP Address-like
    /\b[A-Z]\d{7}\b/,                    // Passport-like
    /\b[A-Z]{2}\d{13}\b/,                // Driving License-like
    /\b[A-Z]{4}0[A-Z0-9]{6}\b/,          // IFSC-like
    /\b\d{3}-\d{2}-\d{4}\b/,             // SSN-like
    /\bMRN[\s:]?\d{6,10}\b/i             // Medical Record-like
  ];

  const result = quickPatterns.some(pattern => pattern.test(text));
  console.log('[detectText] quickPIICheck result:', result, 'for text:', text.substring(0, 50));
  return result;
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
