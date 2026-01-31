# PII Guardian - Testing & Debugging Guide

Complete step-by-step guide for testing and debugging the PII Guardian extension.

---

## Table of Contents
1. [Pre-Flight Checks](#1-pre-flight-checks)
2. [Browser Console Debugging](#2-browser-console-debugging)
3. [Extension Reload Process](#3-extension-reload-process)
4. [Testing PII Detection](#4-testing-pii-detection)
5. [Testing Blocking on Enter Key](#5-testing-blocking-on-enter-key)
6. [Testing Send Button Blocking](#6-testing-send-button-blocking)
7. [Checking Storage/Settings](#7-checking-storagesettings)
8. [Common Issues and Solutions](#8-common-issues-and-solutions)
9. [Getting Debug Information](#9-getting-debug-information)
10. [Nuclear Option - Fresh Install](#10-nuclear-option---fresh-install)

---

## 1. Pre-Flight Checks

### Step 1.1: Verify Extension is Loaded

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Find "PII Guardian" in the list
4. Verify the following:
   - **Toggle is ON** (blue/enabled)
   - **No errors** shown in red text
   - **ID is displayed** (random string of letters)

### Step 1.2: Check Version Number

1. On `chrome://extensions/` page
2. Look for "PII Guardian"
3. Version should show: **1.0.0**
4. If different or missing, extension may not be loaded correctly

### Step 1.3: Verify Files in Dist Folder

1. Navigate to your project folder: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension`
2. Open the `dist` folder
3. Verify these files/folders exist:
   - `manifest.json`
   - `content/monitorInputs.js`
   - `background/serviceWorker.js`
   - `html/popup.html`
   - `ui/popup.js`
   - `ui/dashboard.js`
   - `ui/settings.js`
   - `ui/license.js`
   - `assets/icons/` (folder with icons)

**If ANY files are missing:**
```bash
cd /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension
npm run build
```

### Step 1.4: Verify Manifest is Correct

1. Open `dist/manifest.json` in a text editor
2. Verify these critical settings:

```json
{
  "manifest_version": 3,
  "name": "PII Guardian",
  "version": "1.0.0",
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*"
      ],
      "js": [
        "content/monitorInputs.js"
      ]
    }
  ]
}
```

**Key things to check:**
- `content/monitorInputs.js` path is correct (NOT `src/content/...`)
- Your target website is in the `matches` array
- `manifest_version` is 3

---

## 2. Browser Console Debugging

### Step 2.1: Open DevTools for the Web Page

1. Go to one of the supported AI chat sites:
   - https://gemini.google.com/
   - https://chat.openai.com/
   - https://claude.ai/
   - https://www.perplexity.ai/

2. Open Developer Tools:
   - **Windows/Linux:** Press `F12` or `Ctrl+Shift+J`
   - **Mac:** Press `Cmd+Option+J`

3. Click the **Console** tab

### Step 2.2: Expected Console Messages

When the page loads, you should see:

```
PII Guardian: Input monitoring initialized
```

**If you see this message:** Extension is working and content script is loaded.

**If you DON'T see this message:** Continue to Step 2.3

### Step 2.3: Check for Errors

Look for error messages in red text. Common errors:

**Error: "Failed to load resource: net::ERR_FILE_NOT_FOUND"**
- **Cause:** Missing files in dist folder
- **Fix:** Run `npm run build` and reload extension

**Error: "Uncaught SyntaxError"**
- **Cause:** JavaScript bundling issue
- **Fix:** Rebuild with `npm run build`

**Error: "Refused to execute inline script"**
- **Cause:** Content Security Policy issue
- **Fix:** Check manifest.json CSP settings

**No messages at all:**
- Extension not loaded or disabled
- Content script not injecting (see Step 2.4)

### Step 2.4: Verify Content Script Loaded

1. In DevTools Console, type:
```javascript
console.log(window.location.href);
```

2. Verify the URL matches one of the extension's target sites

3. Type this to check if content script functions exist:
```javascript
console.log('Checking for PII Guardian...');
```

4. Reload the page (F5) and watch console for the initialization message

### Step 2.5: Check Extension Service Worker

1. Go to: `chrome://extensions/`
2. Find "PII Guardian"
3. Click "service worker" (blue link under the extension)
4. A new DevTools window opens - this is the **background script console**
5. Look for any error messages here

---

## 3. Extension Reload Process

### Step 3.1: Quick Reload (After Code Changes)

1. Go to: `chrome://extensions/`
2. Find "PII Guardian"
3. Click the **circular reload icon** (not the toggle!)
4. Wait 2 seconds
5. Go to your AI chat site
6. **Hard refresh the page:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

**Use this when:** You've rebuilt the extension with `npm run build`

### Step 3.2: Full Reload (Clear Cache)

1. Go to: `chrome://extensions/`
2. Find "PII Guardian"
3. Click **Remove** button
4. Wait 5 seconds
5. Click **Load unpacked** button
6. Select your `dist` folder: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/dist`
7. Click **Select**
8. Go to your AI chat site and hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`

**Use this when:**
- Quick reload didn't work
- Extension settings seem corrupted
- Strange behavior after updates

### Step 3.3: Verify Reload Succeeded

1. Check version number hasn't changed unexpectedly
2. Check extension toggle is still ON
3. Check no errors appear in red
4. Open AI chat site and verify "PII Guardian: Input monitoring initialized" appears in console

---

## 4. Testing PII Detection

### Test 1: Phone Number Detection

**Objective:** Verify extension detects Indian phone numbers

**Steps:**
1. Go to: https://gemini.google.com/
2. Open DevTools Console (F12)
3. Verify you see: "PII Guardian: Input monitoring initialized"
4. Click in the chat input box
5. Type: `My phone number is 9876543210`
6. Wait 1-2 seconds (debounce delay)

**Expected Behavior:**
- A modal/warning popup appears
- Modal says "PII Detected: Phone Number"
- Three buttons shown: "Mask & Send", "Send Anyway", "Cancel"

**If it works:** Test PASSED

**If nothing happens:**
1. Check Console for errors
2. Type in console:
   ```javascript
   quickPIICheck("9876543210")
   ```
   If this returns an error, the detection module didn't load

3. Check if extension is enabled:
   ```javascript
   chrome.storage.local.get(['enabled'], (result) => {
     console.log('Extension enabled:', result.enabled);
   });
   ```
   Should return `true`

4. Verify settings allow phone detection:
   - Click extension icon in toolbar
   - Go to Settings
   - Check "Phone Number" is enabled

### Test 2: Aadhaar Number Detection

**Steps:**
1. Clear the input box
2. Type: `My Aadhaar is 1234 5678 9012`
3. Wait 1-2 seconds

**Expected Behavior:**
- Modal appears
- Says "PII Detected: Aadhaar Number"

**If it doesn't work:**
- Aadhaar pattern might not be in enabled types
- Check Settings > PII Types > Aadhaar Number is checked

### Test 3: Email Detection

**Steps:**
1. Clear the input box
2. Type: `Contact me at test@example.com`
3. Wait 1-2 seconds

**Expected Behavior:**
- Modal appears
- Says "PII Detected: Email"

**If it doesn't work:**
- Check confidence threshold isn't too high
- Go to Settings > Sensitivity > Set to "Medium" or "Low"

### Test 4: Multiple PII Types

**Steps:**
1. Clear input
2. Type: `Call 9876543210 or email test@example.com`
3. Wait 1-2 seconds

**Expected Behavior:**
- Modal appears
- Shows BOTH "Phone Number" and "Email" detected

---

## 5. Testing Blocking on Enter Key

**This is CRITICAL functionality - submission must be blocked!**

### Test 5.1: Basic Enter Key Block

**Steps:**
1. Go to Gemini chat
2. Type in input: `My phone is 9876543210`
3. Press **Enter** key (don't click send button)

**Expected Behavior:**
- Message does NOT send to Gemini
- Modal appears immediately
- Input remains in text box

**If message sends anyway:**

**Debugging Steps:**

1. Check console for errors during keydown event

2. Verify event listener attached:
   ```javascript
   // In DevTools Console
   const input = document.querySelector('[contenteditable="true"]');
   console.log('Input element:', input);
   console.log('Has listeners:', getEventListeners(input).keydown);
   ```

3. Check if quickPIICheck is working:
   ```javascript
   quickPIICheck("9876543210")
   ```
   Should return `true`

4. Test event.preventDefault() manually:
   ```javascript
   const input = document.querySelector('[contenteditable="true"]');
   input.addEventListener('keydown', (e) => {
     if (e.key === 'Enter') {
       console.log('Enter pressed!');
       e.preventDefault();
       e.stopPropagation();
     }
   }, true);
   ```
   Type text and press Enter - if message still sends, Gemini has their own handler interfering

### Test 5.2: Shift+Enter (Should Allow)

**Steps:**
1. Type: `My phone is 9876543210`
2. Press **Shift+Enter** (new line)

**Expected Behavior:**
- Creates new line in input
- Does NOT trigger PII modal
- Does NOT send message

### Test 5.3: After Choosing "Send Anyway"

**Steps:**
1. Type: `Phone: 9876543210`
2. Press Enter
3. Modal appears
4. Click "Send Anyway"
5. Press Enter again

**Expected Behavior:**
- First Enter: Modal appears, message blocked
- "Send Anyway": Modal closes
- Second Enter: Message can send (user confirmed)

---

## 6. Testing Send Button Blocking

### Test 6.1: Click Send Button with PII

**Steps:**
1. Go to Gemini
2. Type: `Email me at test@example.com`
3. Click the **Send button** (arrow icon, usually at bottom-right)

**Expected Behavior:**
- Message does NOT send
- Modal appears
- Input text remains

**If message sends anyway:**

**Debugging Steps:**

1. Check if send button was found:
   ```javascript
   const sendButtons = document.querySelectorAll([
     '[aria-label*="Send" i]',
     'button[type="submit"]',
     '.send-button'
   ].join(','));
   console.log('Send buttons found:', sendButtons);
   ```

2. Verify listener attached:
   ```javascript
   const sendBtn = document.querySelector('[aria-label*="Send" i]');
   console.log('Send button listeners:', getEventListeners(sendBtn).click);
   ```

3. Check event.preventDefault() working:
   ```javascript
   const sendBtn = document.querySelector('[aria-label*="Send" i]');
   sendBtn.addEventListener('click', (e) => {
     console.log('Send clicked!');
     e.preventDefault();
     e.stopImmediatePropagation();
   }, true);
   ```

### Test 6.2: Send Button Without PII

**Steps:**
1. Type: `Hello, how are you?`
2. Click Send button

**Expected Behavior:**
- Message sends normally
- No modal appears

---

## 7. Checking Storage/Settings

### Step 7.1: View Extension Storage

1. Open DevTools Console (F12)
2. Type:
   ```javascript
   chrome.storage.local.get(null, (data) => {
     console.log('Extension Storage:', data);
   });
   ```

3. Expected output:
   ```javascript
   {
     enabled: true,
     minConfidence: 0.7,
     blockOnDetection: false,
     enabledPIITypes: {
       phone: true,
       email: true,
       aadhaar: true,
       pan: true,
       // ... etc
     },
     stats: {
       totalDetections: 0,
       totalBlocked: 0,
       byType: { ... }
     }
   }
   ```

### Step 7.2: Reset Settings

**If settings are corrupted:**

```javascript
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
  location.reload();
});
```

### Step 7.3: Enable/Disable Extension

**Via Popup:**
1. Click extension icon in Chrome toolbar
2. Toggle switch at top
3. Should show "Enabled" or "Disabled"

**Via Console:**
```javascript
// Check status
chrome.storage.local.get(['enabled'], (result) => {
  console.log('Enabled:', result.enabled);
});

// Enable
chrome.storage.local.set({ enabled: true }, () => {
  console.log('Extension enabled');
});

// Disable
chrome.storage.local.set({ enabled: false }, () => {
  console.log('Extension disabled');
});
```

### Step 7.4: Verify Enabled State

**After enabling:**
1. Reload the AI chat page
2. Check console for "PII Guardian: Input monitoring initialized"
3. Test detection with phone number

---

## 8. Common Issues and Solutions

### Issue 1: Modal Not Appearing

**Symptoms:** Type PII, but no warning modal shows up

**Possible Causes & Fixes:**

**A. Z-index issue (modal behind other elements)**
- Open DevTools > Elements tab
- Press `Ctrl+Shift+C` (inspect element)
- Look for element with ID: `pii-guardian-modal`
- Check its `z-index` CSS property
- Should be very high: `2147483647`

**Fix:**
```javascript
// In console:
const modal = document.getElementById('pii-guardian-modal');
if (modal) {
  modal.style.zIndex = '2147483647';
  console.log('Fixed z-index');
} else {
  console.log('Modal element not found - injection failed');
}
```

**B. Extension disabled**
- Click extension icon
- Check toggle is ON
- Or use console:
  ```javascript
  chrome.storage.local.get(['enabled'], (r) => console.log(r.enabled));
  ```

**C. PII type disabled in settings**
- Click extension icon > Settings
- Check that PII type is enabled (checkbox checked)

**D. Confidence threshold too high**
- Click extension icon > Settings
- Set sensitivity to "Low" (0.3)
- Try test again

**E. Text too short**
- Extension ignores text shorter than 5 characters
- Type at least 10 characters including the PII

### Issue 2: Detection Not Working

**Symptoms:** No modal, no console logs, nothing happens

**Fixes:**

**A. Check quickPIICheck function**
```javascript
// Should return true for PII
quickPIICheck("9876543210")  // Should return true
quickPIICheck("hello")        // Should return false
```

If error: `quickPIICheck is not defined`
- Content script not loaded
- Run `npm run build` and reload extension

**B. Check regex patterns**
```javascript
// Test phone pattern manually
const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}/;
console.log(phoneRegex.test("9876543210"));  // Should be true
```

**C. Verify imports loaded**
```javascript
// These should exist:
console.log(typeof detectPII);      // Should be "function"
console.log(typeof quickPIICheck);  // Should be "function"
console.log(typeof showWarningModal); // Should be "function"
```

If "undefined": Import statements failed - check build process

### Issue 3: Blocking Not Working

**Symptoms:** Modal appears, but pressing Enter still sends message

**Fixes:**

**A. Check event listener order**
- Extension uses `capture: true` to intercept events early
- Gemini might have stronger event handler
- Verify in console:
  ```javascript
  const input = document.querySelector('[contenteditable="true"]');
  const listeners = getEventListeners(input).keydown;
  console.log('Keydown listeners:', listeners);
  // Extension listener should be in capture phase
  ```

**B. Check event.preventDefault() is called**
- Add debug logging:
  ```javascript
  // Temporarily add this to monitorInputs.js line 300:
  console.log('BLOCKING SUBMISSION - PII DETECTED');
  ```

**C. Async timing issue**
- Modal might appear after Enter already processed
- The code uses `await` properly, but check network latency

**D. Input element not found**
```javascript
// Check input element is correct
const input = document.querySelector('[contenteditable="true"]');
console.log('Input element:', input);
console.log('Is AI chat input:', isAIChatInput(input));
```

### Issue 4: Stats Not Incrementing

**Symptoms:** Detection works, but popup shows "0 detections"

**Fixes:**

**A. Check storage writes**
```javascript
chrome.storage.local.get(['stats'], (result) => {
  console.log('Current stats:', result.stats);
});
```

**B. Increment manually (test)**
```javascript
chrome.storage.local.get(['stats'], (result) => {
  const stats = result.stats || { totalDetections: 0, totalBlocked: 0, byType: {} };
  stats.totalDetections += 1;
  chrome.storage.local.set({ stats }, () => {
    console.log('Stats updated');
  });
});
```

**C. Check incrementDetection function exists**
```javascript
console.log(typeof incrementDetection); // Should be "function"
```

### Issue 5: Extension Not Loading

**Symptoms:** Not visible in chrome://extensions or toggle is off

**Fixes:**

1. **Rebuild:**
   ```bash
   cd /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension
   npm run build
   ```

2. **Remove and reload:**
   - chrome://extensions
   - Remove PII Guardian
   - Load unpacked > select `dist` folder

3. **Check manifest errors:**
   - Look for error message in red on extensions page
   - Common: "Manifest file is missing or unreadable"
   - Fix: Ensure `dist/manifest.json` exists

4. **Check file permissions:**
   ```bash
   ls -la /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/dist/
   ```
   All files should be readable

---

## 9. Getting Debug Information

When reporting bugs or issues, collect this information:

### Step 9.1: Browser Console Screenshot

1. Go to AI chat site (e.g., Gemini)
2. Open DevTools (F12)
3. Click Console tab
4. Reproduce the issue
5. Take screenshot of console (including any errors in red)

### Step 9.2: Extension Service Worker Logs

1. Go to: `chrome://extensions/`
2. Find "PII Guardian"
3. Click "service worker" link
4. Take screenshot of this console window

### Step 9.3: Storage State

1. In console, run:
   ```javascript
   chrome.storage.local.get(null, (data) => {
     console.log(JSON.stringify(data, null, 2));
   });
   ```
2. Copy the output

### Step 9.4: Manifest Version

1. Run in console:
   ```javascript
   console.log(chrome.runtime.getManifest());
   ```
2. Copy the output

### Step 9.5: Chrome Version

1. Go to: `chrome://version/`
2. Copy first line (e.g., "Version 120.0.6099.129")

### Step 9.6: Network Tab

1. Open DevTools > Network tab
2. Reproduce issue
3. Check for failed requests (red)
4. Screenshot any errors

### Step 9.7: Elements Tab (For Modal Issues)

1. DevTools > Elements tab
2. Press `Ctrl+F` to search
3. Search for: `pii-guardian-modal`
4. If found: Screenshot the element and its styles
5. If not found: Modal injection failed

---

## 10. Nuclear Option - Fresh Install

If nothing else works, start completely fresh:

### Step 10.1: Complete Uninstall

1. Go to: `chrome://extensions/`
2. Find "PII Guardian"
3. Click **Remove**
4. Confirm removal

### Step 10.2: Delete Extension Data

```javascript
// In any Chrome page console:
chrome.storage.local.clear(() => {
  console.log('All extension data cleared');
});
```

### Step 10.3: Clear Browser Cache

1. Go to: `chrome://settings/clearBrowserData`
2. Select "Cached images and files"
3. Time range: "Last hour"
4. Click "Clear data"

### Step 10.4: Rebuild from Scratch

```bash
cd /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension

# Clean previous build
rm -rf dist/
rm -rf node_modules/

# Fresh install
npm install

# Build
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 10.5: Fresh Install

1. Go to: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Navigate to: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/dist`
5. Click "Select"

### Step 10.6: Verify Fresh Install

1. Extension appears in list
2. Version shows: 1.0.0
3. Toggle is ON
4. No errors in red

### Step 10.7: Test Basic Functionality

1. Go to: https://gemini.google.com/
2. Open DevTools Console (F12)
3. Look for: "PII Guardian: Input monitoring initialized"
4. Type: `9876543210`
5. Modal should appear

### Step 10.8: Configure Settings

1. Click extension icon in toolbar
2. Go to Settings
3. Verify:
   - Extension enabled: ON
   - Sensitivity: Medium
   - Phone Number: Checked
   - Email: Checked
   - Aadhaar: Checked

---

## Quick Reference: Debugging Commands

**Check if extension enabled:**
```javascript
chrome.storage.local.get(['enabled'], (r) => console.log('Enabled:', r.enabled));
```

**Check storage:**
```javascript
chrome.storage.local.get(null, (data) => console.log('Storage:', data));
```

**Test PII detection:**
```javascript
quickPIICheck("9876543210")  // Should return true
```

**Find input element:**
```javascript
const input = document.querySelector('[contenteditable="true"]');
console.log('Input:', input);
```

**Find send button:**
```javascript
const btn = document.querySelector('[aria-label*="Send" i]');
console.log('Send button:', btn);
```

**Check event listeners:**
```javascript
const input = document.querySelector('[contenteditable="true"]');
console.log('Listeners:', getEventListeners(input));
```

**Clear all data:**
```javascript
chrome.storage.local.clear(() => console.log('Cleared'));
```

**Get manifest:**
```javascript
console.log(chrome.runtime.getManifest());
```

---

## Troubleshooting Flowchart

```
Extension not working?
│
├─> No console message "Input monitoring initialized"
│   │
│   ├─> Check chrome://extensions - Extension loaded?
│   │   ├─> NO: Load unpacked from dist folder
│   │   └─> YES: Check service worker for errors
│   │
│   └─> Reload extension + hard refresh page
│
├─> Modal not appearing
│   │
│   ├─> Check extension enabled (console command)
│   ├─> Check PII type enabled in settings
│   ├─> Test quickPIICheck() in console
│   └─> Check z-index of modal element
│
├─> Blocking not working
│   │
│   ├─> Check event listeners attached
│   ├─> Test event.preventDefault() manually
│   └─> Check console for errors during keydown
│
└─> Stats not updating
    │
    ├─> Check storage.local.get(['stats'])
    ├─> Test incrementDetection() function
    └─> Clear storage and retry
```

---

## Getting Help

If you've tried everything in this guide and still have issues:

1. Collect all debug information from Section 9
2. Note which tests pass and which fail
3. Include console screenshots
4. Describe exact steps to reproduce
5. Share your Chrome version
6. Share your OS (Windows/Mac/Linux)

---

## Success Checklist

Extension is working correctly if ALL of these are true:

- [ ] Console shows "PII Guardian: Input monitoring initialized"
- [ ] Typing phone number triggers modal
- [ ] Pressing Enter with PII shows modal and blocks submission
- [ ] Clicking Send button with PII shows modal and blocks submission
- [ ] "Send Anyway" button allows sending
- [ ] "Mask & Send" button masks the PII
- [ ] "Cancel" button clears input (if setting enabled)
- [ ] Stats increment in popup dashboard
- [ ] Extension toggle works (enable/disable)
- [ ] Settings page loads without errors

If all checkboxes are checked, your extension is fully functional!

---

**Last Updated:** 2025-11-09
**Extension Version:** 1.0.0
**Guide Version:** 1.0
