# PII Guardian

**Local AI Privacy Browser Extension (Manifest v3)**

**Status:** ✅ Ready for Testing (All critical bugs fixed - 2025-11-09)

## Quick Start

```bash
# Build the extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the "dist" folder
```

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

---

## Overview

PII Guardian is a fully local, privacy-focused browser extension that detects and protects sensitive personally identifiable information (PII) before it's sent to AI tools like ChatGPT, Claude, Gemini, and Perplexity.

## Features

### Core Features (Free)
- **Text PII Detection**: Detects phone numbers, Aadhaar, PAN, emails, DOB, addresses, govt IDs, bank info, invoice numbers, medical terms
- **Real-time Monitoring**: Intercepts text typed or pasted into AI chat interfaces
- **Smart Warning System**: Alerts users before sensitive data is transmitted
- **Auto-Masking**: Automatically masks detected PII (e.g., PAN → XXXX XXXX 1234)
- **Local Processing**: All detection happens on-device, zero cloud dependency
- **Dual Detection Engine**: Combines regex patterns + ONNX tiny ML model

### Pro Features
- **Image PII Detection**: OCR-based detection in uploaded images
- **Auto-Blur**: Automatically blur sensitive areas in images
- **Advanced Analytics**: Detailed PII detection reports and trends
- **Offline License**: Crypto-based license validation (no server required)

## Architecture

```
┌─────────────────────────────────────┐
│         Browser Window              │
│  (AI sites: ChatGPT, Gemini, etc.)  │
└───────────────┬─────────────────────┘
                │
                ▼
     ┌──────────────────────────┐
     │     CONTENT SCRIPT       │
     │ Monitors input + uploads │
     └───────────┬──────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │  DETECTION ENGINE        │
     │ - Regex Engine           │
     │ - ONNX Tiny PII Model    │
     │ - WASM PaddleOCR (Pro)   │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │    DECISION ENGINE       │
     │ block / warn / mask etc. │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │   PROTECTION LAYER       │
     │ - Masking Module         │
     │ - Blur Module (Pro)      │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │      UI LAYER            │
     │ popup, warnings, settings│
     └──────────────────────────┘
```

## Project Structure

```
pii-guardian/
│
├── manifest.json
├── package.json
│
├── src/
│   ├── background/
│   │   └── serviceWorker.js
│   ├── content/
│   │   ├── detectText.js
│   │   ├── detectImage.js
│   │   ├── injectWarningUI.js
│   │   └── monitorInputs.js
│   ├── models/
│   │   ├── pii-tiny.onnx
│   │   └── paddle-ocr-wasm/
│   ├── utils/
│   │   ├── regexPatterns.js
│   │   ├── maskRules.js
│   │   ├── licenseValidation.js
│   │   ├── crypto.js
│   │   └── storage.js
│   ├── ui/
│   │   ├── popup.js
│   │   ├── settings.js
│   │   ├── dashboard.js
│   │   └── license.js
│   └── styles/
│       ├── popup.css
│       ├── settings.css
│       └── warningModal.css
│
├── html/
│   ├── popup.html
│   ├── settings.html
│   ├── dashboard.html
│   └── license.html
│
└── assets/
    └── icons/
```

## Installation

1. Clone this repository
2. Run `npm install`
3. Load the extension in Chrome/Edge:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

## Development

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Privacy & Security

- ✅ **Zero Cloud Dependency**: All processing happens locally
- ✅ **No Data Collection**: Extension doesn't send any data externally
- ✅ **No Analytics**: No tracking unless explicitly enabled by user
- ✅ **Secure Code**: No eval() or unsafe JavaScript execution
- ✅ **Offline License**: Crypto-based validation without server calls

## License

MIT License - See LICENSE file for details

## Support

For issues and feature requests, please visit our [GitHub Issues](https://github.com/yourusername/pii-guardian/issues)
