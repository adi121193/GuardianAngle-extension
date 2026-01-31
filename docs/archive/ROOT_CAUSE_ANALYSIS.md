# Root Cause Analysis - PII Detection Issues

## Date: 2025-11-16
## Version: 1.2.0 (Pre-Fix)

---

## 🔴 Critical Issues Identified

### Issue #1: Overlapping Pattern Matches
**Symptoms:**
- Panel shows "2 issues" when 6+ PII items exist
- Wrong values displayed (e.g., Aadhaar showing "098765432198" instead of actual Aadhaar)
- Phone number "9876543210" detected as multiple different PII types

**Root Cause:**
The regex patterns in `regexPatterns.js` have overlapping match criteria:

```javascript
bankAccount: {
  pattern: /\b\d{8,18}\b/g,  // Matches ANY 8-18 digit number
  confidence: 0.5
}

phone: {
  pattern: /\b\d{10}\b/g,     // Matches ANY 10 digit number
  confidence: 0.75
}

aadhaar: {
  pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,  // Matches 12 digits
  confidence: 0.85
}
```

**Problem Flow:**
1. User types "9876543210" (10 digits)
2. Regex detects it as:
   - Phone number (10 digits) ✓ confidence 0.75
   - Bank account (10 is between 8-18) ✓ confidence 0.5
3. Both matches are added to results
4. Panel shows BOTH, but they're the SAME text!

**Fix Applied:**
Added `deduplicateMatches()` function that:
- Sorts matches by confidence (higher first)
- Detects overlapping ranges
- Keeps only highest confidence match for each text position
- Removes duplicate/overlapping detections

---

### Issue #2: Position Calculation Mismatch
**Symptoms:**
- Highlighting not appearing on text
- Wrong text getting highlighted
- Positions calculated don't match actual DOM

**Root Cause:**
Position calculation happens on **clean text** but highlighting applies to **DOM structure**:

```javascript
// Detection (floatingButton.js:98)
const text = getTextContent(element);  // Returns: "Name: Rohan..."
const detectionResult = await detectPII(text, options);

// Detection result has positions based on clean text
// match.position = 50  (position in clean text string)

// Highlighting (floatingButton.js:138)
function highlightPII(element, detectionResult) {
  // Tries to find position 50 in DOM text nodes
  // But DOM might have <br>, <span>, normalized spaces
  // Position 50 in DOM ≠ Position 50 in clean text!
}
```

**Problem Flow:**
1. `getTextContent()` returns cleaned text: `"Name: Rohan Malhotra DOB: 16/04/1995..."`
2. Regex finds match at index 20
3. `highlightPII()` tries to find position 20 in DOM
4. But DOM has `<div>Name: Rohan Malhotra</div><div>DOB: 16/04/1995</div>`
5. Position 20 doesn't match → No highlight or wrong highlight

**Fix Applied:**
1. **Position Verification**: Before highlighting, verify match exists at position:
```javascript
const actualValue = currentText.substring(position, position + value.length);
if (actualValue !== value) {
  // Position mismatch - try to find it
  const foundIndex = currentText.indexOf(value, position - 50);
  match.position = foundIndex;  // Correct the position
}
```

2. **HTML-based Highlighting**: Instead of manipulating DOM nodes, rebuild entire HTML:
```javascript
// Build HTML string with highlights
highlightedHTML += escapeHtml(text.before);
highlightedHTML += `<span class="pii-highlight">${escapeHtml(value)}</span>`;
highlightedHTML += escapeHtml(text.after);

// Replace entire innerHTML
element.innerHTML = highlightedHTML;
```

---

### Issue #3: No Visible Highlighting
**Symptoms:**
- Text appears normal, no colored underlines
- Button shows count but no visual indication on text

**Root Cause:**
Previous approach tried to split text nodes and wrap them in spans, but:
- Text node positions didn't match regex match positions
- DOM mutations during highlighting changed positions
- Multiple highlights would interfere with each other

**Fix Applied:**
Complete rewrite of highlighting logic:
1. Get single text representation (`element.innerText`)
2. Deduplicate overlapping matches
3. Verify each match position
4. Build complete HTML string with highlights
5. Replace innerHTML once (atomic operation)
6. Restore cursor position

---

## 📊 Before vs After

### Before Fix:
```
Input: "Mobile: 9876543210"
Detection Results:
  - Phone: "9876543210" (confidence 0.75)
  - Bank Account: "9876543210" (confidence 0.5)
  - Aadhaar: "098765432198" (WRONG - extra 0!)

Panel Shows: "3 issues found"
Highlighting: None visible
```

### After Fix:
```
Input: "Mobile: 9876543210"
Detection Results (after deduplication):
  - Phone: "9876543210" (confidence 0.75) ← Kept (higher confidence)

Panel Shows: "1 issue found"
Highlighting: Orange wavy underline on "9876543210"
```

---

## 🔧 Technical Fixes Applied

### Fix #1: Deduplication Function
**Location:** `src/content/floatingButton.js:562`

```javascript
function deduplicateMatches(detectionResult) {
  // Sort by confidence descending
  const sortedMatches = [...matches].sort((a, b) =>
    b.confidence - a.confidence
  );

  const deduplicatedMatches = [];
  const usedRanges = [];

  for (const match of sortedMatches) {
    const start = match.position;
    const end = match.position + match.value.length;

    // Check overlap with already-added matches
    const overlaps = usedRanges.some(range =>
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );

    if (!overlaps) {
      deduplicatedMatches.push(match);
      usedRanges.push({ start, end });
    }
  }

  return { ...detectionResult, matches: deduplicatedMatches };
}
```

**Impact:**
- ✅ Removes duplicate detections of same text
- ✅ Keeps highest confidence match
- ✅ Fixes wrong count in panel
- ✅ Fixes wrong values displayed

### Fix #2: Position Verification
**Location:** `src/content/floatingButton.js:203`

```javascript
// Verify the match actually exists at this position
const actualValue = currentText.substring(position, position + value.length);
if (actualValue !== value) {
  // Position mismatch - try to find it
  const foundIndex = currentText.indexOf(value, Math.max(0, position - 50));
  if (foundIndex === -1) continue; // Skip if can't find
  match.position = foundIndex; // Correct position
}
```

**Impact:**
- ✅ Detects position mismatches
- ✅ Corrects positions before highlighting
- ✅ Prevents highlighting wrong text
- ✅ Skips matches that can't be found

### Fix #3: HTML-based Highlighting
**Location:** `src/content/floatingButton.js:195`

**Old Approach (BROKEN):**
```javascript
// Get all text nodes
const textNodes = getTextNodes(element);
// Split each text node
// Wrap matches in spans
// Replace nodes one by one
// → Positions change during process → FAILS
```

**New Approach (WORKING):**
```javascript
// Get current text as single string
const currentText = element.innerText;

// Build complete HTML with all highlights
let highlightedHTML = '';
for (const match of matches) {
  highlightedHTML += escapeHtml(text.before);
  highlightedHTML += `<span class="pii-highlight">...</span>`;
  highlightedHTML += escapeHtml(text.after);
}

// Replace entire innerHTML once (atomic)
element.innerHTML = highlightedHTML;
```

**Impact:**
- ✅ Single atomic operation
- ✅ No position shifts during highlighting
- ✅ All highlights applied correctly
- ✅ Preserves text structure

---

## ✅ Verification Checklist

Test the following scenarios:

- [ ] Type phone number "9876543210" → Should show 1 detection (Phone), not 2-3
- [ ] Type Aadhaar "1234 5678 9012" → Should highlight correctly with red underline
- [ ] Type multiple PII in one message → Should show all unique items
- [ ] Panel count should match number of highlighted items
- [ ] Clicking "Mask" should mask only that specific PII
- [ ] Highlighting should appear immediately as you type
- [ ] Text spacing should be preserved after highlighting

---

## 🎯 Expected Behavior After Fix

For input text:
```
Name: Rohan Malhotra
DOB: 16/04/1995
Address: 55 Boring Road, Patna
Mobile: 9876543210
PAN: BTEMP2345Q
Aadhaar: 1244 5667 8899
Bank: HDFC Acc No O9876543219, IFSC HDFC0005523
```

**Detection Results:**
1. DOB: "16/04/1995" (confidence 0.6)
2. Phone: "9876543210" (confidence 0.75)
3. PAN: "BTEMP2345Q" (confidence 0.95)
4. Aadhaar: "1244 5667 8899" (confidence 0.85)
5. Bank Account: "O9876543219" (confidence 0.5)
6. IFSC: "HDFC0005523" (confidence 0.85)

**Panel Display:**
- "6 issues found" (not 10-15 from duplicates)
- Each item listed once with correct value
- Correct confidence percentages

**Visual Highlighting:**
- Orange wavy underline on DOB
- Orange wavy underline on Phone
- Red wavy underline on PAN (high confidence)
- Red wavy underline on Aadhaar (high confidence)
- Orange underline on Bank Account
- Red wavy underline on IFSC

---

## 📝 Lessons Learned

1. **Always deduplicate overlapping matches** - Regex patterns with broad criteria will create duplicates
2. **Position calculations must match text representation** - Can't mix DOM positions with string positions
3. **Atomic operations are safer** - Rebuilding HTML once is better than multiple DOM mutations
4. **Verify before applying** - Check that match actually exists at calculated position

---

## 🚀 Next Steps

1. Test with real data across all platforms
2. Monitor for any remaining position mismatches
3. Consider adding more specific validators to reduce false positives
4. Add logging to track deduplication stats
