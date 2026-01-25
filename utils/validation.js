/**
 * Shared parameter validation utilities for plugins
 * @module utils/validation
 */

/**
 * Validate that required parameters are present in an event object
 * @param {Object} event - The event object to validate
 * @param {...string} params - Parameter names that must be present
 * @returns {Object|null} Error object if validation fails, null if valid
 *
 * @example
 * const error = requireParams(event, 'pluginName', 'hookName');
 * if (error) return error;
 */
export function requireParams(event, ...params) {
  for (const param of params) {
    if (event[param] === undefined || event[param] === null) {
      return { error: `${param} parameter required` };
    }
  }
  return null;
}

/**
 * Validate that at least one of the specified parameters is present
 * @param {Object} event - The event object to validate
 * @param {...string} params - Parameter names (at least one must be present)
 * @returns {Object|null} Error object if validation fails, null if valid
 *
 * @example
 * const error = requireOneOf(event, 'id', 'name', 'slug');
 * if (error) return error;
 */
export function requireOneOf(event, ...params) {
  const hasOne = params.some(p => event[p] !== undefined && event[p] !== null);
  if (!hasOne) {
    return { error: `One of [${params.join(', ')}] is required` };
  }
  return null;
}

/**
 * Validate that a parameter is of a specific type
 * @param {Object} event - The event object to validate
 * @param {string} param - Parameter name
 * @param {string} expectedType - Expected type ('string', 'number', 'boolean', 'object', 'array')
 * @returns {Object|null} Error object if validation fails, null if valid
 *
 * @example
 * const error = requireType(event, 'count', 'number');
 * if (error) return error;
 */
export function requireType(event, param, expectedType) {
  const value = event[param];
  if (value === undefined || value === null) {
    return null; // Let requireParams handle missing values
  }

  let actualType = typeof value;
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return { error: `${param} must be an array` };
    }
    return null;
  }

  if (actualType !== expectedType) {
    return { error: `${param} must be a ${expectedType}` };
  }
  return null;
}

/**
 * Validate multiple parameters with a schema
 * @param {Object} event - The event object to validate
 * @param {Object} schema - Validation schema { paramName: { required: boolean, type: string } }
 * @returns {Object|null} Error object if validation fails, null if valid
 *
 * @example
 * const error = validateSchema(event, {
 *   pluginName: { required: true, type: 'string' },
 *   options: { required: false, type: 'object' }
 * });
 * if (error) return error;
 */
export function validateSchema(event, schema) {
  for (const [param, rules] of Object.entries(schema)) {
    if (rules.required) {
      const reqError = requireParams(event, param);
      if (reqError) return reqError;
    }

    if (rules.type && event[param] !== undefined && event[param] !== null) {
      const typeError = requireType(event, param, rules.type);
      if (typeError) return typeError;
    }
  }
  return null;
}
