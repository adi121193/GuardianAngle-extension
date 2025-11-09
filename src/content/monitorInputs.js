/**
 * Input Monitoring Content Script
 * Monitors text inputs and triggers PII detection
 */

import { detectPII, quickPIICheck } from './detectText.js';
import { showWarningModal, isModalActive } from './injectWarningUI.js';
import { getSettings, incrementDetection, isEnabled } from '../utils/storage.js';

// Debounce timers
const debounceTimers = new WeakMap();
const DEBOUNCE_DELAY = 300; // ms

// Track monitored elements
const monitoredElements = new WeakSet();

// Track last checked values to avoid redundant checks
const lastCheckedValues = new WeakMap();

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
    'editor'
  ];

  const className = element.className || '';
  const id = element.id || '';
  const placeholder = element.placeholder || '';

  return aiInputPatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(className) || regex.test(id) || regex.test(placeholder);
  });
}

/**
 * Get text content from element
 * @param {HTMLElement} element
 * @returns {string}
 */
function getTextContent(element) {
  if (element.contentEditable === 'true') {
    return element.innerText || element.textContent || '';
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
    element.innerText = text;
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

    // Full PII detection
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useONNX: false // Will be enabled when ONNX model is loaded
    });

    // Update last checked value
    lastCheckedValues.set(element, text);

    // If PII detected, show warning
    if (detectionResult.piiDetected) {
      // Increment detection counters
      for (const type of detectionResult.types) {
        await incrementDetection(type);
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

    // Full PII detection on pasted content
    const detectionResult = await detectPII(pastedText, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes,
      useONNX: false
    });

    if (detectionResult.piiDetected) {
      // Prevent default paste
      event.preventDefault();

      // Increment detection counters
      for (const type of detectionResult.types) {
        await incrementDetection(type);
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

  // Keyup event for immediate check on Enter
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Clear debounce timer
      if (debounceTimers.has(element)) {
        clearTimeout(debounceTimers.get(element));
        debounceTimers.delete(element);
      }

      // Immediate check
      handleInput(element);
    }
  });
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
 * Initialize monitoring
 */
function initialize() {
  // Monitor existing inputs
  monitorAllInputs();

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

            // Check children
            const inputs = node.querySelectorAll?.('input[type="text"], textarea, [contenteditable="true"]');
            inputs?.forEach(element => {
              if (isAIChatInput(element)) {
                attachListeners(element);
              }
            });
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

  console.log('PII Guardian: Input monitoring initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Re-scan periodically for inputs (fallback for complex SPAs)
setInterval(monitorAllInputs, 3000);
