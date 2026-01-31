# Deep Dive: Spacing Problem Analysis

## Issue Summary
Despite fixes being added, the spacing normalization is **incomplete** and **not working** in the built extension.

---

## Problem 1: Masking Adds Spaces - PARTIALLY FIXED ✅

### Root Cause (OLD)
Original mask functions like `maskAadhaar()` would return hardcoded formats:
```javascript
// OLD CODE (REMOVED)
export function maskAadhaar(aadhaar) {
  const cleaned = aadhaar.replace(/\s/g, '');
  const last4 = cleaned.slice(-4);
  return `XXXX XXXX ${last4}`;  // ❌ Hardcoded spaces!
}
```

**Problem:** If user typed `123456789012` (no spaces), masking returned `XXXX XXXX 9012` (with spaces), adding extra whitespace.

### Current Fix (SOURCE) ✅
Source code now uses `applyOriginalFormatting()`:
```javascript
// NEW CODE (src/utils/maskRules.js lines 12-18)
export function maskAadhaar(aadhaar) {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return aadhaar;

  const maskedDigits = 'XXXXXXXX' + digits.slice(-4);
  return applyOriginalFormatting(aadhaar, maskedDigits); // ✅ Preserves format!
}

// Utility function (src/utils/maskRules.js lines 217-237)
function applyOriginalFormatting(original, maskedDigits) {
  let digitIndex = 0;
  const maskedChars = [];

  for (const ch of original) {
    if (/\d/.test(ch)) {
      maskedChars.push(maskedDigits[digitIndex] || '');
      digitIndex++;
    } else {
      maskedChars.push(ch);  // Preserve spaces, dashes, etc.
    }
  }

  return maskedChars.join('');
}
```

**Result:**
- Input: `123456789012` → Masked: `XXXXXXXX9012` (no spaces added)
- Input: `1234 5678 9012` → Masked: `XXXX XXXX 9012` (preserves original spaces)

### Verification in Dist ✅
```bash
$ grep -A 12 "function applyOriginalFormatting" dist/content/monitorInputs.js
```

**Confirmed:** The function IS bundled correctly in dist/content/monitorInputs.js

**Status:** ✅ FIXED in source, ✅ BUILT correctly

---

## Problem 2: Remove Leaves Double Spaces - NOT FIXED ❌

### Root Cause
`removeSinglePII()` replaces PII with a space but doesn't collapse multiple spaces:

**Current Code (src/content/floatingButton.js lines 932-936):**
```javascript
async function removeSinglePII(element, detectionResult, index) {
  removeHighlights(element);
  const text = getTextContent(element);
  const match = detectionResult.matches[index];

  // Replace with space and normalize spacing to avoid double spaces
  let newText = text.replace(match.value, ' ');
  newText = newText.replace(/\u00A0/g, ' '); // normalize NBSP
  // ❌ MISSING: .replace(/\s{2,}/g, ' ').trim()

  setTextContent(element, newText);
}
```

**Problem Example:**
- Original: `"Contact me at 9876543210 or email me"`
- After removing phone: `"Contact me at  or email me"` ← double space!
- Expected: `"Contact me at or email me"` ← single space

### What's Missing
The comment says "normalize spacing" but the actual normalization code is missing:
```javascript
newText = newText.replace(/\s{2,}/g, ' ').trim();  // ❌ NOT PRESENT!
```

### Verification in Dist ❌
```bash
$ sed -n '2405,2420p' dist/content/monitorInputs.js
```

**Output:**
```javascript
async function removeSinglePII(element, detectionResult, index) {
  removeHighlights(element);
  const text = getTextContent(element);
  const match = detectionResult.matches[index];
  let newText = text.replace(match.value, " ");
  newText = newText.replace(/\u00A0/g, " ");  // Only replaces NBSP
  setTextContent(element, newText);           // No space collapsing!
}
```

**Status:** ❌ NOT FIXED - Only replaces NBSP, doesn't collapse multiple spaces

---

## Problem 3: Background Detection Still Primitive - FIXED BUT NOT NEEDED ✅

### Current Architecture
Background doesn't actually DO detection - it only:
1. Manages stats (INCREMENT_DETECTION message)
2. Handles NER initialization
3. Proxies NER inference requests

ALL actual detection happens in **content scripts**.

### Verification
The dist/background/serviceWorker.js DOES include strict validators (lines 196-711):
- Verhoeff tables (lines 196-217)
- validateAadhaarChecksum (lines 218-235)
- All validator functions (lines 236-412)
- PII_PATTERNS with priorities (lines 414-595)
- detectPIIWithRegex (lines 596-711)
- detectPIIInText (lines 719-740)

**However:** `detectPIIInText` is NEVER CALLED in the background. It's exposed via:
```javascript
self.__detectPIIInText = detectPIIInText;  // line 741
```

But no message handlers use it. The background only manages stats, not detection.

**Status:** ✅ BUNDLED correctly but ⚠️ UNUSED (by design)

---

## Problem 4: Reading-Only Content - BY DESIGN

The extension only scans what users **type/paste**, not existing chat history.

**Why:**
- Performance: Scanning entire DOM on every chat load would be expensive
- Privacy: Users may intentionally share PII in chats (e.g., discussing security)
- UX: False positives on existing messages would be annoying

**Current Behavior:**
- Monitors input fields via `monitorInputs.js`
- Detects on `input`, `focus`, `paste`, `blur` events
- Does NOT scan pre-existing DOM content

**Status:** ⚠️ BY DESIGN, not a bug

---

## Fix Plan

### 1. Fix removeSinglePII Spacing ❌ URGENT
**File:** `src/content/floatingButton.js` line 932-936

**Current:**
```javascript
let newText = text.replace(match.value, ' ');
newText = newText.replace(/\u00A0/g, ' '); // normalize NBSP
```

**Should be:**
```javascript
let newText = text.replace(match.value, ' ');
newText = newText.replace(/\u00A0/g, ' '); // normalize NBSP
newText = newText.replace(/\s{2,}/g, ' ').trim(); // ✅ Collapse multiple spaces
```

**Impact:** Prevents double spaces when removing PII

### 2. Masking Preserves Format ✅ ALREADY FIXED
No action needed - source uses `applyOriginalFormatting()` and dist has it bundled.

### 3. Background Detection ✅ ALREADY BUNDLED
No action needed - validators are bundled, just not used (by design).

### 4. Scan Existing Content (Optional Enhancement)
**IF** requested by user, could add:
- MutationObserver on chat containers
- Scan new messages as they appear
- Highlight PII in existing text

**But:** Current behavior (scan only inputs) is intentional.

---

## Testing After Fix

### Test Case 1: Remove PII Spacing
1. Input: `"My phone is 9876543210 and email is test@example.com"`
2. Click "Remove" on phone number
3. **Expected:** `"My phone is and email is test@example.com"` (single space)
4. **Bug if:** `"My phone is  and email is test@example.com"` (double space)

### Test Case 2: Mask Preserves Format
1. Input: `"Aadhaar: 123456789012"` (no spaces)
2. Click "Mask"
3. **Expected:** `"Aadhaar: XXXXXXXX9012"` (no spaces added)

1. Input: `"Aadhaar: 1234 5678 9012"` (with spaces)
2. Click "Mask"
3. **Expected:** `"Aadhaar: XXXX XXXX 9012"` (preserves spaces)

### Test Case 3: Repeated Actions
1. Input: `"Phone: 9876543210, Email: test@example.com"`
2. Click "Mask" on phone
3. Click "Remove" on email
4. **Expected:** No extra spaces anywhere

---

## Summary

| Issue | Status | Location | Fix Needed |
|-------|--------|----------|------------|
| Masking adds spaces | ✅ FIXED | src/utils/maskRules.js | None - already uses applyOriginalFormatting |
| Remove leaves double spaces | ❌ NOT FIXED | src/content/floatingButton.js:933 | Add `.replace(/\s{2,}/g, ' ').trim()` |
| Background detection primitive | ✅ BUNDLED | dist/background/serviceWorker.js | None - unused by design |
| Doesn't scan existing content | ⚠️ BY DESIGN | - | Optional enhancement |

**Critical Fix:** Only #2 needs immediate attention - add space collapsing to `removeSinglePII()`.
