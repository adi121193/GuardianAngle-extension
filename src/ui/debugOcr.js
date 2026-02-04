// Debug Dashboard Logic

const logs = document.getElementById('logs');
const statusSw = document.getElementById('status-sw');
const statusOffscreen = document.getElementById('status-offscreen');
const statusOcr = document.getElementById('status-ocr');

// Log formatter
function addLog(source, type, message, data) {
    const time = new Date().toLocaleTimeString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    const color = type === 'error' ? '#ff5252' : (type === 'warn' ? '#ffb74d' : '#69f0ae');

    logs.innerHTML += `<div style="margin-bottom: 4px;">
        <span style="color: #888;">[${time}]</span> 
        <span style="color: ${color}; font-weight: bold;">[${source}]</span> 
        ${message}
        <span style="color: #ccc;">${dataStr}</span>
    </div>`;
    logs.scrollTop = logs.scrollHeight;
}

// 1. Listen for logs from Background/Offscreen
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'DEBUG_LOG') {
        addLog(message.source, message.level, message.message, message.data);
    }
});

// 2. Check Service Worker Health
async function checkServiceWorker() {
    try {
        await chrome.runtime.sendMessage({ type: 'PING' });
        statusSw.className = 'status-indicator status-ok';
        addLog('Dashboard', 'info', 'Service Worker connection established');
    } catch (e) {
        statusSw.className = 'status-indicator status-error';
        addLog('Dashboard', 'error', 'Service Worker not responding', e.message);
    }
}

// 3. Test Pipeline
document.getElementById('imageInput').addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];

    addLog('Dashboard', 'info', 'Starting Pipeline Test...');
    addLog('Dashboard', 'info', 'Converting image to DataURL...');

    // Convert to DataURL
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const dataURL = reader.result;
            addLog('Dashboard', 'info', 'Sending to Background Service Worker...');

            // Send to Background -> Offscreen
            const response = await chrome.runtime.sendMessage({
                type: 'RUN_OCR_INFERENCE',
                image: dataURL
            });

            if (response.success) {
                statusOffscreen.className = 'status-indicator status-ok';
                statusOcr.className = 'status-indicator status-ok';
                addLog('Dashboard', 'info', 'SUCCESS: Pipeline returned results', {
                    matches: response.count,
                    piiDetected: response.piiDetected
                });

                if (response.text) {
                    addLog('Dashboard', 'info', 'Extracted Sample:', response.text.substring(0, 100) + '...');
                }

            } else {
                statusOffscreen.className = 'status-indicator status-warn';
                addLog('Dashboard', 'error', 'FAILED: Pipeline returned error', response.error);

                // --- CRITICAL DEBUG: Try to reproduce the OFFSCREEN failure locally ---
                addLog('Dashboard', 'warn', 'Attempting to reproduce failure locally (Simulation)...');

                try {
                    if (!window.Tesseract) {
                        throw new Error('window.Tesseract is missing! Script tag failed to load Tesseract global.');
                    }
                    addLog('Dashboard', 'info', 'window.Tesseract is present.');

                    const workerPath = chrome.runtime.getURL('ocr/worker.min.js');
                    const corePath = chrome.runtime.getURL('ocr/tesseract-core.wasm.js');

                    addLog('Dashboard', 'info', 'Test Paths:', { workerPath, corePath });

                    try {
                        await fetch(workerPath);
                        addLog('Dashboard', 'info', 'Worker file reachable');
                    } catch (e) { throw new Error('Worker file 404'); }

                } catch (simError) {
                    addLog('Dashboard', 'error', 'REPRODUCTION SUCCESS: Local check failed too', simError.message);
                }
            }

        } catch (err) {
            addLog('Dashboard', 'error', 'CRITICAL: Test failed', err.message);
        }
    };
    reader.readAsDataURL(file);
});

// Initialization
addLog('Dashboard', 'info', 'Dashboard initialized. Waiting for signals...');
checkServiceWorker();
