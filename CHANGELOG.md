# Changelog

All notable changes to PII Guardian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-10

### Added
- **Enhanced Warning Modal with Detailed PII Information**
  - Now shows exact PII values that were detected (highlighted in yellow)
  - Displays confidence score for each detection (e.g., 95%)
  - Provides type-specific suggestions and alternatives for each PII type
  - Shows live preview of masked version before sending
  - Improved visual hierarchy with card-based layout

- **Smart Suggestions System**
  - Aadhaar: Suggests using "My Aadhaar number" without digits
  - PAN: Suggests using "My PAN card" without number
  - Phone: Suggests secure channel alternatives
  - Email: Suggests temporary email services
  - Credit Card: Warns to never share full numbers
  - And more for all 16 PII types

- **Masked Text Preview**
  - Users can now see exactly what the masked version will look like
  - Displayed in a highlighted preview box before choosing action
  - Makes "Mask & Continue" option more transparent

- **Better UX**
  - Button labels improved: "Cancel & Edit" instead of "Cancel"
  - Item count in header: "CRITICAL RISK - 3 items"
  - Tooltips on all action buttons
  - Color-coded confidence badges

### Fixed
- **CRITICAL: Restored content_scripts section in manifest.json**
  - Content script was not being injected on any platform
  - Extension was completely non-functional
  - Fixed by restoring content_scripts configuration

- **Removed incomplete ONNX Runtime integration**
  - Eliminated "ONNX Runtime not available" console warnings
  - Cleaned up 150+ lines of unused code
  - Reduced bundle size by ~5MB
  - Simplified detection engine to regex-only (no functionality loss)

### Changed
- Modal now shows detailed information instead of just PII type counts
- Detection confidence displayed per-item instead of overall average
- Footer shows version number for better tracking
- Improved popup UI with centered design and shadcn principles

### Performance
- Extension bundle reduced by ~5MB (removed onnxruntime-web)
- node_modules reduced from ~35MB to 30MB
- Cleaner, more maintainable codebase

---

## [1.0.0] - 2025-11-09

### Added
- Initial release of PII Guardian
- Real-time PII detection using regex patterns
- Support for 16 PII types (Aadhaar, PAN, Phone, Email, etc.)
- Warning modal for blocking sensitive data
- Masking functionality for safe data transmission
- Statistics tracking (detections, masked, blocked)
- Dashboard for viewing analytics
- Settings page for configuration
- Support for ChatGPT, Claude, Gemini, and Perplexity
- Modern popup UI with gradient design
- Pro/upgrade banner for future features

### Security
- All processing done locally (no data sent to external servers)
- Shadow DOM isolation for modal UI
- Content Security Policy configured
- Manifest V3 compliance

---

## Version Numbering

- **Major version** (X.0.0): Breaking changes or major redesign
- **Minor version** (1.X.0): New features, improvements
- **Patch version** (1.0.X): Bug fixes, small tweaks

**Current Version: 1.1.0**
