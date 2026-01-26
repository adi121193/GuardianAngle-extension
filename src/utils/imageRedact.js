/**
 * Image Redaction Utility
 * Redacts PII from images using Canvas API
 */

/**
 * Draw black rectangles over sensitive areas
 * @param {File} imageFile - The original image file
 * @param {Array} matches - Array of PII matches with bbox {x0, y0, x1, y1}
 * @param {Array} debugWords - Optional: Array of all Tesseract words for debug visibility
 * @returns {Promise<File>} - Redacted image file
 */
export async function redactImage(imageFile, matches, debugWords = []) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // DEBUG: Draw All Tesseract Words (Blue Holo)
            if (debugWords && debugWords.length > 0) {
                ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
                ctx.lineWidth = 1;
                debugWords.forEach(w => {
                    if (w.bbox) {
                        const { x0, y0, x1, y1 } = w.bbox;
                        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                    }
                });
            }

            // Configure redact style
            ctx.fillStyle = 'black';

            // Draw redaction boxes
            matches.forEach(match => {
                if (match.bbox) {
                    const { x0, y0, x1, y1 } = match.bbox;
                    const width = x1 - x0;
                    const height = y1 - y0;

                    // Add slight padding
                    const padding = 2;
                    ctx.fillRect(x0 - padding, y0 - padding, width + (padding * 2), height + (padding * 2));
                }
            });

            // Convert back to File
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas to Blob failed'));
                    return;
                }
                const redactedFile = new File([blob], `redacted_${imageFile.name}`, { type: imageFile.type });
                resolve(redactedFile);
            }, imageFile.type);
        };

        img.onerror = (err) => reject(new Error('Failed to load image for redaction'));
        img.src = url;
    });
}
