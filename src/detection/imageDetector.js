/**
 * Image Detector Proxy
 * Routes OCR requests to the Service Worker -> Offscreen Document
 * This bypasses Content Script CSP restrictions and optimizes memory usage.
 */

class ImageDetectorProxy {
    constructor() {
        this.isProxy = true;
    }

    /**
     * Convert Blob/File to Base64
     * @param {Blob} blob 
     * @returns {Promise<string>}
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Run PII detection on an image blob/url
     * @param {string|Blob} imageSource - Image URL or Blob
     * @returns {Promise<Object>} Detection results
     */
    async detect(imageSource) {
        try {
            console.log('[ImageDetectorProxy] Routing OCR request to background...');

            let imagePayload = imageSource;

            // If Blob/File, convert to Base64 (cannot send Blob via sendMessage)
            if (imageSource instanceof Blob) {
                imagePayload = await this.blobToBase64(imageSource);
            }

            // Send to Service Worker
            const response = await chrome.runtime.sendMessage({
                type: 'RUN_OCR_INFERENCE',
                image: imagePayload
            });

            if (!response) {
                throw new Error('No response from background service');
            }

            // Check logging
            if (response.success) {
                console.log(`[ImageDetectorProxy] OCR success: ${response.count} matches`);
                return {
                    piiDetected: response.piiDetected,
                    text: response.text,
                    matches: response.matches,
                    count: response.count
                };
            } else {
                console.error('[ImageDetectorProxy] OCR failed:', response.error);
                return { piiDetected: false, error: response.error };
            }

        } catch (error) {
            console.error('[ImageDetectorProxy] Detection request failed:', error);
            return { piiDetected: false, error: error.message };
        }
    }

    // No-op for compatibility
    async initialize() {
        return Promise.resolve();
    }

    async terminate() {
        return Promise.resolve();
    }
}

export const imageDetector = new ImageDetectorProxy();
