# CTO Review Report - PII Guardian

## Executive Summary
This report summarizes the architectural, functional, security, performance, and code quality issues discovered in the PII Guardian codebase. The findings are prioritized using the MoSCoW framework and laid out in a Kanban format.

## Kanban Board & Prioritization

### Must Have (Critical Issues & Bugs)
- **Global Event Handlers Blocking Uploads (Functional):** The `content/monitorInputs.js` script attaches aggressive global listeners (`paste`, `drop`, `change`) on the document root for file uploads, triggering PII checks and running `preventDefault` blindly across all websites, which breaks legitimate functionality on non-AI web platforms. *Status: To Do (Fix included in current patch)*.
- **Manifest V3 Missing Files in `content_scripts` (Architecture/Security):** The manifest currently injects scripts globally or in targeted areas, but some builds/tiers indicate issues with duplicate injections or mismatched build files. Ensure only exactly what is needed is bundled and requested in Manifest.

### Should Have (Important Architectural/Performance Flaws)
- **Offscreen Document Integration Complexity:** The OCR model loading and communication via `offscreenManagerProxy` is overly complex and prone to failure if the extension service worker context is invalidated. Tesseract.js loading inside an offscreen document needs solid error handling and retry mechanisms.
- **Service Worker Context Invalidation:** Content scripts sometimes assume `chrome.runtime.sendMessage` will succeed, but service workers go to sleep. Although there are some try-catch blocks, they fail silently in many places leaving the UI in an inconsistent state.
- **Storage Call Performance (Performance):** Several content scripts invoke `chrome.storage.local.get` in high-frequency event handlers (`input`, `paste`) instead of relying fully on the cached settings, causing performance bottlenecks in chat windows.

### Could Have (Enhancements & Code Quality)
- **Dead Code & Comments:** Significant amounts of commented-out code (e.g., in `serviceWorker.js` where `chrome.webRequest` is commented out, NER features partially removed but references kept). This creates confusion and technical debt.
- **Duplicate Logic:** The event blocking logic in `monitorInputs.js` is duplicated across multiple event handlers (`handleInput`, `simulateEnterKey`, `handleExternalImage`). Consolidate these into a unified event pipeline.

### Won't Have (Deferred / Low Priority)
- **NER (Named Entity Recognition) Deprecation Removal:** The code makes heavy references to an removed NER feature. Complete cleanup of all NER variables (`initializeNER`, `cachedNEREnabled`, `offscreenManagerProxy.runInference`) is not urgent but should be done eventually.

---

## Detailed Findings

1. **Upload Hampering Bug:** `src/content/monitorInputs.js` intercepts global document `drop` and `change` events. For non-pro users or on non-target platforms, it calls `event.preventDefault()` which stops users from uploading files anywhere.
2. **Missing Input Validation:** The codebase handles DOM nodes heavily, occasionally passing non-element nodes or elements without verifying `isAIChatInput` before processing logic when iterating over mutations.
