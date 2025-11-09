# DEVELOPER QUICK FIX GUIDE
## PII Guardian Extension - Critical Issues Resolution

**Time Required:** 2 hours
**Difficulty:** Moderate (requires bundler setup)
**Priority:** CRITICAL - Extension cannot load without these fixes

---

## QUICK START - 5 MINUTE FIXES FIRST

### Fix 1: Remove Missing CSS Reference (2 minutes)
**Bug:** BUG001
**File:** `manifest.json`

**Current (WRONG):**
```json
"content_scripts": [
  {
    "matches": [...],
    "js": [
      "src/content/monitorInputs.js",
      "src/content/detectText.js",
      "src/content/injectWarningUI.js"
    ],
    "css": [
      "src/styles/warningModal.css"  // ← DELETE THIS
    ],
    "run_at": "document_idle"
  }
]
```

**Fixed (CORRECT):**
```json
"content_scripts": [
  {
    "matches": [...],
    "js": [
      "src/content/monitorInputs.js",
      "src/content/detectText.js",
      "src/content/injectWarningUI.js"
    ],
    "run_at": "document_idle"
  }
]
```

Just remove the entire `"css"` array (lines 33-35).

---

### Fix 2: Add Missing Permissions (1 minute)
**Bugs:** BUG004, BUG005
**File:** `manifest.json`

**Current (WRONG):**
```json
"permissions": [
  "storage",
  "scripting",
  "activeTab"
]
```

**Fixed (CORRECT):**
```json
"permissions": [
  "storage",
  "scripting",
  "activeTab",
  "notifications",
  "alarms"
]
```

---

## MAIN FIX - SETUP BUNDLER (90 minutes)

### Step 1: Install esbuild (2 minutes)

```bash
cd /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension
npm install --save-dev esbuild
```

---

### Step 2: Create Build Script (10 minutes)

Create new file: `build.js`

```javascript
const esbuild = require('esbuild');

const buildOptions = {
  bundle: true,
  minify: false, // Set to true for production
  sourcemap: true,
  target: 'chrome120',
  format: 'iife',
  logLevel: 'info'
};

async function build() {
  try {
    // Build Content Scripts
    console.log('Building content scripts...');
    await esbuild.build({
      ...buildOptions,
      entryPoints: [
        'src/content/monitorInputs.js',
        'src/content/detectText.js',
        'src/content/injectWarningUI.js'
      ],
      outdir: 'dist/content'
    });

    // Build UI Scripts
    console.log('Building UI scripts...');
    await esbuild.build({
      ...buildOptions,
      entryPoints: [
        'src/ui/popup.js',
        'src/ui/settings.js',
        'src/ui/dashboard.js',
        'src/ui/license.js'
      ],
      outdir: 'dist/ui'
    });

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
```

---

### Step 3: Update package.json (3 minutes)

Add build scripts:

```json
{
  "name": "pii-guardian",
  "version": "1.0.0",
  "scripts": {
    "build": "node build.js",
    "watch": "node build.js --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "esbuild": "^0.19.0"
  }
}
```

---

### Step 4: Update .gitignore (1 minute)

Add build output to `.gitignore`:

```
node_modules/
dist/
*.log
.DS_Store
```

---

### Step 5: Update manifest.json Paths (5 minutes)

**Current (WRONG):**
```json
"content_scripts": [
  {
    "matches": [...],
    "js": [
      "src/content/monitorInputs.js",
      "src/content/detectText.js",
      "src/content/injectWarningUI.js"
    ],
    "run_at": "document_idle"
  }
]
```

**Fixed (CORRECT):**
```json
"content_scripts": [
  {
    "matches": [...],
    "js": [
      "dist/content/monitorInputs.js",
      "dist/content/detectText.js",
      "dist/content/injectWarningUI.js"
    ],
    "run_at": "document_idle"
  }
]
```

---

### Step 6: Update HTML Files (15 minutes)

#### popup.html

**Current (WRONG):**
```html
<script type="module" src="../src/ui/popup.js"></script>
```

**Fixed (CORRECT):**
```html
<script src="../dist/ui/popup.js"></script>
```

#### settings.html

**Current (WRONG):**
```html
<script type="module" src="../src/ui/settings.js"></script>
```

**Fixed (CORRECT):**
```html
<script src="../dist/ui/settings.js"></script>
```

#### dashboard.html

**Current (WRONG):**
```html
<script type="module" src="../src/ui/dashboard.js"></script>
```

**Fixed (CORRECT):**
```html
<script src="../dist/ui/dashboard.js"></script>
```

#### license.html

**Current (WRONG):**
```html
<script type="module" src="../src/ui/license.js"></script>
```

**Fixed (CORRECT):**
```html
<script src="../dist/ui/license.js"></script>
```

---

### Step 7: Build the Extension (2 minutes)

```bash
npm run build
```

**Expected Output:**
```
Building content scripts...
  dist/content/monitorInputs.js  [X]kb
  dist/content/detectText.js     [X]kb
  dist/content/injectWarningUI.js [X]kb

Building UI scripts...
  dist/ui/popup.js      [X]kb
  dist/ui/settings.js   [X]kb
  dist/ui/dashboard.js  [X]kb
  dist/ui/license.js    [X]kb

Build completed successfully!
```

Verify `dist/` directory was created with bundled files:
```bash
ls -R dist/
```

Should show:
```
dist/content/
  monitorInputs.js
  detectText.js
  injectWarningUI.js

dist/ui/
  popup.js
  settings.js
  dashboard.js
  license.js
```

---

### Step 8: Test Load Extension (5 minutes)

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/`
6. Click **"Select"**

**Expected Result:**
- Extension appears in list
- Name: "PII Guardian"
- Purple shield icon visible
- No errors in console
- Extension enabled (toggle ON)

---

### Step 9: Verify Service Worker (3 minutes)

In `chrome://extensions/`, under PII Guardian:

1. Click **"Service worker"** link
2. Service worker console opens

**Expected Output:**
```
PII Guardian installed/updated
PII Guardian service worker initialized
```

**No red errors should appear.**

---

### Step 10: Test Popup (5 minutes)

1. Click extension icon in Chrome toolbar (purple shield)
2. Popup should open

**Expected:**
- Stats display: 0 / 0 / 0
- Status: "Active" (green dot)
- Toggle switch: ON
- Buttons: Dashboard, Settings
- Pro banner visible

**Open popup DevTools:**
1. Right-click popup
2. Select "Inspect"
3. Check console - should be clean (no errors)

---

### Step 11: Test Content Script (10 minutes)

1. Navigate to: `https://chat.openai.com`
2. Open browser console (F12)
3. Look for: `"PII Guardian: Input monitoring initialized"`

**Test PII Detection:**
1. In chat input, type: `My phone is 9876543210`
2. Wait 1 second
3. Warning modal should appear
4. Modal shows: "Phone Number" detected
5. Three buttons: "Mask & Continue", "Send Anyway", "Cancel"

**If modal appears:** SUCCESS!
**If modal doesn't appear:** Check console for errors

---

## OPTIONAL FIX - Code Quality (15 minutes)

### Fix 3: Remove Duplicate License Check
**Bug:** BUG006
**File:** `src/background/serviceWorker.js`

**Delete lines 151-177** (the setInterval block):
```javascript
// DELETE THIS ENTIRE BLOCK
setInterval(async () => {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings;

  if (settings?.proEnabled && settings?.licenseExpiry) {
    const expiryDate = new Date(settings.licenseExpiry);
    const now = new Date();

    if (now > expiryDate) {
      settings.proEnabled = false;
      settings.imageDetection = false;
      settings.autoBlur = false;
      await chrome.storage.local.set({ settings });

      console.log('License expired - Pro features disabled');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
        title: 'PII Guardian - License Expired',
        message: 'Your Pro license has expired. Please renew to continue using Pro features.'
      });
    }
  }
}, 60 * 60 * 1000); // Check every hour
```

**Update lines 180-186** with actual logic:
```javascript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'license-check') {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings;

    if (settings?.proEnabled && settings?.licenseExpiry) {
      const expiryDate = new Date(settings.licenseExpiry);
      const now = new Date();

      if (now > expiryDate) {
        settings.proEnabled = false;
        settings.imageDetection = false;
        settings.autoBlur = false;
        await chrome.storage.local.set({ settings });

        console.log('License expired - Pro features disabled');

        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
          title: 'PII Guardian - License Expired',
          message: 'Your Pro license has expired. Please renew to continue using Pro features.'
        });
      }
    }
  }
});
```

**Rebuild after this change:**
```bash
npm run build
```

Then reload extension in Chrome.

---

## VERIFICATION CHECKLIST

After all fixes are complete:

### Load & Initialization
- [ ] Extension loads in Chrome without errors
- [ ] Service worker console shows: "PII Guardian service worker initialized"
- [ ] No red errors in service worker console
- [ ] Extension icon displays (purple shield)

### Popup UI
- [ ] Popup opens when clicking icon
- [ ] Stats display (0/0/0)
- [ ] Toggle switch works
- [ ] Status shows "Active" (green)
- [ ] Dashboard button opens dashboard in new tab
- [ ] Settings button opens settings in new tab
- [ ] Upgrade button opens license page in new tab
- [ ] No console errors in popup DevTools

### Content Scripts
- [ ] Navigate to ChatGPT/Claude
- [ ] Console shows: "PII Guardian: Input monitoring initialized"
- [ ] Type test PII (phone number)
- [ ] Modal appears after 300ms
- [ ] Modal shows correct PII type detected
- [ ] Three action buttons work
- [ ] No console errors

### Permissions
- [ ] Storage permission working (settings persist)
- [ ] Notifications permission available
- [ ] Alarms permission available
- [ ] No permission errors in console

### Storage
Open popup DevTools console and run:
```javascript
chrome.storage.local.get(null, console.log)
```

Should show:
```javascript
{
  settings: {
    enabled: true,
    autoMask: true,
    // ... etc
    stats: {
      totalDetections: 0,
      totalMasked: 0,
      totalBlocked: 0,
      // ... etc
    }
  }
}
```

---

## TROUBLESHOOTING

### Problem: "Cannot find module 'esbuild'"
**Solution:**
```bash
npm install --save-dev esbuild
```

### Problem: Build fails with errors
**Solution:**
- Check that all source files exist
- Verify import paths are correct
- Run: `npm run clean` then `npm run build`

### Problem: Extension won't load after build
**Solution:**
- Verify `dist/` directory exists with all files
- Check manifest.json paths point to `dist/`
- Remove old extension and reload
- Check for typos in manifest.json

### Problem: Popup shows blank
**Solution:**
- Open popup DevTools (right-click → Inspect)
- Check console for errors
- Verify `dist/ui/popup.js` exists
- Check HTML file has correct script path

### Problem: Content scripts don't work
**Solution:**
- Check console on ChatGPT/Claude page
- Look for syntax errors
- Verify `dist/content/` files exist
- Hard refresh page (Cmd+Shift+R / Ctrl+Shift+F5)

### Problem: Modal doesn't appear
**Solution:**
- Check console for errors
- Verify content scripts loaded
- Type longer PII (at least 10 digits for phone)
- Wait full 300ms debounce delay
- Check you're on supported site (ChatGPT/Claude/Gemini/Perplexity)

---

## COMPLETE FILE CHECKLIST

### Files to Modify:
- [ ] `manifest.json` (3 changes)
- [ ] `html/popup.html` (1 change)
- [ ] `html/settings.html` (1 change)
- [ ] `html/dashboard.html` (1 change)
- [ ] `html/license.html` (1 change)
- [ ] `package.json` (add scripts)
- [ ] `.gitignore` (add dist/)
- [ ] `src/background/serviceWorker.js` (optional - BUG006)

### Files to Create:
- [ ] `build.js` (bundler script)

### Directories Created (auto):
- [ ] `dist/`
- [ ] `dist/content/`
- [ ] `dist/ui/`

### Files Generated (auto):
- [ ] `dist/content/monitorInputs.js`
- [ ] `dist/content/detectText.js`
- [ ] `dist/content/injectWarningUI.js`
- [ ] `dist/ui/popup.js`
- [ ] `dist/ui/settings.js`
- [ ] `dist/ui/dashboard.js`
- [ ] `dist/ui/license.js`

---

## SUCCESS CRITERIA

Extension is READY when:

1. **Loads without errors** in Chrome
2. **Service worker initializes** (console message)
3. **Popup opens and functions** (UI works)
4. **Content scripts inject** on ChatGPT/Claude
5. **PII detection works** (modal appears)
6. **No console errors** anywhere

---

## AFTER COMPLETION

1. Notify QA Tester that T003 is complete
2. QA Tester will re-run T002 test suite
3. QA Tester will verify all bugs are fixed
4. Proceed to T004 (if any remaining tasks)
5. QA Tester will run T005 (comprehensive functional testing)

---

## TIME BREAKDOWN

| Task | Time | Cumulative |
|------|------|------------|
| Fix CSS reference | 2 min | 2 min |
| Add permissions | 1 min | 3 min |
| Install esbuild | 2 min | 5 min |
| Create build.js | 10 min | 15 min |
| Update package.json | 3 min | 18 min |
| Update .gitignore | 1 min | 19 min |
| Update manifest paths | 5 min | 24 min |
| Update HTML files | 15 min | 39 min |
| Build extension | 2 min | 41 min |
| Test load | 5 min | 46 min |
| Test service worker | 3 min | 49 min |
| Test popup | 5 min | 54 min |
| Test content scripts | 10 min | 64 min |
| **Optional: Fix BUG006** | 15 min | 79 min |
| **Buffer time** | 21 min | 100 min |

**Total: ~90-120 minutes (1.5-2 hours)**

---

**Good luck! The code is excellent - just needs bundling to work in Chrome.**

**Questions?** See full reports:
- `QA_TEST_REPORT_T002.md` (detailed test report)
- `CRITICAL_ISSUES_SUMMARY.md` (executive summary)
- `BUG_TRACKER.md` (bug details)
