# Spacing Issue - Root Cause & Complete Fix

## The Real Problem

When you click the floating button and choose "Mask All", random spaces were being added. Here's why:

### The Broken Cycle

1. **User types text** with whitespace (spaces, newlines, etc.)
   ```
   Email: test@example.com
   Phone: 9876543210
   ```

2. **Extension highlights PII** by converting text to HTML:
   ```javascript
   element.innerHTML = 'Email: <span class="pii-highlight">test@example.com</span>\nPhone: <span>9876543210</span>';
   ```

3. **User clicks "Mask All"**

4. **Extension reads text back from DOM:**
   ```javascript
   const text = getTextContent(element);  // Uses clone.textContent
   ```

5. **🐛 BUG: Browsers can change whitespace when converting HTML → textContent!**
   - `innerHTML` with `<span>` tags → `textContent` conversion
   - Browsers may normalize, add, or remove whitespace
   - This corrupted the original formatting

6. **Extension masks the corrupted text** and sets it back
   - Result: Random spacing appears!

## Why This Happened

The code was reading text FROM THE DOM after highlighting:
```javascript
// floatingButton.js - OLD CODE
async function maskAllPII(element, detectionResult) {
  removeHighlights(element);
  const text = getTextContent(element);  // ❌ Reads from DOM (corrupted!)
  const maskedText = maskText(text, detectionResult.matches);
  setTextContent(element, maskedText);
}
```

`getTextContent()` clones the element and uses `clone.textContent`, which can have different whitespace than the original!

## The Complete Fix

**Store the original text BEFORE highlighting**, then use THAT for masking:

### 1. Added Storage for Original Text (line 14)
```javascript
const originalText = new WeakMap(); // Store original text before highlighting
```

### 2. Store Text Before Highlighting (line 198)
```javascript
// In runDetection() function
detectionResults.set(element, deduplicatedResult);
originalText.set(element, text);  // ✅ Save original!
```

### 3. Use Stored Text for Masking (line 913-914)
```javascript
async function maskSinglePII(element, detectionResult, index) {
  removeHighlights(element);

  // ✅ Use stored original text, NOT DOM text
  const text = originalText.get(element) || getTextContent(element);
  const match = detectionResult.matches[index];

  const maskedText = maskText(text, [match]);
  setTextContent(element, maskedText);
}
```

### 4. Use Stored Text for Removing (line 933)
```javascript
async function removeSinglePII(element, detectionResult, index) {
  removeHighlights(element);

  // ✅ Use stored original text
  const text = originalText.get(element) || getTextContent(element);
  const match = detectionResult.matches[index];

  let newText = text.replace(match.value, ' ');
  newText = newText.replace(/\u00A0/g, ' ');
  newText = newText.replace(/\s{2,}/g, ' ').trim();  // Collapse spaces

  setTextContent(element, newText);
}
```

### 5. Use Stored Text for Mask All (line 954)
```javascript
async function maskAllPII(element, detectionResult) {
  removeHighlights(element);

  // ✅ Use stored original text
  const text = originalText.get(element) || getTextContent(element);
  const maskedText = maskText(text, detectionResult.matches);
  setTextContent(element, maskedText);
}
```

### 6. Cleanup (line 124-125)
```javascript
detectionResults.delete(element);
originalText.delete(element);  // ✅ Clean up stored text
```

## How It Works Now

```
┌─────────────────────────────────────────────┐
│ 1. User types text                          │
│    "Email: test@example.com\nPhone: 123"   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Extension detects PII                    │
│    ✅ Stores original text in WeakMap       │
│    originalText.set(element, text)          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Extension highlights PII                 │
│    element.innerHTML = "Email: <span>...</span>" │
│    (DOM now has HTML tags)                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. User clicks "Mask All"                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Extension gets STORED text               │
│    ✅ const text = originalText.get(element) │
│    (Uses original, NOT corrupted DOM text)  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 6. Extension masks with original text       │
│    ✅ Preserves exact original whitespace   │
└─────────────────────────────────────────────┘
```

## What Changed

| File | Lines Changed | What Changed |
|------|---------------|--------------|
| `src/content/floatingButton.js` | 14 | Added `originalText` WeakMap storage |
| `src/content/floatingButton.js` | 198 | Store original text before highlighting |
| `src/content/floatingButton.js` | 913 | Use stored text in `maskSinglePII()` |
| `src/content/floatingButton.js` | 933 | Use stored text in `removeSinglePII()` |
| `src/content/floatingButton.js` | 954 | Use stored text in `maskAllPII()` |
| `src/content/floatingButton.js` | 125 | Cleanup stored text in cleanup function |

## Testing

### Test Case 1: Mask Preserves Exact Whitespace
**Input:**
```
Email:



test@example.com

Phone: 9876543210
```

**Click "Mask All"**

**Expected Result:**
```
Email:



t***@example.com

Phone: 98****210
```
✅ Preserves the 3 blank lines exactly

### Test Case 2: Remove Collapses Whitespace
**Input:**
```
Email:



test@example.com

Phone: 9876543210
```

**Click "Remove" on email**

**Expected Result:**
```
Email: Phone: 9876543210
```
✅ Removes email and collapses all whitespace

### Test Case 3: Repeated Actions Don't Add Spaces
**Input:** `"Phone: 9876543210, Email: test@example.com"`

1. Click "Mask" on phone → `"Phone: 98****210, Email: test@example.com"`
2. Click "Remove" on email → `"Phone: 98****210, Email:"`

✅ No extra spaces added

## Summary

**Root Cause:** Reading text from DOM after highlighting corrupted whitespace

**Solution:** Store original text BEFORE highlighting, use stored text for all operations

**Result:**
- ✅ Masking preserves exact original whitespace
- ✅ Removing collapses whitespace properly
- ✅ No random spaces added
- ✅ Works with contentEditable and textarea elements

The spacing issue is now completely fixed!
