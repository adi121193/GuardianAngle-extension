/**
 * Offscreen Manager Proxy for Content Scripts
 *
 * Content scripts can't directly access the offscreen manager (which lives in background context).
 * This proxy forwards NER inference requests via chrome.runtime.sendMessage to the background script.
 */

export class OffscreenManagerProxy {
  constructor() {
    this.isReady = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  /**
   * Initialize NER model via background script
   * @returns {Promise<Object>} Initialization result
   */
  async initializeModel() {
    try {
      console.log('[OffscreenManagerProxy] Requesting NER initialization...');

      const response = await chrome.runtime.sendMessage({
        type: 'INIT_NER'
      });

      if (response && response.success) {
        this.isReady = true;
        console.log('[OffscreenManagerProxy] NER initialization successful');
        return { success: true };
      } else {
        console.warn('[OffscreenManagerProxy] NER initialization failed:', response?.error);
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('[OffscreenManagerProxy] Failed to initialize NER:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run NER inference via background script
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Inference result
   */
  async runInference(text) {
    if (!this.isReady) {
      console.warn('[OffscreenManagerProxy] NER not ready, returning empty result');
      return {
        success: false,
        error: 'NER not ready',
        entities: []
      };
    }

    if (!text || text.trim().length === 0) {
      return {
        success: true,
        entities: []
      };
    }

    try {
      console.log(`[OffscreenManagerProxy] Requesting NER inference for text (${text.length} chars)`);

      const response = await chrome.runtime.sendMessage({
        type: 'RUN_NER_INFERENCE',
        text: text
      });

      if (response.success) {
        console.log(`[OffscreenManagerProxy] NER inference successful, found ${response.entities?.length || 0} entities`);
      } else {
        console.error('[OffscreenManagerProxy] NER inference failed:', response.error);
      }

      return response;
    } catch (error) {
      console.error('[OffscreenManagerProxy] Failed to send inference request:', error);
      return {
        success: false,
        error: error.message,
        entities: []
      };
    }
  }

  /**
   * Set ready state
   * @param {boolean} ready - Whether NER is ready
   */
  setReady(ready) {
    this.isReady = ready;
    console.log(`[OffscreenManagerProxy] Ready state: ${ready}`);
  }

  /**
   * Check if NER is ready
   * @returns {boolean}
   */
  isNERReady() {
    return this.isReady;
  }
}

// Export singleton instance
export const offscreenManagerProxy = new OffscreenManagerProxy();
