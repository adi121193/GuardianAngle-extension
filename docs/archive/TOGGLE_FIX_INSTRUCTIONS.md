# NER Toggle Fix - User Instructions

## Problem Summary

**Issue:** NER toggle appears "jammed" with a loading spinner and won't respond to clicks

**Root Cause:** You previously clicked **"Always use regex only"** button, which permanently disabled the NER toggle by setting `nerNeverAsk: true` in storage.

**This is NOT a bug** - the extension is working correctly by respecting your choice.

---

## Solution Implemented ✅

Added a **Reset Banner** with a **Reset Button** to easily re-enable NER.

---

## How to Fix (3 Options)

### Option 1: Use the Reset Button (RECOMMENDED) ✅

**Steps:**
1. **Reload the extension:**
   - Go to `chrome://extensions`
   - Find "PII Guardian"
   - Click reload icon 🔄

2. **Open popup:**
   - Click extension icon

3. **Look for orange banner:**
   - Below the NER toggle, you'll see:
   ```
   ⚠️ NER permanently disabled
   You chose to always use regex only.
   [Reset] ← Click this button
   ```

4. **Click "Reset" button:**
   - Success toast will appear: "NER preferences reset"
   - Toggle will become responsive
   - Banner will disappear

5. **Now you can enable NER:**
   - Click the NER toggle
   - Download modal will appear
   - Click "Download now"
   - Wait for download (0-100%)
   - NER will be enabled

---

### Option 2: Reset via Console (FAST) ⚡

**Steps:**
1. Open popup
2. Right-click → Inspect
3. Go to Console tab
4. Paste this command:

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

5. Press Enter
6. Close popup
7. Reopen popup
8. Toggle should now work

---

### Option 3: Clear All Extension Data (NUCLEAR) ☢️

⚠️ **Warning:** This clears ALL settings and stats

**Steps:**
1. Go to `chrome://extensions`
2. Find "PII Guardian"
3. Click "Details"
4. Scroll to "Site data"
5. Click "Clear storage"
6. Reload extension
7. Open popup - toggle will work

---

## After Reset: How to Enable NER

1. **Click NER toggle** (should now be responsive)

2. **Download modal appears:**
   ```
   Download NER Model?

   One-time download: ~10-15 MB
   [Not now]  [Always use regex only]  [Download now]
   ```

3. **Click "Download now"**
   - ⚠️ **DO NOT** click "Always use regex only" again!

4. **Watch progress bar:** 0% → 100%

5. **Success!**
   - Toast: "NER model downloaded successfully!"
   - Status chip: "NER: Ready" (green)
   - Toggle stays enabled

---

## Visual Guide

### Before Fix (Jammed State):
```
Enhanced Detection (NER)            [⏳ ──] ← Greyed out, unresponsive
NER: Disabled
```

### After Reload (Reset Banner Visible):
```
Enhanced Detection (NER)            [⏳ ──] ← Still greyed, BUT...

⚠️  NER permanently disabled           [Reset]
    You chose to always use regex only.
```

### After Clicking Reset:
```
Enhanced Detection (NER)            [── ○] ← Now responsive!
NER: Disabled
```

### After Enabling NER:
```
Enhanced Detection (NER)            [●──]  ← Enabled!
NER: Ready ✓
```

---

## Why This Happened

**Timeline:**
1. You first enabled NER toggle
2. Download modal appeared
3. You clicked **"Always use regex only"**
4. Extension set `nerNeverAsk: true` (permanent flag)
5. On next popup load, toggle was disabled

**Confusion Point:**
- Button label "Always use regex only" wasn't clear it's **permanent**
- No easy way to undo this choice (until now!)

---

## Future Improvements (Already Planned)

1. ✅ **Add reset button** - DONE!
2. 🔜 **Better button labels:**
   - Current: "Always use regex only"
   - Proposed: "Never ask again (permanent)"

3. 🔜 **Add confirmation dialog:**
   - "Are you sure? This will permanently disable NER."
   - [Yes, disable permanently] [Cancel]

---

## Verification

**Check if reset worked:**

1. Open popup
2. Right-click → Inspect → Console
3. Run:
```javascript
chrome.storage.local.get(['settings'], (r) => {
  console.log('nerNeverAsk:', r.settings.nerNeverAsk);  // Should be FALSE
  console.log('Toggle disabled:', document.getElementById('nerToggle').disabled);  // Should be FALSE
});
```

**Expected output:**
```
nerNeverAsk: false  ✅
Toggle disabled: false  ✅
```

---

## FAQ

**Q: Will I lose my settings?**
A: No! Only the `nerNeverAsk` flag is reset. All other settings remain.

**Q: Will I lose my stats?**
A: No! Stats are preserved.

**Q: Do I need to download the model again?**
A: No! If you already downloaded it before, it's still there.

**Q: What if the banner doesn't appear?**
A: The banner only shows if `nerNeverAsk: true`. If toggle works normally, you don't need it.

**Q: Can I permanently disable NER again?**
A: Yes, but we recommend just turning off the toggle instead of clicking "Always use regex only".

---

## Testing Checklist

After implementing the fix:

- [ ] Reload extension in chrome://extensions
- [ ] Open popup
- [ ] Verify orange banner appears below NER toggle
- [ ] Verify banner text: "NER permanently disabled"
- [ ] Verify "Reset" button is visible
- [ ] Click "Reset" button
- [ ] Verify success toast appears
- [ ] Verify banner disappears
- [ ] Verify toggle is no longer greyed out
- [ ] Click toggle to enable NER
- [ ] Verify download modal appears
- [ ] Click "Download now"
- [ ] Verify progress bar works
- [ ] Verify NER enables successfully

---

## Summary

**Problem:** Toggle disabled because you clicked "Always use regex only"

**Solution:**
1. Reload extension
2. Open popup
3. Click "Reset" button in orange banner
4. Toggle now works!

**Files Modified:**
- `html/popup.html` - Added reset banner
- `src/styles/popup.css` - Added banner styles
- `src/ui/popup.js` - Added reset button handler

**Build:** ✅ Successful
**Ready to Test:** ✅ Yes

---

**Version:** 1.3.0
**Date:** 2025-12-21
**Fix Type:** UX Enhancement
**Status:** ✅ Ready for User Testing
