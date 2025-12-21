## Shadow DOM Input Discovery

Gemini and similar chat UIs render their compose boxes inside shadow DOMs. The default `querySelectorAll('[contenteditable=true]')` only sees light DOM, so detection could run (from other surfaces) but the floating panel would never attach to the real editor.

### What changed
- Added `collectEditableInputs(root)` in `src/content/monitorInputs.js` to walk shadow roots and collect text inputs/contenteditables.
- Updated `monitorAllInputs()` to use this collector so initial attachment finds Gemini’s editor even inside shadow DOM.
- Mutation observer still runs as before; periodic `monitorAllInputs()` also re-scans with the new collector.

### How it works
1. Start from `document`, recurse through any `shadowRoot` on descendants.
2. Collect `input[type="text"]`, `textarea`, and `[contenteditable="true"]` elements into a set (to avoid dupes).
3. Attach listeners/floating button to those that pass `isAIChatInput`.

### Notes
- No selectors hard-coded to Gemini; it’s a generic shadow traversal to cover similar UIs.
- Text extraction already preserves spacing (`innerText` + cleanup) so regex detection isn’t broken by lost separators.
