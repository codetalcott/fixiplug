/**
 * Validation Layer for SQLite Framework Bridge
 *
 * Provides input/output validation using JSON schemas.
 * Lightweight implementation without external dependencies.
 *
 * @module sdk/adapters/sqlite-framework/validation
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ValidationError } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load JSON schema from file
 *
 * @param {string} schemaName - Schema file name
 * @returns {Object} Schema object
 * @private
 */
function loadSchema(schemaName) {
  const schemaPath = join(__dirname, 'schemas', schemaName);
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

// Load schemas
const patternLearningSchema = loadSchema('pattern-learning.schema.json');
const extensionGenerationSchema = loadSchema('extension-generation.schema.json');

/**
 * Schema registry mapping method names to schemas
 * @constant {Object}
 */
const SCHEMA_REGISTRY = {
  // Pattern Learning
  'getRecommendations': patternLearningSchema.definitions.getRecommendations,
  'findSimilarPatterns': patternLearningSchema.definitions.findSimilarPatterns,
  'getPatternStatistics': patternLearningSchema.definitions.getPatternStatistics,
  'recordPattern': patternLearningSchema.definitions.recordPattern,

  // Extension Generation
  'analyzeRequirements': extensionGenerationSchema.definitions.analyzeRequirements,
  'recommendPath': extensionGenerationSchema.definitions.recommendPath,
  'generateExtension': extensionGenerationSchema.definitions.generateExtension,
  'quickExtensionFromDescription': extensionGenerationSchema.definitions.quickExtensionFromDescription
};

/**
 * Validator class
 *
 * @class Validator
 *
 * @example
 * const validator = new Validator();
 * validator.validate('getRecommendations', { domain: 'finance' });
 */
export class Validator {
  /**
   * Create a validator
   * @param {Object} [options={}] - Validator options
   * @param {boolean} [options.strict=false] - Throw on unknown methods
   * @param {boolean} [options.coerce=true] - Coerce types when possible
   */
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.coerce = options.coerce !== false;
  }

  /**
   * Validate parameters against schema
   *
   * @param {string} method - Method name
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validated (and possibly coerced) parameters
   * @throws {ValidationError} If validation fails
   *
   * @example
   * const validated = validator.validate('getRecommendations', {
   *   domain: 'finance',
   *   minConfidence: 0.8
   * });
   */
  validate(method, params) {
    const schema = SCHEMA_REGISTRY[method];

    if (!schema) {
      if (this.strict) {
        throw new ValidationError(`No schema for method: ${method}`, [
          { field: 'method', message: 'Schema not found' }
        ]);
      }
      // No schema, return params as-is
      return params;
    }

    // Coerce params first if coercion is enabled (before validation)
    const paramsToValidate = this.coerce ? this._coerceObject(params, schema) : params;

    const errors = this._validateObject(paramsToValidate, schema, method);

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed for ${method}`, errors);
    }

    return paramsToValidate;
  }

  /**
   * Validate an object against a schema
   *
   * @param {Object} obj - Object to validate
   * @param {Object} schema - JSON schema
   * @param {string} path - Current path (for error messages)
   * @returns {Array<Object>} Array of validation errors
   * @private
   */
  _validateObject(obj, schema, path = '') {
    const errors = [];

    // Check type
    if (schema.type === 'object') {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        errors.push({
          field: path,
          message: `Expected object, got ${typeof obj}`
        });
        return errors;
      }

      // Check required properties
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in obj)) {
            errors.push({
              field: `${path}.${requiredProp}`,
              message: 'Required property missing'
            });
          }
        }
      }

      // Validate each property
      if (schema.properties) {
        for (const [key, value] of Object.entries(obj)) {
          const propSchema = schema.properties[key];

          if (!propSchema) {
            if (schema.additionalProperties === false) {
              errors.push({
                field: `${path}.${key}`,
                message: 'Additional property not allowed'
              });
            }
            continue;
          }

          const propErrors = this._validateValue(
            value,
            propSchema,
            `${path}.${key}`
          );
          errors.push(...propErrors);
        }
      }
    }

    return errors;
  }

  /**
   * Validate a value against a schema
   *
   * @param {*} value - Value to validate
   * @param {Object} schema - JSON schema for the value
   * @param {string} path - Current path (for error messages)
   * @returns {Array<Object>} Array of validation errors
   * @private
   */
  _validateValue(value, schema, path) {
    const errors = [];

    // Handle null/undefined
    if (value === null || value === undefined) {
      if (schema.required) {
        errors.push({
          field: path,
          message: 'Required value missing'
        });
      }
      return errors;
    }

    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      // Special handling for integer type (JSON Schema)
      if (schema.type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          errors.push({
            field: path,
            message: `Expected integer, got ${actualType}`
          });
          return errors;
        }
      } else if (actualType !== schema.type) {
        errors.push({
          field: path,
          message: `Expected ${schema.type}, got ${actualType}`
        });
        return errors;
      }
    }

    // String validations
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push({
          field: path,
          message: `Minimum length is ${schema.minLength}, got ${value.length}`
        });
      }

      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `Maximum length is ${schema.maxLength}, got ${value.length}`
        });
      }

      if (schema.enum && !schema.enum.includes(value)) {
        errors.push({
          field: path,
          message: `Must be one of: ${schema.enum.join(', ')}`
        });
      }

      if (schema.format === 'date-time') {
        if (isNaN(Date.parse(value))) {
          errors.push({
            field: path,
            message: 'Invalid date-time format'
          });
        }
      }
    }

    // Number validations
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        errors.push({
          field: path,
          message: 'Must be an integer'
        });
      }

      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: path,
          message: `Minimum value is ${schema.minimum}, got ${value}`
        });
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: path,
          message: `Maximum value is ${schema.maximum}, got ${value}`
        });
      }
    }

    // Object validation
    if (schema.type === 'object') {
      const objectErrors = this._validateObject(value, schema, path);
      errors.push(...objectErrors);
    }

    // Array validation
    if (schema.type === 'array') {
      if (schema.minItems && value.length < schema.minItems) {
        errors.push({
          field: path,
          message: `Minimum ${schema.minItems} items required`
        });
      }

      if (schema.maxItems && value.length > schema.maxItems) {
        errors.push({
          field: path,
          message: `Maximum ${schema.maxItems} items allowed`
        });
      }

      if (schema.items) {
        value.forEach((item, index) => {
          const itemErrors = this._validateValue(
            item,
            schema.items,
            `${path}[${index}]`
          );
          errors.push(...itemErrors);
        });
      }
    }

    return errors;
  }

  /**
   * Coerce object properties to match schema types
   *
   * @param {Object} obj - Object to coerce
   * @param {Object} schema - JSON schema
   * @returns {Object} Coerced object
   * @private
   */
  _coerceObject(obj, schema) {
    if (schema.type !== 'object' || !schema.properties) {
      return obj;
    }

    const coerced = { ...obj };

    for (const [key, value] of Object.entries(coerced)) {
      const propSchema = schema.properties[key];

      if (!propSchema) {
        continue;
      }

      coerced[key] = this._coerceValue(value, propSchema);
    }

    // Apply defaults
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (!(key in coerced) && propSchema.default !== undefined) {
          coerced[key] = propSchema.default;
        }
      }
    }

    return coerced;
  }

  /**
   * Coerce a value to match schema type
   *
   * @param {*} value - Value to coerce
   * @param {Object} schema - JSON schema for the value
   * @returns {*} Coerced value
   * @private
   */
  _coerceValue(value, schema) {
    if (value === null || value === undefined) {
      return schema.default !== undefined ? schema.default : value;
    }

    // Type coercion
    if (schema.type === 'number' && typeof value === 'string') {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }

    if (schema.type === 'integer' && typeof value === 'string') {
      const int = parseInt(value, 10);
      return isNaN(int) ? value : int;
    }

    if (schema.type === 'boolean' && typeof value === 'string') {
      return value === 'true';
    }

    if (schema.type === 'string' && typeof value === 'number') {
      return String(value);
    }

    if (schema.type === 'object') {
      return this._coerceObject(value, schema);
    }

    return value;
  }

  /**
   * Check if a method has validation schema
   *
   * @param {string} method - Method name
   * @returns {boolean} True if schema exists
   */
  hasSchema(method) {
    return method in SCHEMA_REGISTRY;
  }

  /**
   * Get schema for a method
   *
   * @param {string} method - Method name
   * @returns {Object|null} Schema or null if not found
   */
  getSchema(method) {
    return SCHEMA_REGISTRY[method] || null;
  }
}

/**
 * Create a validator instance
 *
 * @param {Object} [options] - Validator options
 * @returns {Validator} Validator instance
 *
 * @example
 * const validator = createValidator({ strict: true });
 */
export function createValidator(options) {
  return new Validator(options);
}

/**
 * Convenience function to validate parameters
 *
 * @param {string} method - Method name
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validated parameters
 * @throws {ValidationError} If validation fails
 *
 * @example
 * const validated = validateParams('getRecommendations', params);
 */
export function validateParams(method, params) {
  const validator = new Validator();
  return validator.validate(method, params);
}

/**
 * Sanitize input parameters
 *
 * Removes potentially dangerous properties and values
 *
 * @param {Object} params - Parameters to sanitize
 * @returns {Object} Sanitized parameters
 *
 * @example
 * const safe = sanitizeParams(userInput);
 */
export function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const sanitized = {};
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  for (const [key, value] of Object.entries(params)) {
    // Skip dangerous keys
    if (dangerousKeys.includes(key)) {
      continue;
    }

    // Recursively sanitize objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeParams(value);
    }
    // Sanitize arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' ? sanitizeParams(item) : item
      );
    }
    // Keep primitives
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
