/**
 * Structured Logger for SQLite Framework Bridge
 *
 * Provides JSON-formatted logging with correlation IDs,
 * log levels, and context enrichment.
 *
 * @module sdk/adapters/sqlite-framework/logger
 */

import { randomUUID } from 'node:crypto';

/**
 * Log levels
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * Log level priorities (for filtering)
 * @constant {Object}
 * @private
 */
const LOG_LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Structured Logger
 *
 * @class Logger
 *
 * @example
 * const logger = new Logger({ level: 'info', format: 'json' });
 *
 * logger.info('Request started', {
 *   method: 'getRecommendations',
 *   requestId: 'uuid-123'
 * });
 *
 * logger.error('Request failed', {
 *   method: 'getRecommendations',
 *   error: error.message,
 *   requestId: 'uuid-123'
 * });
 */
export class Logger {
  /**
   * Create a logger
   *
   * @param {Object} [options={}] - Logger options
   * @param {string} [options.level='info'] - Minimum log level
   * @param {string} [options.format='json'] - Output format ('json' or 'pretty')
   * @param {boolean} [options.enabled=true] - Enable logging
   * @param {string} [options.component='bridge'] - Component name
   * @param {Function} [options.output] - Custom output function
   */
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.format = options.format || 'json';
    this.enabled = options.enabled !== false;
    this.component = options.component || 'bridge';
    this.output = options.output || console.log;

    // Global context (added to all log entries)
    this.globalContext = {
      component: this.component,
      pid: process.pid
    };
  }

  /**
   * Check if a log level should be logged
   *
   * @param {string} level - Log level to check
   * @returns {boolean} True if level should be logged
   * @private
   */
  _shouldLog(level) {
    if (!this.enabled) {
      return false;
    }

    const levelPriority = LOG_LEVEL_PRIORITY[level] || 0;
    const minPriority = LOG_LEVEL_PRIORITY[this.level] || 0;

    return levelPriority >= minPriority;
  }

  /**
   * Format log entry
   *
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Context object
   * @returns {string} Formatted log entry
   * @private
   */
  _format(level, message, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.globalContext,
      ...context
    };

    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    // Pretty format
    const timestamp = entry.timestamp;
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');

    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}`;
  }

  /**
   * Log a message
   *
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   * @private
   */
  _log(level, message, context = {}) {
    if (!this._shouldLog(level)) {
      return;
    }

    const formatted = this._format(level, message, context);
    this.output(formatted);
  }

  /**
   * Log debug message
   *
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   *
   * @example
   * logger.debug('Processing request', { method: 'getRecommendations' });
   */
  debug(message, context = {}) {
    this._log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   *
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   *
   * @example
   * logger.info('Request completed', { duration: 150 });
   */
  info(message, context = {}) {
    this._log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   *
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   *
   * @example
   * logger.warn('Retry attempt', { attempt: 2, maxAttempts: 3 });
   */
  warn(message, context = {}) {
    this._log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   *
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context
   *
   * @example
   * logger.error('Request failed', { error: error.message, stack: error.stack });
   */
  error(message, context = {}) {
    this._log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with additional context
   *
   * @param {Object} context - Context to add to all log entries
   * @returns {Logger} Child logger
   *
   * @example
   * const requestLogger = logger.child({ requestId: 'uuid-123' });
   * requestLogger.info('Processing request');  // Includes requestId
   */
  child(context) {
    const child = new Logger({
      level: this.level,
      format: this.format,
      enabled: this.enabled,
      component: this.component,
      output: this.output
    });

    child.globalContext = {
      ...this.globalContext,
      ...context
    };

    return child;
  }

  /**
   * Set log level
   *
   * @param {string} level - New log level
   *
   * @example
   * logger.setLevel('debug');
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * Get current log level
   *
   * @returns {string} Current log level
   */
  getLevel() {
    return this.level;
  }

  /**
   * Enable logging
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable logging
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if logging is enabled
   *
   * @returns {boolean} True if logging is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

/**
 * Create a logger instance
 *
 * @param {Object} [options] - Logger options
 * @returns {Logger} Logger instance
 *
 * @example
 * const logger = createLogger({ level: 'debug', format: 'pretty' });
 */
export function createLogger(options) {
  return new Logger(options);
}

/**
 * Create a correlation ID
 *
 * @returns {string} UUID v4
 *
 * @example
 * const correlationId = createCorrelationId();
 */
export function createCorrelationId() {
  return randomUUID();
}

/**
 * Request logger middleware
 *
 * Creates a child logger with request-specific context
 *
 * @param {Logger} logger - Parent logger
 * @param {Object} request - Request context
 * @returns {Logger} Request logger
 *
 * @example
 * const requestLogger = createRequestLogger(logger, {
 *   method: 'getRecommendations',
 *   params: { domain: 'finance' }
 * });
 *
 * requestLogger.info('Request started');
 * requestLogger.info('Request completed', { duration: 150 });
 */
export function createRequestLogger(logger, request) {
  const requestId = createCorrelationId();

  return logger.child({
    requestId,
    method: request.method,
    timestamp: Date.now()
  });
}
