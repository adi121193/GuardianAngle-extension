# PII Guardian - Quick Start Guide

**Status:** Ready for Testing ✅
**Last Updated:** 2025-11-09 (After T003 Fixes)

---

## Installation (Chrome/Brave/Edge)

### STEP 1: Build the Extension

**IMPORTANT:** You must build the extension before loading it in Chrome!

```bash
cd /Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension
npm run build
```

**Expected Output:**
```
✅ JavaScript bundled successfully
✅ Build complete!
📂 Output directory: dist/
```

---

### STEP 2: Load the Extension

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. **IMPORTANT:** Select the `dist/` folder: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/dist`
5. The PII Guardian extension should now appear in your toolbar

**Common Mistake:** Don't select the root folder! Select the `dist/` subfolder.

### STEP 3: Verify Installation

You should see:
- ✅ Purple/blue gradient shield icon in Chrome toolbar
- ✅ "PII Guardian" listed in extensions page
- ✅ Service worker shows "Active"
- ✅ No errors in the extensions page

### 3. Test the Extension

Visit any supported AI platform:
- https://chat.openai.com
- https://claude.ai
- https://gemini.google.com
- https://www.perplexity.ai

**Test with sample PII**:
1. Go to ChatGPT (or another supported platform)
2. Type in the chat input: `My SSN is 123-45-6789`
3. A warning modal should appear before you send
4. The extension detects: SSN, email, phone, credit card, IP address, etc.

### 4. Access Settings

Click the extension icon in your toolbar to:
- Enable/disable PII detection
- View detection history
- Configure sensitivity levels
- See extension status

## Troubleshooting

**"Manifest file is missing or unreadable"**
- ❌ You didn't run `npm run build` first
- ✅ Fix: Run `npm run build` to create the dist/ folder

**Extension won't load / Module import errors**
- ❌ You selected the root folder instead of dist/
- ✅ Fix: Load the `dist/` folder, not the root folder

**Changes not appearing after code edits**
- ❌ You forgot to rebuild
- ✅ Fix: Run `npm run build`, then click reload in chrome://extensions

**Icons not showing?**
- Verify all icon files exist: `ls assets/icons/`
- Run: `npm run generate-icons`
- Rebuild: `npm run build`
- Reload extension

**Extension not detecting PII?**
- Check console for errors (F12)
- Verify you're on a supported website (ChatGPT, Claude, etc.)
- Ensure extension is enabled
- Check console for "PII Guardian: Input monitoring initialized"

**Permission errors in service worker**
- ❌ Old version of manifest.json
- ✅ Fix: Pull latest changes and rebuild

## Development

```bash
# Install dependencies (first time setup)
npm install

# Build extension (required before loading)
npm run build

# Clean build artifacts
npm run clean

# Rebuild after making changes
npm run build

# Regenerate icons (if needed)
npm run generate-icons
```

**Important Development Notes:**
1. Always edit files in `src/`, never in `dist/`
2. Run `npm run build` after making changes
3. Reload extension in Chrome after rebuilding
4. Use source maps for debugging (automatically included)

## File Structure

```
PII-Detection-Extension/
├── src/                   # SOURCE FILES (edit these)
│   ├── background/        # Service worker
│   ├── content/           # Content scripts
│   ├── ui/                # UI scripts (popup, settings, etc.)
│   ├── utils/             # Shared utilities
│   ├── models/            # AI models
│   └── styles/            # CSS files
├── dist/                  # BUILT FILES (load this in Chrome)
│   ├── content/           # Bundled content scripts
│   ├── background/        # Bundled service worker
│   ├── ui/                # Bundled UI scripts
│   ├── html/              # HTML pages
│   ├── styles/            # CSS files
│   ├── assets/            # Icons and images
│   └── manifest.json      # Extension manifest
├── html/                  # HTML templates
├── assets/                # Icons and images
├── esbuild.config.js      # Build configuration
├── package.json           # Dependencies & scripts
└── manifest.json          # Extension manifest (source)
```

**Remember:** Edit `src/`, build to `dist/`, load `dist/` in Chrome!

## Key Features

1. **Real-time PII Detection** - Monitors text input on AI platforms
2. **Local Processing** - All detection happens on your device
3. **Privacy First** - No data sent to external servers
4. **Multi-platform** - Works on ChatGPT, Claude, Gemini, Perplexity
5. **Smart Warnings** - Alerts you before sending sensitive data

## Next Steps

### For Users
1. Build extension: `npm run build` ✅
2. Load `dist/` folder in Chrome ✅
3. Test on AI platforms
4. Review detection accuracy
5. Configure settings as needed

### For Developers
1. Read `T003_FIX_SUMMARY.md` for detailed fix information
2. Review `BUG_TRACKER.md` for known issues
3. Check `QA_TEST_REPORT_T002.md` for test results

### For QA Testers
1. Load extension from `dist/` folder
2. Run comprehensive test suite (T005)
3. Verify all bugs fixed
4. Report any new issues

---

## Documentation

- **Quick Start:** This file
- **Fix Summary:** `T003_FIX_SUMMARY.md`
- **Bug Tracker:** `BUG_TRACKER.md`
- **QA Test Report:** `QA_TEST_REPORT_T002.md`
- **Developer Guide:** `DEVELOPER_QUICK_FIX_GUIDE.md`

---

**Last Updated:** 2025-11-09 (After T003 Fixes)
**Status:** Ready for Testing ✅
