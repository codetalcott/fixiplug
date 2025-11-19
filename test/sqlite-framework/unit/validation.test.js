/**
 * Unit tests for Validation layer
 */

import assert from 'node:assert';
import { Validator, validateParams, sanitizeParams } from '../../../sdk/adapters/sqlite-framework/validation.js';
import { ValidationError } from '../../../sdk/adapters/sqlite-framework/errors.js';

console.log('Running Validation tests...\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    failedTests++;
  }
}

// Test 1: Valid params pass validation
test('should pass validation for valid params', () => {
  const validator = new Validator();
  const result = validator.validate('getRecommendations', {
    domain: 'finance',
    minConfidence: 0.8
  });

  assert.strictEqual(result.domain, 'finance');
  assert.strictEqual(result.minConfidence, 0.8);
});

// Test 2: Required field missing
test('should fail validation for missing required field', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('findSimilarPatterns', {});
  }, ValidationError);
});

// Test 3: Invalid enum value
test('should fail validation for invalid enum value', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('getRecommendations', {
      domain: 'invalid_domain'
    });
  }, ValidationError);
});

// Test 4: String too short
test('should fail validation for string too short', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('findSimilarPatterns', {
      description: 'short'  // Minimum is 10 characters
    });
  }, ValidationError);
});

// Test 5: String too long
test('should fail validation for string too long', () => {
  const validator = new Validator();

  const longString = 'a'.repeat(10001);

  assert.throws(() => {
    validator.validate('analyzeRequirements', {
      description: longString  // Maximum is 10000 characters
    });
  }, ValidationError);
});

// Test 6: Number out of range (below minimum)
test('should fail validation for number below minimum', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('getRecommendations', {
      minConfidence: -0.1  // Minimum is 0
    });
  }, ValidationError);
});

// Test 7: Number out of range (above maximum)
test('should fail validation for number above maximum', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('getRecommendations', {
      minConfidence: 1.5  // Maximum is 1
    });
  }, ValidationError);
});

// Test 8: Type coercion (string to number)
test('should coerce string to number when enabled', () => {
  const validator = new Validator({ coerce: true });
  const result = validator.validate('getRecommendations', {
    minConfidence: '0.8'  // String
  });

  assert.strictEqual(typeof result.minConfidence, 'number');
  assert.strictEqual(result.minConfidence, 0.8);
});

// Test 9: No coercion when disabled
test('should not coerce when disabled', () => {
  const validator = new Validator({ coerce: false });

  assert.throws(() => {
    validator.validate('getRecommendations', {
      minConfidence: '0.8'  // String, should fail type check
    });
  }, ValidationError);
});

// Test 10: Apply default values
test('should apply default values', () => {
  const validator = new Validator({ coerce: true });
  const result = validator.validate('findSimilarPatterns', {
    description: 'Test description that is long enough'
  });

  // threshold has default 0.7
  assert.strictEqual(result.threshold, 0.7);
  // maxResults has default 10
  assert.strictEqual(result.maxResults, 10);
});

// Test 11: Additional properties not allowed
test('should fail for additional properties when not allowed', () => {
  const validator = new Validator();

  assert.throws(() => {
    validator.validate('getRecommendations', {
      domain: 'finance',
      unknownProperty: 'value'
    });
  }, ValidationError);
});

// Test 12: No schema in non-strict mode
test('should pass through params when no schema in non-strict mode', () => {
  const validator = new Validator({ strict: false });
  const result = validator.validate('unknownMethod', {
    anyParam: 'value'
  });

  assert.strictEqual(result.anyParam, 'value');
});

// Test 13: No schema in strict mode
test('should fail when no schema in strict mode', () => {
  const validator = new Validator({ strict: true });

  assert.throws(() => {
    validator.validate('unknownMethod', {});
  }, ValidationError);
});

// Test 14: Has schema check
test('should check if schema exists', () => {
  const validator = new Validator();

  assert.strictEqual(validator.hasSchema('getRecommendations'), true);
  assert.strictEqual(validator.hasSchema('unknownMethod'), false);
});

// Test 15: Get schema
test('should get schema for method', () => {
  const validator = new Validator();

  const schema = validator.getSchema('getRecommendations');
  assert(schema);
  assert.strictEqual(schema.type, 'object');

  assert.strictEqual(validator.getSchema('unknownMethod'), null);
});

// Test 16: Sanitize params - remove dangerous keys
test('should remove dangerous keys from params', () => {
  const params = {
    normalKey: 'value',
    __proto__: { polluted: true },
    constructor: { polluted: true },
    prototype: { polluted: true }
  };

  const sanitized = sanitizeParams(params);

  assert.strictEqual(sanitized.normalKey, 'value');
  // Check that dangerous keys are not present as own properties
  assert.strictEqual(Object.hasOwnProperty.call(sanitized, '__proto__'), false);
  assert.strictEqual(Object.hasOwnProperty.call(sanitized, 'constructor'), false);
  assert.strictEqual(Object.hasOwnProperty.call(sanitized, 'prototype'), false);
});

// Test 17: Sanitize nested objects
test('should sanitize nested objects', () => {
  const params = {
    outer: {
      __proto__: { polluted: true },
      safe: 'value'
    }
  };

  const sanitized = sanitizeParams(params);

  assert.strictEqual(sanitized.outer.safe, 'value');
  // Check that dangerous key is not present as own property in nested object
  assert.strictEqual(Object.hasOwnProperty.call(sanitized.outer, '__proto__'), false);
});

// Test 18: Sanitize arrays
test('should sanitize arrays of objects', () => {
  const params = {
    items: [
      { __proto__: { polluted: true }, safe: 'value1' },
      { safe: 'value2' }
    ]
  };

  const sanitized = sanitizeParams(params);

  assert.strictEqual(sanitized.items[0].safe, 'value1');
  // Check that dangerous key is not present as own property in array items
  assert.strictEqual(Object.hasOwnProperty.call(sanitized.items[0], '__proto__'), false);
  assert.strictEqual(sanitized.items[1].safe, 'value2');
});

// Test 19: Validate params convenience function
test('should use validateParams convenience function', () => {
  const result = validateParams('getRecommendations', {
    domain: 'finance'
  });

  assert.strictEqual(result.domain, 'finance');
});

// Test 20: Complex nested validation
test('should validate complex nested structures', () => {
  const validator = new Validator();
  const result = validator.validate('analyzeRequirements', {
    description: 'Test description for validation',
    performanceRequirements: {
      minOpsPerSec: 1000,
      maxLatency: 100
    }
  });

  assert.strictEqual(result.description, 'Test description for validation');
  assert.strictEqual(result.performanceRequirements.minOpsPerSec, 1000);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Validation Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
