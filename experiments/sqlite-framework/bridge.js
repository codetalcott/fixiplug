/**
 * SQLite Framework Bridge
 *
 * Main entry point for communicating with the SQLite Extensions Framework.
 * Integrates process pool, retry logic, circuit breaker, and caching.
 *
 * @module sdk/adapters/sqlite-framework/bridge
 */

import { EventEmitter } from 'node:events';
import { createConfig } from './config.js';
import { ProcessPool } from './process-pool.js';
import { CircuitBreakerManager } from './circuit-breaker.js';
import { Retry } from './retry.js';
import { isRecoverableError } from './errors.js';

/**
 * SQLite Framework Bridge
 *
 * Provides high-level API for calling Python framework methods
 * with built-in resilience, performance optimization, and observability.
 *
 * @class SQLiteFrameworkBridge
 * @extends EventEmitter
 *
 * @example
 * const bridge = new SQLiteFrameworkBridge({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 *
 * await bridge.start();
 *
 * const result = await bridge.call(
 *   'src.generator.llm_agent_interface.analyze_requirements',
 *   { description: 'Portfolio risk analysis' }
 * );
 *
 * await bridge.shutdown();
 */
export class SQLiteFrameworkBridge extends EventEmitter {
  /**
   * Create a bridge instance
   *
   * @param {Object} userConfig - User configuration
   * @throws {ValidationError} If configuration is invalid
   */
  constructor(userConfig) {
    super();

    // Validate and create configuration
    this.config = createConfig(userConfig);

    // Initialize components
    this.processPool = null;
    this.circuitBreakers = null;
    this.started = false;

    // Statistics
    this.stats = {
      startTime: null,
      totalCalls: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRetries: 0,
      totalCircuitBreakerRejections: 0,
      averageLatency: 0,
      latencySum: 0
    };

    // Performance tracking
    this.callTimes = [];
    this.maxCallTimeSamples = 1000;
  }

  /**
   * Start the bridge
   *
   * Initializes process pool and prepares for requests
   *
   * @returns {Promise<void>}
   * @throws {Error} If bridge is already started or startup fails
   *
   * @example
   * await bridge.start();
   */
  async start() {
    if (this.started) {
      throw new Error('Bridge already started');
    }

    this.stats.startTime = Date.now();

    // Initialize process pool
    this.processPool = new ProcessPool(this.config);

    // Setup process pool event handlers
    this._setupProcessPoolEvents();

    // Initialize circuit breaker manager
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreakers = new CircuitBreakerManager({
        threshold: this.config.circuitBreakerThreshold,
        timeout: this.config.circuitBreakerTimeout,
        halfOpenRequests: this.config.circuitBreakerHalfOpenRequests,
        onStateChange: (from, to, info) => {
          this.emit('circuit-breaker-state-change', { from, to, info });
        }
      });
    }

    // Start process pool
    await this.processPool.start();

    this.started = true;
    this.emit('started');

    if (this.config.debug) {
      console.log('[Bridge] Started successfully');
    }
  }

  /**
   * Setup event handlers for process pool
   * @private
   */
  _setupProcessPoolEvents() {
    this.processPool.on('process-started', (info) => {
      if (this.config.verbose) {
        console.log(`[Bridge] Process ${info.id} started`);
      }
      this.emit('process-started', info);
    });

    this.processPool.on('process-exited', (info) => {
      if (this.config.verbose) {
        console.log(`[Bridge] Process ${info.id} exited`);
      }
      this.emit('process-exited', info);
    });

    this.processPool.on('process-error', (info) => {
      console.error(`[Bridge] Process ${info.id} error:`, info.error);
      this.emit('process-error', info);
    });

    this.processPool.on('process-restarted', () => {
      if (this.config.verbose) {
        console.log('[Bridge] Process restarted');
      }
      this.emit('process-restarted');
    });

    this.processPool.on('process-restart-failed', (info) => {
      console.error('[Bridge] Process restart failed:', info.error);
      this.emit('process-restart-failed', info);
    });
  }

  /**
   * Call a Python framework method
   *
   * @param {string} method - Full method path (e.g., 'module.Class.method')
   * @param {Object} [params={}] - Method parameters
   * @param {Object} [options={}] - Call options
   * @param {number} [options.timeout] - Override request timeout
   * @param {boolean} [options.retry=true] - Enable retry logic
   * @param {number} [options.maxRetries] - Override max retry attempts
   * @param {string} [options.cacheKey] - Cache key for result
   * @returns {Promise<*>} Method result
   * @throws {Error} If call fails after retries
   *
   * @example
   * const result = await bridge.call(
   *   'src.generator.llm_agent_interface.analyze_requirements',
   *   { description: 'Portfolio risk analysis', domain: 'finance' },
   *   { timeout: 60000, retry: true }
   * );
   */
  async call(method, params = {}, options = {}) {
    if (!this.started) {
      throw new Error('Bridge not started');
    }

    this.stats.totalCalls++;
    const startTime = Date.now();

    try {
      // Execute with resilience patterns
      const result = await this._executeWithResilience(method, params, options);

      // Record success
      this._recordSuccess(startTime);

      return result;

    } catch (error) {
      // Record failure
      this._recordFailure(startTime);

      throw error;
    }
  }

  /**
   * Execute method with resilience patterns (retry + circuit breaker)
   * @param {string} method - Method name
   * @param {Object} params - Parameters
   * @param {Object} options - Options
   * @returns {Promise<*>} Result
   * @private
   */
  async _executeWithResilience(method, params, options) {
    // Determine if retry is enabled
    const retryEnabled = options.retry !== false && this.config.retryAttempts > 0;

    // Base executor function
    const executor = async () => {
      // Use circuit breaker if enabled
      if (this.config.circuitBreakerEnabled) {
        try {
          return await this.circuitBreakers.execute(
            method,
            () => this._executeOnPool(method, params, options)
          );
        } catch (error) {
          if (error.name === 'CircuitBreakerError') {
            this.stats.totalCircuitBreakerRejections++;
          }
          throw error;
        }
      } else {
        return await this._executeOnPool(method, params, options);
      }
    };

    // Execute with or without retry
    if (retryEnabled) {
      const maxAttempts = options.maxRetries || this.config.retryAttempts;

      return await new Retry()
        .withMaxAttempts(maxAttempts)
        .withExponentialBackoff(
          this.config.retryInitialDelay,
          this.config.retryMaxDelay
        )
        .when(isRecoverableError)
        .onRetry((error, attempt, delay) => {
          this.stats.totalRetries++;

          if (this.config.verbose) {
            console.log(
              `[Bridge] Retry ${attempt}/${maxAttempts} for ${method} after ${delay}ms (${error.message})`
            );
          }

          this.emit('retry', {
            method,
            attempt,
            maxAttempts,
            delay,
            error: error.message
          });
        })
        .execute(executor);
    } else {
      return await executor();
    }
  }

  /**
   * Execute on process pool
   * @param {string} method - Method name
   * @param {Object} params - Parameters
   * @param {Object} options - Options
   * @returns {Promise<*>} Result
   * @private
   */
  async _executeOnPool(method, params, options) {
    const timeout = options.timeout || this.config.requestTimeout;

    return await this.processPool.execute(method, params, { timeout });
  }

  /**
   * Record successful call
   * @param {number} startTime - Call start time
   * @private
   */
  _recordSuccess(startTime) {
    const duration = Date.now() - startTime;

    this.stats.totalSuccesses++;
    this.stats.latencySum += duration;
    this.stats.averageLatency = this.stats.latencySum / this.stats.totalSuccesses;

    // Track call times (for percentile calculation)
    this.callTimes.push(duration);
    if (this.callTimes.length > this.maxCallTimeSamples) {
      this.callTimes.shift();
    }

    if (this.config.debug) {
      console.log(`[Bridge] Call succeeded in ${duration}ms`);
    }
  }

  /**
   * Record failed call
   * @param {number} startTime - Call start time
   * @private
   */
  _recordFailure(startTime) {
    const duration = Date.now() - startTime;

    this.stats.totalFailures++;

    if (this.config.debug) {
      console.error(`[Bridge] Call failed after ${duration}ms`);
    }
  }

  /**
   * Get bridge statistics
   *
   * @returns {Object} Statistics object
   *
   * @example
   * const stats = bridge.getStats();
   * console.log(`Success rate: ${stats.successRate}%`);
   */
  getStats() {
    const poolStats = this.processPool ? this.processPool.getStats() : null;
    const circuitBreakerStats = this.circuitBreakers
      ? this.circuitBreakers.getAllStats()
      : null;

    // Calculate percentiles
    const sortedTimes = [...this.callTimes].sort((a, b) => a - b);
    const percentile = (p) => {
      if (sortedTimes.length === 0) return 0;
      const index = Math.ceil(sortedTimes.length * p) - 1;
      return sortedTimes[Math.max(0, index)];
    };

    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      successRate: this.stats.totalCalls > 0
        ? (this.stats.totalSuccesses / this.stats.totalCalls) * 100
        : 0,
      failureRate: this.stats.totalCalls > 0
        ? (this.stats.totalFailures / this.stats.totalCalls) * 100
        : 0,
      latency: {
        avg: this.stats.averageLatency,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99)
      },
      processPool: poolStats,
      circuitBreakers: circuitBreakerStats
    };
  }

  /**
   * Get metrics in Prometheus format
   *
   * @returns {string} Prometheus metrics
   *
   * @example
   * const metrics = bridge.getMetrics();
   * console.log(metrics);
   */
  getMetrics() {
    const stats = this.getStats();

    return `
# HELP sqlite_bridge_calls_total Total number of bridge calls
# TYPE sqlite_bridge_calls_total counter
sqlite_bridge_calls_total ${stats.totalCalls}

# HELP sqlite_bridge_successes_total Total number of successful calls
# TYPE sqlite_bridge_successes_total counter
sqlite_bridge_successes_total ${stats.totalSuccesses}

# HELP sqlite_bridge_failures_total Total number of failed calls
# TYPE sqlite_bridge_failures_total counter
sqlite_bridge_failures_total ${stats.totalFailures}

# HELP sqlite_bridge_retries_total Total number of retries
# TYPE sqlite_bridge_retries_total counter
sqlite_bridge_retries_total ${stats.totalRetries}

# HELP sqlite_bridge_circuit_breaker_rejections_total Total number of circuit breaker rejections
# TYPE sqlite_bridge_circuit_breaker_rejections_total counter
sqlite_bridge_circuit_breaker_rejections_total ${stats.totalCircuitBreakerRejections}

# HELP sqlite_bridge_latency_milliseconds Request latency
# TYPE sqlite_bridge_latency_milliseconds summary
sqlite_bridge_latency_milliseconds{quantile="0.5"} ${stats.latency.p50}
sqlite_bridge_latency_milliseconds{quantile="0.95"} ${stats.latency.p95}
sqlite_bridge_latency_milliseconds{quantile="0.99"} ${stats.latency.p99}
sqlite_bridge_latency_milliseconds_sum ${stats.latencySum}
sqlite_bridge_latency_milliseconds_count ${stats.totalSuccesses}

# HELP sqlite_bridge_success_rate Success rate percentage
# TYPE sqlite_bridge_success_rate gauge
sqlite_bridge_success_rate ${stats.successRate}

# HELP sqlite_bridge_uptime_seconds Bridge uptime in seconds
# TYPE sqlite_bridge_uptime_seconds counter
sqlite_bridge_uptime_seconds ${stats.uptime / 1000}
    `.trim();
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      startTime: Date.now(),
      totalCalls: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRetries: 0,
      totalCircuitBreakerRejections: 0,
      averageLatency: 0,
      latencySum: 0
    };

    this.callTimes = [];
  }

  /**
   * Check if bridge is healthy
   *
   * @returns {boolean} True if healthy
   *
   * @example
   * if (!bridge.isHealthy()) {
   *   console.error('Bridge is unhealthy');
   * }
   */
  isHealthy() {
    if (!this.started) {
      return false;
    }

    const poolStats = this.processPool.getStats();

    // Check if we have at least one available process
    if (poolStats.availableProcesses === 0) {
      return false;
    }

    // Check success rate (must be > 50%)
    const stats = this.getStats();
    if (stats.totalCalls > 10 && stats.successRate < 50) {
      return false;
    }

    return true;
  }

  /**
   * Wait for bridge to be ready
   *
   * @param {number} [timeout=10000] - Timeout in milliseconds
   * @returns {Promise<void>}
   * @throws {TimeoutError} If not ready within timeout
   *
   * @example
   * await bridge.waitForReady();
   */
  async waitForReady(timeout = 10000) {
    const startTime = Date.now();

    while (!this.isHealthy()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Bridge not ready within timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Shutdown the bridge
   *
   * Gracefully shuts down all processes and cleans up resources
   *
   * @returns {Promise<void>}
   *
   * @example
   * await bridge.shutdown();
   */
  async shutdown() {
    if (!this.started) {
      return;
    }

    this.emit('shutting-down');

    if (this.config.debug) {
      console.log('[Bridge] Shutting down...');
    }

    // Shutdown process pool
    if (this.processPool) {
      await this.processPool.shutdown();
    }

    this.started = false;
    this.emit('shutdown');

    if (this.config.debug) {
      console.log('[Bridge] Shutdown complete');
    }
  }

  /**
   * Get configuration
   * @returns {Object} Current configuration (frozen)
   */
  getConfig() {
    return this.config;
  }
}

/**
 * Create and start a bridge instance
 *
 * Convenience function for creating and starting a bridge in one call
 *
 * @param {Object} config - Configuration
 * @returns {Promise<SQLiteFrameworkBridge>} Started bridge instance
 *
 * @example
 * const bridge = await createBridge({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 */
export async function createBridge(config) {
  const bridge = new SQLiteFrameworkBridge(config);
  await bridge.start();
  return bridge;
}
