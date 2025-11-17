# FixiPlug Agent SDK

High-level client library for LLM agents to interact with FixiPlug-powered applications.

## Overview

The FixiPlug Agent SDK provides a clean, ergonomic API that enables autonomous agents to:

- **Discover capabilities** without reading documentation
- **Manage application state** automatically
- **Coordinate async operations** with minimal API calls
- **Execute multi-step workflows** with error handling
- **Track performance** for optimization

## Quick Start

### Installation

```javascript
import { FixiPlugAgent } from './sdk/agent-client.js';
import fixiplug from './fixiplug.js';
```

### Basic Usage

```javascript
// Create an agent
const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,       // Cache introspection results (default: true)
  trackPerformance: true,    // Track API call performance (default: false)
  defaultTimeout: 5000       // Default timeout for state waiting in ms (default: 5000)
});

// Discover what's available
const capabilities = await agent.discover();
console.log('Plugins:', capabilities.plugins.map(p => p.name));
console.log('Hooks:', Object.keys(capabilities.hooks));

// Check for specific capability
if (await agent.hasCapability('fixiplug-state-tracker')) {
  console.log('State tracking available!');
}
```

## Core Methods

### Discovery

#### `discover(options?)`

Discover available capabilities from the fixiplug instance.

```javascript
const caps = await agent.discover();
console.log('Version:', caps.version);
console.log('Features:', caps.features);
console.log('Plugins:', caps.plugins);
console.log('Hooks:', caps.hooks);
```

**Options:**
- `refresh` (boolean): Force refresh cached capabilities (default: false)

**Returns:** `Promise<Capabilities>`

#### `hasCapability(capability)`

Check if a specific capability (plugin or hook) is available.

```javascript
const hasStateTracker = await agent.hasCapability('fixiplug-state-tracker');
const hasHook = await agent.hasCapability('api:setState');
```

**Returns:** `Promise<boolean>`

### State Management

#### `getCurrentState()`

Get current application state.

```javascript
const current = await agent.getCurrentState();
console.log('State:', current.state);
console.log('Age:', current.age, 'ms');
```

**Returns:** `Promise<StateInfo>`

#### `setState(state, options?)`

Set application state.

```javascript
await agent.setState('loading');
await agent.setState('complete');
```

**Returns:** `Promise<Object>`

#### `waitForState(state, options?)`

Wait for application to reach a specific state.

```javascript
// Start async operation
await agent.setState('loading');
startAsyncWork().then(() => agent.setState('complete'));

// Wait for completion
const result = await agent.waitForState('complete', { timeout: 10000 });
console.log('Completed in', result.waited, 'ms');
```

**Options:**
- `timeout` (number): Timeout in milliseconds (default: from constructor options)

**Returns:** `Promise<WaitResult>`

**Throws:** Error if timeout exceeded

#### `withState(state, fn, options?)`

Execute a function with automatic state management.

```javascript
const result = await agent.withState('processing', async () => {
  const data = await fetchData();
  const processed = await processData(data);
  return processed;
});
// State automatically set to 'complete' on success, 'error' on failure
```

**Options:**
- `completeState` (string): State to set on success (default: 'complete')
- `errorState` (string): State to set on error (default: 'error')

**Returns:** `Promise<T>` where T is the function's return type

### Workflow Execution

#### `executeWorkflow(steps, options?)`

Execute a multi-step workflow.

```javascript
const result = await agent.executeWorkflow([
  {
    name: 'fetch',
    hook: 'data:fetch',
    params: { url: '/api/data' }
  },
  {
    name: 'process',
    hook: 'data:process',
    params: (ctx) => ({ data: ctx.results.fetch })  // Use previous result
  },
  {
    name: 'save',
    hook: 'data:save',
    params: (ctx) => ({ processed: ctx.results.process }),
    state: 'saving'  // Optional state for this step
  }
]);

console.log('Success:', result.success);
console.log('Results:', result.results);
console.log('Errors:', result.errors);
```

**Options:**
- `stopOnError` (boolean): Stop workflow on first error (default: true)

**Returns:** `Promise<WorkflowResult>`

### Performance Tracking

#### `getStats()`

Get performance statistics (if tracking enabled).

```javascript
const stats = agent.getStats();
console.log('API calls:', stats.apiCalls);
console.log('Total time:', stats.totalTime, 'ms');
console.log('Average time:', stats.averageTime, 'ms');
console.log('Individual calls:', stats.calls);
```

**Returns:** `PerformanceStats` or error object if tracking disabled

#### `resetStats()`

Reset performance statistics.

```javascript
agent.resetStats();
```

## Examples

### Example 1: Simple State Tracking

```javascript
const agent = new FixiPlugAgent(fixiplug);

await agent.setState('loading');

// Do work...
await new Promise(resolve => setTimeout(resolve, 1000));

await agent.setState('complete');
```

### Example 2: Wait for Async Operation

```javascript
const agent = new FixiPlugAgent(fixiplug);

await agent.setState('processing');

// Start async operation
startLongRunningTask().then(() => {
  agent.setState('complete');
});

// Wait for it to finish
const result = await agent.waitForState('complete', { timeout: 30000 });
console.log('Operation completed in', result.waited, 'ms');
```

### Example 3: Automatic State Management

```javascript
const agent = new FixiPlugAgent(fixiplug);

try {
  const result = await agent.withState('processing', async () => {
    // All work happens here
    const data = await fetchData();
    return await processData(data);
  });
  // State is now 'complete'
  console.log('Result:', result);
} catch (error) {
  // State is now 'error'
  console.error('Failed:', error);
}
```

### Example 4: Multi-Step Workflow

```javascript
const agent = new FixiPlugAgent(fixiplug);

const workflow = await agent.executeWorkflow([
  {
    name: 'init',
    hook: 'workflow:initialize',
    params: { config: 'default' },
    state: 'initializing'
  },
  {
    name: 'execute',
    hook: 'workflow:execute',
    params: (ctx) => ({ initResult: ctx.results.init }),
    state: 'executing'
  },
  {
    name: 'finalize',
    hook: 'workflow:finalize',
    params: (ctx) => ({
      initResult: ctx.results.init,
      executeResult: ctx.results.execute
    }),
    state: 'finalizing'
  }
]);

if (workflow.success) {
  console.log('Workflow completed!');
  console.log('Results:', workflow.results);
} else {
  console.error('Workflow failed at:', workflow.stoppedAt);
  console.error('Errors:', workflow.errors);
}
```

### Example 5: Error Handling and Recovery

```javascript
const agent = new FixiPlugAgent(fixiplug);

const workflow = await agent.executeWorkflow([
  {
    name: 'step1',
    hook: 'api:operation1',
    params: {}
  },
  {
    name: 'step2',
    hook: 'api:possiblyFailingOperation',
    params: {}
  },
  {
    name: 'step3',
    hook: 'api:operation3',
    params: {}
  }
], {
  stopOnError: false  // Continue on errors
});

// Check which steps failed
workflow.errors.forEach(error => {
  console.log(`Step ${error.step} failed: ${error.error}`);
});

// Retry failed steps
for (const error of workflow.errors) {
  console.log(`Retrying ${error.step}...`);
  // Retry logic here
}
```

### Example 6: Discovery and Capability Checking

```javascript
const agent = new FixiPlugAgent(fixiplug);

// Discover what's available
const caps = await agent.discover();

console.log('Available plugins:');
caps.plugins.forEach(plugin => {
  console.log(`  - ${plugin.name} (${plugin.enabled ? 'enabled' : 'disabled'})`);
});

// Check for required capabilities before using them
const requiredCapabilities = [
  'fixiplug-state-tracker',
  'fixiplug-introspection'
];

for (const cap of requiredCapabilities) {
  if (!await agent.hasCapability(cap)) {
    throw new Error(`Required capability missing: ${cap}`);
  }
}

console.log('All required capabilities available!');
```

## TypeScript Support

The SDK includes full TypeScript definitions in `types.d.ts`:

```typescript
import { FixiPlugAgent, AgentOptions, Capabilities } from './sdk/agent-client.js';

const options: AgentOptions = {
  enableCaching: true,
  trackPerformance: true,
  defaultTimeout: 5000
};

const agent = new FixiPlugAgent(fixiplug, options);

const caps: Capabilities = await agent.discover();
```

## Testing

Run the test suite:

```bash
# Open in browser
open test/sdk/agent-client.test.html
```

The test suite includes:
- Constructor validation
- Discovery and caching
- State management
- Workflow execution
- Error handling
- Performance tracking

## API Reference

See complete API documentation in the TypeScript definitions file: [`types.d.ts`](./types.d.ts)

## Best Practices

### 1. Always Discover First

```javascript
const agent = new FixiPlugAgent(fixiplug);
await agent.discover();  // Do this first
```

### 2. Check Capabilities Before Using

```javascript
if (await agent.hasCapability('fixiplug-state-tracker')) {
  await agent.setState('processing');
}
```

### 3. Use withState for Automatic Management

```javascript
// Good: Automatic state management
await agent.withState('processing', async () => {
  return await doWork();
});

// Avoid: Manual state management (error-prone)
await agent.setState('processing');
try {
  await doWork();
  await agent.setState('complete');
} catch (error) {
  await agent.setState('error');
  throw error;
}
```

### 4. Enable Performance Tracking During Development

```javascript
const agent = new FixiPlugAgent(fixiplug, {
  trackPerformance: true  // Enable during development
});

// Later...
console.log(agent.getStats());
```

### 5. Handle Workflow Errors Gracefully

```javascript
const result = await agent.executeWorkflow(steps);

if (!result.success) {
  console.error('Workflow failed:');
  result.errors.forEach(err => {
    console.error(`  ${err.step}: ${err.error}`);
  });
  // Implement recovery logic
}
```

## Performance

Typical performance metrics with introspection and state tracker plugins:

| Operation | API Calls | Time (avg) |
|-----------|-----------|------------|
| discover() | 1 | ~5ms |
| discover() (cached) | 0 | ~0.1ms |
| setState() | 1 | ~2ms |
| waitForState() | 1 | ~150ms |
| withState() | 2 | ~4ms |
| executeWorkflow(3 steps) | 3 | ~10ms |

**Total for typical agent workflow**: 7 API calls, ~150ms

## License

Part of the FixiPlug project.

## See Also

- [FixiPlug Documentation](../README.md)
- [Agent Integration Guide](../docs/agent-guide.md)
- [Examples](../examples/)
- [Introspection Plugin](../plugins/introspection.js)
- [State Tracker Plugin](../plugins/state-tracker.js)
