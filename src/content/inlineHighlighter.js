/**
 * Inline PII Highlighter
 * Highlights PII in contenteditable elements with Grammarly-style underlines and tooltips
 */

import { detectPII, quickPIICheck } from './detectText.js';
import { getSettings } from '../utils/storage.js';
import { maskText } from '../utils/maskRules.js';

// Track highlighted elements
const highlightedElements = new WeakMap();
const activeTooltip = { current: null };

// Debounce timer
let highlightDebounceTimer = null;
const HIGHLIGHT_DEBOUNCE = 500; // ms

/**
 * Initialize inline highlighting for an input element
 * @param {HTMLElement} element - Input element to monitor
 */
export function initializeInlineHighlighting(element) {
  if (!element || highlightedElements.has(element)) {
    return;
  }

  highlightedElements.set(element, true);

  // Listen for input changes
  element.addEventListener('input', () => {
    scheduleHighlightUpdate(element);
  });

  // Listen for selection changes (cursor position)
  element.addEventListener('click', () => {
    scheduleHighlightUpdate(element);
  });

  // Initial highlight
  scheduleHighlightUpdate(element);
}

/**
 * Schedule a highlight update with debounce
 * @param {HTMLElement} element
 */
function scheduleHighlightUpdate(element) {
  if (highlightDebounceTimer) {
    clearTimeout(highlightDebounceTimer);
  }

  highlightDebounceTimer = setTimeout(() => {
    updateHighlights(element);
  }, HIGHLIGHT_DEBOUNCE);
}

/**
 * Update highlights for an element
 * @param {HTMLElement} element
 */
async function updateHighlights(element) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      clearHighlights(element);
      return;
    }

    const text = element.innerText || element.textContent || element.value || '';

    if (!text || text.length < 5) {
      clearHighlights(element);
      return;
    }

    // Quick check first
    if (!quickPIICheck(text)) {
      clearHighlights(element);
      return;
    }

    // Full detection
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes
    });

    if (!detectionResult.piiDetected || detectionResult.matches.length === 0) {
      clearHighlights(element);
      return;
    }

    // Apply highlights
    applyHighlights(element, detectionResult.matches);

  } catch (error) {
    console.error('PII Guardian: Error updating highlights:', error);
  }
}

/**
 * Apply highlights to PII matches
 * @param {HTMLElement} element
 * @param {Array} matches - Array of PII matches
 */
function applyHighlights(element, matches) {
  // Remove existing highlights
  clearHighlights(element);

  // For contenteditable elements, we'll use CSS to highlight
  // Create a wrapper overlay for highlights
  const overlay = createHighlightOverlay(element, matches);

  if (overlay) {
    element.parentElement.style.position = 'relative';
    element.parentElement.insertBefore(overlay, element);
  }
}

/**
 * Create highlight overlay for detected PII
 * @param {HTMLElement} element
 * @param {Array} matches
 * @returns {HTMLElement|null}
 */
function createHighlightOverlay(element, matches) {
  const text = element.innerText || element.textContent || element.value || '';

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'pii-guardian-highlight-overlay';
  overlay.setAttribute('data-pii-overlay', 'true');

  // Copy styles from original element
  const computedStyle = window.getComputedStyle(element);
  overlay.style.cssText = `
    position: absolute;
    top: ${element.offsetTop}px;
    left: ${element.offsetLeft}px;
    width: ${element.offsetWidth}px;
    height: ${element.offsetHeight}px;
    pointer-events: none;
    z-index: 1;
    font-family: ${computedStyle.fontFamily};
    font-size: ${computedStyle.fontSize};
    line-height: ${computedStyle.lineHeight};
    padding: ${computedStyle.padding};
    overflow: hidden;
  `;

  // Create highlight spans for each match
  let lastIndex = 0;
  let html = '';

  // Sort matches by position
  const sortedMatches = [...matches].sort((a, b) => a.position - b.position);

  for (const match of sortedMatches) {
    const { position, value, type, name, confidence } = match;

    // Add text before match
    html += escapeHtml(text.substring(lastIndex, position));

    // Add highlighted match
    const riskClass = getRiskClass(confidence);
    html += `<span class="pii-highlight ${riskClass}"
                   data-pii-type="${type}"
                   data-pii-name="${name}"
                   data-pii-value="${escapeHtml(value)}"
                   data-pii-confidence="${confidence}"
                   onmouseover="window.__piiShowTooltip(this, event)"
                   onmouseout="window.__piiHideTooltip()"
                   style="pointer-events: auto; cursor: pointer;">
              ${escapeHtml(value)}
            </span>`;

    lastIndex = position + value.length;
  }

  // Add remaining text
  html += escapeHtml(text.substring(lastIndex));

  overlay.innerHTML = html;

  // Attach global tooltip handlers
  attachTooltipHandlers();

  return overlay;
}

/**
 * Get risk class based on confidence
 * @param {number} confidence
 * @returns {string}
 */
function getRiskClass(confidence) {
  if (confidence >= 0.9) return 'pii-risk-critical';
  if (confidence >= 0.75) return 'pii-risk-high';
  if (confidence >= 0.6) return 'pii-risk-medium';
  return 'pii-risk-low';
}

/**
 * Escape HTML entities
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all highlights from an element
 * @param {HTMLElement} element
 */
function clearHighlights(element) {
  const overlays = element.parentElement?.querySelectorAll('[data-pii-overlay="true"]');
  overlays?.forEach(overlay => overlay.remove());
}

/**
 * Attach global tooltip handlers
 */
function attachTooltipHandlers() {
  if (window.__piiShowTooltip) return; // Already attached

  window.__piiShowTooltip = function(highlightElement, event) {
    showTooltip(highlightElement, event);
  };

  window.__piiHideTooltip = function() {
    hideTooltip();
  };
}

/**
 * Show tooltip for highlighted PII
 * @param {HTMLElement} highlightElement
 * @param {Event} event
 */
function showTooltip(highlightElement, event) {
  hideTooltip(); // Remove any existing tooltip

  const type = highlightElement.dataset.piiType;
  const name = highlightElement.dataset.piiName;
  const value = highlightElement.dataset.piiValue;
  const confidence = parseFloat(highlightElement.dataset.piiConfidence);

  const tooltip = document.createElement('div');
  tooltip.className = 'pii-guardian-tooltip';
  tooltip.innerHTML = `
    <div class="pii-tooltip-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <strong>${name} Detected</strong>
    </div>
    <div class="pii-tooltip-body">
      <p class="pii-tooltip-confidence">Confidence: ${Math.round(confidence * 100)}%</p>
      <div class="pii-tooltip-value">
        <code>${escapeHtml(value)}</code>
      </div>
    </div>
    <div class="pii-tooltip-actions">
      <button class="pii-tooltip-btn pii-tooltip-btn-mask" onclick="window.__piiMaskThis('${type}', this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        Mask
      </button>
      <button class="pii-tooltip-btn pii-tooltip-btn-remove" onclick="window.__piiRemoveThis(this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Remove
      </button>
    </div>
  `;

  // Position tooltip
  const rect = highlightElement.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.style.zIndex = '2147483647';

  // Store reference to highlighted element
  tooltip.__highlightElement = highlightElement;

  document.body.appendChild(tooltip);
  activeTooltip.current = tooltip;

  // Attach action handlers
  attachActionHandlers(tooltip, highlightElement, value, type);
}

/**
 * Hide active tooltip
 */
function hideTooltip() {
  if (activeTooltip.current) {
    activeTooltip.current.remove();
    activeTooltip.current = null;
  }
}

/**
 * Attach action handlers to tooltip buttons
 * @param {HTMLElement} tooltip
 * @param {HTMLElement} highlightElement
 * @param {string} value
 * @param {string} type
 */
function attachActionHandlers(tooltip, highlightElement, value, type) {
  // Mask action
  window.__piiMaskThis = async function(type, btnElement) {
    const inputElement = findInputElement(highlightElement);
    if (!inputElement) return;

    const text = inputElement.innerText || inputElement.textContent || inputElement.value || '';
    const settings = await getSettings();
    const detectionResult = await detectPII(text, {
      minConfidence: settings.minConfidence,
      enabledTypes: settings.enabledPIITypes
    });

    const maskedText = maskText(text, detectionResult.matches);
    setTextContent(inputElement, maskedText);

    hideTooltip();
    updateHighlights(inputElement);
  };

  // Remove action
  window.__piiRemoveThis = function(btnElement) {
    const inputElement = findInputElement(highlightElement);
    if (!inputElement) return;

    const text = inputElement.innerText || inputElement.textContent || inputElement.value || '';
    const newText = text.replace(value, '');
    setTextContent(inputElement, newText);

    hideTooltip();
    updateHighlights(inputElement);
  };
}

/**
 * Find the input element from highlight overlay
 * @param {HTMLElement} highlightElement
 * @returns {HTMLElement|null}
 */
function findInputElement(highlightElement) {
  const overlay = highlightElement.closest('[data-pii-overlay="true"]');
  return overlay?.nextElementSibling;
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

  // Trigger input event
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Inject highlight styles
 */
export function injectHighlightStyles() {
  if (document.getElementById('pii-guardian-highlight-styles')) {
    return; // Already injected
  }

  const style = document.createElement('style');
  style.id = 'pii-guardian-highlight-styles';
  style.textContent = `
    /* PII Highlight Styles */
    .pii-guardian-highlight-overlay {
      user-select: none;
      color: transparent;
    }

    .pii-highlight {
      background: linear-gradient(180deg, rgba(255,152,0,0.2) 0%, rgba(255,152,0,0.3) 100%);
      border-bottom: 2px solid #FF9800;
      border-radius: 2px;
      transition: all 0.2s ease;
      display: inline;
      cursor: pointer;
    }

    .pii-highlight:hover {
      background: rgba(255,152,0,0.4);
      border-bottom-width: 3px;
    }

    .pii-risk-critical {
      background: linear-gradient(180deg, rgba(211,47,47,0.2) 0%, rgba(211,47,47,0.3) 100%);
      border-bottom-color: #D32F2F;
    }

    .pii-risk-critical:hover {
      background: rgba(211,47,47,0.4);
    }

    .pii-risk-high {
      background: linear-gradient(180deg, rgba(255,87,34,0.2) 0%, rgba(255,87,34,0.3) 100%);
      border-bottom-color: #FF5722;
    }

    .pii-risk-high:hover {
      background: rgba(255,87,34,0.4);
    }

    .pii-risk-medium {
      background: linear-gradient(180deg, rgba(255,152,0,0.2) 0%, rgba(255,152,0,0.3) 100%);
      border-bottom-color: #FF9800;
    }

    .pii-risk-medium:hover {
      background: rgba(255,152,0,0.4);
    }

    .pii-risk-low {
      background: linear-gradient(180deg, rgba(76,175,80,0.2) 0%, rgba(76,175,80,0.3) 100%);
      border-bottom-color: #4CAF50;
    }

    .pii-risk-low:hover {
      background: rgba(76,175,80,0.4);
    }

    /* Tooltip Styles */
    .pii-guardian-tooltip {
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      min-width: 240px;
      max-width: 320px;
      animation: piiTooltipSlideIn 0.2s ease-out;
    }

    @keyframes piiTooltipSlideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .pii-tooltip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #FF9800;
      font-weight: 600;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    }

    .pii-tooltip-header svg {
      flex-shrink: 0;
    }

    .pii-tooltip-body {
      margin-bottom: 12px;
    }

    .pii-tooltip-confidence {
      font-size: 11px;
      color: #666;
      margin-bottom: 6px;
    }

    .pii-tooltip-value {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 6px 8px;
      margin-bottom: 8px;
    }

    .pii-tooltip-value code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: #856404;
      word-break: break-all;
    }

    .pii-tooltip-actions {
      display: flex;
      gap: 8px;
    }

    .pii-tooltip-btn {
      flex: 1;
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .pii-tooltip-btn-mask {
      background: #2196F3;
      color: white;
    }

    .pii-tooltip-btn-mask:hover {
      background: #1976D2;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
    }

    .pii-tooltip-btn-remove {
      background: #f5f5f5;
      color: #D32F2F;
    }

    .pii-tooltip-btn-remove:hover {
      background: #ffebee;
      transform: translateY(-1px);
    }

    .pii-tooltip-btn:active {
      transform: translateY(0);
    }
  `;

  document.head.appendChild(style);
}
