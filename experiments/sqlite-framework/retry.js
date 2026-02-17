/**
 * Retry Logic with Exponential and Linear Backoff
 *
 * Provides retry strategies for handling transient failures
 *
 * @module sdk/adapters/sqlite-framework/retry
 */

import { isRecoverableError, getRetryDelay } from './errors.js';

/**
 * Backoff strategies
 * @enum {string}
 */
export const BackoffStrategy = {
  EXPONENTIAL: 'exponential',
  LINEAR: 'linear'
};

/**
 * Calculate retry delay using exponential backoff
 *
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 *
 * @example
 * const delay = exponentialBackoff(2, 1000, 30000);
 * // Returns: 4000 (1000 * 2^2)
 */
export function exponentialBackoff(attempt, initialDelay = 1000, maxDelay = 30000) {
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate retry delay using linear backoff
 *
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 *
 * @example
 * const delay = linearBackoff(2, 1000, 30000);
 * // Returns: 3000 (1000 * (2 + 1))
 */
export function linearBackoff(attempt, initialDelay = 1000, maxDelay = 30000) {
  const delay = initialDelay * (attempt + 1);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate retry delay based on strategy
 *
 * @param {string} strategy - Backoff strategy ('exponential' or 'linear')
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 *
 * @example
 * const delay = calculateBackoff('exponential', 2, 1000, 30000);
 */
export function calculateBackoff(strategy, attempt, initialDelay, maxDelay) {
  switch (strategy) {
    case BackoffStrategy.EXPONENTIAL:
      return exponentialBackoff(attempt, initialDelay, maxDelay);
    case BackoffStrategy.LINEAR:
      return linearBackoff(attempt, initialDelay, maxDelay);
    default:
      return exponentialBackoff(attempt, initialDelay, maxDelay);
  }
}

/**
 * Sleep for a specified duration
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 *
 * @example
 * await sleep(1000); // Sleep for 1 second
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry configuration
 * @typedef {Object} RetryConfig
 * @property {number} maxAttempts - Maximum number of retry attempts
 * @property {string} backoffStrategy - Backoff strategy ('exponential' or 'linear')
 * @property {number} initialDelay - Initial delay in milliseconds
 * @property {number} maxDelay - Maximum delay in milliseconds
 * @property {Function} [shouldRetry] - Custom function to determine if error should be retried
 * @property {Function} [onRetry] - Callback invoked before each retry
 */

/**
 * Execute a function with retry logic
 *
 * @param {Function} fn - Async function to execute
 * @param {RetryConfig} config - Retry configuration
 * @returns {Promise<*>} Result of successful execution
 * @throws {Error} Last error if all retries fail
 *
 * @example
 * const result = await retry(
 *   async () => await apiCall(),
 *   {
 *     maxAttempts: 3,
 *     backoffStrategy: 'exponential',
 *     initialDelay: 1000,
 *     maxDelay: 10000,
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry ${attempt} after error:`, error.message);
 *     }
 *   }
 * );
 */
export async function retry(fn, config) {
  const {
    maxAttempts,
    backoffStrategy = BackoffStrategy.EXPONENTIAL,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = isRecoverableError,
    onRetry = null
  } = config;

  let lastError;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Execute function
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error)) {
        throw error;
      }

      // Check if we have attempts left
      if (attempt >= maxAttempts - 1) {
        throw error;
      }

      // Calculate delay
      let delay = calculateBackoff(backoffStrategy, attempt, initialDelay, maxDelay);

      // Check if error specifies a retry delay
      const errorDelay = getRetryDelay(error, null);
      if (errorDelay !== null) {
        delay = errorDelay;
      }

      // Invoke onRetry callback if provided
      if (onRetry) {
        try {
          onRetry(error, attempt + 1, delay);
        } catch (callbackError) {
          // Don't let callback errors break retry logic
          console.error('onRetry callback error:', callbackError);
        }
      }

      // Wait before retrying
      await sleep(delay);

      attempt++;
    }
  }

  // All retries failed
  throw lastError;
}

/**
 * Retry wrapper class with fluent API
 *
 * @class Retry
 *
 * @example
 * const result = await new Retry()
 *   .withMaxAttempts(5)
 *   .withExponentialBackoff(1000, 30000)
 *   .onRetry((error, attempt) => console.log(`Retry ${attempt}`))
 *   .execute(async () => await apiCall());
 */
export class Retry {
  constructor() {
    this.config = {
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 1000,
      maxDelay: 30000,
      shouldRetry: isRecoverableError,
      onRetry: null
    };
  }

  /**
   * Set maximum number of attempts
   * @param {number} attempts - Maximum attempts
   * @returns {Retry} this for chaining
   */
  withMaxAttempts(attempts) {
    this.config.maxAttempts = attempts;
    return this;
  }

  /**
   * Set exponential backoff strategy
   * @param {number} [initialDelay=1000] - Initial delay
   * @param {number} [maxDelay=30000] - Maximum delay
   * @returns {Retry} this for chaining
   */
  withExponentialBackoff(initialDelay = 1000, maxDelay = 30000) {
    this.config.backoffStrategy = BackoffStrategy.EXPONENTIAL;
    this.config.initialDelay = initialDelay;
    this.config.maxDelay = maxDelay;
    return this;
  }

  /**
   * Set linear backoff strategy
   * @param {number} [initialDelay=1000] - Initial delay
   * @param {number} [maxDelay=30000] - Maximum delay
   * @returns {Retry} this for chaining
   */
  withLinearBackoff(initialDelay = 1000, maxDelay = 30000) {
    this.config.backoffStrategy = BackoffStrategy.LINEAR;
    this.config.initialDelay = initialDelay;
    this.config.maxDelay = maxDelay;
    return this;
  }

  /**
   * Set custom shouldRetry function
   * @param {(error: Error) => boolean} fn - Function to determine if error should be retried
   * @returns {Retry} this for chaining
   */
  when(fn) {
    this.config.shouldRetry = fn;
    return this;
  }

  /**
   * Set onRetry callback
   * @param {Function} fn - Callback to invoke before each retry
   * @returns {Retry} this for chaining
   */
  onRetry(fn) {
    this.config.onRetry = fn;
    return this;
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} Result of successful execution
   */
  async execute(fn) {
    return retry(fn, this.config);
  }
}

/**
 * Create a retry wrapper for a function
 *
 * Returns a new function that wraps the original with retry logic
 *
 * @param {Function} fn - Function to wrap
 * @param {RetryConfig} config - Retry configuration
 * @returns {Function} Wrapped function with retry logic
 *
 * @example
 * const reliableApiCall = withRetry(
 *   async (url) => await fetch(url),
 *   { maxAttempts: 3, backoffStrategy: 'exponential' }
 * );
 *
 * const result = await reliableApiCall('https://api.example.com/data');
 */
export function withRetry(fn, config) {
  return async function(...args) {
    return retry(() => fn(...args), config);
  };
}
