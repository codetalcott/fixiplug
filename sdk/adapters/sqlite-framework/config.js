/**
 * Configuration System for SQLite Framework Bridge
 *
 * Provides configuration schema, validation, defaults, and builder API
 *
 * @module sdk/adapters/sqlite-framework/config
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { ValidationError } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default configuration values
 * @constant {Object}
 */
export const DEFAULT_CONFIG = {
  // Python framework path (required)
  frameworkPath: null,

  // Python executable (default: python3)
  pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',

  // Process pool settings
  maxProcesses: parseInt(process.env.MAX_PROCESSES) || 4,
  processIdleTimeout: parseInt(process.env.PROCESS_IDLE_TIMEOUT) || 300000, // 5 minutes
  processStartupTimeout: 10000, // 10 seconds

  // Request settings
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30 seconds
  maxConcurrentRequests: 100,

  // Retry settings
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
  retryBackoff: process.env.RETRY_BACKOFF || 'exponential',
  retryInitialDelay: 1000, // 1 second
  retryMaxDelay: 30000, // 30 seconds

  // Circuit breaker settings
  circuitBreakerEnabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
  circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000, // 1 minute
  circuitBreakerHalfOpenRequests: 3,

  // Cache settings
  cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  l1MaxItems: 1000,
  l1TTL: 60000, // 1 minute
  l2MaxSize: 100 * 1024 * 1024, // 100MB
  l2TTL: 3600000, // 1 hour
  l2Directory: process.env.CACHE_DIR || '.cache/sqlite-framework',

  // Metrics and logging
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Development/debug
  debug: process.env.DEBUG === 'true',
  verbose: process.env.VERBOSE === 'true'
};

/**
 * Configuration schema for validation
 * @constant {Object}
 */
export const CONFIG_SCHEMA = {
  frameworkPath: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!value || typeof value !== 'string') {
        return 'frameworkPath is required and must be a string';
      }
      if (!existsSync(value)) {
        return `frameworkPath does not exist: ${value}`;
      }
      return null;
    }
  },

  pythonExecutable: {
    type: 'string',
    required: false,
    default: DEFAULT_CONFIG.pythonExecutable
  },

  maxProcesses: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.maxProcesses,
    validate: (value) => {
      if (value < 1 || value > 32) {
        return 'maxProcesses must be between 1 and 32';
      }
      return null;
    }
  },

  processIdleTimeout: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.processIdleTimeout,
    validate: (value) => {
      if (value < 1000) {
        return 'processIdleTimeout must be at least 1000ms';
      }
      return null;
    }
  },

  processStartupTimeout: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.processStartupTimeout
  },

  requestTimeout: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.requestTimeout,
    validate: (value) => {
      if (value < 1000 || value > 600000) {
        return 'requestTimeout must be between 1000ms and 600000ms (10 minutes)';
      }
      return null;
    }
  },

  maxConcurrentRequests: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.maxConcurrentRequests
  },

  retryAttempts: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.retryAttempts,
    validate: (value) => {
      if (value < 0 || value > 10) {
        return 'retryAttempts must be between 0 and 10';
      }
      return null;
    }
  },

  retryBackoff: {
    type: 'string',
    required: false,
    default: DEFAULT_CONFIG.retryBackoff,
    validate: (value) => {
      if (!['exponential', 'linear'].includes(value)) {
        return 'retryBackoff must be "exponential" or "linear"';
      }
      return null;
    }
  },

  retryInitialDelay: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.retryInitialDelay
  },

  retryMaxDelay: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.retryMaxDelay
  },

  circuitBreakerEnabled: {
    type: 'boolean',
    required: false,
    default: DEFAULT_CONFIG.circuitBreakerEnabled
  },

  circuitBreakerThreshold: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.circuitBreakerThreshold,
    validate: (value) => {
      if (value < 1 || value > 100) {
        return 'circuitBreakerThreshold must be between 1 and 100';
      }
      return null;
    }
  },

  circuitBreakerTimeout: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.circuitBreakerTimeout
  },

  circuitBreakerHalfOpenRequests: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.circuitBreakerHalfOpenRequests
  },

  cacheEnabled: {
    type: 'boolean',
    required: false,
    default: DEFAULT_CONFIG.cacheEnabled
  },

  l1MaxItems: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.l1MaxItems
  },

  l1TTL: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.l1TTL
  },

  l2MaxSize: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.l2MaxSize
  },

  l2TTL: {
    type: 'number',
    required: false,
    default: DEFAULT_CONFIG.l2TTL
  },

  l2Directory: {
    type: 'string',
    required: false,
    default: DEFAULT_CONFIG.l2Directory
  },

  enableMetrics: {
    type: 'boolean',
    required: false,
    default: DEFAULT_CONFIG.enableMetrics
  },

  logLevel: {
    type: 'string',
    required: false,
    default: DEFAULT_CONFIG.logLevel,
    validate: (value) => {
      if (!['debug', 'info', 'warn', 'error'].includes(value)) {
        return 'logLevel must be one of: debug, info, warn, error';
      }
      return null;
    }
  },

  debug: {
    type: 'boolean',
    required: false,
    default: DEFAULT_CONFIG.debug
  },

  verbose: {
    type: 'boolean',
    required: false,
    default: DEFAULT_CONFIG.verbose
  }
};

/**
 * Validate configuration object against schema
 *
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 *
 * @example
 * const result = validateConfig(config);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
export function validateConfig(config) {
  const errors = [];

  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const value = config[key];

    // Check required fields
    if (schema.required && (value === undefined || value === null)) {
      errors.push({
        field: key,
        message: `${key} is required`
      });
      continue;
    }

    // Skip validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Check type
    const actualType = typeof value;
    if (actualType !== schema.type) {
      errors.push({
        field: key,
        message: `${key} must be of type ${schema.type}, got ${actualType}`
      });
      continue;
    }

    // Run custom validation if provided
    if (schema.validate) {
      const error = schema.validate(value);
      if (error) {
        errors.push({
          field: key,
          message: error
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Apply defaults to configuration
 *
 * @param {Object} config - Partial configuration object
 * @returns {Object} Configuration with defaults applied
 *
 * @example
 * const config = applyDefaults({ frameworkPath: '/path/to/framework' });
 */
export function applyDefaults(config) {
  const result = { ...config };

  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    if (result[key] === undefined && schema.default !== undefined) {
      result[key] = schema.default;
    }
  }

  return result;
}

/**
 * Normalize paths in configuration
 *
 * @param {Object} config - Configuration object
 * @returns {Object} Configuration with normalized paths
 *
 * @example
 * const config = normalizePaths({ frameworkPath: './framework' });
 */
export function normalizePaths(config) {
  const result = { ...config };

  // Normalize frameworkPath
  if (result.frameworkPath) {
    if (!isAbsolute(result.frameworkPath)) {
      result.frameworkPath = resolve(process.cwd(), result.frameworkPath);
    }
  }

  // Normalize l2Directory
  if (result.l2Directory) {
    if (!isAbsolute(result.l2Directory)) {
      result.l2Directory = resolve(process.cwd(), result.l2Directory);
    }
  }

  return result;
}

/**
 * Create and validate configuration
 *
 * @param {Object} config - User-provided configuration
 * @returns {Object} Validated configuration with defaults
 * @throws {ValidationError} If configuration is invalid
 *
 * @example
 * const config = createConfig({
 *   frameworkPath: '/path/to/sqlite-extensions-framework'
 * });
 */
export function createConfig(config) {
  // Apply defaults
  let result = applyDefaults(config);

  // Normalize paths
  result = normalizePaths(result);

  // Validate
  const validation = validateConfig(result);
  if (!validation.valid) {
    throw new ValidationError('Invalid configuration', validation.errors);
  }

  return Object.freeze(result);
}

/**
 * Configuration builder with fluent API
 *
 * @class ConfigBuilder
 *
 * @example
 * const config = new ConfigBuilder()
 *   .setFrameworkPath('/path/to/framework')
 *   .setMaxProcesses(8)
 *   .enableDebug()
 *   .build();
 */
export class ConfigBuilder {
  constructor() {
    this.config = {};
  }

  /**
   * Set framework path
   * @param {string} path - Path to SQLite Extensions Framework
   * @returns {ConfigBuilder} this for chaining
   */
  setFrameworkPath(path) {
    this.config.frameworkPath = path;
    return this;
  }

  /**
   * Set Python executable
   * @param {string} executable - Python executable path or name
   * @returns {ConfigBuilder} this for chaining
   */
  setPythonExecutable(executable) {
    this.config.pythonExecutable = executable;
    return this;
  }

  /**
   * Set maximum number of processes
   * @param {number} max - Maximum processes (1-32)
   * @returns {ConfigBuilder} this for chaining
   */
  setMaxProcesses(max) {
    this.config.maxProcesses = max;
    return this;
  }

  /**
   * Set request timeout
   * @param {number} timeout - Timeout in milliseconds
   * @returns {ConfigBuilder} this for chaining
   */
  setRequestTimeout(timeout) {
    this.config.requestTimeout = timeout;
    return this;
  }

  /**
   * Set retry configuration
   * @param {number} attempts - Number of retry attempts
   * @param {string} [backoff='exponential'] - Backoff strategy
   * @returns {ConfigBuilder} this for chaining
   */
  setRetry(attempts, backoff = 'exponential') {
    this.config.retryAttempts = attempts;
    this.config.retryBackoff = backoff;
    return this;
  }

  /**
   * Enable/disable circuit breaker
   * @param {boolean} enabled - Enable circuit breaker
   * @param {number} [threshold=5] - Failure threshold
   * @param {number} [timeout=60000] - Reset timeout
   * @returns {ConfigBuilder} this for chaining
   */
  setCircuitBreaker(enabled, threshold = 5, timeout = 60000) {
    this.config.circuitBreakerEnabled = enabled;
    this.config.circuitBreakerThreshold = threshold;
    this.config.circuitBreakerTimeout = timeout;
    return this;
  }

  /**
   * Enable/disable cache
   * @param {boolean} enabled - Enable cache
   * @returns {ConfigBuilder} this for chaining
   */
  setCache(enabled) {
    this.config.cacheEnabled = enabled;
    return this;
  }

  /**
   * Set cache directory
   * @param {string} directory - Cache directory path
   * @returns {ConfigBuilder} this for chaining
   */
  setCacheDirectory(directory) {
    this.config.l2Directory = directory;
    return this;
  }

  /**
   * Set log level
   * @param {string} level - Log level (debug, info, warn, error)
   * @returns {ConfigBuilder} this for chaining
   */
  setLogLevel(level) {
    this.config.logLevel = level;
    return this;
  }

  /**
   * Enable debug mode
   * @returns {ConfigBuilder} this for chaining
   */
  enableDebug() {
    this.config.debug = true;
    this.config.verbose = true;
    this.config.logLevel = 'debug';
    return this;
  }

  /**
   * Enable production mode (optimized settings)
   * @returns {ConfigBuilder} this for chaining
   */
  enableProduction() {
    this.config.debug = false;
    this.config.verbose = false;
    this.config.logLevel = 'warn';
    this.config.maxProcesses = 8;
    this.config.cacheEnabled = true;
    return this;
  }

  /**
   * Load configuration from environment variables
   * @returns {ConfigBuilder} this for chaining
   */
  fromEnvironment() {
    if (process.env.SQLITE_FRAMEWORK_PATH) {
      this.config.frameworkPath = process.env.SQLITE_FRAMEWORK_PATH;
    }
    // Other env vars are already handled in DEFAULT_CONFIG
    return this;
  }

  /**
   * Merge with another configuration object
   * @param {Object} config - Configuration to merge
   * @returns {ConfigBuilder} this for chaining
   */
  merge(config) {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Build and validate configuration
   * @returns {Object} Frozen configuration object
   * @throws {ValidationError} If configuration is invalid
   */
  build() {
    return createConfig(this.config);
  }
}
