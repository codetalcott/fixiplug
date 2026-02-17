# Quick Start: Table Plugin

Get up and running with the FixiPlug table plugin in 5 minutes.

## Step 1: Verify Installation

```bash
node verify-table-plugin.js
```

You should see:
```
🎉 All verification tests passed!
```

## Step 2: Run the Demo

```bash
# Start local server
python3 -m http.server 8000

# In another terminal or browser
open http://localhost:8000/demo-table.html
```

Click the buttons to see different features in action!

## Step 3: Run Tests

```bash
# With server running
open http://localhost:8000/test-table.html
```

You should see all tests pass in green.

## Step 4: Use in Your Project

### Minimal Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Table</title>
</head>
<body>
  <div id="my-table"></div>

  <script type="module">
    import fixiplug from './fixiplug.js';
    import createTablePlugin from './plugins/table.js';

    // Initialize
    fixiplug.use(createTablePlugin());

    // Your data
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' }
    ];

    // Render table
    const container = document.getElementById('my-table');
    container.setAttribute('fx-table', '');

    await fixiplug.dispatch('fx:data', {
      target: container,
      detail: { data: users, cfg: {} }
    });

    await fixiplug.dispatch('fx:swapped', { target: container });
  </script>
</body>
</html>
```

### With Sorting

Add `fx-table-sortable` attribute:

```html
<div id="my-table" fx-table fx-table-sortable></div>
```

Click column headers to sort!

### With Editing

Add editing configuration:

```html
<div
  id="my-table"
  fx-table
  fx-table-editable
  fx-table-save-url="/api/users/"
  fx-table-columns='[
    {"key":"id","label":"ID","editable":false},
    {"key":"name","label":"Name","editable":true},
    {"key":"email","label":"Email","editable":true}
  ]'>
</div>
```

Double-click cells to edit!

### With Django (dj-fixi)

```html
<div fx-action="/users/" fx-trigger="load" fx-table></div>

<script type="module">
  import fixiplug from './fixiplug.js';
  import createDataPipeline from './plugins/data-pipeline.js';
  import createTablePlugin from './plugins/table.js';
  import createDjangoIntegration from './plugins/django-integration.js';

  fixiplug.use(createDataPipeline());
  fixiplug.use(createDjangoIntegration());
  fixiplug.use(createTablePlugin());
</script>
```

That's it! Django handles the rest.

## Common Patterns

### Custom Column Labels

```javascript
container.setAttribute('fx-table-columns', JSON.stringify([
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email Address' }
]));
```

### Number Formatting

```javascript
{
  key: 'price',
  label: 'Price',
  type: 'number',
  formatter: (value) => '$' + value.toFixed(2)
}
```

### Select Dropdown

```javascript
{
  key: 'status',
  label: 'Status',
  editable: true,
  inputType: 'select',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]
}
```

### Listen for Events

```javascript
fixiplug.use(function myPlugin(ctx) {
  ctx.on('table:cellSaved', (event) => {
    console.log('Saved!', event.rowId, event.column, event.value);
  });

  ctx.on('table:cellSaveError', (event) => {
    alert('Save failed: ' + event.error.message);
  });
});
```

## Troubleshooting

### "Table doesn't render"
- Make sure you call `fixiplug.dispatch('fx:swapped', ...)` after `fx:data`
- Check browser console for errors
- Verify `fx-table` attribute is set

### "Sorting doesn't work"
- Add `fx-table-sortable` attribute
- Make sure `fx:swapped` event was dispatched
- Check that columns have `sortable: true` (default)

### "Editing doesn't save"
- Set `fx-table-save-url` attribute
- Backend must handle PATCH requests
- Use `django-integration.js` for automatic CSRF tokens
- Check browser console for network errors

### "Styles look wrong"
- The plugin injects minimal styles
- Override `.fx-table` CSS classes for customization
- Check for CSS conflicts with existing styles

## Next Steps

- Read the full docs: [plugins/README-table.md](plugins/README-table.md)
- See implementation details: [TABLE-PLUGIN-SUMMARY.md](TABLE-PLUGIN-SUMMARY.md)
- View the plan: [docs/table-plugin-plan.md](docs/table-plugin-plan.md)
- Explore demos: [demo-table.html](demo-table.html)

## Need Help?

1. Check the [README](plugins/README-table.md)
2. Look at the [demos](demo-table.html)
3. Review the [tests](test-table-plugin.js)
4. Open an issue on GitHub

Happy table building! 🎉
