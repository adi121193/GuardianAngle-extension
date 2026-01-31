/**
 * Warning Modal UI Injection
 * Creates and manages the PII warning modal using Shadow DOM
 */

import { maskText } from '../utils/maskRules.js';
import { incrementMasked } from '../utils/storage.js';
import { ManualMaskUI } from './ui/manualMaskOverlay.js';
import { DESIGN_SYSTEM_CSS } from './ui/designSystem.js';

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
    const { type, value, confidence } = match;
    // Fallback if name is missing
    const name = match.name || type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
    const suggestion = getSuggestions(type);

    return `
      <li class="pii-detail-item">
        <div class="pii-detail-header">
          <span class="pii-detail-type">${name}</span>
          <div class="pii-detail-badges">
            <span class="pii-detail-source pii-source-${match.source || 'regex'}">${(match.source || 'regex').toUpperCase()}</span>
            <span class="pii-detail-confidence">${Math.round(confidence * 100)}%</span>
          </div>
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
        
        <!-- MANUAL MASK BTN INSERT -->
        <div style="padding: 0 24px 16px; display: flex; justify-content: center;">
             <button class="pii-btn" id="pii-manual-btn" style="background: #f59e0b; color: white; width: 100%;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/>
                  <circle cx="11" cy="11" r="2"/>
                </svg>
                Open Manual Redaction Studio (Beta)
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
    const manualBtn = shadow.getElementById('pii-manual-btn'); // New Button

    // Handle user decisions
    const handleDecision = async (action, payload = null) => {
      container.remove();
      activeModal = null;

      const originalText = getTextContent(targetElement);
      const result = {
        action,
        maskedText: null,
        originalText: originalText,
        file: payload // For manual mask file return
      };

      if (action === 'mask' && !payload) { // Auto-mask text
        result.maskedText = maskText(originalText, detectionResult.matches);
        await incrementMasked();
      }

      resolve(result);
    };

    // Auto-Mask Button Logic (Conditional)
    if (maskBtn) {
      // Hide Auto-Mask if it's an image (force manual)
      // Check if originalFile exists in detectionResult to determine if it's an image
      if (detectionResult.originalFile) {
        maskBtn.style.display = 'none';
      } else {
        maskBtn.style.display = 'flex'; // Show for text
      }

      maskBtn.addEventListener('click', () => handleDecision('mask'));
    }

    // Attach event listeners
    // maskBtn.addEventListener('click', () => handleDecision('mask')); // Handled above
    sendBtn.addEventListener('click', () => handleDecision('send'));
    cancelBtn.addEventListener('click', () => handleDecision('cancel'));
    closeBtn.addEventListener('click', () => handleDecision('cancel'));

    // Manual Mask Logic
    if (manualBtn) {
      manualBtn.addEventListener('click', async () => {
        // Temporarily hide modal but keep it effectively closed
        container.style.display = 'none'; // Or just remove it? 
        // Logic says remove it to avoid z-index wars.

        try {
          const ui = new ManualMaskUI();
          // We need the original file. 
          // Problem: 'detectionResult' usually doesn't have the file object unless we passed it.
          // We passed 'detectionResult' from monitorInputs.js which was 'ocrResult'.
          // Let's assume we can get the file from 'detectionResult.originalFile' if we modify monitorInputs to pass it.

          // CRITICAL: We need the File object here.
          // I will assume for now 'targetElement' might help or detectionResult has it.
          // Actually, showWarningModal signature is (detectionResult, targetElement).
          // In monitorInputs.js (line 1386), we call it. I need to make sure we pass the file there.

          // Fallback: If no file, we can't manual mask images.
          // But wait, Manual Mask is ONLY for images.
          if (detectionResult.originalFile) {
            const redactedFile = await ui.open(detectionResult.originalFile, detectionResult.matches);
            handleDecision('manual_mask', redactedFile);
          } else {
            alert('Error: Original image lost. Cannot open studio.');
            handleDecision('cancel');
          }
        } catch (err) {
          console.log('Manual mask cancelled');
          // Re-show modal? Or just cancel.
          handleDecision('cancel');
        }
      });
    }

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
    ${DESIGN_SYSTEM_CSS}

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: var(--font-sans); /* System UI */
    }

    .pii-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.7); /* Slate 950 alpha */
      backdrop-filter: blur(8px); /* Modern Glass */
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .pii-modal {
      background: var(--color-bg-primary);
      border: 1px solid var(--color-bg-hover);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.05); /* Subtle inner border */
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: auto;
      color: var(--color-text-primary);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); /* Elegant spring */
    }

    @keyframes slideUp {
      from { transform: translateY(10px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .pii-modal-header {
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 1px solid var(--color-bg-hover);
      position: relative;
      background: var(--color-bg-surface);
    }

    .pii-modal-icon {
      color: var(--color-warning);
      flex-shrink: 0;
      background: rgba(245, 158, 11, 0.1); /* Amber alpha */
      padding: 10px;
      border-radius: var(--radius-md);
    }

    .pii-modal-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 4px 0;
      letter-spacing: -0.01em;
    }

    .pii-risk-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: var(--color-bg-primary); 
      border: 1px solid var(--color-bg-hover);
      color: var(--color-text-secondary);
    }

    .pii-modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }

    .pii-modal-close:hover {
      background: var(--color-bg-hover);
      color: var(--color-text-primary);
    }

    .pii-modal-body {
      padding: 24px;
    }

    .pii-warning-text {
      color: var(--color-text-secondary);
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.6;
    }

    /* Details List */
    .pii-details-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .pii-detail-item {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-bg-hover);
      border-radius: var(--radius-md);
      padding: 16px;
      transition: transform 0.1s;
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
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pii-detail-badges {
      display: flex;
      gap: 6px;
    }

    .pii-detail-confidence {
      background: var(--color-bg-primary);
      color: var(--color-primary);
      border: 1px solid var(--color-bg-hover);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 600;
    }

    .pii-detail-value {
      background: var(--color-bg-primary);
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-bg-hover);
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--color-text-secondary);
      word-break: break-all;
    }

    .pii-detected-value {
        color: var(--color-warning);
        background: transparent;
        border: none;
        padding: 0;
        font-family: inherit;
    }

    .pii-detected-value-masked {
        color: var(--color-primary);
    }

    .pii-detail-suggestion {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.5;
      padding-top: 12px;
      border-top: 1px solid var(--color-bg-hover);
    }
    
    .pii-detail-suggestion svg {
        color: var(--color-info);
    }

    /* Actions */
    .pii-modal-actions {
      padding: 0 24px 24px 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    /* Full width buttons at bottom */
    .pii-actions-row {
        grid-column: span 2;
        display: flex;
        gap: 12px;
    }

    .pii-btn {
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid transparent;
      outline: none; /* Accessible focus provided by focus-visible */
    }
    
    .pii-btn:focus-visible {
        box-shadow: 0 0 0 2px var(--color-bg-primary), 0 0 0 4px var(--color-primary);
    }

    .pii-btn-primary { 
        background: var(--color-primary);
        color: #fff;
        font-weight: 600;
    }
    .pii-btn-primary:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
    }

    .pii-btn-secondary {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-bg-hover);
        color: var(--color-text-secondary);
    }
    .pii-btn-secondary:hover {
        background: var(--color-bg-hover);
        color: var(--color-text-primary);
    }
    
    .pii-btn-danger {
        background: transparent;
        border: 1px solid var(--color-bg-hover);
        color: var(--color-danger);
    }
    .pii-btn-danger:hover {
        border-color: var(--color-danger);
        background: rgba(244, 63, 94, 0.1);
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--color-bg-hover); border-radius: var(--radius-full); }
    ::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }
    
    .pii-modal-footer {
       display: none; /* Hide footer for modern look */
    }
    
    @media (max-width: 600px) {
      .pii-modal { width: 95%; }
      .pii-modal-actions { grid-template-columns: 1fr; }
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
