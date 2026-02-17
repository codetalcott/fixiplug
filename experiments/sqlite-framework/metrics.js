/**
 * Metrics Collector for SQLite Framework Bridge
 *
 * Tracks performance metrics with Prometheus export support.
 * Collects latency percentiles, throughput, error rates.
 *
 * @module sdk/adapters/sqlite-framework/metrics
 */

/**
 * Histogram for tracking value distributions
 *
 * @class Histogram
 * @private
 */
class Histogram {
  constructor(buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
    this.buckets = buckets.sort((a, b) => a - b);
    this.counts = new Array(buckets.length + 1).fill(0);
    this.sum = 0;
    this.count = 0;
    this.values = [];
    this.maxSamples = 10000;
  }

  /**
   * Observe a value
   * @param {number} value - Value to observe
   */
  observe(value) {
    this.sum += value;
    this.count++;

    // Store value for percentile calculation
    this.values.push(value);
    if (this.values.length > this.maxSamples) {
      this.values.shift();
    }

    // Update bucket counts
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        this.counts[i]++;
        return;
      }
    }
    this.counts[this.buckets.length]++;
  }

  /**
   * Calculate percentile
   * @param {number} p - Percentile (0-1)
   * @returns {number} Percentile value
   */
  percentile(p) {
    if (this.values.length === 0) return 0;

    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get average
   * @returns {number} Average value
   */
  get avg() {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /**
   * Get min value
   * @returns {number} Minimum value
   */
  get min() {
    return this.values.length > 0 ? Math.min(...this.values) : 0;
  }

  /**
   * Get max value
   * @returns {number} Maximum value
   */
  get max() {
    return this.values.length > 0 ? Math.max(...this.values) : 0;
  }

  /**
   * Export to Prometheus format
   * @param {string} name - Metric name
   * @param {Object} labels - Labels
   * @returns {string} Prometheus format
   */
  toPrometheus(name, labels = {}) {
    const labelStr = this._formatLabels(labels);
    let output = '';

    // Histogram buckets
    for (let i = 0; i < this.buckets.length; i++) {
      output += `${name}_bucket{${labelStr},le="${this.buckets[i]}"} ${this.counts[i]}\n`;
    }
    output += `${name}_bucket{${labelStr},le="+Inf"} ${this.counts[this.buckets.length]}\n`;

    // Sum and count
    output += `${name}_sum{${labelStr}} ${this.sum}\n`;
    output += `${name}_count{${labelStr}} ${this.count}\n`;

    return output;
  }

  /**
   * Format labels for Prometheus
   * @param {Object} labels - Labels object
   * @returns {string} Formatted labels
   * @private
   */
  _formatLabels(labels) {
    return Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

/**
 * Counter for tracking incrementing values
 *
 * @class Counter
 * @private
 */
class Counter {
  constructor() {
    this.value = 0;
  }

  /**
   * Increment counter
   * @param {number} amount - Amount to increment (default: 1)
   */
  inc(amount = 1) {
    this.value += amount;
  }

  /**
   * Get current value
   * @returns {number} Counter value
   */
  get() {
    return this.value;
  }

  /**
   * Reset counter
   */
  reset() {
    this.value = 0;
  }

  /**
   * Export to Prometheus format
   * @param {string} name - Metric name
   * @param {Object} labels - Labels
   * @returns {string} Prometheus format
   */
  toPrometheus(name, labels = {}) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}} ${this.value}\n`;
  }
}

/**
 * Gauge for tracking current values
 *
 * @class Gauge
 * @private
 */
class Gauge {
  constructor() {
    this.value = 0;
  }

  /**
   * Set gauge value
   * @param {number} value - Value to set
   */
  set(value) {
    this.value = value;
  }

  /**
   * Increment gauge
   * @param {number} amount - Amount to increment (default: 1)
   */
  inc(amount = 1) {
    this.value += amount;
  }

  /**
   * Decrement gauge
   * @param {number} amount - Amount to decrement (default: 1)
   */
  dec(amount = 1) {
    this.value -= amount;
  }

  /**
   * Get current value
   * @returns {number} Gauge value
   */
  get() {
    return this.value;
  }

  /**
   * Export to Prometheus format
   * @param {string} name - Metric name
   * @param {Object} labels - Labels
   * @returns {string} Prometheus format
   */
  toPrometheus(name, labels = {}) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}} ${this.value}\n`;
  }
}

/**
 * Metrics Collector
 *
 * @class MetricsCollector
 *
 * @example
 * const metrics = new MetricsCollector();
 *
 * // Record a request
 * const timer = metrics.startTimer('method.name');
 * try {
 *   await doWork();
 *   timer.success();
 * } catch (error) {
 *   timer.failure();
 * }
 *
 * // Get statistics
 * const stats = metrics.getStats();
 *
 * // Export to Prometheus
 * const prometheus = metrics.toPrometheus();
 */
export class MetricsCollector {
  /**
   * Create a metrics collector
   * @param {Object} [options={}] - Collector options
   * @param {boolean} [options.enabled=true] - Enable metrics collection
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;

    if (!this.enabled) {
      return;
    }

    // Counters
    this.totalRequests = new Counter();
    this.totalSuccesses = new Counter();
    this.totalFailures = new Counter();
    this.cacheHits = new Counter();
    this.cacheMisses = new Counter();

    // Histograms
    this.latency = new Histogram();
    this.requestsByMethod = new Map();

    // Gauges
    this.activeRequests = new Gauge();

    // Start time
    this.startTime = Date.now();
  }

  /**
   * Start a timer for a request
   *
   * @param {string} method - Method name
   * @returns {Object} Timer object with success() and failure() methods
   *
   * @example
   * const timer = metrics.startTimer('getRecommendations');
   * try {
   *   await execute();
   *   timer.success();
   * } catch (error) {
   *   timer.failure();
   * }
   */
  startTimer(method) {
    if (!this.enabled) {
      return { success: () => {}, failure: () => {} };
    }

    const startTime = Date.now();
    this.totalRequests.inc();
    this.activeRequests.inc();

    return {
      success: () => {
        const duration = Date.now() - startTime;
        this.totalSuccesses.inc();
        this.activeRequests.dec();
        this.latency.observe(duration);
        this._recordMethodMetric(method, duration, true);
      },

      failure: () => {
        const duration = Date.now() - startTime;
        this.totalFailures.inc();
        this.activeRequests.dec();
        this.latency.observe(duration);
        this._recordMethodMetric(method, duration, false);
      }
    };
  }

  /**
   * Record method-specific metrics
   * @param {string} method - Method name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether request succeeded
   * @private
   */
  _recordMethodMetric(method, duration, success) {
    if (!this.requestsByMethod.has(method)) {
      this.requestsByMethod.set(method, {
        latency: new Histogram(),
        requests: new Counter(),
        successes: new Counter(),
        failures: new Counter()
      });
    }

    const methodMetrics = this.requestsByMethod.get(method);
    methodMetrics.latency.observe(duration);
    methodMetrics.requests.inc();

    if (success) {
      methodMetrics.successes.inc();
    } else {
      methodMetrics.failures.inc();
    }
  }

  /**
   * Record cache hit
   * @param {string} level - Cache level ('l1' or 'l2')
   */
  recordCacheHit(level) {
    if (!this.enabled) return;
    this.cacheHits.inc();
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    if (!this.enabled) return;
    this.cacheMisses.inc();
  }

  /**
   * Get statistics
   *
   * @returns {Object} Statistics object
   *
   * @example
   * const stats = metrics.getStats();
   * console.log(`Success rate: ${stats.successRate}%`);
   * console.log(`P95 latency: ${stats.latency.p95}ms`);
   */
  getStats() {
    if (!this.enabled) {
      return null;
    }

    const totalRequests = this.totalRequests.get();
    const totalSuccesses = this.totalSuccesses.get();
    const totalFailures = this.totalFailures.get();
    const totalCacheAccess = this.cacheHits.get() + this.cacheMisses.get();

    return {
      totalRequests,
      totalSuccesses,
      totalFailures,
      successRate: totalRequests > 0
        ? (totalSuccesses / totalRequests) * 100
        : 0,
      failureRate: totalRequests > 0
        ? (totalFailures / totalRequests) * 100
        : 0,
      activeRequests: this.activeRequests.get(),
      latency: {
        avg: this.latency.avg,
        min: this.latency.min,
        max: this.latency.max,
        p50: this.latency.percentile(0.5),
        p95: this.latency.percentile(0.95),
        p99: this.latency.percentile(0.99)
      },
      cache: {
        hits: this.cacheHits.get(),
        misses: this.cacheMisses.get(),
        hitRate: totalCacheAccess > 0
          ? (this.cacheHits.get() / totalCacheAccess) * 100
          : 0
      },
      uptime: Date.now() - this.startTime,
      methodStats: this._getMethodStats()
    };
  }

  /**
   * Get per-method statistics
   * @returns {Object} Method statistics
   * @private
   */
  _getMethodStats() {
    const stats = {};

    for (const [method, metrics] of this.requestsByMethod.entries()) {
      const requests = metrics.requests.get();
      const successes = metrics.successes.get();

      stats[method] = {
        requests,
        successes,
        failures: metrics.failures.get(),
        successRate: requests > 0 ? (successes / requests) * 100 : 0,
        latency: {
          avg: metrics.latency.avg,
          p50: metrics.latency.percentile(0.5),
          p95: metrics.latency.percentile(0.95),
          p99: metrics.latency.percentile(0.99)
        }
      };
    }

    return stats;
  }

  /**
   * Export metrics in Prometheus format
   *
   * @returns {string} Prometheus metrics
   *
   * @example
   * const prometheus = metrics.toPrometheus();
   * console.log(prometheus);
   */
  toPrometheus() {
    if (!this.enabled) {
      return '';
    }

    let output = '';

    // Total requests
    output += '# HELP sqlite_bridge_requests_total Total number of requests\n';
    output += '# TYPE sqlite_bridge_requests_total counter\n';
    output += this.totalRequests.toPrometheus('sqlite_bridge_requests_total');
    output += '\n';

    // Successes
    output += '# HELP sqlite_bridge_successes_total Total number of successful requests\n';
    output += '# TYPE sqlite_bridge_successes_total counter\n';
    output += this.totalSuccesses.toPrometheus('sqlite_bridge_successes_total');
    output += '\n';

    // Failures
    output += '# HELP sqlite_bridge_failures_total Total number of failed requests\n';
    output += '# TYPE sqlite_bridge_failures_total counter\n';
    output += this.totalFailures.toPrometheus('sqlite_bridge_failures_total');
    output += '\n';

    // Active requests
    output += '# HELP sqlite_bridge_active_requests Number of active requests\n';
    output += '# TYPE sqlite_bridge_active_requests gauge\n';
    output += this.activeRequests.toPrometheus('sqlite_bridge_active_requests');
    output += '\n';

    // Latency histogram
    output += '# HELP sqlite_bridge_latency_milliseconds Request latency in milliseconds\n';
    output += '# TYPE sqlite_bridge_latency_milliseconds histogram\n';
    output += this.latency.toPrometheus('sqlite_bridge_latency_milliseconds');
    output += '\n';

    // Cache metrics
    output += '# HELP sqlite_bridge_cache_hits_total Total number of cache hits\n';
    output += '# TYPE sqlite_bridge_cache_hits_total counter\n';
    output += this.cacheHits.toPrometheus('sqlite_bridge_cache_hits_total');
    output += '\n';

    output += '# HELP sqlite_bridge_cache_misses_total Total number of cache misses\n';
    output += '# TYPE sqlite_bridge_cache_misses_total counter\n';
    output += this.cacheMisses.toPrometheus('sqlite_bridge_cache_misses_total');
    output += '\n';

    // Per-method metrics
    for (const [method, metrics] of this.requestsByMethod.entries()) {
      const methodLabel = { method };

      output += `# Per-method metrics for: ${method}\n`;
      output += metrics.requests.toPrometheus('sqlite_bridge_method_requests_total', methodLabel);
      output += metrics.successes.toPrometheus('sqlite_bridge_method_successes_total', methodLabel);
      output += metrics.failures.toPrometheus('sqlite_bridge_method_failures_total', methodLabel);
      output += metrics.latency.toPrometheus('sqlite_bridge_method_latency_milliseconds', methodLabel);
      output += '\n';
    }

    // Uptime
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    output += '# HELP sqlite_bridge_uptime_seconds Bridge uptime in seconds\n';
    output += '# TYPE sqlite_bridge_uptime_seconds counter\n';
    output += `sqlite_bridge_uptime_seconds ${uptimeSeconds}\n`;

    return output;
  }

  /**
   * Reset all metrics
   */
  reset() {
    if (!this.enabled) return;

    this.totalRequests = new Counter();
    this.totalSuccesses = new Counter();
    this.totalFailures = new Counter();
    this.cacheHits = new Counter();
    this.cacheMisses = new Counter();
    this.latency = new Histogram();
    this.requestsByMethod = new Map();
    this.activeRequests = new Gauge();
    this.startTime = Date.now();
  }
}

/**
 * Create a metrics collector instance
 *
 * @param {Object} [options] - Collector options
 * @returns {MetricsCollector} Metrics collector instance
 *
 * @example
 * const metrics = createMetricsCollector({ enabled: true });
 */
export function createMetricsCollector(options) {
  return new MetricsCollector(options);
}
