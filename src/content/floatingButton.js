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

    // Use innerText to keep user-visible spacing/line breaks between nodes
    text = clone.innerText || clone.textContent || '';
  } else {
    text = element.value || '';
  }

  // Preserve separators: convert newlines to spaces and strip invisible chars
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
      try {
        const range = document.createRange();
        range.setStart(element.firstChild, Math.min(text.length, element.firstChild.length || 0));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        console.warn('[floatingButton] Failed to set cursor position:', e);
      }
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
  // Guard against null elements
  if (!element || !button || !element.parentElement) {
    return;
  }

  try {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement.getBoundingClientRect();

    // Position relative to parent
    const bottom = parentRect.bottom - rect.bottom + 8;
    const right = parentRect.right - rect.right + 8;

    button.style.bottom = `${bottom}px`;
    button.style.right = `${right}px`;
  } catch (error) {
    console.warn('[positionButton] Error positioning button:', error);
  }
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

  // Deduplicate only exact duplicate spans; keep overlaps so we don't drop PII
  const bySpan = new Map();
  const deduplicatedMatches = [];

  for (const match of matches) {
    const { value = '', type = 'pii', confidence = 0, position } = match;

    // If we don't have a usable position, keep as-is (do not dedup)
    const start = Number.isFinite(position) && position >= 0 ? position : null;
    const end = start !== null ? start + value.length : null;

    const key = start !== null && end !== null
      ? `${start}-${end}-${type}-${value}`
      : `nopos-${type}-${value}-${confidence}-${deduplicatedMatches.length}`;

    if (!bySpan.has(key)) {
      bySpan.set(key, match);
      deduplicatedMatches.push(match);
    } else {
      // If duplicate span, keep the higher confidence version
      const existing = bySpan.get(key);
      if ((existing.confidence || 0) < confidence) {
        const idx = deduplicatedMatches.indexOf(existing);
        if (idx !== -1) {
          deduplicatedMatches[idx] = match;
        }
        bySpan.set(key, match);
      }
    }
  }

  // Sort by position when available to keep UI order predictable
  deduplicatedMatches.sort((a, b) => {
    const aPos = Number.isFinite(a.position) ? a.position : Number.POSITIVE_INFINITY;
    const bPos = Number.isFinite(b.position) ? b.position : Number.POSITIVE_INFINITY;
    if (aPos === bPos) {
      return (b.confidence || 0) - (a.confidence || 0);
    }
    return aPos - bPos;
  });

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
          <div class="pii-issue-left">
            <div class="pii-issue-icon" style="background: ${riskColor}20; color: ${riskColor}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div class="pii-issue-info">
              <strong>${displayName}</strong>
              <div class="pii-issue-badges">
                ${sourceBadge}
              </div>
            </div>
          </div>
          <div class="pii-issue-confidence">
            ${confidenceBadge}
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
    <div class="pii-panel">
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
      console.log(`[maskSinglePII] Masking "${match.value}" at position ${freshMatch.position}`);
      const maskedText = maskText(currentText, [freshMatch]);
      setTextContent(element, maskedText);
      markIssueMasked(element, index, getMaskedPreview(match.value));
    } else {
      // Fallback: Use resilient maskText with original text context
      console.log(`[maskSinglePII] Using resilient masking for "${match.value}"`);
      const maskedText = maskText(currentText, [match], { originalText: originalDetectionText });
      setTextContent(element, maskedText);
      markIssueMasked(element, index, getMaskedPreview(match.value));
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
    markAllIssuesMasked(element, detectionResult.matches);
  } else {
    // Fallback: Use original matches with resilient masking
    console.log(`[maskAllPII] Fresh detection found nothing, using resilient masking`);
    const maskedText = maskText(currentText, detectionResult.matches, { originalText: originalDetectionText });
    setTextContent(element, maskedText);
    markAllIssuesMasked(element, detectionResult.matches);
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

    /* Dark container inspired by reference */
.pii-panel {
  background: #0f1115;
  color: #f3f4f6;
  border-radius: 14px;
}

    .pii-panel-header {
      padding: 10px 14px;
      border-bottom: 1px solid #1f232b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f1115;
    }

.pii-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #f3f4f6;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.pii-panel-title svg {
  color: #f43f5e;
  flex-shrink: 0;
}

.pii-panel-count {
  background: #1f232b;
  color: #fca5a5;
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid #fca5a5;
}

    .pii-panel-body {
      padding: 10px;
      max-height: calc(70vh - 120px);
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
      background: #14171d;
      border: 1px solid #242a33;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      transition: all 0.2s ease;
      box-shadow: none;
    }

    .pii-issue:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }

    .pii-issue:last-child {
      margin-bottom: 0;
    }

    .pii-issue-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .pii-issue-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .pii-issue-icon {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #2a3038;
      color: #fca5a5;
    }

    .pii-issue-info {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .pii-issue-info strong {
      font-size: 13px;
      color: #f3f4f6;
      font-weight: 600;
      white-space: nowrap;
    }

    .pii-issue-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .pii-issue-confidence {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    /* Source Badges */
    .source-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border: 1px solid transparent;
      background: #fff;
    }

    .source-regex,
    .source-ner,
    .source-hybrid {
      border-color: #fca5a5;
      color: #fca5a5;
      background: #1f232b;
    }

    /* Confidence Badges */
    .confidence-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid transparent;
      background: #fff;
    }

    .confidence-low {
      border-color: #fca5a5;
      color: #fca5a5;
      background: #1f232b;
    }

    .confidence-medium {
      border-color: #fca5a5;
      color: #fca5a5;
      background: #1f232b;
    }

    .confidence-high {
      border-color: #fca5a5;
      color: #fca5a5;
      background: #1f232b;
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
      color: #f3f4f6;
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
      background: #0f1115;
      border: 1px solid #2a3038;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 8px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .pii-issue-value code {
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: #fca5a5;
      font-weight: 500;
      word-break: break-all;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .pii-issue-actions {
      display: flex;
      gap: 6px;
    }

    .pii-issue-btn {
      flex: 1;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid transparent;
    }

    .pii-issue-btn svg {
      flex-shrink: 0;
    }

    .pii-issue-btn-mask {
      background: #c81e4d;
      color: #fef2f2;
      border: 1px solid #be123c;
    }

    .pii-issue-btn-mask:hover {
      background: #be123c;
      transform: translateY(-1px);
    }

    .pii-issue-btn-remove {
      background: #1f232b;
      color: #fca5a5;
      border: 1px solid #fca5a5;
    }

    .pii-issue-btn-remove:hover {
      background: #2a3038;
      transform: translateY(-1px);
    }

    .pii-panel-footer {
      padding: 12px 14px;
      border-top: 1px solid #1f232b;
      display: flex;
      gap: 10px;
      background: #0f1115;
    }

    .pii-panel-btn {
      flex: 1;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid transparent;
    }

    .pii-panel-btn-primary {
      background: #c81e4d;
      color: #fdf2f8;
      border-color: #be123c;
    }

    .pii-panel-btn-primary:hover {
      background: #be123c;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(200, 30, 77, 0.25);
    }

    .pii-panel-btn-primary:active {
      transform: translateY(0);
    }

    .pii-panel-btn-secondary {
      background: #1f232b;
      color: #fca5a5;
      border: 1px solid #fca5a5;
    }

    .pii-panel-btn-secondary:hover {
      background: #2a3038;
      color: #fecdd3;
      border-color: #fecdd3;
    }

    .pii-panel-btn-secondary:active {
      transform: scale(0.98);
    }

    .pii-panel-btn:active {
      transform: translateY(0);
    }

    /* Masked state */
    .pii-issue.masked {
      border-color: #16a34a;
      background: #0f172a;
    }

    .pii-issue.masked .pii-issue-icon {
      background: #14532d;
      color: #bbf7d0;
    }

    .pii-issue.masked .pii-issue-value {
      border-color: #16a34a55;
      background: #0b1220;
    }

    .pii-issue.masked .pii-issue-value code {
      color: #bbf7d0;
    }

    .pii-issue.masked .source-badge,
    .pii-issue.masked .confidence-badge {
      border-color: #16a34a;
      color: #86efac;
      background: #0b1220;
    }

    .pii-issue.masked .pii-issue-btn-mask {
      background: #0b1220;
      color: #86efac;
      border-color: #16a34a;
    }

    .pii-issue.masked .pii-issue-btn-remove {
      background: #0b1220;
      color: #fca5a5;
      border-color: #fca5a5;
    }

    .masked-badge {
      border-color: #16a34a !important;
      color: #86efac !important;
      background: #0b1220 !important;
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

/**
 * Build a masked preview for display (keep first/last visible)
 * @param {string} value
 * @returns {string}
 */
function getMaskedPreview(value = '') {
  if (!value) return '•••• masked';
  if (value.length <= 4) return '••••';
  const chars = value.split('');
  for (let i = 1; i < chars.length - 1; i++) {
    if (/\w/.test(chars[i])) chars[i] = '•';
  }
  return chars.join('');
}

/**
 * Visually mark a single issue as masked (green state) and update display text
 * @param {HTMLElement} element
 * @param {number} index
 * @param {string} preview
 */
function markIssueMasked(element, index, preview = '•••• masked') {
  try {
    const panel = activePanels.get(element);
    if (!panel) return;
    const issueEl = panel.querySelector(`.pii-issue[data-index="${index}"]`);
    if (!issueEl) return;
    issueEl.classList.add('masked');

    const valueEl = issueEl.querySelector('.pii-issue-value code');
    if (valueEl) valueEl.textContent = preview;

    // Add masked badge
    let maskedBadge = issueEl.querySelector('.masked-badge');
    if (!maskedBadge) {
      maskedBadge = document.createElement('span');
      maskedBadge.className = 'confidence-badge masked-badge';
      issueEl.querySelector('.pii-issue-confidence')?.appendChild(maskedBadge);
    }
    maskedBadge.textContent = 'Masked';
  } catch (err) {
    console.warn('[markIssueMasked] Failed to mark issue masked', err);
  }
}

/**
 * Visually mark all issues as masked (green state)
 * @param {HTMLElement} element
 * @param {Array} matches
 */
function markAllIssuesMasked(element, matches = []) {
  try {
    const panel = activePanels.get(element);
    if (!panel) return;

    const issues = panel.querySelectorAll('.pii-issue');
    issues.forEach((node, idx) => {
      const match = matches[idx];
      const preview = match ? getMaskedPreview(match.value) : '•••• masked';
      markIssueMasked(element, node.dataset.index || idx, preview);
    });
  } catch (err) {
    console.warn('[markAllIssuesMasked] Failed to mark all issues masked', err);
  }
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
