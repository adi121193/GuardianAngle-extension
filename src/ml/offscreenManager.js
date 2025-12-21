/**
 * Offscreen Manager
 * Manages offscreen document lifecycle and communication
 * Used by service worker to interact with ML inference worker
 */

const OFFSCREEN_DOCUMENT_PATH = 'html/offscreen.html';
const OFFSCREEN_REASONS = [chrome.offscreen.Reason.WORKERS];

class OffscreenManager {
  constructor() {
    this.isCreated = false;
    this.initializationPromise = null;
  }

  /**
   * Check if offscreen document exists
   */
  async hasDocument() {
    try {
      const clients = await chrome.offscreen.getDocuments?.();
      return clients && clients.length > 0;
    } catch (error) {
      // Fallback for older Chrome versions
      return this.isCreated;
    }
  }

  /**
   * Create offscreen document
   */
  async createDocument() {
    if (await this.hasDocument()) {
      console.log('[OffscreenManager] Document already exists');
      this.isCreated = true;
      return true;
    }

    console.log('[OffscreenManager] Creating offscreen document...');

    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: OFFSCREEN_REASONS,
        justification: 'Run ML inference in isolated environment for PII detection'
      });

      this.isCreated = true;
      console.log('[OffscreenManager] Offscreen document created');
      return true;
    } catch (error) {
      // Treat "Only a single offscreen document may be created" as success
      if (error.message && error.message.includes('Only a single offscreen')) {
        console.log('[OffscreenManager] Offscreen document already exists (caught error), treating as success');
        this.isCreated = true;
        return true;
      }

      console.error('[OffscreenManager] Failed to create document:', error);
      this.isCreated = false;
      return false;
    }
  }

  /**
   * Close offscreen document
   */
  async closeDocument() {
    if (!await this.hasDocument()) {
      console.log('[OffscreenManager] No document to close');
      return true;
    }

    console.log('[OffscreenManager] Closing offscreen document...');

    try {
      await chrome.offscreen.closeDocument();
      this.isCreated = false;
      console.log('[OffscreenManager] Offscreen document closed');
      return true;
    } catch (error) {
      console.error('[OffscreenManager] Failed to close document:', error);
      return false;
    }
  }

  /**
   * Send message to offscreen document
   */
  async sendMessage(message) {
    // Ensure document exists
    if (!await this.hasDocument()) {
      console.log('[OffscreenManager] Creating document before sending message...');
      const created = await this.createDocument();
      if (!created) {
        throw new Error('Failed to create offscreen document');
      }

      // Wait a bit for document to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send message
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Initialize NER model
   */
  async initializeModel() {
    if (this.initializationPromise) {
      console.log('[OffscreenManager] Initialization already in progress');
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      console.log('[OffscreenManager] Initializing NER model...');

      try {
        const response = await this.sendMessage({
          type: 'NER_INIT'
        });

        if (response.success) {
          console.log(`[OffscreenManager] Model initialized in ${response.initTimeMs}ms`);
          return { success: true, initTimeMs: response.initTimeMs };
        } else {
          console.error('[OffscreenManager] Model initialization failed:', response.error);
          return { success: false, error: response.error };
        }
      } catch (error) {
        console.error('[OffscreenManager] Failed to initialize model:', error);
        return { success: false, error: error.message };
      } finally {
        // Clear promise after completion
        setTimeout(() => {
          this.initializationPromise = null;
        }, 100);
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Run NER inference
   */
  async runInference(text, options = {}) {
    console.log('[OffscreenManager] Running inference...');

    try {
      const response = await this.sendMessage({
        type: 'NER_INFERENCE',
        text,
        options
      });

      if (response.success) {
        console.log(`[OffscreenManager] Inference complete: ${response.entities.length} entities found`);
        return {
          success: true,
          entities: response.entities,
          performance: response.performance
        };
      } else {
        console.error('[OffscreenManager] Inference failed:', response.error);
        return {
          success: false,
          error: response.error,
          entities: []
        };
      }
    } catch (error) {
      console.error('[OffscreenManager] Failed to run inference:', error);
      return {
        success: false,
        error: error.message,
        entities: []
      };
    }
  }

  /**
   * Get model status
   */
  async getStatus() {
    try {
      const response = await this.sendMessage({
        type: 'NER_STATUS'
      });

      return {
        success: true,
        isReady: response.isReady,
        isInitializing: response.isInitializing
      };
    } catch (error) {
      console.error('[OffscreenManager] Failed to get status:', error);
      return {
        success: false,
        isReady: false,
        isInitializing: false
      };
    }
  }

  /**
   * Dispose model resources
   */
  async disposeModel() {
    console.log('[OffscreenManager] Disposing model...');

    try {
      await this.sendMessage({
        type: 'NER_DISPOSE'
      });
      console.log('[OffscreenManager] Model disposed');
      return true;
    } catch (error) {
      console.error('[OffscreenManager] Failed to dispose model:', error);
      return false;
    }
  }
}

// Export singleton instance
export const offscreenManager = new OffscreenManager();
