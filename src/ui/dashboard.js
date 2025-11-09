import { getStats } from '../utils/storage.js';

async function init() {
  const stats = await getStats();

  document.getElementById('totalDetections').textContent = stats.totalDetections || 0;
  document.getElementById('totalMasked').textContent = stats.totalMasked || 0;
  document.getElementById('totalBlocked').textContent = stats.totalBlocked || 0;

  const detectionsByTypeDiv = document.getElementById('detectionsByType');
  const types = stats.detectionsByType || {};

  if (Object.keys(types).length === 0) {
    detectionsByTypeDiv.innerHTML = '<p style="color: #666;">No detections yet</p>';
  } else {
    let html = '<ul style="list-style: none; padding: 0;">';
    for (const [type, count] of Object.entries(types)) {
      html += `<li style="padding: 8px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between;">
        <span>${type}</span>
        <strong>${count}</strong>
      </li>`;
    }
    html += '</ul>';
    detectionsByTypeDiv.innerHTML = html;
  }

  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
}

document.addEventListener('DOMContentLoaded', init);
