# Product Backlog: PII Guardian

## Epic: User Experience & Core Protection Stability

**Context:** The extension currently serves as a privacy guardian for AI chat platforms. We recently removed a fragile Machine Learning (NER) dependency to simplify the codebase and rely on robust Regex, which was a solid engineering decision. However, there are lingering UI friction points and performance edge cases that prevent the tool from being a seamless part of the user's workflow.

---

### Priority 1: High (Next Sprint)

#### 1. Bug: Inconsistent Floating Button State
**What will happen:** The Grammarly-style floating button (which shows the number of PII detections in an input field) currently refers to "NER" and "Regex-only mode" in its UI tooltips and summary overlays. This causes confusion because the user has no idea what "NER" means, and the feature was removed. We will clean up these UI elements so the user only sees "PII Detected" without technical jargon.
* **User Story:** As a user, I want the warning UI to be clear and simple, without seeing error states or technical jargon about "NER unavailability" so I can trust the extension is working.
* **Developers Required:** 1 Frontend Developer (Content Scripts / UI)
* **Why it's necessary:** Confusing UI breeds mistrust. A privacy extension needs to project absolute reliability. Showing "NER unavailable" makes the user think the app is broken when it's actually working by design.

#### 2. Bug: DOM Manipulation causing Cursor Jumping
**What will happen:** The `monitorInputs.js` and `floatingButton.js` scripts sometimes try to forcefully update the DOM (`element.innerHTML` or `textContent`) while the user is actively typing, especially in rich text editors like ProseMirror (used by Claude/ChatGPT). We will implement a smoother event dispatch system that respects the React/ProseMirror state lifecycle instead of fighting it.
* **User Story:** As a user, when I am typing a long message in ChatGPT and PII is detected, I do not want my cursor to jump to the end or lose my selection if the extension highlights or masks text.
* **Developers Required:** 1 Frontend Developer (DOM / React Editor integration expert)
* **Why it's necessary:** If an extension breaks the core capability of a website (typing a message comfortably), users will uninstall it immediately.

---

### Priority 2: Medium (Following Sprints)

#### 3. Feature: Configurable Allow-lists per Website
**What will happen:** Currently, if a user decides they *want* to send their phone number to ChatGPT, they must click "Send Anyway" every single time, or globally disable the Phone Number rule. We will add a feature allowing users to whitelist specific PII types for specific websites (e.g., "Allow my phone number on ChatGPT, but block it on Perplexity").
* **User Story:** As a power user, I want to easily whitelist specific types of data for specific AI models so I don't get interrupted by warnings for data I have explicitly chosen to share.
* **Developers Required:** 1 Full-Stack Extension Developer (Storage, Background, UI)
* **Why it's necessary:** Power users hate friction. "Alert fatigue" will cause them to disable the extension entirely. Fine-grained control solves this.

#### 4. Refactor: Unify the Content Script Injection Strategy
**What will happen:** Right now, the manifest injects `monitorInputs.js` automatically, but `serviceWorker.js` also tries to manually inject it via `chrome.scripting.executeScript` when tabs are updated. This can lead to race conditions or duplicate listeners. We will remove the manual injection from the service worker and rely purely on the manifest's robust `document_idle` lifecycle, or vice-versa.
* **User Story:** As a user, I want the extension to be lightweight and not consume excess CPU or RAM by running duplicate monitoring scripts on the same page.
* **Developers Required:** 1 Extension Architecture Developer
* **Why it's necessary:** Duplicate scripts consume double the memory and can cause weird infinite loops when they both try to block/modify the same DOM event.

---

### Priority 3: Low (Future Roadmap)

#### 5. Enhancement: Context-Aware False Positive Reduction
**What will happen:** The current Regex system is good, but 10-digit numbers can be phone numbers, order numbers, or random IDs. We will enhance the existing `analyzeContext` function to use lightweight local heuristics (looking at words 3-4 spaces before the number) to significantly lower false positives without needing heavy ML models.
* **User Story:** As a user, I don't want the extension to block me when I type an order number that happens to be 10 digits long, but I do want it to block my actual phone number.
* **Developers Required:** 1 Backend/Regex Engineer
* **Why it's necessary:** False positives are the #2 reason (after performance) why security tools are disabled. Tuning the heuristic engine guarantees long-term retention.

---

## Part 2: System Architect Vision - 10x to 20x Improvements (100% Local / Zero Server)

**Context:** The above backlog makes the product *stable*. To make the product a *10x-20x unicorn* in the privacy space, we must rethink the architecture to process vast amounts of unstructured data **client-side with zero latency, while maintaining an uncompromised, zero-server privacy posture.**

### 1. WebAssembly (Wasm) Rust/Go Regular Expression Engine
**What will happen:** We will port our Regex logic and custom validation checksums (Luhn, Verhoeff, etc.) from JavaScript to a compiled WebAssembly binary written in Rust or Go. The JS content script will only be a thin wrapper that passes strings to the Wasm module.
* **Why it's 10x Better:** JS engines struggle with complex regex on multi-megabyte pasted texts or massive chat histories (leading to UI freezing). A Rust-based regex engine (like `regex` crate) executed via Wasm guarantees sub-millisecond processing, avoiding the JS main-thread event loop entirely. This makes the extension literally invisible to the user's CPU, keeping everything strictly local.
* **User Story:** As a power user, I want to be able to paste a 50,000-word log file into Claude.ai without the browser freezing or lagging for 5 seconds while it scans for PII locally.
* **Developers Required:** 1 Systems/Wasm Engineer (Rust/C++)

### 2. Local-First Small Language Models (SLMs) via WebGPU
**What will happen:** While we removed NER due to its heavy BERT dependency via `transformers.js`, the future of on-device AI is WebGPU. We will implement an ultra-quantized (e.g., Q4/Q8), tiny ~10MB Small Language Model (SLM) running entirely on the user's local GPU using WebNN/WebGPU APIs. No server required.
* **Why it's 10x Better:** Regex cannot catch "My boss John Doe said the company Acme Corp is struggling." An SLM running entirely locally on WebGPU processes tokens in parallel without locking the browser. This allows semantic, intent-based privacy blocking without sending data to an external API.
* **User Story:** As an enterprise user, I want the extension to block me from accidentally leaking my company's unannounced product names, using local AI that never leaves my machine.
* **Developers Required:** 1 ML/WebGPU Engineer

### 3. Service Worker Stream Interception (Fetch API Override)
**What will happen:** Currently, we rely on DOM mutation observers and event listeners (`keydown`, `paste`) which are brittle and constantly break when AI websites update their React/Next.js UI. We will shift the architecture to a local proxy model using Manifest V3's declarativeNetRequest or overriding the `fetch`/`WebSocket` APIs in the background to intercept outgoing payloads before they leave the browser network layer.
* **Why it's 10x Better:** This makes the extension bulletproof against UI changes. If ChatGPT redesigns their entire website tomorrow, DOM listeners fail. Local network-level interception never fails. It ensures absolute, un-bypassable privacy at the network boundary.
* **User Story:** As an enterprise IT admin, I want to deploy this extension to my 500 employees and know it will reliably intercept PII regardless of what UI experiments or A/B tests OpenAI is running this week.
* **Developers Required:** 1 Extension Architecture Expert

### 4. On-Device Personalization Engine (Zero Server)
**What will happen:** Instead of sending *any* data to a centralized server for learning, we implement a 100% local, on-device personalization loop. When a user frequently clicks "Send Anyway" on specific patterns (e.g., AWS ARNs or internal company ID formats that look like Social Security Numbers), the extension's local heuristic engine trains itself *only on that user's browser* using IndexedDB.
* **Why it's 10x Better:** It maintains the absolute zero-server, privacy-first guarantee. The extension learns the user's specific workflow and false-positive tendencies completely offline. There is zero risk of data leakage because there is literally no backend API to send data to.
* **User Story:** As a user, I want the extension to adapt to my unique workflow and stop alerting me on my company's specific non-PII ID formats, without any data ever leaving my local browser instance.
* **Developers Required:** 1 Frontend/Storage Engineer
