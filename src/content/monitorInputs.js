/**
 * Input Monitoring Content Script
 * Monitors text inputs and triggers PII detection
 */

import { detectPII, quickPIICheck, enableNER } from './detectText.js';
import { showWarningModal, isModalActive } from './injectWarningUI.js';
import { getSettings, incrementDetection, incrementBlocked, isEnabled } from '../utils/storage.js';
import { initializeInlineHighlighting, injectHighlightStyles } from './inlineHighlighter.js';
import { initializeFloatingButton, injectFloatingButtonStyles } from './floatingButton.js';
import { offscreenManagerProxy } from '../ml/offscreenManagerProxy.js';

// Debounce timers
const debounceTimers = new WeakMap();
const DEBOUNCE_DELAY = 300; // ms

// Track monitored elements
const monitoredElements = new WeakSet();
const monitoredHistory = new WeakSet();

// Track last checked values to avoid redundant checks
const lastCheckedValues = new WeakMap();

// CRITICAL FIX BUG005: Bypass flag for simulated interactions
// This prevents infinite loops when we programmatically click send button or dispatch Enter key
let isSimulatedInteraction = false;

// NER initialization state
let nerInitialized = false;
let nerInitializationAttempted = false;

// Feature flag: scan visible chat history (now controlled by settings - Priority 3)
// Default: false (opt-in for performance, prevents costly scans on every mutation)
let SCAN_HISTORY = false;
let SCAN_HISTORY_DEPTH = 50;

/**
 * Check if element is an AI chat input
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isAIChatInput(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();

  // Check for contenteditable divs (common in modern chat UIs)
  if (element.contentEditable === 'true') {
    return true;
  }

  // Check for textarea and input elements
  if (tagName === 'textarea' || (tagName === 'input' && element.type === 'text')) {
    return true;
  }

  // Check for specific AI tool input attributes/classes
  const aiInputPatterns = [
    'prompt',
    'chat',
    'message',
    'input',
    'composer',
    'editor',
    'ql-editor',        // Quill editor (Gemini)
    'input-area',       // Gemini
    'rich-textarea',    // Gemini
    'textarea-content', // Generic
    'editable',         // Generic
    'ProseMirror',      // ChatGPT, Claude (ProseMirror editor)
    'DraftEditor',      // X/Twitter Grok
    'public-DraftEditor', // X/Twitter
    'notranslate',      // X/Twitter
    'tweet',            // X/Twitter
    'text-input',       // Generic
    'contenteditable'   // Generic contenteditable
  ];

  const className = element.className || '';
  const id = element.id || '';
  const placeholder = element.placeholder || '';
  const ariaLabel = element.getAttribute('aria-label') || '';
  const role = element.getAttribute('role') || '';

  return aiInputPatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(className) ||
           regex.test(id) ||
           regex.test(placeholder) ||
           regex.test(ariaLabel) ||
           regex.test(role);
  });
}

/**
 * Attempt to find chat message containers for history scanning
 * @returns {HTMLElement[]} array of message nodes
 */
function findChatMessages() {
  // Heuristics for common chat UIs (Gemini/ChatGPT/Claude)
  const selectors = [
    '[data-message-id]',
    '[data-message-index]',
    '[data-message-author]',
    '.message',
    '.msg',
    '.prose',
    '[class*="message"]',
    '[class*="msg"]'
  ];
  const nodes = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(node => {
      if (node.innerText && !monitoredHistory.has(node)) {
        nodes.push(node);
      }
    });
  });
  return nodes;
}

/**
 * Get text content from element
 * @param {HTMLElement} element
 * @returns {string}
 */
function getTextContent(element) {
  if (element.contentEditable === 'true') {
    // textContent preserves exact spacing/newlines better than innerText
    return element.textContent || '';
  }
  return element.value || '';
}

/**
 * Set text content to element
 * @param {HTMLElement} element
 * @param {string} text
 */
function setTextContent(element, text) {
  if (element.contentEditable === 'true') {
    // textContent avoids browser reflow/extra whitespace that innerText can introduce
    element.textContent = text;
  } else {
    element.value = text;
  }
}

/**
 * Handle text input with PII detection
 * @param {HTMLElement} element
 */
async function handleInput(element) {
  try {
    // Check if extension is enabled
    const enabled = await isEnabled();
    if (!enabled) return;

    // Get current text
    const text = getTextContent(element);

    // Skip if empty or too short
    if (!text || text.length < 5) return;

    // Check if text has changed since last check
    const lastValue = lastCheckedValues.get(element);
    if (lastValue === text) return;

    // Quick check first (performance optimization)
    if (!quickPIICheck(text)) {
      lastCheckedValues.set(element, text);
      return;
    }

    // Get settings
    const settings = await getSettings();

    // Full PII detection with NER settings
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useNER: settings.nerEnabled !== false,
      detectionMode: settings.detectionMode || 'hybrid'
    });

    // Update last checked value
    lastCheckedValues.set(element, text);

    // If PII detected, show warning
    if (detectionResult.piiDetected) {
      // Increment detection counters
      for (const type of detectionResult.types) {
        await incrementDetection(type);
      }

      // Update hybrid stats if available
      if (detectionResult.sources || detectionResult.performance) {
        try {
          await chrome.runtime.sendMessage({
            type: 'UPDATE_HYBRID_STATS',
            sources: detectionResult.sources,
            performance: detectionResult.performance,
            detectionMode: settings.detectionMode || 'hybrid'
          });
        } catch (error) {
          console.error('PII Guardian: Failed to update hybrid stats:', error);
        }
      }

      // Don't show modal if one is already active
      if (isModalActive()) return;

      // Show warning modal
      const decision = await showWarningModal(detectionResult, element);

      // Handle user decision
      switch (decision.action) {
        case 'mask':
          // Apply masking
          if (decision.maskedText) {
            setTextContent(element, decision.maskedText);

            // Trigger input event to update any listeners
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
          }
          break;

        case 'send':
          // User chose to send anyway - do nothing
          break;

        case 'cancel':
          // User cancelled - optionally clear input
          if (settings.blockOnDetection) {
            setTextContent(element, '');
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
          }
          break;
      }
    }
  } catch (error) {
    console.error('PII Guardian: Error handling input:', error);
  }
}

/**
 * Handle paste events
 * @param {ClipboardEvent} event
 */
async function handlePaste(event) {
  try {
    // Check if extension is enabled
    const enabled = await isEnabled();
    if (!enabled) return;

    const element = event.target;
    if (!isAIChatInput(element)) return;

    // Get pasted text
    const pastedText = event.clipboardData.getData('text/plain');
    if (!pastedText || pastedText.length < 5) return;

    // Quick check first
    if (!quickPIICheck(pastedText)) return;

    // Get settings
    const settings = await getSettings();

    // Full PII detection on pasted content with NER settings
    const detectionResult = await detectPII(pastedText, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useNER: settings.nerEnabled !== false,
      detectionMode: settings.detectionMode || 'hybrid'
    });

    if (detectionResult.piiDetected) {
      // Prevent default paste
      event.preventDefault();

      // Increment detection counters
      for (const type of detectionResult.types) {
        await incrementDetection(type);
      }

      // Update hybrid stats if available
      if (detectionResult.sources || detectionResult.performance) {
        try {
          await chrome.runtime.sendMessage({
            type: 'UPDATE_HYBRID_STATS',
            sources: detectionResult.sources,
            performance: detectionResult.performance,
            detectionMode: settings.detectionMode || 'hybrid'
          });
        } catch (error) {
          console.error('PII Guardian: Failed to update hybrid stats:', error);
        }
      }

      // Create temporary element to hold pasted text for modal
      const tempElement = document.createElement('textarea');
      tempElement.value = pastedText;

      // Show warning modal
      const decision = await showWarningModal(detectionResult, tempElement);

      // Handle decision
      switch (decision.action) {
        case 'mask':
          // Insert masked text
          if (decision.maskedText) {
            document.execCommand('insertText', false, decision.maskedText);
          }
          break;

        case 'send':
          // Insert original text
          document.execCommand('insertText', false, pastedText);
          break;

        case 'cancel':
          // Don't insert anything
          break;
      }
    }
  } catch (error) {
    console.error('PII Guardian: Error handling paste:', error);
  }
}

/**
 * Attach event listeners to an input element
 * @param {HTMLElement} element
 */
function attachListeners(element) {
  if (monitoredElements.has(element)) {
    return; // Already monitoring
  }

  monitoredElements.add(element);

  // Initialize Grammarly-style floating button
  initializeFloatingButton(element);

  // Initialize inline highlighting for contenteditable elements (backup feature)
  // if (element.contentEditable === 'true') {
  //   initializeInlineHighlighting(element);
  // }

  // Input event with debounce
  element.addEventListener('input', (event) => {
    // Clear existing timer
    if (debounceTimers.has(element)) {
      clearTimeout(debounceTimers.get(element));
    }

    // Set new timer
    const timer = setTimeout(() => {
      handleInput(element);
      debounceTimers.delete(element);
    }, DEBOUNCE_DELAY);

    debounceTimers.set(element, timer);
  });

  // Paste event (immediate check)
  element.addEventListener('paste', handlePaste);

  // Enter key event - CRITICAL: Block submission if PII detected
  // NOTE: NOT async - must call preventDefault() synchronously!
  element.addEventListener('keydown', (event) => {
    // CRITICAL FIX BUG005: Bypass if this is a simulated interaction
    if (isSimulatedInteraction) {
      return; // Allow through without blocking
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const text = getTextContent(event.target);

      // Quick PII check (synchronous)
      if (quickPIICheck(text)) {
        // BLOCK IMMEDIATELY - Must be synchronous!
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Now handle async detection
        handlePIIDetectionForEnterKey(event.target, text).catch(err => {
          console.error('PII Guardian: Error during PII detection:', err);
          // On error, allow the send (be permissive)
          simulateEnterKey(event.target);
        });
      }
    }
  }, true); // Use capture phase to intercept BEFORE other handlers
}

/**
 * Handle PII detection for Enter key press (async operations)
 * Called AFTER event is already blocked synchronously
 * @param {HTMLElement} element - Input element
 * @param {string} text - Text content
 */
async function handlePIIDetectionForEnterKey(element, text) {
  try {
    // Check if extension is enabled
    const enabled = await isEnabled();
    if (!enabled) {
      // Extension disabled - allow the blocked action
      simulateEnterKey(element);
      return;
    }

    // Get settings
    const settings = await getSettings();

    // Full PII detection with NER settings
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useNER: settings.nerEnabled !== false,
      detectionMode: settings.detectionMode || 'hybrid'
    });

    // No PII? quickPIICheck was false positive - allow send
    if (!detectionResult.piiDetected) {
      simulateEnterKey(element);
      return;
    }

    // PII detected - increment stats
    for (const type of detectionResult.types) {
      await incrementDetection(type);
    }

    // Update hybrid stats if available
    if (detectionResult.sources || detectionResult.performance) {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_HYBRID_STATS',
          sources: detectionResult.sources,
          performance: detectionResult.performance,
          detectionMode: settings.detectionMode || 'hybrid'
        });
      } catch (error) {
        console.error('PII Guardian: Failed to update hybrid stats:', error);
      }
    }

    // Show modal and get decision
    const decision = await showWarningModal(detectionResult, element);

    // Handle user decision
    switch (decision.action) {
      case 'mask':
        if (decision.maskedText) {
          setTextContent(element, decision.maskedText);
          // Optionally auto-send masked version
          // simulateEnterKey(element);
        }
        break;

      case 'send':
        // User chose to send anyway - actually send it
        simulateEnterKey(element);
        break;

      case 'cancel':
        // User cancelled
        if (settings.blockOnDetection) {
          setTextContent(element, '');
        }
        await incrementBlocked();
        break;
    }
  } catch (error) {
    console.error('PII Guardian: Error in handlePIIDetectionForEnterKey:', error);
    // On error, be permissive and allow send
    simulateEnterKey(element);
  }
}

/**
 * Simulate Enter key press to send message
 * @param {HTMLElement} element - Input element
 */
function simulateEnterKey(element) {
  // CRITICAL FIX BUG005: Set bypass flag to prevent infinite loop
  console.info('PII Guardian: Simulating interaction (bypass blocking)');
  isSimulatedInteraction = true;

  // Try to find and click the send button (more reliable)
  const sendButton = findSendButton();
  if (sendButton) {
    sendButton.click();

    // Reset flag after small delay
    setTimeout(() => {
      isSimulatedInteraction = false;
    }, 100);
    return;
  }

  // Fallback: Dispatch Enter key event
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });

  element.dispatchEvent(enterEvent);

  // Reset flag after small delay
  setTimeout(() => {
    isSimulatedInteraction = false;
  }, 100);
}

/**
 * Find the send button on the page
 * @returns {HTMLElement|null}
 */
function findSendButton() {
  const selectors = [
    '[aria-label*="Send" i]',
    '[aria-label*="Submit" i]',
    '[data-test-id*="send" i]',
    'button[type="submit"]',
    '.send-button',
    'button[class*="send" i]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) return button;
  }

  return null;
}

/**
 * Find and monitor all AI chat inputs on the page
 */
function monitorAllInputs() {
  // Find all potential input elements
  const inputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');

  inputs.forEach(element => {
    if (isAIChatInput(element)) {
      attachListeners(element);
    }
  });
}

/**
 * Block send button clicks if PII detected
 */
function blockSendButton() {
  const sendButtons = document.querySelectorAll([
    '[aria-label*="Send" i]',
    '[aria-label*="Submit" i]',
    '[data-test-id*="send" i]',
    'button[type="submit"]',
    '.send-button',
    'button[class*="send" i]'
  ].join(','));

  sendButtons.forEach(button => {
    // Skip if already monitored
    if (monitoredElements.has(button)) {
      return;
    }

    monitoredElements.add(button);

    button.addEventListener('click', (event) => {
      // CRITICAL FIX BUG005: Bypass if this is a simulated interaction
      if (isSimulatedInteraction) {
        return; // Allow through without blocking
      }

      // Find the input element
      const input = document.querySelector('[contenteditable="true"]') ||
                    document.querySelector('textarea') ||
                    document.querySelector('input[type="text"]');

      if (!input || !isAIChatInput(input)) return;

      const text = getTextContent(input);

      // Quick PII check (synchronous)
      if (quickPIICheck(text)) {
        // BLOCK IMMEDIATELY - Must be synchronous!
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Handle async detection
        handlePIIDetectionForSendButton(input, text, event.target).catch(err => {
          console.error('PII Guardian: Error during send button PII detection:', err);
          // On error, allow the click
          event.target.click();
        });
      }
    }, true); // Use capture phase
  });
}

/**
 * Handle PII detection for send button click (async operations)
 * Called AFTER event is already blocked synchronously
 * @param {HTMLElement} input - Input element
 * @param {string} text - Text content
 * @param {HTMLElement} button - Send button that was clicked
 */
async function handlePIIDetectionForSendButton(input, text, button) {
  try {
    // Check if extension is enabled
    const enabled = await isEnabled();
    if (!enabled) {
      // Extension disabled - allow the click
      button.click();
      return;
    }

    // Get settings
    const settings = await getSettings();

    // Full PII detection with NER settings
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useNER: settings.nerEnabled !== false,
      detectionMode: settings.detectionMode || 'hybrid'
    });

    // No PII? quickPIICheck was false positive - allow click
    if (!detectionResult.piiDetected) {
      button.click();
      return;
    }

    // PII detected - increment stats
    for (const type of detectionResult.types) {
      await incrementDetection(type);
    }

    // Update hybrid stats if available
    if (detectionResult.sources || detectionResult.performance) {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_HYBRID_STATS',
          sources: detectionResult.sources,
          performance: detectionResult.performance,
          detectionMode: settings.detectionMode || 'hybrid'
        });
      } catch (error) {
        console.error('PII Guardian: Failed to update hybrid stats:', error);
      }
    }

    // Show modal and get decision
    const decision = await showWarningModal(detectionResult, input);

    // Handle user decision
    switch (decision.action) {
      case 'mask':
        if (decision.maskedText) {
          setTextContent(input, decision.maskedText);
          // Optionally auto-send masked version
          // button.click();
        }
        break;

      case 'send':
        // User chose to send anyway - click the button
        button.click();
        break;

      case 'cancel':
        // User cancelled
        if (settings.blockOnDetection) {
          setTextContent(input, '');
        }
        await incrementBlocked();
        break;
    }
  } catch (error) {
    console.error('PII Guardian: Error in handlePIIDetectionForSendButton:', error);
    // On error, be permissive and allow click
    button.click();
  }
}

/**
 * Initialize NER if enabled in settings
 */
async function initializeNER() {
  if (nerInitializationAttempted) return;
  nerInitializationAttempted = true;

  try {
    // Check if NER is enabled in settings
    const settings = await getSettings();
    if (!settings.nerEnabled) {
      console.log('PII Guardian: NER disabled in settings');
      return;
    }

    console.log('PII Guardian: Requesting NER initialization...');

    // Request NER initialization from background script
    const response = await chrome.runtime.sendMessage({ type: 'INIT_NER' });

    if (response && response.success) {
      console.log('PII Guardian: NER initialization requested successfully');
    } else {
      console.warn('PII Guardian: NER initialization request failed');
    }
  } catch (error) {
    console.error('PII Guardian: Error requesting NER initialization:', error);
  }
}

/**
 * Listen for NER_READY message from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NER_READY') {
    console.log('PII Guardian: NER ready notification received');

    // Set proxy as ready
    offscreenManagerProxy.setReady(true);

    // Enable NER in detectText module and pass proxy
    // The proxy will forward inference requests to background via messaging
    enableNER(offscreenManagerProxy);
    nerInitialized = true;

    console.log('PII Guardian: NER enabled with offscreen proxy');

    sendResponse({ success: true });
  }
  return false;
});

/**
 * Initialize monitoring
 */
async function initialize() {
  // Safety check: Ensure chrome APIs are available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error('PII Guardian: Chrome APIs not available, retrying in 100ms...');
    setTimeout(initialize, 100);
    return;
  }

  console.log('PII Guardian: Input monitoring initialized');

  // Load history scanning settings (Priority 3: Opt-in)
  try {
    const settings = await getSettings();
    SCAN_HISTORY = settings.scanHistory ?? false;
    SCAN_HISTORY_DEPTH = settings.scanHistoryDepth ?? 50;
    console.log(`[monitorInputs] History scanning: ${SCAN_HISTORY ? 'enabled (depth: ' + SCAN_HISTORY_DEPTH + ')' : 'disabled (opt-in)'}`);
  } catch (error) {
    console.warn('[monitorInputs] Failed to load history scanning settings, using defaults (off):', error);
    SCAN_HISTORY = false;
  }

  // Inject floating button styles (Grammarly-style)
  injectFloatingButtonStyles();

  // Inject highlight styles (backup feature)
  // injectHighlightStyles();

  // Monitor existing inputs
  monitorAllInputs();

  // Optional: scan visible chat history once per init (lightweight, opt-in)
  if (SCAN_HISTORY) {
    scanChatHistory();
  }

  // Monitor send buttons
  blockSendButton();

  // Initialize NER if enabled (lazy loading)
  initializeNER();

  // Watch for dynamically added inputs
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check the node itself
            if (isAIChatInput(node)) {
              attachListeners(node);
            }

            // Scan new messages for history detection
            if (SCAN_HISTORY) {
              scanChatHistory();
            }

            // Check children
            const inputs = node.querySelectorAll?.('input[type="text"], textarea, [contenteditable="true"]');
            inputs?.forEach(element => {
              if (isAIChatInput(element)) {
                attachListeners(element);
              }
});

/**
 * Scan visible chat history for PII (does not modify DOM)
 * Uses quickPIICheck first, then full detectPII; increments stats but no masking.
 */
async function scanChatHistory() {
  try {
    const messages = findChatMessages();
    if (!messages.length) return;

    const settings = await getSettings();
    if (!settings.enabled) return;

    // Limit scan depth to prevent performance issues (Priority 3)
    const maxMessages = Math.min(messages.length, SCAN_HISTORY_DEPTH);
    const messagesToScan = messages.slice(-maxMessages); // Scan most recent messages

    console.log(`[scanChatHistory] Scanning ${messagesToScan.length}/${messages.length} messages (depth limit: ${SCAN_HISTORY_DEPTH})`);

    for (const msg of messagesToScan) {
      // Avoid reprocessing the same node
      monitoredHistory.add(msg);

      const text = msg.innerText || msg.textContent || '';
      if (!text || text.length < 5) continue;

      if (!quickPIICheck(text)) continue;

      const detectionResult = await detectPII(text, {
        minConfidence: settings.minConfidence,
        enabledTypes: settings.enabledPIITypes,
        useNER: settings.nerEnabled !== false,
        detectionMode: settings.detectionMode || 'hybrid'
      });

      if (detectionResult.piiDetected) {
        // Increment detection counters
        for (const type of detectionResult.types) {
          await incrementDetection(type);
        }
      }
    }
  } catch (error) {
    console.error('PII Guardian: Error scanning chat history:', error);
  }
}

            // Re-scan for send buttons
            blockSendButton();
          }
        });
      }
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Re-scan periodically for inputs and buttons (fallback for complex SPAs)
setInterval(() => {
  monitorAllInputs();
  blockSendButton();
}, 3000);
