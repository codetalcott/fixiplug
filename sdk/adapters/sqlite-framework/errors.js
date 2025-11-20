/**
 * Error classes for SQLite Extensions Framework integration
 *
 * Provides a comprehensive error hierarchy with structured error information,
 * error codes for programmatic handling, and recovery strategies.
 *
 * @module sdk/adapters/sqlite-framework/errors
 */

/**
 * Base error class for SQLite framework integration
 *
 * @class SQLiteFrameworkError
 * @extends Error
 *
 * @example
 * throw new SQLiteFrameworkError(
 *   'Operation failed',
 *   'OPERATION_FAILED',
 *   { reason: 'timeout', recoverable: true }
 * );
 */
export class SQLiteFrameworkError extends Error {
  /**
   * Create a SQLiteFrameworkError
   *
   * @param {string} message - Human-readable error message
   * @param {string} code - Machine-readable error code
   * @param {Object} [details={}] - Additional error details
   * @param {boolean} [details.recoverable=false] - Whether error is recoverable
   * @param {number} [details.retryAfter] - Milliseconds until retry recommended
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SQLiteFrameworkError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.recoverable = details.recoverable || false;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error to JSON
   * @returns {Object} JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }

  /**
   * Format error for logging
   * @returns {string} Formatted error string
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Bridge communication errors
 *
 * Thrown when there are issues communicating with the Python bridge
 *
 * @class BridgeError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new BridgeError('Connection refused', {
 *   host: 'localhost',
 *   port: 5000
 * });
 */
export class BridgeError extends SQLiteFrameworkError {
  constructor(message, details = {}) {
    super(message, 'BRIDGE_ERROR', details);
    this.name = 'BridgeError';
  }
}

/**
 * Python process errors
 *
 * Thrown when Python process fails to start or crashes
 *
 * @class ProcessError
 * @extends BridgeError
 *
 * @example
 * throw new ProcessError(
 *   'Python process exited unexpectedly',
 *   1,
 *   'ModuleNotFoundError: No module named "sqlite_framework"'
 * );
 */
export class ProcessError extends BridgeError {
  /**
   * @param {string} message - Error message
   * @param {number} exitCode - Process exit code
   * @param {string} stderr - Standard error output
   */
  constructor(message, exitCode, stderr) {
    super(message, {
      exitCode,
      stderr,
      recoverable: false
    });
    this.name = 'ProcessError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Timeout errors (recoverable)
 *
 * Thrown when an operation exceeds its timeout limit
 *
 * @class TimeoutError
 * @extends BridgeError
 *
 * @example
 * throw new TimeoutError('Request timed out after 30000ms', 30000);
 */
export class TimeoutError extends BridgeError {
  /**
   * @param {string} message - Error message
   * @param {number} timeoutMs - Timeout duration in milliseconds
   */
  constructor(message, timeoutMs) {
    super(message, {
      timeoutMs,
      recoverable: true,
      retryAfter: 1000 // Suggest retry after 1 second
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Validation errors
 *
 * Thrown when input or output validation fails
 *
 * @class ValidationError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new ValidationError('Invalid parameters', [
 *   { field: 'domain', message: 'must be one of: finance, analytics, ml' }
 * ]);
 */
export class ValidationError extends SQLiteFrameworkError {
  /**
   * @param {string} message - Error message
   * @param {Array<Object>} validationErrors - Array of validation errors
   */
  constructor(message, validationErrors = []) {
    super(message, 'VALIDATION_ERROR', /** @type {any} */({
      validationErrors,
      recoverable: false
    }));
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }

  /**
   * Format validation errors for display
   * @returns {string} Formatted error string
   */
  toString() {
    const errors = this.validationErrors
      .map(e => `  - ${e.field || 'unknown'}: ${e.message}`)
      .join('\n');
    return `${super.toString()}\nValidation errors:\n${errors}`;
  }
}

/**
 * Python exception wrapper
 *
 * Wraps exceptions thrown from Python code
 *
 * @class PythonError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new PythonError(
 *   'FileNotFoundError',
 *   'File not found: /path/to/file',
 *   'Traceback (most recent call last)...'
 * );
 */
export class PythonError extends SQLiteFrameworkError {
  /**
   * @param {string} pythonType - Python exception type
   * @param {string} message - Error message
   * @param {string} [traceback=''] - Python traceback
   */
  constructor(pythonType, message, traceback = '') {
    const recoverable = [
      'FileNotFoundError',
      'PermissionError',
      'ConnectionError',
      'TimeoutError'
    ].includes(pythonType);

    super(message, 'PYTHON_ERROR', /** @type {any} */({
      pythonType,
      traceback,
      recoverable,
      retryAfter: recoverable ? 1000 : undefined
    }));
    this.name = 'PythonError';
    this.pythonType = pythonType;
    this.traceback = traceback;
  }

  /**
   * Format error with traceback
   * @returns {string} Formatted error string
   */
  toString() {
    let str = `${super.toString()} (${this.pythonType})`;
    if (this.traceback) {
      str += `\nPython traceback:\n${this.traceback}`;
    }
    return str;
  }
}

/**
 * Circuit breaker open error
 *
 * Thrown when circuit breaker is open due to repeated failures
 *
 * @class CircuitBreakerError
 * @extends BridgeError
 *
 * @example
 * throw new CircuitBreakerError(Date.now() + 60000);
 */
export class CircuitBreakerError extends BridgeError {
  /**
   * @param {number} resetTime - Timestamp when circuit breaker will reset
   */
  constructor(resetTime) {
    const retryAfter = resetTime - Date.now();
    super('Circuit breaker open - too many failures', {
      resetTime,
      recoverable: true,
      retryAfter: Math.max(0, retryAfter)
    });
    this.name = 'CircuitBreakerError';
    this.resetTime = resetTime;
    this.retryAfter = retryAfter;
  }

  /**
   * Format error with reset time
   * @returns {string} Formatted error string
   */
  toString() {
    const seconds = Math.ceil(this.retryAfter / 1000);
    return `${super.toString()} (retry after ${seconds}s)`;
  }
}

/**
 * Cache error
 *
 * Thrown when cache operations fail
 *
 * @class CacheError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new CacheError('Cache write failed', { key: 'pattern:123' });
 */
export class CacheError extends SQLiteFrameworkError {
  constructor(message, details = {}) {
    super(message, 'CACHE_ERROR', {
      ...details,
      recoverable: true
    });
    this.name = 'CacheError';
  }
}

/**
 * Framework not found error
 *
 * Thrown when the SQLite Extensions Framework cannot be located
 *
 * @class FrameworkNotFoundError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new FrameworkNotFoundError('/path/to/framework');
 */
export class FrameworkNotFoundError extends SQLiteFrameworkError {
  /**
   * @param {string} frameworkPath - Attempted framework path
   */
  constructor(frameworkPath) {
    super(
      `SQLite Extensions Framework not found at: ${frameworkPath}`,
      'FRAMEWORK_NOT_FOUND',
      /** @type {any} */({ frameworkPath, recoverable: false })
    );
    this.name = 'FrameworkNotFoundError';
    this.frameworkPath = frameworkPath;
  }
}

/**
 * Method not found error
 *
 * Thrown when calling a non-existent Python method
 *
 * @class MethodNotFoundError
 * @extends SQLiteFrameworkError
 *
 * @example
 * throw new MethodNotFoundError('invalid.method.name');
 */
export class MethodNotFoundError extends SQLiteFrameworkError {
  /**
   * @param {string} method - Method name that was not found
   */
  constructor(method) {
    super(
      `Method not found: ${method}`,
      'METHOD_NOT_FOUND',
      /** @type {any} */({ method, recoverable: false })
    );
    this.name = 'MethodNotFoundError';
    this.method = method;
  }
}

/**
 * Parse error for JSON-RPC responses
 *
 * @class ParseError
 * @extends BridgeError
 *
 * @example
 * throw new ParseError('Invalid JSON response', '{invalid json');
 */
export class ParseError extends BridgeError {
  /**
   * @param {string} message - Error message
   * @param {string} rawData - Raw data that failed to parse
   */
  constructor(message, rawData) {
    super(message, { rawData, recoverable: false });
    this.name = 'ParseError';
    this.rawData = rawData;
  }
}

/**
 * Error factory for creating errors from JSON-RPC error responses
 *
 * @param {Object} errorResponse - JSON-RPC error response
 * @returns {SQLiteFrameworkError} Appropriate error instance
 *
 * @example
 * const error = createErrorFromResponse({
 *   code: -32603,
 *   message: 'Internal error',
 *   data: { pythonType: 'ValueError', traceback: '...' }
 * });
 */
export function createErrorFromResponse(errorResponse) {
  const { code, message, data = {} } = errorResponse;

  switch (code) {
    case -32700:
      return new ParseError(message, data.rawData);

    case -32600:
      return new ValidationError(message, data.validationErrors);

    case -32601:
      return new MethodNotFoundError(data.method || 'unknown');

    case -32602:
      return new ValidationError(`Invalid params: ${message}`, data.validationErrors);

    case -32603:
      if (data.pythonType) {
        return new PythonError(data.pythonType, message, data.traceback);
      }
      return new BridgeError(message, data);

    default:
      return new SQLiteFrameworkError(message, `ERROR_${code}`, data);
  }
}

/**
 * Check if an error is recoverable and should be retried
 *
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is recoverable
 *
 * @example
 * if (isRecoverableError(error)) {
 *   // Implement retry logic
 * }
 */
export function isRecoverableError(error) {
  if (error instanceof SQLiteFrameworkError) {
    return error.recoverable;
  }

  // Some Node.js errors are recoverable
  const recoverableNodeErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EHOSTUNREACH'
  ];

  const errorCode = /** @type {any} */(error).code;
  return errorCode && recoverableNodeErrors.includes(errorCode);
}

/**
 * Get retry delay for an error
 *
 * @param {Error} error - Error to check
 * @param {number} [defaultDelay=1000] - Default delay in milliseconds
 * @returns {number} Milliseconds to wait before retry
 *
 * @example
 * const delay = getRetryDelay(error);
 * await sleep(delay);
 * // Retry operation
 */
export function getRetryDelay(error, defaultDelay = 1000) {
  if (error instanceof SQLiteFrameworkError && error.details.retryAfter) {
    return error.details.retryAfter;
  }
  return defaultDelay;
}
