# FixiPlug Table Plugin

A comprehensive HTML table plugin for FixiPlug that provides advanced table functionality including rendering, sorting, and inline editing with seamless Django integration.

## Features

✅ **Core Rendering** (Phase 1)
- Render HTML tables from JSON, CSV, and array data
- Automatic column detection from data
- Custom column configuration support
- Type-aware cell formatting (numbers, booleans, strings)
- Zebra-striped rows
- Minimal default styling

✅ **Django Integration** (Phase 1.5)
- Recognizes Django table JSON format from `dj-fixi`
- Works with `FxCRUDView` for CRUD operations
- Auto-enables features based on Django metadata
- Preserves column configuration across updates

✅ **Column Sorting** (Phase 2)
- Client-side sorting by clicking column headers
- Sort ascending/descending with visual indicators (▲/▼)
- Type-aware sorting (numbers, strings, dates)
- Null/undefined handling
- Keyboard accessible (Enter/Space to sort)

✅ **Inline Editing** (Phase 6)
- Double-click or press Enter to edit cells
- Multiple input types (text, number, select, date, textarea)
- Escape to cancel, Enter or blur to save
- Validation support
- Django CRUD integration with automatic CSRF tokens
- Visual feedback (saving, success, error states)

## Installation

```javascript
import fixiplug from './fixiplug.js';
import createDataPipeline from './plugins/data-pipeline.js';
import createTablePlugin from './plugins/table.js';

fixiplug.use(createDataPipeline());
fixiplug.use(createTablePlugin());
```

## Basic Usage

### Simple Table

```html
<div id="users-table" fx-table></div>

<script type="module">
  import fixiplug from './fixiplug.js';
  import createTablePlugin from './plugins/table.js';

  fixiplug.use(createTablePlugin());

  const data = [
    { id: 1, name: 'Alice', age: 30, email: 'alice@example.com' },
    { id: 2, name: 'Bob', age: 25, email: 'bob@example.com' }
  ];

  const container = document.getElementById('users-table');

  await fixiplug.dispatch('fx:data', {
    target: container,
    detail: { data: data, cfg: {} }
  });
</script>
```

### Sortable Table

```html
<div id="sortable-table" fx-table fx-table-sortable></div>
```

Click any column header to sort. Click again to reverse the sort order.

### Editable Table

```html
<div
  id="editable-table"
  fx-table
  fx-table-editable
  fx-table-save-url="/api/users/"
  fx-table-columns='[
    {"key":"id","label":"ID","editable":false},
    {"key":"name","label":"Name","editable":true,"inputType":"text"},
    {"key":"age","label":"Age","editable":true,"inputType":"number"}
  ]'>
</div>
```

Double-click any editable cell to edit. Changes are saved via PATCH request to the save URL.

### Django Integration

When working with Django's `dj-fixi` library:

```html
<!-- Django view returns FxCRUDView JSON response -->
<div fx-action="/products/" fx-trigger="load" fx-table></div>
```

The Django backend sends:

```json
{
  "data": [
    {"id": 1, "name": "Product A", "price": 29.99}
  ],
  "columns": [
    {"key": "id", "label": "ID", "sortable": true, "editable": false},
    {"key": "name", "label": "Name", "sortable": true, "editable": true, "inputType": "text"},
    {"key": "price", "label": "Price", "sortable": true, "editable": true, "inputType": "number"}
  ],
  "meta": {
    "editable": true,
    "sortable": true
  }
}
```

The table plugin automatically:
- Uses Django column configuration
- Enables sorting and editing based on metadata
- Sends CSRF tokens with save requests
- Handles Django validation errors (422 responses)

## Configuration

### Plugin Options

```javascript
fixiplug.use(createTablePlugin({
  autoRender: true,        // Auto-render tables from fx:data events
  enableSorting: true,     // Enable column sorting by default
  striped: true,           // Zebra-striped rows
  hover: true,             // Highlight rows on hover
  className: 'fx-table'    // Base CSS class
}));
```

### HTML Attributes

| Attribute | Description |
|-----------|-------------|
| `fx-table` | Enable table rendering |
| `fx-table-sortable` | Enable column sorting |
| `fx-table-editable` | Enable inline editing |
| `fx-table-save-url` | Endpoint for saving edits (PATCH requests) |
| `fx-table-columns` | JSON column configuration |
| `fx-sort-column` | Initially sorted column |
| `fx-sort-dir` | Initial sort direction (`asc` or `desc`) |

### Column Configuration

```javascript
{
  key: 'fieldName',           // Data field key (supports nested: 'user.name')
  label: 'Display Name',      // Column header label
  type: 'string',             // Data type: 'string', 'number', 'boolean', 'object'
  sortable: true,             // Allow sorting this column
  editable: true,             // Allow editing this column
  inputType: 'text',          // Input type: 'text', 'number', 'select', 'date', 'textarea'
  options: [                  // For inputType: 'select'
    {value: 'opt1', label: 'Option 1'}
  ],
  formatter: (value) => ...,  // Custom value formatter
  validator: (value) => ...,  // Custom validator (async)
  required: false,            // Field is required
  pattern: /regex/            // Validation regex pattern
}
```

## Events

The table plugin emits the following events:

### `table:cellSaved`

Fired when a cell is successfully saved.

```javascript
ctx.on('table:cellSaved', (event) => {
  console.log('Saved:', event.rowId, event.column, event.value);
});
```

### `table:cellSaveError`

Fired when a cell save fails.

```javascript
ctx.on('table:cellSaveError', (event) => {
  console.error('Save error:', event.error);
});
```

## Styling

The plugin injects minimal default styles. You can customize by overriding:

```css
.fx-table {
  /* Table styles */
}
.fx-table th.fx-sortable {
  /* Sortable header styles */
}
.fx-table .fx-editable {
  /* Editable cell styles */
}
.fx-table .fx-save-success {
  /* Success state */
}
.fx-table .fx-save-error {
  /* Error state */
}
```

## Examples

See the demo files:
- [demo-table.html](../demo-table.html) - Interactive demos of all features
- [test-table.html](../test-table.html) - Automated test suite

## Testing

Run the verification script:

```bash
node verify-table-plugin.js
```

Run browser tests:

```bash
# Start a local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/test-table.html
```

## Browser Support

- Modern browsers with ES6+ support
- Requires `fetch` API for saving edits
- Uses `WeakMap` for state management

## Size

- Core rendering: ~2KB
- Sorting: ~1KB
- Editing: ~1.5KB
- **Total: ~4.5KB minified** (well under 5KB target)

## Django Integration Details

### Works with dj-fixi

The plugin is designed to work seamlessly with Django's `dj-fixi` library:

```python
# Django view (dj-fixi)
from dj_fixi.views import FxCRUDView

class ProductCRUDView(FxCRUDView):
    model = Product
    fields = ['name', 'price', 'stock']
    editable_fields = ['name', 'price']
```

### CRUD Operations

| Operation | HTTP Method | Endpoint | Request Body |
|-----------|-------------|----------|--------------|
| List | GET | `/products/` | - |
| Get | GET | `/products/123/` | - |
| Create | POST | `/products/` | `{name, price, ...}` |
| Update Cell | PATCH | `/products/` | `{id, column, value}` |
| Update Row | PATCH | `/products/123/` | `{name, price, ...}` |
| Delete | DELETE | `/products/123/` | - |

### CSRF Protection

When using with `django-integration.js` plugin, CSRF tokens are automatically added to all state-changing requests.

## Future Enhancements

Planned features (not yet implemented):

- [ ] Filtering & Search (Phase 3)
- [ ] Pagination (Phase 4)
- [ ] Row Selection (Phase 5)
- [ ] State Persistence (Phase 7)
- [ ] Column visibility toggle
- [ ] Export to CSV
- [ ] Responsive card layout
- [ ] Row expansion
- [ ] Virtual scrolling for large datasets

## License

Same as FixiPlug parent project.

## Contributing

See main FixiPlug CONTRIBUTING.md.
