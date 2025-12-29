/**
 * Warning Modal UI Injection
 * Creates and manages the PII warning modal using Shadow DOM
 */

import { maskText } from '../utils/maskRules.js';
import { incrementMasked } from '../utils/storage.js';

// Track active modals to prevent duplicates
let activeModal = null;

/**
 * Get text content from element (handles both input and contenteditable)
 * @param {HTMLElement} element
 * @returns {string}
 */
function getTextContent(element) {
  if (element.contentEditable === 'true') {
    // innerText preserves user-visible spacing/line breaks between nodes
    const text = element.innerText || element.textContent || '';
    return text
      .replace(/\u00A0/g, ' ')   // NBSP -> space
      .replace(/\u200B/g, '')    // ZWSP
      .replace(/\u200C/g, '')    // ZWNJ
      .replace(/\u200D/g, '')    // ZWJ
      .replace(/\s*\n\s*/g, ' ') // collapse line breaks to single space
      .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
      .trim();
  }
  return element.value || '';
}

/**
 * Set text content to element (handles both input and contenteditable)
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
 * Generate suggestions based on PII type
 */
function getSuggestions(type) {
  const suggestions = {
    aadhaar: 'Consider using: "My Aadhaar number" without the actual digits',
    pan: 'Consider using: "My PAN card" without the actual number',
    phone: 'Consider saying: "I\'ll provide my phone number via secure channel"',
    email: 'Consider using: "my email address" or a temporary email service',
    creditCard: 'Never share full card numbers. Say: "I have a payment card"',
    bankAccount: 'Never share account numbers publicly. Say: "I have a bank account"',
    passport: 'Refer to it as: "my passport" without the number',
    ssn: 'Never share SSN. Say: "I have a Social Security Number"',
    dob: 'Consider using: "My birth year is..." instead of full date',
    drivingLicense: 'Refer to it as: "my driver\'s license" without the number',
    ifsc: 'Say: "I need to transfer money" instead of sharing IFSC',
    gst: 'Refer to: "my GST registration" without the number'
  };
  return suggestions[type] || 'Consider removing or redacting this sensitive information';
}

/**
 * Create warning modal HTML with detailed PII information
 * @param {Object} detectionResult - PII detection results
 * @param {string} originalText - The original text containing PII
 * @returns {string} Modal HTML
 */
function createModalHTML(detectionResult, originalText = '') {
  const { types, matches, score, ambiguousMatches = [] } = detectionResult;

  // Calculate risk level from matches if not provided
  const calculateRisk = () => {
    if (!matches || matches.length === 0) return 'low';
    const maxConfidence = Math.max(...matches.map(m => m.confidence || 0));
    if (maxConfidence >= 0.9) return 'critical';
    if (maxConfidence >= 0.75) return 'high';
    if (maxConfidence >= 0.6) return 'medium';
    return 'low';
  };

  const risk = detectionResult.risk || calculateRisk();

  const riskColors = {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#FF5722',
    critical: '#D32F2F'
  };

  const riskColor = riskColors[risk] || riskColors.medium;

  // Create detailed PII list with actual detected values
  const piiDetailsList = matches.map(match => {
    const { type, value, name, confidence } = match;
    const suggestion = getSuggestions(type);

    return `
      <li class="pii-detail-item">
        <div class="pii-detail-header">
          <span class="pii-detail-type">${name}</span>
          <span class="pii-detail-confidence">${Math.round(confidence * 100)}%</span>
        </div>
        <div class="pii-detail-value">
          <strong>Detected:</strong>
          <code class="pii-detected-value">${escapeHtml(value)}</code>
        </div>
        <div class="pii-detail-suggestion">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          ${suggestion}
        </div>
      </li>
    `;
  }).join('');

  // Create ambiguous matches list (low confidence warnings)
  const ambiguousList = ambiguousMatches.length > 0 ? ambiguousMatches.map(match => {
    const { type, value, confidence, reasons = [] } = match;
    const typeName = type.replace('potential_', '').replace('_', ' ');

    return `
      <li class="pii-detail-item pii-detail-ambiguous">
        <div class="pii-detail-header">
          <span class="pii-detail-type">Possible ${typeName}</span>
          <span class="pii-detail-confidence pii-confidence-low">${Math.round(confidence * 100)}%</span>
        </div>
        <div class="pii-detail-value">
          <strong>Detected:</strong>
          <code class="pii-detected-value">${escapeHtml(value)}</code>
        </div>
        <div class="pii-detail-suggestion pii-suggestion-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Low confidence detection. ${reasons.join('. ')}
        </div>
      </li>
    `;
  }).join('') : '';

  // Generate masked preview
  const maskedPreview = maskText(originalText, matches);
  const showPreview = originalText && originalText !== maskedPreview;

  return `
    <div class="pii-modal-overlay">
      <div class="pii-modal">
        <div class="pii-modal-header" style="border-left: 4px solid ${riskColor}">
          <div class="pii-modal-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <h3>Sensitive Information Detected</h3>
            <p class="pii-risk-badge" style="background-color: ${riskColor}">
              ${risk.toUpperCase()} RISK - ${matches.length} ${matches.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button class="pii-modal-close" id="pii-close-btn" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="pii-modal-body">
          <p class="pii-warning-text">
            <strong>⚠️ Warning:</strong> The following sensitive information was detected and blocked:
          </p>

          <div class="pii-details-list">
            ${piiDetailsList}
          </div>

          ${ambiguousList ? `
            <div class="pii-ambiguous-section">
              <h4 class="pii-ambiguous-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Low Confidence Detections:
              </h4>
              <div class="pii-details-list">
                ${ambiguousList}
              </div>
            </div>
          ` : ''}

          ${showPreview ? `
            <div class="pii-preview-section">
              <h4 class="pii-preview-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                Preview of masked version:
              </h4>
              <div class="pii-preview-box">
                ${escapeHtml(maskedPreview)}
              </div>
              <p class="pii-preview-hint">
                Click "Mask & Continue" to send this version instead
              </p>
            </div>
          ` : ''}

          <p class="pii-info">
            <strong>Choose how to proceed:</strong>
          </p>
        </div>

        <div class="pii-modal-actions">
          <button class="pii-btn pii-btn-primary" id="pii-mask-btn" title="Replace sensitive data with masked version">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            Mask & Continue
          </button>
          <button class="pii-btn pii-btn-secondary" id="pii-send-btn" title="Send original text with PII (not recommended)">
            Send Anyway
          </button>
          <button class="pii-btn pii-btn-danger" id="pii-cancel-btn" title="Cancel and edit your message">
            Cancel & Edit
          </button>
        </div>

        <div class="pii-modal-footer">
          <small>🔒 PII Guardian v1.1.0 - Protecting your privacy locally</small>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create and inject warning modal
 * @param {Object} detectionResult - PII detection results
 * @param {HTMLElement} targetElement - Input element that triggered detection
 * @returns {Promise<Object>} User decision
 */
export async function showWarningModal(detectionResult, targetElement) {
  // Remove existing modal if present
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }

  return new Promise((resolve) => {
    // Create container for shadow DOM
    const container = document.createElement('div');
    container.id = 'pii-guardian-modal-container';
    document.body.appendChild(container);

    // Attach shadow DOM for style isolation
    const shadow = container.attachShadow({ mode: 'open' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = getModalStyles();
    shadow.appendChild(style);

    // Add modal HTML with original text for preview
    const modalWrapper = document.createElement('div');
    const originalText = getTextContent(targetElement);
    modalWrapper.innerHTML = createModalHTML(detectionResult, originalText);
    shadow.appendChild(modalWrapper);

    activeModal = container;

    // Get buttons from shadow DOM
    const maskBtn = shadow.getElementById('pii-mask-btn');
    const sendBtn = shadow.getElementById('pii-send-btn');
    const cancelBtn = shadow.getElementById('pii-cancel-btn');
    const closeBtn = shadow.getElementById('pii-close-btn');

    // Handle user decisions
    const handleDecision = async (action) => {
      container.remove();
      activeModal = null;

      const originalText = getTextContent(targetElement);
      const result = {
        action,
        maskedText: null,
        originalText: originalText
      };

      if (action === 'mask') {
        result.maskedText = maskText(originalText, detectionResult.matches);
        await incrementMasked();
      }
      // Note: incrementBlocked() is now called in monitorInputs.js only when actual blocking occurs

      resolve(result);
    };

    // Attach event listeners
    maskBtn.addEventListener('click', () => handleDecision('mask'));
    sendBtn.addEventListener('click', () => handleDecision('send'));
    cancelBtn.addEventListener('click', () => handleDecision('cancel'));
    closeBtn.addEventListener('click', () => handleDecision('cancel'));

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleDecision('cancel');
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Prevent clicks on overlay from closing (only explicit actions)
    const overlay = shadow.querySelector('.pii-modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Optional: close on overlay click
        // handleDecision('cancel');
      }
    });
  });
}

/**
 * Get modal styles
 * @returns {string} CSS styles
 */
function getModalStyles() {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .pii-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .pii-modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: auto;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .pii-modal-header {
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px solid #e0e0e0;
      position: relative;
    }

    .pii-modal-icon {
      color: #FF9800;
      flex-shrink: 0;
    }

    .pii-modal-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-risk-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      color: white;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .pii-modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .pii-modal-close:hover {
      background: #f5f5f5;
      color: #333;
    }

    .pii-modal-body {
      padding: 24px;
    }

    .pii-warning-text {
      color: #555;
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-list {
      list-style: none;
      padding: 0;
      margin: 0 0 16px 0;
      background: #f9f9f9;
      border-radius: 8px;
      padding: 16px;
    }

    .pii-list li {
      padding: 8px 0;
      color: #333;
      font-size: 14px;
      border-bottom: 1px solid #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-list li:last-child {
      border-bottom: none;
    }

    .pii-list li:before {
      content: "⚠️ ";
      margin-right: 8px;
    }

    /* Enhanced PII Details List */
    .pii-details-list {
      list-style: none;
      padding: 0;
      margin: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pii-detail-item {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 12px;
      border-left: 3px solid #FF9800;
    }

    .pii-detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .pii-detail-type {
      font-weight: 600;
      font-size: 13px;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-detail-confidence {
      background: #2196F3;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .pii-detail-value {
      margin: 8px 0;
      font-size: 13px;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-detail-value strong {
      color: #333;
      font-weight: 600;
    }

    .pii-detected-value {
      display: inline-block;
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      color: #856404;
      margin-left: 6px;
      word-break: break-all;
    }

    .pii-detail-suggestion {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 8px;
      padding: 8px;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 12px;
      color: #1565c0;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-detail-suggestion svg {
      flex-shrink: 0;
      margin-top: 2px;
      color: #2196F3;
    }

    /* Ambiguous PII Detections */
    .pii-ambiguous-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .pii-ambiguous-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #666;
      margin-bottom: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-ambiguous-title svg {
      color: #9E9E9E;
    }

    .pii-detail-ambiguous {
      border-left-color: #9E9E9E;
      background: #fafafa;
    }

    .pii-confidence-low {
      background: #9E9E9E;
    }

    .pii-suggestion-info {
      background: #f5f5f5;
      color: #666;
    }

    .pii-suggestion-info svg {
      color: #9E9E9E;
    }

    /* Preview Section */
    .pii-preview-section {
      margin: 16px 0;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .pii-preview-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-preview-title svg {
      color: #2196F3;
    }

    .pii-preview-box {
      background: white;
      border: 2px solid #2196F3;
      border-radius: 6px;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow-y: auto;
    }

    .pii-preview-hint {
      margin-top: 8px;
      font-size: 12px;
      color: #666;
      text-align: center;
      font-style: italic;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-confidence {
      color: #666;
      font-size: 13px;
      margin-bottom: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-confidence strong {
      color: #333;
    }

    .pii-info {
      color: #555;
      font-size: 14px;
      margin-bottom: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .pii-modal-actions {
      padding: 0 24px 24px 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pii-btn {
      flex: 1;
      min-width: 120px;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .pii-btn-primary {
      background: #2196F3;
      color: white;
    }

    .pii-btn-primary:hover {
      background: #1976D2;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }

    .pii-btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .pii-btn-secondary:hover {
      background: #e0e0e0;
    }

    .pii-btn-danger {
      background: #f5f5f5;
      color: #D32F2F;
      border: 1px solid #e0e0e0;
    }

    .pii-btn-danger:hover {
      background: #ffebee;
      border-color: #D32F2F;
    }

    .pii-btn:active {
      transform: translateY(0);
    }

    .pii-modal-footer {
      padding: 16px 24px;
      background: #f9f9f9;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }

    .pii-modal-footer small {
      color: #666;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    @media (max-width: 600px) {
      .pii-modal {
        width: 95%;
      }

      .pii-modal-actions {
        flex-direction: column;
      }

      .pii-btn {
        width: 100%;
      }
    }
  `;
}

/**
 * Close active modal
 */
export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

/**
 * Check if modal is active
 * @returns {boolean}
 */
export function isModalActive() {
  return activeModal !== null;
}
