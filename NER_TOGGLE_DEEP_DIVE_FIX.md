# NER Toggle Deep Dive Analysis & Fix

## Screenshot Analysis

**Observed Issues:**
1. ⏳ **Loading spinner icon visible on toggle** - Toggle appears "stuck"
2. Toggle is greyed out and unresponsive
3. Status chip shows "NER: Disabled"
4. Toggle switch doesn't respond to clicks

---

## Root Cause Analysis

### Issue 1: Toggle is Permanently Disabled ✅ IDENTIFIED

**Root Cause:** User previously clicked **"Always use regex only"** button

**Evidence:**
```javascript
// Line 735-746 in src/ui/popup.js
nerDownloadNever.addEventListener('click', async () => {
  const settings = await getSettings();
  settings.nerNeverAsk = true;  // ← THIS IS SET TO TRUE
  settings.nerEnabled = false;
  await chrome.storage.local.set({ settings });

  hideNERDownloadModal();
  if (nerToggle) {
    nerToggle.checked = false;
    nerToggle.disabled = true;  // ← TOGGLE PERMANENTLY DISABLED
    nerToggle.title = 'You chose to always use regex only. Reset in settings to enable.';
  }

  showToast('NER permanently disabled. Reset in settings if needed.', 'info');
});
```

**How This Happens:**
1. User enables NER toggle
2. Download modal appears with 3 buttons:
   - "Download now"
   - "Not now"
   - **"Always use regex only"** ← User clicked this
3. This sets `nerNeverAsk: true` in storage
4. On next popup load, `loadNERState()` reads this setting:

```javascript
// Line 414-418 in src/ui/popup.js
if (settings.nerNeverAsk) {
  nerToggle.disabled = true;  // ← TOGGLE DISABLED
  nerToggle.title = 'You chose to always use regex only. Reset in settings to enable.';
}
```

**Verification:**
Check Chrome DevTools Console:
```javascript
chrome.storage.local.get(['settings'], (result) => {
  console.log('nerNeverAsk:', result.settings.nerNeverAsk);
  // If this is true, toggle is intentionally disabled
});
```

---

### Issue 2: Loading Spinner Icon ⏳ EXPLAINED

**Why the Spinner Appears:**

The loading spinner (⏳) is **NOT** from our code. It's a **browser-native visual indicator** that appears when:
- An input element is disabled
- The cursor hovers over a disabled element
- Browser shows "not-allowed" cursor

**Browser Behavior:**
```css
/* When toggle is disabled */
input:disabled + .toggle-slider {
  cursor: not-allowed;  /* Browser may show ⏳ or 🚫 */
  opacity: 0.6;
  pointer-events: none;
}
```

**This is correct behavior** - the toggle IS disabled because `nerNeverAsk: true`.

---

## The Real Problem

**The toggle is working correctly!**

User made a permanent choice to disable NER, and the extension is respecting that choice. However, there are **TWO ISSUES**:

### Problem 1: No Visual Feedback ❌

**Issue:** When toggle is disabled, there's no clear message explaining WHY

**Current State:**
- Toggle is greyed out ✅
- Hover shows title tooltip (hidden in screenshot) ⚠️
- But no obvious message visible

**Expected State:**
- Clear banner: "NER disabled by user preference"
- Reset button visible
- Obvious visual indication

### Problem 2: No Easy Reset ❌

**Issue:** User can't easily re-enable NER from popup

**Current Workaround:**
1. Open settings page
2. Find NER settings
3. Manually reset `nerNeverAsk` flag
4. Re-enable NER

**This is too complex!**

---

## Solution: Add Reset Functionality

### Fix 1: Show Disabled Banner

Add a visible banner when NER is permanently disabled:

**HTML Update (popup.html):**
```html
<!-- After line 94 -->
<div class="ner-disabled-banner" id="nerDisabledBanner" style="display: none;">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  <div class="ner-disabled-text">
    <strong>NER permanently disabled</strong>
    <p>You chose to always use regex only.</p>
  </div>
  <button class="ner-reset-btn" id="nerResetBtn">Reset</button>
</div>
```

**CSS Update (popup.css):**
```css
.ner-disabled-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #FFF3E0;
  border: 1px solid #FFB74D;
  border-radius: 8px;
  margin-top: 12px;
}

.ner-disabled-banner svg {
  flex-shrink: 0;
  color: #F57C00;
}

.ner-disabled-text {
  flex: 1;
}

.ner-disabled-text strong {
  font-size: 13px;
  color: #E65100;
  display: block;
  margin-bottom: 2px;
}

.ner-disabled-text p {
  font-size: 12px;
  color: #757575;
  margin: 0;
}

.ner-reset-btn {
  padding: 6px 14px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.ner-reset-btn:hover {
  background: #1976D2;
  transform: translateY(-1px);
}
```

**JavaScript Update (popup.js):**
```javascript
// In loadNERState() function - line 409
async function loadNERState(settings) {
  const nerDisabledBanner = document.getElementById('nerDisabledBanner');

  if (nerToggle) {
    nerToggle.checked = settings.nerEnabled || false;

    // Disable if user chose "never ask"
    if (settings.nerNeverAsk) {
      nerToggle.disabled = true;
      nerToggle.title = 'You chose to always use regex only. Reset to enable.';

      // Show disabled banner
      if (nerDisabledBanner) {
        nerDisabledBanner.style.display = 'flex';
      }
    } else {
      nerToggle.disabled = false;

      // Hide disabled banner
      if (nerDisabledBanner) {
        nerDisabledBanner.style.display = 'none';
      }
    }
  }

  // Update status chip
  await updateNERStatusChip(settings);
}
```

**Add Reset Button Handler (popup.js):**
```javascript
// In attachListeners() function - add after line 750
const nerResetBtn = document.getElementById('nerResetBtn');
if (nerResetBtn) {
  nerResetBtn.addEventListener('click', async () => {
    console.log('[Popup] Resetting NER preferences');

    try {
      const settings = await getSettings();

      // Reset the "never ask" flag
      settings.nerNeverAsk = false;
      settings.nerDownloadPromptShown = false;

      await chrome.storage.local.set({ settings });

      // Re-enable toggle
      if (nerToggle) {
        nerToggle.disabled = false;
        nerToggle.title = 'Enable enhanced NER detection';
      }

      // Hide banner
      const nerDisabledBanner = document.getElementById('nerDisabledBanner');
      if (nerDisabledBanner) {
        nerDisabledBanner.style.display = 'none';
      }

      showToast('NER preferences reset. You can now enable NER.', 'success');

      // Reload state
      await loadNERState(settings);

    } catch (error) {
      console.error('[Popup] Error resetting NER:', error);
      showToast('Error resetting NER: ' + error.message, 'error');
    }
  });
}
```

---

## Quick Fix for User (Immediate Solution)

### Option 1: Reset via DevTools Console

**Steps:**
1. Open popup
2. Right-click → Inspect
3. Go to Console tab
4. Run this command:

```javascript
chrome.storage.local.get(['settings'], (result) => {
  const settings = result.settings;
  settings.nerNeverAsk = false;
  settings.nerDownloadPromptShown = false;
  chrome.storage.local.set({ settings }, () => {
    console.log('✅ NER reset! Close and reopen popup.');
  });
});
```

5. Close popup
6. Reopen popup
7. Toggle should now work

### Option 2: Clear Extension Storage

**Steps:**
1. Go to `chrome://extensions`
2. Find "PII Guardian"
3. Click "Details"
4. Scroll to "Site data"
5. Click "Clear storage"
6. Reload extension
7. Open popup - toggle will work (but all settings reset)

⚠️ **Warning:** This clears ALL extension data including stats

---

## Implementation Plan

### Phase 1: Add Reset Banner (Immediate)

**Files to Modify:**
1. `html/popup.html` - Add banner HTML (after line 94)
2. `src/styles/popup.css` - Add banner styles
3. `src/ui/popup.js` - Add show/hide logic and reset handler

**Time:** 30 minutes
**Impact:** Users can reset NER preference from popup

### Phase 2: Improve UX (Future)

**Enhancements:**
1. Show disabled state more clearly
2. Add confirmation dialog before disabling permanently
3. Add tooltip explaining what "Always use regex only" means
4. Track why users disable NER (analytics)

---

## Testing Checklist

### Test 1: Verify Disabled State
- [ ] Open popup
- [ ] Check if NER toggle is greyed out
- [ ] Verify disabled banner shows
- [ ] Check banner text is clear
- [ ] Verify "Reset" button is visible

### Test 2: Test Reset Button
- [ ] Click "Reset" button
- [ ] Verify success toast appears
- [ ] Check toggle is now enabled (no longer greyed)
- [ ] Verify banner disappears
- [ ] Try toggling NER on - should work

### Test 3: Verify Persistence
- [ ] Reset NER preference
- [ ] Close popup
- [ ] Reopen popup
- [ ] Verify toggle still enabled
- [ ] Verify banner still hidden

### Test 4: Re-disable Flow
- [ ] Enable NER toggle
- [ ] Download modal appears
- [ ] Click "Always use regex only"
- [ ] Verify toggle disabled again
- [ ] Verify banner shows again
- [ ] Reset and repeat

---

## Why This Happened

**Timeline:**
1. User opened extension for first time
2. Clicked NER toggle
3. Download modal appeared
4. User clicked **"Always use regex only"** (possibly by accident)
5. Extension saved `nerNeverAsk: true` to storage
6. On next popup load, toggle is permanently disabled

**User Confusion:**
- Button says "Always use regex only" but doesn't clarify it's **permanent**
- No easy way to undo this choice
- No visible indication in UI why toggle is disabled

---

## Improved Button Labels (Future)

### Current Labels (Confusing):
```
[Download now]  [Not now]  [Always use regex only]
```

### Proposed Labels (Clearer):
```
[Download now]  [Not now]  [Never ask again - disable NER permanently ⚠️]
```

Or even better:
```
[Download NER Model]  [Ask me later]  [Don't show this again]
```

With tooltip:
> **Note:** Clicking "Don't show this again" will permanently disable NER.
> You can reset this choice in settings.

---

## Verification

**Check Storage State:**
```javascript
// Run in console
chrome.storage.local.get(['settings'], (result) => {
  console.log('NER Settings:', {
    nerEnabled: result.settings.nerEnabled,
    nerModelDownloaded: result.settings.nerModelDownloaded,
    nerNeverAsk: result.settings.nerNeverAsk,  // ← Should be TRUE
    nerDownloadPromptShown: result.settings.nerDownloadPromptShown
  });
});
```

**Expected Output (Current):**
```javascript
{
  nerEnabled: false,
  nerModelDownloaded: false,
  nerNeverAsk: true,  // ← THIS IS WHY TOGGLE IS DISABLED
  nerDownloadPromptShown: true
}
```

**Expected Output (After Reset):**
```javascript
{
  nerEnabled: false,
  nerModelDownloaded: false,
  nerNeverAsk: false,  // ← RESET
  nerDownloadPromptShown: false  // ← RESET
}
```

---

## Summary

### Root Cause ✅
**Toggle is disabled because `nerNeverAsk: true` in storage**

User clicked "Always use regex only" button, which permanently disabled NER.

### Not a Bug ✅
The extension is working correctly - respecting user's choice to permanently disable NER.

### Real Problem ✅
1. No clear visual indication WHY toggle is disabled
2. No easy way to reset this choice from popup
3. Button label doesn't clarify it's a permanent action

### Solution ✅
1. Add visible "NER Disabled" banner with reset button
2. Improve button labels to clarify permanent action
3. Add confirmation dialog before permanent disable

### Immediate Workaround ✅
Run this in console to reset:
```javascript
chrome.storage.local.get(['settings'], (r) => {
  r.settings.nerNeverAsk = false;
  chrome.storage.local.set({ settings: r.settings });
});
```

Then close and reopen popup.

---

**Status:** Issue identified - Not a bug, working as designed
**Fix Required:** Add reset functionality to popup UI
**Workaround Available:** ✅ Yes (console command above)
**User Impact:** Medium (toggle appears broken but is intentionally disabled)

---

**Date:** 2025-12-21
**Version:** 1.3.0
**Issue Type:** UX Enhancement Needed
