# LLM Agent Guide to FixiPlug

This guide helps LLM agents (like Claude, GPT-4, etc.) discover and use FixiPlug capabilities autonomously.

## Quick Start for Agents

### Step 1: Discover Capabilities

Start by asking FixiPlug what it can do:

```javascript
const snapshot = await fixiplug.dispatch('api:introspect');
```

**Returns:**
```javascript
{
  fixiplug: {
    version: "0.0.3",
    capabilities: {
      plugins: [...],   // All installed plugins
      hooks: {...},     // All available hooks
      methods: [...]    // Core FixiPlug methods
    },
    metadata: {
      timestamp: "2025-10-03...",
      pluginCount: 3,
      hookCount: 12
    }
  }
}
```

### Step 2: Explore Plugins

List all plugins and their capabilities:

```javascript
const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
```

**Returns:**
```javascript
{
  capabilities: [
    {
      name: "introspectionPlugin",
      enabled: true,
      hooks: [
        { hookName: "api:introspect", priority: 0, handlerCount: 1 },
        { hookName: "api:getPluginCapabilities", priority: 0, handlerCount: 1 },
        // ... more hooks
      ],
      metadata: { type: "function", name: "introspectionPlugin" }
    },
    // ... more plugins
  ]
}
```

### Step 3: Check Hook Schemas

Understand what a specific hook does:

```javascript
const schema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'api:waitForState'
});
```

**Returns:**
```javascript
{
  hookName: "api:waitForState",
  exists: true,
  handlerCount: 1,
  schema: {
    type: "query",
    returns: "data",
    description: "API query hook that returns data",
    inferred: true
  },
  description: "...",
  plugins: ["stateTrackerPlugin"]
}
```

---

## Common Workflows

### Workflow 1: Discover and Execute

**Goal**: Find available actions and execute them

```javascript
// 1. Discover all hooks
const hooks = await fixiplug.dispatch('api:getAvailableHooks');

// 2. Filter for API hooks (these are callable actions)
const apiHooks = Object.keys(hooks.hooks)
  .filter(name => name.startsWith('api:'));

// 3. Pick one and call it
const result = await fixiplug.dispatch('api:getCurrentState');
```

### Workflow 2: Monitor Async Operations

**Goal**: Start an operation and wait for completion

```javascript
// 1. Set state to loading
await fixiplug.dispatch('api:setState', {
  state: 'loading',
  data: { operation: 'fetch-data' }
});

// 2. Start async operation (returns immediately)
fixiplug.dispatch('api:fetchData', { url: 'https://...' })
  .then(async (result) => {
    // 3. Update state when done
    await fixiplug.dispatch('api:setState', {
      state: 'success',
      data: result
    });
  });

// 4. Wait for completion (resolves when state changes)
const waitResult = await fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 5000  // 5 second timeout
});

if (waitResult.error) {
  console.log('Timeout:', waitResult.error);
} else {
  console.log('Completed:', waitResult.data);
}
```

### Workflow 3: Handle Timeouts Gracefully

**Goal**: Wait for a state with timeout protection

```javascript
const result = await fixiplug.dispatch('api:waitForState', {
  state: 'completed',
  timeout: 3000  // 3 seconds
});

// Check for timeout
if (result.error) {
  // Timeout occurred
  console.log('Timed out after', result.waited, 'ms');
  console.log('Error:', result.error);

  // Fallback strategy
  // ...
} else {
  // Success!
  console.log('State reached:', result.state);
  console.log('Data:', result.data);
}
```

### Workflow 4: Review Operation History

**Goal**: Understand what happened during execution

```javascript
const history = await fixiplug.dispatch('api:getStateHistory');

console.log('Total transitions:', history.totalTransitions);
console.log('Current state:', history.currentState);

history.history.forEach(entry => {
  console.log(`${entry.from} → ${entry.to} (${entry.age}ms ago)`);
});
```

---

## Hook Patterns

FixiPlug uses naming conventions to organize hooks:

| Pattern | Type | Description | Example |
|---------|------|-------------|---------|
| `api:*` | Query | Returns data, read-only | `api:getCurrentState` |
| `agent:*` | Command | Performs an action | `agent:fillForm` |
| `state:*` | Event | State change notification | `state:transition` |
| `internal:*` | System | Internal FixiPlug operations | `internal:getHooks` |

### Query Hooks (api:*)

These hooks return data without side effects:

- `api:introspect` - Complete capability snapshot
- `api:getPluginCapabilities` - List all plugins
- `api:getAvailableHooks` - List all hooks
- `api:getPluginDetails` - Plugin information
- `api:getHookSchema` - Hook schema
- `api:getCurrentState` - Current application state
- `api:getStateHistory` - State transition history
- `api:getCommonStates` - Predefined state constants

### Command Hooks (api:* with side effects)

These hooks modify state:

- `api:setState` - Transition to new state
- `api:waitForState` - Wait for state (async)
- `api:registerStateSchema` - Define valid states
- `api:clearStateHistory` - Clear history

---

## State Management

### Common States

FixiPlug provides predefined states:

```javascript
const states = await fixiplug.dispatch('api:getCommonStates');

// Returns:
{
  states: {
    IDLE: "idle",           // Nothing happening
    LOADING: "loading",     // Async operation in progress
    SUCCESS: "success",     // Operation succeeded
    ERROR: "error",         // Operation failed
    PENDING: "pending",     // Operation queued
    COMPLETE: "complete"    // All operations done
  }
}
```

### State Schema Validation

Define allowed state transitions:

```javascript
await fixiplug.dispatch('api:registerStateSchema', {
  states: ['idle', 'loading', 'success', 'error'],
  transitions: {
    idle: ['loading'],                    // idle can only go to loading
    loading: ['success', 'error'],        // loading can go to success or error
    success: ['idle'],                    // success goes back to idle
    error: ['idle']                       // error goes back to idle
  },
  initial: 'idle'
});

// Now invalid transitions are blocked
const result = await fixiplug.dispatch('api:setState', {
  state: 'success',  // Invalid if current state is 'idle'
  validate: true
});

if (result.error) {
  console.log('Invalid transition:', result.error);
  console.log('Valid transitions:', result.validTransitions);
}
```

---

## Error Handling

### Pattern 1: Check for Error Property

All API hooks return objects with optional `error` property:

```javascript
const result = await fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 1000
});

if (result.error) {
  // Handle error
  console.error('Operation failed:', result.error);
} else {
  // Success
  console.log('Result:', result.data);
}
```

### Pattern 2: Validate Before Proceeding

```javascript
const current = await fixiplug.dispatch('api:getCurrentState');

if (current.state === 'error') {
  // Don't proceed, system is in error state
  return;
}

// Safe to continue
```

### Pattern 3: Use Timeouts

Always use timeouts to prevent indefinite waiting:

```javascript
// Good - with timeout
const result = await fixiplug.dispatch('api:waitForState', {
  state: 'complete',
  timeout: 5000  // 5 seconds
});

// Bad - no timeout (waits forever if state never reached)
const result = await fixiplug.dispatch('api:waitForState', {
  state: 'complete'
  // Uses default 30s timeout
});
```

---

## Best Practices for Agents

### 1. Start with Discovery

Always begin by discovering capabilities:

```javascript
// Good
const snapshot = await fixiplug.dispatch('api:introspect');
// Now you know what's available

// Bad
await fixiplug.dispatch('api:someRandomHook');  // Might not exist
```

### 2. Check Hook Existence

Before calling a hook, verify it exists:

```javascript
const schema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'api:fetchData'
});

if (schema.exists) {
  // Safe to call
  const result = await fixiplug.dispatch('api:fetchData', {...});
} else {
  console.log('Hook not available');
}
```

### 3. Use State Tracking for Async

When operations are async, use state tracking:

```javascript
// Set state before starting
await fixiplug.dispatch('api:setState', { state: 'loading' });

// Start operation
doAsyncThing().then(() => {
  fixiplug.dispatch('api:setState', { state: 'success' });
});

// Wait for completion
await fixiplug.dispatch('api:waitForState', { state: 'success', timeout: 5000 });
```

### 4. Review History for Debugging

When things go wrong, check the history:

```javascript
const history = await fixiplug.dispatch('api:getStateHistory');
console.log('Recent transitions:', history.history);
```

### 5. Keep Workflows Simple

Aim for <10 API calls per workflow:

```javascript
// Good - concise workflow (5 calls)
1. api:introspect - discover
2. api:setState - prepare
3. api:doThing - execute
4. api:waitForState - coordinate
5. api:getStateHistory - verify

// Bad - too many calls (>15)
// Multiple discovery calls, redundant state checks, etc.
```

---

## Troubleshooting

### Problem: Hook doesn't exist

**Symptom**: Calling a hook returns the input event unchanged

**Solution**: Check available hooks first
```javascript
const hooks = await fixiplug.dispatch('api:getAvailableHooks');
console.log(Object.keys(hooks.hooks));
```

### Problem: waitForState never resolves

**Symptom**: Code hangs indefinitely

**Solution**:
1. Check if state transition is actually happening
2. Use shorter timeout for testing
3. Verify state name matches exactly

```javascript
// Debug
const before = await fixiplug.dispatch('api:getCurrentState');
console.log('Current state:', before.state);

const result = await fixiplug.dispatch('api:waitForState', {
  state: 'success',  // Make sure this matches exactly
  timeout: 1000      // Short timeout for debugging
});
```

### Problem: State validation blocking transitions

**Symptom**: `setState` returns error about invalid transition

**Solution**: Check registered schema

```javascript
const details = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'stateTrackerPlugin'
});

// Temporarily disable validation
await fixiplug.dispatch('api:setState', {
  state: 'mystate',
  validate: false  // Skip schema validation
});
```

---

## API Reference Summary

### Introspection APIs

| Hook | Parameters | Returns |
|------|-----------|---------|
| `api:introspect` | none | Complete snapshot |
| `api:getPluginCapabilities` | none | Plugin list |
| `api:getAvailableHooks` | none | Hook list |
| `api:getPluginDetails` | `{ pluginName }` | Plugin details |
| `api:getHookSchema` | `{ hookName }` | Hook schema |

### State Tracking APIs

| Hook | Parameters | Returns |
|------|-----------|---------|
| `api:getCurrentState` | none | Current state |
| `api:setState` | `{ state, data?, validate? }` | Transition result |
| `api:waitForState` | `{ state, timeout? }` | Wait result (may have `error`) |
| `api:getStateHistory` | `{ limit? }` | History array |
| `api:registerStateSchema` | `{ states, transitions, initial? }` | Schema result |
| `api:getCommonStates` | none | Common states |
| `api:clearStateHistory` | none | Clear result |

---

## Example: Complete Agent Session

Here's a complete example of an agent discovering and using FixiPlug:

```javascript
// 1. Wake up and discover
console.log("Agent: What can I do here?");
const discovery = await fixiplug.dispatch('api:introspect');
console.log(`Found ${discovery.fixiplug.metadata.pluginCount} plugins`);

// 2. Find state tracking
const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
const stateTracker = plugins.capabilities.find(p =>
  p.name === 'stateTrackerPlugin'
);
console.log("Agent: Found state tracking!");

// 3. Plan workflow
console.log("Agent: I'll fetch data and wait for completion");

// 4. Execute
await fixiplug.dispatch('api:setState', { state: 'loading' });

fixiplug.dispatch('api:fetchData', { url: '...' })
  .then(async (data) => {
    await fixiplug.dispatch('api:setState', {
      state: 'success',
      data
    });
  });

const result = await fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 3000
});

// 5. Verify
if (result.error) {
  console.log("Agent: Timeout, retrying...");
} else {
  console.log(`Agent: Got ${result.data.data.items.length} items!`);
}

// 6. Review
const history = await fixiplug.dispatch('api:getStateHistory');
console.log(`Agent: Completed in ${history.totalTransitions} steps`);
```

---

## Next Steps

- See [test-agent-integration.js](../test-agent-integration.js) for a complete working example
- See [examples/introspection-demo.js](../examples/introspection-demo.js) for discovery patterns
- See [implementation-plan.md](implementation-plan.md) for upcoming features

---

*Last Updated: 2025-10-03*
*FixiPlug Version: 0.0.3*
