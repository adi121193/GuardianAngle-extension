# NER Integration Implementation Plan - v1.3.0

## Overview

Implementing lightweight in-browser Named Entity Recognition (NER) to enhance PII detection beyond regex patterns, with full user control and graceful fallbacks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Content Script                           │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  detectText  │─────▶│hybridDetector│                     │
│  └──────────────┘      └───────┬──────┘                     │
│                                │                             │
│                        Gating Logic                          │
│                     (regex finds PII OR                      │
│                      heuristic suggests)                     │
│                                │                             │
│                                ▼                             │
│                     ┌─────────────────┐                      │
│                     │  NER Chunker    │                      │
│                     │  (128-256 seq)  │                      │
│                     └────────┬────────┘                      │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │ postMessage()
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Web Worker                               │
│  ┌──────────────────────────────────────────────────────────┤
│  │  NER Worker (ner-worker.js)                              │
│  │  - ONNX Runtime Web (WASM + SIMD)                        │
│  │  - Lazy-loaded model (~10-15 MB)                         │
│  │  - Session initialized once                               │
│  │  - Timeout/abort fallback                                │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼ results
┌─────────────────────────────────────────────────────────────┐
│                   Merge & Deduplicate                        │
│  - Reconcile regex + NER outputs                            │
│  - Map offsets to original text                             │
│  - Normalize types (regex: "email", NER: "EMAIL")          │
│  - Confidence scoring                                        │
│  - Caching (text hash → results)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. UI Components (COMPLETED ✅)

**Location:** `/html/popup.html` + `/src/styles/popup.css`

#### Added:
- **NER Settings Card** with toggle, info button, status chip
- **NER Info Modal** explaining what NER detects, performance impact, privacy
- **NER Download Prompt** with progress bar and options (Download / Not now / Never)
- **Source & Confidence Badges** (regex, NER, hybrid) with color coding
- **Detection Summary** showing breakdown (e.g., "5 items: 2 NER, 3 regex")
- **Performance Notice** inline message when NER unavailable

#### Accessibility:
- ARIA labels, roles, live regions
- Keyboard focus states
- Screen reader friendly

---

### 2. Settings Storage Schema

**Location:** `src/utils/settingsStorage.js` (to be created/updated)

```javascript
const DEFAULT_SETTINGS = {
  // Existing settings
  enabled: true,
  enabledPIITypes: [...],
  minConfidence: 0.6,
  detectionMode: 'hybrid',

  // NEW: NER Settings
  nerEnabled: false,              // User toggle
  nerModelDownloaded: false,      // Model download status
  nerNeverAsk: false,             // User chose "Always use regex only"
  nerAutoDownload: false,         // Auto-download on enable (future)
  nerCacheEnabled: true,          // Cache NER results
  nerMaxCacheSize: 100,           // Max cached text hashes
  nerTimeout: 5000,               // Worker timeout (ms)
  nerMaxSeqLength: 256,           // Token sequence limit
  nerChunkOverlap: 32             // Overlap for chunking
};
```

**Methods:**
- `getNERSettings()` - Get NER-specific settings
- `updateNERSettings(settings)` - Update NER settings
- `setNERModelDownloaded(boolean)` - Mark model as downloaded
- `setNERNeverAsk(boolean)` - User opted out

---

### 3. NER Model Selection

**Model:** `distilbert-base-cased-ner` (Hugging Face)
- **Size:** ~8-10 MB (quantized to 8-bit)
- **Format:** ONNX
- **Entities:** PERSON, ORGANIZATION, LOCATION
- **Performance:** ~100-300ms per 256-token chunk

**Storage:**
- Location: IndexedDB via ONNX Runtime Web cache
- Lazy-loaded on first use
- Persistent across sessions

---

### 4. NER Worker

**Location:** `src/workers/ner-worker.js` (to be created)

```javascript
// Web Worker for NER inference
importScripts('path/to/onnxruntime-web.min.js');

let session = null;
let tokenizer = null;

// Initialize model (lazy)
async function initModel() {
  if (session) return;

  // Load model from IndexedDB or CDN
  const modelPath = 'models/distilbert-ner-quantized.onnx';
  session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });

  // Load tokenizer
  tokenizer = await loadTokenizer();
}

// Process text chunk
async function runNER(textChunk) {
  await initModel();

  // Tokenize
  const tokens = tokenizer.encode(textChunk, { maxLength: 256 });

  // Run inference
  const inputTensor = new ort.Tensor('int64', tokens.input_ids, [1, tokens.input_ids.length]);
  const results = await session.run({ input_ids: inputTensor });

  // Decode entities
  const entities = decodeEntities(results, tokens, textChunk);
  return entities;
}

// Message handler
self.onmessage = async (event) => {
  const { id, action, data } = event.data;

  try {
    if (action === 'init') {
      await initModel();
      self.postMessage({ id, success: true });
    } else if (action === 'detect') {
      const entities = await runNER(data.text);
      self.postMessage({ id, success: true, entities });
    }
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
```

**Error Handling:**
- Timeout after 5s (configurable)
- Fall back to regex-only on error
- Log failures for debugging

---

### 5. Text Chunking Utility

**Location:** `src/utils/textChunker.js` (to be created)

```javascript
/**
 * Split text into overlapping chunks for NER processing
 * @param {string} text - Input text
 * @param {number} maxLength - Max tokens per chunk (default: 256)
 * @param {number} overlap - Overlap tokens (default: 32)
 * @returns {Array<{chunk: string, start: number, end: number}>}
 */
export function chunkText(text, maxLength = 256, overlap = 32) {
  const chunks = [];
  const words = text.split(/\s+/);

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxLength, words.length);
    const chunk = words.slice(start, end).join(' ');

    // Track offset for mapping back to original text
    const charStart = words.slice(0, start).join(' ').length + (start > 0 ? 1 : 0);
    const charEnd = charStart + chunk.length;

    chunks.push({ chunk, start: charStart, end: charEnd });

    // Move window with overlap
    start += maxLength - overlap;
  }

  return chunks;
}

/**
 * Merge entities from overlapping chunks
 * @param {Array} allEntities - Entities from all chunks
 * @returns {Array} - Deduplicated entities
 */
export function mergeChunkEntities(allEntities) {
  // Sort by start position
  const sorted = allEntities.sort((a, b) => a.start - b.start);

  // Dedup overlapping entities
  const merged = [];
  for (const entity of sorted) {
    const lastMerged = merged[merged.length - 1];

    // Check if overlaps with previous
    if (lastMerged && entity.start < lastMerged.end && entity.value === lastMerged.value) {
      // Skip duplicate
      continue;
    }

    merged.push(entity);
  }

  return merged;
}
```

---

### 6. Hybrid Detector Integration

**Location:** `src/detection/hybridDetector.js` (update existing)

**Gating Logic:**

```javascript
async detect(text, options = {}) {
  // Always run regex first (fast)
  const regexResults = detectPIIWithRegex(text, options.minConfidence);

  // Check if NER should run
  const shouldRunNER = await this.shouldUseNER(text, regexResults, options);

  if (!shouldRunNER) {
    return this.formatResults(regexResults, [], options);
  }

  // Run NER
  try {
    const nerResults = await this.runNERDetection(text, options);
    return this.mergeResults(regexResults, nerResults, options);
  } catch (error) {
    console.warn('[hybridDetector] NER failed, falling back to regex:', error);
    return this.formatResults(regexResults, [], options);
  }
}

async shouldUseNER(text, regexResults, options) {
  // Don't run if disabled
  if (!options.nerEnabled) return false;

  // Don't run if too short or too long
  if (text.length < 10 || text.length > 5000) return false;

  // Run if regex found PII
  if (regexResults.matches.length > 0) return true;

  // Run if heuristics suggest entities
  const hasNamePatterns = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
  const hasMixedCase = /[a-z].*[A-Z]|[A-Z].*[a-z]/.test(text);

  return hasNamePatterns || hasMixedCase;
}

async runNERDetection(text, options) {
  // Check cache first
  const cached = this.nerCache.get(hashText(text));
  if (cached) return cached;

  // Chunk text
  const chunks = chunkText(text, options.nerMaxSeqLength, options.nerChunkOverlap);

  // Process chunks in worker
  const allEntities = [];
  for (const { chunk, start, end } of chunks) {
    const entities = await this.nerWorker.detect(chunk, { timeout: options.nerTimeout });

    // Map offsets back to original text
    allEntities.push(...entities.map(e => ({
      ...e,
      start: start + e.start,
      end: start + e.end
    })));
  }

  // Merge and dedup
  const merged = mergeChunkEntities(allEntities);

  // Cache result
  this.nerCache.set(hashText(text), merged);

  return merged;
}

mergeResults(regexResults, nerResults, options) {
  // Combine and deduplicate
  const combined = [...regexResults.matches, ...nerResults];

  // Sort by position
  combined.sort((a, b) => a.start - b.start);

  // Dedup overlaps (prefer regex if conflict)
  const deduped = [];
  for (const match of combined) {
    const overlaps = deduped.some(d =>
      (match.start >= d.start && match.start < d.end) ||
      (match.end > d.start && match.end <= d.end)
    );

    if (!overlaps) {
      deduped.push(match);
    }
  }

  return this.formatResults(regexResults, nerResults, {
    ...options,
    matches: deduped
  });
}
```

---

### 7. Caching & Throttling

**Location:** `src/utils/nerCache.js` (to be created)

```javascript
// LRU Cache for NER results
class NERCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Move to end (LRU)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  set(key, value) {
    // Remove oldest if full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// Text hash for cache key
export function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
```

**Throttling:**
- Debounce NER calls during fast typing (300ms)
- Reuse worker session across calls
- Skip NER if same text detected within 1s

---

## UI/UX Flow

### First-Time Enable

1. User toggles "Enhanced Detection (NER)" ON
2. Check `nerNeverAsk` setting
   - If `true`: Show toast "NER disabled by user preference"
   - If `false`: Show download prompt modal
3. User clicks "Download now"
   - Show progress bar
   - Download model to IndexedDB (~10-15 MB)
   - Initialize NER worker
   - Update `nerModelDownloaded = true`
   - Show success toast "NER ready"
4. Status chip updates: "NER: Ready" (green)

### User clicks "Not now"
- Modal closes
- Toggle reverts to OFF
- Status chip: "NER: Disabled"

### User clicks "Always use regex only"
- Set `nerNeverAsk = true`
- Modal closes
- Toggle disabled (grayed out)
- Show tooltip: "You chose to always use regex only. Reset in settings."

### Detection with NER

1. User types PII in input field
2. Regex detects PII → triggers NER gate
3. Status chip shows "NER: Loading..." with spinner
4. NER worker processes text
5. Results merged and displayed
6. Panel shows:
   ```
   Detected: 5 items (2 NER, 3 regex)

   - john.doe@example.com [regex] • High
   - John Doe [NER] • Medium
   - 555-1234-5678 [regex] • High
   ...
   ```
7. Tooltip on hover: explains source + confidence

### NER Unavailable (offline, error, timeout)

1. Detection runs
2. NER fails (timeout or error)
3. Fall back to regex-only
4. Show inline notice: "Using regex only (NER unavailable)"
5. Status chip: "NER: Error" (red) with hover tooltip

---

## Performance Guardrails

### Memory
- Model size: ~10-15 MB (one-time download)
- Runtime RAM: ~50-120 MB during inference
- Cache: Max 100 text hashes (~1 MB)

### Speed
- Regex: ~5-20ms (always runs)
- NER: ~100-300ms per 256-token chunk
- Timeout: 5s max (fallback to regex)

### Gating
- Skip if text < 10 chars or > 5000 chars
- Skip if no regex matches AND no name patterns
- Cache results per text hash

---

## Privacy & Security

✅ **100% Local Processing**
- Model runs in Web Worker (browser sandbox)
- No data sent to external servers
- IndexedDB storage (local only)

✅ **User Control**
- Explicit opt-in (toggle)
- Download prompt with clear explanation
- "Never ask" option for users who decline

✅ **Transparency**
- Clear status indicators
- Performance impact explained
- Source attribution in UI (regex vs NER)

---

## Testing Plan

### Unit Tests
- Text chunking logic
- Entity merging/deduplication
- Cache hit/miss behavior
- Text hash collision

### Integration Tests
- Worker initialization
- Timeout handling
- Fallback to regex-only
- Model download progress

### E2E Tests
1. Enable NER → Download model → Detect PII
2. Disable NER → Detect PII (regex only)
3. NER timeout → Fallback to regex
4. Reload extension → NER state persists

---

## Rollout Strategy

### Phase 1: UI Only (Current)
- ✅ Settings UI
- ✅ Modals
- ✅ Status indicators
- ✅ CSS styles

### Phase 2: Settings & Storage (Next)
- Settings schema
- IndexedDB integration
- Popup JS handlers

### Phase 3: Worker & Chunking
- NER worker implementation
- Text chunking utility
- ONNX Runtime integration

### Phase 4: Hybrid Integration
- Update hybridDetector
- Gating logic
- Result merging

### Phase 5: Caching & Optimization
- LRU cache
- Throttling
- Performance tuning

### Phase 6: Testing & Polish
- All tests passing
- Performance benchmarks
- User acceptance testing

---

## Implementation Status

| Component | Status | File |
|-----------|--------|------|
| UI Components | ✅ DONE | `html/popup.html` |
| CSS Styles | ✅ DONE | `src/styles/popup.css` |
| Version Bump | ✅ DONE | `manifest.json`, `package.json` |
| Settings Schema | ⏳ TODO | `src/utils/settingsStorage.js` |
| Popup JS Handlers | ⏳ TODO | `src/ui/popup.js` |
| NER Worker | ⏳ TODO | `src/workers/ner-worker.js` |
| Text Chunker | ⏳ TODO | `src/utils/textChunker.js` |
| NER Cache | ⏳ TODO | `src/utils/nerCache.js` |
| Hybrid Integration | ⏳ TODO | `src/detection/hybridDetector.js` |
| Tests | ⏳ TODO | `tests/ner/` |

---

## Next Steps

1. Update settings storage schema
2. Create popup.js handlers for NER UI
3. Implement NER worker skeleton
4. Add text chunking utilities
5. Integrate with hybridDetector
6. Test end-to-end
7. Optimize performance

---

## Open Questions

1. **Model Selection:** Use DistilBERT or smaller MobileNet variant?
2. **CDN vs Bundled:** Host model on CDN or bundle with extension?
3. **Progressive Download:** Download model in chunks with progress?
4. **Entity Types:** Map NER entities (PERSON, ORG, LOC) to PII types?
5. **Confidence Calibration:** How to normalize NER confidence to match regex scale?

---

## Success Criteria

✅ NER detects person names, organizations, locations
✅ < 300ms latency for typical inputs (< 500 chars)
✅ Graceful fallback when NER unavailable
✅ Clear UI indicators for source (regex/NER/hybrid)
✅ User can enable/disable without page refresh
✅ No impact on extension when NER disabled
✅ All privacy guarantees maintained (100% local)

---

**Version:** 1.3.0
**Status:** UI Complete, Backend In Progress
**Target:** Full NER integration with user-controlled opt-in
