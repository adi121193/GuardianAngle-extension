# 🔧 Gemini Detection Fix - Implementation Plan

## Root Cause Confirmed

After code analysis, ChatGPT's diagnosis is **100% correct**:

### Issues Found:

1. ✅ **Detection IS working** - PII is being detected
2. ❌ **Modal NOT appearing** - Shadow DOM injection fails on Gemini
3. ❌ **No submission blocking** - Enter key not intercepted
4. ❌ **Counter bug** - "Blocked" increments without actual blocking
5. ❌ **contenteditable not fully supported** - Gemini uses `<div contenteditable="true">`

## Exact Code Problems

### Problem 1: Modal Injection (injectWarningUI.js)
**Current code**: Modal injects relative to input element
```javascript
// WRONG - attaches to wrong container
const container = document.createElement('div');
document.body.appendChild(container); // This part is OK
```

**But**: Shadow DOM styling might be hidden by Gemini's z-index

### Problem 2: Enter Key Not Blocked (monitorInputs.js)
**Missing code**: No Enter key interception
```javascript
// MISSING - should prevent submission
element.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    // Should check for PII and block if found
  }
});
```

### Problem 3: Stats Counter (storage.js)
**Current**: `incrementBlocked()` called on Cancel button
**Should**: Only increment when ACTUALLY preventing send

### Problem 4: Gemini-Specific Selectors
**Current patterns** (monitorInputs.js:42-48):
```javascript
const aiInputPatterns = [
  'prompt', 'chat', 'message', 'input', 'composer', 'editor'
];
```

**Missing**: Gemini-specific patterns:
- `ql-editor` (Quill editor)
- `input-area`
- `rich-textarea`

## Fix Implementation

### Fix 1: Update monitorInputs.js - Add Enter Key Blocking

Add BEFORE the modal appears:

```javascript
// NEW: Intercept Enter key BEFORE submission
element.addEventListener('keydown', async (event) => {
  // Check for Enter without Shift (submit action)
  if (event.key === 'Enter' && !event.shiftKey) {
    const text = getTextContent(event.target);

    // Quick PII check
    if (quickPIICheck(text)) {
      const enabled = await isEnabled();
      if (!enabled) return;

      const settings = await getSettings();
      const detectionResult = await detectPII(text, {
        minConfidence: settings.minConfidence,
        enabledTypes: settings.enabledPIITypes
      });

      if (detectionResult.piiDetected) {
        // BLOCK SUBMISSION
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Show modal
        const decision = await showWarningModal(detectionResult, event.target);

        // Only continue if user clicks "Send Anyway"
        if (decision.action === 'send') {
          // Allow send by simulating Enter again
          // (or do nothing and let user manually click send)
        } else if (decision.action === 'mask') {
          setTextContent(event.target, decision.maskedText);
        } else if (decision.action === 'cancel') {
          // Clear input if blockOnDetection enabled
          if (settings.blockOnDetection) {
            setTextContent(event.target, '');
          }
          await incrementBlocked(); // Count this as actually blocked
        }
      }
    }
  }
}, true); // Use capture phase
```

### Fix 2: Update isAIChatInput() - Add Gemini Selectors

```javascript
function isAIChatInput(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();

  // Check for contenteditable divs (Gemini, ChatGPT)
  if (element.contentEditable === 'true') {
    return true;
  }

  // Check for textarea and input elements
  if (tagName === 'textarea' || (tagName === 'input' && element.type === 'text')) {
    return true;
  }

  // ENHANCED: More aggressive pattern matching for Gemini
  const aiInputPatterns = [
    'prompt',
    'chat',
    'message',
    'input',
    'composer',
    'editor',
    'ql-editor',        // Quill editor (Gemini)
    'input-area',       // Gemini
    'rich-textarea',    // Gemini
    'textarea-content', // Generic
    'editable',         // Generic
    'ProseMirror'       // Some AI UIs use ProseMirror
  ];

  const className = element.className || '';
  const id = element.id || '';
  const placeholder = element.placeholder || '';
  const ariaLabel = element.getAttribute('aria-label') || '';
  const role = element.getAttribute('role') || '';

  return aiInputPatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(className) ||
           regex.test(id) ||
           regex.test(placeholder) ||
           regex.test(ariaLabel) ||
           regex.test(role);
  });
}
```

### Fix 3: Force Modal z-index (injectWarningUI.js)

In the modal styles, ensure maximum z-index:

```css
.pii-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647; /* Maximum z-index value */
  animation: fadeIn 0.2s ease-out;
}
```

### Fix 4: Add Gemini Send Button Blocker

```javascript
// NEW: Also block Gemini's Send button clicks
function blockSendButton() {
  const sendButtons = document.querySelectorAll([
    '[aria-label*="Send"]',
    '[data-test-id*="send"]',
    'button[type="submit"]',
    '.send-button'
  ].join(','));

  sendButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      // Find the input element
      const input = document.querySelector('[contenteditable="true"]');
      if (!input) return;

      const text = getTextContent(input);
      if (quickPIICheck(text)) {
        const enabled = await isEnabled();
        if (!enabled) return;

        const settings = await getSettings();
        const detectionResult = await detectPII(text, {
          minConfidence: settings.minConfidence,
          enabledTypes: settings.enabledPIITypes
        });

        if (detectionResult.piiDetected) {
          // BLOCK BUTTON CLICK
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          // Show modal
          await showWarningModal(detectionResult, input);
        }
      }
    }, true);
  });
}

// Call in initialize()
function initialize() {
  monitorAllInputs();
  blockSendButton(); // NEW
  // ... rest of code
}
```

### Fix 5: Fix Stats Counter Logic

Only increment blocked when ACTUALLY prevented:

```javascript
// In handleInput() - REMOVE incrementBlocked from cancel case
case 'cancel':
  if (settings.blockOnDetection) {
    setTextContent(element, '');
  }
  // MOVE incrementBlocked to HERE (after actual prevention)
  await incrementBlocked();
  break;
```

## Testing Plan

After implementing fixes:

### Test 1: Gemini Enter Key
1. Go to Gemini
2. Type: `My phone is 9876543210`
3. Press **Enter**
4. **Expected**: Modal appears BEFORE send
5. Click Cancel
6. **Expected**: Message NOT sent

### Test 2: Gemini Send Button
1. Type PII
2. Click the **Send button** (arrow icon)
3. **Expected**: Modal appears BEFORE send

### Test 3: Stats Counter
1. Reset stats in settings
2. Trigger PII detection 3 times
3. Cancel all 3
4. **Expected**: Blocked = 3, Detections = 3

### Test 4: All Platforms
- ChatGPT ✅
- Claude ✅
- Gemini ✅
- Perplexity ✅

## Implementation Priority

1. **CRITICAL** (Do first):
   - Fix #1: Enter key blocking
   - Fix #2: Enhanced Gemini selectors
   - Fix #3: Force modal z-index

2. **HIGH** (Do next):
   - Fix #4: Send button blocking
   - Fix #5: Stats counter logic

3. **MEDIUM** (Nice to have):
   - Add console.log debugging
   - Add visual feedback when blocking
   - Add sound notification

## Files to Modify

1. `/src/content/monitorInputs.js` - Add Enter key handler
2. `/src/content/monitorInputs.js` - Update isAIChatInput()
3. `/src/content/injectWarningUI.js` - Update modal z-index
4. `/src/content/monitorInputs.js` - Add send button blocker

Then rebuild: `npm run build`

## Success Criteria

✅ Modal appears on Gemini when typing PII
✅ Pressing Enter does NOT send if PII detected
✅ Clicking Send button does NOT send if PII detected
✅ "Blocked" counter only increments on actual blocks
✅ All 4 platforms work correctly

---

**Next Step**: Implement fixes in code and rebuild
