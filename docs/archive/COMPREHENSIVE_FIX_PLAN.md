# PII Guardian v1.2.0 - Comprehensive Fix Plan

**Generated:** 2025-11-16
**Project Manager:** PM Agent
**QA Report:** 28 bugs identified
**Status:** 🔴 NOT PRODUCTION READY - Critical bugs blocking release

---

## Executive Summary

Following comprehensive QA audit, 28 bugs were identified across 4 severity levels. This plan outlines a 4-phase approach to systematically fix all issues, with focus on critical bugs that make the extension unusable.

**Timeline:**
- **Phase 1 (Critical):** Week 1 - 5 bugs, 28 hours
- **Phase 2 (High):** Week 2 - 8 bugs, 32 hours
- **Phase 3 (Medium):** Week 3-4 - 9 bugs, 28 hours
- **Phase 4 (Low):** Week 5 - 5 bugs, 12 hours

**Total Effort:** 100 hours (~2.5 weeks with 2 developers)

---

## Phase 1: CRITICAL BUGS (MUST FIX - Week 1)

### 🔴 BUG001: Cursor Position Loss During Highlighting
**Severity:** CRITICAL
**Assigned:** Frontend-Developer
**Estimated Hours:** 8h
**Priority:** P0 (Fix First)

**Problem:**
Highlighting replaces `innerHTML` while user is typing, destroying DOM and causing cursor to jump to wrong position. Makes extension completely unusable.

**Solution:**
Disable highlighting during active typing, only show floating button:

```javascript
// File: src/content/floatingButton.js

function highlightPII(element, detectionResult) {
  // SKIP highlighting if element has focus (user is typing)
  if (document.activeElement === element) {
    console.info('PII Guardian: Skipping highlight during active typing');
    return; // Only show button, no DOM manipulation
  }

  // Continue with highlighting only when element loses focus
  // ... existing highlighting logic
}

// Add focus/blur handlers to trigger highlighting after typing stops
element.addEventListener('blur', () => {
  // Re-run detection and highlighting after user stops typing
  const lastResult = detectionResults.get(element);
  if (lastResult && lastResult.matches.length > 0) {
    highlightPII(element, lastResult);
  }
});
```

**Testing:**
- Type PII slowly → Button appears, no cursor jump
- Type PII fast → Button appears, no highlighting during typing
- Click away from input → Highlighting appears
- Click back in → Highlighting disappears, can edit normally

**Success Criteria:**
- ✅ Cursor remains at typing position 100% of time
- ✅ No typing disruption
- ✅ Button still appears during typing
- ✅ Highlighting appears after blur

---

### 🔴 BUG002: Memory Leaks - Observers/Listeners Never Cleaned Up
**Severity:** CRITICAL
**Assigned:** Backend-Developer
**Estimated Hours:** 6h
**Priority:** P0

**Problem:**
MutationObservers, event listeners accumulate indefinitely, causing browser crashes after 30min of use.

**Solution:**
Implement cleanup system with global removal detector:

```javascript
// File: src/content/floatingButton.js

// Global cleanup map
const cleanupFunctions = new WeakMap();

export function initializeFloatingButton(element) {
  if (buttonInstances.has(element)) return;

  // Store cleanup function
  const cleanup = () => {
    // Disconnect observer
    if (element._piiObserver) {
      element._piiObserver.disconnect();
      delete element._piiObserver;
    }

    // Remove all event listeners
    element.removeEventListener('input', inputHandler);
    element.removeEventListener('focus', focusHandler);
    element.removeEventListener('paste', pasteHandler);

    // Clean button
    const button = buttonInstances.get(element);
    if (button) {
      if (button._repositionHandler) {
        window.removeEventListener('scroll', button._repositionHandler, true);
        window.removeEventListener('resize', button._repositionHandler);
      }
      button.remove();
      buttonInstances.delete(element);
    }

    // Clear timers
    const timer = detectionDebounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      detectionDebounceTimers.delete(element);
    }
  };

  cleanupFunctions.set(element, cleanup);

  // ... rest of initialization
}

// Global observer to watch for removed nodes
const globalObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if removed node or its children have cleanup functions
        const elements = [node, ...node.querySelectorAll('*')];
        for (const el of elements) {
          const cleanup = cleanupFunctions.get(el);
          if (cleanup) {
            cleanup();
            cleanupFunctions.delete(el);
          }
        }
      }
    }
  }
});

// Start watching entire document
globalObserver.observe(document.body, {
  childList: true,
  subtree: true
});
```

**Testing:**
- Open ChatGPT, create 20 new chats
- Monitor memory in Chrome Task Manager
- Should stabilize under 100MB

**Success Criteria:**
- ✅ Memory usage stabilizes after 10 chats
- ✅ No observer/listener accumulation
- ✅ Clean disconnect in console logs

---

### 🔴 BUG003: Wrong Text Masked Due to Position Mismatch
**Severity:** CRITICAL
**Assigned:** Backend-Developer
**Estimated Hours:** 6h
**Priority:** P0

**Problem:**
Masking uses stale position indices after highlighting modifies DOM, resulting in wrong text being masked.

**Solution:**
Use value-based matching instead of position-based:

```javascript
// File: src/content/floatingButton.js

async function maskSinglePII(element, detectionResult, index) {
  // Remove highlights first to get clean text
  removeHighlights(element);

  const text = getTextContent(element);
  const match = detectionResult.matches[index];

  // FIXED: Use String.replace with actual value, not position
  const maskFunction = getMaskFunction(match.type);
  const maskedValue = maskFunction(match.value);

  // Replace by value, not position (handles multiple occurrences)
  const maskedText = text.replace(match.value, maskedValue);

  setTextContent(element, maskedText);
  await incrementMasked();
}

// Same fix for removeSinglePII and maskAllPII
async function removeSinglePII(element, detectionResult, index) {
  removeHighlights(element);

  const text = getTextContent(element);
  const match = detectionResult.matches[index];

  // FIXED: Replace by value
  const newText = text.replace(match.value, '');

  setTextContent(element, newText);
}

async function maskAllPII(element, detectionResult) {
  removeHighlights(element);

  const text = getTextContent(element);

  // Mask all matches by value (descending order to avoid position shifts)
  let maskedText = text;
  const sortedMatches = [...detectionResult.matches].sort((a, b) =>
    b.position - a.position
  );

  for (const match of sortedMatches) {
    const maskFunction = getMaskFunction(match.type);
    const maskedValue = maskFunction(match.value);
    maskedText = maskedText.replace(match.value, maskedValue);
  }

  setTextContent(element, maskedText);
  await incrementMasked();
}
```

**Testing:**
- Type: "Email: test@test.com Phone: 1234567890"
- Highlight appears
- Click "Mask" on email
- Verify: Email masked, phone unchanged

**Success Criteria:**
- ✅ Correct PII masked 100% of time
- ✅ No wrong text replaced
- ✅ Works with multiple PII items

---

### 🔴 BUG004: Regex False Positives (Bank Account, CVV, PIN)
**Severity:** CRITICAL
**Assigned:** Backend-Developer
**Estimated Hours:** 4h
**Priority:** P0

**Problem:**
Overly broad patterns detect ANY 8-18 digit number as bank account, ANY 3-4 digits as CVV, ANY 6 digits as PIN. False positive rate >50%.

**Solution:**
Either remove these patterns or require contextual keywords:

```javascript
// File: src/utils/regexPatterns.js

// OPTION 1: Remove entirely (recommended)
export const PII_PATTERNS = {
  // REMOVED: bankAccount, cvv, pinCode patterns
  // Keep only high-confidence patterns

  // ... other patterns
};

// OPTION 2: Add context requirement + lower confidence
export const PII_PATTERNS = {
  bankAccount: {
    pattern: /\b(?:account|acc|a\/c|bank)\s*(?:no|number|#)?[\s:]*\d{8,18}\b/gi,
    name: 'Bank Account Number',
    confidence: 0.6, // Lowered from 0.5
    validator: (match) => {
      // Must have keyword context
      const hasContext = /(?:account|acc|a\/c|bank)/i.test(match);
      const digits = match.replace(/\D/g, '');
      return hasContext && digits.length >= 8 && digits.length <= 18;
    }
  },

  // REMOVE CVV pattern entirely - too many false positives
  // cvv: { ... } <- DELETE THIS

  // REMOVE PIN code pattern entirely
  // pinCode: { ... } <- DELETE THIS

  // ... rest of patterns
};
```

**Recommendation:** Remove all 3 patterns. Users rarely type bank accounts in AI chats. CVV/PIN are too short to be reliable.

**Testing:**
- Type: "Order #12345678 placed on 2024"
- Should detect: NOTHING (no false positives)
- Type: "My account no is 1234567890"
- Should detect: Bank Account (if using Option 2)

**Success Criteria:**
- ✅ False positive rate <10%
- ✅ Normal conversations don't trigger warnings
- ✅ Real PII still detected

---

### 🔴 BUG005: Send Button Infinite Loop
**Severity:** CRITICAL
**Assigned:** Frontend-Developer
**Estimated Hours:** 4h
**Priority:** P0

**Problem:**
Enter key blocks → User approves → Simulated click blocked again → Infinite loop. "Send Anyway" doesn't work.

**Solution:**
Add bypass flag for simulated clicks:

```javascript
// File: src/content/monitorInputs.js

// Global bypass flag
let isSimulatedInteraction = false;

function simulateEnterKey(element) {
  const sendButton = findSendButton();
  if (sendButton) {
    console.info('PII Guardian: Simulating click (bypass blocking)');
    isSimulatedInteraction = true;

    sendButton.click();

    // Reset flag after small delay
    setTimeout(() => {
      isSimulatedInteraction = false;
    }, 100);

    return;
  }

  // Fallback to Enter key
  isSimulatedInteraction = true;
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);

  setTimeout(() => {
    isSimulatedInteraction = false;
  }, 100);
}

// In blockEnterKey:
function blockEnterKey(element) {
  element.addEventListener('keydown', async (event) => {
    // Bypass if simulated
    if (isSimulatedInteraction) {
      return; // Allow through
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      // ... existing blocking logic
    }
  }, true);
}

// In blockSendButton:
function blockSendButton() {
  buttons.forEach(button => {
    button.addEventListener('click', async (event) => {
      // Bypass if simulated
      if (isSimulatedInteraction) {
        return; // Allow through
      }

      // ... existing blocking logic
    }, true);
  });
}
```

**Testing:**
- Type PII
- Press Enter → Modal appears
- Click "Send Anyway"
- Verify: Message actually sends

**Success Criteria:**
- ✅ "Send Anyway" works 100% of time
- ✅ No infinite loops
- ✅ Message sends after approval

---

## Phase 1 Summary

**Total Effort:** 28 hours
**Timeline:** Week 1 (5 working days)
**Agents:** Frontend-Developer (2 bugs, 12h), Backend-Developer (3 bugs, 16h)
**Code Reviewer:** Review all fixes before merge (4h)
**QA Tester:** Verify all 5 fixes (8h)

**Dependencies:**
```
BUG001 (Highlighting) → Must fix before BUG003 (Masking)
BUG002 (Memory) → Independent, can fix in parallel
BUG004 (Regex) → Independent, can fix in parallel
BUG005 (Send Button) → Independent, can fix in parallel
```

**Parallel Work:**
- Day 1-2: BUG001 (Frontend) + BUG004 (Backend) in parallel
- Day 2-3: BUG002 (Backend) + BUG005 (Frontend) in parallel
- Day 4: BUG003 (Backend) - depends on BUG001 completion
- Day 5: Code review + QA testing

**After Phase 1:**
Extension becomes production-ready for basic use. Critical bugs blocking usability will be fixed.

---

## Phase 2: HIGH PRIORITY BUGS (Week 2)

### High Priority Bug List:
- BUG006: Highlighting check causes premature exit (2h, Backend)
- BUG007: WeakMap element tracking issues (3h, Backend)
- BUG008: Phone pattern misses international formats (2h, Backend)
- BUG009: Email pattern allows invalid TLDs (2h, Backend)
- BUG010: Aadhaar validation missing checksum (4h, Backend)
- BUG011: MutationObserver recursion risk (3h, Backend)
- BUG012: Deprecated execCommand in paste handler (4h, Frontend)
- BUG013: Send button detection too broad (3h, Frontend)
- BUG014: No error handling for Chrome storage (2h, Backend)

**Total:** 32 hours, 8 bugs

---

## Phase 3: MEDIUM PRIORITY BUGS (Week 3-4)

### Medium Priority Bug List:
- BUG015: Debounce timer not cleared (2h)
- BUG016: Mask functions leak PII on validation failure (3h)
- BUG017: Multi-byte character position calculation (4h)
- BUG018: Duplicate scroll/resize listeners (2h)
- BUG019: Credit card Luhn test cards (2h)
- BUG020: Panel off-screen positioning (3h)
- BUG021: Hardcoded version string (1h)
- BUG022: Quick check missing patterns (3h)
- BUG023: No throttling for rapid input (4h)

**Total:** 28 hours, 9 bugs

---

## Phase 4: LOW PRIORITY BUGS (Week 5)

### Low Priority Bug List:
- BUG024: Escape key handler not removed (1h)
- BUG025: No loading state during detection (2h)
- BUG026: Panel close animation (2h)
- BUG027: Console log levels (1h)
- BUG028: Accessibility labels (2h)

**Total:** 12 hours, 5 bugs

---

## Risk Mitigation

### Risks:

1. **Fixing highlighting breaks masking**
   - Mitigation: Test masking after every highlighting change
   - Rollback: Git branch per bug, easy revert

2. **Memory cleanup breaks initialization**
   - Mitigation: Extensive testing with new/destroyed elements
   - Rollback: Keep old init code in comments

3. **Regex changes reduce detection rate**
   - Mitigation: A/B test before/after on sample dataset
   - Rollback: Keep old patterns in constants

### Rollback Plan:

```bash
# Each bug fix is a separate branch
git checkout main
git branch bug001-cursor-fix
git branch bug002-memory-cleanup
# ... etc

# If fix breaks something:
git checkout main
git branch -D bug001-cursor-fix  # Delete broken branch
# Start over with different approach
```

---

## Testing Strategy

### After Each Fix:
1. **Unit Tests:** Test function in isolation
2. **Integration Tests:** Test with real DOM elements
3. **Regression Tests:** Ensure no existing features broke
4. **Performance Tests:** Check memory/CPU impact

### Before Merging:
1. **Code Review:** All fixes reviewed by Code-Reviewer agent
2. **QA Testing:** QA-Tester agent verifies fix works
3. **User Acceptance:** PM tests on real websites

### Final Release Testing:
1. **Cross-Platform:** Chrome, Edge, Brave
2. **Multi-Site:** ChatGPT, Claude, Gemini, Perplexity
3. **Load Testing:** 100+ PII items in single text
4. **Memory Testing:** 30-min continuous use
5. **Performance:** Detection latency <100ms

---

## Success Metrics

### Phase 1 (Critical):
- ✅ Extension usable during typing (no cursor jump)
- ✅ Memory stable after 20 chats (<100MB)
- ✅ Correct text masked 100% of time
- ✅ False positive rate <10%
- ✅ "Send Anyway" works 100% of time

### Overall Project:
- ✅ All 28 bugs fixed
- ✅ <5 new bugs introduced
- ✅ Performance not degraded
- ✅ User settings preserved
- ✅ 100% test pass rate

---

## Agent Assignments

### Frontend-Developer:
- BUG001: Cursor position fix (8h)
- BUG005: Send button loop (4h)
- BUG012: Deprecated execCommand (4h)
- BUG013: Send button detection (3h)
- **Total:** 19 hours

### Backend-Developer:
- BUG002: Memory cleanup (6h)
- BUG003: Masking positions (6h)
- BUG004: Regex false positives (4h)
- BUG006-BUG011: High priority (18h)
- BUG014: Storage error handling (2h)
- **Total:** 36 hours

### Code-Reviewer:
- Review all Phase 1 fixes (4h)
- Review all Phase 2 fixes (6h)
- **Total:** 10 hours

### QA-Tester:
- Test Phase 1 fixes (8h)
- Test Phase 2 fixes (10h)
- Final regression testing (12h)
- **Total:** 30 hours

---

## Timeline

```
Week 1:
Mon-Tue: BUG001 (Frontend) + BUG004 (Backend) parallel
Wed: BUG002 (Backend) + BUG005 (Frontend) parallel
Thu: BUG003 (Backend)
Fri: Code review + QA testing

Week 2:
Mon-Wed: Fix high priority bugs (8 bugs)
Thu-Fri: Code review + QA testing

Week 3-4:
Medium priority bugs (9 bugs)

Week 5:
Low priority bugs (5 bugs) + Final QA
```

---

## Next Actions

1. **PM:** Assign tasks to agents (this document)
2. **Agents:** Begin Phase 1 fixes immediately
3. **Daily Standups:** 15min sync on progress/blockers
4. **Code Reviews:** Every fix reviewed before merge
5. **QA:** Continuous testing as fixes complete

---

**Status:** Plan approved, ready to execute Phase 1
**Risk Level:** Medium (critical bugs known, fixes planned)
**Confidence:** 85% we can fix all critical bugs in Week 1
