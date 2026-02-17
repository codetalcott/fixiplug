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
   * @param {number} [options.cacheTTL=300000] - Cache time-to-live in milliseconds (default: 5 minutes)
   * @param {boolean} [options.trackPerformance=false] - Track API call performance
   * @param {number} [options.defaultTimeout=5000] - Default timeout for state waiting (ms)
   * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [options.retryDelay=100] - Initial retry delay in milliseconds
   * @param {number} [options.retryBackoff=2] - Exponential backoff multiplier
   * @param {Array<string>} [options.retryableHooks=[]] - Hooks that should be retried on error
   * @param {'dynamic'|'static'|'none'} [options.skillStrategy='dynamic'] - Skill retrieval strategy for LLM adapters
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
    this.cacheExpiry = null;
    this.options = {
      enableCaching: options.enableCaching !== false,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes default
      trackPerformance: options.trackPerformance || false,
      defaultTimeout: options.defaultTimeout || 5000,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay || 100,
      retryBackoff: options.retryBackoff || 2,
      retryableHooks: options.retryableHooks || []
    };

    // Performance tracking
    this.stats = {
      apiCalls: 0,
      totalTime: 0,
      calls: [],
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Discover available capabilities from the fixiplug instance
   *
   * Queries the introspection API to understand what plugins, hooks,
   * and features are available. Results are cached by default with TTL.
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

    // Check if cache is valid
    const now = Date.now();
    const cacheValid = this.capabilities &&
                       this.cacheExpiry &&
                       now < this.cacheExpiry;

    // Return cached if available, valid, and not forcing refresh
    if (cacheValid && !refresh && this.options.enableCaching) {
      if (this.options.trackPerformance) {
        this.stats.cacheHits++;
      }
      return this.capabilities;
    }

    if (this.options.trackPerformance) {
      this.stats.cacheMisses++;
    }

    try {
      const result = await this._dispatch('api:introspect', {});

      if (result.error) {
        throw new Error(`Discovery failed: ${result.error}`);
      }

      // Store capabilities with expiry
      this.capabilities = {
        version: result.fixiplug?.version || 'unknown',
        features: result.fixiplug?.features || [],
        plugins: result.fixiplug?.capabilities?.plugins || [],
        hooks: result.fixiplug?.capabilities?.hooks || {},
        methods: result.fixiplug?.capabilities?.methods || [],
        timestamp: Date.now()
      };

      // Set cache expiry
      this.cacheExpiry = Date.now() + this.options.cacheTTL;

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
      const errorMsg = typeof result.error === 'string' ? result.error : String(result.error);
      if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        throw new Error(`Timeout waiting for state "${state}" after ${timeout}ms`);
      }
      throw new Error(`Failed to wait for state: ${errorMsg}`);
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
    if (!Array.isArray(steps)) {
      throw new Error('executeWorkflow() requires an array of steps');
    }

    if (steps.length === 0) {
      return { success: true, completed: [], results: {}, errors: [] };
    }

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
        : '0.00',
      retries: this.stats.retries,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
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
      calls: [],
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Invalidate cached capabilities
   *
   * Forces the next discover() call to fetch fresh data
   *
   * @example
   * agent.invalidateCache();
   * const freshCaps = await agent.discover();
   */
  invalidateCache() {
    this.capabilities = null;
    this.cacheExpiry = null;
  }

  /**
   * Warm the cache by performing an initial discovery
   *
   * Useful for reducing latency on first capability check
   *
   * @returns {Promise<Object>} Capabilities object
   *
   * @example
   * await agent.warmCache();
   * // Now subsequent discover() calls will be instant
   */
  async warmCache() {
    return await this.discover({ refresh: true });
  }

  /**
   * Get cache information
   *
   * @returns {Object} Cache status and metadata
   *
   * @example
   * const cacheInfo = agent.getCacheInfo();
   * console.log('Cache valid:', cacheInfo.valid);
   * console.log('Time until expiry:', cacheInfo.ttl);
   */
  getCacheInfo() {
    const now = Date.now();
    const valid = this.capabilities &&
                  this.cacheExpiry &&
                  now < this.cacheExpiry;

    return {
      enabled: this.options.enableCaching,
      valid: valid,
      hasData: !!this.capabilities,
      timestamp: this.capabilities?.timestamp || null,
      expiresAt: this.cacheExpiry,
      ttl: valid ? this.cacheExpiry - now : 0,
      maxTTL: this.options.cacheTTL
    };
  }

  /**
   * Internal dispatch method with performance tracking and retry logic
   *
   * @private
   * @param {string} hook - Hook name to dispatch
   * @param {Object} params - Parameters to pass
   * @param {Object} [options={}] - Dispatch options
   * @param {boolean} [options.retry=true] - Enable retry logic
   * @returns {Promise<*>} Result from dispatch
   */
  async _dispatch(hook, params, options = {}) {
    const { retry = true } = options;
    const _now = typeof performance !== 'undefined' && performance.now
      ? () => performance.now()
      : () => Date.now();
    const startTime = this.options.trackPerformance ? _now() : 0;

    // Determine if this hook should be retried
    const shouldRetry = retry && (
      this.options.retryableHooks.length === 0 ||
      this.options.retryableHooks.includes(hook)
    );

    let lastError;
    let attempt = 0;
    const maxAttempts = shouldRetry ? this.options.maxRetries + 1 : 1;

    while (attempt < maxAttempts) {
      try {
        const result = await this.fixi.dispatch(hook, params);

        if (this.options.trackPerformance) {
          const endTime = _now();
          const duration = endTime - startTime;

          this.stats.apiCalls++;
          this.stats.totalTime += duration;
          this.stats.calls.push({
            hook,
            duration: duration.toFixed(2),
            timestamp: Date.now(),
            attempts: attempt + 1
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < maxAttempts) {
          // Calculate exponential backoff delay
          const delay = this.options.retryDelay * Math.pow(this.options.retryBackoff, attempt - 1);

          if (this.options.trackPerformance) {
            this.stats.retries++;
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    if (this.options.trackPerformance) {
      const endTime = _now();
      const duration = endTime - startTime;

      this.stats.apiCalls++;
      this.stats.totalTime += duration;
      this.stats.calls.push({
        hook,
        duration: duration.toFixed(2),
        error: lastError.message,
        timestamp: Date.now(),
        attempts: attempt,
        retriesExhausted: attempt > 1
      });
    }

    throw lastError;
  }
}

/**
 * Export default for convenience
 */
export default FixiPlugAgent;
