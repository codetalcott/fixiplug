/**
 * FixiPlug Form Validation Schema Extractor Plugin
 *
 * Extracts JSON schemas from HTML forms and Django form validation rules.
 * Enables LLM agents to understand input requirements, validate data, and generate samples.
 *
 * @module plugins/form-schema
 *
 * API Hooks Exposed:
 * - api:getFormSchema - Extract JSON schema from form
 * - api:validateFormData - Validate data object against form schema
 * - api:generateSampleData - Generate valid sample data for form
 * - api:getFormConstraints - Get detailed validation constraints
 *
 * @example
 * // Get form schema
 * const result = await fixiplug.dispatch('api:getFormSchema', {
 *   form: 'product-form'
 * });
 * // Returns: { fields: { email: { type: 'email', required: true, ... } } }
 *
 * @example
 * // Validate data
 * const validation = await fixiplug.dispatch('api:validateFormData', {
 *   form: 'product-form',
 *   data: { email: 'invalid' }
 * });
 * // Returns: { valid: false, errors: { email: 'Invalid email format' } }
 */

export default function formSchema(ctx) {

  // ========================================
  // API: Get Form Schema
  // ========================================
  ctx.on('api:getFormSchema', (event) => {
    const { form } = event;

    if (!form) {
      return { error: 'form parameter required' };
    }

    // Find form element
    const formEl = findForm(form);

    if (!formEl) {
      return { error: `Form not found: ${form}` };
    }

    // Extract schema
    const schema = extractSchema(formEl);

    return {
      success: true,
      form,
      schema
    };
  });

  // ========================================
  // API: Validate Form Data
  // ========================================
  ctx.on('api:validateFormData', async (event) => {
    const { form, data } = event;

    if (!form || !data) {
      return { error: 'form and data parameters required' };
    }

    // Get schema
    const schemaResult = await ctx.dispatch('api:getFormSchema', { form });

    if (!schemaResult.success) {
      return schemaResult;
    }

    const { schema } = schemaResult;
    const errors = {};
    let valid = true;

    // Validate each field
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const value = data[fieldName];

      // Check required
      if (fieldSchema.required && (value === undefined || value === null || value === '')) {
        errors[fieldName] = 'This field is required';
        valid = false;
        continue;
      }

      // Skip validation if field is empty and not required
      if (!value && !fieldSchema.required) continue;

      // Type validation
      const typeError = validateType(value, fieldSchema);
      if (typeError) {
        errors[fieldName] = typeError;
        valid = false;
        continue;
      }

      // Pattern validation
      if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(value)) {
        errors[fieldName] = fieldSchema.patternMessage || 'Invalid format';
        valid = false;
        continue;
      }

      // Length validation
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        errors[fieldName] = `Minimum length is ${fieldSchema.minLength}`;
        valid = false;
        continue;
      }

      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        errors[fieldName] = `Maximum length is ${fieldSchema.maxLength}`;
        valid = false;
        continue;
      }

      // Number range validation
      if (fieldSchema.min !== undefined && Number(value) < fieldSchema.min) {
        errors[fieldName] = `Minimum value is ${fieldSchema.min}`;
        valid = false;
        continue;
      }

      if (fieldSchema.max !== undefined && Number(value) > fieldSchema.max) {
        errors[fieldName] = `Maximum value is ${fieldSchema.max}`;
        valid = false;
        continue;
      }
    }

    return {
      valid,
      errors: valid ? undefined : errors,
      form,
      data
    };
  });

  // ========================================
  // API: Generate Sample Data
  // ========================================
  ctx.on('api:generateSampleData', async (event) => {
    const { form } = event;

    if (!form) {
      return { error: 'form parameter required' };
    }

    // Get schema
    const schemaResult = await ctx.dispatch('api:getFormSchema', { form });

    if (!schemaResult.success) {
      return schemaResult;
    }

    const { schema } = schemaResult;
    const sample = {};

    // Generate sample value for each field
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      sample[fieldName] = generateSampleValue(fieldSchema);
    }

    return {
      success: true,
      form,
      sample
    };
  });

  // ========================================
  // API: Get Form Constraints
  // ========================================
  ctx.on('api:getFormConstraints', (event) => {
    const { form } = event;

    if (!form) {
      return { error: 'form parameter required' };
    }

    const formEl = findForm(form);

    if (!formEl) {
      return { error: `Form not found: ${form}` };
    }

    const constraints = {};

    formEl.querySelectorAll('input, select, textarea').forEach(input => {
      if (!input.name) return;

      constraints[input.name] = {
        required: input.hasAttribute('required'),
        disabled: input.disabled,
        readonly: input.readOnly,
        pattern: input.pattern,
        min: input.min,
        max: input.max,
        minLength: input.minLength > 0 ? input.minLength : undefined,
        maxLength: input.maxLength > 0 ? input.maxLength : undefined,
        step: input.step,
        accept: input.accept,
        multiple: input.multiple,
        autocomplete: input.autocomplete
      };
    });

    return {
      success: true,
      form,
      constraints
    };
  });

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Find form element
   */
  function findForm(identifier) {
    return (
      document.querySelector(`form[name="${identifier}"]`) ||
      document.querySelector(`form#${identifier}`) ||
      document.querySelector(identifier)
    );
  }

  /**
   * Extract JSON schema from form
   */
  function extractSchema(formEl) {
    const fields = {};

    formEl.querySelectorAll('input, select, textarea').forEach(input => {
      if (!input.name) return;

      const label = getLabelForInput(input);
      const type = getSchemaType(input);

      fields[input.name] = {
        type,
        label,
        required: input.hasAttribute('required'),
        placeholder: input.placeholder,
        pattern: input.pattern,
        patternMessage: input.title || input.getAttribute('data-pattern-message'),
        minLength: input.minLength > 0 ? input.minLength : undefined,
        maxLength: input.maxLength > 0 ? input.maxLength : undefined,
        min: input.min ? parseFloat(input.min) : undefined,
        max: input.max ? parseFloat(input.max) : undefined,
        step: input.step ? parseFloat(input.step) : undefined,
        multiple: input.multiple || undefined,
        accept: input.accept,
        options: extractOptions(input)
      };

      // Clean up undefined values
      Object.keys(fields[input.name]).forEach(key => {
        if (fields[input.name][key] === undefined) {
          delete fields[input.name][key];
        }
      });
    });

    return {
      fields,
      action: formEl.action,
      method: formEl.method.toUpperCase() || 'POST',
      enctype: formEl.enctype
    };
  }

  /**
   * Get schema type from input
   */
  function getSchemaType(input) {
    const inputType = input.type?.toLowerCase();

    const typeMap = {
      'email': 'email',
      'url': 'url',
      'tel': 'tel',
      'number': 'number',
      'range': 'number',
      'date': 'date',
      'datetime-local': 'datetime',
      'time': 'time',
      'color': 'color',
      'checkbox': 'boolean',
      'radio': 'string',
      'file': 'file',
      'select-one': 'string',
      'select-multiple': 'array',
      'textarea': 'text'
    };

    return typeMap[inputType] || typeMap[input.tagName.toLowerCase()] || 'string';
  }

  /**
   * Get label text for input
   */
  function getLabelForInput(input) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();

    const parentLabel = input.closest('label');
    if (parentLabel) {
      return Array.from(parentLabel.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join(' ');
    }

    return input.placeholder || input.name;
  }

  /**
   * Extract options from select or datalist
   */
  function extractOptions(input) {
    if (input.tagName === 'SELECT') {
      return Array.from(input.options).map(opt => ({
        value: opt.value,
        label: opt.textContent.trim(),
        selected: opt.selected
      }));
    }

    if (input.list) {
      const datalist = document.getElementById(input.list.id);
      if (datalist) {
        return Array.from(datalist.options).map(opt => ({
          value: opt.value,
          label: opt.textContent.trim() || opt.value
        }));
      }
    }

    return undefined;
  }

  /**
   * Validate value against type
   */
  function validateType(value, fieldSchema) {
    const { type } = fieldSchema;

    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Invalid email format';
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return 'Invalid URL format';
        }
        break;

      case 'tel':
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value)) {
          return 'Invalid phone number format';
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          return 'Must be a number';
        }
        break;

      case 'date':
        if (isNaN(Date.parse(value))) {
          return 'Invalid date format';
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return 'Must be true or false';
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return 'Must be an array';
        }
        break;
    }

    return null;
  }

  /**
   * Generate sample value based on field schema
   */
  function generateSampleValue(fieldSchema) {
    const { type, options, min, max, pattern } = fieldSchema;

    // Use first option if available
    if (options && options.length > 0) {
      return options[0].value;
    }

    switch (type) {
      case 'email':
        return 'user@example.com';

      case 'url':
        return 'https://example.com';

      case 'tel':
        return '+1-555-0100';

      case 'number':
        if (min !== undefined) return min;
        if (max !== undefined) return Math.max(0, max - 10);
        return 42;

      case 'date':
        return new Date().toISOString().split('T')[0];

      case 'datetime':
        return new Date().toISOString().slice(0, 16);

      case 'time':
        return '12:00';

      case 'color':
        return '#4CAF50';

      case 'boolean':
        return true;

      case 'array':
        return [];

      case 'file':
        return null; // Can't generate file samples

      case 'text':
        return 'Lorem ipsum dolor sit amet';

      default:
        // Try to generate from pattern
        if (pattern) {
          // Simple pattern matching for common cases
          if (pattern.includes('[0-9]')) return '12345';
          if (pattern.includes('[A-Z]')) return 'ABCDE';
        }

        return 'Sample text';
    }
  }
}
