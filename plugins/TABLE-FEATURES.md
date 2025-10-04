# FixiPlug Table Plugin - Complete Feature Guide

## Overview

The FixiPlug table plugin provides advanced table functionality for displaying and manipulating tabular data with full Django integration support.

## Features

### ✅ Client-Side Features

1. **Search/Filtering** - Filter table rows by search query
2. **Sorting** - Click column headers to sort
3. **Pagination** - Navigate large datasets with page controls
4. **CSV Export** - Download table data as CSV
5. **Inline Editing** - Double-click cells to edit (with server sync)
6. **Accessibility** - ARIA labels, keyboard navigation

### ✅ Server-Side Features

1. **Server-Side Pagination** - Fetch pages from Django backend
2. **Server-Side Sorting** - Sort data on the server
3. **Server-Side Search** - Filter data on the server
4. **Django Integration** - Full dj-fixi compatibility

---

## Usage Examples

### Basic Table

```html
<div fx-table>
  <!-- Will auto-render from fx:data event -->
</div>

<script>
  element.dispatchEvent(new CustomEvent('fx:data', {
    detail: {
      data: [
        { id: 1, name: 'Product A', price: 99.99 },
        { id: 2, name: 'Product B', price: 149.99 }
      ],
      cfg: {}
    }
  }));
</script>
```

### Client-Side Search

```html
<div
  fx-table
  fx-table-search
  fx-table-search-placeholder="Search products...">
</div>
```

**Features:**
- Live search across all columns
- Case-insensitive
- Resets to page 1 when searching
- Custom placeholder text

### Client-Side Sorting

```html
<div
  fx-table
  fx-table-sortable>
</div>
```

**Features:**
- Click any column header to sort
- Toggle ascending/descending
- Visual indicators (▲ ▼ ⇅)
- Keyboard accessible (Enter/Space)
- Works with search and pagination

### Client-Side Pagination

```html
<div
  fx-table
  fx-table-paginate
  fx-page-size="20">
</div>
```

**Features:**
- First, Previous, Next, Last buttons
- Numbered page buttons (shows 5 at a time)
- Shows current page and total rows
- Respects search filters
- Configurable page size

**Attributes:**
- `fx-table-paginate` - Enable pagination
- `fx-page-size="N"` - Rows per page (default: 10)

### CSV Export

```html
<div
  fx-table
  fx-table-export
  fx-export-filename="products.csv">
</div>
```

**Features:**
- Exports current filtered data (not paginated view)
- Handles commas and quotes in data
- Custom filename
- Triggers `table:exported` event

**Events:**
```javascript
document.addEventListener('table:exported', (e) => {
  console.log(`Exported ${e.detail.rowCount} rows to ${e.detail.filename}`);
});
```

### Inline Editing

```html
<div
  fx-table
  fx-table-editable
  fx-table-save-url="/api/products/update">
</div>
```

**Features:**
- Double-click cell to edit
- Or press Enter when cell is focused
- Input types: text, number, date, select, textarea
- Press Enter to save, Escape to cancel
- Auto-saves to server via PATCH
- Visual feedback (saving, success, error)
- CSRF token auto-added by django-integration plugin

**Server Endpoint:**
```python
# Django view expects:
{
  "id": 123,           # Row ID
  "column": "name",    # Column key
  "value": "New Value" # New cell value
}

# Returns:
{
  "success": true,
  "id": 123,
  "column": "name",
  "value": "New Value"
}
```

**Events:**
```javascript
// Save success
document.addEventListener('table:cellSaved', (e) => {
  console.log(e.detail); // { rowId, column, value }
});

// Save error
document.addEventListener('table:cellSaveError', (e) => {
  console.log(e.detail.error);
});
```

### All Features Combined

```html
<div
  fx-table
  fx-table-search
  fx-table-sortable
  fx-table-paginate
  fx-table-export
  fx-table-editable
  fx-page-size="20"
  fx-export-filename="data.csv"
  fx-table-save-url="/api/update">
</div>
```

---

## Server-Side Mode

### Server-Side Pagination

```html
<div
  fx-table
  fx-table-server-page
  fx-action="/api/products/"
  fx-page-size="50">
</div>
```

**Django endpoint receives:**
- `?page=2&limit=50`

**Django returns:**
```json
{
  "data": [...],
  "columns": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

### Server-Side Sorting

```html
<div
  fx-table
  fx-table-server-sort
  fx-table-sortable
  fx-action="/api/products/">
</div>
```

**Django endpoint receives:**
- `?sort=price&dir=asc`

**Django implementation:**
```python
from django.http import JsonResponse
from .models import Product

def product_list(request):
    queryset = Product.objects.all()

    # Handle sorting
    sort = request.GET.get('sort')
    direction = request.GET.get('dir', 'asc')
    if sort:
        order = sort if direction == 'asc' else f'-{sort}'
        queryset = queryset.order_by(order)

    # Build response
    table = ModelTable(queryset=queryset, fields=[...])
    return JsonResponse(table.to_json(), safe=False)
```

### Server-Side Search

```html
<div
  fx-table
  fx-table-server-side
  fx-table-search
  fx-action="/api/products/">
</div>
```

**Django endpoint receives:**
- `?q=laptop`

**Django implementation:**
```python
def product_list(request):
    queryset = Product.objects.all()

    # Handle search
    query = request.GET.get('q')
    if query:
        queryset = queryset.filter(
            Q(name__icontains=query) |
            Q(category__icontains=query)
        )

    table = ModelTable(queryset=queryset, fields=[...])
    return JsonResponse(table.to_json(), safe=False)
```

### Full Server-Side Mode

```html
<div
  fx-table
  fx-table-server-side
  fx-table-search
  fx-table-sortable
  fx-table-paginate
  fx-action="/api/products/"
  fx-page-size="50">
</div>
```

**Attributes:**
- `fx-table-server-side` - Enable all server-side features
- `fx-table-server-page` - Enable only server pagination
- `fx-table-server-sort` - Enable only server sorting

**Benefits:**
- ✅ Handles millions of rows
- ✅ Reduces client memory usage
- ✅ Leverages database indexes
- ✅ Django query optimization

---

## Django Integration

### Django Table Format

The plugin automatically detects and renders Django dj-fixi table format:

```json
{
  "data": [
    { "id": 1, "name": "Product A", "price": 99.99 }
  ],
  "columns": [
    {
      "key": "name",
      "label": "Product Name",
      "sortable": true,
      "editable": true,
      "inputType": "text"
    },
    {
      "key": "price",
      "label": "Price",
      "sortable": true,
      "editable": false,
      "type": "number"
    }
  ],
  "meta": {
    "editable": true,
    "sortable": true,
    "viewPrefix": "product"
  }
}
```

**Column Configuration:**
- `key` - Field name
- `label` - Display label
- `sortable` - Enable sorting (default: true)
- `editable` - Allow inline editing (default: false)
- `inputType` - Input type: text, number, date, select, textarea
- `type` - Data type for formatting: number, boolean, object
- `formatter` - Custom formatting function
- `validator` - Custom validation function
- `required` - Required field
- `pattern` - Regex pattern for validation

### Django View Example

```python
from django.views.generic import ListView
from dj_fixi.mixins import FxTableMixin
from .models import Product

class ProductListView(FxTableMixin, ListView):
    model = Product
    template_name = "products/list.html"

    table_fields = ['name', 'price', 'stock', 'is_active']
    editable_fields = ['name', 'stock']
    table_actions = ['edit', 'delete']
    table_formatters = {
        'price': lambda p: f'${p:.2f}',
        'is_active': lambda v: '✓' if v else '✗',
    }
```

### Django Template

```django
{% load fixi_tags %}
<!DOCTYPE html>
<html>
<head>
  {% fixi_cdn %}
  <script type="module">
    import fixiplug from '/static/fixiplug.js';
    import createDjangoIntegration from '/static/plugins/django-integration.js';
    import createTablePlugin from '/static/plugins/table.js';

    fixiplug.use(createDjangoIntegration());
    fixiplug.use(createTablePlugin());
  </script>
</head>
<body>
  <div
    fx-table
    fx-table-search
    fx-table-sortable
    fx-table-paginate
    fx-page-size="20">
    {{ table }}
  </div>
</body>
</html>
```

---

## Configuration Options

### Plugin Options

```javascript
import createTablePlugin from './plugins/table.js';

fixiplug.use(createTablePlugin({
  autoRender: true,        // Auto-render tables from fx:data events
  enableSorting: true,     // Enable sorting by default
  striped: true,           // Zebra-striped rows
  hover: true,             // Highlight rows on hover
  className: 'fx-table'    // Base CSS class
}));
```

### Custom Formatters

```javascript
const columns = [
  {
    key: 'price',
    label: 'Price',
    formatter: (value) => `$${value.toFixed(2)}`
  },
  {
    key: 'date',
    label: 'Date',
    formatter: (value) => new Date(value).toLocaleDateString()
  }
];
```

### Custom Validators

```javascript
const columns = [
  {
    key: 'email',
    label: 'Email',
    editable: true,
    validator: async (value) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(value);
    }
  }
];
```

---

## Events

### Table Events

```javascript
// Cell saved successfully
document.addEventListener('table:cellSaved', (e) => {
  console.log('Saved:', e.detail);
  // { rowId, column, value }
});

// Cell save failed
document.addEventListener('table:cellSaveError', (e) => {
  console.error('Error:', e.detail.error);
});

// Table exported
document.addEventListener('table:exported', (e) => {
  console.log('Exported:', e.detail);
  // { filename, rowCount }
});

// Server fetch error
document.addEventListener('table:fetchError', (e) => {
  console.error('Fetch failed:', e.detail.error);
});
```

---

## Styling

The plugin includes default styles, but you can customize:

```css
/* Override default styles */
.fx-table {
  border: 2px solid #333;
}

.fx-table th {
  background: #2196F3;
  color: white;
}

.fx-page-btn.fx-page-active {
  background: #2196F3;
  border-color: #2196F3;
}

/* Loading state */
.fx-loading::after {
  content: 'Please wait...';
  background: #2196F3;
  color: white;
}
```

---

## Performance Tips

### Large Datasets

1. **Use server-side pagination** for 1000+ rows
2. **Enable server-side sorting** for complex queries
3. **Increase page size** to reduce requests: `fx-page-size="100"`
4. **Use Django query optimization**: `select_related()`, `prefetch_related()`

### Client-Side Optimization

1. **Limit initial data** to what's needed
2. **Use pagination** to reduce DOM size
3. **Avoid deep object nesting** in column keys
4. **Cache formatted values** if possible

---

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

---

## Testing

See [test-table-features.html](../test-table-features.html) for comprehensive examples.

```bash
# Run test file
open test-table-features.html
```

---

## Troubleshooting

### Table not rendering

Check:
1. Plugin is registered: `fixiplug.use(createTablePlugin())`
2. Data format is correct (array of objects)
3. `fx:data` event is dispatched
4. Console for errors

### Search not working

Check:
1. `fx-table-search` attribute is present
2. Data is loaded
3. Search input appears in DOM

### Pagination not working

Check:
1. `fx-table-paginate` attribute is present
2. `fx-page-size` is set
3. Dataset has more rows than page size

### Inline editing not saving

Check:
1. `fx-table-save-url` is set
2. Server endpoint is correct
3. Django CSRF token is available
4. Django integration plugin is loaded
5. Console for network errors

### Server-side mode not fetching

Check:
1. `fx-action` attribute is set
2. Server endpoint returns correct JSON format
3. CORS is configured (if different domain)
4. Network tab for requests

---

## License

MIT
