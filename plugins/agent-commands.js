/**
 * FixiPlug Agent Command Interface Plugin
 *
 * Provides high-level imperative API for LLM agents to interact with FixiPlug applications.
 * Enables agents to perform common operations without DOM manipulation knowledge.
 *
 * @module plugins/agent-commands
 *
 * Agent Command Hooks:
 * - agent:fillForm - Fill form fields by name
 * - agent:clickButton - Click button by text, role, or selector
 * - agent:queryTable - Query table data with filters
 * - agent:navigate - Navigate to URL or trigger action
 * - agent:extract - Extract structured data from page
 * - agent:waitFor - Wait for element or condition
 * - agent:submitForm - Fill and submit form in one action
 *
 * @example
 * // Fill form
 * await fixiplug.dispatch('agent:fillForm', {
 *   form: 'product-form',
 *   data: { name: 'Laptop', price: 999.99 }
 * });
 *
 * @example
 * // Query table
 * const result = await fixiplug.dispatch('agent:queryTable', {
 *   table: 'products',
 *   filter: { price__gte: 100 }
 * });
 *
 * @example
 * // Extract data (array format - uses data attributes)
 * const data = await fixiplug.dispatch('agent:extract', {
 *   selector: '.product-card',
 *   fields: ['name', 'price', 'stock']
 * });
 *
 * @example
 * // Extract data (object format - uses CSS selectors)
 * const data = await fixiplug.dispatch('agent:extract', {
 *   selector: 'tr',
 *   fields: {
 *     id: 'td:nth-child(1)',
 *     name: 'td:nth-child(2)',
 *     price: 'td:nth-child(3)'
 *   }
 * });
 */

export default function agentCommands(ctx) {

  // ========================================
  // Command: Fill Form
  // ========================================
  ctx.on('agent:fillForm', async (event) => {
    const { form, data } = event;

    if (!form || !data) {
      return { error: 'form and data parameters required' };
    }

    // Find form element
    const formEl = findForm(form);

    if (!formEl) {
      return { error: `Form not found: ${form}` };
    }

    const filled = [];
    const errors = [];

    // Fill each field
    for (const [fieldName, value] of Object.entries(data)) {
      const input = formEl.querySelector(`[name="${fieldName}"]`);

      if (!input) {
        errors.push({ field: fieldName, error: 'Field not found' });
        continue;
      }

      try {
        setInputValue(input, value);
        filled.push(fieldName);
      } catch (error) {
        errors.push({ field: fieldName, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      form,
      filled,
      errors: errors.length > 0 ? errors : undefined
    };
  });

  // ========================================
  // Command: Click Button
  // ========================================
  ctx.on('agent:clickButton', (event) => {
    const { text, role, selector } = event;

    let button = null;

    // Try selector first
    if (selector) {
      button = document.querySelector(selector);
    }

    // Try role
    if (!button && role) {
      button = document.querySelector(`button[role="${role}"], [role="${role}"]`);
    }

    // Try text content
    if (!button && text) {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
      button = buttons.find(b =>
        b.textContent.trim().toLowerCase().includes(text.toLowerCase()) ||
        b.value?.toLowerCase().includes(text.toLowerCase())
      );
    }

    if (!button) {
      return {
        error: 'Button not found',
        searched: { text, role, selector }
      };
    }

    // Click button
    button.click();

    return {
      success: true,
      clicked: button.textContent || button.value || 'button',
      element: button.tagName.toLowerCase()
    };
  });

  // ========================================
  // Command: Query Table
  // ========================================
  ctx.on('agent:queryTable', async (event) => {
    const { table, filter, limit = 100 } = event;

    if (!table) {
      return { error: 'table parameter required' };
    }

    // Find table element
    const tableEl = findTable(table);

    if (!tableEl) {
      return { error: `Table not found: ${table}` };
    }

    // Get table state from table plugin
    // Note: This requires table plugin to be loaded
    const stateResult = await ctx.dispatch('internal:getTableState', { element: tableEl });

    if (!stateResult || !stateResult.data) {
      return { error: 'Could not retrieve table data' };
    }

    let data = stateResult.data;

    // Apply filter if provided
    if (filter) {
      data = data.filter(row => matchesFilter(row, filter));
    }

    // Apply limit
    data = data.slice(0, limit);

    return {
      success: true,
      table,
      count: data.length,
      data,
      columns: stateResult.columns
    };
  });

  // ========================================
  // Command: Navigate
  // ========================================
  ctx.on('agent:navigate', (event) => {
    const { url, action, trigger } = event;

    if (url) {
      // Navigate to URL
      window.location.href = url;
      return { success: true, action: 'navigate', url };
    }

    if (action) {
      // Trigger fx-action
      const element = document.querySelector(`[fx-action="${action}"]`);

      if (!element) {
        return { error: `Element with fx-action="${action}" not found` };
      }

      // Trigger the action
      element.dispatchEvent(new Event(trigger || 'click', { bubbles: true }));

      return { success: true, action: 'trigger', endpoint: action };
    }

    return { error: 'url or action parameter required' };
  });

  // ========================================
  // Command: Extract Data
  // ========================================
  ctx.on('agent:extract', (event) => {
    const { selector, fields, format = 'array' } = event;

    if (!selector || !fields) {
      return { error: 'selector and fields parameters required' };
    }

    const elements = document.querySelectorAll(selector);

    if (elements.length === 0) {
      return {
        success: true,
        count: 0,
        data: format === 'array' ? [] : {},
        warning: 'No elements found'
      };
    }

    // Determine if fields is array or object format
    const isArrayFormat = Array.isArray(fields);
    const isObjectFormat = !isArrayFormat && typeof fields === 'object';

    if (!isArrayFormat && !isObjectFormat) {
      return { error: 'fields must be an array or object' };
    }

    const extracted = [];

    elements.forEach((el, index) => {
      const item = {};

      if (isArrayFormat) {
        // Array format: ['name', 'price', 'stock']
        // Try multiple strategies to get field value
        fields.forEach(field => {
          const value =
            el.querySelector(`[data-field="${field}"]`)?.textContent?.trim() ||
            el.querySelector(`[name="${field}"]`)?.value ||
            el.querySelector(`[data-${field}]`)?.textContent?.trim() ||
            el.getAttribute(`data-${field}`) ||
            null;

          item[field] = value;
        });
      } else {
        // Object format: {name: 'td:nth-child(1)', price: 'td:nth-child(2)'}
        // Use CSS selectors to find specific elements
        for (const [fieldName, fieldSelector] of Object.entries(fields)) {
          const fieldEl = el.querySelector(fieldSelector);
          const value = fieldEl ?
            (fieldEl.value || fieldEl.textContent?.trim() || fieldEl.getAttribute('value') || null) :
            null;

          item[fieldName] = value;
        }
      }

      extracted.push(item);
    });

    return {
      success: true,
      count: extracted.length,
      data: format === 'array' ? extracted : Object.fromEntries(extracted.map((item, i) => [i, item])),
      selector,
      fieldsFormat: isArrayFormat ? 'array' : 'object'
    };
  });

  // ========================================
  // Command: Wait For Element/Condition
  // ========================================
  ctx.on('agent:waitFor', (event) => {
    const { element, condition, timeout = 30000 } = event;

    return new Promise((resolve) => {
      const startTime = Date.now();

      // Check for element
      if (element) {
        const check = () => {
          const el = document.querySelector(element);

          if (el) {
            resolve({
              success: true,
              element,
              found: true,
              waited: Date.now() - startTime
            });
          } else if (Date.now() - startTime > timeout) {
            resolve({
              error: 'Timeout waiting for element',
              element,
              timeout,
              waited: Date.now() - startTime
            });
          } else {
            setTimeout(check, 100);
          }
        };

        check();
        return;
      }

      // Check for condition (function)
      if (condition && typeof condition === 'function') {
        const check = () => {
          if (condition()) {
            resolve({
              success: true,
              condition: 'custom',
              waited: Date.now() - startTime
            });
          } else if (Date.now() - startTime > timeout) {
            resolve({
              error: 'Timeout waiting for condition',
              timeout,
              waited: Date.now() - startTime
            });
          } else {
            setTimeout(check, 100);
          }
        };

        check();
        return;
      }

      resolve({ error: 'element or condition parameter required' });
    });
  });

  // ========================================
  // Command: Submit Form (Fill + Submit)
  // ========================================
  ctx.on('agent:submitForm', async (event) => {
    const { form, data } = event;

    // First fill the form
    const fillResult = await ctx.dispatch('agent:fillForm', { form, data });

    if (!fillResult.success) {
      return fillResult;
    }

    // Find and click submit button
    const formEl = findForm(form);
    const submitBtn = formEl.querySelector('button[type="submit"], input[type="submit"]');

    if (!submitBtn) {
      return {
        error: 'Submit button not found',
        filled: fillResult.filled
      };
    }

    submitBtn.click();

    return {
      success: true,
      form,
      filled: fillResult.filled,
      submitted: true
    };
  });

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Find form element by name or selector
   */
  function findForm(identifier) {
    return (
      document.querySelector(`form[name="${identifier}"]`) ||
      document.querySelector(`form#${identifier}`) ||
      document.querySelector(identifier)
    );
  }

  /**
   * Find table element by name or selector
   */
  function findTable(identifier) {
    return (
      document.querySelector(`[fx-table][data-model="${identifier}"]`) ||
      document.querySelector(`[fx-table][name="${identifier}"]`) ||
      document.querySelector(`[fx-table]#${identifier}`) ||
      document.querySelector(identifier)
    );
  }

  /**
   * Set input value based on input type
   */
  function setInputValue(input, value) {
    const type = input.type?.toLowerCase();

    switch (type) {
      case 'checkbox':
        input.checked = !!value;
        break;

      case 'radio':
        if (input.value === String(value)) {
          input.checked = true;
        }
        break;

      case 'file':
        // Can't set file inputs programmatically
        throw new Error('File inputs cannot be set programmatically');

      case 'select-one':
      case 'select-multiple':
        // Find and select option
        const option = Array.from(input.options).find(opt =>
          opt.value === String(value) || opt.textContent.trim() === String(value)
        );
        if (option) {
          option.selected = true;
        } else {
          input.value = value;
        }
        break;

      default:
        input.value = value;
    }

    // Trigger change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Check if row matches filter criteria
   * Supports Django-style filters (field__operator: value)
   */
  function matchesFilter(row, filter) {
    for (const [key, expectedValue] of Object.entries(filter)) {
      // Parse Django-style filter
      const parts = key.split('__');
      const field = parts[0];
      const operator = parts[1] || 'exact';

      const actualValue = row[field];

      // Apply operator
      switch (operator) {
        case 'exact':
          if (actualValue !== expectedValue) return false;
          break;

        case 'iexact':
          if (String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase()) return false;
          break;

        case 'contains':
          if (!String(actualValue).includes(expectedValue)) return false;
          break;

        case 'icontains':
          if (!String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase())) return false;
          break;

        case 'gt':
          if (!(actualValue > expectedValue)) return false;
          break;

        case 'gte':
          if (!(actualValue >= expectedValue)) return false;
          break;

        case 'lt':
          if (!(actualValue < expectedValue)) return false;
          break;

        case 'lte':
          if (!(actualValue <= expectedValue)) return false;
          break;

        case 'in':
          if (!Array.isArray(expectedValue) || !expectedValue.includes(actualValue)) return false;
          break;

        case 'isnull':
          if (expectedValue && actualValue != null) return false;
          if (!expectedValue && actualValue == null) return false;
          break;

        default:
          // Unknown operator, treat as exact match
          if (actualValue !== expectedValue) return false;
      }
    }

    return true;
  }

  // ========================================
  // Skill Metadata
  // ========================================

  return {
    skill: {
      name: 'agent-commands',

      description: 'High-level imperative API for LLM agents to interact with web applications without DOM manipulation. Use when you need to fill forms, click buttons, query tables, extract data, or navigate - provides a clean abstraction over low-level browser APIs.',

      instructions: `# Agent Command Interface Skill

## Overview

The Agent Command Interface provides high-level, declarative commands for common web interaction patterns. Instead of writing low-level DOM manipulation code, you can use simple commands like \`agent:fillForm\`, \`agent:clickButton\`, and \`agent:queryTable\`.

**Key Principle**: Focus on WHAT you want to do, not HOW to do it.

## Core Commands

### 1. agent:fillForm - Fill Form Fields

**Purpose**: Fill multiple form fields with data in one command.

**Use When**:
- Filling user registration forms
- Updating profile information
- Entering search criteria
- Batch data entry

**Parameters**:
- \`form\` - Form identifier (name, id, or CSS selector)
- \`data\` - Object with field names and values

**Example**:
\`\`\`javascript
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',
  data: {
    name: 'Laptop',
    price: 999.99,
    category: 'Electronics',
    in_stock: true
  }
});

// Returns:
// {
//   success: true,
//   form: 'product-form',
//   filled: ['name', 'price', 'category', 'in_stock']
// }
\`\`\`

**Supported Input Types**:
- Text, email, number, date, etc. (sets \`value\`)
- Checkboxes (sets \`checked\`)
- Radio buttons (checks matching value)
- Select dropdowns (selects option by value or text)
- Textareas (sets content)

**Error Handling**:
\`\`\`javascript
const result = await fixiplug.dispatch('agent:fillForm', {
  form: 'missing-form',
  data: { name: 'Test' }
});

if (!result.success) {
  console.error('Form error:', result.error);
  // Handle: form not found, fields missing, etc.
}

// Partial success:
// {
//   success: false,
//   filled: ['name', 'price'],
//   errors: [
//     { field: 'category', error: 'Field not found' }
//   ]
// }
\`\`\`

---

### 2. agent:clickButton - Click Buttons by Intent

**Purpose**: Click buttons without knowing exact selectors.

**Use When**:
- Submitting forms
- Triggering actions
- Navigation
- Modal interactions

**Parameters**:
- \`text\` - Button text content (fuzzy match)
- \`role\` - ARIA role attribute
- \`selector\` - CSS selector (fallback)

**Example**:
\`\`\`javascript
// Click by text (case-insensitive partial match)
await fixiplug.dispatch('agent:clickButton', {
  text: 'Submit'
});

// Click by ARIA role
await fixiplug.dispatch('agent:clickButton', {
  role: 'submit'
});

// Click by selector
await fixiplug.dispatch('agent:clickButton', {
  selector: '#save-button'
});

// Returns:
// {
//   success: true,
//   clicked: 'Submit Form',
//   element: 'button'
// }
\`\`\`

**Search Priority**:
1. \`selector\` (if provided)
2. \`role\` attribute
3. \`text\` content (fuzzy match on buttons and [role="button"])

---

### 3. agent:queryTable - Query Table Data

**Purpose**: Extract and filter data from FixiPlug tables (requires table plugin).

**Use When**:
- Searching for specific records
- Filtering data by criteria
- Extracting table contents
- Validating data presence

**Parameters**:
- \`table\` - Table identifier (data-model, name, id, or selector)
- \`filter\` - Django-style filter object (optional)
- \`limit\` - Max rows to return (default: 100)

**Example**:
\`\`\`javascript
// Get all products
const result = await fixiplug.dispatch('agent:queryTable', {
  table: 'products'
});

// Filter with Django-style operators
const expensive = await fixiplug.dispatch('agent:queryTable', {
  table: 'products',
  filter: {
    price__gte: 100,           // price >= 100
    category__icontains: 'tech', // category contains 'tech' (case-insensitive)
    in_stock: true             // exact match
  },
  limit: 50
});

// Returns:
// {
//   success: true,
//   table: 'products',
//   count: 12,
//   data: [
//     { id: 1, name: 'Laptop', price: 999, category: 'Technology', in_stock: true },
//     { id: 5, name: 'Tablet', price: 499, category: 'Technology', in_stock: true },
//     ...
//   ],
//   columns: ['id', 'name', 'price', 'category', 'in_stock']
// }
\`\`\`

**Supported Filter Operators**:
- \`exact\` - Exact match (default)
- \`iexact\` - Case-insensitive exact match
- \`contains\` - Substring match
- \`icontains\` - Case-insensitive substring match
- \`gt\` - Greater than
- \`gte\` - Greater than or equal
- \`lt\` - Less than
- \`lte\` - Less than or equal
- \`in\` - Value in array
- \`isnull\` - Is null/undefined

**Example Filters**:
\`\`\`javascript
// Complex filter
{
  name__icontains: 'pro',        // Name contains 'pro' (any case)
  price__gte: 50,                // Price >= 50
  price__lt: 200,                // Price < 200
  category__in: ['Electronics', 'Computers'], // Category in list
  discontinued__isnull: true     // discontinued is null
}
\`\`\`

---

### 4. agent:extract - Extract Structured Data

**Purpose**: Extract data from DOM elements into structured objects.

**Use When**:
- Scraping page content
- Extracting search results
- Reading product listings
- Gathering form values

**Parameters**:
- \`selector\` - CSS selector for container elements
- \`fields\` - Array or object defining fields to extract
- \`format\` - 'array' (default) or 'object'

**Array Format** (uses data attributes):
\`\`\`javascript
// HTML:
// <div class="product">
//   <span data-field="name">Laptop</span>
//   <span data-field="price">$999</span>
// </div>

const result = await fixiplug.dispatch('agent:extract', {
  selector: '.product',
  fields: ['name', 'price', 'stock']
});

// Returns:
// {
//   success: true,
//   count: 1,
//   data: [
//     { name: 'Laptop', price: '$999', stock: null }
//   ]
// }
\`\`\`

**Object Format** (uses CSS selectors):
\`\`\`javascript
// HTML:
// <tr>
//   <td>1</td>
//   <td>Laptop</td>
//   <td>$999</td>
// </tr>

const result = await fixiplug.dispatch('agent:extract', {
  selector: 'tr',
  fields: {
    id: 'td:nth-child(1)',
    name: 'td:nth-child(2)',
    price: 'td:nth-child(3)'
  }
});

// Returns:
// {
//   success: true,
//   count: 5,
//   data: [
//     { id: '1', name: 'Laptop', price: '$999' },
//     { id: '2', name: 'Mouse', price: '$29' },
//     ...
//   ],
//   fieldsFormat: 'object'
// }
\`\`\`

**Field Resolution Strategy** (array format):
1. \`[data-field="fieldname"]\` element text
2. \`[name="fieldname"]\` input value
3. \`[data-fieldname]\` element text
4. \`data-fieldname\` attribute value

---

### 5. agent:navigate - Navigate or Trigger Actions

**Purpose**: Navigate to URLs or trigger fx-action elements.

**Use When**:
- Page navigation
- Triggering AJAX requests
- Deep linking
- App routing

**Parameters**:
- \`url\` - URL to navigate to (full page load)
- \`action\` - fx-action endpoint to trigger (AJAX)
- \`trigger\` - Event type (default: 'click')

**Example**:
\`\`\`javascript
// Full page navigation
await fixiplug.dispatch('agent:navigate', {
  url: '/products'
});

// Trigger fx-action AJAX request
await fixiplug.dispatch('agent:navigate', {
  action: '/api/products/',
  trigger: 'click'
});

// Returns:
// {
//   success: true,
//   action: 'trigger',
//   endpoint: '/api/products/'
// }
\`\`\`

---

### 6. agent:waitFor - Wait for Conditions

**Purpose**: Wait for elements to appear or conditions to be met.

**Use When**:
- Waiting for AJAX content
- Modal dialogs to appear
- Form validation
- Dynamic content loading

**Parameters**:
- \`element\` - CSS selector to wait for
- \`condition\` - Function that returns boolean
- \`timeout\` - Max wait time in ms (default: 30000)

**Example**:
\`\`\`javascript
// Wait for element
await fixiplug.dispatch('agent:waitFor', {
  element: '.success-message',
  timeout: 5000
});

// Wait for custom condition
await fixiplug.dispatch('agent:waitFor', {
  condition: () => document.querySelectorAll('.product').length > 0,
  timeout: 10000
});

// Returns:
// {
//   success: true,
//   element: '.success-message',
//   found: true,
//   waited: 1234  // milliseconds
// }
\`\`\`

**Timeout Handling**:
\`\`\`javascript
const result = await fixiplug.dispatch('agent:waitFor', {
  element: '.missing-element',
  timeout: 1000
});

if (result.error) {
  console.log('Timeout:', result.waited, 'ms');
  // { error: 'Timeout waiting for element', waited: 1000 }
}
\`\`\`

---

### 7. agent:submitForm - Fill and Submit

**Purpose**: Fill form and submit in one atomic operation.

**Use When**:
- User registration workflows
- Login forms
- Search forms
- Quick form submission

**Parameters**:
- \`form\` - Form identifier
- \`data\` - Field data object

**Example**:
\`\`\`javascript
await fixiplug.dispatch('agent:submitForm', {
  form: 'login-form',
  data: {
    username: 'admin',
    password: 'secret123'
  }
});

// Returns:
// {
//   success: true,
//   form: 'login-form',
//   filled: ['username', 'password'],
//   submitted: true
// }
\`\`\`

**Error Cases**:
- Form not found
- Fields missing
- Submit button not found

## Workflow Patterns

### Pattern 1: Multi-Step Form Workflow

\`\`\`javascript
// Step 1: Fill registration form
const fillResult = await fixiplug.dispatch('agent:fillForm', {
  form: 'registration',
  data: {
    email: 'user@example.com',
    username: 'newuser',
    password: 'secure123'
  }
});

if (!fillResult.success) {
  throw new Error('Failed to fill form: ' + fillResult.error);
}

// Step 2: Click submit
await fixiplug.dispatch('agent:clickButton', {
  text: 'Register'
});

// Step 3: Wait for success message
await fixiplug.dispatch('agent:waitFor', {
  element: '.registration-success',
  timeout: 5000
});

// Step 4: Extract confirmation data
const confirmation = await fixiplug.dispatch('agent:extract', {
  selector: '.registration-success',
  fields: ['message', 'userId']
});

console.log('Registration complete:', confirmation.data);
\`\`\`

---

### Pattern 2: Search and Filter Workflow

\`\`\`javascript
// Step 1: Fill search form
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-search',
  data: {
    query: 'laptop',
    min_price: 500,
    max_price: 2000
  }
});

// Step 2: Submit search
await fixiplug.dispatch('agent:clickButton', {
  text: 'Search'
});

// Step 3: Wait for results
await fixiplug.dispatch('agent:waitFor', {
  element: '.search-results',
  timeout: 10000
});

// Step 4: Query results table
const results = await fixiplug.dispatch('agent:queryTable', {
  table: 'search-results',
  filter: {
    price__gte: 500,
    price__lte: 2000,
    rating__gte: 4.0
  }
});

console.log(\`Found \${results.count} matching products\`);
\`\`\`

---

### Pattern 3: Data Extraction and Processing

\`\`\`javascript
// Extract product listings
const products = await fixiplug.dispatch('agent:extract', {
  selector: '.product-card',
  fields: {
    name: '.product-name',
    price: '.product-price',
    rating: '.product-rating',
    inStock: '.stock-status'
  }
});

// Filter in-memory
const availableProducts = products.data.filter(p =>
  p.inStock === 'In Stock' && parseFloat(p.price.replace('$', '')) < 1000
);

console.log('Available products under $1000:', availableProducts);
\`\`\`

---

### Pattern 4: Integration with State Tracker

\`\`\`javascript
// Track form submission state
await fixiplug.dispatch('api:setState', {
  state: 'filling-form',
  data: { formName: 'checkout' }
});

await fixiplug.dispatch('agent:fillForm', {
  form: 'checkout',
  data: {
    name: 'John Doe',
    address: '123 Main St',
    city: 'Boston'
  }
});

await fixiplug.dispatch('api:setState', {
  state: 'submitting-form'
});

await fixiplug.dispatch('agent:submitForm', {
  form: 'checkout',
  data: { /* already filled */ }
});

// Wait for state transition to success
await fixiplug.dispatch('api:waitForState', {
  state: 'order-complete',
  timeout: 30000
});

const state = await fixiplug.dispatch('api:getCurrentState');
console.log('Order ID:', state.data.orderId);
\`\`\`

## Best Practices

### 1. Always Check Success

\`\`\`javascript
// ❌ Don't assume success
await fixiplug.dispatch('agent:fillForm', { form: 'myform', data: {...} });

// ✅ Do check results
const result = await fixiplug.dispatch('agent:fillForm', {
  form: 'myform',
  data: {...}
});

if (!result.success) {
  console.error('Form fill failed:', result.error);
  // Handle error...
}
\`\`\`

### 2. Use Semantic Identifiers

\`\`\`javascript
// ❌ Don't use fragile selectors
await fixiplug.dispatch('agent:fillForm', {
  form: 'body > div:nth-child(3) > form',
  data: {...}
});

// ✅ Do use semantic identifiers
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',  // name or id
  data: {...}
});
\`\`\`

### 3. Combine with State Management

\`\`\`javascript
// Track operation state
await fixiplug.dispatch('api:setState', { state: 'searching' });

const results = await fixiplug.dispatch('agent:queryTable', {
  table: 'products',
  filter: { category: 'Electronics' }
});

await fixiplug.dispatch('api:setState', {
  state: 'results-ready',
  data: { count: results.count }
});
\`\`\`

### 4. Wait for Async Operations

\`\`\`javascript
// After triggering AJAX
await fixiplug.dispatch('agent:clickButton', { text: 'Load More' });

// Wait for new content
await fixiplug.dispatch('agent:waitFor', {
  element: '.newly-loaded-content',
  timeout: 5000
});
\`\`\`

### 5. Handle Partial Success

\`\`\`javascript
const result = await fixiplug.dispatch('agent:fillForm', {
  form: 'contact-form',
  data: {
    name: 'John',
    email: 'john@example.com',
    phone: '555-1234',
    country: 'USA'
  }
});

// Some fields may fail
if (result.errors && result.errors.length > 0) {
  console.log('Filled:', result.filled);
  console.log('Errors:', result.errors);
  // Retry failed fields or notify user
}
\`\`\`

## Django Integration

### Django-Style Filters

The \`agent:queryTable\` command supports Django ORM-style filter syntax:

\`\`\`javascript
// Django QuerySet equivalent:
// Product.objects.filter(price__gte=100, category__icontains='tech')

await fixiplug.dispatch('agent:queryTable', {
  table: 'products',
  filter: {
    price__gte: 100,
    category__icontains: 'tech'
  }
});
\`\`\`

### Form Field Mapping

Django form fields map directly to agent commands:

\`\`\`python
# Django form
class ProductForm(forms.Form):
    name = forms.CharField(max_length=100)
    price = forms.DecimalField()
    category = forms.ChoiceField(choices=CATEGORIES)
    in_stock = forms.BooleanField()
\`\`\`

\`\`\`javascript
// Fill form
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',
  data: {
    name: 'Laptop',
    price: 999.99,
    category: 'electronics',
    in_stock: true
  }
});
\`\`\`

## Common Pitfalls

### ❌ Don't mix high-level and low-level APIs

\`\`\`javascript
// BAD: Mixing paradigms
const form = document.querySelector('form');  // Low-level DOM
await fixiplug.dispatch('agent:fillForm', { form: 'myform', data: {...} });  // High-level
\`\`\`

### ✅ Do use consistent abstraction level

\`\`\`javascript
// GOOD: Stick with agent commands
await fixiplug.dispatch('agent:fillForm', { form: 'myform', data: {...} });
await fixiplug.dispatch('agent:submitForm', { form: 'myform' });
\`\`\`

### ❌ Don't ignore timeouts

\`\`\`javascript
// BAD: No timeout handling
await fixiplug.dispatch('agent:waitFor', { element: '.result' });
\`\`\`

### ✅ Do set reasonable timeouts

\`\`\`javascript
// GOOD: Handle timeout errors
const result = await fixiplug.dispatch('agent:waitFor', {
  element: '.result',
  timeout: 5000
});

if (result.error) {
  // Handle timeout...
}
\`\`\`

### ❌ Don't forget async operations

\`\`\`javascript
// BAD: Not waiting for async result
fixiplug.dispatch('agent:queryTable', { table: 'products' });  // Missing await
const count = results.count;  // Error: results is a Promise
\`\`\`

### ✅ Do await all commands

\`\`\`javascript
// GOOD: Await async operations
const results = await fixiplug.dispatch('agent:queryTable', {
  table: 'products'
});
console.log('Count:', results.count);
\`\`\`

## Performance Tips

1. **Batch form fills**: Use \`agent:fillForm\` instead of filling fields one-by-one
2. **Use filters**: Filter on server/client side with \`agent:queryTable\` instead of extracting all data
3. **Set limits**: Use \`limit\` parameter to avoid extracting huge datasets
4. **Reuse queries**: Cache query results instead of re-querying
5. **Combine operations**: Use \`agent:submitForm\` instead of separate fill + click

## Summary

The Agent Command Interface provides:

- **7 high-level commands** for common web interactions
- **Django-style filters** for table queries
- **Flexible extraction** with array or object field definitions
- **Async coordination** with wait and timeout handling
- **Error handling** with detailed success/error responses

**When to use**: Prefer agent commands over direct DOM manipulation for cleaner, more maintainable code.

**Integration**: Works seamlessly with state-tracker, table, and fixi-agent plugins.
`,

      references: [
        'stateTrackerPlugin',
        'tablePlugin',
        'fixiAgentPlugin'
      ],

      tags: [
        'agent',
        'commands',
        'forms',
        'tables',
        'navigation',
        'extraction',
        'django',
        'high-level-api'
      ],

      version: '1.0.0',
      author: 'FixiPlug Team',
      level: 'beginner'
    }
  };
}
