/**
 * Input Monitoring Content Script
 * Monitors text inputs and triggers PII detection
 */

import { detectPII, quickPIICheck, enableNER } from './detectText.js';
import { imageDetector } from '../detection/imageDetector.js';
import { showWarningModal, isModalActive } from './injectWarningUI.js';
import { getSettings, incrementDetection, incrementBlocked, isEnabled, getProStatus } from '../utils/storage.js';
import { initializeInlineHighlighting, injectHighlightStyles } from './inlineHighlighter.js';
import { initializeFloatingButton, injectFloatingButtonStyles } from './floatingButton.js';
import { offscreenManagerProxy } from '../ml/offscreenManagerProxy.js';
import { ManualMaskUI } from './ui/manualMaskOverlay.js';
import { redactImage } from '../utils/imageRedact.js';

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

// Track text that user explicitly chose to "Send Anyway"
// This allows the text through when user manually presses Enter after choosing to send
let bypassedText = null;
let bypassedTextTimestamp = 0;
const BYPASS_EXPIRY_MS = 10000; // 10 seconds expiry

/**
 * Check if text should bypass PII detection (user chose "Send Anyway")
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function isTextBypassed(text) {
  if (!bypassedText) return false;

  // Check if bypass has expired
  if (Date.now() - bypassedTextTimestamp > BYPASS_EXPIRY_MS) {
    bypassedText = null;
    bypassedTextTimestamp = 0;
    return false;
  }

  // Check if text matches (trim to handle whitespace differences)
  return text.trim() === bypassedText.trim();
}

/**
 * Mark text as bypassed (user chose "Send Anyway")
 * @param {string} text - Text to bypass
 */
function setTextBypassed(text) {
  bypassedText = text;
  bypassedTextTimestamp = Date.now();
}

// NER initialization state
let nerInitialized = false;
let nerInitializationAttempted = false;

// Cached settings for synchronous access (updated on change)
let cachedNEREnabled = false;
let cachedDetectionMode = 'hybrid';

// Listen for settings changes to update cache
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;
    if (newSettings) {
      cachedNEREnabled = newSettings.nerEnabled !== false;
      cachedDetectionMode = newSettings.detectionMode || 'hybrid';
      console.log(`[monitorInputs] Settings updated - NER: ${cachedNEREnabled}, mode: ${cachedDetectionMode}`);
    }
  }
});

// Feature flag: scan visible chat history (now controlled by settings - Priority 3)
// Default: false (opt-in for performance, prevents costly scans on every mutation)
let SCAN_HISTORY = false;
let SCAN_HISTORY_DEPTH = 50;

/**
 * Safe message sender with extension context invalidation handling
 * @param {Object} message - Message to send
 * @returns {Promise<any>} Response or null if context invalidated
 */
async function safeSendMessage(message) {
  try {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      console.log('[monitorInputs] Extension reloaded - skipping message (this is normal)');
      return null;
    }

    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    // Check for specific context invalidation errors
    if (error.message?.includes('Extension context invalidated') ||
      error.message?.includes('message channel closed') ||
      error.message?.includes('Receiving end does not exist')) {
      console.log('[monitorInputs] Extension reloaded:', error.message);
      // Could show user notification or reload content script
      return null;
    }

    // Re-throw other errors
    throw error;
  }
}

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
 * Find the actual editable container (handles ProseMirror, Tiptap, etc.)
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function findEditableContainer(element) {
  // If element itself is contenteditable, use it
  if (element.contentEditable === 'true') {
    return element;
  }

  // Look for ProseMirror editor (Claude.ai uses this)
  const proseMirror = element.closest('.ProseMirror') ||
    element.closest('[contenteditable="true"]') ||
    document.querySelector('.ProseMirror');
  if (proseMirror) {
    return proseMirror;
  }

  // Look for textarea (fallback)
  const textarea = element.closest('textarea') ||
    document.querySelector('textarea[data-testid="chat-input-ssr"]');
  if (textarea) {
    return textarea;
  }

  // Walk up the DOM tree to find contenteditable parent
  let current = element.parentElement;
  while (current) {
    if (current.contentEditable === 'true') {
      return current;
    }
    current = current.parentElement;
  }

  return element;
}

/**
 * Get text content from element
 * @param {HTMLElement} element
 * @returns {string}
 */
function getTextContent(element) {
  // Find the actual editable container
  const container = findEditableContainer(element);

  // Check if it's a contenteditable element (handles 'true', 'inherit', truthy values)
  const isContentEditable = container.contentEditable === 'true' ||
    container.contentEditable === true ||
    container.isContentEditable ||
    container.classList?.contains('ProseMirror');

  if (isContentEditable || container.innerHTML) {
    // Try multiple methods to get text from ProseMirror/contenteditable
    let text = '';

    // Method 1: Get text from all paragraph elements (ProseMirror structure)
    const paragraphs = container.querySelectorAll('p');
    if (paragraphs.length > 0) {
      text = Array.from(paragraphs)
        .map(p => p.innerText || p.textContent || '')
        .join(' ');
    }

    // Method 2: Fallback to innerText/textContent
    if (!text || text.trim() === '') {
      text = container.innerText || container.textContent || '';
    }

    const cleaned = text
      .replace(/\u00A0/g, ' ')   // NBSP -> space
      .replace(/\u200B/g, '')    // ZWSP
      .replace(/\u200C/g, '')    // ZWNJ
      .replace(/\u200D/g, '')    // ZWJ
      .replace(/\s*\n\s*/g, ' ') // collapse line breaks to single space
      .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
      .trim();
    return cleaned;
  }

  // Fallback for input/textarea elements
  const value = container.value || '';
  return value;
}

/**
 * Set text content to element (handles ProseMirror, contenteditable, and regular inputs)
 * @param {HTMLElement} element
 * @param {string} text
 */
function setTextContent(element, text) {
  const isContentEditable = element.contentEditable === 'true' ||
    element.isContentEditable ||
    element.classList?.contains('ProseMirror');

  if (isContentEditable) {
    // For ProseMirror/contenteditable, try multiple approaches
    // Method 1: Use document.execCommand for better editor compatibility
    // This method works better with ProseMirror/Tiptap because it triggers proper DOM events
    try {
      element.focus();

      // Select all content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);

      // Insert the new text (replaces selection)
      if (document.execCommand('insertText', false, text)) {
        return;
      }
    } catch (e) {
      // execCommand failed, falling back to textContent
    }

    // Method 2: Fallback to textContent
    element.textContent = text;
  } else {
    // Regular input/textarea
    element.value = text;
  }
}

/**
 * Handle text input with PII detection
 * @param {HTMLElement} element
 */
async function handleInput(element) {
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    return; // Silently skip if context invalidated
  }

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
          await safeSendMessage({
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
      const editableContainer = findEditableContainer(element);
      switch (decision.action) {
        case 'mask':
          // Apply masking
          if (decision.maskedText) {
            setTextContent(editableContainer, decision.maskedText);

            // Trigger input event to update any listeners
            const event = new Event('input', { bubbles: true });
            editableContainer.dispatchEvent(event);

            const changeEvent = new Event('change', { bubbles: true });
            editableContainer.dispatchEvent(changeEvent);
          }
          break;

        case 'send':
          // User chose to send anyway - do nothing
          break;

        case 'cancel':
          // User cancelled - optionally clear input
          if (settings.blockOnDetection) {
            setTextContent(editableContainer, '');
            const event = new Event('input', { bubbles: true });
            editableContainer.dispatchEvent(event);
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
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    return; // Silently skip if context invalidated
  }

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
          await safeSendMessage({
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
    // Check for image paste
    if (event.clipboardData.files && event.clipboardData.files.length > 0) {
      const file = event.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        console.log('[PII Guardian] Image paste detected.');

        // CHECK PRO LICENSE
        const isPro = await getProStatus();
        if (!isPro) {
          console.log('[PII Guardian] Image OCR blocked - Upgrade required.');
          // Show "Upgrade to Pro" modal/alert
          // For MVP: Just a simple alert or redirect
          // Ideally we show a nice modal, but for speed:
          const confirmUpgrade = confirm('📷 Image PII Detection is a Pro Feature.\n\nProtect your privacy in screenshots and images.\n\nUpgrade to Pro now?');
          if (confirmUpgrade) {
            window.open(chrome.runtime.getURL('html/popup.html?view=license'), '_blank');
          }
          return;
        }

        // Handle image OCR
        console.log('[PII Guardian] Pro Active - Running OCR...');

        // Notify user we are scanning (optional UI update could go here)

        const ocrResult = await imageDetector.detect(file);

        if (ocrResult.piiDetected) {
          event.preventDefault(); // Block paste

          // Increment counters
          ocrResult.matches.forEach(m => incrementDetection(m.type));

          // Show modal
          const tempElement = document.createElement('div'); // Dummy element
          const decision = await showWarningModal({
            ...ocrResult,
            matches: ocrResult.matches.map(m => ({ ...m, source: 'ocr', bbox: m.bbox })), // Pass bbox
            types: [...new Set(ocrResult.matches.map(m => m.type))]
          }, tempElement);

          if (decision.action === 'mask') {
            console.log('[PII Guardian] Redacting pasted image...');
            const redactedFile = await redactImage(file, ocrResult.matches);

            // For Paste, we CAN manipulate the Clipboard (sometimes) or fallback to download
            // Try to write to clipboard? Requires permissions.
            // Safer fallback: Download

            alert('✅ PII Redacted! The safe image has been downloaded. Please paste the "redacted_' + file.name + '" file.');
            const url = URL.createObjectURL(redactedFile);
            const a = document.createElement('a');
            a.href = url;
            a.download = redactedFile.name;
            a.click();
            URL.revokeObjectURL(url);
          } else if (decision.action === 'send') {
            // Re-dispatch paste logic or info user
            alert('Please paste again to confirm (PII Guardian limitation: cannot auto-paste image after blocking)');
          }
        }
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
  // Use capture phase to intercept before React/website handles it
  element.addEventListener('paste', handlePaste, true);

  // Enter key event - CRITICAL: Block submission if PII detected
  // NOTE: NOT async - must call preventDefault() synchronously!
  element.addEventListener('keydown', (event) => {
    // CRITICAL FIX BUG005: Bypass if this is a simulated interaction
    if (isSimulatedInteraction) {
      return; // Allow through without blocking
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const text = getTextContent(event.target);

      // Check if user already chose "Send Anyway" for this exact text
      if (isTextBypassed(text)) {
        console.log('[PII Guardian] Bypassing detection - user chose Send Anyway');
        // Clear the bypass after use
        bypassedText = null;
        bypassedTextTimestamp = 0;
        return; // Allow through without blocking
      }

      // Use cached NER settings for synchronous decision
      // NER can detect names/organizations that quickPIICheck can't
      const useNER = cachedNEREnabled && cachedDetectionMode !== 'regex';

      // Quick PII check (synchronous) - catches structured PII like phone/email
      const quickCheck = quickPIICheck(text);

      console.log('[PII Guardian] Enter key check:', { textLen: text.length, quickCheck, useNER, cachedNEREnabled, cachedDetectionMode });

      // Block if quickCheck found something OR if NER is enabled (NER can detect things quickCheck can't)
      if (quickCheck || useNER) {
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
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    simulateEnterKey(element); // Allow send if context invalidated
    return;
  }

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
        await safeSendMessage({
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
          // Find the actual editable container
          const editableContainer = findEditableContainer(element);

          setTextContent(editableContainer, decision.maskedText);

          // CRITICAL: Dispatch input event to update editor state (ProseMirror, etc.)
          const event = new Event('input', { bubbles: true });
          editableContainer.dispatchEvent(event);

          // Also dispatch a change event for frameworks that listen to it
          const changeEvent = new Event('change', { bubbles: true });
          editableContainer.dispatchEvent(changeEvent);
          // Note: User needs to press Enter again to send masked version
        }
        break;

      case 'send':
        // User chose to send anyway - mark text as bypassed and try to send
        setTextBypassed(text);
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
  const inputs = collectEditableInputs(document);

  inputs.forEach(element => {
    if (isAIChatInput(element)) {
      attachListeners(element);
    }
  });
}

/**
 * Collect input elements, including those inside shadow DOMs
 * @param {Document|ShadowRoot|Element} root
 * @returns {HTMLElement[]}
 */
function collectEditableInputs(root) {
  const results = new Set();

  const scan = (node) => {
    if (!node) return;
    node.querySelectorAll?.('input[type="text"], textarea, [contenteditable="true"]').forEach(el => results.add(el));
    node.querySelectorAll?.('*').forEach(child => {
      if (child.shadowRoot) {
        scan(child.shadowRoot);
      }
    });
  };

  scan(root);
  return Array.from(results);
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

      // Check if user already chose "Send Anyway" for this exact text
      if (isTextBypassed(text)) {
        // Clear the bypass after use
        bypassedText = null;
        bypassedTextTimestamp = 0;
        return; // Allow through without blocking
      }

      // Use cached NER settings for synchronous decision
      const useNER = cachedNEREnabled && cachedDetectionMode !== 'regex';

      // Quick PII check (synchronous) - catches structured PII
      const quickCheck = quickPIICheck(text);

      // Block if quickCheck found something OR if NER is enabled
      if (quickCheck || useNER) {
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
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    button.click(); // Allow click if context invalidated
    return;
  }

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
        await safeSendMessage({
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
          // Find the actual editable container
          const editableContainer = findEditableContainer(input);

          setTextContent(editableContainer, decision.maskedText);

          // CRITICAL: Dispatch input event to update editor state
          const inputEvent = new Event('input', { bubbles: true });
          editableContainer.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          editableContainer.dispatchEvent(changeEvent);
        }
        break;

      case 'send':
        // User chose to send anyway - mark text as bypassed and try to click
        setTextBypassed(text);
        button.click();
        break;

      case 'cancel':
        // User cancelled
        if (settings.blockOnDetection) {
          const editableContainer = findEditableContainer(input);
          setTextContent(editableContainer, '');
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

    console.log('PII Guardian: Checking NER status...');

    // First, check if NER is already initialized (handles page reload case)
    const statusResponse = await safeSendMessage({ type: 'NER_STATUS' });

    if (statusResponse && statusResponse.isReady) {
      console.log('PII Guardian: NER already initialized, enabling...');
      // NER is already ready - enable it immediately
      offscreenManagerProxy.setReady(true);
      enableNER(offscreenManagerProxy);
      nerInitialized = true;
      console.log('PII Guardian: NER enabled (was already initialized)');
      return;
    }

    // NER not ready - check if model was previously downloaded
    // If so, we need to re-initialize (e.g., after extension reload)
    if (settings.nerModelDownloaded) {
      console.log('PII Guardian: Model was previously downloaded, re-initializing...');
    } else {
      console.log('PII Guardian: Requesting NER initialization...');
    }

    // Request NER initialization from background script
    const response = await safeSendMessage({ type: 'INIT_NER' });

    if (response && response.success) {
      console.log('PII Guardian: NER initialization successful');
      // Enable NER immediately after successful init
      offscreenManagerProxy.setReady(true);
      enableNER(offscreenManagerProxy);
      nerInitialized = true;
      console.log('PII Guardian: NER enabled');
    } else {
      console.warn('PII Guardian: NER initialization request failed:', response?.error);
    }
  } catch (error) {
    console.error('PII Guardian: Error requesting NER initialization:', error);
  }
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // PING: Health check from service worker
  if (message.type === 'PING') {
    sendResponse({ success: true, alive: true });
    return false;
  }

  // NER_READY: NER model is initialized
  if (message.type === 'NER_READY') {
    // Only enable if not already initialized (prevents duplicate initialization)
    if (nerInitialized) {
      console.log('PII Guardian: NER ready notification received (already initialized, skipping)');
      sendResponse({ success: true, alreadyInitialized: true });
      return false;
    }

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

// Unique instance ID for this content script
const INSTANCE_ID = `pii-guardian-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Clean up any previous PII Guardian instances
 * This handles the case where extension is reloaded and old scripts are orphaned
 */
function cleanupPreviousInstances() {
  // Check if another instance was running
  const previousInstanceId = window.__PII_GUARDIAN_INSTANCE_ID__;

  if (previousInstanceId && previousInstanceId !== INSTANCE_ID) {
    console.log(`[monitorInputs] Cleaning up previous instance: ${previousInstanceId}`);

    // Remove old floating buttons
    document.querySelectorAll('.pii-guardian-floating-btn').forEach(el => el.remove());

    // Remove old panels
    document.querySelectorAll('.pii-guardian-panel').forEach(el => el.remove());
    document.querySelectorAll('.pii-issues-panel').forEach(el => el.remove());

    // Remove old warning modals
    document.querySelectorAll('.pii-guardian-overlay').forEach(el => el.remove());
    document.querySelectorAll('.pii-guardian-modal').forEach(el => el.remove());

    // Remove old styles (they'll be re-injected)
    document.querySelectorAll('style[data-pii-guardian]').forEach(el => el.remove());
  }

  // Mark this instance as active
  window.__PII_GUARDIAN_INSTANCE_ID__ = INSTANCE_ID;
  console.log(`[monitorInputs] Instance ID: ${INSTANCE_ID}`);
}

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

  // Clean up any previous instances (handles extension reload)
  cleanupPreviousInstances();

  console.log('PII Guardian: Input monitoring initialized');

  // Load settings including NER and history scanning
  try {
    const settings = await getSettings();
    SCAN_HISTORY = settings.scanHistory ?? false;
    SCAN_HISTORY_DEPTH = settings.scanHistoryDepth ?? 50;
    // Cache NER settings for synchronous access in event handlers
    cachedNEREnabled = settings.nerEnabled !== false;
    cachedDetectionMode = settings.detectionMode || 'hybrid';
    console.log(`[monitorInputs] History scanning: ${SCAN_HISTORY ? 'enabled (depth: ' + SCAN_HISTORY_DEPTH + ')' : 'disabled (opt-in)'}`);
    console.log(`[monitorInputs] NER enabled: ${cachedNEREnabled}, mode: ${cachedDetectionMode}`);
  } catch (error) {
    console.warn('[monitorInputs] Failed to load settings, using defaults:', error);
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

// Global paste/drop/change listener (capture phase)
// Intercepts image uploads before web apps (like React/ChatGPT) can stop propagation

const handleExternalImage = (file, event) => {
  console.log('[PII Guardian] Global capture: Image upload detected', event.type);

  // Reuse handlePaste logic but with a mocked event object if needed
  // Or better, extract the core logic to a shared function. 
  // For now, we simulate a clipboarData structure to reuse handlePaste or call handling logic directly.

  // Since handlePaste expects a ClipboardEvent, let's create a specialized handler for direct files
  handleDirectFile(file, event);
};

// 1. Paste
document.addEventListener('paste', (event) => {
  if (event.clipboardData?.files?.length > 0 && event.clipboardData.files[0].type.startsWith('image/')) {
    handlePaste(event);
  }
}, true);

// 2. Drag & Drop
document.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files?.length > 0) {
    const file = event.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      handleExternalImage(file, event);
    }
  }
}, true);

// 3. File Input Change (Clicking the + button)
document.addEventListener('change', (event) => {
  if (event.target.tagName === 'INPUT' && event.target.type === 'file') {
    if (event.target.files?.length > 0) {
      const file = event.target.files[0];
      if (file.type.startsWith('image/')) {
        handleExternalImage(file, event);
      }
    }
  }
}, true);

/**
 * Handle direct file upload (Drop/Change)
 */
async function handleDirectFile(file, event) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) return;

    // Check Pro Status
    const isPro = await getProStatus();
    if (!isPro) {
      if (confirm('📷 Image PII Detection is a Pro Feature. Upgrade now?')) {
        window.open(chrome.runtime.getURL('html/popup.html?view=license'), '_blank');
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    console.log('[PII Guardian] Processing image upload...');
    const ocrResult = await imageDetector.detect(file);

    if (ocrResult.piiDetected) {
      event.preventDefault();
      event.stopPropagation();

      // Show warning
      const tempElement = document.createElement('div');
      ocrResult.matches.forEach(m => incrementDetection(m.type));

      // DEBUG LOGGING: Check if bboxes made it back
      console.log('[monitorInputs] OCR Matches Received:', JSON.stringify(ocrResult.matches.map(m => ({
        text: m.value,
        bbox: m.bbox
      })), null, 2));

      const decision = await showWarningModal({
        ...ocrResult,
        matches: ocrResult.matches.map(m => ({ ...m, source: 'ocr', bbox: m.bbox })),
        types: [...new Set(ocrResult.matches.map(m => m.type))],
        originalFile: file // PASS FILE FOR MANUAL MASKING
      }, tempElement);

      if (decision.action === 'mask') {
        console.log('[PII Guardian] User chose to mask image (Auto-Redaction)');
        const redactedFile = await redactImage(file, ocrResult.matches, ocrResult.debugWords);
        downloadSafeImage(redactedFile, file.name);
      } else if (decision.action === 'manual_mask') {
        console.log('[PII Guardian] User chose to mask image (Manual Redaction)');
        // The file is already redacted from the UI
        const redactedFile = decision.file;
        downloadSafeImage(redactedFile, file.name);
      }
    }
  } catch (err) {
    console.error('[PII Guardian] Image upload error:', err);
    // FAIL LOUDLY: Tell the user
    if (err.message.includes('Redaction') || err.message.includes('Canvas')) {
      alert('❌ Redaction Failed: ' + err.message);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Helper to download redacted image
function downloadSafeImage(file, originalName) {
  alert('✅ PII Redacted! The safe image has been downloaded. Please upload the "redacted_' + originalName + '" file.');
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Re-scan periodically for inputs and buttons (fallback for complex SPAs)
setInterval(() => {
  monitorAllInputs();
  blockSendButton();
}, 3000);
