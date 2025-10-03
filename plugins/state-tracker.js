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
}
