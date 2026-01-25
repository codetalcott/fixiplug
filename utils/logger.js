/**
 * Shared debug logging utilities for plugins
 * @module utils/logger
 */

/**
 * Create a namespaced logger with debug flag support
 * @param {string} name - Logger namespace (usually plugin name)
 * @param {boolean} [debug=false] - Whether debug logging is enabled
 * @returns {Object} Logger object with log, warn, error, info methods
 *
 * @example
 * const logger = createLogger('DomDelegation', ctx.debug);
 * logger.log('Element initialized', { count: 5 });
 * logger.warn('Deprecated feature used');
 * logger.error('Critical failure', error);  // Always logs
 */
export function createLogger(name, debug = false) {
  const prefix = `[${name}]`;

  return {
    /**
     * Log debug message (only if debug is enabled)
     * @param {...*} args - Arguments to log
     */
    log(...args) {
      if (debug) {
        console.log(prefix, ...args);
      }
    },

    /**
     * Log info message (only if debug is enabled)
     * @param {...*} args - Arguments to log
     */
    info(...args) {
      if (debug) {
        console.info(prefix, ...args);
      }
    },

    /**
     * Log warning message (only if debug is enabled)
     * @param {...*} args - Arguments to log
     */
    warn(...args) {
      if (debug) {
        console.warn(prefix, ...args);
      }
    },

    /**
     * Log error message (always logs, regardless of debug flag)
     * @param {...*} args - Arguments to log
     */
    error(...args) {
      console.error(prefix, ...args);
    },

    /**
     * Log with a specific level (only if debug is enabled, except 'error')
     * @param {'log'|'info'|'warn'|'error'} level - Log level
     * @param {...*} args - Arguments to log
     */
    at(level, ...args) {
      if (level === 'error' || debug) {
        console[level](prefix, ...args);
      }
    },

    /**
     * Create a child logger with additional namespace
     * @param {string} childName - Child namespace
     * @returns {Object} Child logger
     *
     * @example
     * const cacheLogger = logger.child('Cache');
     * cacheLogger.log('Hit');  // [DomDelegation:Cache] Hit
     */
    child(childName) {
      return createLogger(`${name}:${childName}`, debug);
    },

    /**
     * Time an operation (only if debug is enabled)
     * @param {string} label - Operation label
     * @returns {Function} End function to call when operation completes
     *
     * @example
     * const end = logger.time('fetchData');
     * await fetchData();
     * end();  // [MyPlugin] fetchData: 123ms
     */
    time(label) {
      if (!debug) return () => {};
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        console.log(prefix, `${label}: ${duration.toFixed(2)}ms`);
      };
    }
  };
}

/**
 * No-op logger for when logging is disabled
 * Useful as a default to avoid null checks
 */
export const nullLogger = {
  log() {},
  info() {},
  warn() {},
  error() {},
  at() {},
  child() { return nullLogger; },
  time() { return () => {}; }
};
