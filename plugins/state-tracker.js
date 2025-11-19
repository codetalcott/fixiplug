/**
 * FixiPlug State Machine Tracker Plugin
 *
 * Tracks and exposes application state transitions, enabling LLM agents to
 * understand when async operations complete and coordinate multi-step workflows.
 *
 * @module plugins/state-tracker
 *
 * Common States (exported for convenience):
 * - IDLE: Application is idle, no operations in progress
 * - LOADING: Async operation in progress
 * - SUCCESS: Operation completed successfully
 * - ERROR: Operation failed with error
 * - PENDING: Operation queued but not started
 * - COMPLETE: All operations finished
 *
 * API Hooks Exposed:
 * - api:getCurrentState - Get current application state
 * - api:setState - Transition to new state
 * - api:waitForState - Promise that resolves when state reached
 * - api:getStateHistory - Get recent state transitions
 * - api:registerStateSchema - Define valid states and transitions
 * - api:getCommonStates - Get predefined common state constants
 * - api:clearStateHistory - Clear state history
 *
 * Events Emitted (via ctx.emit, deferred):
 * - state:transition - Fired on every state change
 *   Event data: { from, to, data, timestamp }
 * - state:entered:{stateName} - Fired when entering specific state
 *   Event data: { from, data, timestamp }
 * - state:exited:{stateName} - Fired when exiting specific state
 *   Event data: { to, data, timestamp }
 *
 * Note: Events are emitted asynchronously after the state change completes
 * to prevent recursion. Listen to these events in other plugins to react
 * to state transitions.
 *
 * @example
 * // Basic usage
 * fixiplug.use(stateTrackerPlugin);
 *
 * // Listen for state transitions
 * fixiplug.use(function myPlugin(ctx) {
 *   ctx.on('state:transition', (event) => {
 *     console.log(`State changed: ${event.from} -> ${event.to}`);
 *   });
 *
 *   ctx.on('state:entered:success', (event) => {
 *     console.log('Operation succeeded!', event.data);
 *   });
 * });
 *
 * // Set state
 * await fixiplug.dispatch('api:setState', { state: 'loading' });
 *
 * // Wait for completion
 * await fixiplug.dispatch('api:waitForState', { state: 'success', timeout: 5000 });
 *
 * @example
 * // With state schema validation
 * await fixiplug.dispatch('api:registerStateSchema', {
 *   states: ['idle', 'loading', 'success', 'error'],
 *   transitions: {
 *     idle: ['loading'],
 *     loading: ['success', 'error'],
 *     success: ['idle'],
 *     error: ['idle']
 *   }
 * });
 */

/**
 * Common application states
 */
export const COMMON_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  COMPLETE: 'complete'
};

/**
 * State tracker plugin factory
 * @param {Object} ctx - Plugin context
 */
export default function stateTrackerPlugin(ctx) {
  // Current state
  const currentState = {
    status: COMMON_STATES.IDLE,
    data: {},
    timestamp: Date.now()
  };

  // State history (circular buffer)
  const stateHistory = [];
  const MAX_HISTORY_SIZE = 50;

  // Pending waiters: Map<stateName, Array<resolver>>
  const waiters = new Map();

  // State schema (optional validation)
  let stateSchema = null;

  // ========================================
  // API: Get Current State
  // ========================================
  ctx.on('api:getCurrentState', () => {
    return {
      state: currentState.status,
      data: { ...currentState.data },
      timestamp: currentState.timestamp,
      age: Date.now() - currentState.timestamp
    };
  });

  // ========================================
  // API: Set State (with transition)
  // ========================================
  ctx.on('api:setState', async (event) => {
    const { state, data = {}, validate = true } = event;

    if (!state) {
      return { error: 'state parameter required' };
    }

    const previousState = currentState.status;
    const previousData = { ...currentState.data };

    // Validate transition if schema is registered
    if (validate && stateSchema && !isValidTransition(previousState, state)) {
      return {
        error: `Invalid transition: ${previousState} -> ${state}`,
        validTransitions: stateSchema.transitions[previousState] || []
      };
    }

    // Update current state
    currentState.status = state;
    currentState.data = data;
    currentState.timestamp = Date.now();

    // Add to history
    addToHistory({
      from: previousState,
      to: state,
      data,
      previousData,
      timestamp: currentState.timestamp
    });

    // Resolve any waiters (synchronously to avoid hanging)
    resolveWaiters(state);

    // Emit transition events (deferred to avoid recursion)
    ctx.emit('state:transition', {
      from: previousState,
      to: state,
      data,
      timestamp: currentState.timestamp
    });

    // Emit specific state exit event
    if (previousState) {
      ctx.emit(`state:exited:${previousState}`, {
        to: state,
        data,
        timestamp: currentState.timestamp
      });
    }

    // Emit specific state entry event
    ctx.emit(`state:entered:${state}`, {
      from: previousState,
      data,
      timestamp: currentState.timestamp
    });

    return {
      success: true,
      state: currentState.status,
      previousState,
      timestamp: currentState.timestamp,
      transition: {
        from: previousState,
        to: state
      }
    };
  });

  // ========================================
  // API: Wait For State
  // ========================================
  ctx.on('api:waitForState', (event) => {
    const { state, timeout = 30000 } = event;

    if (!state) {
      return { error: 'state parameter required' };
    }

    // Already in target state?
    if (currentState.status === state) {
      return {
        success: true,
        state: currentState.status,
        data: { ...currentState.data },
        timestamp: currentState.timestamp,
        waited: 0
      };
    }

    // Create waiter promise
    // Note: We resolve with error object instead of rejecting because
    // the dispatch system catches and swallows rejections
    const startTime = Date.now();
    return new Promise((resolve) => {
      // Add to waiters
      if (!waiters.has(state)) {
        waiters.set(state, []);
      }

      const waiter = {
        resolve: (data) => resolve({
          success: true,
          state,
          data,
          timestamp: Date.now(),
          waited: Date.now() - startTime
        }),
        timeout: () => resolve({
          error: `Timeout waiting for state: ${state}`,
          timeout: timeout,
          waited: Date.now() - startTime
        })
      };

      waiters.get(state).push(waiter);

      // Setup timeout
      if (timeout > 0) {
        setTimeout(() => {
          const waiterList = waiters.get(state) || [];
          const index = waiterList.indexOf(waiter);
          if (index > -1) {
            waiterList.splice(index, 1);
            waiter.timeout();
          }
        }, timeout);
      }
    });
  });

  // ========================================
  // API: Get State History
  // ========================================
  ctx.on('api:getStateHistory', (event) => {
    const { limit = MAX_HISTORY_SIZE } = event || {};

    return {
      history: stateHistory.slice(-limit).map(entry => ({
        from: entry.from,
        to: entry.to,
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp,
        data: entry.data
      })),
      currentState: currentState.status,
      totalTransitions: stateHistory.length
    };
  });

  // ========================================
  // API: Register State Schema
  // ========================================
  ctx.on('api:registerStateSchema', (event) => {
    const { states, transitions, initial } = event;

    if (!states || !Array.isArray(states)) {
      return { error: 'states array required' };
    }

    if (!transitions || typeof transitions !== 'object') {
      return { error: 'transitions object required' };
    }

    stateSchema = {
      states,
      transitions,
      initial: initial || COMMON_STATES.IDLE
    };

    // Validate transitions object
    for (const [from, toStates] of Object.entries(transitions)) {
      if (!states.includes(from)) {
        return { error: `Invalid state in transitions: ${from}` };
      }
      if (!Array.isArray(toStates)) {
        return { error: `transitions[${from}] must be an array` };
      }
      for (const to of toStates) {
        if (!states.includes(to)) {
          return { error: `Invalid transition target: ${to}` };
        }
      }
    }

    // Reset to initial state if specified
    if (initial && currentState.status !== initial) {
      currentState.status = initial;
      currentState.data = {};
      currentState.timestamp = Date.now();
    }

    return {
      success: true,
      schema: {
        states: stateSchema.states,
        transitionCount: Object.keys(stateSchema.transitions).length,
        initial: stateSchema.initial
      }
    };
  });

  // ========================================
  // API: Get Common States
  // ========================================
  ctx.on('api:getCommonStates', () => {
    return {
      states: COMMON_STATES,
      description: 'Predefined common application states'
    };
  });

  // ========================================
  // API: Clear State History
  // ========================================
  ctx.on('api:clearStateHistory', () => {
    const cleared = stateHistory.length;
    stateHistory.length = 0;
    return {
      success: true,
      cleared
    };
  });

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Add entry to state history (circular buffer)
   */
  function addToHistory(entry) {
    stateHistory.push(entry);
    if (stateHistory.length > MAX_HISTORY_SIZE) {
      stateHistory.shift();
    }
  }

  /**
   * Check if transition is valid according to schema
   */
  function isValidTransition(from, to) {
    if (!stateSchema) return true;

    const allowedTransitions = stateSchema.transitions[from];
    if (!allowedTransitions) {
      // If no transitions defined for this state, allow anything
      return true;
    }

    return allowedTransitions.includes(to);
  }

  /**
   * Resolve all waiters for a given state
   */
  function resolveWaiters(state) {
    const waiterList = waiters.get(state);
    if (!waiterList || waiterList.length === 0) return;

    // Resolve all waiters
    const data = { ...currentState.data };
    waiterList.forEach(waiter => waiter.resolve(data));

    // Clear waiter list
    waiters.set(state, []);
  }

  // ========================================
  // Cleanup
  // ========================================
  ctx.registerCleanup(() => {
    // Reject any pending waiters
    for (const [state, waiterList] of waiters.entries()) {
      waiterList.forEach(waiter => {
        waiter.reject(new Error('State tracker plugin unloaded'));
      });
    }
    waiters.clear();
    stateHistory.length = 0;
  });

  // ========================================
  // Skill Metadata (Hybrid Plugin Example)
  // ========================================
  return {
    skill: {
      name: 'state-machine-coordination',

      description: 'Coordinate multi-step workflows and async operations using a state machine. Use when you need to track progress through defined states, wait for operations to complete, validate state transitions, or coordinate between multiple async processes.',

      instructions: `# State Machine Coordination with FixiPlug

## Overview

The State Tracker plugin provides a shared, application-wide state machine for coordinating complex workflows. Think of it as a traffic controller for your async operations.

## Key Concept: Singleton State

The state machine is **shared across all plugins** - there's only one current state at any time. This makes it perfect for:
- Coordinating between independent components
- Tracking overall application status
- Waiting for operations to complete
- Validating workflow sequences

## Quick Start Pattern

\`\`\`javascript
// 1. Get common state constants
const states = await api:getCommonStates()
// Returns: {states: {IDLE: "idle", LOADING: "loading", SUCCESS: "success", ERROR: "error"}}

// 2. Define your state machine (optional but recommended)
await api:registerStateSchema({
  states: ['idle', 'loading', 'success', 'error'],
  transitions: {
    idle: ['loading'],
    loading: ['success', 'error'],
    success: ['idle'],
    error: ['idle']
  },
  initial: 'idle'
})

// 3. Transition states as your workflow progresses
await api:setState({ state: 'loading' })
// ... do async work ...
await api:setState({ state: 'success', data: {result: 42} })

// 4. Other code can wait for completion
const result = await api:waitForState({ state: 'success', timeout: 5000 })
console.log(result.data) // {result: 42}
\`\`\`

## Pattern 1: Simple Async Coordination

**Use Case:** Wait for an async operation to complete

\`\`\`javascript
// Component A: Start operation
await api:setState({ state: 'fetching-data' })
// ... trigger fetch ...

// Component B: Wait for it
const result = await api:waitForState({
  state: 'data-loaded',
  timeout: 10000
})
if (result.error) {
  console.error('Timeout!', result)
} else {
  console.log('Got data:', result.data)
}
\`\`\`

## Pattern 2: Multi-Step Workflow

**Use Case:** Track progress through sequential steps

\`\`\`javascript
// Define workflow
await api:registerStateSchema({
  states: ['start', 'authenticating', 'loading-profile', 'loading-preferences', 'ready'],
  transitions: {
    start: ['authenticating'],
    authenticating: ['loading-profile', 'error'],
    'loading-profile': ['loading-preferences', 'error'],
    'loading-preferences': ['ready', 'error'],
    ready: ['start'],
    error: ['start']
  }
})

// Execute workflow
await api:setState({ state: 'start' })
await api:setState({ state: 'authenticating' })
const authResult = await authenticate()
if (authResult.success) {
  await api:setState({ state: 'loading-profile' })
  // ... continues ...
} else {
  await api:setState({ state: 'error', data: {reason: 'auth failed'} })
}
\`\`\`

## Pattern 3: Error Recovery

**Use Case:** Track errors and allow retry

\`\`\`javascript
// Register schema with error recovery
await api:registerStateSchema({
  states: ['idle', 'processing', 'success', 'error'],
  transitions: {
    idle: ['processing'],
    processing: ['success', 'error'],
    success: ['idle'],
    error: ['idle', 'processing'] // Can retry from error
  }
})

// Attempt operation
await api:setState({ state: 'processing' })
try {
  const result = await riskyOperation()
  await api:setState({ state: 'success', data: result })
} catch (error) {
  await api:setState({
    state: 'error',
    data: {
      error: error.message,
      retryable: true,
      attemptCount: 1
    }
  })
}

// Later, retry from error state
const current = await api:getCurrentState()
if (current.state === 'error' && current.data.retryable) {
  await api:setState({ state: 'processing' })
  // ... try again ...
}
\`\`\`

## Pattern 4: Progress Tracking

**Use Case:** Track progress of long-running operation

\`\`\`javascript
// Define granular states
await api:registerStateSchema({
  states: [
    'idle',
    'step-1-of-5',
    'step-2-of-5',
    'step-3-of-5',
    'step-4-of-5',
    'step-5-of-5',
    'complete'
  ],
  transitions: {
    idle: ['step-1-of-5'],
    'step-1-of-5': ['step-2-of-5', 'error'],
    'step-2-of-5': ['step-3-of-5', 'error'],
    // ... etc
  }
})

// Update UI based on progress
ctx.on('state:transition', (event) => {
  const progress = extractProgressPercent(event.to)
  updateProgressBar(progress)
})
\`\`\`

## Pattern 5: Debugging with State History

**Use Case:** Understand what went wrong

\`\`\`javascript
// Something went wrong, check history
const history = await api:getStateHistory({ limit: 10 })
console.log('Recent transitions:', history.history)

// Example output:
// [{
//   from: 'idle',
//   to: 'loading',
//   timestamp: 1234567890,
//   age: 5000, // ms ago
//   data: {}
// }, ...]

// Clear history when done debugging
await api:clearStateHistory()
\`\`\`

## Important Concepts

### State Validation

When you register a schema, transitions are **validated**:

\`\`\`javascript
await api:registerStateSchema({
  states: ['a', 'b'],
  transitions: {
    a: ['b'],
    b: [] // b is a terminal state
  }
})

// This works
await api:setState({ state: 'a' })
await api:setState({ state: 'b' })

// This fails!
await api:setState({ state: 'a' })
// Returns: {error: "Invalid transition: b -> a", validTransitions: []}
\`\`\`

### Bypass Validation

Sometimes you need to force a state:

\`\`\`javascript
await api:setState({
  state: 'emergency-reset',
  validate: false  // Skip validation
})
\`\`\`

### Wait Timeouts

Always set reasonable timeouts:

\`\`\`javascript
// Bad: infinite wait
await api:waitForState({ state: 'done' }) // Could hang forever!

// Good: timeout with handling
const result = await api:waitForState({
  state: 'done',
  timeout: 5000
})
if (result.error) {
  // Handle timeout
}
\`\`\`

### State Data

Attach data to state transitions:

\`\`\`javascript
await api:setState({
  state: 'user-loaded',
  data: {
    userId: 123,
    name: 'Alice',
    permissions: ['read', 'write']
  }
})

// Retrieve later
const current = await api:getCurrentState()
console.log(current.data.name) // 'Alice'
\`\`\`

## Common Pitfalls

### ❌ Don't: Create circular transitions
\`\`\`javascript
ctx.on('state:entered:loading', async () => {
  await api:setState({ state: 'loaded' })
})
ctx.on('state:entered:loaded', async () => {
  await api:setState({ state: 'loading' }) // Infinite loop!
})
\`\`\`

### ✅ Do: Use conditional logic
\`\`\`javascript
let shouldReload = true
ctx.on('state:entered:loaded', async () => {
  if (shouldReload) {
    shouldReload = false
    await api:setState({ state: 'loading' })
  }
})
\`\`\`

### ❌ Don't: Forget error states
\`\`\`javascript
await api:registerStateSchema({
  states: ['idle', 'loading', 'success'],
  // Missing error state - what happens on failure?
})
\`\`\`

### ✅ Do: Always include error handling
\`\`\`javascript
await api:registerStateSchema({
  states: ['idle', 'loading', 'success', 'error'],
  transitions: {
    loading: ['success', 'error'] // Both outcomes
  }
})
\`\`\`

## Best Practices

1. **Use COMMON_STATES**: Start with predefined states
   \`\`\`javascript
   const {states} = await api:getCommonStates()
   await api:setState({ state: states.LOADING })
   \`\`\`

2. **Document Your State Machine**: Add comments
   \`\`\`javascript
   // User onboarding flow: start -> email -> profile -> complete
   await api:registerStateSchema({ /* ... */ })
   \`\`\`

3. **Keep States Granular**: Prefer specific states over generic ones
   - Good: 'validating-email', 'sending-confirmation'
   - Bad: 'processing', 'busy'

4. **Use State Data**: Don't rely on external variables
   \`\`\`javascript
   // Bad
   let lastError = null
   await api:setState({ state: 'error' })

   // Good
   await api:setState({
     state: 'error',
     data: { error: 'Connection failed' }
   })
   \`\`\`

5. **Clear History Periodically**: Prevent memory leaks
   \`\`\`javascript
   ctx.on('state:entered:complete', async () => {
     await api:clearStateHistory()
   })
   \`\`\`

## Integration with Events

Listen to state changes in other plugins:

\`\`\`javascript
// In any plugin
ctx.on('state:transition', (event) => {
  console.log(\`\${event.from} → \${event.to}\`)
})

ctx.on('state:entered:error', (event) => {
  logError(event.data)
})

ctx.on('state:exited:loading', (event) => {
  hideSpinner()
})
\`\`\`

## Complete Example: File Upload

\`\`\`javascript
// 1. Define states
await api:registerStateSchema({
  states: [
    'idle',
    'validating-file',
    'uploading',
    'processing',
    'complete',
    'error'
  ],
  transitions: {
    idle: ['validating-file'],
    'validating-file': ['uploading', 'error'],
    uploading: ['processing', 'error'],
    processing: ['complete', 'error'],
    complete: ['idle'],
    error: ['idle']
  }
})

// 2. Handle file selection
async function handleFileSelect(file) {
  await api:setState({ state: 'validating-file' })

  if (file.size > MAX_SIZE) {
    await api:setState({
      state: 'error',
      data: { reason: 'File too large' }
    })
    return
  }

  await api:setState({
    state: 'uploading',
    data: { filename: file.name, progress: 0 }
  })

  try {
    await uploadFile(file, (progress) => {
      // Update progress without changing state
      api:setState({
        state: 'uploading',
        data: { filename: file.name, progress }
      })
    })

    await api:setState({ state: 'processing' })
    const result = await waitForProcessing()
    await api:setState({
      state: 'complete',
      data: { url: result.url }
    })
  } catch (error) {
    await api:setState({
      state: 'error',
      data: { reason: error.message }
    })
  }
}

// 3. UI component waits and updates
const result = await api:waitForState({
  state: 'complete',
  timeout: 60000
})
if (!result.error) {
  displaySuccessMessage(result.data.url)
}
\`\`\`

## Summary

State Tracker = **Coordination + Validation + History**

- Define states and transitions
- Update state as workflow progresses
- Wait for specific states
- Listen to state change events
- Debug with state history

Use it whenever you have:
- Multiple async operations that need coordination
- Workflows with defined steps
- Complex state that multiple components care about
- Need to validate business logic transitions
`,

      references: ['introspectionPlugin'],

      tags: [
        'state-management',
        'coordination',
        'async',
        'workflow',
        'state-machine',
        'patterns'
      ],

      version: '1.0.0',
      author: 'FixiPlug Team',
      level: 'intermediate'
    }
  };
}
