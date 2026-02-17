# HTML Tables Plugin Implementation Plan

## Overview

This document outlines the implementation plan for a comprehensive HTML tables plugin for FixiPlug. The plugin will provide advanced table functionality including sorting, filtering, pagination, row selection, and inline editing while maintaining FixiPlug's core philosophy of minimal dependencies and character-conscious design.

**NEW:** This plugin is designed to work seamlessly with Django's `dj-fixi` library (/Users/williamtalcott/projects/dj-fixi) via the `django-integration.js` plugin.

## Success Criteria

- Tables can be dynamically rendered from JSON, CSV, and array data
- Support for client-side and server-side sorting, filtering, and pagination
- **Django integration**: Recognize and consume Django table JSON format from `dj-fixi`
- **Django CRUD**: Work with Django's `FxCRUDView` for full CRUD operations
- Seamless integration with existing data-pipeline plugin
- Accessible table controls (ARIA attributes, keyboard navigation)
- State preservation during updates (scroll position, selection, expanded rows)
- Minimal bundle size impact (<5KB minified)
- No external dependencies

---

## Phase 1: Core Table Rendering 📊

**Timeline:** 2-3 hours
**Priority:** CRITICAL - Foundation for all table features

### Goals

- Render HTML tables from structured data (arrays of objects)
- Integrate with data-pipeline plugin to consume JSON/CSV data
- Support basic configuration options (columns, headers, styling)
- Enable declarative table creation via HTML attributes

### Implementation Tasks

#### 1.1 Create Base Plugin Structure

**File:** `plugins/table.js`

```javascript
/**
 * HTML Tables Plugin for FixiPlug
 * Provides advanced table functionality for displaying and manipulating tabular data
 *
 * @module plugins/table
 */

export default function createTablePlugin(options = {}) {
  const config = {
    autoRender: true,           // Auto-render tables from fx:data events
    defaultPageSize: 10,        // Default rows per page
    enableSorting: true,        // Enable column sorting
    enableFiltering: false,     // Enable search/filter
    enablePagination: false,    // Enable pagination
    enableSelection: false,     // Enable row selection
    striped: true,              // Zebra-striped rows
    hover: true,                // Highlight on hover
    className: 'fx-table',      // Base CSS class
    ...options
  };

  return {
    name: 'fixiplug-table',
    setup(ctx) {
      // Plugin initialization
      console.log('Table plugin initialized');
    }
  };
}
```

#### 1.2 Data Detection and Table Rendering

Hook into `fx:data` events from the data-pipeline plugin to automatically render tables:

```javascript
setup(ctx) {
  // Listen for processed data from data-pipeline
  ctx.on('fx:data', (event) => {
    if (!config.autoRender) return event;

    const { data, contentType, cfg } = event.detail;
    const element = event.target;

    // Check if element wants table rendering
    const renderMode = element.getAttribute('fx-render');
    if (renderMode !== 'table' && !element.hasAttribute('fx-table')) {
      return event;
    }

    // NEW: Check if this is Django table data (from dj-fixi)
    if (event.detail.djangoTable && data.data && data.columns) {
      // Django format: {data: [...], columns: [...], meta: {...}}
      cfg.text = renderTableHTML(data.data, element, data.columns);

      // Store metadata for later use
      element.dataset.tableColumns = JSON.stringify(data.columns);
      element.dataset.tableMeta = JSON.stringify(data.meta || {});

      return event;
    }

    // Render table from array data
    if (Array.isArray(data) && data.length > 0) {
      cfg.text = renderTableHTML(data, element);
    }

    return event;
  });
}
```

#### 1.3 Table HTML Generator

Core function to generate table HTML from data:

```javascript
function renderTableHTML(data, element) {
  // Extract column configuration
  const columns = getColumnConfig(data, element);

  // Build table structure
  let html = `<table class="${config.className}">`;

  // Header
  html += '<thead><tr>';
  columns.forEach(col => {
    html += `<th data-column="${col.key}">${col.label}</th>`;
  });
  html += '</tr></thead>';

  // Body
  html += '<tbody>';
  data.forEach((row, index) => {
    const rowClass = config.striped && index % 2 === 1 ? 'fx-table-striped' : '';
    html += `<tr class="${rowClass}">`;
    columns.forEach(col => {
      const value = getCellValue(row, col.key);
      html += `<td>${formatCellValue(value, col)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  html += '</table>';
  return html;
}

function getColumnConfig(data, element, djangoColumns = null) {
  // NEW: Use Django-provided column config if available
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
  if (data.length > 0) {
    const firstRow = data[0];
    return Object.keys(firstRow).map(key => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      type: typeof firstRow[key]
    }));
  }

  return [];
}

function getCellValue(row, key) {
  // Support nested keys like "user.name"
  return key.split('.').reduce((obj, k) => obj?.[k], row);
}

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
```

#### 1.4 Declarative HTML API

Support for declarative table creation:

```html
<!-- Auto-render table from JSON endpoint -->
<button
  fx-action="/api/users"
  fx-target="#user-table"
  fx-data-type="json"
  fx-render="table"
  fx-table-columns='[{"key":"name","label":"Name"},{"key":"email","label":"Email"}]'>
  Load Users
</button>
<div id="user-table"></div>

<!-- Or use fx-table attribute -->
<div
  fx-action="/api/products"
  fx-trigger="load"
  fx-data-type="json"
  fx-table>
</div>

<!-- NEW: Django integration (with django-integration.js plugin) -->
<div
  fx-action="/products/"
  fx-trigger="load"
  fx-data-type="json"
  fx-table
  fx-table-sortable
  fx-table-editable
  fx-table-save-url="/products/">
</div>
```

#### 1.5 Basic Styling

Provide minimal CSS for basic table appearance:

```javascript
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
    .fx-table-striped {
      background: #f9f9f9;
    }
    .fx-table tbody tr:hover {
      background: #f0f0f0;
    }
  `;
  document.head.appendChild(style);
}
```

### Testing & Validation

- [ ] Render table from JSON array data
- [ ] Render table from CSV data (via data-pipeline)
- [ ] Handle empty data gracefully
- [ ] Support custom column configuration
- [ ] Auto-detect columns from data
- [ ] Format different data types correctly
- [ ] Apply basic styling
- [ ] **NEW:** Render table from Django `FxCRUDView` JSON response
- [ ] **NEW:** Preserve Django column metadata across updates

---

## Phase 1.5: Django Integration 🐍

**Timeline:** 1-2 hours
**Priority:** HIGH - Essential for Django users

### Goals

- Recognize and consume Django table JSON format from `dj-fixi`
- Work seamlessly with `FxCRUDView` for full CRUD operations
- Preserve Django metadata (editable fields, column types)
- Auto-configure table features based on Django response

### Implementation Tasks

#### 1.5.1 Django Data Format Detection

```javascript
ctx.on('fx:data', (event) => {
  const { data } = event.detail;

  // Detect Django table format
  if (event.detail.djangoTable && data.data && data.columns) {
    // Django sends: {data: [...], columns: [...], meta: {...}, pagination: {...}}

    // Store Django metadata
    const element = event.target;
    element.dataset.djangoTable = 'true';
    element.dataset.tableColumns = JSON.stringify(data.columns);
    element.dataset.tableMeta = JSON.stringify(data.meta || {});

    // Store pagination info if present
    if (data.pagination) {
      element.dataset.tablePagination = JSON.stringify(data.pagination);
    }

    // Auto-enable features based on Django metadata
    if (data.meta.editable) {
      element.setAttribute('fx-table-editable', '');
    }
    if (data.meta.searchable) {
      element.setAttribute('fx-table-search', '');
    }

    // Render table with Django data
    event.detail.cfg.text = renderTableHTML(data.data, element, data.columns);
  }

  return event;
});
```

#### 1.5.2 Django Column Configuration

Django columns include editable/sortable metadata:

```javascript
// Django column format from dj-fixi
{
  "key": "name",
  "label": "Product Name",
  "sortable": true,
  "editable": true,
  "inputType": "text"  // Used for inline editing
}
```

Update `renderTableHTML` to use this metadata:

```javascript
function renderTableHTML(data, element, columns) {
  columns = columns || getColumnConfig(data, element);

  let html = `<table class="${config.className}">`;

  // Header with Django column labels
  html += '<thead><tr>';
  columns.forEach(col => {
    const sortableClass = col.sortable ? 'fx-sortable' : '';
    html += `<th data-column="${col.key}" class="${sortableClass}">${col.label}</th>`;
  });
  html += '</tr></thead>';

  // Body with editable cells
  html += '<tbody>';
  data.forEach((row, index) => {
    html += `<tr id="row-${row.id}">`;
    columns.forEach(col => {
      const value = getCellValue(row, col.key);
      const editableClass = col.editable ? 'fx-editable' : '';
      const inputType = col.inputType || 'text';

      html += `<td
        data-column="${col.key}"
        data-row-id="${row.id}"
        data-input-type="${inputType}"
        class="${editableClass}">
        ${formatCellValue(value, col)}
      </td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  html += '</table>';
  return html;
}
```

#### 1.5.3 Django Pagination Support

Django sends pagination metadata:

```json
{
  "data": [...],
  "columns": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

Render pagination UI:

```javascript
function renderDjangoPagination(pagination, element) {
  const { page, limit, total, totalPages } = pagination;

  const baseAction = element.getAttribute('fx-action');

  return `
    <div class="fx-pagination">
      <div class="fx-page-info">
        Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}
      </div>
      <div class="fx-page-controls">
        <button
          fx-action="${baseAction}?page=${page - 1}&limit=${limit}"
          fx-target="#${element.id}"
          ${page === 1 ? 'disabled' : ''}>
          Previous
        </button>
        <span>Page ${page} of ${totalPages}</span>
        <button
          fx-action="${baseAction}?page=${page + 1}&limit=${limit}"
          fx-target="#${element.id}"
          ${page === totalPages ? 'disabled' : ''}>
          Next
        </button>
      </div>
    </div>
  `;
}
```

### Testing & Validation

- [ ] Recognize Django table JSON format
- [ ] Parse Django column metadata correctly
- [ ] Auto-enable features based on Django meta
- [ ] Render pagination from Django response
- [ ] Preserve column config across Django updates
- [ ] Work with `FxCRUDView` endpoint

---

## Phase 2: Column Sorting 🔼🔽

**Timeline:** 2-3 hours
**Priority:** HIGH - Most requested table feature

### Goals

- Client-side sorting by clicking column headers
- Server-side sorting via fixi actions
- Multi-column sort support
- Visual indicators for sort state (arrows)
- Preserve sort state during updates

### Implementation Tasks

#### 2.1 Sortable Column Headers

Add sorting capabilities to table headers:

```javascript
function renderTableHTML(data, element) {
  const sortable = element.hasAttribute('fx-table-sortable') || config.enableSorting;
  const sortColumn = element.getAttribute('fx-sort-column');
  const sortDir = element.getAttribute('fx-sort-dir') || 'asc';

  // ... existing code ...

  // Header with sort support
  html += '<thead><tr>';
  columns.forEach(col => {
    if (sortable && col.sortable !== false) {
      const isSorted = col.key === sortColumn;
      const sortIcon = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
      const sortClass = isSorted ? `fx-sorted-${sortDir}` : '';

      html += `<th
        data-column="${col.key}"
        class="fx-sortable ${sortClass}"
        fx-action="${getSortAction(element, col.key, sortDir)}"
        fx-target="#${element.id || 'table-container'}"
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
}

function getSortAction(element, column, currentDir) {
  const baseAction = element.getAttribute('fx-action') || '';
  const newDir = currentDir === 'asc' ? 'desc' : 'asc';

  // For server-side sorting
  if (baseAction) {
    const separator = baseAction.includes('?') ? '&' : '?';
    return `${baseAction}${separator}sort=${column}&dir=${newDir}`;
  }

  // For client-side sorting (handled by plugin)
  return `javascript:void(0)`;
}
```

#### 2.2 Client-Side Sorting

Implement client-side sorting logic:

```javascript
// Store table state
const tableStates = new WeakMap();

setup(ctx) {
  // Hook to handle sort events
  ctx.on('table:sort', (event) => {
    const { element, column, direction } = event;
    const state = tableStates.get(element) || {};

    // Sort the data
    const sortedData = sortData(state.data, column, direction);

    // Re-render table
    element.innerHTML = renderTableHTML(sortedData, element);

    // Update state
    state.sortColumn = column;
    state.sortDir = direction;
    tableStates.set(element, state);

    return event;
  });

  // Add click handlers to sortable headers
  ctx.on('fx:swapped', (event) => {
    const tables = event.target.querySelectorAll('[fx-table]');
    tables.forEach(table => {
      const headers = table.querySelectorAll('th.fx-sortable');
      headers.forEach(header => {
        header.addEventListener('click', () => {
          const column = header.getAttribute('data-column');
          const currentDir = header.classList.contains('fx-sorted-asc') ? 'asc' : 'desc';
          const newDir = currentDir === 'asc' ? 'desc' : 'asc';

          ctx.emit('table:sort', {
            element: table,
            column,
            direction: newDir
          });
        });
      });
    });
  });
}

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
```

#### 2.3 Server-Side Sorting

Support server-side sorting for large datasets:

```javascript
setup(ctx) {
  // Before fetch, check if this is a sort request
  ctx.on('fx:config', (event) => {
    const element = event.target;
    if (!element.hasAttribute('fx-table-server-sort')) return event;

    const cfg = event.detail.cfg;

    // Extract sort parameters from URL
    const url = new URL(cfg.action, window.location.origin);
    const sortColumn = url.searchParams.get('sort');
    const sortDir = url.searchParams.get('dir');

    if (sortColumn && sortDir) {
      // Store sort state for rendering
      element.setAttribute('fx-sort-column', sortColumn);
      element.setAttribute('fx-sort-dir', sortDir);
    }

    return event;
  });
}
```

#### 2.4 Keyboard Accessibility

Add keyboard support for sortable headers:

```javascript
header.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    header.click();
  }
});
```

### Testing & Validation

- [ ] Click column header to sort ascending
- [ ] Click again to sort descending
- [ ] Sort different data types (string, number, date)
- [ ] Handle null/undefined values
- [ ] Visual indicators show current sort state
- [ ] Keyboard navigation works (Enter/Space)
- [ ] Server-side sorting updates URL correctly
- [ ] Sort state persists across data updates

---

## Phase 3: Filtering & Search 🔍

**Timeline:** 2-3 hours
**Priority:** MEDIUM - Important for large datasets

### Goals

- Global search across all columns
- Per-column filtering
- Multiple filter operators (equals, contains, range)
- Client-side and server-side filtering
- Live filter updates (debounced)

### Implementation Tasks

#### 3.1 Search UI Component

Generate search interface:

```javascript
function renderSearchUI(element, columns) {
  const searchId = `search-${Math.random().toString(36).substr(2, 9)}`;

  return `
    <div class="fx-table-search">
      <input
        type="text"
        id="${searchId}"
        class="fx-search-input"
        placeholder="Search..."
        aria-label="Search table">
      <button
        class="fx-search-clear"
        aria-label="Clear search">✕</button>
    </div>
  `;
}

function renderTableWithSearch(data, element) {
  const enableSearch = element.hasAttribute('fx-table-search') || config.enableFiltering;

  let html = '';
  if (enableSearch) {
    html += renderSearchUI(element, getColumnConfig(data, element));
  }
  html += renderTableHTML(data, element);

  return html;
}
```

#### 3.2 Client-Side Search

Implement live search functionality:

```javascript
setup(ctx) {
  let searchDebounce = null;

  ctx.on('fx:swapped', (event) => {
    const tables = event.target.querySelectorAll('[fx-table-search]');

    tables.forEach(table => {
      const searchInput = table.previousElementSibling?.querySelector('.fx-search-input');
      if (!searchInput) return;

      const state = tableStates.get(table) || {};

      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          const query = e.target.value.toLowerCase().trim();

          ctx.emit('table:search', {
            element: table,
            query,
            data: state.data
          });
        }, 300); // Debounce 300ms
      });
    });
  });

  ctx.on('table:search', (event) => {
    const { element, query, data } = event;

    if (!query) {
      element.innerHTML = renderTableHTML(data, element);
      return event;
    }

    const filtered = filterData(data, query);
    element.innerHTML = renderTableHTML(filtered, element);

    return event;
  });
}

function filterData(data, query) {
  if (!query || !Array.isArray(data)) return data;

  return data.filter(row => {
    // Search across all values in the row
    return Object.values(row).some(value => {
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    });
  });
}
```

#### 3.3 Column-Specific Filters

Add filters for individual columns:

```javascript
function renderColumnFilter(column) {
  const filterId = `filter-${column.key}`;

  switch (column.filterType || 'text') {
    case 'select':
      return `
        <select class="fx-column-filter" data-column="${column.key}">
          <option value="">All</option>
          ${column.filterOptions.map(opt =>
            `<option value="${opt.value}">${opt.label}</option>`
          ).join('')}
        </select>
      `;
    case 'range':
      return `
        <input type="number" class="fx-column-filter-min" data-column="${column.key}" placeholder="Min">
        <input type="number" class="fx-column-filter-max" data-column="${column.key}" placeholder="Max">
      `;
    case 'text':
    default:
      return `
        <input
          type="text"
          class="fx-column-filter"
          data-column="${column.key}"
          placeholder="Filter ${column.label}">
      `;
  }
}
```

#### 3.4 Filter State Management

Track active filters:

```javascript
function applyFilters(data, filters) {
  return data.filter(row => {
    return Object.entries(filters).every(([column, filter]) => {
      const value = getCellValue(row, column);

      if (filter.operator === 'equals') {
        return value === filter.value;
      } else if (filter.operator === 'contains') {
        return String(value).toLowerCase().includes(filter.value.toLowerCase());
      } else if (filter.operator === 'range') {
        const numValue = Number(value);
        return numValue >= filter.min && numValue <= filter.max;
      }

      return true;
    });
  });
}
```

### Testing & Validation

- [ ] Global search filters all columns
- [ ] Search is debounced to prevent excessive updates
- [ ] Clear search button works
- [ ] Column-specific filters work
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Filter state persists during sort
- [ ] Empty results show appropriate message

---

## Phase 4: Pagination 📄

**Timeline:** 1-2 hours
**Priority:** MEDIUM - Essential for large datasets

### Goals

- Client-side pagination for performance
- Server-side pagination for scalability
- Configurable page sizes
- Page navigation controls
- Page info display (showing X-Y of Z records)

### Implementation Tasks

#### 4.1 Pagination UI

Generate pagination controls:

```javascript
function renderPaginationUI(totalRows, currentPage, pageSize) {
  const totalPages = Math.ceil(totalRows / pageSize);
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);

  return `
    <div class="fx-table-pagination">
      <div class="fx-page-info">
        Showing ${startRow}-${endRow} of ${totalRows}
      </div>
      <div class="fx-page-controls">
        <button
          class="fx-page-btn fx-page-first"
          ${currentPage === 1 ? 'disabled' : ''}
          aria-label="First page">«</button>
        <button
          class="fx-page-btn fx-page-prev"
          ${currentPage === 1 ? 'disabled' : ''}
          aria-label="Previous page">‹</button>

        ${renderPageNumbers(currentPage, totalPages)}

        <button
          class="fx-page-btn fx-page-next"
          ${currentPage === totalPages ? 'disabled' : ''}
          aria-label="Next page">›</button>
        <button
          class="fx-page-btn fx-page-last"
          ${currentPage === totalPages ? 'disabled' : ''}
          aria-label="Last page">»</button>
      </div>
      <select class="fx-page-size" aria-label="Rows per page">
        ${[10, 25, 50, 100].map(size =>
          `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size} per page</option>`
        ).join('')}
      </select>
    </div>
  `;
}

function renderPageNumbers(current, total) {
  const pages = [];
  const maxVisible = 5;

  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    const activeClass = i === current ? 'fx-page-active' : '';
    pages.push(`
      <button
        class="fx-page-btn fx-page-num ${activeClass}"
        data-page="${i}">${i}</button>
    `);
  }

  return pages.join('');
}
```

#### 4.2 Client-Side Pagination

Paginate data in memory:

```javascript
setup(ctx) {
  ctx.on('table:paginate', (event) => {
    const { element, page, pageSize } = event;
    const state = tableStates.get(element) || {};

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = state.data.slice(startIndex, endIndex);

    // Render table with paginated data
    const tableHtml = renderTableHTML(pageData, element);
    const paginationHtml = renderPaginationUI(state.data.length, page, pageSize);

    element.innerHTML = tableHtml + paginationHtml;

    // Update state
    state.currentPage = page;
    state.pageSize = pageSize;
    tableStates.set(element, state);

    return event;
  });

  // Attach pagination event handlers
  ctx.on('fx:swapped', (event) => {
    const paginationControls = event.target.querySelectorAll('.fx-table-pagination');

    paginationControls.forEach(controls => {
      const table = controls.previousElementSibling;
      const state = tableStates.get(table) || { currentPage: 1, pageSize: config.defaultPageSize };

      // Page navigation buttons
      controls.querySelector('.fx-page-first')?.addEventListener('click', () => {
        ctx.emit('table:paginate', { element: table, page: 1, pageSize: state.pageSize });
      });

      controls.querySelector('.fx-page-prev')?.addEventListener('click', () => {
        ctx.emit('table:paginate', { element: table, page: state.currentPage - 1, pageSize: state.pageSize });
      });

      controls.querySelector('.fx-page-next')?.addEventListener('click', () => {
        ctx.emit('table:paginate', { element: table, page: state.currentPage + 1, pageSize: state.pageSize });
      });

      controls.querySelector('.fx-page-last')?.addEventListener('click', () => {
        const totalPages = Math.ceil(state.data.length / state.pageSize);
        ctx.emit('table:paginate', { element: table, page: totalPages, pageSize: state.pageSize });
      });

      // Page number buttons
      controls.querySelectorAll('.fx-page-num').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'));
          ctx.emit('table:paginate', { element: table, page, pageSize: state.pageSize });
        });
      });

      // Page size selector
      controls.querySelector('.fx-page-size')?.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        ctx.emit('table:paginate', { element: table, page: 1, pageSize: newSize });
      });
    });
  });
}
```

#### 4.3 Server-Side Pagination

Support server-side pagination:

```javascript
setup(ctx) {
  ctx.on('fx:config', (event) => {
    const element = event.target;
    if (!element.hasAttribute('fx-table-server-page')) return event;

    const cfg = event.detail.cfg;
    const url = new URL(cfg.action, window.location.origin);

    // Add pagination parameters
    const page = element.getAttribute('fx-page') || '1';
    const pageSize = element.getAttribute('fx-page-size') || config.defaultPageSize;

    url.searchParams.set('page', page);
    url.searchParams.set('limit', pageSize);

    cfg.action = url.toString();

    return event;
  });

  // Parse server response for total count
  ctx.on('fx:data', (event) => {
    const { data } = event.detail;

    if (data && data.items && data.total) {
      // Server returned paginated response
      const state = tableStates.get(event.target) || {};
      state.data = data.items;
      state.totalRows = data.total;
      tableStates.set(event.target, state);

      // Replace data with items array
      event.detail.data = data.items;
    }

    return event;
  });
}
```

### Testing & Validation

- [ ] Navigate between pages
- [ ] Change page size
- [ ] First/last page buttons work
- [ ] Page buttons are disabled appropriately
- [ ] Page info shows correct row counts
- [ ] Pagination persists during sort/filter
- [ ] Server-side pagination sends correct parameters

---

## Phase 5: Row Selection 🎯

**Timeline:** 1-2 hours
**Priority:** LOW - Nice to have for bulk actions

### Goals

- Single and multi-row selection
- Select all/none functionality
- Visual indication of selected rows
- Access selected data via API
- Support for bulk actions on selected rows

### Implementation Tasks

#### 5.1 Selection UI

Add checkboxes for row selection:

```javascript
function renderTableHTML(data, element) {
  const selectable = element.hasAttribute('fx-table-select') || config.enableSelection;

  // ... existing code ...

  // Header with select all
  html += '<thead><tr>';
  if (selectable) {
    html += `
      <th class="fx-select-header">
        <input
          type="checkbox"
          class="fx-select-all"
          aria-label="Select all rows">
      </th>
    `;
  }
  columns.forEach(col => {
    // ... existing column rendering ...
  });
  html += '</tr></thead>';

  // Body with row checkboxes
  html += '<tbody>';
  data.forEach((row, index) => {
    const rowId = row.id || index;
    html += `<tr data-row-id="${rowId}">`;

    if (selectable) {
      html += `
        <td class="fx-select-cell">
          <input
            type="checkbox"
            class="fx-row-select"
            data-row-id="${rowId}"
            aria-label="Select row ${index + 1}">
        </td>
      `;
    }

    // ... existing cell rendering ...
  });
  html += '</tbody>';
}
```

#### 5.2 Selection State Management

Track selected rows:

```javascript
setup(ctx) {
  ctx.on('fx:swapped', (event) => {
    const tables = event.target.querySelectorAll('[fx-table-select]');

    tables.forEach(table => {
      const state = tableStates.get(table) || {};
      state.selectedRows = state.selectedRows || new Set();

      // Select all checkbox
      const selectAll = table.querySelector('.fx-select-all');
      selectAll?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = table.querySelectorAll('.fx-row-select');

        checkboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          const rowId = checkbox.getAttribute('data-row-id');

          if (isChecked) {
            state.selectedRows.add(rowId);
            checkbox.closest('tr').classList.add('fx-row-selected');
          } else {
            state.selectedRows.delete(rowId);
            checkbox.closest('tr').classList.remove('fx-row-selected');
          }
        });

        ctx.emit('table:selectionChanged', {
          element: table,
          selectedRows: Array.from(state.selectedRows)
        });
      });

      // Individual row checkboxes
      const rowCheckboxes = table.querySelectorAll('.fx-row-select');
      rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const rowId = checkbox.getAttribute('data-row-id');
          const isChecked = checkbox.checked;

          if (isChecked) {
            state.selectedRows.add(rowId);
            checkbox.closest('tr').classList.add('fx-row-selected');
          } else {
            state.selectedRows.delete(rowId);
            checkbox.closest('tr').classList.remove('fx-row-selected');
          }

          // Update select all checkbox
          const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
          if (selectAll) selectAll.checked = allChecked;

          ctx.emit('table:selectionChanged', {
            element: table,
            selectedRows: Array.from(state.selectedRows)
          });
        });
      });
    });
  });
}
```

#### 5.3 Selection API

Expose methods to get/set selection:

```javascript
export function getSelectedRows(tableElement) {
  const state = tableStates.get(tableElement);
  if (!state || !state.selectedRows) return [];

  return state.data.filter(row =>
    state.selectedRows.has(String(row.id || state.data.indexOf(row)))
  );
}

export function clearSelection(tableElement) {
  const state = tableStates.get(tableElement);
  if (!state) return;

  state.selectedRows.clear();
  tableElement.querySelectorAll('.fx-row-select').forEach(cb => cb.checked = false);
  tableElement.querySelectorAll('.fx-row-selected').forEach(row => {
    row.classList.remove('fx-row-selected');
  });
}

export function selectRows(tableElement, rowIds) {
  const state = tableStates.get(tableElement);
  if (!state) return;

  rowIds.forEach(id => state.selectedRows.add(String(id)));

  tableElement.querySelectorAll('.fx-row-select').forEach(checkbox => {
    const rowId = checkbox.getAttribute('data-row-id');
    if (state.selectedRows.has(rowId)) {
      checkbox.checked = true;
      checkbox.closest('tr').classList.add('fx-row-selected');
    }
  });
}
```

### Testing & Validation

- [ ] Select/deselect individual rows
- [ ] Select all checkbox works
- [ ] Visual indication for selected rows
- [ ] Selection state persists during sort/filter/paginate
- [ ] Get selected rows via API
- [ ] Clear selection programmatically

---

## Phase 6: Inline Editing ✏️

**Timeline:** 3-4 hours
**Priority:** MEDIUM - **HIGH for Django users** (works with `FxCRUDView`)

### Goals

- Edit cells inline (double-click to edit)
- Different input types (text, number, select, date)
- Validation before saving
- **Django integration**: Save to `FxCRUDView` PATCH endpoint automatically
- Save changes to server via AJAX
- Cancel editing with Escape key
- Visual feedback during save

### Implementation Tasks

#### 6.1 Editable Cell Rendering

Mark cells as editable:

```javascript
function renderTableHTML(data, element) {
  const editable = element.hasAttribute('fx-table-editable') || config.enableEditing;
  const editableColumns = getEditableColumns(element);

  // ... existing code ...

  // Body with editable cells
  data.forEach((row, index) => {
    columns.forEach(col => {
      const value = getCellValue(row, col.key);
      const isEditable = editable && editableColumns.includes(col.key);

      if (isEditable) {
        html += `
          <td
            data-column="${col.key}"
            data-row-id="${row.id || index}"
            data-value="${value}"
            class="fx-editable"
            tabindex="0"
            role="button"
            aria-label="Edit ${col.label}">
            ${formatCellValue(value, col)}
          </td>
        `;
      } else {
        html += `<td>${formatCellValue(value, col)}</td>`;
      }
    });
  });
}
```

#### 6.2 Edit Mode Activation

Handle double-click/Enter to edit:

```javascript
setup(ctx) {
  ctx.on('fx:swapped', (event) => {
    const editableCells = event.target.querySelectorAll('.fx-editable');

    editableCells.forEach(cell => {
      // Double-click to edit
      cell.addEventListener('dblclick', () => {
        enterEditMode(cell, ctx);
      });

      // Enter key to edit
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          enterEditMode(cell, ctx);
        }
      });
    });
  });
}

function enterEditMode(cell, ctx) {
  if (cell.classList.contains('fx-editing')) return;

  const column = cell.getAttribute('data-column');
  const value = cell.getAttribute('data-value');
  const columnConfig = getColumnConfig(cell);

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

function createInputElement(columnConfig, value) {
  let input;

  switch (columnConfig.inputType || 'text') {
    case 'number':
      input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      break;
    case 'select':
      input = document.createElement('select');
      columnConfig.options.forEach(opt => {
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
      input.value = value;
      break;
    case 'textarea':
      input = document.createElement('textarea');
      input.value = value;
      input.rows = 3;
      break;
    case 'text':
    default:
      input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      break;
  }

  input.className = 'fx-cell-input';
  return input;
}
```

#### 6.3 Save Changes to Server

Send updates via AJAX:

```javascript
async function saveCellValue(cell, column, newValue, ctx) {
  const table = cell.closest('table');
  const rowId = cell.getAttribute('data-row-id');
  const saveEndpoint = table.getAttribute('fx-table-save-url');

  if (!saveEndpoint) {
    console.warn('No save endpoint configured (fx-table-save-url)');
    return;
  }

  cell.classList.add('fx-saving');

  try {
    // NOTE: django-integration.js plugin will automatically add CSRF token
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
```

#### 6.4 Django FxCRUDView Integration

**NEW:** The `table:cellSaved` event is handled by `django-integration.js`:

```javascript
// In django-integration.js plugin
ctx.on('table:cellSaved', async (event) => {
  const { element, rowId, column, value } = event.detail;
  const saveUrl = element.getAttribute('fx-table-save-url');

  if (!saveUrl) return event;

  // Django FxCRUDView expects: {id, column, value}
  // CSRF token is automatically added by django-integration.js

  return event;
});
```

**Django FxCRUDView automatically handles:**
- Field validation
- Permission checks
- Returns 422 for validation errors
- Returns 200 with updated data on success

**Usage:**
```html
<div
  fx-action="/products/"
  fx-trigger="load"
  fx-table
  fx-table-editable
  fx-table-save-url="/products/">
</div>
```

### Testing & Validation

- [ ] Double-click cell to edit
- [ ] Enter key activates edit mode
- [ ] Different input types render correctly
- [ ] Escape cancels editing
- [ ] Enter saves changes
- [ ] Blur saves changes
- [ ] Validation prevents invalid values
- [ ] Server updates via AJAX
- [ ] Visual feedback during save
- [ ] Error handling for failed saves
- [ ] **NEW:** Works with Django `FxCRUDView` endpoint
- [ ] **NEW:** CSRF token automatically added
- [ ] **NEW:** Django validation errors displayed correctly

---

## Phase 7: State Integration 🔗

**Timeline:** 1 hour
**Priority:** MEDIUM - Enables persistence and advanced features

### Goals

- Integrate with state-tracker plugin for persistence
- Save/restore table state (sort, filter, page, selection)
- URL synchronization for shareable table states
- Local storage fallback

### Implementation Tasks

#### 7.1 State Serialization

```javascript
function serializeTableState(element) {
  const state = tableStates.get(element) || {};

  return {
    sortColumn: state.sortColumn,
    sortDir: state.sortDir,
    filters: state.filters || {},
    currentPage: state.currentPage || 1,
    pageSize: state.pageSize || config.defaultPageSize,
    selectedRows: Array.from(state.selectedRows || [])
  };
}

function deserializeTableState(element, stateData) {
  const state = tableStates.get(element) || {};

  Object.assign(state, stateData);
  tableStates.set(element, state);

  // Apply state to table
  if (stateData.sortColumn) {
    element.setAttribute('fx-sort-column', stateData.sortColumn);
    element.setAttribute('fx-sort-dir', stateData.sortDir);
  }

  if (stateData.currentPage) {
    element.setAttribute('fx-page', stateData.currentPage);
  }

  if (stateData.selectedRows) {
    selectRows(element, stateData.selectedRows);
  }
}
```

#### 7.2 State Persistence Hooks

```javascript
setup(ctx) {
  // Save state on changes
  ctx.on('table:sort', (event) => {
    const state = serializeTableState(event.element);
    ctx.emit('state:save', {
      key: `table-${event.element.id}`,
      state
    });
    return event;
  });

  ctx.on('table:search', (event) => {
    const state = serializeTableState(event.element);
    ctx.emit('state:save', {
      key: `table-${event.element.id}`,
      state
    });
    return event;
  });

  ctx.on('table:paginate', (event) => {
    const state = serializeTableState(event.element);
    ctx.emit('state:save', {
      key: `table-${event.element.id}`,
      state
    });
    return event;
  });

  // Restore state on init
  ctx.on('fx:inited', (event) => {
    const element = event.target;
    if (!element.hasAttribute('fx-table')) return event;

    ctx.emit('state:load', {
      key: `table-${element.id}`
    }).then(result => {
      if (result && result.state) {
        deserializeTableState(element, result.state);
      }
    });

    return event;
  });
}
```

#### 7.3 URL State Synchronization

```javascript
function syncStateToURL(element) {
  const state = serializeTableState(element);
  const url = new URL(window.location);

  const prefix = element.id ? `${element.id}_` : 'table_';

  if (state.sortColumn) {
    url.searchParams.set(`${prefix}sort`, state.sortColumn);
    url.searchParams.set(`${prefix}dir`, state.sortDir);
  }

  if (state.currentPage > 1) {
    url.searchParams.set(`${prefix}page`, state.currentPage);
  }

  if (Object.keys(state.filters).length > 0) {
    url.searchParams.set(`${prefix}filters`, JSON.stringify(state.filters));
  }

  window.history.replaceState({}, '', url);
}

function restoreStateFromURL(element) {
  const url = new URL(window.location);
  const prefix = element.id ? `${element.id}_` : 'table_';

  const state = {};

  const sortColumn = url.searchParams.get(`${prefix}sort`);
  if (sortColumn) {
    state.sortColumn = sortColumn;
    state.sortDir = url.searchParams.get(`${prefix}dir`) || 'asc';
  }

  const page = url.searchParams.get(`${prefix}page`);
  if (page) {
    state.currentPage = parseInt(page);
  }

  const filters = url.searchParams.get(`${prefix}filters`);
  if (filters) {
    try {
      state.filters = JSON.parse(filters);
    } catch (e) {
      console.warn('Invalid filters in URL:', e);
    }
  }

  if (Object.keys(state).length > 0) {
    deserializeTableState(element, state);
  }
}
```

### Testing & Validation

- [ ] Table state persists across page reloads
- [ ] URL parameters reflect table state
- [ ] Shareable URLs restore table state
- [ ] State syncs with state-tracker plugin
- [ ] Multiple tables maintain independent state

---

## Phase 8: Advanced Features & Polish 🎨

**Timeline:** 2-3 hours
**Priority:** LOW - Nice to have

### Additional Features to Consider

#### 8.1 Column Visibility Toggle

```javascript
// Allow users to show/hide columns
function renderColumnToggle(columns) {
  return `
    <div class="fx-column-toggle">
      <button class="fx-toggle-btn">Columns ▾</button>
      <div class="fx-toggle-menu">
        ${columns.map(col => `
          <label>
            <input type="checkbox" value="${col.key}" checked>
            ${col.label}
          </label>
        `).join('')}
      </div>
    </div>
  `;
}
```

#### 8.2 Export Functionality

```javascript
export function exportTableToCSV(tableElement) {
  const state = tableStates.get(tableElement);
  if (!state || !state.data) return;

  const columns = getColumnConfig(state.data, tableElement);

  // Header row
  let csv = columns.map(col => col.label).join(',') + '\n';

  // Data rows
  state.data.forEach(row => {
    const values = columns.map(col => {
      const value = getCellValue(row, col.key);
      // Escape commas and quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csv += values.join(',') + '\n';
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'table-export.csv';
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 8.3 Responsive Tables

```javascript
// Auto-convert to card layout on mobile
function renderResponsiveTable(data, element) {
  const isMobile = window.innerWidth < 768;

  if (isMobile && element.hasAttribute('fx-table-responsive')) {
    return renderCardLayout(data, element);
  }

  return renderTableHTML(data, element);
}

function renderCardLayout(data, element) {
  const columns = getColumnConfig(data, element);

  return data.map(row => `
    <div class="fx-table-card">
      ${columns.map(col => `
        <div class="fx-card-row">
          <span class="fx-card-label">${col.label}:</span>
          <span class="fx-card-value">${formatCellValue(getCellValue(row, col.key), col)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}
```

#### 8.4 Row Expansion

```javascript
// Expandable rows for detail views
function renderExpandableRow(row, columns, detailTemplate) {
  const rowHtml = `
    <tr data-row-id="${row.id}">
      <td class="fx-expand-cell">
        <button class="fx-expand-btn" aria-label="Expand row">▶</button>
      </td>
      ${columns.map(col => `<td>${formatCellValue(getCellValue(row, col.key), col)}</td>`).join('')}
    </tr>
    <tr class="fx-detail-row" style="display:none">
      <td colspan="${columns.length + 1}">
        ${detailTemplate(row)}
      </td>
    </tr>
  `;

  return rowHtml;
}
```

#### 8.5 Loading States

```javascript
// Show loading indicator during async operations
function showLoadingOverlay(tableElement) {
  const overlay = document.createElement('div');
  overlay.className = 'fx-table-loading';
  overlay.innerHTML = '<div class="fx-spinner"></div>';
  tableElement.appendChild(overlay);
}

function hideLoadingOverlay(tableElement) {
  const overlay = tableElement.querySelector('.fx-table-loading');
  if (overlay) overlay.remove();
}

// Hook into fetch lifecycle
ctx.on('fx:before', (event) => {
  const element = event.target;
  if (element.hasAttribute('fx-table')) {
    showLoadingOverlay(element);
  }
  return event;
});

ctx.on('fx:after', (event) => {
  const element = event.target;
  if (element.hasAttribute('fx-table')) {
    hideLoadingOverlay(element);
  }
  return event;
});
```

---

## Performance Considerations ⚡

### Optimization Strategies

1. **Virtual Scrolling** (for very large datasets)
   - Only render visible rows
   - Recycle DOM elements
   - Update on scroll

2. **Debouncing/Throttling**
   - Debounce search input (300ms)
   - Throttle scroll events (100ms)

3. **Efficient DOM Updates**
   - Use idiomorph swap plugin to preserve unchanged elements
   - Batch DOM updates
   - Use DocumentFragment for bulk insertions

4. **Memoization**
   - Cache computed column configurations
   - Memoize formatter functions
   - Cache sort comparisons

5. **Web Workers** (for heavy processing)
   - Offload sorting/filtering to worker thread
   - Parse large CSV files in background

### Bundle Size Targets

- Core rendering: ~2KB
- Sorting: ~1KB
- Filtering: ~1KB
- Pagination: ~1KB
- Selection: ~0.5KB
- Inline editing: ~1.5KB
- **Total: ~7KB minified** (still within acceptable range)

---

## Testing Strategy 🧪

### Unit Tests

Create test file: `test-table-plugin.js`

```javascript
import createTablePlugin from './plugins/table.js';
import fixiplug from './fixiplug.js';

// Test data
const sampleData = [
  { id: 1, name: 'Alice', age: 30, email: 'alice@example.com' },
  { id: 2, name: 'Bob', age: 25, email: 'bob@example.com' },
  { id: 3, name: 'Charlie', age: 35, email: 'charlie@example.com' }
];

// Test 1: Basic rendering
console.log('Test 1: Basic table rendering');
const table1 = document.createElement('div');
table1.id = 'test-table-1';
table1.setAttribute('fx-table', '');
document.body.appendChild(table1);

fixiplug.use(createTablePlugin());
fixiplug.dispatch('fx:data', {
  target: table1,
  detail: { data: sampleData }
});

// Verify table was created
const renderedTable = table1.querySelector('table');
console.assert(renderedTable !== null, 'Table should be rendered');
console.assert(renderedTable.querySelectorAll('tbody tr').length === 3, 'Should have 3 rows');

// Test 2: Sorting
console.log('Test 2: Column sorting');
const nameHeader = renderedTable.querySelector('th[data-column="name"]');
nameHeader.click();

// Verify sort order
const firstRow = renderedTable.querySelector('tbody tr:first-child td:nth-child(2)');
console.assert(firstRow.textContent === 'Alice', 'Should sort alphabetically');

// Test 3: Filtering
console.log('Test 3: Search filtering');
const searchInput = document.querySelector('.fx-search-input');
searchInput.value = 'bob';
searchInput.dispatchEvent(new Event('input'));

setTimeout(() => {
  const visibleRows = renderedTable.querySelectorAll('tbody tr:not([style*="display: none"])');
  console.assert(visibleRows.length === 1, 'Should filter to 1 row');
}, 350); // Wait for debounce

// Test 4: Pagination
// ... more tests ...
```

### Integration Tests

Test integration with other fixiplug plugins:

- Data pipeline plugin provides data
- State tracker persists table state
- Idiomorph swap preserves scroll position

### Manual Testing Checklist

- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Verify keyboard navigation (Tab, Enter, Space, Escape)
- [ ] Test screen reader compatibility (NVDA, JAWS)
- [ ] Verify performance with 1000+ rows
- [ ] Test with slow network (throttling)

---

## Documentation 📚

### Usage Examples

Create comprehensive examples:

**Example 1: Basic Table**

```html
<div
  id="users-table"
  fx-action="/api/users"
  fx-trigger="load"
  fx-data-type="json"
  fx-table>
</div>

<script type="module">
  import fixiplug from './fixiplug.js';
  import createDataPipeline from './plugins/data-pipeline.js';
  import createTablePlugin from './plugins/table.js';

  fixiplug.use(createDataPipeline());
  fixiplug.use(createTablePlugin());
</script>
```

**Example 2: Advanced Table with All Features**

```html
<div
  id="products-table"
  fx-action="/api/products"
  fx-trigger="load"
  fx-data-type="json"
  fx-table
  fx-table-sortable
  fx-table-search
  fx-table-paginate
  fx-table-select
  fx-table-editable
  fx-table-save-url="/api/products/update"
  fx-table-columns='[
    {"key":"id","label":"ID","sortable":true},
    {"key":"name","label":"Product Name","sortable":true,"editable":true},
    {"key":"price","label":"Price","type":"number","sortable":true,"editable":true,"inputType":"number"},
    {"key":"category","label":"Category","sortable":true,"editable":true,"inputType":"select","options":[
      {"value":"electronics","label":"Electronics"},
      {"value":"clothing","label":"Clothing"},
      {"value":"food","label":"Food"}
    ]}
  ]'>
</div>
```

**Example 3: Programmatic Control**

```javascript
import { getSelectedRows, exportTableToCSV, clearSelection } from './plugins/table.js';

const table = document.getElementById('products-table');

// Get selected rows
const selected = getSelectedRows(table);
console.log('Selected:', selected);

// Export to CSV
document.getElementById('export-btn').addEventListener('click', () => {
  exportTableToCSV(table);
});

// Clear selection
document.getElementById('clear-btn').addEventListener('click', () => {
  clearSelection(table);
});

// Listen for events
fixiplug.dispatch('table:selectionChanged').then(event => {
  console.log('Selection changed:', event.selectedRows);
});
```

### API Reference

Document all public APIs:

- `createTablePlugin(options)` - Create table plugin instance
- `getSelectedRows(tableElement)` - Get selected row data
- `clearSelection(tableElement)` - Clear all selections
- `selectRows(tableElement, rowIds)` - Select specific rows
- `exportTableToCSV(tableElement)` - Export table data to CSV
- `setSwapMode(element, enableSwap)` - Toggle swap mode

### Events Reference

- `table:sort` - Fired when column is sorted
- `table:filter` - Fired when filter is applied
- `table:search` - Fired when search query changes
- `table:paginate` - Fired when page changes
- `table:selectionChanged` - Fired when row selection changes
- `table:cellSaved` - Fired when cell is saved
- `table:cellSaveError` - Fired when cell save fails

---

## Migration & Backwards Compatibility

### Breaking Changes

None - this is a new plugin.

### Deprecation Warnings

N/A for initial release.

---

## Future Enhancements 🚀

Features to consider for future versions:

1. **Column Reordering** - Drag and drop to reorder columns
2. **Column Resizing** - Drag column borders to resize
3. **Grouping** - Group rows by column values
4. **Aggregation** - Show sum/avg/count in footer
5. **Frozen Columns** - Pin columns to left/right
6. **Advanced Filtering** - Date ranges, multi-select, etc.
7. **Bulk Editing** - Edit multiple cells at once
8. **Undo/Redo** - Undo editing changes
9. **Cell Formatting** - Rich text, images, custom renderers
10. **Accessibility Enhancements** - Better screen reader support

---

## Success Metrics

### Adoption Metrics

- Number of GitHub stars/downloads
- Community feedback and feature requests
- Integration examples from users

### Performance Metrics

- Initial render time: <100ms for 100 rows
- Sort operation: <50ms for 1000 rows
- Filter operation: <100ms for 1000 rows
- Bundle size: <8KB minified

### Quality Metrics

- Test coverage: >80%
- Zero critical bugs after 1 month
- Accessibility score: 100% (Lighthouse)

---

## Timeline Summary

| Phase | Feature | Hours | Priority |
|-------|---------|-------|----------|
| 1 | Core Rendering | 2-3 | CRITICAL |
| **1.5** | **Django Integration** | **1-2** | **HIGH** |
| 2 | Sorting | 2-3 | HIGH |
| 3 | Filtering | 2-3 | MEDIUM |
| 4 | Pagination | 1-2 | MEDIUM |
| 5 | Selection | 1-2 | LOW |
| 6 | Inline Editing | 3-4 | MEDIUM (HIGH for Django) |
| 7 | State Integration | 1 | MEDIUM |
| 8 | Advanced Features | 2-3 | LOW |

**Total Estimated Time: 16-25 hours**

---

## Django Integration Summary 🐍

### What's Been Built (Django Side)

**dj-fixi library** provides:
- `FxCRUDView` - Unified CRUD endpoint for all table operations
- `ModelTable` - Backend table generator with JSON export
- `FxTableMixin` - For class-based views
- `render_table()` / `create_table()` - For function-based views
- `django-integration.js` - FixiPlug plugin for Django

### Django → FixiPlug Data Flow

1. **Django sends structured JSON:**
```json
{
  "data": [{...}, {...}],
  "columns": [{"key": "name", "label": "Name", "editable": true}],
  "meta": {"editable": true, "searchable": true},
  "pagination": {"page": 1, "total": 100}
}
```

2. **django-integration.js detects Django format:**
- Sets `event.detail.djangoTable = true`
- Marks data for table plugin

3. **table.js plugin renders:**
- Uses Django column config
- Enables features based on meta
- Renders pagination UI

### CRUD Operations with Django

| Operation | Method | Django Endpoint | Response |
|-----------|--------|-----------------|----------|
| List | GET | `/products/` | JSON with data + columns |
| Get Row | GET | `/products/123/` | Single row JSON |
| Create | POST | `/products/` | Created object + ID |
| Inline Edit | PATCH | `/products/` | `{id, column, value}` |
| Update | PATCH | `/products/123/` | Full object |
| Delete | DELETE | `/products/123/` | Empty (200) |
| Bulk Delete | DELETE | `/products/` | `{ids: [...]}` |

### Example: Full Stack CRUD

**Django (one view):**
```python
class ProductCRUDView(FxCRUDView):
    model = Product
    fields = ['name', 'price', 'stock']
    editable_fields = ['name', 'stock']
```

**HTML (one div):**
```html
<div fx-action="/products/" fx-trigger="load" fx-table></div>
```

**Result:**
- ✅ Server-side sorting, filtering, pagination
- ✅ Client-side table rendering
- ✅ Inline editing (double-click cells)
- ✅ Auto CSRF protection
- ✅ Form validation

### Recommended Implementation Order

For Django users:

1. **Phase 1** - Core table rendering
2. **Phase 1.5** - Django integration (high priority!)
3. **Phase 6** - Inline editing (works with `FxCRUDView`)
4. **Phase 2** - Server-side sorting
5. **Phase 4** - Server-side pagination
6. Others as needed

---

## Conclusion

The HTML Tables plugin will be a powerful addition to FixiPlug, providing a comprehensive solution for displaying and manipulating tabular data while maintaining the core philosophy of minimal dependencies and careful attention to bundle size. The phased approach allows for incremental development and testing, with each phase building on the previous one.

The plugin will integrate seamlessly with existing FixiPlug features (data-pipeline, state-tracker, idiomorph swap) while providing a rich set of features (sorting, filtering, pagination, selection, inline editing) that cover the vast majority of table use cases.

**NEW:** Django integration via `dj-fixi` and `django-integration.js` provides a complete backend-to-frontend CRUD solution with minimal code. Django developers can build full-featured interactive tables with just a few lines of Python and one `<div>` tag.
