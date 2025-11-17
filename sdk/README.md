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
// Create an agent with advanced configuration
const agent = new FixiPlugAgent(fixiplug, {
  // Caching options
  enableCaching: true,       // Cache introspection results (default: true)
  cacheTTL: 300000,         // Cache time-to-live in ms (default: 5 minutes)

  // Performance tracking
  trackPerformance: true,    // Track API call performance (default: false)

  // Retry configuration
  maxRetries: 3,            // Maximum retry attempts (default: 3)
  retryDelay: 100,          // Initial retry delay in ms (default: 100)
  retryBackoff: 2,          // Exponential backoff multiplier (default: 2)
  retryableHooks: [],       // Hooks to retry on error (default: all)

  // Other options
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

### Cache Management

#### `warmCache()`

Warm the cache by performing an initial discovery. Useful for reducing latency on first capability check.

```javascript
await agent.warmCache();
// Now subsequent discover() and hasCapability() calls will be instant
```

**Returns:** `Promise<Capabilities>`

#### `invalidateCache()`

Invalidate cached capabilities, forcing the next `discover()` call to fetch fresh data.

```javascript
agent.invalidateCache();
const freshCaps = await agent.discover(); // Fetches from server
```

#### `getCacheInfo()`

Get information about the current cache state.

```javascript
const cacheInfo = agent.getCacheInfo();
console.log('Cache valid:', cacheInfo.valid);
console.log('Cache has data:', cacheInfo.hasData);
console.log('Time until expiry:', cacheInfo.ttl, 'ms');
console.log('Cache expires at:', new Date(cacheInfo.expiresAt));
```

**Returns:** `CacheInfo` object with:
- `enabled` (boolean): Whether caching is enabled
- `valid` (boolean): Whether cache is currently valid
- `hasData` (boolean): Whether cache has data
- `timestamp` (number | null): When cache was created
- `expiresAt` (number | null): When cache expires
- `ttl` (number): Time until cache expires (ms)
- `maxTTL` (number): Maximum configured TTL

### WorkflowBuilder

The `WorkflowBuilder` provides a fluent API for constructing complex workflows with step dependencies, conditional execution, and error handling.

#### Basic Usage

```javascript
import { WorkflowBuilder } from './sdk/workflow-builder.js';

const workflow = new WorkflowBuilder(agent)
  .step('fetch', 'data:fetch')
    .params({ url: '/api/data' })
    .state('fetching')
  .step('process', 'data:process')
    .params(ctx => ({ data: ctx.results.fetch }))
    .state('processing')
  .step('save', 'data:save')
    .params(ctx => ({ processed: ctx.results.process }))
  .build();

const result = await workflow.execute();
```

#### Workflow Methods

**`.step(name, hook)`** - Add a new step to the workflow

```javascript
builder.step('fetchData', 'api:fetchData')
```

**`.params(params)`** - Set parameters for the current step (can be function or object)

```javascript
.params({ url: '/api/data' })
// or
.params(ctx => ({ data: ctx.results.previousStep }))
```

**`.state(state)`** - Set state before executing this step

```javascript
.state('loading')
```

**`.when(condition)`** - Add a condition for executing the step

```javascript
.when(ctx => ctx.results.check.needsProcessing === true)
```

**`.noRetry()`** - Disable retry for this specific step

```javascript
.noRetry()
```

**`.continueOnError()`** - Continue workflow even if steps fail

```javascript
builder.continueOnError()
```

**`.stopOnError()`** - Stop workflow on first error (default behavior)

```javascript
builder.stopOnError()
```

**`.onError(handler)`** - Add error handler

```javascript
.onError((error, ctx) => {
  console.error('Workflow failed:', error);
  console.log('Completed steps:', ctx.completed);
})
```

**`.before(handler)`** - Add before-execution handler

```javascript
.before((step, ctx) => {
  console.log('Executing:', step.name);
})
```

**`.after(handler)`** - Add after-execution handler

```javascript
.after((step, result, ctx) => {
  console.log('Completed:', step.name, result);
})
```

**`.build()`** - Build and return the executable workflow

```javascript
const workflow = builder.build();
const result = await workflow.execute();
```

#### Workflow Result

The `execute()` method returns a result object:

```javascript
{
  success: boolean,       // Whether workflow completed successfully
  completed: string[],    // Names of completed steps
  results: Object,        // Results from each step (by step name)
  errors: Array,         // Errors encountered
  skipped: string[],     // Names of skipped steps (conditional)
  stoppedAt: string      // Step where workflow stopped (if stopOnError)
}
```

#### Advanced Workflow Example

```javascript
const workflow = new WorkflowBuilder(agent)
  .step('discover', 'api:introspect')
    .params({})
  .step('validate', 'api:getCurrentState')
    .params({})
    .when(ctx => ctx.results.discover.plugins.length > 0)
  .step('process', 'api:setState')
    .params(ctx => ({
      state: 'processing',
      timestamp: Date.now()
    }))
    .state('preparing')
  .step('finalize', 'api:setState')
    .params({ state: 'complete' })
    .noRetry() // Critical step, don't retry
  .continueOnError()
  .before((step) => console.log(`Starting: ${step.name}`))
  .after((step, result) => console.log(`Finished: ${step.name}`))
  .onError((error, ctx) => {
    console.error(`Error in ${ctx.errors[ctx.errors.length - 1].step}`);
  })
  .build();

const result = await workflow.execute();

if (result.success) {
  console.log('All steps completed!');
} else {
  console.log('Completed:', result.completed);
  console.log('Errors:', result.errors);
}
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

### Example 7: Advanced - WorkflowBuilder

See [`examples/sdk-advanced.js`](../examples/sdk-advanced.js) for comprehensive advanced examples including:

- Retry logic with exponential backoff
- WorkflowBuilder fluent API
- Conditional step execution
- Error handling and recovery patterns
- Advanced caching strategies
- Performance tracking and optimization
- Complex real-world workflows

```javascript
import { WorkflowBuilder } from './sdk/workflow-builder.js';

const workflow = new WorkflowBuilder(agent)
  .step('discover', 'api:introspect')
    .params({})
  .step('validate', 'api:getCurrentState')
    .when(ctx => ctx.results.discover.plugins.length > 0)
  .step('process', 'api:setState')
    .params({ state: 'processing' })
    .state('preparing')
  .continueOnError()
  .onError((error, ctx) => {
    console.error('Workflow error:', error);
  })
  .build();

const result = await workflow.execute();
```

### Example 8: Cache Management

```javascript
const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,
  cacheTTL: 60000 // 1 minute
});

// Warm cache on startup
await agent.warmCache();

// Check cache status
const cacheInfo = agent.getCacheInfo();
console.log('Cache valid:', cacheInfo.valid);
console.log('Time until expiry:', cacheInfo.ttl);

// Force refresh
agent.invalidateCache();
const fresh = await agent.discover();
```

### Example 9: Retry Logic

```javascript
const agent = new FixiPlugAgent(fixiplug, {
  maxRetries: 5,
  retryDelay: 100,
  retryBackoff: 2,
  trackPerformance: true
});

// Operations will automatically retry with exponential backoff
// Delay sequence: 100ms, 200ms, 400ms, 800ms, 1600ms
await agent.discover();

const stats = agent.getStats();
console.log('Total retries:', stats.retries);
```

## Performance

Typical performance metrics with introspection and state tracker plugins:

| Operation | API Calls | Time (avg) | Notes |
|-----------|-----------|------------|-------|
| discover() | 1 | ~5ms | Cold (no cache) |
| discover() (cached) | 0 | ~0.1ms | 50x faster with cache |
| hasCapability() (cached) | 0 | ~0.05ms | Instant with warm cache |
| setState() | 1 | ~2ms | |
| waitForState() | 1 | ~150ms | Depends on state change |
| withState() | 2 | ~4ms | Automatic state management |
| executeWorkflow(3 steps) | 3 | ~10ms | |
| WorkflowBuilder (3 steps) | 3 | ~11ms | Minimal overhead |
| warmCache() | 1 | ~5ms | One-time startup cost |
| 10 discoveries (no cache) | 10 | ~50ms | |
| 10 discoveries (with cache) | 1 | ~5ms | 10x improvement |

**Key Performance Insights:**
- **Caching Impact**: Cache reduces discovery from 5ms to 0.1ms (50x improvement)
- **Bulk Operations**: 10 cached discoveries are 10x faster than uncached
- **WorkflowBuilder**: Adds <10% overhead for significantly cleaner code
- **Retry Logic**: Minimal impact when operations succeed on first try
- **Typical Agent Workflow**: 7 API calls, ~150ms with cache warming

## Testing

The SDK includes a comprehensive test suite:

### Unit Tests

Basic functionality tests with mocked fixiplug:

```bash
# Open in browser
open test/sdk/agent-client.test.html
```

- 19 unit tests covering all core features
- Constructor validation
- Discovery and caching
- State management
- Workflow execution
- Performance tracking

### Integration Tests

Real-world tests with actual fixiplug instance:

```bash
# Open in browser
open test/sdk/agent-integration.test.html
```

- Tests with real introspection and state tracker plugins
- Real state management operations
- WorkflowBuilder integration
- Caching with real data
- Error handling with real failures

### Performance Benchmarks

Performance measurement suite:

```bash
# Open in browser
open test/sdk/performance-benchmark.html
```

- Discovery performance (cold vs cached)
- State management benchmarks
- Workflow execution metrics
- Cache performance comparison
- Detailed statistics and percentiles

## License

Part of the FixiPlug project.

## See Also

- [FixiPlug Documentation](../README.md)
- [Agent Integration Guide](../docs/agent-guide.md)
- [Basic Examples](../examples/sdk-basic.js)
- [Advanced Examples](../examples/sdk-advanced.js)
- [Unit Tests](../test/sdk/agent-client.test.html)
- [Integration Tests](../test/sdk/agent-integration.test.html)
- [Performance Benchmarks](../test/sdk/performance-benchmark.html)
- [Introspection Plugin](../plugins/introspection.js)
- [State Tracker Plugin](../plugins/state-tracker.js)
- [TypeScript Definitions](./types.d.ts)
