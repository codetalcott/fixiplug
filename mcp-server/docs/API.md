# FixiPlug MCP Server - API Reference

Complete reference for all MCP tools provided by the FixiPlug server.

## Response Format

All tools return a standardized response format:

### Success Response

```typescript
{
  success: true,
  data: any,              // Tool-specific data
  meta: {
    timestamp: string,    // ISO 8601 timestamp
    executionTime: number, // Execution time in ms
    // ...additional metadata
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: string,          // Error message
  meta: {
    timestamp: string,
    executionTime: number,
    args?: any,           // Original arguments (for debugging)
    // ...additional metadata
  }
}
```

## Tools

### query_courses

Query course data from the Django database. Supports search, filtering, and pagination.

**Performance:** Tries direct API call first (fast), falls back to browser if needed.

**Parameters:**

```typescript
{
  filter?: {
    search?: string,    // Search query (matches title, subject, student name)
    page?: number       // Page number (must be positive integer)
  },
  limit?: number        // Results per page (1-100, default: 25)
}
```

**Response Data:**

```typescript
{
  data: Array<{
    id: number,
    // ...course fields
  }>,
  columns: Array<{
    key: string,
    label: string,
    sortable?: boolean
  }>,
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  meta: {
    editable: boolean,
    searchable: boolean
  }
}
```

**Meta Fields:**
- `method`: `"direct-api"` or `"browser-fallback"`
- `executionTime`: Time taken in milliseconds

**Example:**

```json
{
  "filter": {
    "search": "calculus",
    "page": 2
  },
  "limit": 50
}
```

**Error Conditions:**
- Invalid page number (negative or zero)
- Limit out of range (< 1 or > 100)
- Network error (HTTP timeout or connection refused)
- Server error (HTTP 500)

---

### click_button

Click a button on the page using FixiPlug agent command.

**Requirements:** Browser must be active

**Parameters:**

```typescript
{
  selector?: string,    // CSS selector for button
  text?: string        // Button text to search for
}
// Must provide at least one: selector or text
```

**Response Data:**

```typescript
{
  success: boolean,
  clicked: string,      // Text of clicked button
  element: string       // Element tag name
}
```

**Example:**

```json
{
  "text": "Submit"
}
```

Or:

```json
{
  "selector": "#submit-btn"
}
```

**Error Conditions:**
- Browser not active
- Neither selector nor text provided
- Button not found
- Element is not clickable

---

### extract_data

Extract structured data from page elements using CSS selectors.

**Requirements:** Browser must be active

**Parameters:**

```typescript
{
  selector: string,                    // CSS selector for container elements
  fields?: {                           // Field mapping
    [fieldName: string]: string        // fieldName -> CSS selector
  } | string[]                         // OR array of field names
}
```

**Field Formats:**

1. **Object Format** (CSS selectors):
   ```json
   {
     "selector": "tr",
     "fields": {
       "id": "td:nth-child(1)",
       "name": "td:nth-child(2)",
       "price": "td:nth-child(3)"
     }
   }
   ```

2. **Array Format** (data attributes):
   ```json
   {
     "selector": ".product-card",
     "fields": ["name", "price", "stock"]
   }
   ```

   Looks for elements with `data-field="name"`, `name="price"`, etc.

**Response Data:**

```typescript
{
  success: boolean,
  count: number,
  data: Array<{
    [fieldName: string]: string | null
  }>,
  selector: string,
  fieldsFormat: "array" | "object"
}
```

**Example Response:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {"id": "1", "name": "Product A", "price": "19.99"},
    {"id": "2", "name": "Product B", "price": "29.99"},
    {"id": "3", "name": "Product C", "price": "39.99"}
  ],
  "selector": "tr",
  "fieldsFormat": "object"
}
```

**Error Conditions:**
- Browser not active
- Invalid selector
- Fields must be array or object
- Elements not found (returns empty array, not error)

---

### fill_form

Fill form fields programmatically using FixiPlug agent command.

**Requirements:** Browser must be active

**Parameters:**

```typescript
{
  form_selector: string,              // CSS selector for form element
  data: {
    [fieldName: string]: any          // Field values
  }
}
```

**Supported Input Types:**
- Text inputs (text, email, password, etc.)
- Textareas
- Select dropdowns (by value or text)
- Checkboxes (boolean)
- Radio buttons (by value)

**Response Data:**

```typescript
{
  success: boolean,
  form: string,
  filled: string[],    // Successfully filled field names
  errors?: Array<{
    field: string,
    error: string
  }>
}
```

**Example:**

```json
{
  "form_selector": "#contact-form",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "subscribe": true
  }
}
```

**Error Conditions:**
- Browser not active
- Form not found
- Field not found
- Invalid value for field type
- File inputs (not supported)

---

### navigate

Navigate to a URL in the browser.

**Requirements:** Browser must be active

**Parameters:**

```typescript
{
  url: string    // URL path or full URL
}
```

**Behavior:**
- Full URLs (starting with `http://` or `https://`) are used as-is
- Relative paths are appended to `baseUrl`
- Waits for page load (`domcontentloaded` event)
- Attempts to wait for FixiPlug to load (warns if not available)

**Response Data:**

```typescript
{
  message: string    // "Navigated to {url}"
}
```

**Example:**

```json
{
  "url": "/experimental/courses/"
}
```

**Error Conditions:**
- Browser not active
- Invalid URL
- Navigation timeout
- Page load error (404, 500, etc.)

---

### get_table_data

Extract all data from a table on the page.

**Requirements:** Browser must be active

**Parameters:**

```typescript
{
  table_selector?: string    // CSS selector (default: "#course-table")
}
```

**Response Data:**

Depends on table plugin implementation. Typically:

```typescript
{
  data: Array<{
    [column: string]: any
  }>,
  columns: Array<{
    key: string,
    label: string
  }>
}
```

**Example:**

```json
{
  "table_selector": "#products-table"
}
```

**Error Conditions:**
- Browser not active
- Table not found
- Table plugin not loaded
- Unable to extract data

---

## Configuration

### Timeouts

Default timeout values (configurable):

| Operation | Default | Description |
|-----------|---------|-------------|
| Page load | 30000ms | Waiting for page to load |
| FixiPlug load | 5000ms | Waiting for FixiPlug to initialize |
| Command execution | 10000ms | Agent command timeout |
| API request | 5000ms | Direct API call timeout |

### Retries

Direct API calls are retried on failure:
- Default retries: 3
- Configurable via `config.api.retries`

## Error Codes

Common error messages:

| Error | Cause | Solution |
|-------|-------|----------|
| `Browser not active` | Browser hasn't been started | Start browser first |
| `Form not found: {id}` | Form element doesn't exist | Check selector |
| `Button not found` | No matching button | Verify text/selector |
| `HTTP {code}: {message}` | Server error | Check Django logs |
| `Timeout waiting for element` | Element never appeared | Increase timeout or check page |
| `Field not found` | Form field doesn't exist | Verify field name |

## Best Practices

### Performance

1. **Use Direct API When Possible**
   - `query_courses` tries direct API first (faster)
   - Browser operations are slower but more flexible

2. **Minimize Browser Operations**
   - Batch operations when possible
   - Use direct API for data queries
   - Use browser only for DOM interactions

3. **Configure Timeouts Appropriately**
   - Increase for slow networks
   - Decrease for fast local development

### Error Handling

1. **Always Check `success` Field**
   ```typescript
   const result = await tool(...);
   if (!result.success) {
     console.error(result.error);
     // Handle error
   }
   ```

2. **Use Execution Time for Debugging**
   ```typescript
   console.log(`Operation took ${result.meta.executionTime}ms`);
   ```

3. **Examine `meta.args` on Errors**
   - Helps debug what was passed to the tool

### Security

1. **Validate Input**
   - All inputs are validated with Zod schemas
   - Invalid inputs are rejected before execution

2. **Limited Scope**
   - Tools can only interact with configured Django application
   - No file system access
   - No arbitrary code execution

3. **Read-Only by Default**
   - Most operations are read-only
   - Write operations (`fill_form`) require explicit user intent

## Type Definitions

See [core/types.ts](../src/core/types.ts) for complete TypeScript definitions.

### ToolResponse<T>

```typescript
interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp?: string;
    executionTime?: number;
    [key: string]: any;
  };
}
```

### Config

```typescript
interface Config {
  baseUrl: string;
  browser: {
    headless: boolean;
    timeout: {
      page: number;
      fixiplug: number;
      command: number;
    };
  };
  api: {
    timeout: number;
    retries: number;
  };
}
```
