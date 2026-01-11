/**
 * Hybrid PII Detector
 * Combines regex-based detection (fast) with NER model (context-aware)
 *
 * Strategy:
 * 1. Always run regex detection (instant)
 * 2. Run NER for unstructured text (context-aware)
 * 3. Merge results with confidence scores
 * 4. Deduplicate overlapping detections
 */

import { detectPIIWithRegex } from '../utils/regexPatterns.js';

/**
 * Detection modes
 */
export const DetectionMode = {
  REGEX_ONLY: 'regex_only',      // Fast, deterministic
  NER_ONLY: 'ner_only',           // Context-aware, slower
  HYBRID: 'hybrid'                // Both (recommended)
};

/**
 * PII categories mapped to NER entity types
 */
const NER_TO_PII_MAP = {
  'PER': 'PERSON_NAME',
  'ORG': 'ORGANIZATION',
  'LOC': 'LOCATION'
};

/**
 * Determine if text should use NER detection
 * Skip NER for:
 * - Very short text (<10 chars)
 * - Pure structured data (emails, phones only)
 * - Already high regex confidence
 */
function shouldUseNER(text, regexResults) {
  // Skip very short text
  if (text.length < 10) {
    return false;
  }

  // Skip if text is only whitespace
  if (text.trim().length === 0) {
    return false;
  }

  // Skip if only structured PII found (emails, phones, SSN, etc.)
  const structuredTypes = new Set([
    'EMAIL',
    'PHONE',
    'SSN',
    'CREDIT_CARD',
    'IP_ADDRESS',
    'API_KEY'
  ]);

  const hasOnlyStructured = regexResults.length > 0 &&
    regexResults.every(r => structuredTypes.has(r.type));

  if (hasOnlyStructured) {
    return false;
  }

  // Use NER for unstructured text
  return true;
}

/**
 * Convert NER entities to PII detection format
 */
function convertNERToPII(nerEntities, text) {
  const piiResults = [];

  console.log('[convertNERToPII] Converting entities:', {
    entityCount: nerEntities?.length,
    entities: nerEntities,
    textLength: text?.length,
    textPreview: text?.substring(0, 100)
  });

  for (const entity of nerEntities) {
    const piiType = NER_TO_PII_MAP[entity.type];
    console.log('[convertNERToPII] Processing entity:', {
      entityType: entity.type,
      entityText: entity.text,
      mappedPiiType: piiType
    });

    if (!piiType) {
      console.warn('[convertNERToPII] No PII type mapping for:', entity.type);
      continue;
    }

    // Find entity position in original text (case-insensitive search as fallback)
    const entityText = entity.text;
    let index = text.indexOf(entityText);

    // Try case-insensitive search if exact match fails
    if (index === -1) {
      index = text.toLowerCase().indexOf(entityText.toLowerCase());
      console.log('[convertNERToPII] Case-insensitive search for:', entityText, 'found at:', index);
    }

    if (index === -1) {
      console.warn('[convertNERToPII] Entity text not found in original text:', entityText);
      continue;
    }

    const piiResult = {
      type: piiType,
      value: entityText,
      category: 'IDENTITY',
      confidence: entity.score || 0.95,
      source: 'ner',
      start: index,
      end: index + entityText.length,
      nerEntity: entity
    };

    console.log('[convertNERToPII] Created PII result:', piiResult);
    piiResults.push(piiResult);
  }

  console.log('[convertNERToPII] Final results:', piiResults.length, 'PII items');
  return piiResults;
}

/**
 * Merge and deduplicate regex + NER results
 * Priority: Keep highest confidence detection per position
 */
function mergeResults(regexResults, nerResults) {
  const merged = [];
  const seen = new Set();

  // Helper to check if two detections overlap
  const overlaps = (a, b) => {
    return (a.start <= b.end && a.end >= b.start);
  };

  // Helper to get detection key (for exact duplicates)
  const getKey = (detection) => {
    return `${detection.type}:${detection.start}:${detection.end}`;
  };

  // Add all regex results first (they're always trustworthy)
  for (const detection of regexResults) {
    const key = getKey(detection);
    if (!seen.has(key)) {
      merged.push({
        ...detection,
        source: 'regex',
        confidence: detection.confidence || 1.0
      });
      seen.add(key);
    }
  }

  // Add NER results, checking for overlaps
  for (const nerDetection of nerResults) {
    const nerKey = getKey(nerDetection);

    // Skip exact duplicates
    if (seen.has(nerKey)) {
      continue;
    }

    // Check for overlaps with existing detections
    let shouldAdd = true;
    let overlappingIndex = -1;

    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];

      if (overlaps(nerDetection, existing)) {
        // Overlaps found
        // Keep the one with higher confidence
        if (nerDetection.confidence > (existing.confidence || 1.0)) {
          // NER has higher confidence, replace existing
          overlappingIndex = i;
          break;
        } else {
          // Existing has higher confidence, skip NER
          shouldAdd = false;
          break;
        }
      }
    }

    if (overlappingIndex >= 0) {
      // Replace with higher-confidence NER detection
      merged[overlappingIndex] = nerDetection;
      seen.add(nerKey);
    } else if (shouldAdd) {
      // No overlaps or conflicts, add NER detection
      merged.push(nerDetection);
      seen.add(nerKey);
    }
  }

  // Sort by start position
  merged.sort((a, b) => a.start - b.start);

  return merged;
}

/**
 * Hybrid PII Detector
 */
export class HybridDetector {
  constructor(options = {}) {
    this.mode = options.mode || DetectionMode.HYBRID;
    this.nerEnabled = options.nerEnabled !== false;
    this.offscreenManager = null;
    this.nerInitialized = false;
    this.nerCache = new Map(); // Cache NER results
    this.maxCacheSize = 100;
  }

  /**
   * Set offscreen manager for NER
   * Clears cache only if manager actually changes
   */
  setOffscreenManager(manager) {
    // Skip if same manager already set
    if (this.offscreenManager === manager) {
      console.log('[HybridDetector] Offscreen manager already set, skipping');
      return;
    }

    this.offscreenManager = manager;
    // Clear cache when manager changes to avoid stale results
    this.nerCache.clear();
    this.nerInitialized = false; // Reset init state
    console.log('[HybridDetector] Offscreen manager set, cache cleared');
  }

  /**
   * Initialize NER model (lazy)
   */
  async initializeNER() {
    if (!this.offscreenManager) {
      console.warn('[HybridDetector] No offscreen manager set');
      return false;
    }

    if (this.nerInitialized) {
      return true;
    }

    try {
      console.log('[HybridDetector] Initializing NER model...');
      const result = await this.offscreenManager.initializeModel();

      if (result.success) {
        this.nerInitialized = true;
        console.log('[HybridDetector] NER model initialized');
        return true;
      } else {
        console.error('[HybridDetector] NER initialization failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[HybridDetector] NER initialization error:', error);
      return false;
    }
  }

  /**
   * Run NER detection with caching
   * NOTE: Only caches non-empty results to avoid caching failures
   */
  async runNER(text) {
    // CRITICAL DEBUG: Use console.warn for higher visibility
    console.warn('[HybridDetector] >>> runNER() ENTRY <<<', {
      hasOffscreenManager: !!this.offscreenManager,
      offscreenManagerReady: this.offscreenManager?.isNERReady?.(),
      textLength: text?.length
    });

    if (!this.offscreenManager) {
      console.warn('[HybridDetector] No offscreen manager - NER unavailable');
      return { entities: [], cached: false, unavailable: true };
    }

    // Check if the proxy reports ready
    if (typeof this.offscreenManager.isNERReady === 'function' && !this.offscreenManager.isNERReady()) {
      console.warn('[HybridDetector] NER not ready (proxy reports not ready)');
      return { entities: [], cached: false, unavailable: true };
    }

    // Check cache - only use cached results if they have entities
    const cacheKey = text.substring(0, 200); // Use first 200 chars as key
    if (this.nerCache.has(cacheKey)) {
      const cachedEntities = this.nerCache.get(cacheKey);
      // Only use cache if it has actual entities (don't return cached empty results)
      if (cachedEntities && cachedEntities.length > 0) {
        console.log('[HybridDetector] Using cached NER result:', cachedEntities.length, 'entities');
        return { entities: cachedEntities, cached: true };
      } else {
        // Remove invalid/empty cache entry
        console.log('[HybridDetector] Removing empty cached result, running fresh inference');
        this.nerCache.delete(cacheKey);
      }
    }

    // Ensure NER is initialized
    if (!this.nerInitialized) {
      console.log('[HybridDetector] NER not initialized, attempting initialization...');
      const initialized = await this.initializeNER();
      if (!initialized) {
        console.warn('[HybridDetector] NER initialization failed');
        return { entities: [], cached: false, unavailable: true };
      }
    }

    try {
      console.log('[HybridDetector] Running NER inference...');
      const result = await this.offscreenManager.runInference(text);
      console.log('[HybridDetector] NER inference result:', {
        success: result.success,
        entityCount: result.entities?.length,
        debug: result.debug  // Show debug info from offscreen
      });

      if (result.success && result.entities && result.entities.length > 0) {
        // Only cache non-empty results
        if (this.nerCache.size >= this.maxCacheSize) {
          // Remove oldest entry
          const firstKey = this.nerCache.keys().next().value;
          this.nerCache.delete(firstKey);
        }
        this.nerCache.set(cacheKey, result.entities);
        console.log('[HybridDetector] Cached NER result:', result.entities.length, 'entities');

        return { entities: result.entities, cached: false };
      } else if (result.success) {
        // Successful but empty - don't cache, just return
        console.log('[HybridDetector] NER returned empty (no entities detected)');
        return { entities: [], cached: false };
      } else {
        console.error('[HybridDetector] NER inference failed:', result.error);
        return { entities: [], cached: false, error: result.error };
      }
    } catch (error) {
      console.error('[HybridDetector] NER inference error:', error);
      return { entities: [], cached: false, error: error.message };
    }
  }

  /**
   * Detect PII using hybrid approach
   */
  async detect(text, options = {}) {
    const startTime = performance.now();
    const mode = options.mode || this.mode;

    // CRITICAL DEBUG: Use console.warn for higher visibility
    console.warn('[HybridDetector] >>> detect() ENTRY <<<', {
      textLength: text?.length,
      textPreview: text?.substring(0, 50),
      mode,
      nerEnabled: this.nerEnabled,
      hasOffscreenManager: !!this.offscreenManager,
      offscreenManagerReady: this.offscreenManager?.isNERReady?.()
    });

    // Always run regex detection (fast)
    let regexResults = [];
    let ambiguousResults = [];
    if (mode !== DetectionMode.NER_ONLY) {
      console.log('[HybridDetector] Running regex detection...');
      const regexDetection = detectPIIWithRegex(text, options.minConfidence || 0.6);
      console.log('[HybridDetector] Regex detection found:', regexDetection.matches?.length, 'matches');

      // Debug logging: track matches BEFORE filtering
      const invalidMatches = regexDetection.matches.filter(match => !match.type || !match.value);
      if (invalidMatches.length > 0) {
        console.warn('[hybridDetector] Found matches with missing type/value:',
          invalidMatches.map(m => ({ hasType: !!m.type, hasValue: !!m.value, match: m })));
      }

      // Convert to our format with start/end positions
      regexResults = regexDetection.matches
        .filter(match => match.type && match.value) // Guard: skip matches without type or value
        .map(match => ({
          type: match.type.toUpperCase(),
          value: match.value,
          category: match.category || 'IDENTITY',
          confidence: match.confidence || 0.9,
          source: 'regex',
          // Use precise positions from regex detector to avoid masking the wrong occurrence
          start: match.position,
          end: match.position + match.value.length
        }));

      // Include ambiguous matches
      // Debug logging: track ambiguous matches BEFORE filtering
      const invalidAmbiguous = (regexDetection.ambiguousMatches || []).filter(match => !match.type || !match.value);
      if (invalidAmbiguous.length > 0) {
        console.warn('[hybridDetector] Found ambiguous matches with missing type/value:',
          invalidAmbiguous.map(m => ({ hasType: !!m.type, hasValue: !!m.value, match: m })));
      }

      ambiguousResults = (regexDetection.ambiguousMatches || [])
        .filter(match => match.type && match.value) // Guard: skip matches without type or value
        .map(match => ({
          type: match.type.toUpperCase(),
          value: match.value,
          category: 'IDENTITY',
          confidence: match.confidence || 0.3,
          source: 'regex',
          isAmbiguous: true,
          reasons: match.reasons || [],
          start: match.position,
          end: match.position + match.value.length
        }));
    }

    const regexTime = performance.now() - startTime;

    // Determine if we should use NER
    const useNER = this.nerEnabled &&
      mode !== DetectionMode.REGEX_ONLY &&
      shouldUseNER(text, regexResults);

    let nerResults = [];
    let nerTime = 0;
    let nerCached = false;

    if (useNER) {
      const nerStartTime = performance.now();
      const nerResponse = await this.runNER(text);
      nerTime = performance.now() - nerStartTime;
      nerCached = nerResponse.cached;

      // Convert NER entities to PII format
      nerResults = convertNERToPII(nerResponse.entities, text);
    }

    // Merge results
    const mergedResults = mode === DetectionMode.HYBRID ?
      mergeResults(regexResults, nerResults) :
      mode === DetectionMode.NER_ONLY ? nerResults : regexResults;

    const totalTime = performance.now() - startTime;

    return {
      detections: mergedResults,
      ambiguousDetections: ambiguousResults,
      count: mergedResults.length,
      performance: {
        total: totalTime,
        regex: regexTime,
        ner: nerTime,
        nerCached
      },
      mode,
      sources: {
        regex: regexResults.length,
        ner: nerResults.length,
        merged: mergedResults.length,
        ambiguous: ambiguousResults.length
      }
    };
  }

  /**
   * Clear NER cache
   */
  clearCache() {
    this.nerCache.clear();
    console.log('[HybridDetector] Cache cleared');
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      nerEnabled: this.nerEnabled,
      nerInitialized: this.nerInitialized,
      mode: this.mode,
      cacheSize: this.nerCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
}

// Export singleton instance
export const hybridDetector = new HybridDetector();
