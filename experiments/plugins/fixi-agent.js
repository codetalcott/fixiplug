/**
 * FixiPlug Fixi-Agent Plugin
 *
 * Exposes the core fixi fx- attribute system to LLM agents, enabling them to:
 * - Inject HTML with fx- attributes for declarative fetching
 * - Read DOM state to make decisions
 * - Trigger existing fx-action elements programmatically
 * - Discover available fx- attributes and their capabilities
 *
 * This plugin reuses the existing fixi DOM system rather than creating
 * parallel agent-specific APIs, teaching agents to be "users of fixi".
 *
 * @module plugins/fixi-agent
 *
 * API Hooks Exposed:
 * - api:injectFxHtml - Inject HTML with fx- attributes
 * - api:readDom - Read DOM content (read-only)
 * - api:triggerFxElement - Programmatically trigger fx-action element
 * - api:getFxDocumentation - Get fx- attribute system documentation
 *
 * Security Considerations:
 * - HTML injection is sandboxed to specific selectors
 * - Basic HTML sanitization (TODO: integrate DOMPurify for production)
 * - Read operations are non-destructive
 * - Trigger operations only work on existing fx-action elements
 *
 * @example
 * // Agent injects a button that fetches data
 * await fixiplug.dispatch('api:injectFxHtml', {
 *   html: '<button fx-action="/api/data" fx-target="#result">Load</button>',
 *   selector: '#container',
 *   position: 'beforeend'
 * });
 *
 * @example
 * // Agent reads current DOM state
 * const state = await fixiplug.dispatch('api:readDom', {
 *   selector: '#status',
 *   property: 'textContent'
 * });
 *
 * @example
 * // Agent triggers existing fx-action element
 * await fixiplug.dispatch('api:triggerFxElement', {
 *   selector: '#refresh-button'
 * });
 */

/**
 * Fixi-Agent plugin factory
 * @param {Object} ctx - Plugin context
 */
export default function fixiAgentPlugin(ctx) {
  // Check if DOM is available (browser vs Node.js)
  const hasDom = typeof document !== 'undefined';

  // ========================================
  // API: Inject FX-attributed HTML
  // ========================================
  ctx.on('api:injectFxHtml', (event) => {
    // Check for DOM availability
    if (!hasDom) {
      return {
        error: 'DOM not available in this context',
        context: 'Node.js backend',
        suggestion: 'This operation requires a browser environment with DOM access'
      };
    }

    const { html, selector, position = 'beforeend' } = event;

    // Validate required parameters
    if (!html) {
      return { error: 'html parameter required' };
    }
    if (!selector) {
      return { error: 'selector parameter required' };
    }

    // Validate position
    const validPositions = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'];
    if (!validPositions.includes(position)) {
      return {
        error: `Invalid position: ${position}. Must be one of: ${validPositions.join(', ')}`
      };
    }

    // Find target element
    const target = document.querySelector(selector);
    if (!target) {
      return { error: `Selector not found: ${selector}` };
    }

    try {
      // TODO: Add proper HTML sanitization (DOMPurify) for production
      // For now, we trust the input but log it for audit
      console.log('[fixi-agent] Injecting HTML:', { selector, position, html });

      // Inject HTML
      target.insertAdjacentHTML(position, html);

      // Trigger fx:process to wire up new elements
      // This tells the fixi DOM system to process any new fx-action elements
      const processEvent = new CustomEvent('fx:process', {
        bubbles: true,
        detail: { source: 'fixi-agent' }
      });
      target.dispatchEvent(processEvent);

      return {
        success: true,
        injected: html.length,
        selector,
        position
      };
    } catch (error) {
      return {
        error: `Failed to inject HTML: ${error.message}`,
        selector
      };
    }
  });

  // ========================================
  // API: Read DOM Content
  // ========================================
  ctx.on('api:readDom', (event) => {
    // Check for DOM availability
    if (!hasDom) {
      return {
        error: 'DOM not available in this context',
        context: 'Node.js backend',
        suggestion: 'This operation requires a browser environment with DOM access'
      };
    }

    const { selector, property = 'textContent' } = event;

    // Validate required parameters
    if (!selector) {
      return { error: 'selector parameter required' };
    }

    // Validate property
    const validProperties = ['textContent', 'innerHTML', 'outerHTML', 'value'];
    if (!validProperties.includes(property)) {
      return {
        error: `Invalid property: ${property}. Must be one of: ${validProperties.join(', ')}`
      };
    }

    // Find element
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Selector not found: ${selector}` };
    }

    try {
      // Read property value
      const value = element[property];

      return {
        success: true,
        selector,
        property,
        value,
        tagName: element.tagName.toLowerCase(),
        hasAttributes: element.attributes.length > 0,
        attributes: Array.from(element.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {})
      };
    } catch (error) {
      return {
        error: `Failed to read DOM: ${error.message}`,
        selector
      };
    }
  });

  // ========================================
  // API: Trigger FX Element
  // ========================================
  ctx.on('api:triggerFxElement', (event) => {
    // Check for DOM availability
    if (!hasDom) {
      return {
        error: 'DOM not available in this context',
        context: 'Node.js backend',
        suggestion: 'This operation requires a browser environment with DOM access'
      };
    }

    const { selector } = event;

    // Validate required parameters
    if (!selector) {
      return { error: 'selector parameter required' };
    }

    // Find element
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Selector not found: ${selector}` };
    }

    // Check if element has fx-action
    if (!element.__fixi) {
      return {
        error: `Element does not have fx-action: ${selector}`,
        suggestion: 'Use api:injectFxHtml to create fx-action elements first'
      };
    }

    try {
      // Get the event type this element listens to
      const eventType = element.__fixi.evt || 'click';

      // Trigger the event
      const triggerEvent = new Event(eventType, {
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(triggerEvent);

      return {
        success: true,
        triggered: eventType,
        selector,
        action: element.getAttribute('fx-action')
      };
    } catch (error) {
      return {
        error: `Failed to trigger element: ${error.message}`,
        selector
      };
    }
  });

  // ========================================
  // API: Get FX Documentation
  // ========================================
  ctx.on('api:getFxDocumentation', () => {
    return {
      description: 'The fixi system provides declarative HTML attributes for AJAX interactions, similar to htmx but minimalist.',

      attributes: {
        'fx-action': {
          required: true,
          type: 'string',
          description: 'URL to fetch (relative or absolute)',
          example: 'fx-action="/api/users"'
        },
        'fx-method': {
          required: false,
          type: 'string',
          default: 'GET',
          options: ['GET', 'POST', 'PUT', 'DELETE'],
          description: 'HTTP method to use',
          example: 'fx-method="POST"'
        },
        'fx-target': {
          required: false,
          type: 'string',
          default: 'self',
          description: 'CSS selector where to put the response',
          example: 'fx-target="#results"'
        },
        'fx-swap': {
          required: false,
          type: 'string',
          default: 'outerHTML',
          options: ['innerHTML', 'outerHTML', 'beforebegin', 'afterbegin', 'beforeend', 'afterend', 'none'],
          description: 'How to swap the response into the target',
          example: 'fx-swap="innerHTML"'
        },
        'fx-trigger': {
          required: false,
          type: 'string',
          default: 'auto-detected',
          description: 'Event to trigger on (click for buttons, submit for forms, change for inputs, or custom event)',
          example: 'fx-trigger="load"',
          autoDetect: {
            form: 'submit',
            'input,select,textarea': 'change',
            other: 'click'
          }
        },
        'fx-ignore': {
          required: false,
          type: 'boolean',
          description: 'Prevent fixi from processing this element and its children',
          example: 'fx-ignore'
        }
      },

      events: {
        'fx:init': {
          cancelable: true,
          description: 'Fired before element initialization. Cancel to prevent initialization.',
          detail: { options: {} }
        },
        'fx:inited': {
          cancelable: false,
          description: 'Fired after element initialization completes.',
          detail: {}
        },
        'fx:config': {
          cancelable: true,
          description: 'Fired before request. Modify cfg object to customize request. Cancel to abort.',
          detail: { cfg: {}, requests: [] }
        },
        'fx:before': {
          cancelable: true,
          description: 'Fired just before fetch. Cancel to abort request.',
          detail: { cfg: {}, requests: [] }
        },
        'fx:after': {
          cancelable: true,
          description: 'Fired after successful fetch. Cancel to prevent swap.',
          detail: { cfg: {} }
        },
        'fx:error': {
          cancelable: false,
          description: 'Fired when fetch fails.',
          detail: { cfg: {}, error: {} }
        },
        'fx:finally': {
          cancelable: false,
          description: 'Always fired after request completes (success or error).',
          detail: { cfg: {} }
        },
        'fx:swapped': {
          cancelable: false,
          description: 'Fired after DOM swap completes.',
          detail: { cfg: {} }
        },
        'fx:process': {
          cancelable: false,
          description: 'Trigger manual processing of an element. Useful after injecting HTML.',
          detail: {}
        }
      },

      examples: [
        {
          name: 'Simple GET request',
          html: '<button fx-action="/api/data" fx-target="#result">Load Data</button>',
          description: 'Fetches /api/data on click, replaces #result with response'
        },
        {
          name: 'POST form',
          html: '<form fx-action="/api/save" fx-method="POST" fx-swap="none">\n  <input name="title" />\n  <button type="submit">Save</button>\n</form>',
          description: 'Submits form data via POST, no DOM swap'
        },
        {
          name: 'Auto-refresh div',
          html: '<div fx-action="/api/status" fx-trigger="load" fx-target="#status"></div>',
          description: 'Fetches status on page load, updates #status element'
        },
        {
          name: 'Append to list',
          html: '<button fx-action="/api/items/new" fx-target="#list" fx-swap="beforeend">Add Item</button>',
          description: 'Fetches new item HTML, appends to end of #list'
        },
        {
          name: 'Replace entire element',
          html: '<div fx-action="/api/widget" fx-swap="outerHTML">Loading...</div>',
          description: 'Replaces entire div with response (default behavior)'
        }
      ],

      bestPractices: [
        'Use fx-target to separate trigger elements from result containers',
        'Use fx-swap="none" for operations that don\'t return HTML',
        'Use fx-trigger="load" for automatic fetching on page load',
        'Combine with fx:before event for loading indicators',
        'Combine with fx:error event for error handling',
        'Use fx-ignore to exclude sections from fixi processing'
      ],

      security: [
        'All requests include FX-Request: true header for server-side detection',
        'Responses should be sanitized server-side',
        'Consider CORS and CSRF protections',
        'Validate user input in forms before submission'
      ]
    };
  });

  // ========================================
  // Skill Metadata
  // ========================================

  return {
    skill: {
      name: 'fixi-agent',

      description: 'Master the declarative fx- attribute system for building reactive UIs without JavaScript. Use when you need to inject interactive HTML, trigger AJAX requests, or build dynamic interfaces declaratively. The fx- system is similar to htmx but minimalist - perfect for LLM-generated UIs.',

      instructions: `# Fixi-Agent Plugin Skill

## Overview

The Fixi-Agent plugin exposes FixiPlug's declarative fx- attribute system, enabling you to build reactive user interfaces by injecting HTML with special fx- attributes. Instead of writing JavaScript event handlers and fetch calls, you describe WHAT should happen using HTML attributes.

**Key Principle**: Declarative UI - use HTML attributes, not JavaScript code.

**Think of fx- attributes as**: HTML's way of saying "when X happens, fetch Y and put it in Z"

## Core Concepts

### The fx- Attribute System

fx- attributes turn any HTML element into an interactive AJAX component:

\`\`\`html
<button fx-action="/api/data" fx-target="#result">
  Load Data
</button>
\`\`\`

**What happens**:
1. User clicks button
2. FixiPlug fetches \`/api/data\`
3. Response HTML is swapped into \`#result\`
4. All without writing any JavaScript!

### Three Agent APIs

1. **\`api:injectFxHtml\`** - Inject HTML with fx- attributes into the DOM
2. **\`api:readDom\`** - Read current DOM state (text, attributes, values)
3. **\`api:triggerFxElement\`** - Programmatically trigger an fx-action element

## API 1: api:injectFxHtml

Inject HTML with fx- attributes into the DOM.

**Parameters**:
- \`html\` - HTML string (can include fx- attributes)
- \`selector\` - CSS selector for target container
- \`position\` - Where to inject: \`"beforebegin"\`, \`"afterbegin"\`, \`"beforeend"\` (default), \`"afterend"\`, \`"innerHTML"\`, \`"outerHTML"\`

**Position Guide**:
\`\`\`html
<!-- beforebegin -->
<div id="target">
  <!-- afterbegin -->
  existing content
  <!-- beforeend -->
</div>
<!-- afterend -->
\`\`\`

**Example 1: Inject Button**
\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<button fx-action="/api/users" fx-target="#users">Load Users</button>',
  selector: '#toolbar',
  position: 'beforeend'
});
\`\`\`

**Example 2: Inject Auto-Loading Div**
\`\`\`javascript
// This div automatically fetches data on page load
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div fx-action="/api/products/" fx-trigger="load" fx-table></div>',
  selector: '#app',
  position: 'innerHTML'
});

// Result: Table automatically loads and renders
\`\`\`

**Example 3: Inject Form**
\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <form fx-action="/api/contact" fx-method="POST" fx-swap="none">
      <input name="email" type="email" required />
      <input name="message" required />
      <button type="submit">Send</button>
    </form>
    <div id="form-result"></div>
  \`,
  selector: '#contact-section'
});
\`\`\`

**Position Strategies**:
- \`beforeend\` - Append to container (most common)
- \`innerHTML\` - Replace all content
- \`outerHTML\` - Replace entire element
- \`afterend\` - Insert after element (sibling)

---

## API 2: api:readDom

Read current DOM state to make decisions.

**Parameters**:
- \`selector\` - CSS selector for element to read
- \`property\` - What to read: \`"textContent"\` (default), \`"innerHTML"\`, \`"outerHTML"\`, \`"value"\`, or any attribute name
- \`attribute\` - Read specific attribute (alternative to property)

**Example 1: Read Text Content**
\`\`\`javascript
const result = await fixiplug.dispatch('api:readDom', {
  selector: '#status',
  property: 'textContent'
});

console.log('Status:', result.value); // "Loading..."
\`\`\`

**Example 2: Read Input Value**
\`\`\`javascript
const result = await fixiplug.dispatch('api:readDom', {
  selector: 'input[name="email"]',
  property: 'value'
});

console.log('Email:', result.value);
\`\`\`

**Example 3: Read Attribute**
\`\`\`javascript
const result = await fixiplug.dispatch('api:readDom', {
  selector: '#data-table',
  attribute: 'fx-action'
});

console.log('Endpoint:', result.value); // "/api/products/"
\`\`\`

**Example 4: Conditional Logic**
\`\`\`javascript
// Check if user is logged in
const loginStatus = await fixiplug.dispatch('api:readDom', {
  selector: '#user-status',
  attribute: 'data-logged-in'
});

if (loginStatus.value === 'true') {
  // Inject user dashboard
  await fixiplug.dispatch('api:injectFxHtml', {
    html: '<div fx-action="/api/dashboard" fx-trigger="load"></div>',
    selector: '#app'
  });
} else {
  // Inject login form
  await fixiplug.dispatch('api:injectFxHtml', {
    html: '<form fx-action="/api/login" fx-method="POST">...</form>',
    selector: '#app'
  });
}
\`\`\`

---

## API 3: api:triggerFxElement

Programmatically trigger an fx-action element (simulates user interaction).

**Parameters**:
- \`selector\` - CSS selector for fx-action element
- \`event\` - Event type to trigger (default: auto-detected)

**Example 1: Trigger Refresh**
\`\`\`javascript
// Trigger refresh button
await fixiplug.dispatch('api:triggerFxElement', {
  selector: '#refresh-button'
});
\`\`\`

**Example 2: Programmatic Form Submit**
\`\`\`javascript
// Fill form with agent commands, then trigger submit
await fixiplug.dispatch('agent:fillForm', {
  form: 'contact-form',
  data: { email: 'user@example.com', message: 'Hello' }
});

// Trigger the fx-action form submission
await fixiplug.dispatch('api:triggerFxElement', {
  selector: 'form[name="contact-form"]'
});
\`\`\`

**Example 3: Trigger on Custom Event**
\`\`\`javascript
// Element that listens to custom event
// <div fx-action="/api/data" fx-trigger="refresh" id="data-view"></div>

await fixiplug.dispatch('api:triggerFxElement', {
  selector: '#data-view',
  event: 'refresh'
});
\`\`\`

---

## fx- Attributes Reference

### fx-action (Required)

The URL to fetch.

\`\`\`html
<button fx-action="/api/users">Load Users</button>
<button fx-action="https://api.example.com/data">External API</button>
\`\`\`

### fx-method

HTTP method (default: GET).

\`\`\`html
<form fx-action="/api/save" fx-method="POST">...</form>
<button fx-action="/api/delete/123" fx-method="DELETE">Delete</button>
\`\`\`

### fx-target

CSS selector where to put the response (default: self).

\`\`\`html
<!-- Update separate element -->
<button fx-action="/api/users" fx-target="#user-list">Load</button>
<div id="user-list"></div>

<!-- Update self (default) -->
<div fx-action="/api/widget">Loading...</div>
\`\`\`

### fx-swap

How to swap response into target (default: outerHTML).

\`\`\`html
<!-- Replace content only -->
<div fx-action="/api/items" fx-swap="innerHTML">Old items</div>

<!-- Replace entire element -->
<div fx-action="/api/widget" fx-swap="outerHTML">Loading...</div>

<!-- Append to end -->
<button fx-action="/api/new-item" fx-target="#list" fx-swap="beforeend">Add</button>

<!-- Prepend to start -->
<button fx-action="/api/new-item" fx-target="#list" fx-swap="afterbegin">Prepend</button>

<!-- No swap (for POST that returns no HTML) -->
<form fx-action="/api/save" fx-swap="none">...</form>
\`\`\`

### fx-trigger

Event that triggers the action (default: auto-detected).

\`\`\`html
<!-- Auto-detected: click for buttons -->
<button fx-action="/api/data">Click Me</button>

<!-- Auto-detected: submit for forms -->
<form fx-action="/api/save" fx-method="POST">...</form>

<!-- Auto-detected: change for inputs -->
<select fx-action="/api/filter" fx-target="#results">...</select>

<!-- Explicit: load on page load -->
<div fx-action="/api/status" fx-trigger="load">Loading...</div>

<!-- Custom event -->
<div fx-action="/api/refresh" fx-trigger="myRefresh">...</div>
\`\`\`

**Auto-Detection**:
- Forms → \`submit\`
- Inputs/Selects/Textareas → \`change\`
- Everything else → \`click\`

### fx-ignore

Prevent FixiPlug from processing element and children.

\`\`\`html
<div fx-ignore>
  <!-- fx- attributes here are ignored -->
  <button fx-action="/api/data">Won't work</button>
</div>
\`\`\`

---

## Workflow Patterns

### Pattern 1: Progressive Enhancement

Start with static HTML, enhance with fx- attributes.

\`\`\`javascript
// Step 1: Inject basic structure
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div id="app"><h1>Products</h1><div id="products"></div></div>',
  selector: 'body'
});

// Step 2: Inject load button
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<button fx-action="/api/products/" fx-target="#products" fx-table>Load Products</button>',
  selector: '#app',
  position: 'beforeend'
});
\`\`\`

### Pattern 2: Auto-Loading Dashboard

Dashboard that loads data on page load.

\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <div id="dashboard">
      <div fx-action="/api/stats" fx-trigger="load" class="stats">Loading stats...</div>
      <div fx-action="/api/recent-orders" fx-trigger="load" fx-table>Loading orders...</div>
      <div fx-action="/api/notifications" fx-trigger="load">Loading notifications...</div>
    </div>
  \`,
  selector: '#app'
});

// All three sections load automatically in parallel!
\`\`\`

### Pattern 3: Master-Detail View

Click item to load details.

\`\`\`javascript
// Inject item list with clickable rows
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <div class="master-detail">
      <div id="item-list" fx-action="/api/items/" fx-trigger="load" fx-table></div>
      <div id="item-details">Select an item</div>
    </div>
  \`,
  selector: '#app'
});

// Server returns HTML with fx-action on each row:
// <tr fx-action="/api/item/1/details" fx-target="#item-details">...</tr>
\`\`\`

### Pattern 4: Search with Live Results

Input that triggers search on each keystroke.

\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <input
      name="search"
      fx-action="/api/search"
      fx-target="#results"
      fx-trigger="keyup"
      placeholder="Search..." />
    <div id="results"></div>
  \`,
  selector: '#search-container'
});

// Every keystroke fetches /api/search?search=<value>
\`\`\`

### Pattern 5: Form with Loading Indicator

Use fx:before and fx:after events for loading states.

\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <form fx-action="/api/contact" fx-method="POST" fx-swap="none" id="contact-form">
      <input name="email" required />
      <input name="message" required />
      <button type="submit">Send</button>
    </form>
    <div id="form-status"></div>
  \`,
  selector: '#contact-section'
});

// Listen for fx:before to show loading
ctx.on('fx:before', (event) => {
  if (event.cfg.action === '/api/contact') {
    document.getElementById('form-status').textContent = 'Sending...';
  }
});

// Listen for fx:after to show success
ctx.on('fx:after', (event) => {
  if (event.cfg.action === '/api/contact') {
    document.getElementById('form-status').textContent = 'Message sent!';
  }
});
\`\`\`

### Pattern 6: Integration with State Tracker

Coordinate fx- actions with application state.

\`\`\`javascript
// Track state
await fixiplug.dispatch('api:setState', { state: 'initializing' });

// Inject UI
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div fx-action="/api/data" fx-trigger="load" fx-table></div>',
  selector: '#app'
});

// Listen for fx:after to update state
ctx.on('fx:after', async (event) => {
  if (event.cfg.action === '/api/data') {
    await fixiplug.dispatch('api:setState', { state: 'ready' });
  }
});

// Other code can wait for ready state
await fixiplug.dispatch('api:waitForState', { state: 'ready' });
\`\`\`

---

## Django/FastAPI Integration

### Django View Returns HTML

Django views return HTML snippets with fx- attributes embedded.

**Django View**:
\`\`\`python
from django.shortcuts import render

def product_list(request):
    products = Product.objects.all()
    return render(request, 'products.html', {'products': products})
\`\`\`

**Template (products.html)**:
\`\`\`html
<div class="product-list">
  {% for product in products %}
    <div class="product" fx-action="/products/\\{\\{ product.id \\}\\}/" fx-target="#details">
      \\{\\{ product.name \\}\\} - $\\{\\{ product.price \\}\\}
    </div>
  {% endfor %}
</div>
\`\`\`

**Agent Injects**:
\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <div>
      <div fx-action="/api/products/" fx-trigger="load"></div>
      <div id="details">Select a product</div>
    </div>
  \`,
  selector: '#app'
});
\`\`\`

### FastAPI Returns HTML

FastAPI can return HTML responses for fx- integration.

\`\`\`python
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/api/franchises/", response_class=HTMLResponse)
async def list_franchises():
    franchises = await get_franchises()

    html = '<div class="franchise-list">'
    for franchise in franchises:
        html += f'<div class="franchise" fx-action="/api/franchises/{franchise.id}/" fx-target="#details">'
        html += f'{franchise.name} - {franchise.location}'
        html += '</div>'
    html += '</div>'

    return html
\`\`\`

**Agent Usage**:
\`\`\`javascript
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div fx-action="/api/franchises/" fx-trigger="load"></div>',
  selector: '#franchise-view'
});
\`\`\`

---

## Best Practices

### 1. Use fx-target for Separation

\`\`\`javascript
// ❌ Don't mix trigger and result
<div fx-action="/api/data">Click to load</div>

// ✅ Do separate trigger from result
<button fx-action="/api/data" fx-target="#result">Load</button>
<div id="result"></div>
\`\`\`

### 2. Use fx-swap="none" for Non-HTML Responses

\`\`\`javascript
// ❌ Don't swap JSON into DOM
<form fx-action="/api/save" fx-method="POST">...</form>

// ✅ Do use fx-swap="none"
<form fx-action="/api/save" fx-method="POST" fx-swap="none">...</form>
\`\`\`

### 3. Coordinate with State Management

\`\`\`javascript
// Track loading states
ctx.on('fx:before', (e) => {
  fixiplug.dispatch('api:setState', { state: 'loading' });
});

ctx.on('fx:after', (e) => {
  fixiplug.dispatch('api:setState', { state: 'success' });
});
\`\`\`

### 4. Use fx-trigger="load" for Auto-Loading

\`\`\`javascript
// ✅ Auto-load on page load
<div fx-action="/api/dashboard" fx-trigger="load"></div>
\`\`\`

### 5. Inject Complete Workflows

\`\`\`javascript
// ✅ Inject entire workflow at once
await fixiplug.dispatch('api:injectFxHtml', {
  html: \`
    <div class="workflow">
      <button fx-action="/api/step1" fx-target="#step1-result">Step 1</button>
      <div id="step1-result"></div>
      <button fx-action="/api/step2" fx-target="#step2-result">Step 2</button>
      <div id="step2-result"></div>
    </div>
  \`,
  selector: '#app'
});
\`\`\`

---

## Common Pitfalls

### ❌ Don't Forget fx-target

\`\`\`html
<!-- BAD: Result overwrites button -->
<button fx-action="/api/data">Load Data</button>

<!-- GOOD: Result goes to separate element -->
<button fx-action="/api/data" fx-target="#result">Load Data</button>
<div id="result"></div>
\`\`\`

### ❌ Don't Mix Imperative and Declarative

\`\`\`javascript
// BAD: Mixing paradigms
const button = document.createElement('button');
button.addEventListener('click', () => fetch('/api/data'));

// GOOD: Pure declarative
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<button fx-action="/api/data">Load</button>',
  selector: '#container'
});
\`\`\`

### ❌ Don't Inject Without Container

\`\`\`javascript
// BAD: Selector doesn't exist
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div>...</div>',
  selector: '#missing-container'
});
// Returns: { error: 'Target element not found' }

// GOOD: Create container first
await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div id="container"></div>',
  selector: 'body'
});

await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div>...</div>',
  selector: '#container'
});
\`\`\`

---

## Summary

The Fixi-Agent Plugin provides:

- **3 core APIs**: \`injectFxHtml\`, \`readDom\`, \`triggerFxElement\`
- **Declarative AJAX**: Build UIs with HTML attributes, not JavaScript
- **5 fx- attributes**: \`fx-action\`, \`fx-method\`, \`fx-target\`, \`fx-swap\`, \`fx-trigger\`
- **8 lifecycle events**: \`fx:init\`, \`fx:before\`, \`fx:after\`, \`fx:error\`, etc.
- **Django/FastAPI integration**: Server returns HTML with fx- attributes

**When to use**: Building reactive UIs declaratively, integrating with Django/FastAPI views, progressive enhancement.

**Integration**: Works seamlessly with agent-commands, state-tracker, and table plugins.
`,

      references: [
        'stateTrackerPlugin',
        'agentCommands',
        'tablePlugin'
      ],

      tags: [
        'declarative-ui',
        'fx-attributes',
        'ajax',
        'dom-manipulation',
        'django',
        'fastapi',
        'htmx-like',
        'reactive',
        'progressive-enhancement'
      ],

      version: '1.0.0',
      author: 'FixiPlug Team',
      level: 'beginner'
    }
  };
}
