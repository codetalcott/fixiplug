# FixiPlug Roadmap Analysis: What's Already Built vs. What to Build Next

## Executive Summary

After analyzing the existing codebase and the proposed roadmap, **we've already implemented 2 out of 12 proposed plugins**, and several others are partially addressed by existing functionality. This document identifies what's done, what's missing, and what should be prioritized for the **dj-fixi (Django)** and **franchise-assessment (FastAPI)** integrations.

---

## ✅ Already Implemented (2/12)

### **1. State Machine Tracker** ✅ COMPLETE
**Status:** Fully implemented in [plugins/state-tracker.js](plugins/state-tracker.js)

**What it does:**
- Tracks application state transitions (idle → loading → success/error)
- Provides `api:getCurrentState`, `api:setState`, `api:waitForState`
- Emits `state:transition` events
- Supports state history and validation schemas

**Integration with dj-fixi (Django) and FastAPI:**
- ✅ Can track Django/FastAPI request states
- ✅ LLM agents can wait for data to load before querying
- ✅ Error states are tracked

**Example (works with both Django and FastAPI):**
```javascript
// Agent waits for API table to load
await fixiplug.dispatch('api:setState', { state: 'loading' });
const data = await fetch('/api/products/');  // Django or FastAPI endpoint
await fixiplug.dispatch('api:setState', { state: 'success', data });

// Other code waits for success
await fixiplug.dispatch('api:waitForState', { state: 'success' });
```

---

### **2. Capability Discovery** ✅ MOSTLY COMPLETE
**Status:** Implemented in [plugins/introspection.js](plugins/introspection.js)

**What it does:**
- Exposes all registered plugins and hooks
- Provides `api:introspect`, `api:getPluginCapabilities`, `api:getAvailableHooks`
- Auto-generates API documentation
- Discovers hook schemas automatically

**What's missing for dj-fixi and FastAPI:**
- ❌ Django/FastAPI endpoints not auto-registered
- ❌ Table/form capabilities not exposed
- ❌ No JSON schema for Django models or Pydantic models

**What we need to add:**
```javascript
// Auto-register Django/FastAPI table capabilities
fixiplug.dispatch('api:registerCapability', {
  type: 'table',
  endpoint: '/api/products/',
  model: 'Product',  // Django model or Pydantic model
  features: ['search', 'sort', 'paginate', 'edit'],
  columns: [...],
  actions: ['create', 'update', 'delete'],
  framework: 'django' | 'fastapi'  // NEW: Distinguish framework
});
```

---

## 🟡 Partially Implemented

### **3. Form Validation Schema Extractor** 🟡 50% DONE
**Status:** Django side has schemas, FixiPlug side missing

**What exists:**
- ✅ Django forms have validation rules
- ✅ dj-fixi `ModelTable` exposes column metadata
- ✅ Table plugin accepts column configs with `inputType`, `required`, `pattern`

**What's missing:**
- ❌ No extraction of Django form → JSON schema
- ❌ No `api:getFormSchema` hook
- ❌ No sample data generation

**How to complete:**
```javascript
// Extract schema from form
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'product-form'
});
// Returns: { email: { type: 'email', required: true, max_length: 255 }, ... }
```

---

### **4. Semantic Context Annotator** 🟡 30% DONE
**Status:** Manual annotations exist, auto-annotation missing

**What exists:**
- ✅ Django can add custom attributes to HTML
- ✅ FixiPlug supports custom `fx-*` attributes
- ✅ Table plugin has semantic column types

**What's missing:**
- ❌ No automatic annotation of elements
- ❌ No `api:queryByIntent` (find "submit button")
- ❌ No semantic metadata extraction

**How to complete:**
```javascript
// Auto-annotate Django forms
<input fx-semantic="email-field required user-profile">
<button fx-semantic="submit primary save-action">

// Query by intent
const submitBtn = await fixiplug.dispatch('api:queryByIntent', {
  intent: 'submit form'
});
```

---

## ❌ Not Implemented (8/12)

### **High Priority for dj-fixi**

#### **5. Agent Command Interface** ⭐⭐⭐ CRITICAL
**Why we need it:**
- LLM agents need high-level API for Django operations
- Simplifies form filling, data queries, navigation
- Consistent interface across all dj-fixi apps

**Implementation:**
```javascript
// Instead of DOM manipulation
agent.executeCommand({
  command: 'fillForm',
  form: 'product-form',
  data: { name: 'Laptop', price: 999.99 }
});

agent.executeCommand({
  command: 'queryTable',
  table: 'products',
  filter: { price__gte: 100 }
});
```

**Hooks to expose:**
- `agent:fillForm`
- `agent:clickButton`
- `agent:queryTable`
- `agent:navigate`
- `agent:extract`

---

#### **6. Dependency Graph Builder** ⭐⭐
**Why it helps dj-fixi:**
- Understand cascading Django signals
- Track related object updates
- Optimize multi-step workflows

**Example:**
```javascript
// LLM discovers that updating Product affects Inventory
const graph = await fixiplug.dispatch('api:getDependencyGraph');
// { Product: { affects: ['Inventory', 'Order'], triggers: ['stock_updated'] } }
```

---

### **Medium Priority**

#### **7. Action Recorder & Replay** ⭐⭐
**Value:** Learn user workflows, generate test code

```javascript
// Record user actions
fixiplug.dispatch('recorder:start');
// ... user interacts with Django form ...
const recording = fixiplug.dispatch('recorder:stop');

// LLM generates test from recording
```

---

#### **8. Natural Language Query Engine** ⭐
**Value:** Direct LLM queries to page state

```javascript
// LLM asks natural language questions
const result = await fixiplug.dispatch('api:query', {
  query: 'How many products cost more than $100?'
});
```

**Note:** We already have LLM generating Django queries, so this is less critical.

---

### **Lower Priority**

#### **9. Undo/Redo Manager** ⭐
**Value:** Safe experimentation, error recovery
- Useful for form editing
- Not critical for initial LLM integration

#### **10. DOM Diff Generator** ⭐
**Value:** Understanding changes
- Nice for debugging
- Not essential for agents

#### **11. Cost Estimator** ⭐
**Value:** Optimization
- Useful for production monitoring
- Not needed for MVP

#### **12. Intent Classifier** ⭐
**Value:** Understanding user goals
- Advanced feature
- Implement after core functionality

---

## 🚀 Recommended Implementation Order

### **Phase 1: Critical for dj-fixi (Next 2 Weeks)**

1. **Enhance Capability Discovery** ⭐⭐⭐
   - Add Django endpoint registration
   - Auto-register table/form capabilities
   - Expose model schemas

   ```javascript
   // Django tables auto-register on load
   ctx.on('fx:data', (event) => {
     if (event.detail.djangoTable) {
       fixiplug.dispatch('api:registerCapability', {
         type: 'table',
         endpoint: event.target.getAttribute('fx-action'),
         columns: event.detail.data.columns,
         features: extractFeatures(event.target)
       });
     }
   });
   ```

2. **Agent Command Interface** ⭐⭐⭐
   - High-level API for common operations
   - Form filling, table queries, navigation
   - Django-specific commands

   ```javascript
   // New plugin: agent-commands.js
   ctx.on('agent:fillForm', async (event) => {
     const form = document.querySelector(`[name="${event.form}"]`);
     for (const [field, value] of Object.entries(event.data)) {
       const input = form.querySelector(`[name="${field}"]`);
       input.value = value;
     }
   });
   ```

3. **Form Schema Extractor** ⭐⭐
   - Extract JSON schema from Django forms
   - Enable validation and sample data generation

   ```javascript
   // New plugin: form-schema.js
   ctx.on('api:getFormSchema', (event) => {
     const form = document.querySelector(`[name="${event.form}"]`);
     return extractSchema(form); // { fields: {...}, validation: {...} }
   });
   ```

---

### **Phase 2: Enhanced Intelligence (Weeks 3-4)**

4. **Semantic Context Annotator**
   - Auto-annotate Django elements
   - Natural language element queries

5. **Dependency Graph Builder**
   - Track Django model relationships
   - Predict side effects

---

### **Phase 3: Advanced Features (Month 2)**

6. **Action Recorder & Replay**
   - Learn from user workflows
   - Generate automated tests

7. **Natural Language Query Engine**
   - Direct LLM-to-page queries

---

### **Phase 4: Optimization (Future)**

8. **Undo/Redo Manager**
9. **DOM Diff Generator**
10. **Cost Estimator**
11. **Intent Classifier**

---

## Integration with dj-fixi LLM Tools

The dj-fixi backend already has LLM tool definitions ([dj_fixi/llm/tools.py](../dj-fixi/dj_fixi/llm/tools.py)):

**Existing Django LLM Tools:**
- `create_table` - Generate table view code
- `create_chart` - Generate chart view code
- `create_form` - Generate form view code
- `create_dashboard` - Generate dashboard code
- `create_kpi` - Generate KPI widgets

**What FixiPlug plugins enable:**
- **Capability Discovery** → LLM knows what endpoints exist
- **Agent Commands** → LLM can interact with generated tables
- **State Tracker** → LLM knows when operations complete
- **Form Schema** → LLM validates form data before submission

**Complete Flow:**
```
1. LLM asks: "Show me products with price > 100"
   ↓
2. LLM discovers /api/products/ endpoint (Capability Discovery)
   ↓
3. LLM generates Django view code (dj-fixi tools.py)
   ↓
4. Django executes code, returns table data
   ↓
5. FixiPlug renders interactive table (table.js plugin)
   ↓
6. LLM tracks loading state (State Tracker)
   ↓
7. User edits cell → LLM executes agent command (Agent Commands)
   ↓
8. LLM validates input (Form Schema)
   ↓
9. Django saves changes
```

---

## Integration with franchise-assessment (FastAPI)

The franchise-assessment project uses FastAPI and can benefit from the same FixiPlug integration patterns as dj-fixi.

**FastAPI Integration Advantages:**
- **Pydantic Models** → Automatic JSON schema generation
- **Type Hints** → Better validation and documentation
- **Async Support** → Native async/await in routes
- **OpenAPI** → Auto-generated API docs

**What FixiPlug plugins enable for FastAPI:**
- **Capability Discovery** → LLM knows what FastAPI endpoints exist
- **Agent Commands** → LLM can interact with data tables
- **State Tracker** → LLM knows when async operations complete
- **Form Schema** → LLM validates data against Pydantic models

**Complete Flow (FastAPI):**
```
1. LLM asks: "Show me franchises with revenue > $500k"
   ↓
2. LLM discovers /api/franchises/ endpoint (Capability Discovery)
   ↓
3. LLM queries FastAPI endpoint (Agent Commands)
   ↓
4. FastAPI validates with Pydantic model, executes query
   ↓
5. FixiPlug renders interactive table (table.js plugin)
   ↓
6. LLM tracks loading state (State Tracker)
   ↓
7. User edits cell → LLM executes agent command (Agent Commands)
   ↓
8. LLM validates against Pydantic schema (Form Schema)
   ↓
9. FastAPI saves changes, returns updated data
```

**Key Differences from Django:**
- **Pydantic vs Django Forms**: Pydantic models provide built-in JSON schema
- **Async by default**: FastAPI routes are async, better for LLM coordination
- **OpenAPI integration**: FastAPI auto-generates OpenAPI schemas that LLMs can consume

**Example Pydantic Model:**
```python
# franchise-assessment/models.py
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

class FranchiseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: str
    annual_revenue: Decimal = Field(..., ge=0)
    employees: int = Field(..., ge=0)
    is_active: bool = True

class FranchiseCreate(FranchiseBase):
    pass

class Franchise(FranchiseBase):
    id: int

    class Config:
        orm_mode = True  # For SQLAlchemy compatibility
```

**FixiPlug Integration:**
```javascript
// Auto-register FastAPI endpoint capabilities
fixiplug.dispatch('api:registerCapability', {
  type: 'table',
  endpoint: '/api/franchises/',
  model: 'Franchise',
  framework: 'fastapi',
  schema: {
    // Extracted from Pydantic model
    name: { type: 'string', minLength: 1, maxLength: 200, required: true },
    location: { type: 'string', required: true },
    annual_revenue: { type: 'number', minimum: 0, required: true },
    employees: { type: 'integer', minimum: 0, required: true },
    is_active: { type: 'boolean', default: true }
  },
  features: ['search', 'sort', 'paginate', 'edit'],
  actions: ['create', 'read', 'update', 'delete']
});
```

**Agent Workflow Example:**
```javascript
// LLM agent queries franchise data
const franchises = await fixiplug.dispatch('agent:queryTable', {
  table: 'franchises',
  filter: {
    annual_revenue__gte: 500000,  // Django-style filter works!
    is_active: true
  }
});

// LLM agent fills franchise creation form
await fixiplug.dispatch('agent:fillForm', {
  form: 'franchise-form',
  data: {
    name: 'Boston Downtown',
    location: 'Boston, MA',
    annual_revenue: 750000,
    employees: 25,
    is_active: true
  }
});

// Validate against Pydantic schema before submit
const schema = await fixiplug.dispatch('api:getFormSchema', {
  form: 'franchise-form'
});
// Returns Pydantic model JSON schema
```

**Skill Plugin for FastAPI (Future):**
```javascript
// plugins/fastapi-workflows-skill.js
export default function fastapiWorkflowsSkill(ctx) {
  return {
    skill: {
      name: 'fastapi-workflows',
      description: 'Workflow patterns for FastAPI + FixiPlug integration',
      instructions: `
        # FastAPI Workflow Patterns

        ## Pattern 1: Pydantic Model Validation
        - Extract JSON schema from Pydantic models
        - Validate form data before submission
        - Show validation errors from FastAPI

        ## Pattern 2: Async Route Coordination
        - Track FastAPI async route execution
        - Wait for background tasks to complete
        - Handle streaming responses

        ## Pattern 3: OpenAPI Integration
        - Auto-discover endpoints from OpenAPI spec
        - Generate forms from Pydantic schemas
        - Validate requests against OpenAPI
      `
    }
  };
}
```

---

## Immediate Next Steps

### **Week 1: Capability Discovery Enhancement**

**File to create:** `plugins/capability-registry.js`

```javascript
/**
 * Capability Registry Plugin
 * Auto-registers Django endpoints, tables, and forms for LLM discovery
 */
export default function capabilityRegistry(ctx) {
  const capabilities = new Map();

  // Auto-register Django tables
  ctx.on('fx:data', (event) => {
    if (event.detail.djangoTable) {
      const endpoint = event.target.getAttribute('fx-action');
      const meta = event.detail.data.meta || {};

      capabilities.set(endpoint, {
        type: 'table',
        endpoint,
        model: meta.model,
        features: extractFeatures(event.target),
        columns: event.detail.data.columns,
        actions: meta.actions || []
      });
    }
  });

  // API: List all capabilities
  ctx.on('api:getCapabilities', () => {
    return {
      capabilities: Array.from(capabilities.values())
    };
  });

  // API: Discover endpoints
  ctx.on('api:discoverEndpoints', () => {
    const endpoints = [];
    document.querySelectorAll('[fx-action]').forEach(el => {
      endpoints.push({
        url: el.getAttribute('fx-action'),
        type: el.hasAttribute('fx-table') ? 'table' : 'unknown'
      });
    });
    return { endpoints };
  });
}
```

---

### **Week 2: Agent Command Interface**

**File to create:** `plugins/agent-commands.js`

```javascript
/**
 * Agent Command Interface Plugin
 * High-level API for LLM agents to interact with Django apps
 */
export default function agentCommands(ctx) {

  // Fill form with data
  ctx.on('agent:fillForm', async (event) => {
    const { form, data } = event;
    const formEl = document.querySelector(`[name="${form}"]`);

    for (const [field, value] of Object.entries(data)) {
      const input = formEl.querySelector(`[name="${field}"]`);
      if (input) input.value = value;
    }

    return { success: true, form, filled: Object.keys(data).length };
  });

  // Click button by text or role
  ctx.on('agent:clickButton', (event) => {
    const { text, role } = event;
    const btn = document.querySelector(
      `button[role="${role}"], button:contains("${text}")`
    );

    if (btn) {
      btn.click();
      return { success: true, clicked: btn.textContent };
    }

    return { error: 'Button not found' };
  });

  // Query table data
  ctx.on('agent:queryTable', async (event) => {
    const { table, filter } = event;
    const tableEl = document.querySelector(`[fx-table][data-model="${table}"]`);

    // Get table state
    const state = tableStates.get(tableEl);
    let data = state.data;

    // Apply filter
    if (filter) {
      data = data.filter(row => matchesFilter(row, filter));
    }

    return { success: true, count: data.length, data };
  });

  // Extract data from page
  ctx.on('agent:extract', (event) => {
    const { selector, fields } = event;
    const elements = document.querySelectorAll(selector);

    const extracted = Array.from(elements).map(el => {
      const item = {};
      fields.forEach(field => {
        item[field] = el.querySelector(`[data-field="${field}"]`)?.textContent;
      });
      return item;
    });

    return { success: true, count: extracted.length, data: extracted };
  });
}
```

---

## Success Metrics

After implementing Phase 1, we should be able to:

✅ **LLM discovers capabilities autonomously**
```javascript
const caps = await fixiplug.dispatch('api:getCapabilities');
// Returns: { capabilities: [{ type: 'table', endpoint: '/api/products/', ... }] }
```

✅ **LLM executes high-level commands**
```javascript
await fixiplug.dispatch('agent:fillForm', {
  form: 'product-form',
  data: { name: 'Laptop', price: 999 }
});
```

✅ **LLM validates form data**
```javascript
const schema = await fixiplug.dispatch('api:getFormSchema', { form: 'product-form' });
// Returns: { email: { type: 'email', required: true }, ... }
```

✅ **LLM tracks operation state**
```javascript
await fixiplug.dispatch('api:waitForState', { state: 'success' });
// Waits for Django API to complete
```

---

## Conclusion

**What's already built:**
- ✅ State Machine Tracker (roadmap #3)
- ✅ Capability Discovery (roadmap #4) - needs enhancement

**What we should build next:**
1. **Enhance Capability Discovery** - Add Django endpoint registration
2. **Agent Command Interface** - High-level API for LLM agents
3. **Form Schema Extractor** - Extract Django form schemas

**Impact on dj-fixi:**
- LLM agents can discover Django endpoints automatically
- LLM agents can interact with tables/forms without DOM knowledge
- Generated Django views are immediately usable by agents
- Complete autonomy: LLM discovers → generates code → interacts → validates

**Recommendation:** Start with **Capability Registry** plugin (Week 1) and **Agent Commands** plugin (Week 2) to unlock full LLM agent potential for the dj-fixi integration.
