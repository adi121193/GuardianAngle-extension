import { imageDetector } from '../detection/imageDetector.js';

const logs = document.getElementById('logs');
const status = document.getElementById('status');

// Override console.log/error to show on page
const originalLog = console.log;
const originalError = console.error;
const originalDebug = console.debug;

function logToScreen(type, args) {
    const msg = args.map(a => {
        if (a instanceof Error) return a.stack;
        if (typeof a === 'object') return JSON.stringify(a, null, 2);
        return String(a);
    }).join(' ');
    logs.innerHTML += `[${type}] ${msg}\n`;
    logs.scrollTop = logs.scrollHeight;
}

console.log = (...args) => { originalLog(...args); logToScreen('LOG', args); };
console.error = (...args) => { originalError(...args); logToScreen('ERR', args); };
console.debug = (...args) => { originalDebug(...args); logToScreen('DBG', args); };

async function checkFile(url, name) {
    try {
        console.log(`Checking ${name}: ${url}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const blob = await res.blob();
        console.log(`${name} OK - Size: ${blob.size} bytes`);
        return true;
    } catch (e) {
        console.error(`FAILED to fetch ${name}:`, e);
        return false;
    }
}

document.getElementById('imageInput').addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;

    const file = e.target.files[0];
    status.textContent = 'Status: Processing...';
    status.style.background = '#e3f2fd';

    try {
        // Pre-flight check for files
        const workerPath = chrome.runtime.getURL('ocr/worker.min.js');
        const corePath = chrome.runtime.getURL('ocr/tesseract-core.wasm.js');
        const langPath = chrome.runtime.getURL('models/ocr/eng.traineddata.gz');

        await checkFile(workerPath, 'Worker JS');
        await checkFile(corePath, 'Core JS');
        await checkFile(langPath, 'Lang Data');

        console.log('Starting detection...');
        const result = await imageDetector.detect(file);

        if (result.piiDetected) {
            status.textContent = `Status: PII DETECTED! (${result.count} matches)`;
            status.style.background = '#ffcdd2';
        } else if (result.error) {
            status.textContent = `Status: ERROR - ${result.error}`;
            status.style.background = '#ffcc80';
        } else {
            status.textContent = 'Status: Clean (No PII)';
            status.style.background = '#c8e6c9';
        }

        console.log('Full Result:', result);
    } catch (err) {
        console.error('Fatal error:', err);
        status.textContent = 'Status: CRASHED';
        status.style.background = 'red';
    }
});
