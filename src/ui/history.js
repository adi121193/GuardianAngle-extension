/**
 * Detection History Page Script
 * Manages the full-page detection history interface with filtering, search, export, and pagination
 */

import { getDetectionHistory, clearHistory, getStats } from '../utils/storage.js';

// State management
let currentPage = 1;
const itemsPerPage = 20;
let currentFilters = {
  platform: '',
  riskLevel: '',
  action: '',
  dateRange: '',
  search: ''
};
let allHistory = [];
let filteredHistory = [];

// DOM Elements - cached for performance
let historyTable;
let emptyState;
let totalEvents;
let criticalCount;
let highCount;
let blockedCount;
let platformFilter;
let riskFilter;
let actionFilter;
let dateFilter;
let searchInput;
let resetFiltersBtn;
let exportBtn;
let clearHistoryBtn;
let backBtn;
let prevPageBtn;
let nextPageBtn;
let pageInfo;
let showingCount;
let totalCount;
let paginationSection;
let confirmModal;
let confirmClearBtn;
let cancelClearBtn;

/**
 * Initialize the history page
 * Sets up DOM references, attaches event listeners, and loads initial data
 */
async function init() {
  try {
    // Cache DOM elements for better performance
    historyTable = document.getElementById('historyTable');
    emptyState = document.getElementById('emptyState');
    totalEvents = document.getElementById('totalEvents');
    criticalCount = document.getElementById('criticalCount');
    highCount = document.getElementById('highCount');
    blockedCount = document.getElementById('blockedCount');
    platformFilter = document.getElementById('platformFilter');
    riskFilter = document.getElementById('riskFilter');
    actionFilter = document.getElementById('actionFilter');
    dateFilter = document.getElementById('dateFilter');
    searchInput = document.getElementById('searchInput');
    resetFiltersBtn = document.getElementById('resetFiltersBtn');
    exportBtn = document.getElementById('exportBtn');
    clearHistoryBtn = document.getElementById('clearHistoryBtn');
    backBtn = document.getElementById('backBtn');
    prevPageBtn = document.getElementById('prevPageBtn');
    nextPageBtn = document.getElementById('nextPageBtn');
    pageInfo = document.getElementById('pageInfo');
    showingCount = document.getElementById('showingCount');
    totalCount = document.getElementById('totalCount');
    paginationSection = document.getElementById('paginationSection');
    confirmModal = document.getElementById('confirmModal');
    confirmClearBtn = document.getElementById('confirmClearBtn');
    cancelClearBtn = document.getElementById('cancelClearBtn');

    // Attach event listeners
    attachEventListeners();

    // Load and display history data
    await loadHistory();
  } catch (error) {
    console.error('Failed to initialize history page:', error);
    showError('Failed to initialize page. Please try refreshing.');
  }
}

/**
 * Attach event listeners to all interactive elements
 */
function attachEventListeners() {
  // Filter change listeners - update filters and reapply
  platformFilter.addEventListener('change', () => {
    currentFilters.platform = platformFilter.value;
    applyFilters();
  });

  riskFilter.addEventListener('change', () => {
    currentFilters.riskLevel = riskFilter.value;
    applyFilters();
  });

  actionFilter.addEventListener('change', () => {
    currentFilters.action = actionFilter.value;
    applyFilters();
  });

  dateFilter.addEventListener('change', () => {
    currentFilters.dateRange = dateFilter.value;
    applyFilters();
  });

  // Search input with debouncing for better performance
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilters.search = searchInput.value.toLowerCase().trim();
      applyFilters();
    }, 300); // 300ms debounce
  });

  // Reset filters button
  resetFiltersBtn.addEventListener('click', resetFilters);

  // Action buttons
  exportBtn.addEventListener('click', exportToCSV);
  clearHistoryBtn.addEventListener('click', showClearConfirmation);
  backBtn.addEventListener('click', () => window.close());

  // Pagination controls
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      scrollToTop();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      scrollToTop();
    }
  });

  // Modal controls
  confirmClearBtn.addEventListener('click', confirmClearHistory);
  cancelClearBtn.addEventListener('click', hideClearConfirmation);

  // Close modal on background click
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      hideClearConfirmation();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key closes modal
    if (e.key === 'Escape' && confirmModal.style.display === 'flex') {
      hideClearConfirmation();
    }

    // Ctrl/Cmd + K focuses search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/**
 * Load detection history from storage
 * Fetches all history and initializes the display
 */
async function loadHistory() {
  try {
    // Get all history (up to 1000 most recent events)
    allHistory = await getDetectionHistory({ limit: 1000 });

    // Sort by timestamp descending (most recent first)
    allHistory.sort((a, b) => b.timestamp - a.timestamp);

    // Initialize filtered history
    filteredHistory = [...allHistory];

    // Update statistics display
    updateStats();

    // Apply any active filters and render
    applyFilters();
  } catch (error) {
    console.error('Failed to load history:', error);
    showError('Failed to load detection history.');
  }
}

/**
 * Update the statistics summary cards
 * Calculates and displays total events, critical/high counts, and blocked count
 */
function updateStats() {
  totalEvents.textContent = allHistory.length;

  // Count events by risk level
  const critical = allHistory.filter(e => e.riskLevel === 'critical').length;
  const high = allHistory.filter(e => e.riskLevel === 'high').length;

  // Count blocked events
  const blocked = allHistory.filter(e => e.userAction === 'blocked').length;

  criticalCount.textContent = critical;
  highCount.textContent = high;
  blockedCount.textContent = blocked;
}

/**
 * Apply all active filters to the history
 * Filters data by platform, risk level, action, date range, and search term
 */
function applyFilters() {
  filteredHistory = allHistory.filter(event => {
    // Platform filter
    if (currentFilters.platform && event.platform !== currentFilters.platform) {
      return false;
    }

    // Risk level filter
    if (currentFilters.riskLevel && event.riskLevel !== currentFilters.riskLevel) {
      return false;
    }

    // Action filter
    if (currentFilters.action && event.userAction !== currentFilters.action) {
      return false;
    }

    // Date range filter
    if (currentFilters.dateRange) {
      const now = Date.now();
      const eventDate = event.timestamp;

      switch (currentFilters.dateRange) {
        case 'today':
          // From start of current day
          const startOfDay = new Date().setHours(0, 0, 0, 0);
          if (eventDate < startOfDay) return false;
          break;
        case 'week':
          // Last 7 days
          if (eventDate < now - 7 * 24 * 60 * 60 * 1000) return false;
          break;
        case 'month':
          // Last 30 days
          if (eventDate < now - 30 * 24 * 60 * 60 * 1000) return false;
          break;
      }
    }

    // Search filter - searches across platform, PII types, action, and excerpt
    if (currentFilters.search) {
      const searchTerm = currentFilters.search;
      const searchable = [
        event.platform,
        event.piiTypes.join(' '),
        event.userAction,
        event.riskLevel,
        event.excerpt || ''
      ].join(' ').toLowerCase();

      if (!searchable.includes(searchTerm)) return false;
    }

    return true;
  });

  // Reset to first page when filters change
  currentPage = 1;

  // Render the filtered results
  renderTable();
}

/**
 * Reset all filters to default state
 * Clears all filter selections and search input
 */
function resetFilters() {
  platformFilter.value = '';
  riskFilter.value = '';
  actionFilter.value = '';
  dateFilter.value = '';
  searchInput.value = '';

  currentFilters = {
    platform: '',
    riskLevel: '',
    action: '',
    dateRange: '',
    search: ''
  };

  applyFilters();
}

/**
 * Render the history table with current page data
 * Handles pagination, empty states, and table generation
 */
function renderTable() {
  // Handle empty state
  if (filteredHistory.length === 0) {
    historyTable.style.display = 'none';
    emptyState.style.display = 'flex';
    paginationSection.style.display = 'none';
    return;
  }

  // Show table and pagination
  historyTable.style.display = 'block';
  emptyState.style.display = 'none';
  paginationSection.style.display = 'flex';

  // Calculate pagination boundaries
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageEvents = filteredHistory.slice(start, end);

  // Generate table HTML
  const tableHTML = `
    <table class="events-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Platform</th>
          <th>PII Types</th>
          <th>Risk</th>
          <th>Action</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${pageEvents.map(event => createTableRow(event)).join('')}
      </tbody>
    </table>
  `;

  historyTable.innerHTML = tableHTML;

  // Update pagination information
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  showingCount.textContent = Math.min(end, filteredHistory.length) - start;
  totalCount.textContent = filteredHistory.length;

  // Update pagination button states
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

/**
 * Create a table row for a detection event
 * @param {Object} event - Detection event object
 * @returns {string} HTML string for table row
 */
function createTableRow(event) {
  const timeStr = formatTimestamp(event.timestamp);
  const riskClass = event.riskLevel;
  const actionIcon = getActionIcon(event.userAction);

  return `
    <tr class="event-row" data-risk="${riskClass}">
      <td class="time-cell">
        <div class="time-display">
          <span class="time-main">${timeStr.main}</span>
          <span class="time-sub">${timeStr.sub}</span>
        </div>
      </td>
      <td class="platform-cell">
        <span class="platform-badge">${getPlatformIcon(event.platform)} ${event.platform}</span>
      </td>
      <td class="types-cell">
        <div class="types-container">
          ${event.piiTypes.slice(0, 3).map(type => `
            <span class="type-badge">${formatPIIType(type)}</span>
          `).join('')}
          ${event.piiTypes.length > 3 ? `<span class="type-badge more">+${event.piiTypes.length - 3}</span>` : ''}
        </div>
      </td>
      <td class="risk-cell">
        <span class="risk-badge ${riskClass}">${event.riskLevel.toUpperCase()}</span>
      </td>
      <td class="action-cell">
        <span class="action-display">${actionIcon} ${getActionText(event.userAction)}</span>
      </td>
      <td class="details-cell">
        ${event.excerpt ? `<code class="excerpt" title="${escapeHtml(event.excerpt)}">${truncate(event.excerpt, 80)}</code>` : '<span class="no-excerpt">—</span>'}
      </td>
    </tr>
  `;
}

/**
 * Export filtered history to CSV file
 * Creates a downloadable CSV with all filtered events
 */
function exportToCSV() {
  if (filteredHistory.length === 0) {
    alert('No data to export');
    return;
  }

  try {
    // Create CSV headers
    const headers = ['Timestamp', 'Date/Time', 'Platform', 'PII Types', 'Risk Level', 'User Action', 'Excerpt'];

    // Create CSV rows from filtered history
    const rows = filteredHistory.map(event => [
      event.timestamp,
      new Date(event.timestamp).toLocaleString(),
      event.platform,
      event.piiTypes.join('; '),
      event.riskLevel,
      event.userAction,
      event.excerpt || ''
    ]);

    // Combine headers and rows, escaping fields with quotes
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `pii-detection-history-${timestamp}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up object URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export CSV:', error);
    alert('Failed to export data. Please try again.');
  }
}

/**
 * Show the clear history confirmation modal
 */
function showClearConfirmation() {
  if (allHistory.length === 0) {
    alert('No history to clear');
    return;
  }
  confirmModal.style.display = 'flex';
  confirmClearBtn.focus();
}

/**
 * Hide the clear history confirmation modal
 */
function hideClearConfirmation() {
  confirmModal.style.display = 'none';
}

/**
 * Confirm and execute history clearing
 * Clears all history from storage and reloads the page
 */
async function confirmClearHistory() {
  try {
    // Show loading state
    confirmClearBtn.disabled = true;
    confirmClearBtn.textContent = 'Clearing...';

    // Clear history from storage
    await clearHistory();

    // Hide modal
    hideClearConfirmation();

    // Reset button state
    confirmClearBtn.disabled = false;
    confirmClearBtn.textContent = 'Clear History';

    // Reload history data
    await loadHistory();
  } catch (error) {
    console.error('Failed to clear history:', error);
    alert('Failed to clear history. Please try again.');

    // Reset button state
    confirmClearBtn.disabled = false;
    confirmClearBtn.textContent = 'Clear History';
  }
}

/**
 * Scroll to top of page smoothly
 */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
  // Could be enhanced with a toast notification system
  console.error(message);
  alert(message);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp into main and sub display strings
 * @param {number} timestamp - Unix timestamp
 * @returns {Object} Object with main and sub time strings
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return {
      main: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sub: 'Today'
    };
  } else if (isYesterday) {
    return {
      main: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sub: 'Yesterday'
    };
  } else {
    return {
      main: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      sub: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

/**
 * Get icon for platform
 * @param {string} platform - Platform name
 * @returns {string} Platform emoji icon
 */
function getPlatformIcon(platform) {
  const icons = {
    'ChatGPT': '🤖',
    'Claude': '🔮',
    'Gemini': '✨',
    'Perplexity': '🔍',
    'Unknown': '❓'
  };
  return icons[platform] || icons['Unknown'];
}

/**
 * Format PII type for display
 * @param {string} type - PII type identifier
 * @returns {string} Formatted PII type name
 */
function formatPIIType(type) {
  const formatted = {
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    phone: 'Phone',
    email: 'Email',
    creditCard: 'Credit Card',
    bankAccount: 'Bank Account',
    passport: 'Passport',
    ssn: 'SSN',
    ifsc: 'IFSC',
    gst: 'GST',
    dob: 'DOB',
    address: 'Address'
  };
  return formatted[type] || type;
}

/**
 * Get icon for user action
 * @param {string} action - User action type
 * @returns {string} Action emoji icon
 */
function getActionIcon(action) {
  const icons = {
    blocked: '🚫',
    masked: '👁️‍🗨️',
    sent: '📤',
    detected: '⚠️'
  };
  return icons[action] || icons.detected;
}

/**
 * Get text for user action
 * @param {string} action - User action type
 * @returns {string} Action display text
 */
function getActionText(action) {
  const texts = {
    blocked: 'Blocked',
    masked: 'Masked',
    sent: 'Sent',
    detected: 'Detected'
  };
  return texts[action] || 'Detected';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text with ellipsis if needed
 */
function truncate(text, length) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// ============================================================================
// Initialize on DOM ready
// ============================================================================

document.addEventListener('DOMContentLoaded', init);
