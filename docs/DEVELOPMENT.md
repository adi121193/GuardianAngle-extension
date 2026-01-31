# Development Guide

## Architecture Overview

PII Guardian follows a modular architecture with clear separation of concerns:

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
     │  - monitorInputs.js      │
     └───────────┬──────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │  DETECTION ENGINE        │
     │ - Regex Engine           │
     │ - ONNX Tiny PII Model    │
     │ - WASM PaddleOCR (Pro)   │
     │  detectText.js           │
     │  detectImage.js          │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │    DECISION ENGINE       │
     │ block / warn / mask etc. │
     │  injectWarningUI.js      │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │   PROTECTION LAYER       │
     │ - Masking Module         │
     │ - Blur Module (Pro)      │
     │  maskRules.js            │
     └───────────┬─────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │      UI LAYER            │
     │ popup, warnings, settings│
     │  ui/*.js                 │
     └──────────────────────────┘
```

## Module Documentation

### Content Scripts

#### monitorInputs.js
- Monitors all input fields on AI chat sites
- Debounces input events (300ms)
- Triggers detection on paste and Enter key
- Uses MutationObserver for dynamic content

**Key Functions:**
- `isAIChatInput(element)`: Identifies AI chat inputs
- `handleInput(element)`: Main input handler with debouncing
- `handlePaste(event)`: Immediate paste detection

#### detectText.js
- Dual-engine PII detection (Regex + ONNX)
- Configurable confidence thresholds
- Batch detection support

**Key Functions:**
- `detectPII(text, options)`: Main detection function
- `quickPIICheck(text)`: Fast pre-filter
- `analyzeText(text, options)`: Detailed analysis with risk scoring

#### detectImage.js (Pro)
- OCR-based image PII detection
- Canvas API for image blurring
- Bounding box mapping

**Key Functions:**
- `detectPIIInImage(image)`: OCR + PII detection
- `blurPIIInImage(image, boundingBoxes)`: Apply blur to sensitive regions

#### injectWarningUI.js
- Shadow DOM for style isolation
- Animated modal with user actions
- Statistics tracking

**Key Functions:**
- `showWarningModal(detectionResult, targetElement)`: Display modal
- `createModalHTML(detectionResult)`: Generate modal markup

### Utilities

#### regexPatterns.js
- 15+ PII patterns (Aadhaar, PAN, Phone, Email, etc.)
- Confidence scoring
- Custom validators

**Pattern Structure:**
```javascript
{
  pattern: /regex/g,
  name: 'Display Name',
  confidence: 0.85,
  validator: (match) => boolean
}
```

#### maskRules.js
- Deterministic masking functions
- Type-specific masking strategies
- Preserves partial information for verification

**Masking Examples:**
- PAN: `ABCDE1234F` → `XXXXX1234F`
- Phone: `9876543210` → `98****210`
- Email: `john@example.com` → `j***@example.com`

#### storage.js
- Promise-based chrome.storage wrapper
- Default settings management
- Statistics tracking
- Import/export functionality

**Key Functions:**
- `getSettings()`: Retrieve current settings
- `saveSettings(settings)`: Persist settings
- `incrementDetection(type)`: Update stats

#### licenseValidation.js
- Offline RSA signature verification
- License parsing and expiry checks
- Pro feature unlocking

**License Format:**
```
PIIGUARD::PRO::<ISO_DATE>::<BASE64_SIGNATURE>
```

#### crypto.js
- Web Crypto API integration
- RSA-2048 signature verification
- SHA-256 hashing

### Background Script

#### serviceWorker.js
- Extension lifecycle management
- Message passing hub
- Periodic license validation
- Badge updates

**Message Types:**
- `GET_SETTINGS`: Retrieve settings
- `UPDATE_SETTINGS`: Save settings
- `GET_STATS`: Get statistics
- `RESET_STATS`: Clear statistics

### UI Components

#### popup.js
- Extension status display
- Quick statistics overview
- Navigation to settings/dashboard

#### settings.js
- Comprehensive settings management
- PII type toggles
- Confidence threshold slider
- Data export/import

#### dashboard.js
- Statistics visualization
- Detection trends
- PII type breakdown

#### license.js
- Pro license activation
- License status display
- Expiry warnings

## Detection Flow

```
1. User types in input field
   ↓
2. monitorInputs.js captures input (debounced)
   ↓
3. quickPIICheck() - fast regex pre-filter
   ↓
4. If potential PII detected:
   ↓
5. detectPII() - full detection
   ↓
6. If PII found:
   ↓
7. showWarningModal() - display warning
   ↓
8. User chooses action:
   - Mask & Continue → Apply masking
   - Send Anyway → Allow submission
   - Cancel → Block submission
   ↓
9. Update statistics
```

## Performance Optimization

### Input Monitoring
- **Debouncing**: 300ms delay prevents excessive detection
- **Quick Check**: Fast regex pre-filter before full detection
- **WeakMap**: Efficient element tracking
- **MutationObserver**: Minimal DOM polling

### Detection Engine
- **Early Exit**: Quick check returns immediately if no PII patterns
- **Confidence Filtering**: Skip low-confidence matches
- **Lazy ONNX Loading**: Model loaded only when needed

### UI Rendering
- **Shadow DOM**: Isolated styles prevent CSS conflicts
- **CSS Animations**: GPU-accelerated for smooth performance
- **Event Delegation**: Efficient event handling

## Security Considerations

### Data Privacy
1. **Local Processing Only**: All detection happens on-device
2. **No Network Requests**: Zero external data transmission
3. **Encrypted Storage**: Browser-level encryption for chrome.storage

### License Validation
1. **RSA-2048**: Strong cryptographic signatures
2. **Offline Verification**: No license server required
3. **Expiry Enforcement**: Automatic Pro feature disabling

### Code Security
1. **No eval()**: Prevents code injection
2. **CSP Compliant**: Strict Content Security Policy
3. **Input Sanitization**: All user input validated
4. **Shadow DOM**: Isolation from host page

## Testing Strategy

### Unit Testing
```javascript
// Example test for regexPatterns.js
import { detectPIIWithRegex } from './regexPatterns.js';

test('detects Aadhaar number', () => {
  const text = 'My Aadhaar is 1234 5678 9012';
  const result = detectPIIWithRegex(text);

  expect(result.piiDetected).toBe(true);
  expect(result.types).toContain('aadhaar');
});
```

### Integration Testing
1. Load extension in test browser
2. Visit test pages with known PII
3. Verify modal appears
4. Test each action (Mask, Send, Cancel)
5. Verify statistics update

### Manual Testing Checklist
- [ ] Warning modal displays correctly
- [ ] Masking works for all PII types
- [ ] Settings persist across sessions
- [ ] Statistics track accurately
- [ ] License activation works
- [ ] Pro features lock/unlock correctly
- [ ] Extension works on all target sites

## Build System (Optional)

For production builds with bundling:

```json
// package.json
{
  "scripts": {
    "dev": "vite build --mode development --watch",
    "build": "vite build --mode production",
    "test": "vitest"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vite-plugin-web-extension": "^3.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Contributing Guidelines

### Code Style
- Use ES6+ features
- Prefer `const` over `let`
- Use async/await over callbacks
- Comment complex logic
- Keep functions under 50 lines

### Commit Messages
```
feat: Add credit card detection
fix: Resolve modal positioning issue
docs: Update installation guide
perf: Optimize input debouncing
```

### Pull Request Process
1. Fork repository
2. Create feature branch
3. Write tests
4. Update documentation
5. Submit PR with description

## Roadmap

### Phase 1 (Current)
- [x] Core regex detection
- [x] Warning modal
- [x] Auto-masking
- [x] License validation

### Phase 2
- [ ] ONNX model integration
- [ ] OCR engine integration
- [ ] Build system
- [ ] Unit tests

### Phase 3
- [ ] Firefox support
- [ ] Safari support
- [ ] Chrome Web Store listing
- [ ] Analytics dashboard

### Phase 4
- [ ] Cloud sync (optional)
- [ ] Team management
- [ ] Custom PII patterns UI
- [ ] Audit logs

## Common Issues

### Import/Export Errors
If you see "Cannot use import statement outside a module":
- Ensure `type="module"` in script tags
- Check manifest.json has correct paths
- Verify file extensions are `.js`

### Content Script Not Loading
- Check `matches` patterns in manifest.json
- Verify `run_at` is set correctly
- Check browser console for errors

### Storage Not Persisting
- Ensure `storage` permission in manifest
- Check chrome.storage.local quota (10MB)
- Verify async/await syntax

## Resources

### Documentation
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Tools
- [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Regex101](https://regex101.com/) - Test regex patterns

### Community
- Stack Overflow: `[google-chrome-extension]` tag
- Reddit: r/webdev, r/chrome
- Discord: Web Development communities
