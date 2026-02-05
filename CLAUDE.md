# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Guardian Angle is a Chrome Manifest V3 browser extension that detects and protects sensitive PII (Personally Identifiable Information) before users send it to AI platforms (ChatGPT, Claude, Gemini, Perplexity, Twitter/X). All detection runs locally on-device with zero cloud dependency.

## Build Commands

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run watch           # PRO tier (default)
npm run watch:free      # FREE tier

# Production builds
npm run build           # Runs tests then builds PRO tier
npm run build:quick     # PRO build without tests
npm run build:free      # FREE tier (regex-only, smaller bundle)
npm run build:pro       # PRO tier (includes OCR/Tesseract.js)

# Package for distribution
npm run package:free    # Creates guardian-angle-free.zip
npm run package:pro     # Creates guardian-angle-pro.zip

# Testing
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:regression # Regression tests only
npm run test:coverage   # Tests with coverage report

# Run single test file
NODE_OPTIONS=--experimental-vm-modules npx jest tests/unit/validators.test.js

# Clean
npm run clean           # Removes dist/, coverage/, *.zip
```

## Loading the Extension

After building, load `dist/` folder (not root) in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Architecture

```
Content Script (monitorInputs.js)
    │
    ├── detectText.js ────────┐
    │                         │
    ├── hybridDetector.js ────┼── Detection Engine
    │                         │   (Regex + optional NER)
    └── regexPatterns.js ─────┘
            │
            ▼
    injectWarningUI.js ──── Warning Modal (Shadow DOM)
            │
            ▼
    serviceWorker.js ────── Background Script
            │               (Stats, Settings, License)
            ▼
    offscreen.js ────────── Offscreen Document
                            (OCR via Tesseract.js)
```

**Key data flow:**
- Content script monitors AI chat inputs via MutationObserver
- Input debounced (300ms) → quickPIICheck() → full detectPII()
- PII detected → Shadow DOM modal shown → User action (Mask/Send/Cancel)
- Stats updated via chrome.runtime messages to service worker

## Key Files

| Path | Purpose |
|------|---------|
| `src/content/monitorInputs.js` | Main content script, monitors AI chat inputs |
| `src/content/detectText.js` | Text PII detection orchestrator |
| `src/detection/hybridDetector.js` | Combines regex + NER detection |
| `src/utils/regexPatterns.js` | 25+ PII regex patterns with validators |
| `src/utils/validators.js` | Checksum validators (Verhoeff, Luhn, PAN) |
| `src/utils/maskRules.js` | Type-specific masking functions |
| `src/content/injectWarningUI.js` | Shadow DOM warning modal |
| `src/background/serviceWorker.js` | Extension lifecycle, message hub |
| `src/ml/offscreen.js` | Offscreen document for OCR (PRO) |
| `src/ml/offscreenManager.js` | Manages offscreen document lifecycle |
| `esbuild.config.js` | Build configuration with tier support |

## Tier System

- **FREE tier**: Regex-only detection (~5-10 MB)
- **PRO tier**: Regex + OCR via Tesseract.js (~15-20 MB)

Tier is set via `EXTENSION_TIER` env var at build time. NER model was removed; detection now relies on enhanced regex patterns.

## PII Detection Patterns

Supported types (defined in `regexPatterns.js`):
- Indian: Aadhaar (Verhoeff checksum), PAN, Voter ID, Driving License, IFSC, GST, UPI ID
- Global: Phone, Email, Credit Card (Luhn), SSN, Passport, DOB, IP Address, Bank Account

Each pattern has:
- `pattern`: Regex
- `validator`: Optional function for checksum/format validation
- `confidence`: Base confidence score
- `priority`: Detection order (lower = checked first)

## Testing

Tests use Jest with JSDOM. Chrome APIs are mocked in `tests/mocks/chrome.js`.

```bash
# Run specific test file
NODE_OPTIONS=--experimental-vm-modules npx jest tests/unit/validators.test.js

# Run tests matching pattern
NODE_OPTIONS=--experimental-vm-modules npx jest -t "Aadhaar"
```

Coverage thresholds: 50% statements, 40% branches/functions.

## Message Types (chrome.runtime)

| Type | Direction | Purpose |
|------|-----------|---------|
| `GET_SETTINGS` | Content → BG | Retrieve settings |
| `UPDATE_SETTINGS` | UI → BG | Save settings |
| `INCREMENT_DETECTION` | Content → BG | Track detection by type |
| `INCREMENT_MASKED` | Content → BG | Track mask actions |
| `INCREMENT_BLOCKED` | Content → BG | Track cancel actions |
| `RUN_OCR_INFERENCE` | Content → BG | Trigger OCR (PRO) |
| `PING` | Any → BG | Health check |

## Common Gotchas

1. **Build output**: Always load `dist/` folder, not project root
2. **ES Modules**: Package uses `"type": "module"`, tests require `NODE_OPTIONS=--experimental-vm-modules`
3. **Content script reload**: After code changes, refresh the AI platform tab (content scripts don't hot-reload)
4. **Offscreen document**: OCR runs in offscreen document due to Manifest V3 restrictions on service worker
5. **Shadow DOM**: Warning modal uses Shadow DOM for CSS isolation from host pages
6. **Aadhaar validation**: Uses Verhoeff checksum algorithm, not just format matching
