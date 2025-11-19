/**
 * JSON-RPC 2.0 Protocol Handler
 *
 * Implements JSON-RPC 2.0 specification for communication with Python bridge.
 * Handles request/response serialization, validation, and correlation.
 *
 * Specification: https://www.jsonrpc.org/specification
 *
 * @module sdk/adapters/sqlite-framework/protocol
 */

import { randomUUID } from 'node:crypto';
import {
  ValidationError,
  ParseError,
  createErrorFromResponse
} from './errors.js';

/**
 * JSON-RPC 2.0 version constant
 * @constant {string}
 */
const JSONRPC_VERSION = '2.0';

/**
 * JSON-RPC error codes
 * @enum {number}
 */
export const ErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Application-defined errors (-32000 to -32099)
  SERVER_ERROR: -32000,
  TIMEOUT_ERROR: -32001,
  CIRCUIT_BREAKER_OPEN: -32002
};

/**
 * Request priority levels
 * @enum {string}
 */
export const Priority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
};

/**
 * Create a JSON-RPC 2.0 request
 *
 * @param {string} method - Method name to call
 * @param {Object} [params={}] - Method parameters
 * @param {Object} [metadata={}] - Request metadata
 * @param {number} [metadata.timeout] - Request timeout in milliseconds
 * @param {string} [metadata.cacheKey] - Optional cache key
 * @param {string} [metadata.priority='normal'] - Request priority
 * @returns {Object} JSON-RPC 2.0 request object
 *
 * @example
 * const request = createRequest('src.generator.llm_agent_interface.analyze_requirements', {
 *   description: 'Calculate portfolio risk',
 *   domain: 'finance'
 * }, {
 *   timeout: 30000,
 *   priority: 'high'
 * });
 */
export function createRequest(method, params = {}, metadata = {}) {
  // Validate method name
  if (typeof method !== 'string' || method.length === 0) {
    throw new ValidationError('Method must be a non-empty string', [
      { field: 'method', message: 'required non-empty string' }
    ]);
  }

  // Validate params
  if (params !== null && typeof params !== 'object') {
    throw new ValidationError('Params must be an object or null', [
      { field: 'params', message: 'must be object or null' }
    ]);
  }

  // Generate unique request ID
  const id = randomUUID();

  // Construct request
  const request = {
    jsonrpc: JSONRPC_VERSION,
    id,
    method,
    params: params || {}
  };

  // Add metadata if provided
  if (Object.keys(metadata).length > 0) {
    request.metadata = {
      timeout: metadata.timeout,
      cacheKey: metadata.cacheKey,
      priority: metadata.priority || Priority.NORMAL,
      requestTime: Date.now()
    };
  }

  return request;
}

/**
 * Create a JSON-RPC 2.0 success response
 *
 * @param {string} id - Request ID
 * @param {*} result - Result data
 * @param {Object} [metadata={}] - Response metadata
 * @param {number} [metadata.executionTime] - Execution time in milliseconds
 * @param {boolean} [metadata.cached=false] - Whether result was cached
 * @param {string} [metadata.version] - Framework version
 * @returns {Object} JSON-RPC 2.0 success response
 *
 * @example
 * const response = createSuccessResponse(
 *   'uuid-123',
 *   { patterns: [...] },
 *   { executionTime: 150, cached: false }
 * );
 */
export function createSuccessResponse(id, result, metadata = {}) {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    result: {
      data: result,
      metadata: {
        executionTime: metadata.executionTime,
        cached: metadata.cached || false,
        version: metadata.version,
        responseTime: Date.now()
      }
    }
  };
}

/**
 * Create a JSON-RPC 2.0 error response
 *
 * @param {string} id - Request ID
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {Object} [data={}] - Additional error data
 * @returns {Object} JSON-RPC 2.0 error response
 *
 * @example
 * const response = createErrorResponse(
 *   'uuid-123',
 *   ErrorCode.INVALID_PARAMS,
 *   'Invalid domain parameter',
 *   { validationErrors: [...] }
 * );
 */
export function createErrorResponse(id, code, message, data = {}) {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: {
      code,
      message,
      data: {
        ...data,
        errorTime: Date.now()
      }
    }
  };
}

/**
 * Validate a JSON-RPC 2.0 request
 *
 * @param {Object} request - Request object to validate
 * @throws {ValidationError} If request is invalid
 * @returns {void}
 *
 * @example
 * validateRequest(request);
 */
export function validateRequest(request) {
  const errors = [];

  // Check jsonrpc version
  if (request.jsonrpc !== JSONRPC_VERSION) {
    errors.push({
      field: 'jsonrpc',
      message: `must be "${JSONRPC_VERSION}"`
    });
  }

  // Check id
  if (!request.id || typeof request.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'must be a non-empty string'
    });
  }

  // Check method
  if (!request.method || typeof request.method !== 'string') {
    errors.push({
      field: 'method',
      message: 'must be a non-empty string'
    });
  }

  // Check params (optional, but must be object if present)
  if (request.params !== undefined) {
    if (request.params !== null && typeof request.params !== 'object') {
      errors.push({
        field: 'params',
        message: 'must be an object or null'
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid JSON-RPC request', errors);
  }
}

/**
 * Validate a JSON-RPC 2.0 response
 *
 * @param {Object} response - Response object to validate
 * @throws {ValidationError} If response is invalid
 * @returns {void}
 *
 * @example
 * validateResponse(response);
 */
export function validateResponse(response) {
  const errors = [];

  // Check jsonrpc version
  if (response.jsonrpc !== JSONRPC_VERSION) {
    errors.push({
      field: 'jsonrpc',
      message: `must be "${JSONRPC_VERSION}"`
    });
  }

  // Check id
  if (!response.id || typeof response.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'must be a non-empty string'
    });
  }

  // Must have either result or error (but not both)
  const hasResult = 'result' in response;
  const hasError = 'error' in response;

  if (!hasResult && !hasError) {
    errors.push({
      field: 'result/error',
      message: 'must have either result or error'
    });
  }

  if (hasResult && hasError) {
    errors.push({
      field: 'result/error',
      message: 'cannot have both result and error'
    });
  }

  // Validate error structure if present
  if (hasError) {
    const error = response.error;
    if (typeof error !== 'object' || error === null) {
      errors.push({
        field: 'error',
        message: 'must be an object'
      });
    } else {
      if (typeof error.code !== 'number') {
        errors.push({
          field: 'error.code',
          message: 'must be a number'
        });
      }
      if (typeof error.message !== 'string') {
        errors.push({
          field: 'error.message',
          message: 'must be a string'
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid JSON-RPC response', errors);
  }
}

/**
 * Serialize a request to JSON string
 *
 * @param {Object} request - Request object
 * @returns {string} JSON string
 * @throws {ParseError} If serialization fails
 *
 * @example
 * const json = serializeRequest(request);
 */
export function serializeRequest(request) {
  try {
    validateRequest(request);
    return JSON.stringify(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ParseError('Failed to serialize request', error.message);
  }
}

/**
 * Parse a response from JSON string
 *
 * @param {string} json - JSON string
 * @returns {Object} Parsed response object
 * @throws {ParseError} If parsing fails
 *
 * @example
 * const response = parseResponse(jsonString);
 */
export function parseResponse(json) {
  try {
    const response = JSON.parse(json);
    validateResponse(response);
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ParseError('Invalid JSON', json);
    }
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ParseError('Failed to parse response', error.message);
  }
}

/**
 * Extract result from a success response
 *
 * @param {Object} response - Response object
 * @returns {*} Result data
 * @throws {Error} If response contains an error
 *
 * @example
 * const result = extractResult(response);
 */
export function extractResult(response) {
  validateResponse(response);

  if (response.error) {
    throw createErrorFromResponse(response.error);
  }

  return response.result;
}

/**
 * Check if a response is an error response
 *
 * @param {Object} response - Response object
 * @returns {boolean} True if response contains an error
 *
 * @example
 * if (isErrorResponse(response)) {
 *   // Handle error
 * }
 */
export function isErrorResponse(response) {
  return 'error' in response;
}

/**
 * Request/Response correlation tracker
 *
 * Tracks pending requests and matches responses by ID
 *
 * @class CorrelationTracker
 *
 * @example
 * const tracker = new CorrelationTracker();
 * tracker.registerRequest(request.id, request, callback);
 * // Later when response arrives...
 * tracker.handleResponse(response);
 */
export class CorrelationTracker {
  constructor() {
    /** @type {Map<string, Object>} */
    this.pending = new Map();
  }

  /**
   * Register a pending request
   *
   * @param {string} id - Request ID
   * @param {Object} request - Request object
   * @param {Function} callback - Callback to invoke when response arrives
   * @param {number} [timeout] - Optional timeout in milliseconds
   */
  registerRequest(id, request, callback, timeout) {
    const entry = {
      request,
      callback,
      timestamp: Date.now()
    };

    // Set timeout if provided
    if (timeout) {
      entry.timeoutHandle = setTimeout(() => {
        this.timeout(id, timeout);
      }, timeout);
    }

    this.pending.set(id, entry);
  }

  /**
   * Handle a response and invoke its callback
   *
   * @param {Object} response - Response object
   * @returns {boolean} True if request was found
   */
  handleResponse(response) {
    const entry = this.pending.get(response.id);

    if (!entry) {
      return false;
    }

    // Clear timeout if set
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
    }

    // Remove from pending
    this.pending.delete(response.id);

    // Invoke callback
    try {
      if (isErrorResponse(response)) {
        const error = createErrorFromResponse(response.error);
        entry.callback(error, null);
      } else {
        entry.callback(null, response.result);
      }
    } catch (error) {
      // Callback threw - log but don't crash
      console.error('Callback error:', error);
    }

    return true;
  }

  /**
   * Handle a timeout for a pending request
   *
   * @param {string} id - Request ID
   * @param {number} timeoutMs - Timeout duration
   */
  timeout(id, timeoutMs) {
    const entry = this.pending.get(id);

    if (!entry) {
      return;
    }

    // Remove from pending
    this.pending.delete(id);

    // Create timeout error
    const error = createErrorFromResponse({
      code: ErrorCode.TIMEOUT_ERROR,
      message: `Request timed out after ${timeoutMs}ms`,
      data: {
        timeoutMs,
        method: entry.request.method,
        recoverable: true,
        retryAfter: 1000
      }
    });

    // Invoke callback with error
    try {
      entry.callback(error, null);
    } catch (err) {
      console.error('Callback error:', err);
    }
  }

  /**
   * Cancel a pending request
   *
   * @param {string} id - Request ID
   * @returns {boolean} True if request was found and cancelled
   */
  cancel(id) {
    const entry = this.pending.get(id);

    if (!entry) {
      return false;
    }

    // Clear timeout if set
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
    }

    // Remove from pending
    this.pending.delete(id);

    return true;
  }

  /**
   * Get count of pending requests
   *
   * @returns {number} Number of pending requests
   */
  getPendingCount() {
    return this.pending.size;
  }

  /**
   * Get all pending request IDs
   *
   * @returns {string[]} Array of pending request IDs
   */
  getPendingIds() {
    return Array.from(this.pending.keys());
  }

  /**
   * Cancel all pending requests
   */
  cancelAll() {
    for (const [id, entry] of this.pending.entries()) {
      if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
      }
    }
    this.pending.clear();
  }

  /**
   * Get pending request info
   *
   * @param {string} id - Request ID
   * @returns {Object|null} Request info or null if not found
   */
  getRequestInfo(id) {
    const entry = this.pending.get(id);
    if (!entry) {
      return null;
    }

    return {
      method: entry.request.method,
      params: entry.request.params,
      timestamp: entry.timestamp,
      age: Date.now() - entry.timestamp
    };
  }
}
