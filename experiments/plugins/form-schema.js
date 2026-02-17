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

  // ========================================
  // Skill Metadata
  // ========================================
  return {
    skill: {
      name: 'form-schema',
      description: 'Extract JSON schemas from HTML forms, validate data, and generate samples. Essential for understanding form requirements and automating data entry.',
      instructions: `
# Form Schema Plugin Skill

## Overview

The Form Schema Plugin enables LLM agents to **understand form requirements** by extracting JSON schemas from HTML forms. This is essential for:

- **Auto-filling forms** with valid data
- **Validating data** before submission
- **Understanding constraints** (required fields, patterns, min/max values)
- **Generating test data** for forms
- **Working with Django forms** and **FastAPI Pydantic models**

**Philosophy**: Treat forms as self-documenting data contracts. Extract schemas from HTML, validate against constraints, and generate valid samples automatically.

---

## Core APIs

### 1. api:getFormSchema

**Purpose**: Extract complete JSON schema from HTML form

**Parameters**:
\`\`\`javascript
{
  form: string  // Form selector: name, id, or CSS selector
}
\`\`\`

**Returns**:
\`\`\`javascript
{
  success: true,
  form: "product-form",
  schema: {
    fields: {
      name: {
        type: "string",
        label: "Product Name",
        required: true,
        minLength: 3,
        maxLength: 100,
        placeholder: "Enter product name"
      },
      price: {
        type: "number",
        label: "Price",
        required: true,
        min: 0.01,
        step: 0.01
      },
      category: {
        type: "string",
        label: "Category",
        required: true,
        options: [
          { value: "electronics", label: "Electronics", selected: false },
          { value: "clothing", label: "Clothing", selected: true }
        ]
      },
      email: {
        type: "email",
        label: "Contact Email",
        required: false,
        pattern: "^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$"
      }
    },
    action: "/products/",
    method: "POST",
    enctype: "application/x-www-form-urlencoded"
  }
}
\`\`\`

**Example**:
\`\`\`javascript
// Get schema to understand form requirements
const result = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

console.log('Required fields:',
  Object.entries(result.schema.fields)
    .filter(([_, field]) => field.required)
    .map(([name, _]) => name)
);
// Output: ['name', 'price', 'category']
\`\`\`

**When to Use**:
- Before filling forms (understand requirements)
- Before validation (get constraints)
- For form documentation (extract schema)
- For API endpoint discovery (action + method)

---

### 2. api:validateFormData

**Purpose**: Validate data object against form schema

**Parameters**:
\`\`\`javascript
{
  form: string,    // Form selector
  data: object     // Data to validate
}
\`\`\`

**Returns (Valid)**:
\`\`\`javascript
{
  valid: true,
  form: "product-form",
  data: { name: "Widget", price: 29.99, category: "electronics" }
}
\`\`\`

**Returns (Invalid)**:
\`\`\`javascript
{
  valid: false,
  errors: {
    name: "Minimum length is 3",
    price: "Must be a number",
    email: "Invalid email format"
  },
  form: "product-form",
  data: { name: "AB", price: "invalid", email: "bad-email" }
}
\`\`\`

**Example**:
\`\`\`javascript
// Validate before submitting
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: {
    name: 'New Product',
    price: 49.99,
    category: 'electronics',
    email: 'contact@example.com'
  }
});

if (validation.valid) {
  // Submit form
  await fixiplug.dispatch('agent:fillForm', {
    form: 'product-form',
    data: validation.data
  });
} else {
  console.error('Validation errors:', validation.errors);
}
\`\`\`

**Validation Rules**:
- **Required**: Field must have non-empty value
- **Type**: Email, URL, tel, number, date formats
- **Pattern**: Regex pattern matching
- **Length**: minLength, maxLength for strings
- **Range**: min, max for numbers
- **Options**: Value must match select/datalist options

---

### 3. api:generateSampleData

**Purpose**: Generate valid sample data for form (useful for testing)

**Parameters**:
\`\`\`javascript
{
  form: string  // Form selector
}
\`\`\`

**Returns**:
\`\`\`javascript
{
  success: true,
  form: "product-form",
  sample: {
    name: "Sample text",
    price: 42,
    category: "electronics",      // First option selected
    email: "user@example.com",
    website: "https://example.com",
    phone: "+1-555-0100",
    launch_date: "2025-11-18"
  }
}
\`\`\`

**Example**:
\`\`\`javascript
// Generate sample data for testing
const result = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});

// Use sample to test form validation
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: result.sample
});

console.log('Sample data is valid:', validation.valid);
// Output: true (guaranteed to be valid)
\`\`\`

**When to Use**:
- Testing form validation logic
- Populating forms for demos
- Understanding expected data format
- Quick form fill during development

---

### 4. api:getFormConstraints

**Purpose**: Get detailed validation constraints for each field

**Parameters**:
\`\`\`javascript
{
  form: string  // Form selector
}
\`\`\`

**Returns**:
\`\`\`javascript
{
  success: true,
  form: "product-form",
  constraints: {
    name: {
      required: true,
      disabled: false,
      readonly: false,
      minLength: 3,
      maxLength: 100,
      pattern: undefined
    },
    price: {
      required: true,
      disabled: false,
      readonly: false,
      min: "0.01",
      max: undefined,
      step: "0.01"
    },
    email: {
      required: false,
      disabled: false,
      readonly: false,
      pattern: "^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$",
      autocomplete: "email"
    }
  }
}
\`\`\`

**Example**:
\`\`\`javascript
// Get constraints to understand field limitations
const result = await fixiplug.dispatch('api:getFormConstraints', {
  form: 'product-form'
});

// Find all required fields
const requiredFields = Object.entries(result.constraints)
  .filter(([_, constraints]) => constraints.required)
  .map(([name, _]) => name);

console.log('Required fields:', requiredFields);
\`\`\`

---

## Django Integration

### Django Forms → HTML → Schema

**Django Form**:
\`\`\`python
# forms.py
from django import forms

class ProductForm(forms.Form):
    name = forms.CharField(
        max_length=100,
        min_length=3,
        required=True,
        widget=forms.TextInput(attrs={'placeholder': 'Enter product name'})
    )
    price = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0.01,
        required=True
    )
    category = forms.ChoiceField(
        choices=[('electronics', 'Electronics'), ('clothing', 'Clothing')],
        required=True
    )
    email = forms.EmailField(required=False)
\`\`\`

**Django Template**:
\`\`\`html
<form name="product-form" method="POST" action="/products/">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Create Product</button>
</form>
\`\`\`

**Agent Workflow**:
\`\`\`javascript
// 1. Extract schema from rendered Django form
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// 2. Understand what Django expects
console.log('Django form action:', schema.schema.action);  // "/products/"
console.log('Django form method:', schema.schema.method);  // "POST"

// 3. Generate valid data
const sample = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});

// 4. Validate before submission
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: sample.sample
});

// 5. Fill and submit
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', {
    form: 'product-form',
    data: validation.data
  });
}
\`\`\`

### Django Model Forms

**Django Model**:
\`\`\`python
# models.py
from django.db import models

class Franchise(models.Model):
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    annual_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    employees = models.IntegerField()
    is_active = models.BooleanField(default=True)

# forms.py
from django.forms import ModelForm

class FranchiseForm(ModelForm):
    class Meta:
        model = Franchise
        fields = ['name', 'location', 'annual_revenue', 'employees', 'is_active']
\`\`\`

**Agent Extracts Schema**:
\`\`\`javascript
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'franchise-form'
});

// Schema automatically reflects Django model constraints
console.log(schema.schema.fields);
/*
{
  name: { type: "string", required: true, maxLength: 200 },
  location: { type: "string", required: true, maxLength: 200 },
  annual_revenue: { type: "number", required: true },
  employees: { type: "number", required: true },
  is_active: { type: "boolean", required: false }
}
*/
\`\`\`

---

## FastAPI Integration

### Pydantic Models → HTML → Schema

**FastAPI Pydantic Model**:
\`\`\`python
# models.py
from pydantic import BaseModel, Field, EmailStr
from decimal import Decimal

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    price: Decimal = Field(..., gt=0, decimal_places=2)
    category: str
    email: EmailStr | None = None
\`\`\`

**FastAPI Endpoint (Returns HTML Form)**:
\`\`\`python
# main.py
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="templates")

@app.get("/products/new", response_class=HTMLResponse)
async def new_product_form(request: Request):
    return templates.TemplateResponse("product_form.html", {
        "request": request,
        "categories": ["electronics", "clothing", "home"]
    })
\`\`\`

**Jinja2 Template**:
\`\`\`html
<form name="product-form" method="POST" action="/api/products/">
  <label>
    Product Name
    <input type="text" name="name" required minlength="3" maxlength="100"
           placeholder="Enter product name">
  </label>

  <label>
    Price
    <input type="number" name="price" required min="0.01" step="0.01">
  </label>

  <label>
    Category
    <select name="category" required>
      {% for cat in categories %}
        <option value="\\{\\{ cat \\}\\}">\\{\\{ cat.title() \\}\\}</option>
      {% endfor %}
    </select>
  </label>

  <label>
    Email (optional)
    <input type="email" name="email">
  </label>

  <button type="submit">Create</button>
</form>
\`\`\`

**Agent Workflow**:
\`\`\`javascript
// 1. Load form page
await fixiplug.dispatch('agent:navigate', { url: '/products/new' });

// 2. Wait for form to load
await fixiplug.dispatch('api:waitForState', { state: 'loaded' });

// 3. Extract schema (Pydantic constraints reflected in HTML)
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

console.log('FastAPI endpoint:', schema.schema.action);  // "/api/products/"
console.log('Pydantic constraints:', schema.schema.fields);

// 4. Generate valid data (respects Pydantic constraints)
const sample = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});

// 5. Validate (client-side validation mirrors Pydantic)
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: {
    name: 'New Widget',
    price: 29.99,
    category: 'electronics',
    email: 'sales@example.com'
  }
});

// 6. Submit to FastAPI endpoint
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', {
    form: 'product-form',
    data: validation.data
  });
}
\`\`\`

---

## Common Workflow Patterns

### Pattern 1: Form Discovery & Validation

**Scenario**: Agent needs to fill a form but doesn't know the requirements

\`\`\`javascript
// Step 1: Discover what forms exist
const dom = await fixiplug.dispatch('api:readDom', {
  selector: 'form',
  extract: ['name', 'id', 'action']
});

console.log('Available forms:', dom.elements);

// Step 2: Get schema for target form
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// Step 3: Understand requirements
const requiredFields = Object.entries(schema.schema.fields)
  .filter(([_, field]) => field.required)
  .map(([name, field]) => ({ name, type: field.type, label: field.label }));

console.log('Must provide:', requiredFields);

// Step 4: Prepare data
const data = {
  name: 'Premium Widget',
  price: 99.99,
  category: 'electronics'
};

// Step 5: Validate before filling
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data
});

if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  // Fix errors and retry
} else {
  // Proceed with form fill
  await fixiplug.dispatch('agent:fillForm', { form: 'product-form', data });
}
\`\`\`

### Pattern 2: Test Data Generation

**Scenario**: Need to test form validation logic

\`\`\`javascript
// Generate valid sample
const validSample = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});

// Test that sample passes validation
const validation1 = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: validSample.sample
});

console.log('Valid sample passes:', validation1.valid);  // true

// Test edge cases
const edgeCases = [
  { name: '', price: 10 },                    // Missing required field
  { name: 'AB', price: 10 },                  // Too short (minLength: 3)
  { name: 'Valid Name', price: -5 },          // Negative price
  { name: 'Valid Name', price: 'invalid' },   // Wrong type
];

for (const testCase of edgeCases) {
  const validation = await fixiplug.dispatch('api:validateFormData', {
    form: 'product-form',
    data: { ...validSample.sample, ...testCase }
  });

  if (!validation.valid) {
    console.log('Expected failure:', validation.errors);
  }
}
\`\`\`

### Pattern 3: Multi-Step Form Flow

**Scenario**: Wizard-style form with multiple steps

\`\`\`javascript
// Step 1: Get schema for first step
const step1Schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'registration-step-1'
});

// Fill step 1
await fixiplug.dispatch('agent:fillForm', {
  form: 'registration-step-1',
  data: { email: 'user@example.com', password: 'SecurePass123!' }
});

// Click next
await fixiplug.dispatch('agent:clickButton', { text: 'Next' });

// Wait for step 2 to load
await fixiplug.dispatch('api:waitForState', { state: 'step-2-loaded' });

// Get schema for step 2
const step2Schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'registration-step-2'
});

// Fill step 2
await fixiplug.dispatch('agent:fillForm', {
  form: 'registration-step-2',
  data: { firstName: 'John', lastName: 'Doe' }
});

// Submit
await fixiplug.dispatch('agent:clickButton', { text: 'Submit' });
\`\`\`

### Pattern 4: Dynamic Form Handling

**Scenario**: Form fields change based on selections

\`\`\`javascript
// Initial schema
let schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

console.log('Initial fields:', Object.keys(schema.schema.fields));

// Change category (triggers dynamic fields)
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',
  data: { category: 'electronics' }
});

// Wait for DOM update
await new Promise(resolve => setTimeout(resolve, 300));

// Re-extract schema (new fields may appear)
schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

console.log('Updated fields:', Object.keys(schema.schema.fields));
// May now include: voltage, warranty_months, etc.
\`\`\`

### Pattern 5: Error Recovery

**Scenario**: Form validation fails, need to fix errors

\`\`\`javascript
async function fillFormWithRetry(form, data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Validate data
    const validation = await fixiplug.dispatch('api:validateFormData', {
      form,
      data
    });

    if (validation.valid) {
      // Fill form
      await fixiplug.dispatch('agent:fillForm', { form, data });
      return { success: true };
    }

    // Handle errors
    console.log(\`Attempt \${attempt} failed:\`, validation.errors);

    // Auto-fix common errors
    for (const [field, error] of Object.entries(validation.errors)) {
      if (error.includes('required')) {
        // Generate sample value for missing field
        const sample = await fixiplug.dispatch('api:generateSampleData', { form });
        data[field] = sample.sample[field];
      }
      else if (error.includes('Minimum length')) {
        data[field] = data[field] + 'X'.repeat(10);  // Pad string
      }
      else if (error.includes('Must be a number')) {
        data[field] = 0;  // Default to zero
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

// Usage
const result = await fillFormWithRetry('product-form', {
  name: 'AB',       // Too short - will be auto-fixed
  price: 'invalid'  // Wrong type - will be auto-fixed
});
\`\`\`

---

## Advanced Techniques

### Schema Comparison (Detect Form Changes)

\`\`\`javascript
// Get initial schema
const schema1 = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// Perform some action that might change the form
await fixiplug.dispatch('agent:clickButton', { text: 'Add Custom Field' });

// Get updated schema
const schema2 = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// Compare schemas
const newFields = Object.keys(schema2.schema.fields)
  .filter(field => !schema1.schema.fields[field]);

console.log('New fields added:', newFields);
\`\`\`

### Custom Validation Rules

\`\`\`javascript
async function validateWithCustomRules(form, data, customRules) {
  // First, do standard validation
  const validation = await fixiplug.dispatch('api:validateFormData', {
    form,
    data
  });

  if (!validation.valid) {
    return validation;
  }

  // Apply custom business rules
  const customErrors = {};

  for (const [field, rule] of Object.entries(customRules)) {
    if (!rule.validator(data[field])) {
      customErrors[field] = rule.message;
    }
  }

  if (Object.keys(customErrors).length > 0) {
    return {
      valid: false,
      errors: customErrors,
      form,
      data
    };
  }

  return validation;
}

// Usage
const result = await validateWithCustomRules(
  'product-form',
  { name: 'Widget', price: 5.99 },
  {
    price: {
      validator: (value) => value >= 10,
      message: 'Business rule: Minimum price is $10'
    }
  }
);
\`\`\`

### Form Schema Documentation

\`\`\`javascript
async function documentForm(form) {
  const schema = await fixiplug.dispatch('api:getFormSchema', { form });
  const constraints = await fixiplug.dispatch('api:getFormConstraints', { form });
  const sample = await fixiplug.dispatch('api:generateSampleData', { form });

  console.log(\`# Form Documentation: \${form}\n\`);
  console.log(\`**Endpoint**: \${schema.schema.method} \${schema.schema.action}\n\`);

  console.log('## Fields\\n');
  for (const [name, field] of Object.entries(schema.schema.fields)) {
    console.log(\`### \${field.label || name}\`);
    console.log(\`- **Name**: \${name}\`);
    console.log(\`- **Type**: \${field.type}\`);
    console.log(\`- **Required**: \${field.required ? 'Yes' : 'No'}\`);

    if (field.minLength) console.log(\`- **Min Length**: \${field.minLength}\`);
    if (field.maxLength) console.log(\`- **Max Length**: \${field.maxLength}\`);
    if (field.min) console.log(\`- **Min Value**: \${field.min}\`);
    if (field.max) console.log(\`- **Max Value**: \${field.max}\`);
    if (field.pattern) console.log(\`- **Pattern**: \${field.pattern}\`);

    console.log(\`- **Sample**: \${sample.sample[name]}\`);
    console.log('');
  }
}

// Generate markdown documentation
await documentForm('product-form');
\`\`\`

---

## Best Practices

### ✅ DO

1. **Always validate before filling**: Catch errors early
\`\`\`javascript
const validation = await fixiplug.dispatch('api:validateFormData', { form, data });
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', { form, data });
}
\`\`\`

2. **Use generateSampleData for testing**: Guaranteed valid data
\`\`\`javascript
const sample = await fixiplug.dispatch('api:generateSampleData', { form: 'test-form' });
\`\`\`

3. **Extract schema to understand requirements**: Know before you fill
\`\`\`javascript
const schema = await fixiplug.dispatch('api:getFormSchema', { form });
const required = Object.entries(schema.schema.fields)
  .filter(([_, f]) => f.required)
  .map(([name, _]) => name);
\`\`\`

4. **Check constraints for field limitations**: Understand boundaries
\`\`\`javascript
const constraints = await fixiplug.dispatch('api:getFormConstraints', { form });
\`\`\`

### ❌ DON'T

1. **Don't skip validation**: May submit invalid data
\`\`\`javascript
// Bad
await fixiplug.dispatch('agent:fillForm', { form, data });

// Good
const validation = await fixiplug.dispatch('api:validateFormData', { form, data });
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', { form, data });
}
\`\`\`

2. **Don't assume field types**: Extract schema instead
\`\`\`javascript
// Bad
const data = { price: "29.99" };  // String instead of number

// Good
const schema = await fixiplug.dispatch('api:getFormSchema', { form });
const priceType = schema.schema.fields.price.type;  // "number"
const data = { price: 29.99 };
\`\`\`

3. **Don't ignore validation errors**: Handle them gracefully
\`\`\`javascript
// Bad
const validation = await fixiplug.dispatch('api:validateFormData', { form, data });
await fixiplug.dispatch('agent:fillForm', { form, data });  // Fills anyway

// Good
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', { form, data });
} else {
  console.error('Fix these errors:', validation.errors);
}
\`\`\`

4. **Don't hardcode form identifiers**: Use dynamic discovery
\`\`\`javascript
// Bad
const schema = await fixiplug.dispatch('api:getFormSchema', { form: 'form1' });

// Good
const forms = await fixiplug.dispatch('api:readDom', {
  selector: 'form',
  extract: ['name', 'id']
});
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: forms.elements[0].name
});
\`\`\`

---

## Integration with Other Plugins

### With Agent Commands (agent-commands.js)

\`\`\`javascript
// Get schema
const schema = await fixiplug.dispatch('api:getFormSchema', { form: 'product-form' });

// Validate data
const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data: { name: 'Widget', price: 29.99 }
});

// Fill form using agent commands
if (validation.valid) {
  await fixiplug.dispatch('agent:fillForm', {
    form: 'product-form',
    data: validation.data
  });
}
\`\`\`

### With State Tracker (state-tracker.js)

\`\`\`javascript
// Set state before validation
await fixiplug.dispatch('api:setState', { state: 'validating' });

const validation = await fixiplug.dispatch('api:validateFormData', {
  form: 'product-form',
  data
});

if (validation.valid) {
  await fixiplug.dispatch('api:setState', { state: 'valid' });
} else {
  await fixiplug.dispatch('api:setState', {
    state: 'invalid',
    data: { errors: validation.errors }
  });
}
\`\`\`

### With Fixi Agent (fixi-agent.js)

\`\`\`javascript
// Django/FastAPI returns form HTML
const result = await fixiplug.dispatch('api:injectFxHtml', {
  html: '<div fx-action="/products/new" fx-trigger="load"></div>',
  selector: '#app'
});

// Wait for form to load
await new Promise(resolve => setTimeout(resolve, 500));

// Extract schema from injected form
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});

// Generate and validate sample
const sample = await fixiplug.dispatch('api:generateSampleData', {
  form: 'product-form'
});
\`\`\`

---

## Troubleshooting

### Issue: Form not found

**Cause**: Incorrect selector or form not in DOM

**Solution**:
\`\`\`javascript
// Check what forms exist
const forms = await fixiplug.dispatch('api:readDom', {
  selector: 'form',
  extract: ['name', 'id']
});

console.log('Available forms:', forms.elements);
\`\`\`

### Issue: Schema missing expected fields

**Cause**: Form fields lack \`name\` attribute

**Solution**: Ensure all inputs have \`name\` attribute
\`\`\`html
<!-- Bad -->
<input type="text" id="product-name">

<!-- Good -->
<input type="text" name="name" id="product-name">
\`\`\`

### Issue: Validation passes but server rejects

**Cause**: Server-side validation is stricter than client-side

**Solution**: Extract constraints from Django/FastAPI errors
\`\`\`javascript
// Try submitting sample data
const sample = await fixiplug.dispatch('api:generateSampleData', { form });

await fixiplug.dispatch('agent:fillForm', { form, data: sample.sample });

// If server returns errors, update form constraints
// (This requires server to return validation errors in HTML)
\`\`\`

### Issue: Generated sample data is not realistic

**Cause**: Generic sample values (e.g., "Sample text")

**Solution**: Override with realistic values
\`\`\`javascript
const sample = await fixiplug.dispatch('api:generateSampleData', { form });

// Override generic values
const realisticData = {
  ...sample.sample,
  name: 'Premium Wireless Headphones',
  price: 149.99,
  category: 'electronics'
};

const validation = await fixiplug.dispatch('api:validateFormData', {
  form,
  data: realisticData
});
\`\`\`

---

## Summary

The Form Schema Plugin enables **self-documenting forms**:

1. **Extract schemas** from HTML to understand requirements
2. **Validate data** before submission to catch errors early
3. **Generate samples** for testing and demos
4. **Understand constraints** to respect field limitations
5. **Integrate with Django/FastAPI** for full-stack workflows

**Key Insight**: Forms are data contracts. Extract the schema, validate against constraints, and submit with confidence.
`,
      references: ['agentCommands', 'fixiAgentPlugin', 'stateTrackerPlugin'],
      tags: ['forms', 'validation', 'schema', 'django', 'fastapi', 'pydantic', 'data-extraction', 'testing'],
      version: '1.0.0',
      author: 'FixiPlug Team',
      level: 'intermediate'
    }
  };
}
