/**
 * Image Detector Implementation
 * Runs OCR on images to detect PII using Tesseract.js
 * Intended to run ONLY in the Offscreen Document to avoid CSP issues.
 */

import { createWorker } from 'tesseract.js';
import { detectPIIWithRegex } from '../utils/regexPatterns.js';

class ImageDetectorImplementation {
    constructor() {
        this.worker = null;
        this.isInitializing = false;
        this.isReady = false;
    }

    /**
     * Initialize the Tesseract worker with local files
     */
    async initialize() {
        if (this.isReady) return;
        if (this.isInitializing) return;

        this.isInitializing = true;

        try {
            console.log('[ImageDetectorImpl] Initializing Tesseract worker...');

            // Paths relative to the extension root (dist folder)
            const workerPath = chrome.runtime.getURL('ocr/worker.min.js');
            const corePath = chrome.runtime.getURL('ocr/tesseract-core.wasm.js');
            const langPath = chrome.runtime.getURL('models/ocr/');

            console.log('[ImageDetectorImpl] Configuration:', { workerPath, corePath, langPath });

            this.worker = await createWorker('eng', 1, {
                workerPath: workerPath,
                corePath: corePath,
                langPath: langPath,
                gzip: true,
                workerBlobURL: false, // Forces loading from URL, avoids CSP blocked blob: worker
                logger: m => console.debug('[Tesseract]', m),
                errorHandler: err => console.error('[Tesseract] Worker error:', err)
            });

            this.isReady = true;
            console.log('[ImageDetectorImpl] Worker initialized successfully');
        } catch (error) {
            console.error('[ImageDetectorImpl] Failed to initialize worker:', error);
            this.isReady = false;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Run PII detection on an image blob/url
     * @param {string|Blob} imageSource - Image URL or Blob
     * @returns {Promise<Object>} Detection results
     */
    async detect(imageSource) {
        if (!this.isReady) {
            await this.initialize();
        }

        if (!this.worker) {
            return { piiDetected: false, error: 'Worker not initialized' };
        }

        try {
            console.log('[ImageDetectorImpl] recognizing text...');
            const result = await this.worker.recognize(imageSource);

            if (!result || !result.data) {
                throw new Error('No data returned from Tesseract');
            }

            const { data: { text, words } } = result;
            const safeText = text || '';
            console.log('[ImageDetectorImpl] OCR Text:', safeText.substring(0, 100) + '...');
            console.log(`[ImageDetectorImpl] Tesseract found ${words ? words.length : 0} words.`);

            // Run Regex Detection on the extracted text
            const detection = detectPIIWithRegex(safeText);

            let matchesWithBbox = detection.matches;

            // MAP MATCHES TO BOUNDING BOXES (FUZZY SLIDING WINDOW)
            try {
                if (words && words.length > 0) {
                    matchesWithBbox = detection.matches.map(match => {
                        const matchValue = match.value;
                        let bestBbox = null;

                        // normalize match: remove all non-alphanumeric
                        const target = matchValue.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

                        if (!target) return match;

                        // STRATEGY: Constituent Token Matching
                        // PII often spans multiple words (e.g. "8140 4764 6362").
                        // We find all words that are significant parts of the detection string and union their bboxes.

                        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
                        let foundComponent = false;

                        // Break detection targets into tokens (e.g. ["8140", "4764", "6362"])
                        // We iterate over detected tokens and match them to OCR tokens.
                        const targetTokens = matchValue.split(/[\s,.-]+/).filter(t => t.length > 2);

                        if (targetTokens.length === 0) {
                            // Fallback for single short tokens (like "8140")
                            targetTokens.push(target);
                        }

                        for (const token of targetTokens) {
                            const cleanToken = token.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                            if (!cleanToken) continue;

                            // Find this token in words list (fuzzy match)
                            for (const w of words) {
                                const wClean = w.text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                if (!wClean) continue;

                                // Strict check: Word must be almost identical to the PII token
                                // or contained within it (for cases where PII token is "ID:8140" and word is "8140")
                                // But 'targetTokens' splits 'ID:8140' -> 'ID', '8140'.

                                if (wClean.includes(cleanToken) || cleanToken.includes(wClean)) {
                                    // Verify length similarity to avoid "1" matching "1995"
                                    const lenRatio = Math.min(wClean.length, cleanToken.length) / Math.max(wClean.length, cleanToken.length);
                                    if (lenRatio > 0.6) { // 60% length match
                                        if (w.bbox) {
                                            x0 = Math.min(x0, w.bbox.x0);
                                            y0 = Math.min(y0, w.bbox.y0);
                                            x1 = Math.max(x1, w.bbox.x1);
                                            y1 = Math.max(y1, w.bbox.y1);
                                            foundComponent = true;
                                        }
                                    }
                                }
                            }
                        }

                        if (foundComponent) {
                            bestBbox = { x0, y0, x1, y1 };
                            // Pad slightly
                            bestBbox.x0 = Math.max(0, bestBbox.x0 - 5);
                            bestBbox.y0 = Math.max(0, bestBbox.y0 - 5);
                            bestBbox.x1 += 5;
                            bestBbox.y1 += 5;
                        }

                        if (!bestBbox) {
                            console.warn(`[ImageDetectorImpl] Could not find bbox for "${matchValue}" (target: "${target}")`);
                        }

                        return {
                            ...match,
                            bbox: bestBbox
                        };
                    });
                }
            } catch (bboxError) {
                console.error('[ImageDetectorImpl] BBox mapping crashed:', bboxError);
                matchesWithBbox = detection.matches;
            }

            return {
                piiDetected: detection.matches.length > 0,
                text: safeText,
                matches: matchesWithBbox,
                count: detection.matches.length,
                debugWords: words // Pass all words for debug visualization
            };

        } catch (error) {
            console.error('[ImageDetectorImpl] Detection failed:', error);
            return { piiDetected: false, error: 'OCR Error: ' + error.message };
        }
    }

    /**
     * Terminate worker to free resources
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isReady = false;
        }
    }
}

export const imageDetectorImplementation = new ImageDetectorImplementation();
