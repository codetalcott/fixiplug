/**
 * Request Adapter for SQLite Framework Bridge
 *
 * Transforms FixiPlug method calls to Python framework format.
 * Maps method names, parameters, and metadata.
 *
 * @module sdk/adapters/sqlite-framework/request-adapter
 */

/**
 * Method name mappings from FixiPlug to Python framework
 * @constant {Object}
 */
const METHOD_MAPPINGS = {
  // Pattern Learning
  'getRecommendations': '.claude_code.extension_pattern_learning.get_recommendations',
  'findSimilarPatterns': '.claude_code.extension_pattern_learning.find_similar_patterns',
  'getPatternStatistics': '.claude_code.extension_pattern_learning.get_pattern_statistics',
  'recordPattern': '.claude_code.extension_pattern_learning.record_successful_pattern',

  // Extension Generation
  'analyzeRequirements': 'src.generator.llm_agent_interface.analyze_requirements',
  'recommendPath': 'src.generator.llm_agent_interface.recommend_path',
  'generateExtension': 'src.generator.llm_agent_interface.generate_extension',
  'quickExtensionFromDescription': 'src.generator.llm_agent_interface.quick_extension_from_description',

  // Agent Amplification
  'createDynamicTool': 'src.agent_amplification.dynamic_tool_creation.generate_new_tool_capability',
  'recordDecision': 'src.agent_amplification.agent_learning_protocols.record_decision_outcome',
  'consultPeers': 'src.agent_amplification.collaborative_knowledge_base.consult_peer_agents',
  'trackEvolution': 'src.agent_amplification.evolution_tracker.track_capability_evolution',

  // Code Research
  'designExperiment': 'code_research_tools.core.experiment_designer.design_experiment',
  'analyzeCodeStatistics': 'code_research_tools.analysis.statistical_engine.analyze_codebase',
  'runResearchProtocol': 'code_research_tools.core.research_orchestrator.run_protocol',
  'generateResearchReport': 'code_research_tools.core.research_orchestrator.generate_report',

  // Innovation Engine
  'ideateSolutions': 'innovation_engine.core.ideation_engine.generate_solutions',
  'createSessionTemplate': 'innovation_engine.builders.template_builder.create_template',
  'analyzeCollaboration': 'innovation_engine.agents.analytics.analyze_collaboration_patterns',
  'transferKnowledge': 'innovation_engine.core.knowledge_transfer.transfer_session_knowledge',

  // Prompt Laboratory
  'testPromptVariants': 'prompt_laboratory.core.experiment_builder.test_variants',
  'analyzePromptPerformance': 'prompt_laboratory.core.statistical_engine.analyze_performance',
  'getOptimalPrompt': 'prompt_laboratory.core.optimization.get_optimal_prompt',
  'storePromptPattern': 'prompt_laboratory.core.pattern_repository.store_pattern',

  // Experiments
  'runMemoryExperiment': 'experiments.memory_experiment.run_experiment',
  'trackCapabilityImprovement': 'experiments.capability_experiment.track_improvement',
  'detectFailurePatterns': 'experiments.failure_pattern_detector.detect_patterns',
  'loadTestCapability': 'experiments.load_testing.load_test_capability',

  // Agent Context
  'detectAgentType': 'src.infrastructure.llm_agents.detector.detect_agent_type',
  'getAgentCapabilities': 'src.infrastructure.llm_agents.capabilities.get_capabilities',
  'getTokenBudget': 'src.infrastructure.llm_agents.capabilities.get_token_budget',
  'formatForAgent': 'src.infrastructure.llm_agents.context.format_for_agent'
};

/**
 * Parameter transformations for specific methods
 * Maps FixiPlug parameter names to Python framework names
 * @constant {Object}
 */
const PARAMETER_TRANSFORMATIONS = {
  'getRecommendations': {
    'domain': 'domain',
    'description': 'description',
    'minConfidence': 'min_confidence',
    'maxResults': 'max_results'
  },

  'findSimilarPatterns': {
    'description': 'description',
    'threshold': 'similarity_threshold',
    'maxResults': 'max_results'
  },

  'getPatternStatistics': {
    'domain': 'domain',
    'timeRange': 'time_range'
  },

  'recordPattern': {
    'patternName': 'pattern_name',
    'domain': 'domain',
    'successRate': 'success_rate',
    'performance': 'avg_performance_ms',
    'description': 'description',
    'metadata': 'metadata'
  },

  'analyzeRequirements': {
    'description': 'description',
    'domain': 'domain',
    'performanceRequirements': 'performance_requirements'
  },

  'recommendPath': {
    'requirements': 'requirements',
    'constraints': 'constraints'
  },

  'generateExtension': {
    'description': 'description',
    'backend': 'backend_language',
    'performanceLevel': 'performance_level',
    'includeTests': 'include_tests',
    'includeDocumentation': 'include_documentation'
  },

  'quickExtensionFromDescription': {
    'description': 'description',
    'backend': 'backend_language'
  },

  'createDynamicTool': {
    'capabilityRequest': 'capability_request',
    'context': 'context',
    'priority': 'priority'
  },

  'recordDecision': {
    'decisionId': 'decision_id',
    'decision': 'decision',
    'outcome': 'outcome',
    'confidence': 'confidence'
  },

  'consultPeers': {
    'expertiseArea': 'expertise_area',
    'question': 'question',
    'context': 'context'
  },

  'trackEvolution': {
    'capabilityId': 'capability_id',
    'metrics': 'metrics',
    'timestamp': 'timestamp'
  },

  'designExperiment': {
    'hypothesis': 'hypothesis',
    'variables': 'variables',
    'controls': 'controls',
    'sampleSize': 'sample_size'
  },

  'analyzeCodeStatistics': {
    'codebasePath': 'codebase_path',
    'metrics': 'metrics',
    'depth': 'depth'
  },

  'runResearchProtocol': {
    'experimentConfig': 'experiment_config',
    'parallel': 'parallel',
    'timeout': 'timeout'
  },

  'generateResearchReport': {
    'experimentId': 'experiment_id',
    'format': 'format',
    'sections': 'sections'
  },

  'detectAgentType': {},

  'getAgentCapabilities': {
    'agentType': 'agent_type'
  },

  'getTokenBudget': {
    'agentType': 'agent_type',
    'tier': 'tier'
  },

  'formatForAgent': {
    'content': 'content',
    'agentType': 'agent_type',
    'format': 'format'
  }
};

/**
 * Request Adapter class
 *
 * @class RequestAdapter
 *
 * @example
 * const adapter = new RequestAdapter();
 * const adapted = adapter.adapt('getRecommendations', {
 *   domain: 'finance',
 *   minConfidence: 0.8
 * });
 */
export class RequestAdapter {
  /**
   * Create a request adapter
   * @param {Object} [options={}] - Adapter options
   * @param {boolean} [options.strict=false] - Throw on unknown methods
   */
  constructor(options = {}) {
    this.strict = options.strict || false;
  }

  /**
   * Adapt a FixiPlug method call to Python framework format
   *
   * @param {string} method - FixiPlug method name
   * @param {Object} params - Method parameters
   * @returns {Object} Adapted request { method, params }
   *
   * @example
   * const adapted = adapter.adapt('getRecommendations', {
   *   domain: 'finance',
   *   minConfidence: 0.8
   * });
   * // Returns: {
   * //   method: '.claude_code.extension_pattern_learning.get_recommendations',
   * //   params: { domain: 'finance', min_confidence: 0.8 }
   * // }
   */
  adapt(method, params = {}) {
    // Map method name
    const pythonMethod = this._mapMethodName(method);

    // Transform parameters
    const pythonParams = this._transformParameters(method, params);

    return {
      method: pythonMethod,
      params: pythonParams
    };
  }

  /**
   * Map FixiPlug method name to Python framework method
   *
   * @param {string} method - FixiPlug method name
   * @returns {string} Python framework method path
   * @private
   */
  _mapMethodName(method) {
    // Check if it's already a Python method path (contains dots)
    if (method.includes('.')) {
      return method;
    }

    // Look up mapping
    const mapped = METHOD_MAPPINGS[method];

    if (!mapped) {
      if (this.strict) {
        throw new Error(`Unknown method: ${method}`);
      }
      // Return as-is if not in strict mode
      return method;
    }

    return mapped;
  }

  /**
   * Transform parameters from FixiPlug format to Python format
   *
   * @param {string} method - Method name
   * @param {Object} params - FixiPlug parameters
   * @returns {Object} Python framework parameters
   * @private
   */
  _transformParameters(method, params) {
    // Get transformation map for this method
    const transformMap = PARAMETER_TRANSFORMATIONS[method];

    if (!transformMap) {
      // No specific transformation defined - apply generic camelCase to snake_case
      return this._transformObjectKeys(params);
    }

    // Transform each parameter using the specific mapping
    const transformed = {};

    for (const [fixiPlugKey, value] of Object.entries(params)) {
      const pythonKey = transformMap[fixiPlugKey] || fixiPlugKey;
      transformed[pythonKey] = this._transformValue(value);
    }

    return transformed;
  }

  /**
   * Transform a parameter value
   *
   * Handles special conversions like camelCase to snake_case
   *
   * @param {*} value - Value to transform
   * @returns {*} Transformed value
   * @private
   */
  _transformValue(value) {
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this._transformValue(v));
    }

    // Handle objects
    if (value && typeof value === 'object' && value.constructor === Object) {
      return this._transformObjectKeys(value);
    }

    // Return primitives as-is
    return value;
  }

  /**
   * Transform object keys from camelCase to snake_case
   *
   * @param {Object} obj - Object to transform
   * @returns {Object} Transformed object
   * @private
   */
  _transformObjectKeys(obj) {
    const transformed = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = this._camelToSnake(key);
      transformed[snakeKey] = this._transformValue(value);
    }

    return transformed;
  }

  /**
   * Convert camelCase to snake_case
   *
   * @param {string} str - camelCase string
   * @returns {string} snake_case string
   * @private
   */
  _camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Batch adapt multiple method calls
   *
   * @param {Array<Object>} calls - Array of { method, params } objects
   * @returns {Array<Object>} Array of adapted requests
   *
   * @example
   * const adapted = adapter.batchAdapt([
   *   { method: 'getRecommendations', params: { domain: 'finance' } },
   *   { method: 'getPatternStatistics', params: {} }
   * ]);
   */
  batchAdapt(calls) {
    return calls.map(call => this.adapt(call.method, call.params));
  }

  /**
   * Check if a method is supported
   *
   * @param {string} method - Method name to check
   * @returns {boolean} True if method is supported
   *
   * @example
   * if (adapter.isSupported('getRecommendations')) {
   *   // Method is supported
   * }
   */
  isSupported(method) {
    return method in METHOD_MAPPINGS || method.includes('.');
  }

  /**
   * Get all supported method names
   *
   * @returns {string[]} Array of supported method names
   */
  getSupportedMethods() {
    return Object.keys(METHOD_MAPPINGS);
  }

  /**
   * Get Python method path for a FixiPlug method
   *
   * @param {string} method - FixiPlug method name
   * @returns {string|null} Python method path or null if not found
   */
  getPythonMethod(method) {
    return METHOD_MAPPINGS[method] || null;
  }
}

/**
 * Create a request adapter instance
 *
 * @param {Object} [options] - Adapter options
 * @returns {RequestAdapter} Adapter instance
 *
 * @example
 * const adapter = createRequestAdapter({ strict: true });
 */
export function createRequestAdapter(options) {
  return new RequestAdapter(options);
}

/**
 * Convenience function to adapt a single request
 *
 * @param {string} method - Method name
 * @param {Object} params - Parameters
 * @returns {Object} Adapted request
 *
 * @example
 * const adapted = adaptRequest('getRecommendations', { domain: 'finance' });
 */
export function adaptRequest(method, params) {
  const adapter = new RequestAdapter();
  return adapter.adapt(method, params);
}
