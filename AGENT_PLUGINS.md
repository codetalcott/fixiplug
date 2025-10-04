# FixiPlug Agent Plugins - Phase 1 Documentation

## Overview

Phase 1 implements three critical plugins that enable LLM agents to autonomously discover and interact with FixiPlug + Django applications:

1. **Capability Registry** - Auto-discovers Django endpoints, tables, and forms
2. **Agent Commands** - High-level API for LLM operations (no DOM knowledge needed)
3. **Form Schema** - Extracts JSON schemas from forms for validation

## Plugin 1: Capability Registry

**File:** [plugins/capability-registry.js](plugins/capability-registry.js)

### Purpose
Auto-registers Django endpoints, tables, forms, and actions for LLM agent discovery.

### API Hooks

#### `api:getCapabilities`
List all registered capabilities (tables, forms, endpoints)

**Example:**
```javascript
const result = await fixiplug.dispatch('api:getCapabilities');
// Returns:
{
  capabilities: [
    {
      type: 'table',
      endpoint: '/api/products/',
      model: 'Product',
      features: ['search', 'sort', 'paginate', 'edit'],
      columns: [...],
      searchable: true,
      paginated: true
    },
    {
      type: 'form',
      endpoint: '/products/create/',
      method: 'POST',
      fields: [...]
    }
  ],
  count: 2,
  types: ['table', 'form']
}
```

#### `api:registerCapability`
Manually register a capability

**Example:**
```javascript
await fixiplug.dispatch('api:registerCapability', {
  type: 'table',
  endpoint: '/api/products/',
  model: 'Product',
  features: ['search', 'sort'],
  columns: [...]
});
```

#### `api:discoverEndpoints`
Scan DOM for all `fx-action` endpoints

**Example:**
```javascript
const result = await fixiplug.dispatch('api:discoverEndpoints');
// Returns:
{
  endpoints: [
    {
      url: '/api/products/',
      type: 'table',
      method: 'GET',
      element: 'div',
      registered: true
    }
  ],
  count: 1,
  registered: 1,
  unregistered: 0
}
```

#### `api:getCapability`
Get details for a specific capability

**Example:**
```javascript
const result = await fixiplug.dispatch('api:getCapability', {
  endpoint: '/api/products/'
});
```

#### `api:getActionSchema`
Get schema for an endpoint action

**Example:**
```javascript
const result = await fixiplug.dispatch('api:getActionSchema', {
  endpoint: '/api/products/',
  action: 'list'
});
// Returns parameters, response format, etc.
```

### Events Emitted

#### `capability:registered`
Fired when new capability is registered

```javascript
fixiplug.use(function(ctx) {
  ctx.on('capability:registered', (event) => {
    console.log(`New ${event.type}: ${event.endpoint}`);
  });
});
```

### Auto-Registration

The plugin automatically registers:

**Django Tables** - When `fx:data` event fires with Django table format:
```javascript
{
  data: [...],
  columns: [...],
  meta: { model: 'Product', editable: true, ... }
}
```

**Forms** - When form submission is triggered:
```html
<form name="product-form" fx-action="/products/create/">
  <!-- Auto-registered on first fx:before event -->
</form>
```

---

## Plugin 2: Agent Commands

**File:** [plugins/agent-commands.js](plugins/agent-commands.js)

### Purpose
High-level imperative API for LLM agents to interact with applications without DOM knowledge.

### Command Hooks

#### `agent:fillForm`
Fill form fields by name

**Parameters:**
- `form` (string) - Form name, id, or selector
- `data` (object) - Field names → values

**Example:**
```javascript
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',
  data: {
    name: 'Gaming Laptop',
    price: 1499.99,
    category: 'electronics',
    inStock: true,
    description: 'High-performance laptop'
  }
});
// Returns: { success: true, form: 'product-form', filled: [...] }
```

**Supported input types:**
- text, email, url, tel, number
- checkbox, radio
- select (single/multiple)
- textarea
- date, time, datetime-local

#### `agent:clickButton`
Click button by text, role, or selector

**Parameters:**
- `text` (string, optional) - Button text (partial match)
- `role` (string, optional) - Button role attribute
- `selector` (string, optional) - CSS selector

**Example:**
```javascript
// Click by text
await fixiplug.dispatch('agent:clickButton', {
  text: 'submit'
});

// Click by role
await fixiplug.dispatch('agent:clickButton', {
  role: 'primary'
});

// Click by selector
await fixiplug.dispatch('agent:clickButton', {
  selector: '#submit-btn'
});
```

#### `agent:queryTable`
Query table data with Django-style filters

**Parameters:**
- `table` (string) - Table name or selector
- `filter` (object, optional) - Django ORM-style filters
- `limit` (number, optional) - Max rows to return (default: 100)

**Example:**
```javascript
// Get all products
const result = await fixiplug.dispatch('agent:queryTable', {
  table: 'products'
});

// Filter with Django operators
const result = await fixiplug.dispatch('agent:queryTable', {
  table: 'products',
  filter: {
    price__gte: 100,
    category__icontains: 'electronics',
    is_active: true
  },
  limit: 50
});
// Returns: { success: true, count: 12, data: [...], columns: [...] }
```

**Supported Django filter operators:**
- `exact` - Exact match (default)
- `iexact` - Case-insensitive exact match
- `contains` - Contains substring
- `icontains` - Case-insensitive contains
- `gt`, `gte` - Greater than (or equal)
- `lt`, `lte` - Less than (or equal)
- `in` - Value in array
- `isnull` - Is null (true/false)

#### `agent:navigate`
Navigate to URL or trigger action

**Parameters:**
- `url` (string, optional) - URL to navigate to
- `action` (string, optional) - fx-action endpoint to trigger
- `trigger` (string, optional) - Event to dispatch (default: 'click')

**Example:**
```javascript
// Navigate to URL
await fixiplug.dispatch('agent:navigate', {
  url: '/products/'
});

// Trigger fx-action
await fixiplug.dispatch('agent:navigate', {
  action: '/api/products/',
  trigger: 'click'
});
```

#### `agent:extract`
Extract structured data from page

**Parameters:**
- `selector` (string) - CSS selector for elements
- `fields` (array) - Field names to extract
- `format` (string, optional) - 'array' or 'object' (default: 'array')

**Example:**
```javascript
const result = await fixiplug.dispatch('agent:extract', {
  selector: '.product-card',
  fields: ['name', 'price', 'stock']
});
// Returns:
{
  success: true,
  count: 5,
  data: [
    { name: 'Laptop', price: '999.99', stock: '15' },
    { name: 'Mouse', price: '29.99', stock: '100' },
    ...
  ]
}
```

**Field extraction strategies:**
1. `[data-field="name"]` element text
2. `[name="name"]` input value
3. `[data-name]` element text
4. `data-name` attribute value

#### `agent:waitFor`
Wait for element or condition

**Parameters:**
- `element` (string, optional) - CSS selector to wait for
- `condition` (function, optional) - Function that returns true when ready
- `timeout` (number, optional) - Timeout in ms (default: 30000)

**Example:**
```javascript
// Wait for element
await fixiplug.dispatch('agent:waitFor', {
  element: '.success-message',
  timeout: 5000
});

// Wait for condition
await fixiplug.dispatch('agent:waitFor', {
  condition: () => document.querySelectorAll('.product').length > 10,
  timeout: 10000
});
```

#### `agent:submitForm`
Fill and submit form in one action

**Parameters:**
- `form` (string) - Form name, id, or selector
- `data` (object) - Field values

**Example:**
```javascript
await fixiplug.dispatch('agent:submitForm', {
  form: 'product-form',
  data: {
    name: 'New Product',
    price: 99.99
  }
});
// Fills form, then clicks submit button
```

---

## Plugin 3: Form Schema

**File:** [plugins/form-schema.js](plugins/form-schema.js)

### Purpose
Extracts JSON schemas from HTML forms for validation and sample data generation.

### API Hooks

#### `api:getFormSchema`
Extract JSON schema from form

**Parameters:**
- `form` (string) - Form name, id, or selector

**Example:**
```javascript
const result = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});
// Returns:
{
  success: true,
  form: 'product-form',
  schema: {
    fields: {
      name: {
        type: 'string',
        label: 'Product Name',
        required: true,
        maxLength: 255
      },
      price: {
        type: 'number',
        label: 'Price',
        required: true,
        min: 0,
        step: 0.01
      },
      email: {
        type: 'email',
        label: 'Contact Email',
        pattern: '^[^@]+@[^@]+\\.[^@]+$'
      },
      category: {
        type: 'string',
        label: 'Category',
        options: [
          { value: 'electronics', label: 'Electronics' },
          { value: 'furniture', label: 'Furniture' }
        ]
      }
    },
    action: '/products/create/',
    method: 'POST',
    enctype: 'application/x-www-form-urlencoded'
  }
}
```

**Extracted field properties:**
- `type` - email, url, tel, number, date, boolean, string, etc.
- `label` - From `<label>` element
- `required` - From `required` attribute
- `pattern` - Regex pattern
- `minLength`, `maxLength` - String length constraints
- `min`, `max`, `step` - Number constraints
- `options` - For select/datalist elements
- `placeholder` - Input placeholder

#### `api:validateFormData`
Validate data object against form schema

**Parameters:**
- `form` (string) - Form name
- `data` (object) - Data to validate

**Example:**
```javascript
// Valid data
const result = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: {
    name: 'Gaming Laptop',
    price: 1499.99,
    email: 'contact@example.com'
  }
});
// Returns: { valid: true, form: 'product-form', data: {...} }

// Invalid data
const result = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: {
    name: '',  // Required but empty
    price: 'not-a-number',  // Invalid type
    email: 'invalid-email'  // Invalid format
  }
});
// Returns:
{
  valid: false,
  errors: {
    name: 'This field is required',
    price: 'Must be a number',
    email: 'Invalid email format'
  }
}
```

**Validation rules:**
- Required fields
- Type validation (email, url, number, date, etc.)
- Pattern matching (regex)
- Length constraints (min/max)
- Number range (min/max)

#### `api:generateSampleData`
Generate valid sample data for form

**Parameters:**
- `form` (string) - Form name

**Example:**
```javascript
const result = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});
// Returns:
{
  success: true,
  form: 'product-form',
  sample: {
    name: 'Sample text',
    price: 0,
    email: 'user@example.com',
    category: 'electronics',  // First option
    inStock: true,
    description: 'Lorem ipsum dolor sit amet'
  }
}
```

**Sample generation rules:**
- `email` → 'user@example.com'
- `url` → 'https://example.com'
- `tel` → '+1-555-0100'
- `number` → min value or 42
- `date` → Today's date
- `select` → First option
- Pattern-based → Simple pattern matching

#### `api:getFormConstraints`
Get detailed validation constraints

**Parameters:**
- `form` (string) - Form name

**Example:**
```javascript
const result = await fixiplug.dispatch('api:getFormConstraints', {
  form: 'product-form'
});
// Returns all HTML5 validation attributes
```

---

## Complete LLM Agent Workflow

Here's how an LLM agent uses all three plugins together:

```javascript
// 1. Discover what's available
const caps = await fixiplug.dispatch('api:getCapabilities');
console.log(`Found ${caps.count} capabilities`);

// 2. Get form schema
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// 3. Generate sample data based on schema
const sample = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});

// 4. Validate before submitting
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: sample.sample
});

if (validation.valid) {
  // 5. Fill and submit form
  await fixiplug.dispatch('agent:submitForm', {
    form: 'product-form',
    data: sample.sample
  });

  // 6. Wait for success
  await fixiplug.dispatch('agent:waitFor', {
    element: '.success-message'
  });

  // 7. Query updated table
  const products = await fixiplug.dispatch('agent:queryTable', {
    table: 'products',
    filter: { created__gte: new Date().toISOString() }
  });

  console.log(`Added product, now ${products.count} total`);
}
```

---

## Django Integration

### Auto-Registration with dj-fixi

When Django renders a table using dj-fixi:

```python
# Django view
class ProductListView(FxTableMixin, ListView):
    model = Product
    table_fields = ['name', 'price', 'stock']
    editable_fields = ['name', 'stock']
```

**FixiPlug automatically registers:**
```javascript
{
  type: 'table',
  endpoint: '/api/products/',  // from fx-action
  model: 'Product',            // from meta
  features: ['search', 'sort', 'paginate', 'edit'],
  columns: [
    { key: 'name', label: 'Name', editable: true },
    { key: 'price', label: 'Price', editable: false },
    { key: 'stock', label: 'Stock', editable: true }
  ],
  editable: true
}
```

### Form Registration

When Django renders a form:

```html
<form name="product-form" fx-action="/products/create/" method="POST">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Create Product</button>
</form>
```

**FixiPlug automatically registers:**
```javascript
{
  type: 'form',
  endpoint: '/products/create/',
  method: 'POST',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true, min: 0 }
  ]
}
```

---

## Testing

### Run Tests

```bash
# Open test file in browser
open test-agent-plugins.html
```

### Test Scenarios

1. **Capability Discovery** - Discovers all tables and forms
2. **Fill Form** - Agent fills form without DOM knowledge
3. **Form Schema** - Extracts validation rules
4. **Query Table** - Filters data with Django operators
5. **Click & Navigate** - Clicks buttons by text/role
6. **Complete Workflow** - Full agent workflow from discovery to submission

---

## Integration with dj-fixi LLM Tools

These plugins complement the dj-fixi LLM tools ([dj_fixi/llm/tools.py](../dj-fixi/dj_fixi/llm/tools.py)):

**Django LLM Tools:**
- `create_table` - Generate Django view code
- `create_chart` - Generate chart view code
- `create_form` - Generate form view code

**FixiPlug Plugins Enable:**
- **Discovery** → LLM knows what endpoints exist
- **Interaction** → LLM can use generated tables/forms
- **Validation** → LLM validates data before submission
- **Autonomy** → Complete self-service operation

**Complete Flow:**
```
1. User: "Show me products with price > 100"
   ↓
2. LLM discovers /api/products/ (Capability Registry)
   ↓
3. LLM generates Django view code (dj-fixi tools)
   ↓
4. Django executes code, returns table data
   ↓
5. FixiPlug renders table (table plugin)
   ↓
6. User clicks "Add Product"
   ↓
7. LLM gets form schema (Form Schema)
   ↓
8. LLM fills form (Agent Commands)
   ↓
9. LLM validates (Form Schema)
   ↓
10. LLM submits (Agent Commands)
```

---

## Best Practices

### For LLM Agents

1. **Always discover first:**
   ```javascript
   const caps = await fixiplug.dispatch('api:getCapabilities');
   ```

2. **Validate before submitting:**
   ```javascript
   const validation = await fixiplug.dispatch('api:validateFormData', {...});
   if (validation.valid) { /* submit */ }
   ```

3. **Use Django-style filters:**
   ```javascript
   filter: { price__gte: 100, name__icontains: 'laptop' }
   ```

4. **Wait for elements when needed:**
   ```javascript
   await fixiplug.dispatch('agent:waitFor', { element: '.result' });
   ```

### For Django Developers

1. **Use dj-fixi mixins** for auto-registration
2. **Add semantic metadata** to forms:
   ```html
   <input name="email" type="email" required pattern="...">
   ```

3. **Include model info in table meta:**
   ```python
   meta = { 'model': 'Product', 'editable': True }
   ```

---

## Roadmap

### Phase 1: ✅ COMPLETE
- ✅ Capability Registry
- ✅ Agent Commands
- ✅ Form Schema

### Phase 2: Next (Weeks 3-4)
- Semantic Context Annotator
- Dependency Graph Builder

### Phase 3: Advanced (Month 2)
- Action Recorder & Replay
- Natural Language Query Engine

---

## API Reference Summary

### Capability Registry
- `api:getCapabilities` - List all capabilities
- `api:registerCapability` - Register capability
- `api:discoverEndpoints` - Scan for endpoints
- `api:getCapability` - Get specific capability
- `api:getActionSchema` - Get action schema

### Agent Commands
- `agent:fillForm` - Fill form fields
- `agent:clickButton` - Click button
- `agent:queryTable` - Query table data
- `agent:navigate` - Navigate/trigger action
- `agent:extract` - Extract data
- `agent:waitFor` - Wait for element/condition
- `agent:submitForm` - Fill + submit

### Form Schema
- `api:getFormSchema` - Extract schema
- `api:validateFormData` - Validate data
- `api:generateSampleData` - Generate samples
- `api:getFormConstraints` - Get constraints

---

## License

MIT
