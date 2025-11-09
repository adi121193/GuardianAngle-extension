/**
 * Warning Modal UI Injection
 * Creates and manages the PII warning modal using Shadow DOM
 */

import { maskText } from '../utils/maskRules.js';
import { incrementMasked, incrementBlocked } from '../utils/storage.js';

// Track active modals to prevent duplicates
let activeModal = null;

/**
 * Create warning modal HTML
 * @param {Object} detectionResult - PII detection results
 * @returns {string} Modal HTML
 */
function createModalHTML(detectionResult) {
  const { types, matches, score, risk } = detectionResult;

  const riskColors = {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#FF5722',
    critical: '#D32F2F'
  };

  const riskColor = riskColors[risk] || riskColors.medium;

  const piiList = types.map(type => {
    const matchCount = matches.filter(m => m.type === type).length;
    const displayName = matches.find(m => m.type === type)?.name || type;
    return `<li>${displayName} (${matchCount})</li>`;
  }).join('');

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
              ${risk.toUpperCase()} RISK
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
            The following sensitive information was detected in your input:
          </p>
          <ul class="pii-list">
            ${piiList}
          </ul>
          <p class="pii-confidence">
            Detection confidence: <strong>${Math.round(score * 100)}%</strong>
          </p>
          <p class="pii-info">
            Choose how to proceed:
          </p>
        </div>

        <div class="pii-modal-actions">
          <button class="pii-btn pii-btn-primary" id="pii-mask-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            Mask & Continue
          </button>
          <button class="pii-btn pii-btn-secondary" id="pii-send-btn">
            Send Anyway
          </button>
          <button class="pii-btn pii-btn-danger" id="pii-cancel-btn">
            Cancel
          </button>
        </div>

        <div class="pii-modal-footer">
          <small>🔒 PII Guardian - Protecting your privacy locally</small>
        </div>
      </div>
    </div>
  `;
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

    // Add modal HTML
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = createModalHTML(detectionResult);
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

      const result = {
        action,
        maskedText: null,
        originalText: targetElement.value
      };

      if (action === 'mask') {
        result.maskedText = maskText(targetElement.value, detectionResult.matches);
        await incrementMasked();
      } else if (action === 'cancel') {
        await incrementBlocked();
      }

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
      z-index: 999999;
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
