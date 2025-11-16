# Version 1.2.0 Release Notes

## Release Date: 2025-11-16

## Major Features

### ✨ Grammarly-Style PII Highlighting
- **Real-time visual highlighting** of detected PII with colored wavy underlines
- Color-coded by risk level:
  - 🔴 **Red wavy underline** - Critical PII (Aadhaar, PAN, 90%+ confidence)
  - 🟠 **Orange wavy underline** - High/Medium risk (75-90% confidence)
  - 🟢 **Green wavy underline** - Low risk (<75% confidence)
- Non-invasive highlighting that preserves original text formatting and spacing
- Highlights appear instantly as text is typed or AI responses appear

### ⚡ Instant Detection Like Grammarly
- **MutationObserver** integration for immediate detection of AI chat responses
- No waiting - PII is detected and highlighted the moment it appears on screen
- Instant detection on:
  - Page load
  - Paste events
  - Focus events
  - AI response text appearing
  - Content mutations
- Smart debouncing (300ms) only during typing for performance

### 🎯 Enhanced Floating Button
- **Pulse animations** for critical and high-risk PII detection
- Improved positioning with auto-adjustment to stay within viewport
- Better z-index handling to avoid conflicts with chat UI elements

### 🔧 Technical Improvements

#### Highlighting System
- DOM-based highlighting using TreeWalker and text node splitting
- Preserves exact spacing, formatting, and text structure
- No text rebuilding or manipulation
- Clean text extraction for masking operations

#### Panel Improvements
- Appends to document.body for better positioning control
- Auto-adjusts if cut off at top or right edge of viewport
- Proper scrolling for multiple PII items
- Enhanced readability with larger fonts and better spacing

#### Masking Fixes
- Fixed whitespace preservation during masking
- Clean text extraction that ignores highlight HTML
- Proper cursor position restoration after masking

## Bug Fixes
- ✅ Fixed extra spaces being added/removed during masking
- ✅ Fixed random numbers appearing in highlighted text
- ✅ Fixed panel being cut off with multiple PII items
- ✅ Fixed masking not working with highlighted text
- ✅ Fixed spacing preservation in contentEditable elements

## Platform Support
- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Perplexity (perplexity.ai)
- Grok/X (x.com, twitter.com)

## Known Issues
None at this time

## Upgrade Notes
- Extension will automatically update version number
- No data migration required
- All existing settings and detection history preserved

## What's Next (Planned for Future Releases)
- Phase 2: Quick preview tooltip on button hover
- Phase 3: Enhanced slide-in/fade-out animations
- Phase 4: One-click "Mask All" on hover
- Phase 5: Smart panel positioning logic
- Phase 6: Progress indicator during detection
- Phase 7: Keyboard shortcuts (Ctrl/Cmd+Shift+P)
- Phase 8: Visual feedback on mask/remove actions
- Phase 9: Dismissible notification option
- Phase 10: Drag-to-reposition functionality
