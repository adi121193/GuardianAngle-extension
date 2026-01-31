# PII Guardian - Getting Started

## Quick Installation

### Prerequisites
- Chrome/Edge browser (v90+)
- Node.js 18+ (for development only)

### Install Extension
1. Download the latest release from [Releases](https://github.com/yourusername/PII-Guardian-extension/releases)
2. Unzip the file
3. Open Chrome → `chrome://extensions`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" → Select the `dist` folder

### First Run
1. Click the PII Guardian icon in your toolbar
2. Complete the welcome onboarding
3. Enable PII detection (toggle in popup)
4. Visit ChatGPT or any text input field
5. Type some PII (e.g., email, phone) → Shield icon appears!

## Features Overview

### Core Protection
- **Real-time Detection**: Detects 15+ PII types as you type
- **Smart Masking**: One-click masking with format preservation
- **Image OCR**: Scans pasted images for PII
- **Manual Redaction**: Draw boxes to hide sensitive areas

### Supported PII Types
- 📧 Email addresses
- 📞 Phone numbers (Indian + International)
- 🆔 Aadhaar, PAN, Passport
- 💳 Credit cards (with Luhn validation)
- 🏦 Bank accounts, IFSC codes
- 📅 Dates of birth
- 🌐 IP addresses
- 🏥 Medical records

### Detection Modes
- **Regex Only**: Fast, pattern-based detection
- **NER Only**: AI-powered name/organization detection
- **Hybrid** (Recommended): Best of both worlds

## Configuration

### Settings (Click gear icon in popup)
- **Minimum Confidence**: Adjust sensitivity (default: 60%)
- **Enabled PII Types**: Toggle specific types on/off
- **Detection Mode**: Choose regex/NER/hybrid
- **History Scanning**: Opt-in to scan chat history

### Pro License (Optional)
- Unlimited masking operations
- Priority support
- Early access to new features

**Activate**: Enter license key in Settings → License

## Troubleshooting

### Extension Not Working?
1. **Refresh the page** after installing
2. Check if extension is enabled (`chrome://extensions`)
3. Ensure you're on a supported site (ChatGPT, Gmail, etc.)

### PII Not Detected?
1. Check **Settings** → Ensure PII type is enabled
2. Lower **Minimum Confidence** to 50%
3. Try **Hybrid mode** for better coverage

### Console Errors?
1. Open DevTools (F12) → Console tab
2. Look for `[PII Guardian]` errors
3. Report issues with error message

## Next Steps

- 📖 Read [Development Guide](docs/DEVELOPMENT.md) to contribute
- 🧪 See [Testing Guide](docs/TESTING_GUIDE.md) for QA
- 📝 Check [CHANGELOG](docs/CHANGELOG.md) for updates

## Support

- 🐛 Report bugs: [GitHub Issues](https://github.com/yourusername/PII-Guardian-extension/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/PII-Guardian-extension/discussions)
- 📧 Email: support@pii-guardian.com
