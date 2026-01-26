/**
 * Dashboard Logic
 */

import { getStats } from '../utils/storage.js';

// DOM Elements
const elements = {
  totalDetections: document.getElementById('totalDetections'),
  totalMasked: document.getElementById('totalMasked'),
  totalBlocked: document.getElementById('totalBlocked'),
  chartContainer: document.getElementById('chartContainer'),
  noDataMessage: document.getElementById('noDataMessage'),
  navItems: document.querySelectorAll('.nav-item')
};

/**
 * Initialize Dashboard
 */
async function init() {
  try {
    const stats = await getStats();
    renderStats(stats);
    renderChart(stats.detectionsByType || {});
    setupNavigation();
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

/**
 * Render Header Stats
 */
function renderStats(stats) {
  animateValue(elements.totalDetections, 0, stats.totalDetections || 0, 1000);
  animateValue(elements.totalMasked, 0, stats.totalMasked || 0, 1000);
  animateValue(elements.totalBlocked, 0, stats.totalBlocked || 0, 1000);
}

/**
 * Animate number counting
 */
function animateValue(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

/**
 * Render CSS Bar Chart for Detections by Type
 */
function renderChart(typeCounts) {
  // Sort by count descending
  const sortedTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5

  if (sortedTypes.length === 0) {
    elements.noDataMessage.style.display = 'block';
    return;
  }

  elements.noDataMessage.style.display = 'none';
  const maxCount = sortedTypes[0][1];

  let html = '';
  sortedTypes.forEach(([type, count]) => {
    // Calculate percentage for bar width (min 5% so it shows)
    const percentage = Math.max((count / maxCount) * 100, 5);
    // Nicer Labels
    const label = formatLabel(type);

    html += `
      <div class="chart-item">
        <div class="chart-label">${label}</div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="chart-value">${count}</div>
      </div>
    `;
  });

  elements.chartContainer.innerHTML = html;
}

/**
 * Format type keys to readable labels
 */
function formatLabel(key) {
  const map = {
    'creditCard': 'Credit Card',
    'bankAccount': 'Bank Account',
    'ssn': 'SSN',
    'phone': 'Phone',
    'email': 'Email',
    'aadhaar': 'Aadhaar',
    'gst': 'GST Number',
    'pan': 'PAN Card',
    'ipAddress': 'IP Address'
  };
  return map[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/**
 * Setup basic navigation interactions
 */
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all
      elements.navItems.forEach(nav => nav.classList.remove('active'));
      // Add to clicked
      item.classList.add('active');
    });
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
