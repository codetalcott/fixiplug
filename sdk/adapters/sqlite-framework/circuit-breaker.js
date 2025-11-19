/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by opening circuit after threshold failures.
 * Implements three states: CLOSED, OPEN, and HALF_OPEN.
 *
 * @module sdk/adapters/sqlite-framework/circuit-breaker
 */

import { CircuitBreakerError } from './errors.js';

/**
 * Circuit breaker states
 * @enum {string}
 */
export const CircuitState = {
  CLOSED: 'closed',       // Normal operation
  OPEN: 'open',           // Circuit is open, rejecting requests
  HALF_OPEN: 'half_open'  // Testing if service has recovered
};

/**
 * Circuit Breaker implementation
 *
 * @class CircuitBreaker
 *
 * @example
 * const breaker = new CircuitBreaker({
 *   threshold: 5,
 *   timeout: 60000,
 *   halfOpenRequests: 3
 * });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await apiCall();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerError) {
 *     // Circuit is open
 *   }
 * }
 */
export class CircuitBreaker {
  /**
   * Create a circuit breaker
   *
   * @param {Object} config - Configuration
   * @param {number} [config.threshold=5] - Failure threshold before opening
   * @param {number} [config.timeout=60000] - Time before attempting reset (ms)
   * @param {number} [config.halfOpenRequests=3] - Requests to test in half-open state
   * @param {Function} [config.onStateChange] - Callback for state changes
   * @param {Function} [config.onSuccess] - Callback for successful requests
   * @param {Function} [config.onFailure] - Callback for failed requests
   */
  constructor(config = {}) {
    this.threshold = config.threshold || 5;
    this.timeout = config.timeout || 60000;
    this.halfOpenRequests = config.halfOpenRequests || 3;
    this.onStateChange = config.onStateChange || null;
    this.onSuccess = config.onSuccess || null;
    this.onFailure = config.onFailure || null;

    // Internal state
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.halfOpenAttempts = 0;

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRejections: 0,
      stateChanges: [],
      lastFailure: null,
      lastSuccess: null
    };
  }

  /**
   * Get current state
   * @returns {string} Current circuit state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if circuit is open
   * @returns {boolean} True if circuit is open
   */
  isOpen() {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   * @returns {boolean} True if circuit is closed
   */
  isClosed() {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   * @returns {boolean} True if circuit is half-open
   */
  isHalfOpen() {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Change circuit state
   *
   * @param {string} newState - New state
   * @private
   */
  _changeState(newState) {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;

    // Record state change
    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: Date.now(),
      failureCount: this.failureCount,
      successCount: this.successCount
    });

    // Reset counters based on new state
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.timeout;
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }

    // Invoke callback if provided
    if (this.onStateChange) {
      try {
        this.onStateChange(oldState, newState, {
          failureCount: this.failureCount,
          successCount: this.successCount
        });
      } catch (error) {
        console.error('onStateChange callback error:', error);
      }
    }
  }

  /**
   * Record a successful request
   * @private
   */
  _recordSuccess() {
    this.stats.totalSuccesses++;
    this.stats.lastSuccess = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.halfOpenAttempts++;

      // If enough successes, close the circuit
      if (this.successCount >= this.halfOpenRequests) {
        this._changeState(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }

    // Invoke callback
    if (this.onSuccess) {
      try {
        this.onSuccess(this.state);
      } catch (error) {
        console.error('onSuccess callback error:', error);
      }
    }
  }

  /**
   * Record a failed request
   * @private
   */
  _recordFailure(error) {
    this.stats.totalFailures++;
    this.stats.lastFailure = {
      timestamp: Date.now(),
      error: error.message
    };

    if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open reopens the circuit
      this._changeState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;

      // Open circuit if threshold reached
      if (this.failureCount >= this.threshold) {
        this._changeState(CircuitState.OPEN);
      }
    }

    // Invoke callback
    if (this.onFailure) {
      try {
        this.onFailure(error, this.state);
      } catch (callbackError) {
        console.error('onFailure callback error:', callbackError);
      }
    }
  }

  /**
   * Attempt to transition from OPEN to HALF_OPEN
   * @returns {boolean} True if transition occurred
   * @private
   */
  _attemptReset() {
    if (this.state !== CircuitState.OPEN) {
      return false;
    }

    const now = Date.now();

    if (now >= this.nextAttempt) {
      this._changeState(CircuitState.HALF_OPEN);
      return true;
    }

    return false;
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} Result of function execution
   * @throws {CircuitBreakerError} If circuit is open
   * @throws {Error} If function throws
   *
   * @example
   * const result = await breaker.execute(async () => {
   *   return await apiCall();
   * });
   */
  async execute(fn) {
    this.stats.totalRequests++;

    // Check if we should attempt reset
    if (this.state === CircuitState.OPEN) {
      this._attemptReset();
    }

    // Reject if still open
    if (this.state === CircuitState.OPEN) {
      this.stats.totalRejections++;
      throw new CircuitBreakerError(this.nextAttempt);
    }

    // Attempt execution
    try {
      const result = await fn();
      this._recordSuccess();
      return result;
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      timeUntilReset: Math.max(0, this.nextAttempt - Date.now())
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() {
    this._changeState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * Manually force circuit to open
   */
  forceOpen() {
    this._changeState(CircuitState.OPEN);
  }

  /**
   * Manually force circuit to close
   */
  forceClose() {
    this._changeState(CircuitState.CLOSED);
  }
}

/**
 * Create a circuit breaker wrapper for a function
 *
 * @param {Function} fn - Function to wrap
 * @param {Object} config - Circuit breaker configuration
 * @returns {Function} Wrapped function with circuit breaker protection
 *
 * @example
 * const protectedApiCall = withCircuitBreaker(
 *   async (url) => await fetch(url),
 *   { threshold: 5, timeout: 60000 }
 * );
 *
 * const result = await protectedApiCall('https://api.example.com/data');
 */
export function withCircuitBreaker(fn, config) {
  const breaker = new CircuitBreaker(config);

  return async function(...args) {
    return breaker.execute(() => fn(...args));
  };
}

/**
 * Combined circuit breaker manager for multiple endpoints
 *
 * @class CircuitBreakerManager
 *
 * @example
 * const manager = new CircuitBreakerManager({
 *   threshold: 5,
 *   timeout: 60000
 * });
 *
 * const result = await manager.execute('endpoint1', async () => {
 *   return await apiCall();
 * });
 */
export class CircuitBreakerManager {
  /**
   * Create a circuit breaker manager
   * @param {Object} defaultConfig - Default configuration for breakers
   */
  constructor(defaultConfig = {}) {
    this.defaultConfig = defaultConfig;
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker for an endpoint
   *
   * @param {string} name - Endpoint name
   * @param {Object} [config] - Optional override configuration
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(name, config = null) {
    if (!this.breakers.has(name)) {
      const breakerConfig = config || this.defaultConfig;
      this.breakers.set(name, new CircuitBreaker(breakerConfig));
    }
    return this.breakers.get(name);
  }

  /**
   * Execute function with circuit breaker protection
   *
   * @param {string} name - Endpoint name
   * @param {Function} fn - Function to execute
   * @param {Object} [config] - Optional circuit breaker config
   * @returns {Promise<*>} Result of function execution
   */
  async execute(name, fn, config = null) {
    const breaker = this.getBreaker(name, config);
    return breaker.execute(fn);
  }

  /**
   * Get statistics for an endpoint
   *
   * @param {string} name - Endpoint name
   * @returns {Object|null} Statistics or null if not found
   */
  getStats(name) {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.getStats() : null;
  }

  /**
   * Get statistics for all endpoints
   * @returns {Object} Map of endpoint names to statistics
   */
  getAllStats() {
    const stats = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset a specific circuit breaker
   * @param {string} name - Endpoint name
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a circuit breaker
   * @param {string} name - Endpoint name
   */
  remove(name) {
    this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear() {
    this.breakers.clear();
  }

  /**
   * Get list of endpoint names
   * @returns {string[]} Array of endpoint names
   */
  getEndpoints() {
    return Array.from(this.breakers.keys());
  }
}
