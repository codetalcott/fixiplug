/**
 * SQLite Framework Service
 *
 * High-level service layer combining bridge, adapters, validation,
 * caching, metrics, and logging. Main entry point for plugins.
 *
 * @module sdk/adapters/sqlite-framework/service
 */

import { SQLiteFrameworkBridge } from './bridge.js';
import { RequestAdapter } from './request-adapter.js';
import { ResponseAdapter } from './response-adapter.js';
import { Validator, sanitizeParams } from './validation.js';
import { CacheManager } from './cache-manager.js';
import { MetricsCollector } from './metrics.js';
import { Logger, createRequestLogger } from './logger.js';

/**
 * SQLite Framework Service
 *
 * @class SQLiteFrameworkService
 *
 * @example
 * const service = new SQLiteFrameworkService({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 *
 * await service.start();
 *
 * const result = await service.getRecommendations({
 *   domain: 'finance',
 *   description: 'Portfolio risk analysis'
 * });
 *
 * await service.shutdown();
 */
export class SQLiteFrameworkService {
  /**
   * Create a service instance
   *
   * @param {Object} config - Service configuration
   */
  constructor(config) {
    this.config = config;

    // Initialize bridge
    this.bridge = new SQLiteFrameworkBridge(config);

    // Initialize adapters
    this.requestAdapter = new RequestAdapter({ strict: false });
    this.responseAdapter = new ResponseAdapter({ preserveMetadata: true });

    // Initialize validator
    this.validator = new Validator({ strict: false, coerce: true });

    // Initialize cache
    if (config.cacheEnabled !== false) {
      this.cache = new CacheManager({
        l1MaxItems: config.l1MaxItems || 1000,
        l1TTL: config.l1TTL || 60000,
        l2Directory: config.l2Directory,
        l2MaxSize: config.l2MaxSize || 100 * 1024 * 1024,
        l2TTL: config.l2TTL || 3600000
      });
    } else {
      this.cache = null;
    }

    // Initialize metrics
    if (config.enableMetrics !== false) {
      this.metrics = new MetricsCollector({ enabled: true });
    } else {
      this.metrics = null;
    }

    // Initialize logger
    this.logger = new Logger({
      level: config.logLevel || 'info',
      format: config.debug ? 'pretty' : 'json',
      enabled: true,
      component: 'service'
    });

    this.started = false;
  }

  /**
   * Start the service
   *
   * @returns {Promise<void>}
   *
   * @example
   * await service.start();
   */
  async start() {
    if (this.started) {
      return;
    }

    this.logger.info('Starting SQLite Framework Service');

    await this.bridge.start();

    this.started = true;
    this.logger.info('Service started successfully');
  }

  /**
   * Execute a method with full service layer features
   *
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @param {Object} [options={}] - Call options
   * @returns {Promise<Object>} Result
   * @private
   */
  async _execute(method, params, options = {}) {
    if (!this.started) {
      throw new Error('Service not started');
    }

    // Create request logger
    const reqLogger = createRequestLogger(this.logger, { method, params });

    // Start metrics timer
    const timer = this.metrics ? this.metrics.startTimer(method) : null;

    try {
      reqLogger.info('Request started');

      // 1. Sanitize input
      const sanitized = sanitizeParams(params);

      // 2. Validate input
      const validated = this.validator.validate(method, sanitized);

      // 3. Adapt request
      const adapted = this.requestAdapter.adapt(method, validated);

      // 4. Check cache
      const cacheKey = this.cache ?
        this.cache.generateKey(adapted.method, adapted.params) : null;

      if (this.cache && this.cache.shouldCache(method)) {
        const result = await this.cache.get(cacheKey, async () => {
          reqLogger.debug('Cache miss, executing request');

          if (this.metrics) {
            this.metrics.recordCacheMiss();
          }

          // 5. Execute via bridge
          const response = await this.bridge.call(
            adapted.method,
            adapted.params,
            options
          );

          // 6. Adapt response
          return this.responseAdapter.adapt(method, response);
        });

        if (this.metrics && result) {
          this.metrics.recordCacheHit('l1');
        }

        reqLogger.info('Request completed', { cached: true });

        if (timer) {
          timer.success();
        }

        return result;

      } else {
        // Execute without cache
        reqLogger.debug('Executing request (cache disabled)');

        const response = await this.bridge.call(
          adapted.method,
          adapted.params,
          options
        );

        const result = this.responseAdapter.adapt(method, response);

        reqLogger.info('Request completed', { cached: false });

        if (timer) {
          timer.success();
        }

        return result;
      }

    } catch (error) {
      reqLogger.error('Request failed', {
        error: error.message,
        code: error.code,
        recoverable: error.recoverable
      });

      if (timer) {
        timer.failure();
      }

      throw error;
    }
  }

  // Pattern Learning Methods

  /**
   * Get pattern recommendations
   *
   * @param {Object} params - Parameters
   * @param {string} [params.domain] - Pattern domain
   * @param {string} [params.description] - Description
   * @param {number} [params.minConfidence] - Minimum confidence
   * @param {number} [params.maxResults] - Maximum results
   * @returns {Promise<Object>} Recommendations
   *
   * @example
   * const result = await service.getRecommendations({
   *   domain: 'finance',
   *   description: 'Portfolio risk analysis'
   * });
   */
  async getRecommendations(params) {
    return this._execute('getRecommendations', params);
  }

  /**
   * Find similar patterns
   *
   * @param {Object} params - Parameters
   * @param {string} params.description - Description to match
   * @param {number} [params.threshold] - Similarity threshold (0-1)
   * @param {number} [params.maxResults] - Maximum results
   * @returns {Promise<Object>} Similar patterns
   *
   * @example
   * const result = await service.findSimilarPatterns({
   *   description: 'Real-time analytics',
   *   threshold: 0.8
   * });
   */
  async findSimilarPatterns(params) {
    return this._execute('findSimilarPatterns', params);
  }

  /**
   * Get pattern statistics
   *
   * @param {Object} [params={}] - Parameters
   * @param {string} [params.domain] - Pattern domain
   * @returns {Promise<Object>} Statistics
   *
   * @example
   * const stats = await service.getPatternStatistics({ domain: 'finance' });
   */
  async getPatternStatistics(params = {}) {
    return this._execute('getPatternStatistics', params);
  }

  /**
   * Record a successful pattern
   *
   * @param {Object} params - Pattern details
   * @returns {Promise<Object>} Result
   *
   * @example
   * await service.recordPattern({
   *   patternName: 'risk_calculator',
   *   domain: 'finance',
   *   successRate: 0.95
   * });
   */
  async recordPattern(params) {
    return this._execute('recordPattern', params);
  }

  // Extension Generation Methods

  /**
   * Analyze extension requirements
   *
   * @param {Object} params - Parameters
   * @param {string} params.description - What the extension should do
   * @param {string} [params.domain] - Extension domain
   * @returns {Promise<Object>} Analysis result
   *
   * @example
   * const analysis = await service.analyzeRequirements({
   *   description: 'Real-time customer analytics',
   *   domain: 'analytics'
   * });
   */
  async analyzeRequirements(params) {
    return this._execute('analyzeRequirements', params);
  }

  /**
   * Recommend implementation path
   *
   * @param {Object} params - Parameters
   * @param {Object} params.requirements - Requirements object
   * @returns {Promise<Object>} Path recommendation
   */
  async recommendPath(params) {
    return this._execute('recommendPath', params);
  }

  /**
   * Generate an extension
   *
   * @param {Object} params - Parameters
   * @param {string} params.description - Extension description
   * @param {string} [params.backend='python'] - Backend language
   * @param {string} [params.performanceLevel='balanced'] - Performance level
   * @param {boolean} [params.includeTests=true] - Include tests
   * @returns {Promise<Object>} Generation result
   *
   * @example
   * const result = await service.generateExtension({
   *   description: 'Portfolio VaR calculation',
   *   backend: 'mojo',
   *   performanceLevel: 'speed'
   * });
   */
  async generateExtension(params) {
    return this._execute('generateExtension', params, { timeout: 120000 });
  }

  /**
   * Quick extension generation from description
   *
   * @param {Object} params - Parameters
   * @param {string} params.description - Extension description
   * @param {string} [params.backend='python'] - Backend language
   * @returns {Promise<Object>} Generation result
   *
   * @example
   * const result = await service.quickExtensionFromDescription({
   *   description: 'Customer conversion tracking'
   * });
   */
  async quickExtensionFromDescription(params) {
    return this._execute('quickExtensionFromDescription', params, { timeout: 120000 });
  }

  // Agent Amplification Methods

  /**
   * Create a dynamic tool
   *
   * @param {Object} params - Parameters
   * @param {Object} params.capabilityRequest - Capability request
   * @returns {Promise<Object>} Tool creation result
   */
  async createDynamicTool(params) {
    return this._execute('createDynamicTool', params);
  }

  /**
   * Record a decision outcome
   *
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} Result
   */
  async recordDecision(params) {
    return this._execute('recordDecision', params);
  }

  /**
   * Consult peer agents
   *
   * @param {Object} params - Parameters
   * @param {string} params.expertiseArea - Expertise area
   * @returns {Promise<Object>} Consultation result
   */
  async consultPeers(params) {
    return this._execute('consultPeers', params);
  }

  /**
   * Track capability evolution
   *
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} Result
   */
  async trackEvolution(params) {
    return this._execute('trackEvolution', params);
  }

  // Agent Context Methods

  /**
   * Detect agent type
   *
   * @returns {Promise<Object>} Agent detection result
   */
  async detectAgentType() {
    return this._execute('detectAgentType', {});
  }

  /**
   * Get agent capabilities
   *
   * @param {Object} params - Parameters
   * @param {string} params.agentType - Agent type
   * @returns {Promise<Object>} Capabilities
   */
  async getAgentCapabilities(params) {
    return this._execute('getAgentCapabilities', params);
  }

  /**
   * Get token budget for agent
   *
   * @param {Object} params - Parameters
   * @param {string} params.agentType - Agent type
   * @param {string} [params.tier] - Agent tier
   * @returns {Promise<Object>} Token budget info
   */
  async getTokenBudget(params) {
    return this._execute('getTokenBudget', params);
  }

  // Utility Methods

  /**
   * Get service statistics
   *
   * @returns {Object} Statistics including bridge, cache, and metrics
   *
   * @example
   * const stats = service.getStats();
   * console.log(`Success rate: ${stats.successRate}%`);
   */
  getStats() {
    const bridgeStats = this.bridge.getStats();
    const cacheStats = this.cache ? this.cache.getStats() : null;
    const metricsStats = this.metrics ? this.metrics.getStats() : null;

    return {
      bridge: bridgeStats,
      cache: cacheStats,
      metrics: metricsStats
    };
  }

  /**
   * Get metrics in Prometheus format
   *
   * @returns {string} Prometheus metrics
   */
  getMetrics() {
    if (!this.metrics) {
      return '';
    }

    return this.metrics.toPrometheus();
  }

  /**
   * Warm cache for specific methods
   *
   * @param {Array<Object>} requests - Array of { method, params } to warm
   * @returns {Promise<void>}
   *
   * @example
   * await service.warmCache([
   *   { method: 'getRecommendations', params: { domain: 'finance' } },
   *   { method: 'getPatternStatistics', params: {} }
   * ]);
   */
  async warmCache(requests) {
    if (!this.cache) {
      return;
    }

    this.logger.info('Warming cache', { requests: requests.length });

    const promises = requests.map(({ method, params }) =>
      this._execute(method, params).catch(error => {
        this.logger.warn('Cache warm failed', {
          method,
          error: error.message
        });
      })
    );

    await Promise.all(promises);

    this.logger.info('Cache warmed');
  }

  /**
   * Invalidate cache entries
   *
   * @param {string|RegExp} pattern - Pattern to match
   *
   * @example
   * service.invalidateCache(/^getRecommendations:/);
   */
  invalidateCache(pattern) {
    if (!this.cache) {
      return;
    }

    this.cache.invalidate(pattern);
    this.logger.info('Cache invalidated', { pattern: pattern.toString() });
  }

  /**
   * Check if service is healthy
   *
   * @returns {boolean} True if healthy
   */
  isHealthy() {
    return this.started && this.bridge.isHealthy();
  }

  /**
   * Shutdown the service
   *
   * @returns {Promise<void>}
   *
   * @example
   * await service.shutdown();
   */
  async shutdown() {
    if (!this.started) {
      return;
    }

    this.logger.info('Shutting down service');

    await this.bridge.shutdown();

    this.started = false;
    this.logger.info('Service shutdown complete');
  }
}

/**
 * Create and start a service instance
 *
 * @param {Object} config - Service configuration
 * @returns {Promise<SQLiteFrameworkService>} Started service instance
 *
 * @example
 * const service = await createService({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 */
export async function createService(config) {
  const service = new SQLiteFrameworkService(config);
  await service.start();
  return service;
}
