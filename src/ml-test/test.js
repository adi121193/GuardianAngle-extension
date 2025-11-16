/**
 * ML Test Page Script
 * Tests the NER model loading and inference
 */

import { offscreenManager } from '../ml/offscreenManager.js';

// DOM elements
const initBtn = document.getElementById('initBtn');
const runBtn = document.getElementById('runBtn');
const statusBtn = document.getElementById('statusBtn');
const testInput = document.getElementById('testInput');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const entitiesDiv = document.getElementById('entities');
const performanceDiv = document.getElementById('performance');

// State
let isModelReady = false;

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusDiv.style.display = 'block';
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
}

/**
 * Show loading state
 */
function setLoading(button, loading) {
  button.disabled = loading;
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'loading';
    button.appendChild(spinner);
  } else {
    const spinner = button.querySelector('.loading');
    if (spinner) {
      spinner.remove();
    }
  }
}

/**
 * Initialize model
 */
async function initializeModel() {
  console.log('Initializing model...');
  showStatus('Initializing NER model...', 'info');
  setLoading(initBtn, true);

  try {
    const result = await offscreenManager.initializeModel();

    if (result.success) {
      isModelReady = true;
      runBtn.disabled = false;
      showStatus(`Model initialized successfully in ${result.initTimeMs.toFixed(0)}ms`, 'success');
    } else {
      showStatus(`Model initialization failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(initBtn, false);
  }
}

/**
 * Run inference
 */
async function runInference() {
  const text = testInput.value.trim();

  if (!text) {
    showStatus('Please enter some text', 'error');
    return;
  }

  console.log('Running inference...');
  showStatus('Running NER inference...', 'info');
  setLoading(runBtn, true);

  try {
    const result = await offscreenManager.runInference(text);

    if (result.success) {
      displayResults(result.entities, result.performance);
      showStatus(`Found ${result.entities.length} entities in ${result.performance.total.toFixed(0)}ms`, 'success');
    } else {
      showStatus(`Inference failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Inference error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(runBtn, false);
  }
}

/**
 * Check status
 */
async function checkStatus() {
  console.log('Checking status...');
  setLoading(statusBtn, true);

  try {
    const result = await offscreenManager.getStatus();

    if (result.success) {
      const status = result.isReady ? 'Ready ✅' :
                    result.isInitializing ? 'Initializing...' :
                    'Not initialized';
      showStatus(`Model status: ${status}`, result.isReady ? 'success' : 'info');

      if (result.isReady) {
        isModelReady = true;
        runBtn.disabled = false;
      }
    } else {
      showStatus('Failed to get status', 'error');
    }
  } catch (error) {
    console.error('Status error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    setLoading(statusBtn, false);
  }
}

/**
 * Display results
 */
function displayResults(entities, performance) {
  // Show results section
  resultsDiv.style.display = 'block';

  // Clear previous results
  entitiesDiv.innerHTML = '';

  if (entities.length === 0) {
    entitiesDiv.innerHTML = '<p style="color: #6b7280;">No entities detected</p>';
  } else {
    entities.forEach(entity => {
      const badge = document.createElement('span');
      badge.className = `entity entity-${entity.type}`;
      badge.textContent = `${entity.text} (${entity.type})`;
      badge.title = `Score: ${entity.score.toFixed(3)}`;
      entitiesDiv.appendChild(badge);
    });
  }

  // Show performance
  if (performance) {
    performanceDiv.style.display = 'block';
    performanceDiv.innerHTML = `
      Performance Metrics:
      - Total: ${performance.total.toFixed(2)}ms
      - Inference: ${performance.inference.toFixed(2)}ms
      - Tokenization: ${(performance.total - performance.inference).toFixed(2)}ms
    `;
  }
}

// Event listeners
initBtn.addEventListener('click', initializeModel);
runBtn.addEventListener('click', runInference);
statusBtn.addEventListener('click', checkStatus);

// Allow Enter key in textarea to run inference
testInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey && isModelReady) {
    runInference();
  }
});

console.log('ML Test page loaded');
showStatus('Click "Initialize Model" to start', 'info');
