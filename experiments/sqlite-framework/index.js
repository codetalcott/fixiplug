/**
 * SQLite Extensions Framework Bridge for FixiPlug
 *
 * High-performance, resilient bridge to the SQLite Extensions Framework.
 * Provides pattern learning, extension generation, and agent amplification capabilities.
 *
 * @module sdk/adapters/sqlite-framework
 *
 * @example
 * import { createBridge } from './sdk/adapters/sqlite-framework/index.js';
 *
 * const bridge = await createBridge({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 *
 * const result = await bridge.call(
 *   'src.generator.llm_agent_interface.analyze_requirements',
 *   { description: 'Portfolio risk analysis' }
 * );
 *
 * await bridge.shutdown();
 */

// Main bridge
export { SQLiteFrameworkBridge, createBridge } from './bridge.js';

// Configuration
export {
  createConfig,
  ConfigBuilder,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA
} from './config.js';

// Errors
export {
  SQLiteFrameworkError,
  BridgeError,
  ProcessError,
  TimeoutError,
  ValidationError,
  PythonError,
  CircuitBreakerError,
  CacheError,
  FrameworkNotFoundError,
  MethodNotFoundError,
  ParseError,
  createErrorFromResponse,
  isRecoverableError,
  getRetryDelay
} from './errors.js';

// Protocol
export {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  validateRequest,
  validateResponse,
  serializeRequest,
  parseResponse,
  extractResult,
  isErrorResponse,
  CorrelationTracker,
  ErrorCode,
  Priority
} from './protocol.js';

// Retry
export {
  Retry,
  retry,
  withRetry,
  BackoffStrategy,
  exponentialBackoff,
  linearBackoff,
  calculateBackoff,
  sleep
} from './retry.js';

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerManager,
  withCircuitBreaker,
  CircuitState
} from './circuit-breaker.js';

// Process Pool
export {
  ProcessPool,
  ProcessState
} from './process-pool.js';

// Service Layer (Phase 2)
export {
  SQLiteFrameworkService,
  createService
} from './service.js';

// Request/Response Adapters
export {
  RequestAdapter,
  createRequestAdapter,
  adaptRequest
} from './request-adapter.js';

export {
  ResponseAdapter,
  createResponseAdapter,
  adaptResponse
} from './response-adapter.js';

// Validation
export {
  Validator,
  createValidator,
  validateParams,
  sanitizeParams
} from './validation.js';

// Cache Manager
export {
  CacheManager,
  createCacheManager
} from './cache-manager.js';

// Metrics
export {
  MetricsCollector,
  createMetricsCollector
} from './metrics.js';

// Logger
export {
  Logger,
  createLogger,
  createCorrelationId,
  createRequestLogger,
  LogLevel
} from './logger.js';
