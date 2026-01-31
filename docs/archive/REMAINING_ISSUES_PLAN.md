# Remaining Issues - Execution Plan

## Current Status

### ✅ Fixed
1. **Strict validators in bundle**: `dist/content/detectText.js` includes Verhoeff checksum, first-digit rule, priority routing
2. **detectionMode mapping**: `detectionMode` → `mode` works correctly
3. **Positions in hybrid results**: `position`, `start`, `end` now present for masking/highlighting

### 🚫 Still Broken
1. **NER not wired**: Content scripts can't call NER inference (missing offscreen manager bridge)
2. **Background patterns primitive**: `serviceWorker.js` still uses loose regex without validators
3. **No NER bridge**: Content → Background → Offscreen NER calls don't work

---

## Issue #1: NER Not Wired in Content Scripts

### Problem
```javascript
// src/content/monitorInputs.js:704
enableNER(true);  // Just sets a flag, no offscreen manager!

// src/detection/hybridDetector.js:256
const result = await this.offscreenManager.runInference(text);
// ❌ this.offscreenManager is undefined → returns {entities: []}
```

**Root cause**: Content scripts can't directly access the offscreen manager (it lives in background context). They need a messaging bridge.

### Solution: Create Offscreen Manager Proxy

**Step 1**: Create a proxy in content script that forwards NER calls to background
```javascript
// src/ml/offscreenManagerProxy.js (NEW FILE)
/**
 * Proxy for offscreen manager in content script
 * Forwards NER inference requests to background script
 */
export class OffscreenManagerProxy {
  constructor() {
    this.isReady = false;
  }

  /**
   * Run NER inference via background script
   */
  async runInference(text) {
    if (!this.isReady) {
      return { success: false, error: 'NER not ready', entities: [] };
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RUN_NER_INFERENCE',
        text: text
      });

      return response;
    } catch (error) {
      console.error('[OffscreenManagerProxy] Inference failed:', error);
      return { success: false, error: error.message, entities: [] };
    }
  }

  setReady(ready) {
    this.isReady = ready;
  }
}

export const offscreenManagerProxy = new OffscreenManagerProxy();
```

**Step 2**: Update monitorInputs.js to pass proxy to hybridDetector
```javascript
// src/content/monitorInputs.js
import { offscreenManagerProxy } from '../ml/offscreenManagerProxy.js';

// In NER_READY handler:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NER_READY') {
    console.log('PII Guardian: NER ready notification received');

    // Set proxy as ready
    offscreenManagerProxy.setReady(true);

    // Enable NER and pass proxy to hybridDetector
    enableNER(offscreenManagerProxy);  // ← CHANGED: Pass proxy object
    nerInitialized = true;

    sendResponse({ success: true });
  }
  return false;
});
```

**Step 3**: Update detectText.js to accept offscreen manager
```javascript
// src/content/detectText.js
export function enableNER(offscreenManagerOrFlag) {
  if (offscreenManagerOrFlag === true) {
    // Legacy support: just set flag
    nerEnabled = true;
    console.log('[detectText] NER detection enabled (flag only)');
  } else if (offscreenManagerOrFlag) {
    // NEW: Pass offscreen manager (or proxy) to hybridDetector
    hybridDetector.setOffscreenManager(offscreenManagerOrFlag);
    nerEnabled = true;
    console.log('[detectText] NER detection enabled with offscreen manager');
  }
}
```

**Step 4**: Add handler in background serviceWorker
```javascript
// src/background/serviceWorker.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_NER_INFERENCE') {
    (async () => {
      try {
        const result = await offscreenManager.runInference(message.text);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
          entities: []
        });
      }
    })();
    return true; // Keep channel open for async response
  }
  // ... existing handlers
});
```

---

## Issue #2: Background Patterns Still Primitive

### Problem
```javascript
// src/background/serviceWorker.js (CURRENT - WRONG!)
import { detectPIIWithRegex } from '../utils/regexPatterns.js';

function detectPIIInText(text) {
  // ❌ This import doesn't work in the current bundle!
  // The background script is bundled separately and doesn't include validators
}
```

**Root cause**: Background service worker is bundled separately and the import path isn't resolving correctly.

### Solution: Ensure Validators Available in Background

**Step 1**: Check esbuild.config.js to ensure validators are bundled
```javascript
// esbuild.config.js
const entryPoints = [
  'src/background/serviceWorker.js',
  'src/content/monitorInputs.js',
  'src/content/detectImage.js',
  'src/content/floatingButton.js',
  'src/ui/popup.js',
  'src/ui/settings.js',
  'src/ui/dashboard.js',
  'src/ui/history.js',
  'src/ui/license.js',
  'src/ml/offscreen.js',
  // Make sure validators are accessible
];
```

**Step 2**: Verify the import actually works
```javascript
// Add debug logging in serviceWorker.js
import { detectPIIWithRegex } from '../utils/regexPatterns.js';

console.log('[ServiceWorker] detectPIIWithRegex:', typeof detectPIIWithRegex);
// Should log: [ServiceWorker] detectPIIWithRegex: function

function detectPIIInText(text) {
  if (!detectPIIWithRegex) {
    console.error('[ServiceWorker] detectPIIWithRegex not available!');
    // Fallback to primitive patterns
    return { detected: false, types: [] };
  }

  const result = detectPIIWithRegex(text, 0.6);
  return {
    detected: result.piiDetected,
    types: result.types,
    matches: result.matches.map(m => m.value),
    count: result.matches.length,
    details: result.matches,
    ambiguous: result.ambiguousMatches || []
  };
}
```

**Step 3**: If import doesn't work, inline the validators

Option A: Copy validators to background (not ideal but works):
```javascript
// src/background/validators.js (copy from src/utils/validators.js)
// Include: validateAadhaarChecksum, validateIndianPhone, etc.
```

Option B: Use shared build output:
```javascript
// esbuild.config.js - create a shared bundle
{
  entryPoints: ['src/utils/validators.js'],
  outfile: 'dist/utils/validators.js',
  format: 'esm',
  bundle: true
}
```

---

## Issue #3: NER Status Events Missing Bridge

### Problem
- Background initializes NER and broadcasts `NER_READY`
- Content receives `NER_READY` but has no way to call `offscreenManager.runInference()`
- Result: "hybrid" mode runs regex-only

### Solution: Message-Based NER Bridge

**Architecture**:
```
Content Script (monitorInputs.js)
  ↓ (creates offscreenManagerProxy)
  ↓
hybridDetector.detect(text)
  ↓ (calls proxy.runInference)
  ↓
offscreenManagerProxy
  ↓ (chrome.runtime.sendMessage)
  ↓
Background (serviceWorker.js)
  ↓ (receives RUN_NER_INFERENCE)
  ↓
offscreenManager.runInference(text)
  ↓ (runs in offscreen document)
  ↓
Returns: { success: true, entities: [...] }
  ↓
Content receives response
  ↓
hybridDetector merges with regex results
```

**Implementation**: See Issue #1 solution above for complete code.

---

## Execution Plan

### Phase 1: Fix NER Wiring (30 min)
1. ✅ Create `src/ml/offscreenManagerProxy.js`
2. ✅ Update `src/content/monitorInputs.js` to pass proxy
3. ✅ Update `src/content/detectText.js` to accept manager
4. ✅ Add `RUN_NER_INFERENCE` handler in `src/background/serviceWorker.js`
5. ✅ Test: Content → Background → Offscreen NER call works

### Phase 2: Fix Background Validators (15 min)
1. ✅ Verify import in `serviceWorker.js` works after rebuild
2. ✅ Add debug logging to confirm validators loaded
3. ✅ Test: Background detection uses strict validators
4. ✅ Alternative: Copy validators to background if import fails

### Phase 3: Test End-to-End (15 min)
1. ✅ Load extension in Chrome
2. ✅ Check console for NER_READY and offscreenManager logs
3. ✅ Test hybrid detection with:
   - Phone: `9876543210`
   - Invalid Aadhaar: `1244 5667 8899`
   - Valid Aadhaar: `234123456789` (if checksum valid)
   - Unstructured: `My name is John Smith` (NER should detect PERSON)
4. ✅ Verify NER actually runs (check performance metrics)
5. ✅ Check background stats use strict detection

### Phase 4: Rebuild and Deploy (5 min)
1. ✅ `npm run build`
2. ✅ Verify all changes in `dist/`
3. ✅ Reload extension
4. ✅ Final verification

---

## Verification Checklist

### NER Wiring ✓
- [ ] `offscreenManagerProxy` created
- [ ] `monitorInputs.js` passes proxy to `enableNER()`
- [ ] `hybridDetector` calls `proxy.runInference()`
- [ ] Background handles `RUN_NER_INFERENCE` message
- [ ] Console shows: "Running NER inference..." when hybrid mode used
- [ ] Performance metrics show `nerTime > 0`

### Background Validators ✓
- [ ] `detectPIIWithRegex` imported in `serviceWorker.js`
- [ ] Console shows: `typeof detectPIIWithRegex = 'function'`
- [ ] Phone `9876543210` not flagged as Aadhaar in background
- [ ] Invalid Aadhaar `1244 5667 8899` rejected by background
- [ ] Background stats consistent with content detection

### Integration ✓
- [ ] Extension loads without errors
- [ ] NER_READY message received
- [ ] Hybrid mode runs both regex + NER
- [ ] Positions present in all detections
- [ ] Ambiguous matches shown in UI
- [ ] Masking works correctly

---

## Rollback Plan

If NER bridge causes issues:
1. Keep `enableNER(true)` flag-only (fallback to regex-only)
2. Add feature flag: `settings.enableNERBridge`
3. Test with bridge disabled first, then enable gradually

If background validators break:
1. Revert to primitive patterns in background only
2. Content scripts use strict validators (most important)
3. Note: Background stats may be inconsistent but not critical

---

## Timeline

- **Phase 1** (NER wiring): 30 minutes
- **Phase 2** (Background validators): 15 minutes
- **Phase 3** (Testing): 15 minutes
- **Phase 4** (Rebuild): 5 minutes

**Total**: ~65 minutes (~1 hour)

---

## Success Criteria

1. ✅ Content scripts can call NER inference via proxy
2. ✅ Background uses same strict validators as content
3. ✅ Hybrid mode shows `nerTime > 0` in performance metrics
4. ✅ Phone `9876543210` never mislabeled as Aadhaar (anywhere)
5. ✅ Invalid Aadhaar `1244 5667 8899` rejected (anywhere)
6. ✅ Unstructured text gets NER entity detection
7. ✅ All tests pass, no console errors

---

## Files to Modify

### New Files
- [ ] `src/ml/offscreenManagerProxy.js` (NEW)

### Existing Files
- [ ] `src/content/monitorInputs.js` (pass proxy)
- [ ] `src/content/detectText.js` (accept manager)
- [ ] `src/background/serviceWorker.js` (add handler, verify import)
- [ ] `src/detection/hybridDetector.js` (already has setOffscreenManager)

### Build
- [ ] `npm run build`
- [ ] Verify `dist/` contents

---

## Next Steps

Ready to execute? Let's start with Phase 1: Creating the offscreen manager proxy.
