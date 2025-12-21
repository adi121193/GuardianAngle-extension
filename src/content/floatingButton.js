/**
 * Floating PII Guardian Button (Grammarly-style)
 * Shows a floating button in the bottom-right corner of input fields when PII is detected
 */

import { detectPII, quickPIICheck } from './detectText.js';
import { getSettings, incrementMasked } from '../utils/storage.js';
import { maskText } from '../utils/maskRules.js';

// Track button instances per element
const buttonInstances = new WeakMap();
const activePanels = new WeakMap();
const detectionResults = new WeakMap(); // Store detection results per element
const originalText = new WeakMap(); // Store original text before highlighting

// Debounce timer per element
const detectionDebounceTimers = new WeakMap();
const DETECTION_DEBOUNCE = 300; // ms - faster like Grammarly

// CRITICAL FIX BUG002: Cleanup system to prevent memory leaks
const cleanupFunctions = new WeakMap();
const eventHandlers = new WeakMap(); // Store handler references for cleanup

/**
 * Initialize floating button for an input element
 * @param {HTMLElement} element - Input element to monitor
 */
export function initializeFloatingButton(element) {
  if (buttonInstances.has(element)) {
    return; // Already initialized
  }

  // CRITICAL FIX BUG002: Store event handlers for proper cleanup
  const handlers = {
    input: () => scheduleDetection(element),
    focus: () => scheduleDetection(element, true),
    paste: () => setTimeout(() => scheduleDetection(element, true), 50),
    blur: () => {
      removeHighlights(element);
      scheduleDetection(element, true);
    }
  };

  // Store handlers for cleanup
  eventHandlers.set(element, handlers);

  // Listen for input changes (typing)
  element.addEventListener('input', handlers.input);

  // Listen for focus
  element.addEventListener('focus', handlers.focus);

  // Listen for paste
  element.addEventListener('paste', handlers.paste);

  // Listen for blur - re-run highlighting after user stops typing and clicks away
  element.addEventListener('blur', handlers.blur);

  // Initial detection (immediate)
  scheduleDetection(element, true);

  // Use MutationObserver to detect content changes from external sources (like AI responses)
  const observer = new MutationObserver(() => {
    scheduleDetection(element, true); // Immediate on mutation
  });

  observer.observe(element, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Store observer for cleanup
  if (!element._piiObserver) {
    element._piiObserver = observer;
  }

  // CRITICAL FIX BUG002: Create cleanup function
  const cleanup = () => {
    console.info('PII Guardian: Cleaning up element', element);

    // Disconnect observer
    if (element._piiObserver) {
      element._piiObserver.disconnect();
      delete element._piiObserver;
    }

    // Remove all event listeners
    const storedHandlers = eventHandlers.get(element);
    if (storedHandlers) {
      element.removeEventListener('input', storedHandlers.input);
      element.removeEventListener('focus', storedHandlers.focus);
      element.removeEventListener('paste', storedHandlers.paste);
      element.removeEventListener('blur', storedHandlers.blur);
      eventHandlers.delete(element);
    }

    // Clean button
    const button = buttonInstances.get(element);
    if (button) {
      if (button._repositionHandler) {
        window.removeEventListener('scroll', button._repositionHandler, true);
        window.removeEventListener('resize', button._repositionHandler);
      }
      button.remove();
      buttonInstances.delete(element);
    }

    // Clean panel
    const panel = activePanels.get(element);
    if (panel) {
      panel.remove();
      activePanels.delete(element);
    }

    // Clear timers
    const timer = detectionDebounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      detectionDebounceTimers.delete(element);
    }

    // Clear detection results and original text
    detectionResults.delete(element);
    originalText.delete(element);

    console.info('PII Guardian: Cleanup complete');
  };

  // Store cleanup function
  cleanupFunctions.set(element, cleanup);
}

/**
 * Schedule PII detection with debounce
 * @param {HTMLElement} element
 * @param {boolean} immediate - Skip debounce for immediate detection
 */
function scheduleDetection(element, immediate = false) {
  // Clear existing timer for this element
  const existingTimer = detectionDebounceTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  if (immediate) {
    // Run immediately without debounce
    runDetection(element);
  } else {
    // Debounce for typing
    const timer = setTimeout(() => {
      runDetection(element);
    }, DETECTION_DEBOUNCE);
    detectionDebounceTimers.set(element, timer);
  }
}

/**
 * Run PII detection and show/hide button accordingly
 * @param {HTMLElement} element
 */
async function runDetection(element) {
  try {
    // Guard: Check if extension context is still valid
    if (!chrome?.runtime?.id) {
      console.warn('[floatingButton] Extension context invalidated - hiding UI and stopping detection');
      hideButton(element);
      closeAllPanels();
      return;
    }

    const settings = await getSettings();
    if (!settings.enabled) {
      hideButton(element);
      return;
    }

    const text = getTextContent(element);

    if (!text || text.length < 5) {
      hideButton(element);
      return;
    }

    // Quick check first
    if (!quickPIICheck(text)) {
      hideButton(element);
      return;
    }

    // Full detection
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes
    });

    if (!detectionResult.piiDetected || detectionResult.matches.length === 0) {
      hideButton(element);
      return;
    }

    // Deduplicate matches for accurate count
    const deduplicatedResult = deduplicateMatches(detectionResult);

    // Store detection results AND original text before highlighting
    detectionResults.set(element, deduplicatedResult);
    originalText.set(element, text);

    // Show button with detection count
    showButton(element, deduplicatedResult);

    // Highlight PII in the text
    highlightPII(element, deduplicatedResult);

  } catch (error) {
    console.error('PII Guardian: Error in floating button detection:', error);
  }
}

/**
 * Highlight PII in element without modifying the original text structure
 * @param {HTMLElement} element
 * @param {Object} detectionResult
 */
function highlightPII(element, detectionResult) {
  // Only highlight for contentEditable elements (not standard textareas)
  if (element.contentEditable !== 'true') {
    return;
  }

  const { matches } = detectionResult;
  if (!matches || matches.length === 0) {
    removeHighlights(element);
    return;
  }

  // CRITICAL FIX BUG001: Skip highlighting if element has focus (user is actively typing)
  // This prevents cursor position loss caused by innerHTML replacement during typing
  if (document.activeElement === element) {
    console.info('PII Guardian: Skipping highlight during active typing to prevent cursor loss');
    return; // Only show floating button, no DOM manipulation
  }

  // Check if already highlighted to avoid re-highlighting
  const existingHighlights = element.querySelectorAll('.pii-highlight');
  if (existingHighlights.length > 0) {
    return; // Already highlighted
  }

  // Save cursor position
  const selection = window.getSelection();
  let cursorPosition = 0;
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    cursorPosition = getAbsoluteCursorPosition(element, range);
  }

  try {
    // Get current text representation that matches detection
    const currentText = element.innerText || element.textContent || '';

    // Build a map of what needs to be highlighted
    // Sort by position descending to handle replacements correctly
    const sortedMatches = [...matches].sort((a, b) => b.position - a.position);

    // Deduplicate overlapping matches (keep higher confidence)
    const deduplicatedMatches = [];
    const usedRanges = [];

    for (const match of sortedMatches) {
      const start = match.position;
      const end = match.position + match.value.length;

      // Check if this range overlaps with any already added
      const overlaps = usedRanges.some(range =>
        (start >= range.start && start < range.end) ||
        (end > range.start && end <= range.end) ||
        (start <= range.start && end >= range.end)
      );

      if (!overlaps) {
        deduplicatedMatches.push(match);
        usedRanges.push({ start, end });
      }
    }

    // Re-sort ascending for text rebuilding
    deduplicatedMatches.sort((a, b) => a.position - b.position);

    // Build highlighted HTML
    let highlightedHTML = '';
    let lastIndex = 0;

    for (const match of deduplicatedMatches) {
      const { value, position, confidence } = match;

      // Verify the match actually exists at this position
      const actualValue = currentText.substring(position, position + value.length);
      if (actualValue !== value) {
        // Position mismatch - try to find it
        const foundIndex = currentText.indexOf(value, Math.max(0, position - 50));
        if (foundIndex === -1) continue; // Skip if can't find

        // Update position
        match.position = foundIndex;
      }

      // Add text before this match (escaped)
      highlightedHTML += escapeHtml(currentText.substring(lastIndex, match.position));

      // Add highlighted PII
      const riskColor = getRiskColor(confidence);
      highlightedHTML += `<span class="pii-highlight" style="background: linear-gradient(to top, ${riskColor}30 0%, ${riskColor}30 2px, transparent 2px); border-bottom: 2px solid ${riskColor}; text-decoration: underline; text-decoration-color: ${riskColor}; text-decoration-style: wavy; text-underline-offset: 2px; color: inherit; border-radius: 0;">${escapeHtml(value)}</span>`;

      lastIndex = match.position + value.length;
    }

    // Add remaining text
    highlightedHTML += escapeHtml(currentText.substring(lastIndex));

    // Only update if we actually have highlights
    if (deduplicatedMatches.length > 0) {
      element.innerHTML = highlightedHTML;
    }

  } catch (error) {
    console.error('PII Guardian: Error highlighting text:', error);
  }

  // Restore cursor position
  restoreCursorPosition(element, cursorPosition);
}

/**
 * Get all text nodes from an element
 * @param {HTMLElement} element
 * @returns {Array<Text>}
 */
function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  return textNodes;
}

/**
 * Get absolute cursor position in element
 * @param {HTMLElement} element
 * @param {Range} range
 * @returns {number}
 */
function getAbsoluteCursorPosition(element, range) {
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/**
 * Restore cursor to position
 * @param {HTMLElement} element
 * @param {number} position
 */
function restoreCursorPosition(element, position) {
  const selection = window.getSelection();
  const range = document.createRange();

  try {
    const textNode = findTextNodeAtPosition(element, position);
    if (textNode) {
      range.setStart(textNode.node, textNode.offset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Fallback: move to end
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch (e) {
    // If cursor restoration fails, just move to end
    try {
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (err) {
      // Ignore if we can't restore cursor
    }
  }
}

/**
 * Remove PII highlights from element
 * @param {HTMLElement} element
 */
function removeHighlights(element) {
  if (element.contentEditable !== 'true') {
    return;
  }

  const highlights = element.querySelectorAll('.pii-highlight');
  highlights.forEach(highlight => {
    const text = highlight.textContent;
    const textNode = document.createTextNode(text);
    highlight.parentNode.replaceChild(textNode, highlight);
  });

  // Normalize to merge adjacent text nodes
  element.normalize();
}

/**
 * Find text node at cursor position
 * @param {HTMLElement} element
 * @param {number} targetPosition
 * @returns {Object|null}
 */
function findTextNodeAtPosition(element, targetPosition) {
  let currentPosition = 0;

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent.length;
      if (currentPosition + length >= targetPosition) {
        return {
          node: node,
          offset: targetPosition - currentPosition
        };
      }
      currentPosition += length;
    } else {
      for (const child of node.childNodes) {
        const result = traverse(child);
        if (result) return result;
      }
    }
    return null;
  }

  return traverse(element);
}

/**
 * Get text content from element (clean text without HTML)
 * Returns text exactly as-is (with NBSP, ZW chars) for accurate detection
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {boolean} options.normalize - Whether to normalize invisible characters (default: false)
 * @returns {string}
 */
function getTextContent(element, options = {}) {
  const { normalize = false } = options;

  let text = '';

  if (element.contentEditable === 'true') {
    // Clone element to get clean text without modifying the original
    const clone = element.cloneNode(true);

    // Remove all highlight spans from clone
    const highlights = clone.querySelectorAll('.pii-highlight');
    highlights.forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent);
      highlight.parentNode.replaceChild(textNode, highlight);
    });

    // Normalize to merge text nodes
    clone.normalize();

    // Use textContent to preserve exact spacing/newlines (innerText can reflow)
    text = clone.textContent || '';
  } else {
    text = element.value || '';
  }

  // Optionally normalize invisible characters
  if (normalize && typeof normalizeText === 'function') {
    // Dynamic import will be available if needed
    return text;
  }

  return text;
}

/**
 * Set text content to element
 * @param {HTMLElement} element
 * @param {string} text
 */
function setTextContent(element, text) {
  if (element.contentEditable === 'true') {
    // Use textContent to avoid HTML reflow/extra whitespace
    element.textContent = text;

    // Move cursor to end if focusable
    const selection = window.getSelection?.();
    if (selection && element.firstChild) {
      const range = document.createRange();
      range.setStart(element.firstChild, Math.min(text.length, element.firstChild.length));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    element.value = text;
  }

  // Trigger input event
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Show floating button
 * @param {HTMLElement} element - Input element
 * @param {Object} detectionResult - Detection result
 */
function showButton(element, detectionResult) {
  let button = buttonInstances.get(element);

  if (!button) {
    button = createButton(element, detectionResult);
    buttonInstances.set(element, button);

    // Position button
    positionButton(element, button);

    // Append to parent
    const container = element.parentElement;
    if (container) {
      // Ensure parent has position: relative
      const parentPosition = window.getComputedStyle(container).position;
      if (parentPosition === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(button);
    }
  } else {
    // Update existing button
    updateButton(button, detectionResult);
    button.style.display = 'flex';
  }

  // Re-position on scroll/resize
  const repositionHandler = () => positionButton(element, button);
  window.addEventListener('scroll', repositionHandler, true);
  window.addEventListener('resize', repositionHandler);

  // Store handlers for cleanup
  button._repositionHandler = repositionHandler;
}

/**
 * Create floating button element
 * @param {HTMLElement} element - Input element
 * @param {Object} detectionResult - Detection result
 * @returns {HTMLElement}
 */
function createButton(element, detectionResult) {
  const button = document.createElement('div');
  button.className = 'pii-guardian-floating-btn';
  button.setAttribute('data-pii-button', 'true');

  const count = detectionResult.matches.length;
  const riskLevel = calculateRiskLevel(detectionResult.matches);

  button.innerHTML = `
    <div class="pii-btn-icon ${riskLevel}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span class="pii-btn-badge">${count}</span>
    </div>
  `;

  // Click handler to toggle panel
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel(element, button, detectionResult);
  });

  return button;
}

/**
 * Update button with new detection result
 * @param {HTMLElement} button
 * @param {Object} detectionResult
 */
function updateButton(button, detectionResult) {
  const count = detectionResult.matches.length;
  const riskLevel = calculateRiskLevel(detectionResult.matches);

  const icon = button.querySelector('.pii-btn-icon');
  icon.className = `pii-btn-icon ${riskLevel}`;

  const badge = button.querySelector('.pii-btn-badge');
  badge.textContent = count;
}

/**
 * Calculate overall risk level from matches
 * @param {Array} matches
 * @returns {string}
 */
function calculateRiskLevel(matches) {
  const maxConfidence = Math.max(...matches.map(m => m.confidence));

  if (maxConfidence >= 0.9) return 'risk-critical';
  if (maxConfidence >= 0.75) return 'risk-high';
  if (maxConfidence >= 0.6) return 'risk-medium';
  return 'risk-low';
}

/**
 * Position button in bottom-right of input field
 * @param {HTMLElement} element - Input element
 * @param {HTMLElement} button - Button element
 */
function positionButton(element, button) {
  const rect = element.getBoundingClientRect();
  const parentRect = element.parentElement.getBoundingClientRect();

  // Position relative to parent
  const bottom = parentRect.bottom - rect.bottom + 8;
  const right = parentRect.right - rect.right + 8;

  button.style.bottom = `${bottom}px`;
  button.style.right = `${right}px`;
}

/**
 * Hide button
 * @param {HTMLElement} element
 */
function hideButton(element) {
  const button = buttonInstances.get(element);
  if (button) {
    button.style.display = 'none';
    closePanel(element);

    // Remove highlights
    removeHighlights(element);

    // Remove event listeners
    if (button._repositionHandler) {
      window.removeEventListener('scroll', button._repositionHandler, true);
      window.removeEventListener('resize', button._repositionHandler);
    }
  }
}

/**
 * Deduplicate overlapping PII matches (keep higher confidence)
 * @param {Object} detectionResult
 * @returns {Object} Deduplicated result
 */
function deduplicateMatches(detectionResult) {
  const { matches } = detectionResult;
  if (!matches || matches.length === 0) {
    return detectionResult;
  }

  // Sort by confidence descending, then by position
  const sortedMatches = [...matches].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.position - b.position;
  });

  const deduplicatedMatches = [];
  const usedRanges = [];

  for (const match of sortedMatches) {
    const start = match.position;
    const end = match.position + match.value.length;

    // Check if this range overlaps with any already added
    const overlaps = usedRanges.some(range =>
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );

    if (!overlaps) {
      deduplicatedMatches.push(match);
      usedRanges.push({ start, end });
    }
  }

  // Sort back by position
  deduplicatedMatches.sort((a, b) => a.position - b.position);

  return {
    ...detectionResult,
    matches: deduplicatedMatches
  };
}

/**
 * Toggle suggestion panel
 * @param {HTMLElement} element - Input element
 * @param {HTMLElement} button - Button element
 * @param {Object} detectionResult - Detection result
 */
function togglePanel(element, button, detectionResult) {
  const existingPanel = activePanels.get(element);

  if (existingPanel) {
    closePanel(element);
  } else {
    openPanel(element, button, detectionResult);
  }
}

/**
 * Open suggestion panel
 * @param {HTMLElement} element - Input element
 * @param {HTMLElement} button - Button element
 * @param {Object} detectionResult - Detection result
 */
async function openPanel(element, button, detectionResult) {
  // Close any other open panels
  closeAllPanels();

  // Deduplicate matches before showing panel
  const deduplicatedResult = deduplicateMatches(detectionResult);

  const panel = document.createElement('div');
  panel.className = 'pii-guardian-panel';
  panel.innerHTML = createPanelHTML(deduplicatedResult);

  // Position panel above button (FIXED positioning for better visibility)
  const buttonRect = button.getBoundingClientRect();

  panel.style.position = 'fixed';
  panel.style.bottom = `${window.innerHeight - buttonRect.top + 8}px`;
  panel.style.right = `${window.innerWidth - buttonRect.right}px`;
  panel.style.left = 'auto';
  panel.style.top = 'auto';

  // Append panel directly to body for better positioning
  document.body.appendChild(panel);
  activePanels.set(element, panel);

  // Ensure panel is visible and adjust if cut off
  setTimeout(() => {
    const panelRect = panel.getBoundingClientRect();

    // If panel goes above viewport, adjust position
    if (panelRect.top < 10) {
      panel.style.bottom = 'auto';
      panel.style.top = '10px';
      panel.style.maxHeight = `${window.innerHeight - 20}px`;
    }

    // If panel goes off right edge, adjust
    if (panelRect.right > window.innerWidth - 10) {
      panel.style.right = '10px';
    }
  }, 0);

  // Attach action handlers
  attachPanelHandlers(panel, element, detectionResult);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeOnOutside(e) {
      if (!panel.contains(e.target) && !button.contains(e.target)) {
        closePanel(element);
        document.removeEventListener('click', closeOnOutside);
      }
    });
  }, 100);
}

/**
 * Create panel HTML
 * @param {Object} detectionResult
 * @returns {string}
 */
function createPanelHTML(detectionResult) {
  const { matches, sources, detectionMode } = detectionResult;

  // Calculate detection summary
  const regexCount = matches.filter(m => m.source === 'regex').length;
  const nerCount = matches.filter(m => m.source === 'ner').length;
  const hybridCount = matches.filter(m => m.source === 'hybrid').length;

  // Create detection summary if NER is being used
  let summaryHTML = '';
  if (detectionMode && (nerCount > 0 || hybridCount > 0 || detectionMode !== 'regex_only')) {
    const totalDetections = matches.length;
    summaryHTML = `
      <div class="detection-summary">
        <div class="detection-breakdown">
          <span class="breakdown-item">
            <strong class="breakdown-count">${totalDetections}</strong>
            <span class="breakdown-label">total</span>
          </span>
          ${regexCount > 0 ? `
          <span class="breakdown-item">
            <span class="source-badge source-regex">regex</span>
            <strong class="breakdown-count">${regexCount}</strong>
          </span>
          ` : ''}
          ${nerCount > 0 ? `
          <span class="breakdown-item">
            <span class="source-badge source-ner">NER</span>
            <strong class="breakdown-count">${nerCount}</strong>
          </span>
          ` : ''}
          ${hybridCount > 0 ? `
          <span class="breakdown-item">
            <span class="source-badge source-hybrid">both</span>
            <strong class="breakdown-count">${hybridCount}</strong>
          </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Performance notice if NER unavailable
  let performanceNoticeHTML = '';
  if (detectionMode === 'regex_only' && sources?.regexOnly) {
    performanceNoticeHTML = `
      <div class="performance-notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Using regex only - NER unavailable</span>
      </div>
    `;
  }

  const issuesHTML = matches.map((match, index) => {
    const { type, name, value, confidence, source } = match;
    const riskColor = getRiskColor(confidence);
    const confidenceLevel = getConfidenceLevel(confidence);
    const displayName = name || formatPIIType(type) || 'PII';

    // Determine source badge
    let sourceBadge = '';
    if (source === 'regex') {
      sourceBadge = '<span class="source-badge source-regex">regex</span>';
    } else if (source === 'ner') {
      sourceBadge = '<span class="source-badge source-ner">NER</span>';
    } else if (source === 'hybrid') {
      sourceBadge = '<span class="source-badge source-hybrid">both</span>';
    }

    // Determine confidence badge
    let confidenceBadge = '';
    if (confidenceLevel === 'high') {
      confidenceBadge = '<span class="confidence-badge confidence-high">High</span>';
    } else if (confidenceLevel === 'medium') {
      confidenceBadge = '<span class="confidence-badge confidence-medium">Medium</span>';
    } else {
      confidenceBadge = '<span class="confidence-badge confidence-low">Low</span>';
    }

    return `
      <div class="pii-issue" data-index="${index}">
        <div class="pii-issue-header">
          <div class="pii-issue-icon" style="background: ${riskColor}20; color: ${riskColor}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
        </div>
        <div class="pii-issue-info">
          <strong>${displayName}</strong>
          <div class="pii-issue-badges">
            ${sourceBadge}
            ${confidenceBadge}
          </div>
        </div>
        </div>
        <div class="pii-issue-value">
          <code>${escapeHtml(value)}</code>
        </div>
        <div class="pii-issue-actions">
          <button class="pii-issue-btn pii-issue-btn-mask" data-action="mask" data-index="${index}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            Mask
          </button>
          <button class="pii-issue-btn pii-issue-btn-remove" data-action="remove" data-index="${index}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="pii-panel-header">
      <div class="pii-panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <strong>PII Guardian</strong>
      </div>
      <span class="pii-panel-count">${matches.length} issue${matches.length !== 1 ? 's' : ''} found</span>
    </div>
    ${summaryHTML}
    ${performanceNoticeHTML}
    <div class="pii-panel-body">
      ${issuesHTML}
    </div>
    <div class="pii-panel-footer">
      <button class="pii-panel-btn pii-panel-btn-primary" data-action="mask-all">
        Mask All
      </button>
      <button class="pii-panel-btn pii-panel-btn-secondary" data-action="dismiss">
        Dismiss
      </button>
    </div>
  `;
}

/**
 * Get risk color
 * @param {number} confidence
 * @returns {string}
 */
function getRiskColor(confidence) {
  if (confidence >= 0.9) return '#D32F2F';
  if (confidence >= 0.75) return '#FF5722';
  if (confidence >= 0.6) return '#FF9800';
  return '#4CAF50';
}

/**
 * Get confidence level label
 * @param {number} confidence
 * @returns {string}
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Format PII type for display
 * @param {string} type
 * @returns {string}
 */
function formatPIIType(type) {
  if (!type) return 'PII';
  const map = {
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    phone: 'Phone',
    email: 'Email',
    creditcard: 'Credit Card',
    credit_card: 'Credit Card',
    bankaccount: 'Bank Account',
    bank_account: 'Bank Account',
    passport: 'Passport',
    ssn: 'SSN',
    ifsc: 'IFSC',
    gst: 'GST',
    dob: 'DOB',
    address: 'Address'
  };
  const key = String(type).toLowerCase();
  return map[key] || type;
}

/**
 * Escape HTML
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Attach panel action handlers
 * @param {HTMLElement} panel
 * @param {HTMLElement} element - Input element
 * @param {Object} detectionResult
 */
function attachPanelHandlers(panel, element, detectionResult) {
  // Mask individual item
  panel.querySelectorAll('[data-action="mask"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      await maskSinglePII(element, detectionResult, index);
      closePanel(element);
      scheduleDetection(element);
    });
  });

  // Remove individual item
  panel.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      await removeSinglePII(element, detectionResult, index);
      closePanel(element);
      scheduleDetection(element);
    });
  });

  // Mask all
  panel.querySelector('[data-action="mask-all"]')?.addEventListener('click', async () => {
    await maskAllPII(element, detectionResult);
    closePanel(element);
    scheduleDetection(element);
  });

  // Dismiss
  panel.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
    closePanel(element);
  });
}

/**
 * Mask single PII item
 * RESILIENT VERSION: Re-detects on current text for fresh positions
 * @param {HTMLElement} element
 * @param {Object} detectionResult
 * @param {number} index
 */
async function maskSinglePII(element, detectionResult, index) {
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    console.warn('[maskSinglePII] Extension context invalidated - cannot mask');
    return;
  }

  try {
    // Remove highlights before masking
    removeHighlights(element);

    // Import dependencies (may fail if context invalidated during import)
    const { maskText } = await import('../utils/maskRules.js');
    const { detectPIIWithRegex } = await import('../utils/regexPatterns.js');

    // Get current text (may have changed due to contenteditable quirks)
    const currentText = getTextContent(element);
    const originalDetectionText = originalText.get(element) || currentText;
    const match = detectionResult.matches[index];

    // Option 1: Re-detect on current text to get fresh positions (most robust)
    // This handles all contenteditable drift automatically
    const freshDetection = detectPIIWithRegex(currentText, 0.6);

    // Find the same PII in fresh detection (match by type and value)
    const freshMatch = freshDetection.matches.find(m =>
      m.type === match.type && m.value === match.value
    );

    if (freshMatch) {
      console.log(`[maskSinglePII] Using fresh detection for "${match.value}" at position ${freshMatch.position}`);
      const maskedText = maskText(currentText, [freshMatch]);
      setTextContent(element, maskedText);
    } else {
      // Fallback: Use resilient maskText with original text context
      console.log(`[maskSinglePII] Fresh detection failed, using resilient masking for "${match.value}"`);
      const maskedText = maskText(currentText, [match], { originalText: originalDetectionText });
      setTextContent(element, maskedText);
    }

    await incrementMasked();

    // Note: Detection results are now stale after masking
    // Next mask action will re-detect automatically
  } catch (error) {
    if (error.message?.includes('context invalidated') ||
        error.message?.includes('Extension context') ||
        !chrome?.runtime?.id) {
      console.warn('[maskSinglePII] Extension context invalidated during operation');
      return;
    }
    console.error('[maskSinglePII] Error:', error);
  }
}

/**
 * Remove single PII item
 * RESILIENT VERSION: Uses nth-occurrence and handles contenteditable quirks
 * @param {HTMLElement} element
 * @param {Object} detectionResult
 * @param {number} index
 */
async function removeSinglePII(element, detectionResult, index) {
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    console.warn('[removeSinglePII] Extension context invalidated - cannot remove');
    return;
  }

  try {
    // Remove highlights before removing PII
    removeHighlights(element);

    // Import normalization utilities at runtime (may fail if context invalidated)
    const { normalizeText, findNthOccurrence, findClosestOccurrence, getOccurrenceIndex, enhanceMatch } =
      await import('../utils/textNormalization.js');

  // Use stored original text to avoid whitespace corruption from HTML conversion
  const text = originalText.get(element) || getTextContent(element);
  const originalDetectionText = originalText.get(element) || text;
  const match = detectionResult.matches[index];

  const { value, position, start, end } = match;

  // Enhance match with occurrence tracking
  const enhanced = enhanceMatch(match, originalDetectionText);
  const { occurrence, normalizedValue } = enhanced;

  const actualPosition = position ?? start ?? -1;
  const actualEnd = end ?? (actualPosition >= 0 ? actualPosition + value.length : -1);

  let removalStart = -1;
  let removalEnd = -1;

  // Strategy 1: Try exact position match
  if (actualPosition >= 0 && actualEnd <= text.length) {
    const textAtPosition = text.substring(actualPosition, actualEnd);

    if (textAtPosition === value) {
      // Exact match - use it
      removalStart = actualPosition;
      removalEnd = actualEnd;
    } else {
      // Try normalized comparison
      const normalizedAtPosition = normalizeText(textAtPosition);
      if (normalizedAtPosition === normalizedValue) {
        removalStart = actualPosition;
        removalEnd = actualEnd;
      }
    }
  }

  // Strategy 2: Try nth-occurrence (most robust for duplicates)
  if (removalStart < 0 && occurrence >= 0) {
    console.log(`[removeSinglePII] Position mismatch, trying nth-occurrence (${occurrence}) for "${value}"`);

    const nthMatch = findNthOccurrence(text, value, occurrence);

    if (nthMatch) {
      removalStart = nthMatch.start;
      removalEnd = nthMatch.end;
    } else {
      // Try with normalized text
      const normalizedText = normalizeText(text);
      const nthNormMatch = findNthOccurrence(normalizedText, normalizedValue, occurrence);

      if (nthNormMatch) {
        // Map back to actual text position
        let actualPos = 0;
        let normPos = 0;

        for (let i = 0; i < text.length && normPos < nthNormMatch.start; i++) {
          const char = text[i];
          const normChar = normalizeText(char);
          if (normChar) normPos += normChar.length;
          actualPos = i + 1;
        }

        removalStart = actualPos;
        removalEnd = actualPos + value.length;
      }
    }
  }

  // Strategy 3: Find closest occurrence to expected position
  if (removalStart < 0 && actualPosition >= 0) {
    console.log(`[removeSinglePII] Trying closest occurrence near position ${actualPosition}`);

    const closestMatch = findClosestOccurrence(text, value, actualPosition, 200);

    if (closestMatch) {
      removalStart = closestMatch.start;
      removalEnd = closestMatch.end;
      console.log(`[removeSinglePII] Found at position ${closestMatch.start} (drift: ${closestMatch.distance} chars)`);
    }
  }

  // Strategy 4: Last resort - find first occurrence (only if no duplicates)
  if (removalStart < 0) {
    const allOccurrences = [];
    let searchIndex = 0;

    while (searchIndex < text.length) {
      const idx = text.indexOf(value, searchIndex);
      if (idx === -1) break;
      allOccurrences.push(idx);
      searchIndex = idx + 1;
    }

    if (allOccurrences.length === 1) {
      // Only one occurrence, safe to remove
      removalStart = allOccurrences[0];
      removalEnd = allOccurrences[0] + value.length;
      console.log(`[removeSinglePII] Single occurrence found at ${removalStart}`);
    } else if (allOccurrences.length > 1) {
      console.error(`[removeSinglePII] Multiple occurrences found (${allOccurrences.length}), cannot determine which to remove - SKIPPING`);
      return;
    }
  }

  // Perform removal if we found the position
  if (removalStart >= 0 && removalEnd > removalStart) {
    const newText = text.substring(0, removalStart) + ' ' + text.substring(removalEnd);

    // Normalize spacing to avoid double spaces and convert NBSP
    const normalizedText = normalizeText(newText).replace(/\s{2,}/g, ' ').trim();

    setTextContent(element, normalizedText);

    // Note: Detection results are now stale after removal
    // Panel should be closed or detection re-run if needed

    console.log(`[removeSinglePII] Removed "${value}" at position ${removalStart}-${removalEnd}`);
  } else {
    console.error(`[removeSinglePII] FAILED to find "${value}" for removal`);
  }
  } catch (error) {
    if (error.message?.includes('context invalidated') ||
        error.message?.includes('Extension context') ||
        !chrome?.runtime?.id) {
      console.warn('[removeSinglePII] Extension context invalidated during operation');
      return;
    }
    console.error('[removeSinglePII] Error:', error);
  }
}

/**
 * Mask all PII
 * RESILIENT VERSION: Re-detects on current text for fresh positions
 * @param {HTMLElement} element
 * @param {Object} detectionResult
 */
async function maskAllPII(element, detectionResult) {
  // Guard: Check if extension context is still valid
  if (!chrome?.runtime?.id) {
    console.warn('[maskAllPII] Extension context invalidated - cannot mask');
    return;
  }

  try {
    // Remove highlights before masking
    removeHighlights(element);

    // Import dependencies (may fail if context invalidated)
    const { maskText } = await import('../utils/maskRules.js');
    const { detectPIIWithRegex } = await import('../utils/regexPatterns.js');

  // Get current text (may have changed due to contenteditable quirks)
  const currentText = getTextContent(element);
  const originalDetectionText = originalText.get(element) || currentText;

  // Re-detect on current text for fresh positions
  const freshDetection = detectPIIWithRegex(currentText, 0.6);

  if (freshDetection.matches.length > 0) {
    console.log(`[maskAllPII] Using fresh detection (${freshDetection.matches.length} matches)`);
    const maskedText = maskText(currentText, freshDetection.matches);
    setTextContent(element, maskedText);
  } else {
    // Fallback: Use original matches with resilient masking
    console.log(`[maskAllPII] Fresh detection found nothing, using resilient masking`);
    const maskedText = maskText(currentText, detectionResult.matches, { originalText: originalDetectionText });
    setTextContent(element, maskedText);
  }

  await incrementMasked();
  } catch (error) {
    if (error.message?.includes('context invalidated') ||
        error.message?.includes('Extension context') ||
        !chrome?.runtime?.id) {
      console.warn('[maskAllPII] Extension context invalidated during operation');
      return;
    }
    console.error('[maskAllPII] Error:', error);
  }
}

/**
 * Close panel
 * @param {HTMLElement} element
 */
function closePanel(element) {
  const panel = activePanels.get(element);
  if (panel) {
    panel.remove();
    activePanels.delete(element);
  }
}

/**
 * Close all panels
 */
function closeAllPanels() {
  document.querySelectorAll('.pii-guardian-panel').forEach(panel => panel.remove());
}

/**
 * Inject floating button styles
 */
export function injectFloatingButtonStyles() {
  if (document.getElementById('pii-guardian-floating-btn-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'pii-guardian-floating-btn-styles';
  style.textContent = `
    /* Floating Button */
    .pii-guardian-floating-btn {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      cursor: pointer;
      transition: transform 0.2s ease;
      animation: piiButtonSlideIn 0.3s ease-out;
    }

    @keyframes piiButtonSlideIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .pii-guardian-floating-btn:hover {
      transform: scale(1.1);
    }

    /* PHASE 1: Pause pulse animation on hover for better UX */
    .pii-guardian-floating-btn:hover .pii-btn-icon.risk-critical,
    .pii-guardian-floating-btn:hover .pii-btn-icon.risk-high {
      animation-play-state: paused;
    }

    .pii-btn-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: relative;
      transition: all 0.2s ease;
    }

    .pii-btn-icon:hover {
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }

    .pii-btn-icon.risk-critical {
      color: #D32F2F;
      border: 2px solid #D32F2F;
      animation: criticalPulse 2s ease-in-out infinite;
    }

    /* PHASE 1: Pulse animation for critical PII */
    @keyframes criticalPulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 rgba(211, 47, 47, 0.7);
      }
      50% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 8px rgba(211, 47, 47, 0);
      }
    }

    .pii-btn-icon.risk-high {
      color: #FF5722;
      border: 2px solid #FF5722;
      animation: highPulse 2.5s ease-in-out infinite;
    }

    /* PHASE 1: Pulse animation for high-risk PII */
    @keyframes highPulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 rgba(255, 87, 34, 0.6);
      }
      50% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 6px rgba(255, 87, 34, 0);
      }
    }

    .pii-btn-icon.risk-medium {
      color: #FF9800;
      border: 2px solid #FF9800;
    }

    .pii-btn-icon.risk-low {
      color: #4CAF50;
      border: 2px solid #4CAF50;
    }

    .pii-btn-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #D32F2F;
      color: white;
      border-radius: 10px;
      min-width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 0 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    /* PHASE 1: Badge pulse for critical PII */
    .pii-btn-icon.risk-critical .pii-btn-badge {
      animation: badgePulse 2s ease-in-out infinite;
    }

    @keyframes badgePulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }

    /* Suggestion Panel - Grammarly Style */
    .pii-guardian-panel {
      position: fixed !important;
      background: white;
      border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15);
      min-width: 360px;
      max-width: 420px;
      width: 400px;
      max-height: 70vh;
      z-index: 2147483647 !important;
      animation: piiPanelSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid rgba(0,0,0,0.1);
      overflow: hidden;
    }

    @keyframes piiPanelSlideIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .pii-panel-header {
      padding: 18px 20px;
      border-bottom: 1px solid #e8e8e8;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(to bottom, #ffffff, #fafafa);
    }

    .pii-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #1a1a1a;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .pii-panel-title svg {
      color: #2196F3;
      flex-shrink: 0;
    }

    .pii-panel-count {
      background: #D32F2F15;
      color: #D32F2F;
      font-size: 13px;
      padding: 6px 12px;
      border-radius: 16px;
      font-weight: 600;
      white-space: nowrap;
    }

    .pii-panel-body {
      padding: 16px;
      max-height: calc(70vh - 140px);
      overflow-y: auto;
      overflow-x: hidden;
    }

    .pii-panel-body::-webkit-scrollbar {
      width: 6px;
    }

    .pii-panel-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .pii-panel-body::-webkit-scrollbar-thumb {
      background: #d0d0d0;
      border-radius: 3px;
    }

    .pii-panel-body::-webkit-scrollbar-thumb:hover {
      background: #b0b0b0;
    }

    .pii-issue {
      background: #ffffff;
      border: 1px solid #e8e8e8;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 4px solid #FF9800;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .pii-issue:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-left-color: #F57C00;
    }

    .pii-issue:last-child {
      margin-bottom: 0;
    }

    .pii-issue-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .pii-issue-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .pii-issue-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .pii-issue-info strong {
      font-size: 14px;
      color: #1a1a1a;
      font-weight: 600;
    }

    .pii-issue-confidence {
      font-size: 12px;
      color: #757575;
      font-weight: 500;
    }

    .pii-issue-badges {
      display: flex;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    /* Source Badges */
    .source-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .source-regex {
      background: #2196F3;
      color: white;
    }

    .source-ner {
      background: #9C27B0;
      color: white;
    }

    .source-hybrid {
      background: linear-gradient(90deg, #2196F3 0%, #9C27B0 100%);
      color: white;
    }

    /* Confidence Badges */
    .confidence-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .confidence-low {
      background: #FFF3E0;
      color: #E65100;
    }

    .confidence-medium {
      background: #FFF8E1;
      color: #F57C00;
    }

    .confidence-high {
      background: #E8F5E9;
      color: #2E7D32;
    }

    /* Detection Summary */
    .detection-summary {
      padding: 12px 20px;
      background: #F5F5F5;
      border-bottom: 1px solid #e8e8e8;
    }

    .detection-breakdown {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .breakdown-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }

    .breakdown-count {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .breakdown-label {
      color: #757575;
      font-size: 12px;
    }

    /* Performance Notice */
    .performance-notice {
      padding: 12px 20px;
      background: #FFF8E1;
      border-bottom: 1px solid #FFE082;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #F57C00;
    }

    .performance-notice svg {
      flex-shrink: 0;
      color: #F57C00;
    }

    .pii-issue-value {
      background: #fafafa;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .pii-issue-value code {
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 13px;
      color: #D32F2F;
      font-weight: 500;
      word-break: break-all;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .pii-issue-actions {
      display: flex;
      gap: 10px;
    }

    .pii-issue-btn {
      flex: 1;
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .pii-issue-btn svg {
      flex-shrink: 0;
    }

    .pii-issue-btn-mask {
      background: #2196F3;
      color: white;
    }

    .pii-issue-btn-mask:hover {
      background: #1976D2;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(33, 150, 243, 0.25);
    }

    .pii-issue-btn-remove {
      background: #ffebee;
      color: #D32F2F;
      border: 1px solid #ffcdd2;
    }

    .pii-issue-btn-remove:hover {
      background: #ffcdd2;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(211, 47, 47, 0.15);
    }

    .pii-panel-footer {
      padding: 16px 20px;
      border-top: 1px solid #e8e8e8;
      display: flex;
      gap: 10px;
      background: #fafafa;
    }

    .pii-panel-btn {
      flex: 1;
      padding: 12px 18px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .pii-panel-btn-primary {
      background: #2196F3;
      color: white;
    }

    .pii-panel-btn-primary:hover {
      background: #1976D2;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }

    .pii-panel-btn-primary:active {
      transform: translateY(0);
    }

    .pii-panel-btn-secondary {
      background: #ffffff;
      color: #757575;
      border: 1px solid #e0e0e0;
    }

    .pii-panel-btn-secondary:hover {
      background: #f5f5f5;
      color: #424242;
      border-color: #bdbdbd;
    }

    .pii-panel-btn-secondary:active {
      transform: scale(0.98);
    }

    .pii-panel-btn:active {
      transform: translateY(0);
    }

    /* PII Highlight Styles - Grammarly-like underlines */
    .pii-highlight {
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
      display: inline;
      font-weight: inherit;
    }

    .pii-highlight:hover {
      opacity: 0.8;
    }

    /* Scrollbar for panel */
    .pii-panel-body::-webkit-scrollbar {
      width: 6px;
    }

    .pii-panel-body::-webkit-scrollbar-track {
      background: #f5f5f5;
      border-radius: 3px;
    }

    .pii-panel-body::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }

    .pii-panel-body::-webkit-scrollbar-thumb:hover {
      background: #999;
    }
  `;

  document.head.appendChild(style);
}

// CRITICAL FIX BUG002: Global observer to watch for removed DOM nodes
// This prevents memory leaks by cleaning up observers/listeners when elements are removed
const globalCleanupObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if removed node or its children have cleanup functions
        const elements = [node, ...node.querySelectorAll('*')];
        for (const el of elements) {
          const cleanup = cleanupFunctions.get(el);
          if (cleanup) {
            cleanup();
            cleanupFunctions.delete(el);
          }
        }
      }
    }
  }
});

// Start watching entire document for removed nodes
if (document.body) {
  globalCleanupObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  // Body not ready yet, wait for it
  document.addEventListener('DOMContentLoaded', () => {
    globalCleanupObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}
