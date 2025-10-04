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
 * // Extract data
 * const data = await fixiplug.dispatch('agent:extract', {
 *   selector: '.product-card',
 *   fields: ['name', 'price', 'stock']
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

    const extracted = [];

    elements.forEach((el, index) => {
      const item = {};

      fields.forEach(field => {
        // Try multiple strategies to get field value
        const value =
          el.querySelector(`[data-field="${field}"]`)?.textContent?.trim() ||
          el.querySelector(`[name="${field}"]`)?.value ||
          el.querySelector(`[data-${field}]`)?.textContent?.trim() ||
          el.getAttribute(`data-${field}`) ||
          null;

        item[field] = value;
      });

      extracted.push(item);
    });

    return {
      success: true,
      count: extracted.length,
      data: format === 'array' ? extracted : Object.fromEntries(extracted.map((item, i) => [i, item])),
      selector
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
}
