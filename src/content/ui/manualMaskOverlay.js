/**
 * Manual Masking Overlay UI
 * Allows users to manually draw redaction boxes on an image.
 * Features:
 * - Canvas-based drawing
 * - OCR Hints (Yellow)
 * - User Redactions (Black)
 * - Undo/Reset/Done actions
 */

export class ManualMaskUI {
    constructor() {
        this.overlay = null;
        this.canvas = null;
        this.ctx = null;
        this.image = null;
        this.ocrMatches = [];
        this.userRects = []; // Array of {x, y, w, h}
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.resolvePromise = null;
        this.rejectPromise = null;
        this.scale = 1; // Canvas to Client scale
    }

    /**
     * Open the UI
     * @param {File} imageFile - The original image
     * @param {Array} ocrMatches - Matches from OCR {bbox: {x0, y0, x1, y1}}
     * @returns {Promise<File>} - Resolves with redacted file
     */
    async open(imageFile, ocrMatches = []) {
        this.ocrMatches = ocrMatches;
        this.userRects = [];

        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;

            // Create UI elements
            this.createOverlay();

            // Load Image
            this.image = new Image();
            this.image.onload = () => {
                this.initCanvas();
                this.draw(); // Initial draw
            };
            this.image.src = URL.createObjectURL(imageFile);
            this.originalFile = imageFile;
        });
    }

    createOverlay() {
        // Find or create shadow root container
        let container = document.getElementById('pii-guardian-manual-mask-root');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pii-guardian-manual-mask-root';
            // High z-index to sit on top of everything
            container.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
            document.body.appendChild(container);
        }

        const shadow = container.attachShadow({ mode: 'open' });

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            :host { font-family: system-ui, -apple-system, sans-serif; }
            .overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.85);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .toolbar {
                background: #2a2a2a; color: white; padding: 10px 20px; border-radius: 8px;
                margin-bottom: 20px; display: flex; gap: 10px;
            }
            button {
                background: #444; border: 1px solid #555; color: white; padding: 8px 16px;
                cursor: pointer; border-radius: 4px; font-weight: 500;
            }
            button:hover { background: #555; }
            button.primary { background: #3b82f6; border-color: #2563eb; }
            button.primary:hover { background: #2563eb; }
            .canvas-container {
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
                border: 2px solid #555;
                max-width: 90vw; max-height: 80vh;
                overflow: auto;
                cursor: crosshair;
            }
        `;
        shadow.appendChild(style);

        // DOM Structure
        const wrapper = document.createElement('div');
        wrapper.className = 'overlay';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.innerHTML = `
            <div style="font-weight: bold; display: flex; align-items: center; gap: 8px;">
                <span>🛡️ Privacy Studio</span>
                <span style="font-size: 11px; background: #333; padding: 2px 6px; border-radius: 4px; color: #aaa;">BETA</span>
            </div>
            <div style="flex: 1;"></div>
            <button id="btn-undo" title="Undo last box (Ctrl+Z)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
                Undo
            </button>
            <button id="btn-reset" title="Clear all boxes">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Reset
            </button>
            <div style="width: 1px; background: #555; margin: 0 10px; height: 24px;"></div>
            <button id="btn-cancel" style="border-color: #ef4444; color: #ef4444;">Cancel</button>
            <button id="btn-save" class="primary">
                Done & Upload
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>
            </button>
        `;

        // Main Content Area (Sidebar + Canvas)
        const mainContent = document.createElement('div');
        mainContent.style.cssText = 'display: flex; flex: 1; width: 100%; overflow: hidden; gap: 20px; padding: 0 20px 20px;';

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.style.cssText = `
            width: 280px; background: #2a2a2a; border-radius: 8px; padding: 16px; 
            display: flex; flex-direction: column; overflow-y: auto; color: #eee;
            border: 1px solid #444;
        `;

        // Populate Sidebar
        let piiItemsHtml = '';
        if (this.ocrMatches && this.ocrMatches.length > 0) {
            piiItemsHtml = this.ocrMatches.map((m, i) => `
                <div class="pii-item" data-index="${i}" style="margin-bottom: 12px; padding: 10px; background: #333; border-radius: 6px; border-left: 3px solid #EAB308; transition: all 0.2s;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #aaa; margin-bottom: 4px;">${m.type}</div>
                    <div style="font-family: monospace; font-size: 12px; word-break: break-all; color: #fff;">${m.value}</div>
                    <div class="status-text" style="font-size: 10px; color: ${m.bbox ? '#EAB308' : '#ef4444'}; margin-top: 4px; font-weight: bold;">
                        ${m.bbox ? '📍 Location valid' : '⚠️ Location missing'}
                    </div>
                </div>
            `).join('');
        } else {
            piiItemsHtml = '<div style="color: #aaa; font-style: italic;">No PII detected automatically.</div>';
        }

        sidebar.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 16px; border-bottom: 1px solid #444; padding-bottom: 8px;">Detected Items</h3>
            <div style="font-size: 13px; color: #ccc; margin-bottom: 16px;">
                The AI highlighted potential sensitive areas in <strong style="color: #EAB308;">Yellow</strong>.
            </div>
            ${piiItemsHtml}
        `;

        // Canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';
        canvasContainer.style.flex = '1'; // Take remaining width

        this.canvas = document.createElement('canvas');
        canvasContainer.appendChild(this.canvas);

        mainContent.appendChild(sidebar);
        mainContent.appendChild(canvasContainer);

        wrapper.appendChild(toolbar);
        wrapper.appendChild(mainContent); // New wrapper structure

        shadow.appendChild(wrapper);
        this.overlay = container;
        this.shadowRoot = shadow;

        // Event Listeners
        shadow.getElementById('btn-undo').onclick = () => this.undo();
        shadow.getElementById('btn-reset').onclick = () => { this.userRects = []; this.draw(); };
        shadow.getElementById('btn-cancel').onclick = () => this.close(false);
        shadow.getElementById('btn-save').onclick = () => this.close(true);

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        // Global mouseup to catch drag exits
        window.addEventListener('mouseup', () => { if (this.isDrawing) this.onMouseUp(); });
    }

    initCanvas() {
        // Set canvas to full image resolution
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.ctx = this.canvas.getContext('2d');

        // Fit to screen logic
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8;

        const scaleX = maxWidth / this.image.width;
        const scaleY = maxHeight / this.image.height;
        this.scale = Math.min(scaleX, scaleY, 1); // Never scale up, only down

        this.canvas.style.width = `${this.image.width * this.scale}px`;
        this.canvas.style.height = `${this.image.height * this.scale}px`;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Map client coord to canvas coord
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPos = this.getMousePos(e);
        this.currentRect = { x: this.startPos.x, y: this.startPos.y, w: 0, h: 0 };

        // Check click on hint for sidebar scroll
        if (this.ocrMatches) {
            const clickX = this.startPos.x;
            const clickY = this.startPos.y;

            const clickedIndex = this.ocrMatches.findIndex(m =>
                m.bbox && clickX >= m.bbox.x0 && clickX <= m.bbox.x1 &&
                clickY >= m.bbox.y0 && clickY <= m.bbox.y1
            );

            if (clickedIndex !== -1 && this.shadowRoot) {
                const item = this.shadowRoot.querySelector(`.pii-item[data-index="${clickedIndex}"]`);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.style.background = '#444'; // Flash highlight
                    setTimeout(() => item.style.background = '#333', 300);
                }
            }
        }
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        const pos = this.getMousePos(e);
        this.currentRect.w = pos.x - this.startPos.x;
        this.currentRect.h = pos.y - this.startPos.y;
        this.draw();
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Normalize rect (handle neg width/height)
        const normalize = (r) => {
            let x = r.w < 0 ? r.x + r.w : r.x;
            let y = r.h < 0 ? r.y + r.h : r.y;
            let w = Math.abs(r.w);
            let h = Math.abs(r.h);
            return { x, y, w, h };
        };

        const finalRect = normalize(this.currentRect);

        // Ignore tiny accidental clicks
        if (finalRect.w > 5 && finalRect.h > 5) {
            this.userRects.push(finalRect);
        }

        this.currentRect = null;
        this.draw();
    }

    undo() {
        this.userRects.pop();
        this.draw();
    }

    draw() {
        const ctx = this.ctx;

        // 1. Draw Image
        ctx.drawImage(this.image, 0, 0);

        // 2. Draw OCR Hints (Yellow)
        // Pulsate effect: sin wave over time
        const time = Date.now() / 500;
        const alpha = 0.3 + (Math.sin(time) * 0.1); // Oscillate between 0.2 and 0.4

        if (this.ocrMatches) {
            this.ctx.lineWidth = 3;

            // Track coverage for sidebar update
            const newCoveredIndices = new Set();

            this.ocrMatches.forEach((match, i) => {
                if (match.bbox) {
                    const { x0, y0, x1, y1 } = match.bbox;
                    // Check if this hint is "covered" by a user rect
                    const isCovered = this.userRects.some(r =>
                        // Simple AABB collision detection
                        x0 < r.x + r.w &&
                        x1 > r.x &&
                        y0 < r.y + r.h &&
                        y1 > r.y
                    );

                    if (isCovered) {
                        newCoveredIndices.add(i);
                        // Resolved checkmark or green box
                        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'; // Emerald-500
                        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                        this.ctx.strokeStyle = '#10b981';
                        this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                    } else {
                        // Pending Yellow Hint
                        this.ctx.strokeStyle = `rgba(255, 193, 7, 0.8)`; // Amber-500
                        this.ctx.fillStyle = `rgba(255, 193, 7, ${alpha})`;

                        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                        this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

                        // Label Index (e.g. #1)
                        this.ctx.fillStyle = 'black';
                        this.ctx.fillRect(x0, y0 - 14, 20, 14);
                        this.ctx.fillStyle = '#EAB308';
                        this.ctx.font = 'bold 10px monospace';
                        this.ctx.fillText(`#${i + 1}`, x0 + 2, y0 - 4);
                    }
                }
            });

            // Efficient DOM Update
            if (this.shadowRoot) {
                // If coverage changed
                const currentIndices = Array.from(newCoveredIndices).sort().join(',');
                if (this.lastCoveredIndices !== currentIndices) {
                    this.lastCoveredIndices = currentIndices;

                    // Update all items
                    const items = this.shadowRoot.querySelectorAll('.pii-item');
                    items.forEach(item => {
                        const index = parseInt(item.dataset.index, 10);
                        if (newCoveredIndices.has(index)) {
                            item.style.borderLeft = '3px solid #10b981'; // Green
                            item.style.opacity = '0.6';
                            item.querySelector('.status-text').innerHTML = '✅ REDACTED';
                            item.querySelector('.status-text').style.color = '#10b981';
                        } else {
                            item.style.borderLeft = '3px solid #EAB308'; // Yellow
                            item.style.opacity = '1';
                            // Restore original text based on bbox presence
                            const hasBbox = this.ocrMatches[index].bbox;
                            item.querySelector('.status-text').innerHTML = hasBbox
                                ? '📍 Location valid'
                                : '⚠️ Location missing';
                            item.querySelector('.status-text').style.color = hasBbox ? '#EAB308' : '#ef4444';
                        }
                    });
                }
            }

            // Constant redraw for pulsate
            if (!this.isDrawing) requestAnimationFrame(() => this.draw());
        }

        // 3. Draw User Rects (Black)
        ctx.fillStyle = 'black';
        this.userRects.forEach(r => {
            ctx.fillRect(r.x, r.y, r.w, r.h);
        });

        // 4. Draw Current Drag (Red outline)
        if (this.isDrawing && this.currentRect) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.currentRect.x, this.currentRect.y, this.currentRect.w, this.currentRect.h);
        }
    }

    close(save) {
        if (save) {
            // Generate Blob
            this.canvas.toBlob((blob) => {
                const newFile = new File([blob], `redacted_${this.originalFile.name}`, { type: this.originalFile.type });
                this.resolvePromise(newFile);
            }, this.originalFile.type);
        } else {
            // Cancel -> Reject or Resolve with original?
            // Resolve with original implies "Proceed without masking".
            // Reject implies "Cancel upload".
            // Let's resolve with specific signal or just null?
            // Actually, if they cancel the mask tool, they probably just want to go back.
            // But this interface is modal. Let's rejecting to stop upload is safest.
            this.rejectPromise(new Error('User cancelled masking'));
        }

        // Cleanup DOM
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
