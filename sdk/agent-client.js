/**
 * FixiPlug Agent SDK - High-level client for LLM agents
 *
 * Provides a clean, ergonomic API for autonomous agents to interact with
 * FixiPlug-powered applications. Handles discovery, state management,
 * and workflow coordination with minimal API calls.
 *
 * @module sdk/agent-client
 * @example
 * import { FixiPlugAgent } from './sdk/agent-client.js';
 *
 * const agent = new FixiPlugAgent(fixiplug);
 * await agent.discover();
 *
 * await agent.withState('processing', async () => {
 *   const result = await processData();
 *   return result;
 * });
 */

/**
 * Main agent client class for interacting with FixiPlug
 *
 * @class FixiPlugAgent
 * @example
 * const agent = new FixiPlugAgent(fixiplug);
 * const capabilities = await agent.discover();
 * console.log('Available plugins:', capabilities.plugins);
 */
export class FixiPlugAgent {
  /**
   * Create a new FixiPlug agent client
   *
   * @param {Object} fixiplugInstance - The fixiplug instance to interact with
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.enableCaching=true] - Cache introspection results
   * @param {boolean} [options.trackPerformance=false] - Track API call performance
   * @param {number} [options.defaultTimeout=5000] - Default timeout for state waiting (ms)
   */
  constructor(fixiplugInstance, options = {}) {
    if (!fixiplugInstance) {
      throw new Error('FixiPlugAgent requires a fixiplug instance');
    }

    if (typeof fixiplugInstance.dispatch !== 'function') {
      throw new Error('Invalid fixiplug instance: missing dispatch method');
    }

    this.fixi = fixiplugInstance;
    this.capabilities = null;
    this.options = {
      enableCaching: options.enableCaching !== false,
      trackPerformance: options.trackPerformance || false,
      defaultTimeout: options.defaultTimeout || 5000
    };

    // Performance tracking
    this.stats = {
      apiCalls: 0,
      totalTime: 0,
      calls: []
    };
  }

  /**
   * Discover available capabilities from the fixiplug instance
   *
   * Queries the introspection API to understand what plugins, hooks,
   * and features are available. Results are cached by default.
   *
   * @param {Object} [options={}] - Discovery options
   * @param {boolean} [options.refresh=false] - Force refresh cached capabilities
   * @returns {Promise<Object>} Capabilities object with plugins, hooks, and metadata
   *
   * @example
   * const caps = await agent.discover();
   * console.log('Plugins:', caps.plugins.map(p => p.name));
   * console.log('Available hooks:', Object.keys(caps.hooks));
   */
  async discover(options = {}) {
    const { refresh = false } = options;

    // Return cached if available and not forcing refresh
    if (this.capabilities && !refresh && this.options.enableCaching) {
      return this.capabilities;
    }

    try {
      const result = await this._dispatch('api:introspect', {});

      if (result.error) {
        throw new Error(`Discovery failed: ${result.error}`);
      }

      // Store capabilities
      this.capabilities = {
        version: result.fixiplug?.version || 'unknown',
        features: result.fixiplug?.features || [],
        plugins: result.plugins || [],
        hooks: result.hooks || {},
        methods: result.methods || [],
        timestamp: Date.now()
      };

      return this.capabilities;
    } catch (error) {
      throw new Error(`Failed to discover capabilities: ${error.message}`);
    }
  }

  /**
   * Check if a specific capability is available
   *
   * @param {string} capability - Capability name (plugin name or hook name)
   * @returns {Promise<boolean>} True if capability is available
   *
   * @example
   * if (await agent.hasCapability('fixiplug-state-tracker')) {
   *   await agent.setState('processing');
   * }
   */
  async hasCapability(capability) {
    if (!this.capabilities) {
      await this.discover();
    }

    // Check if it's a plugin
    const hasPlugin = this.capabilities.plugins.some(p =>
      p.name === capability
    );

    if (hasPlugin) return true;

    // Check if it's a hook
    return capability in this.capabilities.hooks;
  }

  /**
   * Get current application state
   *
   * @returns {Promise<Object>} Current state object with { state, timestamp, age }
   *
   * @example
   * const current = await agent.getCurrentState();
   * console.log('Current state:', current.state);
   */
  async getCurrentState() {
    const result = await this._dispatch('api:getCurrentState', {});

    if (result.error) {
      throw new Error(`Failed to get state: ${result.error}`);
    }

    return result;
  }

  /**
   * Set application state
   *
   * @param {string} state - Target state name
   * @param {Object} [options={}] - State transition options
   * @returns {Promise<Object>} Transition result
   *
   * @example
   * await agent.setState('loading');
   * // ... do work ...
   * await agent.setState('complete');
   */
  async setState(state, options = {}) {
    const result = await this._dispatch('api:setState', {
      state,
      ...options
    });

    if (result.error) {
      throw new Error(`Failed to set state: ${result.error}`);
    }

    return result;
  }

  /**
   * Wait for application to reach a specific state
   *
   * Returns a promise that resolves when the target state is reached,
   * or rejects if the timeout is exceeded.
   *
   * @param {string} state - Target state to wait for
   * @param {Object} [options={}] - Wait options
   * @param {number} [options.timeout] - Timeout in milliseconds (default: 5000)
   * @returns {Promise<Object>} Result object when state is reached
   *
   * @example
   * await agent.setState('loading');
   * startAsyncOperation().then(() => agent.setState('complete'));
   *
   * const result = await agent.waitForState('complete', { timeout: 10000 });
   * console.log('Operation completed in', result.waited, 'ms');
   */
  async waitForState(state, options = {}) {
    const timeout = options.timeout || this.options.defaultTimeout;

    const result = await this._dispatch('api:waitForState', {
      state,
      timeout
    });

    if (result.error) {
      if (result.error.includes('timeout')) {
        throw new Error(`Timeout waiting for state "${state}" after ${timeout}ms`);
      }
      throw new Error(`Failed to wait for state: ${result.error}`);
    }

    return result;
  }

  /**
   * Execute a function with automatic state management
   *
   * Sets the state before execution, runs the function, and sets
   * the completion state afterwards. Handles errors by setting
   * error state.
   *
   * @param {string} state - State to set during execution (e.g., 'processing')
   * @param {Function} fn - Async function to execute
   * @param {Object} [options={}] - Execution options
   * @param {string} [options.completeState='complete'] - State to set on success
   * @param {string} [options.errorState='error'] - State to set on error
   * @returns {Promise<*>} Result of the function execution
   *
   * @example
   * const result = await agent.withState('processing', async () => {
   *   const data = await fetchData();
   *   const processed = await processData(data);
   *   return processed;
   * });
   */
  async withState(state, fn, options = {}) {
    const {
      completeState = 'complete',
      errorState = 'error'
    } = options;

    try {
      // Set initial state
      await this.setState(state);

      // Execute function
      const result = await fn();

      // Set success state
      await this.setState(completeState);

      return result;
    } catch (error) {
      // Set error state
      try {
        await this.setState(errorState);
      } catch (stateError) {
        // Log but don't mask original error
        console.error('Failed to set error state:', stateError);
      }

      throw error;
    }
  }

  /**
   * Execute a multi-step workflow
   *
   * Executes a series of steps in order, with automatic state management
   * and error handling. Each step can access the context object which
   * includes results from previous steps.
   *
   * @param {Array<Object>} steps - Array of workflow steps
   * @param {Object} [options={}] - Workflow options
   * @param {boolean} [options.stopOnError=true] - Stop workflow on first error
   * @returns {Promise<Object>} Workflow result with all step results
   *
   * @example
   * const result = await agent.executeWorkflow([
   *   {
   *     name: 'fetch',
   *     hook: 'data:fetch',
   *     params: { url: '/api/data' }
   *   },
   *   {
   *     name: 'process',
   *     hook: 'data:process',
   *     params: (ctx) => ({ data: ctx.results.fetch })
   *   }
   * ]);
   */
  async executeWorkflow(steps, options = {}) {
    const {
      stopOnError = true
    } = options;

    const context = {
      results: {},
      errors: [],
      completed: []
    };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepName = step.name || `step_${i}`;

      try {
        // Set state for this step
        if (step.state) {
          await this.setState(step.state);
        }

        // Get params (can be function or object)
        const params = typeof step.params === 'function'
          ? step.params(context)
          : step.params || {};

        // Execute step
        const result = await this._dispatch(step.hook, params);

        if (result.error) {
          throw new Error(result.error);
        }

        // Store result
        context.results[stepName] = result;
        context.completed.push(stepName);

      } catch (error) {
        // Record error
        context.errors.push({
          step: stepName,
          error: error.message,
          index: i
        });

        if (stopOnError) {
          return {
            success: false,
            completed: context.completed,
            results: context.results,
            errors: context.errors,
            stoppedAt: stepName
          };
        }
      }
    }

    return {
      success: context.errors.length === 0,
      completed: context.completed,
      results: context.results,
      errors: context.errors
    };
  }

  /**
   * Get performance statistics
   *
   * Returns performance metrics if performance tracking is enabled.
   *
   * @returns {Object} Performance statistics
   *
   * @example
   * const stats = agent.getStats();
   * console.log('API calls:', stats.apiCalls);
   * console.log('Average time:', stats.averageTime);
   */
  getStats() {
    if (!this.options.trackPerformance) {
      return {
        error: 'Performance tracking not enabled',
        message: 'Enable with: new FixiPlugAgent(fixi, { trackPerformance: true })'
      };
    }

    return {
      apiCalls: this.stats.apiCalls,
      totalTime: this.stats.totalTime,
      averageTime: this.stats.apiCalls > 0
        ? (this.stats.totalTime / this.stats.apiCalls).toFixed(2)
        : 0,
      calls: this.stats.calls
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats() {
    this.stats = {
      apiCalls: 0,
      totalTime: 0,
      calls: []
    };
  }

  /**
   * Internal dispatch method with performance tracking
   *
   * @private
   * @param {string} hook - Hook name to dispatch
   * @param {Object} params - Parameters to pass
   * @returns {Promise<*>} Result from dispatch
   */
  async _dispatch(hook, params) {
    const startTime = this.options.trackPerformance ? performance.now() : 0;

    try {
      const result = await this.fixi.dispatch(hook, params);

      if (this.options.trackPerformance) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.stats.apiCalls++;
        this.stats.totalTime += duration;
        this.stats.calls.push({
          hook,
          duration: duration.toFixed(2),
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      if (this.options.trackPerformance) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.stats.apiCalls++;
        this.stats.totalTime += duration;
        this.stats.calls.push({
          hook,
          duration: duration.toFixed(2),
          error: error.message,
          timestamp: Date.now()
        });
      }

      throw error;
    }
  }
}

/**
 * Export default for convenience
 */
export default FixiPlugAgent;
