/**
 * HTML Tables Plugin for FixiPlug
 * Provides advanced table functionality for displaying and manipulating tabular data
 *
 * Features:
 * - Render tables from JSON, CSV, and array data
 * - Django integration (dj-fixi) for CRUD operations
 * - Column sorting (client-side and server-side)
 * - Inline cell editing
 * - Automatic column detection
 * - Accessibility support (ARIA, keyboard navigation)
 *
 * @module plugins/table
 */

/**
 * Creates table plugin
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.autoRender=true] - Auto-render tables from fx:data events
 * @param {boolean} [options.enableSorting=true] - Enable column sorting
 * @param {boolean} [options.striped=true] - Zebra-striped rows
 * @param {boolean} [options.hover=true] - Highlight rows on hover
 * @param {string} [options.className='fx-table'] - Base CSS class
 * @returns {Object} Plugin instance
 */
export default function createTablePlugin(options = {}) {
  const config = {
    autoRender: true,
    enableSorting: true,
    striped: true,
    hover: true,
    className: 'fx-table',
    ...options
  };

  // Store table state (data, sort, etc.) per element
  const tableStates = new WeakMap();

  /**
   * Get cell value from row using dot notation (e.g., "user.name")
   * @param {Object} row - Data row
   * @param {string} key - Column key (supports nested keys)
   * @returns {*} Cell value
   */
  function getCellValue(row, key) {
    return key.split('.').reduce((obj, k) => obj?.[k], row);
  }

  /**
   * Format cell value based on column type
   * @param {*} value - Cell value
   * @param {Object} column - Column configuration
   * @returns {string} Formatted value
   */
  function formatCellValue(value, column) {
    if (value == null) return '';

    // Apply custom formatter if provided
    if (column.formatter) {
      return column.formatter(value);
    }

    // Default formatting by type
    switch (column.type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'boolean':
        return value ? '✓' : '✗';
      case 'object':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  /**
   * Get column configuration from data or element attributes
   * @param {Array} data - Table data
   * @param {HTMLElement} element - Table container element
   * @param {Array} [djangoColumns] - Django-provided column config
   * @returns {Array} Column configuration
   */
  function getColumnConfig(data, element, djangoColumns = null) {
    // Use Django-provided column config if available
    if (djangoColumns) {
      return djangoColumns;
    }

    // Check for explicit column configuration
    const columnsAttr = element.getAttribute('fx-table-columns');
    if (columnsAttr) {
      try {
        return JSON.parse(columnsAttr);
      } catch (e) {
        console.warn('Invalid fx-table-columns JSON:', e);
      }
    }

    // Check if stored in dataset (from previous Django response)
    if (element.dataset.tableColumns) {
      try {
        return JSON.parse(element.dataset.tableColumns);
      } catch (e) {
        console.warn('Invalid stored column config:', e);
      }
    }

    // Auto-detect columns from first data row
    if (Array.isArray(data) && data.length > 0) {
      const firstRow = data[0];
      return Object.keys(firstRow).map(key => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        type: typeof firstRow[key],
        sortable: true
      }));
    }

    return [];
  }

  /**
   * Sort data by column
   * @param {Array} data - Table data
   * @param {string} column - Column key to sort by
   * @param {string} [direction='asc'] - Sort direction ('asc' or 'desc')
   * @returns {Array} Sorted data
   */
  function sortData(data, column, direction = 'asc') {
    if (!data || !Array.isArray(data)) return data;

    return [...data].sort((a, b) => {
      const aVal = getCellValue(a, column);
      const bVal = getCellValue(b, column);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Type-aware comparison
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Render table HTML from data with controls
   * @param {Array} data - Table data (full dataset)
   * @param {HTMLElement} element - Table container element
   * @param {Array} [columns] - Column configuration
   * @param {Object} [state] - Current table state
   * @returns {string} Complete table HTML with controls
   */
  function renderTableHTML(data, element, columns, state = {}) {
    columns = columns || getColumnConfig(data, element);

    const hasSearch = element.hasAttribute('fx-table-search');
    const hasPagination = element.hasAttribute('fx-table-paginate');
    const hasExport = element.hasAttribute('fx-table-export');
    const sortable = element.hasAttribute('fx-table-sortable') || config.enableSorting;
    const editable = element.hasAttribute('fx-table-editable');

    // Get current state
    const searchQuery = state.searchQuery || '';
    const currentPage = state.currentPage || 1;
    const pageSize = parseInt(element.getAttribute('fx-page-size') || '10');

    // Apply filtering
    let filteredData = searchQuery ? filterData(data, searchQuery, columns) : data;

    // Calculate pagination
    const totalRows = filteredData.length;
    const totalPages = hasPagination ? Math.ceil(totalRows / pageSize) : 1;

    // Apply pagination
    const displayData = hasPagination ? paginateData(filteredData, currentPage, pageSize) : filteredData;

    let html = '';

    // Controls (search + export)
    if (hasSearch || hasExport) {
      html += '<div class="fx-table-controls">';
      if (hasSearch) {
        html += renderSearchBox(element);
      }
      if (hasExport) {
        html += renderExportButton();
      }
      html += '</div>';
    }

    // Table
    const sortColumn = element.getAttribute('fx-sort-column');
    const sortDir = element.getAttribute('fx-sort-dir') || 'asc';

    html += `<table class="${config.className}">`;

    // Header
    html += '<thead><tr>';
    columns.forEach(col => {
      const isSortable = sortable && col.sortable !== false;
      const isSorted = col.key === sortColumn;
      const sortIcon = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
      const sortClass = isSorted ? `fx-sorted-${sortDir}` : '';

      if (isSortable) {
        html += `<th
          data-column="${col.key}"
          class="fx-sortable ${sortClass}"
          role="button"
          aria-sort="${isSorted ? sortDir + 'ending' : 'none'}"
          tabindex="0">
          ${col.label} <span class="fx-sort-icon">${sortIcon}</span>
        </th>`;
      } else {
        html += `<th data-column="${col.key}">${col.label}</th>`;
      }
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    displayData.forEach((row, index) => {
      const rowClass = config.striped && index % 2 === 1 ? 'fx-table-striped' : '';
      const rowId = row.id || index;
      html += `<tr data-row-id="${rowId}" class="${rowClass}">`;

      columns.forEach(col => {
        const value = getCellValue(row, col.key);
        const isEditable = editable && col.editable !== false;
        const editableClass = isEditable ? 'fx-editable' : '';
        const inputType = col.inputType || 'text';

        html += `<td
          data-column="${col.key}"
          data-row-id="${rowId}"
          data-value="${value || ''}"
          data-input-type="${inputType}"
          class="${editableClass}"
          ${isEditable ? 'tabindex="0" role="button" aria-label="Edit ' + col.label + '"' : ''}>
          ${formatCellValue(value, col)}
        </td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';

    html += '</table>';

    // Pagination controls
    if (hasPagination) {
      html += renderPagination(currentPage, totalPages, totalRows);
    }

    return html;
  }

  /**
   * Create input element for editing
   * @param {Object} columnConfig - Column configuration
   * @param {*} value - Current cell value
   * @returns {HTMLElement} Input element
   */
  function createInputElement(columnConfig, value) {
    let input;

    switch (columnConfig.inputType || 'text') {
      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.value = value || '';
        break;
      case 'select':
        input = document.createElement('select');
        (columnConfig.options || []).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.value === value) option.selected = true;
          input.appendChild(option);
        });
        break;
      case 'date':
        input = document.createElement('input');
        input.type = 'date';
        input.value = value || '';
        break;
      case 'textarea':
        input = document.createElement('textarea');
        input.value = value || '';
        input.rows = 3;
        break;
      case 'text':
      default:
        input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        break;
    }

    input.className = 'fx-cell-input';
    return input;
  }

  /**
   * Validate cell value
   * @param {*} value - Value to validate
   * @param {Object} columnConfig - Column configuration
   * @returns {Promise<boolean>} True if valid
   */
  async function validateCellValue(value, columnConfig) {
    if (columnConfig.required && !value) {
      return false;
    }

    if (columnConfig.pattern && !columnConfig.pattern.test(value)) {
      return false;
    }

    if (columnConfig.validator) {
      return await columnConfig.validator(value);
    }

    return true;
  }

  /**
   * Save cell value to server
   * @param {HTMLElement} cell - Cell element
   * @param {string} column - Column key
   * @param {*} newValue - New cell value
   * @param {Object} ctx - Plugin context
   */
  async function saveCellValue(cell, column, newValue, ctx) {
    const table = cell.closest('table');
    const container = table.parentElement;
    const rowId = cell.getAttribute('data-row-id');
    const saveEndpoint = container.getAttribute('fx-table-save-url');

    if (!saveEndpoint) {
      console.warn('No save endpoint configured (fx-table-save-url)');
      return;
    }

    cell.classList.add('fx-saving');

    try {
      // django-integration.js plugin will automatically add CSRF token
      const response = await fetch(saveEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'FX-Request': 'true'
        },
        body: JSON.stringify({
          id: rowId,
          column: column,
          value: newValue
        })
      });

      if (!response.ok) {
        // Django FxCRUDView returns 422 for validation errors
        if (response.status === 422) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Validation failed');
        }
        throw new Error(`Save failed: ${response.statusText}`);
      }

      cell.classList.add('fx-save-success');
      setTimeout(() => cell.classList.remove('fx-save-success'), 2000);

      ctx.emit('table:cellSaved', {
        rowId,
        column,
        value: newValue
      });

    } catch (error) {
      cell.classList.add('fx-save-error');
      setTimeout(() => cell.classList.remove('fx-save-error'), 2000);

      ctx.emit('table:cellSaveError', {
        rowId,
        column,
        value: newValue,
        error
      });
    } finally {
      cell.classList.remove('fx-saving');
    }
  }

  /**
   * Enter edit mode for a cell
   * @param {HTMLElement} cell - Cell element
   * @param {Object} ctx - Plugin context
   */
  function enterEditMode(cell, ctx) {
    if (cell.classList.contains('fx-editing')) return;

    const column = cell.getAttribute('data-column');
    const value = cell.getAttribute('data-value');
    const table = cell.closest('table');
    const container = table.parentElement;
    const state = tableStates.get(container) || {};
    const columns = state.columns || getColumnConfig(state.data || [], container);
    const columnConfig = columns.find(c => c.key === column) || { inputType: 'text' };

    // Replace cell content with input
    const input = createInputElement(columnConfig, value);

    cell.classList.add('fx-editing');
    const originalContent = cell.innerHTML;
    cell.innerHTML = '';
    cell.appendChild(input);

    input.focus();
    if (input.select) input.select();

    // Save on Enter or blur
    const save = async () => {
      const newValue = input.value;

      if (newValue !== value) {
        const valid = await validateCellValue(newValue, columnConfig);

        if (valid) {
          await saveCellValue(cell, column, newValue, ctx);
          cell.setAttribute('data-value', newValue);
          cell.innerHTML = formatCellValue(newValue, columnConfig);
        } else {
          // Show validation error
          cell.classList.add('fx-edit-error');
          setTimeout(() => cell.classList.remove('fx-edit-error'), 2000);
          cell.innerHTML = originalContent;
        }
      } else {
        cell.innerHTML = originalContent;
      }

      cell.classList.remove('fx-editing');
    };

    const cancel = () => {
      cell.innerHTML = originalContent;
      cell.classList.remove('fx-editing');
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  /**
   * Check if table should use server-side mode
   * @param {HTMLElement} element - Table container
   * @returns {boolean} True if server-side
   */
  function isServerSide(element) {
    return element.hasAttribute('fx-table-server-side') ||
           element.hasAttribute('fx-table-server-page') ||
           element.hasAttribute('fx-table-server-sort');
  }

  /**
   * Trigger server-side data fetch
   * @param {HTMLElement} element - Table container
   * @param {Object} state - Current table state
   * @param {Object} ctx - Plugin context
   */
  async function fetchServerData(element, state, ctx) {
    const action = element.getAttribute('fx-action');
    if (!action) {
      console.warn('Server-side table requires fx-action attribute');
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();

    if (element.hasAttribute('fx-table-server-page')) {
      params.set('page', state.currentPage || 1);
      const pageSize = element.getAttribute('fx-page-size') || '10';
      params.set('limit', pageSize);
    }

    if (element.hasAttribute('fx-table-server-sort')) {
      const sortColumn = element.getAttribute('fx-sort-column');
      const sortDir = element.getAttribute('fx-sort-dir') || 'asc';
      if (sortColumn) {
        params.set('sort', sortColumn);
        params.set('dir', sortDir);
      }
    }

    if (state.searchQuery) {
      params.set('q', state.searchQuery);
    }

    // Fetch data
    const url = `${action}?${params.toString()}`;

    try {
      element.classList.add('fx-loading');
      const response = await fetch(url, {
        headers: {
          'FX-Request': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      // Update state with server data
      if (data.data && Array.isArray(data.data)) {
        state.data = data.data;
        state.columns = data.columns || state.columns;
      } else if (Array.isArray(data)) {
        state.data = data;
      }

      // Handle server pagination metadata
      if (data.pagination) {
        state.serverPagination = data.pagination;
      }

      tableStates.set(element, state);

      // Trigger data event to re-render
      ctx.emit('fx:data', {
        target: element,
        detail: {
          data: data,
          djangoTable: !!data.columns,
          cfg: {}
        }
      });

    } catch (error) {
      console.error('Server-side table fetch failed:', error);
      ctx.emit('table:fetchError', { error, element });
    } finally {
      element.classList.remove('fx-loading');
    }
  }

  /**
   * Filter data based on search query
   * @param {Array} data - Table data
   * @param {string} query - Search query
   * @param {Array} columns - Column configuration
   * @returns {Array} Filtered data
   */
  function filterData(data, query, columns) {
    if (!query || !data) return data;

    const lowerQuery = query.toLowerCase();

    return data.filter(row => {
      return columns.some(col => {
        const value = getCellValue(row, col.key);
        if (value == null) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      });
    });
  }

  /**
   * Paginate data
   * @param {Array} data - Table data
   * @param {number} page - Current page (1-indexed)
   * @param {number} pageSize - Rows per page
   * @returns {Array} Paginated data
   */
  function paginateData(data, page, pageSize) {
    if (!data || !pageSize) return data;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }

  /**
   * Render search box HTML
   * @param {HTMLElement} element - Container element
   * @returns {string} Search box HTML
   */
  function renderSearchBox(element) {
    const placeholder = element.getAttribute('fx-table-search-placeholder') || 'Search...';
    return `
      <div class="fx-table-search-container">
        <input
          type="search"
          class="fx-table-search-input"
          placeholder="${placeholder}"
          aria-label="Search table">
      </div>
    `;
  }

  /**
   * Render pagination controls HTML
   * @param {number} currentPage - Current page (1-indexed)
   * @param {number} totalPages - Total number of pages
   * @param {number} totalRows - Total number of rows
   * @returns {string} Pagination HTML
   */
  function renderPagination(currentPage, totalPages, totalRows) {
    if (totalPages <= 1) return '';

    let html = '<div class="fx-table-pagination">';
    html += `<span class="fx-page-info">Page ${currentPage} of ${totalPages} (${totalRows} rows)</span>`;
    html += '<div class="fx-page-controls">';

    // First and Previous
    html += `<button class="fx-page-btn fx-page-first" ${currentPage === 1 ? 'disabled' : ''} aria-label="First page">«</button>`;
    html += `<button class="fx-page-btn fx-page-prev" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;

    // Page numbers
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'fx-page-active' : '';
      html += `<button class="fx-page-btn fx-page-num ${activeClass}" data-page="${i}">${i}</button>`;
    }

    // Next and Last
    html += `<button class="fx-page-btn fx-page-next" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`;
    html += `<button class="fx-page-btn fx-page-last" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Last page">»</button>`;

    html += '</div></div>';
    return html;
  }

  /**
   * Export table data to CSV
   * @param {Array} data - Table data
   * @param {Array} columns - Column configuration
   * @param {string} filename - Output filename
   */
  function exportToCSV(data, columns, filename = 'table-export.csv') {
    // Build CSV content
    const headers = columns.map(col => col.label).join(',');
    const rows = data.map(row => {
      return columns.map(col => {
        const value = getCellValue(row, col.key);
        // Escape quotes and wrap in quotes if contains comma
        const strValue = String(value || '');
        return strValue.includes(',') || strValue.includes('"')
          ? `"${strValue.replace(/"/g, '""')}"`
          : strValue;
      }).join(',');
    });

    const csv = [headers, ...rows].join('\n');

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Render export button HTML
   * @returns {string} Export button HTML
   */
  function renderExportButton() {
    return `
      <div class="fx-table-export-container">
        <button class="fx-table-export-btn" aria-label="Export table">
          Export CSV
        </button>
      </div>
    `;
  }

  /**
   * Inject default table styles
   */
  function injectDefaultStyles() {
    if (document.getElementById('fx-table-styles')) return;

    const style = document.createElement('style');
    style.id = 'fx-table-styles';
    style.textContent = `
      .fx-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
      }
      .fx-table th,
      .fx-table td {
        padding: 0.75em;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      .fx-table th {
        background: #f5f5f5;
        font-weight: bold;
      }
      .fx-table th.fx-sortable {
        cursor: pointer;
        user-select: none;
      }
      .fx-table th.fx-sortable:hover {
        background: #e8e8e8;
      }
      .fx-table .fx-sort-icon {
        margin-left: 0.5em;
        color: #999;
      }
      .fx-table th.fx-sorted-asc .fx-sort-icon,
      .fx-table th.fx-sorted-desc .fx-sort-icon {
        color: #333;
      }
      .fx-table-striped {
        background: #f9f9f9;
      }
      .fx-table tbody tr:hover {
        background: #f0f0f0;
      }
      .fx-table .fx-editable {
        cursor: pointer;
        position: relative;
      }
      .fx-table .fx-editable:hover::after {
        content: '✎';
        position: absolute;
        right: 0.5em;
        color: #999;
      }
      .fx-table .fx-editing {
        padding: 0;
      }
      .fx-table .fx-cell-input {
        width: 100%;
        padding: 0.75em;
        border: 2px solid #4CAF50;
        box-sizing: border-box;
        font-family: inherit;
        font-size: inherit;
      }
      .fx-table .fx-saving {
        opacity: 0.6;
        pointer-events: none;
      }
      .fx-table .fx-save-success {
        background: #d4edda !important;
      }
      .fx-table .fx-save-error {
        background: #f8d7da !important;
      }
      .fx-table .fx-edit-error {
        background: #f8d7da !important;
      }
      .fx-table-search-container {
        margin-bottom: 1em;
      }
      .fx-table-search-input {
        width: 100%;
        max-width: 400px;
        padding: 0.5em;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1em;
      }
      .fx-table-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1em;
        padding: 0.5em 0;
      }
      .fx-page-info {
        color: #666;
      }
      .fx-page-controls {
        display: flex;
        gap: 0.25em;
      }
      .fx-page-btn {
        padding: 0.5em 0.75em;
        border: 1px solid #ddd;
        background: white;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.9em;
      }
      .fx-page-btn:hover:not(:disabled) {
        background: #f5f5f5;
      }
      .fx-page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .fx-page-btn.fx-page-active {
        background: #4CAF50;
        color: white;
        border-color: #4CAF50;
      }
      .fx-table-export-container {
        margin-bottom: 1em;
        display: inline-block;
      }
      .fx-table-export-btn {
        padding: 0.5em 1em;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
      }
      .fx-table-export-btn:hover {
        background: #45a049;
      }
      .fx-table-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1em;
        margin-bottom: 1em;
      }
      .fx-table-hidden-row {
        display: none;
      }
      .fx-loading {
        opacity: 0.6;
        pointer-events: none;
        position: relative;
      }
      .fx-loading::after {
        content: 'Loading...';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 1em 2em;
        border: 2px solid #4CAF50;
        border-radius: 4px;
        font-weight: bold;
        z-index: 1000;
      }
    `;
    document.head.appendChild(style);
  }

  // Plugin implementation
  return {
    name: 'fixiplug-table',

    setup(ctx) {
      console.log('Table plugin initialized');

      // Inject default styles
      if (typeof document !== 'undefined') {
        injectDefaultStyles();
      }

      // Listen for processed data from data-pipeline plugin
      ctx.on('fx:data', (event) => {
        if (!config.autoRender) return event;

        const { data, cfg } = event.detail;
        const element = event.target;

        // Check if element wants table rendering
        const renderMode = element.getAttribute('fx-render');
        const hasTableAttr = element.hasAttribute('fx-table');

        if (renderMode !== 'table' && !hasTableAttr) {
          return event;
        }

        // Handle Django table format
        if (event.detail.djangoTable && data.data && data.columns) {
          // Django sends: {data: [...], columns: [...], meta: {...}}

          // Store Django metadata
          element.dataset.djangoTable = 'true';
          element.dataset.tableColumns = JSON.stringify(data.columns);
          element.dataset.tableMeta = JSON.stringify(data.meta || {});

          // Auto-enable features based on Django metadata
          if (data.meta?.editable) {
            element.setAttribute('fx-table-editable', '');
          }
          if (data.meta?.sortable) {
            element.setAttribute('fx-table-sortable', '');
          }

          // Store state
          const state = {
            data: data.data,
            columns: data.columns,
            meta: data.meta || {},
            currentPage: 1,
            searchQuery: ''
          };
          tableStates.set(element, state);

          // Render table
          cfg.text = renderTableHTML(data.data, element, data.columns, state);

          return event;
        }

        // Handle standard array data
        if (Array.isArray(data) && data.length > 0) {
          // Store state
          const state = {
            data: data,
            columns: getColumnConfig(data, element),
            currentPage: 1,
            searchQuery: ''
          };
          tableStates.set(element, state);

          // Render table
          cfg.text = renderTableHTML(data, element, null, state);
        }

        return event;
      });

      // Add sort event handlers after table is rendered
      ctx.on('fx:swapped', (event) => {
        const element = event.target;
        const tables = element.querySelectorAll('.fx-table');

        tables.forEach(table => {
          const container = table.parentElement;
          const headers = table.querySelectorAll('th.fx-sortable');

          headers.forEach(header => {
            // Remove existing listeners to prevent duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            // Add click handler for sorting
            newHeader.addEventListener('click', async () => {
              const column = newHeader.getAttribute('data-column');
              const currentDir = newHeader.classList.contains('fx-sorted-asc') ? 'asc' : 'desc';
              const newDir = currentDir === 'asc' ? 'desc' : 'asc';

              // Update sort attributes
              container.setAttribute('fx-sort-column', column);
              container.setAttribute('fx-sort-dir', newDir);

              // Get current state
              const state = tableStates.get(container) || {};

              // Check if server-side sorting
              if (isServerSide(container)) {
                await fetchServerData(container, state, ctx);
              } else {
                // Client-side sort
                const sortedData = sortData(state.data, column, newDir);
                state.data = sortedData;
                tableStates.set(container, state);

                // Re-render table
                const tableHtml = renderTableHTML(sortedData, container, state.columns, state);
                container.innerHTML = tableHtml;

                // Re-trigger fx:swapped to re-attach handlers
                ctx.emit('fx:swapped', { target: container });
              }
            });

            // Add keyboard support
            newHeader.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                newHeader.click();
              }
            });
          });

          // Add edit handlers for editable cells
          const editableCells = table.querySelectorAll('.fx-editable');
          editableCells.forEach(cell => {
            // Remove existing listeners
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);

            // Double-click to edit
            newCell.addEventListener('dblclick', () => {
              enterEditMode(newCell, ctx);
            });

            // Enter key to edit
            newCell.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                enterEditMode(newCell, ctx);
              }
            });
          });
        });

        // Add search input handler
        const searchInputs = element.querySelectorAll('.fx-table-search-input');
        searchInputs.forEach(input => {
          const container = input.closest('[fx-table]') || input.closest('[fx-render="table"]');
          if (!container) return;

          input.addEventListener('input', async (e) => {
            const state = tableStates.get(container) || {};
            state.searchQuery = e.target.value;
            state.currentPage = 1; // Reset to page 1 on search
            tableStates.set(container, state);

            // Check if server-side
            if (isServerSide(container)) {
              await fetchServerData(container, state, ctx);
            } else {
              // Client-side filter
              const tableHtml = renderTableHTML(state.data, container, state.columns, state);
              container.innerHTML = tableHtml;

              // Re-trigger fx:swapped to re-attach handlers
              ctx.emit('fx:swapped', { target: container });
            }
          });
        });

        // Add pagination button handlers
        const paginationContainers = element.querySelectorAll('.fx-table-pagination');
        paginationContainers.forEach(paginationEl => {
          const container = paginationEl.closest('[fx-table]') || paginationEl.closest('[fx-render="table"]');
          if (!container) return;

          const state = tableStates.get(container) || {};

          // Helper to change page (client or server)
          const changePage = async (newPage) => {
            state.currentPage = newPage;
            tableStates.set(container, state);

            if (isServerSide(container)) {
              await fetchServerData(container, state, ctx);
            } else {
              const tableHtml = renderTableHTML(state.data, container, state.columns, state);
              container.innerHTML = tableHtml;
              ctx.emit('fx:swapped', { target: container });
            }
          };

          // Page number buttons
          paginationEl.querySelectorAll('.fx-page-num').forEach(btn => {
            btn.addEventListener('click', () => {
              changePage(parseInt(btn.dataset.page));
            });
          });

          // First page
          const firstBtn = paginationEl.querySelector('.fx-page-first');
          if (firstBtn) {
            firstBtn.addEventListener('click', () => changePage(1));
          }

          // Previous page
          const prevBtn = paginationEl.querySelector('.fx-page-prev');
          if (prevBtn) {
            prevBtn.addEventListener('click', () => {
              if (state.currentPage > 1) {
                changePage(state.currentPage - 1);
              }
            });
          }

          // Next page
          const nextBtn = paginationEl.querySelector('.fx-page-next');
          if (nextBtn) {
            nextBtn.addEventListener('click', () => {
              const pageSize = parseInt(container.getAttribute('fx-page-size') || '10');
              const searchQuery = state.searchQuery || '';
              const filteredData = searchQuery ? filterData(state.data, searchQuery, state.columns) : state.data;
              const totalPages = Math.ceil(filteredData.length / pageSize);

              if (state.currentPage < totalPages) {
                changePage(state.currentPage + 1);
              }
            });
          }

          // Last page
          const lastBtn = paginationEl.querySelector('.fx-page-last');
          if (lastBtn) {
            lastBtn.addEventListener('click', () => {
              const pageSize = parseInt(container.getAttribute('fx-page-size') || '10');
              const searchQuery = state.searchQuery || '';
              const filteredData = searchQuery ? filterData(state.data, searchQuery, state.columns) : state.data;
              const totalPages = Math.ceil(filteredData.length / pageSize);

              changePage(totalPages);
            });
          }
        });

        // Add export button handler
        const exportBtns = element.querySelectorAll('.fx-table-export-btn');
        exportBtns.forEach(btn => {
          const container = btn.closest('[fx-table]') || btn.closest('[fx-render="table"]');
          if (!container) return;

          btn.addEventListener('click', () => {
            const state = tableStates.get(container) || {};
            const filename = container.getAttribute('fx-export-filename') || 'table-export.csv';

            // Export current filtered data (not paginated)
            const searchQuery = state.searchQuery || '';
            const exportData = searchQuery ? filterData(state.data, searchQuery, state.columns) : state.data;

            exportToCSV(exportData, state.columns, filename);

            ctx.emit('table:exported', {
              filename,
              rowCount: exportData.length
            });
          });
        });
      });
    }
  };
}

// Note: Helper functions (getCellValue, formatCellValue, sortData) are defined
// within the plugin closure and not exported separately.
