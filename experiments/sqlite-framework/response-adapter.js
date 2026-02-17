/**
 * Response Adapter for SQLite Framework Bridge
 *
 * Transforms Python framework responses to FixiPlug format.
 * Normalizes data structures and converts naming conventions.
 *
 * @module sdk/adapters/sqlite-framework/response-adapter
 */

/**
 * Response Adapter class
 *
 * @class ResponseAdapter
 *
 * @example
 * const adapter = new ResponseAdapter();
 * const normalized = adapter.adapt('getRecommendations', pythonResponse);
 */
export class ResponseAdapter {
  /**
   * Create a response adapter
   * @param {Object} [options={}] - Adapter options
   * @param {boolean} [options.preserveMetadata=true] - Keep metadata in responses
   */
  constructor(options = {}) {
    this.preserveMetadata = options.preserveMetadata !== false;
  }

  /**
   * Adapt a Python framework response to FixiPlug format
   *
   * @param {string} method - Method name (for method-specific transformations)
   * @param {Object} response - Python framework response
   * @returns {Object} Adapted response
   *
   * @example
   * const adapted = adapter.adapt('getRecommendations', {
   *   data: {
   *     recommendations: [...],
   *     total_patterns: 42
   *   },
   *   metadata: { execution_time: 150 }
   * });
   */
  adapt(method, response) {
    // Extract data and metadata
    const data = response.data || response;
    const metadata = response.metadata || {};

    // Transform based on method
    const transformed = this._transformByMethod(method, data);

    // Add metadata if preserving
    if (this.preserveMetadata && Object.keys(metadata).length > 0) {
      return {
        ...transformed,
        _metadata: this._normalizeMetadata(metadata)
      };
    }

    return transformed;
  }

  /**
   * Transform response based on method type
   *
   * @param {string} method - Method name
   * @param {Object} data - Response data
   * @returns {Object} Transformed data
   * @private
   */
  _transformByMethod(method, data) {
    // Method-specific transformations
    const methodHandlers = {
      'getRecommendations': this._adaptRecommendations.bind(this),
      'findSimilarPatterns': this._adaptSimilarPatterns.bind(this),
      'getPatternStatistics': this._adaptPatternStatistics.bind(this),
      'analyzeRequirements': this._adaptRequirementsAnalysis.bind(this),
      'generateExtension': this._adaptExtensionGeneration.bind(this),
      'quickExtensionFromDescription': this._adaptExtensionGeneration.bind(this),
      'createDynamicTool': this._adaptDynamicTool.bind(this),
      'detectAgentType': this._adaptAgentDetection.bind(this)
    };

    const handler = methodHandlers[method];

    if (handler) {
      return handler(data);
    }

    // Default: normalize keys
    return this._normalizeKeys(data);
  }

  /**
   * Adapt pattern recommendations response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized recommendations
   * @private
   */
  _adaptRecommendations(data) {
    return {
      recommendations: (data.recommendations || []).map(pattern => ({
        pattern: pattern.pattern_name,
        confidence: pattern.confidence_score,
        domain: pattern.domain,
        successRate: pattern.success_rate,
        avgPerformance: pattern.avg_performance_ms,
        usageCount: pattern.usage_count,
        description: pattern.description,
        antiPatterns: pattern.anti_patterns || []
      })),
      totalPatterns: data.total_patterns,
      executionTime: data.execution_time_ms
    };
  }

  /**
   * Adapt similar patterns response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized similar patterns
   * @private
   */
  _adaptSimilarPatterns(data) {
    return {
      patterns: (data.similar_patterns || []).map(pattern => ({
        pattern: pattern.pattern_name,
        similarity: pattern.similarity_score,
        description: pattern.description,
        domain: pattern.domain,
        successRate: pattern.success_rate
      })),
      totalFound: data.total_found || (data.similar_patterns || []).length
    };
  }

  /**
   * Adapt pattern statistics response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized statistics
   * @private
   */
  _adaptPatternStatistics(data) {
    return {
      totalPatterns: data.total_patterns,
      domains: data.domains || {},
      avgSuccessRate: data.avg_success_rate,
      totalUsage: data.total_usage,
      topPatterns: data.top_patterns || []
    };
  }

  /**
   * Adapt requirements analysis response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized analysis
   * @private
   */
  _adaptRequirementsAnalysis(data) {
    return {
      requirements: {
        domain: data.requirements?.domain,
        backend: data.requirements?.backend,
        complexity: data.requirements?.complexity,
        estimatedTime: data.requirements?.estimated_time
      },
      recommendedPath: data.recommended_path,
      confidence: data.confidence,
      alternatives: data.alternatives || []
    };
  }

  /**
   * Adapt extension generation response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized generation result
   * @private
   */
  _adaptExtensionGeneration(data) {
    return {
      success: data.success,
      extensionPath: data.extension_path,
      backend: data.backend,
      generatedFiles: data.generated_files || [],
      testSuite: data.test_suite,
      performance: data.performance ? {
        estimatedOpsPerSec: data.performance.estimated_ops_per_sec,
        memoryUsage: data.performance.memory_usage
      } : null,
      error: data.error
    };
  }

  /**
   * Adapt dynamic tool creation response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized tool creation result
   * @private
   */
  _adaptDynamicTool(data) {
    return {
      success: data.success,
      toolId: data.tool_id,
      toolName: data.tool_name,
      implementation: data.implementation,
      tests: data.tests || [],
      documentation: data.documentation,
      performance: data.performance_metadata
    };
  }

  /**
   * Adapt agent detection response
   * @param {Object} data - Python response data
   * @returns {Object} Normalized agent info
   * @private
   */
  _adaptAgentDetection(data) {
    return {
      agentType: data.agent_type,
      capabilities: data.capabilities || [],
      tokenBudget: data.token_budget,
      tier: data.tier,
      features: data.features || {}
    };
  }

  /**
   * Normalize metadata object
   * @param {Object} metadata - Metadata object
   * @returns {Object} Normalized metadata
   * @private
   */
  _normalizeMetadata(metadata) {
    return {
      executionTime: metadata.execution_time || metadata.executionTime,
      cached: metadata.cached || false,
      version: metadata.version,
      responseTime: metadata.response_time || metadata.responseTime,
      requestId: metadata.request_id || metadata.requestId
    };
  }

  /**
   * Normalize object keys from snake_case to camelCase
   *
   * @param {*} value - Value to normalize
   * @returns {*} Normalized value
   * @private
   */
  _normalizeKeys(value) {
    // Handle null/undefined
    if (value == null) {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this._normalizeKeys(item));
    }

    // Handle objects
    if (typeof value === 'object' && value.constructor === Object) {
      const normalized = {};

      for (const [key, val] of Object.entries(value)) {
        const camelKey = this._snakeToCamel(key);
        normalized[camelKey] = this._normalizeKeys(val);
      }

      return normalized;
    }

    // Return primitives as-is
    return value;
  }

  /**
   * Convert snake_case to camelCase
   *
   * @param {string} str - snake_case string
   * @returns {string} camelCase string
   * @private
   */
  _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Batch adapt multiple responses
   *
   * @param {Array<Object>} responses - Array of { method, response } objects
   * @returns {Array<Object>} Array of adapted responses
   *
   * @example
   * const adapted = adapter.batchAdapt([
   *   { method: 'getRecommendations', response: { data: {...} } },
   *   { method: 'getPatternStatistics', response: { data: {...} } }
   * ]);
   */
  batchAdapt(responses) {
    return responses.map(({ method, response }) =>
      this.adapt(method, response)
    );
  }

  /**
   * Extract only data from response (strip metadata)
   *
   * @param {Object} response - Python framework response
   * @returns {Object} Data only
   *
   * @example
   * const data = adapter.extractData(response);
   */
  extractData(response) {
    return response.data || response;
  }

  /**
   * Extract only metadata from response
   *
   * @param {Object} response - Python framework response
   * @returns {Object} Metadata only
   *
   * @example
   * const metadata = adapter.extractMetadata(response);
   */
  extractMetadata(response) {
    return this._normalizeMetadata(response.metadata || {});
  }
}

/**
 * Create a response adapter instance
 *
 * @param {Object} [options] - Adapter options
 * @returns {ResponseAdapter} Adapter instance
 *
 * @example
 * const adapter = createResponseAdapter({ preserveMetadata: true });
 */
export function createResponseAdapter(options) {
  return new ResponseAdapter(options);
}

/**
 * Convenience function to adapt a single response
 *
 * @param {string} method - Method name
 * @param {Object} response - Python framework response
 * @returns {Object} Adapted response
 *
 * @example
 * const adapted = adaptResponse('getRecommendations', pythonResponse);
 */
export function adaptResponse(method, response) {
  const adapter = new ResponseAdapter();
  return adapter.adapt(method, response);
}
