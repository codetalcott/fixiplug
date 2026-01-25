/**
 * Shared response builder utilities for plugins
 * Provides consistent response formats across all plugins
 * @module utils/response
 */

/**
 * Response builders for consistent plugin responses
 */
export const Response = {
  /**
   * Create a success response
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} Success response with success: true
   *
   * @example
   * return Response.success({ skill: skillData, pluginName: 'myPlugin' });
   * // { success: true, skill: skillData, pluginName: 'myPlugin' }
   */
  success(data = {}) {
    return { success: true, ...data };
  },

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional error details
   * @returns {Object} Error response with success: false
   *
   * @example
   * return Response.error('Skill not found', { skillName: 'unknown' });
   * // { success: false, error: 'Skill not found', skillName: 'unknown' }
   */
  error(message, details = {}) {
    return { success: false, error: message, ...details };
  },

  /**
   * Create a response with timestamp
   * @param {Object} data - Response data
   * @returns {Object} Response with timestamp added
   *
   * @example
   * return Response.withTimestamp({ state: 'active', previous: 'idle' });
   * // { state: 'active', previous: 'idle', timestamp: 1706123456789 }
   */
  withTimestamp(data) {
    return { ...data, timestamp: Date.now() };
  },

  /**
   * Create a success response with timestamp
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} Success response with timestamp
   *
   * @example
   * return Response.successWithTimestamp({ transition: { from: 'idle', to: 'active' } });
   */
  successWithTimestamp(data = {}) {
    return { success: true, timestamp: Date.now(), ...data };
  },

  /**
   * Create a list response with count
   * @param {string} key - Key name for the list
   * @param {Array} items - The list of items
   * @param {Object} [extra={}] - Additional data
   * @returns {Object} Response with list and count
   *
   * @example
   * return Response.list('plugins', pluginArray);
   * // { success: true, plugins: [...], count: 5 }
   */
  list(key, items, extra = {}) {
    return {
      success: true,
      [key]: items,
      count: items.length,
      ...extra
    };
  },

  /**
   * Create a not found response
   * @param {string} itemType - Type of item not found
   * @param {string} identifier - Identifier that wasn't found
   * @returns {Object} Error response for not found
   *
   * @example
   * return Response.notFound('skill', 'my-skill');
   * // { success: false, error: 'skill not found', identifier: 'my-skill' }
   */
  notFound(itemType, identifier) {
    return {
      success: false,
      error: `${itemType} not found`,
      identifier
    };
  }
};

/**
 * Wrap a handler with automatic error catching and response formatting
 * @param {Function} handler - Async handler function
 * @returns {Function} Wrapped handler that catches errors
 *
 * @example
 * ctx.on('api:getData', wrapHandler(async (event) => {
 *   const data = await fetchData(event.id);
 *   return Response.success({ data });
 * }));
 */
export function wrapHandler(handler) {
  return async (event) => {
    try {
      return await handler(event);
    } catch (error) {
      console.error('Handler error:', error);
      return Response.error(error.message || 'Unknown error');
    }
  };
}
