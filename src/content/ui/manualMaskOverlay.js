/**
 * Manual Masking Overlay UI
 * Allows users to manually draw redaction boxes on an image.
 */

import { DESIGN_SYSTEM_CSS } from './designSystem.js';

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
            ${DESIGN_SYSTEM_CSS}

            :host { 
                font-family: var(--font-sans);
            }
            .overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: var(--color-bg-primary); 
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: var(--color-text-primary);
            }
            .toolbar {
                background: var(--color-bg-surface); 
                border-bottom: 1px solid var(--color-bg-hover);
                color: var(--color-text-primary); 
                padding: 12px 24px; 
                margin-bottom: 0; /* Full width toolbar? */
                width: 100%;
                display: flex; gap: 12px; align-items: center;
                box-sizing: border-box;
                box-shadow: var(--shadow-sm);
            }

            button {
                background: transparent; 
                border: 1px solid var(--color-bg-hover);
                color: var(--color-text-secondary);
                padding: 8px 16px;
                border-radius: var(--radius-sm);
                cursor: pointer; 
                font-family: var(--font-sans); 
                font-weight: 500;
                font-size: 13px;
                transition: all 0.2s;
                display: flex; align-items: center; gap: 6px;
            }
            button:hover { 
                background: var(--color-bg-hover); 
                color: var(--color-text-primary); 
            }
            
            button.primary { 
                background: var(--color-primary);
                border-color: var(--color-primary);
                color: #fff;
                font-weight: 600;
            }
            button.primary:hover { 
                background: var(--color-primary-hover);
            }
            
            button.danger {
                border-color: transparent;
                color: var(--color-danger);
            }
            button.danger:hover {
                background: rgba(244, 63, 94, 0.1);
            }

            .main-area {
                display: flex; flex: 1; width: 100%; overflow: hidden; 
                padding: 20px; box-sizing: border-box; gap: 20px;
            }

            .canvas-container {
                border: 1px solid var(--color-bg-hover);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-lg);
                max-width: 100%; max-height: 100%;
                overflow: auto;
                cursor: crosshair;
                background: #000; /* Dark bg for image */
                position: relative;
                flex: 1;
                display: flex; align-items: center; justify-content: center;
            }
            
            .sidebar {
                width: 300px; 
                background: var(--color-bg-surface); 
                border: 1px solid var(--color-bg-hover);
                border-radius: var(--radius-md);
                padding: 16px; 
                display: flex; flex-direction: column; 
                overflow-y: auto; 
                color: var(--color-text-primary);
                box-shadow: var(--shadow-sm);
            }

            .sidebar h3 {
                margin: 0 0 16px 0; font-size: 14px; font-weight: 600; 
                color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;
            }

            .pii-item {
                margin-bottom: 8px; padding: 12px; 
                border: 1px solid var(--color-bg-hover);
                border-radius: var(--radius-sm);
                background: var(--color-bg-primary);
                transition: all 0.1s;
            }
            .pii-item:hover {
                border-color: var(--color-text-muted);
                cursor: pointer;
            }
            
            .pii-type-badge {
                font-size: 10px; font-weight: 700; 
                background: var(--color-bg-hover); color: var(--color-text-secondary);
                padding: 2px 6px; border-radius: 4px;
                display: inline-block; margin-bottom: 4px;
            }
            
            .status-text {
                font-size: 11px; font-weight: 600; margin-top: 4px;
            }
            
            /* Scrollbar */
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: var(--color-bg-hover); border-radius: 4px; }
        `;
        shadow.appendChild(style);

        // DOM Structure
        const wrapper = document.createElement('div');
        wrapper.className = 'overlay';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.innerHTML = `
            <div style="font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
                   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Redaction Studio
            </div>
            <div style="flex: 1;"></div>
            <button id="btn-undo" title="Undo Last Box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                Undo
            </button>
            <button id="btn-reset" title="Clear All">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reset
            </button>
            <div style="width: 1px; background: var(--color-bg-hover); margin: 0 8px; height: 24px;"></div>
            <button id="btn-cancel" class="danger">Cancel</button>
            <button id="btn-save" class="primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                Apply Masks
            </button>
        `;

        // Main Content Area (Sidebar + Canvas)
        const mainContent = document.createElement('div');
        mainContent.className = 'main-area';

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
            <h3>Detected Items</h3>
            <div id="sidebar-items-container">
               <!-- Items injected here -->
            </div>
        `;

        // Canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';

        this.canvas = document.createElement('canvas');
        canvasContainer.appendChild(this.canvas);

        mainContent.appendChild(sidebar);
        mainContent.appendChild(canvasContainer);

        wrapper.appendChild(toolbar);
        wrapper.appendChild(mainContent);

        shadow.appendChild(wrapper);
        this.overlay = container;
        this.shadowRoot = shadow;

        // Populate Sidebar Items
        this.renderSidebarItems();

        // Event Listeners
        shadow.getElementById('btn-undo').onclick = () => this.undo();
        shadow.getElementById('btn-reset').onclick = () => { this.userRects = []; this.draw(); };
        shadow.getElementById('btn-cancel').onclick = () => this.close(false);
        shadow.getElementById('btn-save').onclick = () => this.close(true);

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('mouseup', () => { if (this.isDrawing) this.onMouseUp(); });
    }

    renderSidebarItems() {
        const container = this.shadowRoot.getElementById('sidebar-items-container');
        if (!container) return;

        if (this.ocrMatches && this.ocrMatches.length > 0) {
            container.innerHTML = this.ocrMatches.map((m, i) => `
                <div class="pii-item" data-index="${i}">
                    <span class="pii-type-badge">${m.type.toUpperCase()}</span>
                    <div style="font-size: 13px; word-break: break-all; color: var(--color-text-secondary); margin-bottom: 4px;">${m.value}</div>
                    <div class="status-text" style="color: ${m.bbox ? 'var(--color-warning)' : 'var(--color-danger)'};">
                        ${m.bbox ? '📍 Location Found' : '⚠️ Location Missing'}
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div style="color: var(--color-text-muted); font-style: italic; font-size: 13px;">No sensitive items detected.</div>';
        }
    }

    initCanvas() {
        // Set canvas to full image resolution
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.ctx = this.canvas.getContext('2d');

        // Fit to screen logic
        const maxWidth = window.innerWidth * 0.8; // Leave room for sidebar
        const maxHeight = window.innerHeight * 0.8;

        const scaleX = maxWidth / this.image.width;
        const scaleY = maxHeight / this.image.height;
        this.scale = Math.min(scaleX, scaleY, 1); // Never scale up

        this.canvas.style.width = `${this.image.width * this.scale}px`;
        this.canvas.style.height = `${this.image.height * this.scale}px`;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPos = this.getMousePos(e);
        this.currentRect = { x: this.startPos.x, y: this.startPos.y, w: 0, h: 0 };

        // Sidebar click interaction
        if (this.ocrMatches && this.shadowRoot) {
            const clickX = this.startPos.x;
            const clickY = this.startPos.y;

            const clickedIndex = this.ocrMatches.findIndex(m =>
                m.bbox && clickX >= m.bbox.x0 && clickX <= m.bbox.x1 &&
                clickY >= m.bbox.y0 && clickY <= m.bbox.y1
            );

            if (clickedIndex !== -1) {
                const item = this.shadowRoot.querySelector(`.pii-item[data-index="${clickedIndex}"]`);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.style.borderColor = 'var(--color-primary)';
                    setTimeout(() => item.style.borderColor = 'var(--color-bg-hover)', 500);
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

        const normalize = (r) => {
            let x = r.w < 0 ? r.x + r.w : r.x;
            let y = r.h < 0 ? r.y + r.h : r.y;
            let w = Math.abs(r.w);
            let h = Math.abs(r.h);
            return { x, y, w, h };
        };

        const finalRect = normalize(this.currentRect);

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
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this.image, 0, 0);

        // 2. Draw OCR Hints
        if (this.ocrMatches) {
            this.ctx.lineWidth = 3;
            const newCoveredIndices = new Set();

            this.ocrMatches.forEach((match, i) => {
                if (match.bbox) {
                    const { x0, y0, x1, y1 } = match.bbox;
                    const isCovered = this.userRects.some(r =>
                        x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y
                    );

                    if (isCovered) {
                        newCoveredIndices.add(i);
                        // Redacted state (Emerald fill)
                        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.6)'; // Emerald 500 alpha
                        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                        this.ctx.strokeStyle = '#10b981'; // Emerald 500
                        this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                    } else {
                        // Pending state (Amber outline)
                        this.ctx.strokeStyle = '#f59e0b'; // Amber 500
                        this.ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
                        this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

                        // Label
                        this.ctx.fillStyle = '#f59e0b';
                        this.ctx.font = 'bold 12px system-ui';
                        this.ctx.fillText(`#${i + 1}`, x0, y0 - 4);
                    }
                }
            });

            // Update DOM state
            if (this.shadowRoot) {
                const currentIndices = Array.from(newCoveredIndices).sort().join(',');
                if (this.lastCoveredIndices !== currentIndices) {
                    this.lastCoveredIndices = currentIndices;
                    const items = this.shadowRoot.querySelectorAll('.pii-item');
                    items.forEach(item => {
                        const index = parseInt(item.dataset.index, 10);
                        if (newCoveredIndices.has(index)) {
                            item.style.borderLeft = '3px solid var(--color-primary)';
                            item.style.opacity = '0.5';
                            item.querySelector('.status-text').innerHTML = '✅ Covered';
                            item.querySelector('.status-text').style.color = 'var(--color-primary)';
                        } else {
                            item.style.borderLeft = '3px solid var(--color-warning)';
                            item.style.opacity = '1';
                            const hasBbox = this.ocrMatches[index].bbox;
                            item.querySelector('.status-text').innerHTML = hasBbox ? '📍 Needs Masking' : '⚠️ Location Missing';
                            item.querySelector('.status-text').style.color = hasBbox ? 'var(--color-warning)' : 'var(--color-danger)';
                        }
                    });
                }
            }
        }

        // 3. Draw User Rects (Black/Dark Slate)
        ctx.fillStyle = '#0f172a'; // Slate 950
        this.userRects.forEach(r => {
            ctx.fillRect(r.x, r.y, r.w, r.h);
            // Add subtle border to black boxes so they are visible on dark images
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
        });

        // 4. Draw Current Drag (White outline)
        if (this.isDrawing && this.currentRect) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.currentRect.x, this.currentRect.y, this.currentRect.w, this.currentRect.h);
        }
    }

    close(save) {
        if (save) {
            this.canvas.toBlob((blob) => {
                const newFile = new File([blob], `redacted_${this.originalFile.name}`, { type: this.originalFile.type });
                this.resolvePromise(newFile);
            }, this.originalFile.type);
        } else {
            this.rejectPromise(new Error('User cancelled masking'));
        }

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
