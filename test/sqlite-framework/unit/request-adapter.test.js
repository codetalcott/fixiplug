/**
 * Unit tests for RequestAdapter
 */

import assert from 'node:assert';
import { RequestAdapter } from '../../../sdk/adapters/sqlite-framework/request-adapter.js';

console.log('Running RequestAdapter tests...\n');

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

// Test 1: Basic method mapping
test('should map FixiPlug method to Python method', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('getRecommendations', {});

  assert.strictEqual(
    result.method,
    '.claude_code.extension_pattern_learning.get_recommendations'
  );
});

// Test 2: Parameter transformation
test('should transform camelCase params to snake_case', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('getRecommendations', {
    domain: 'finance',
    minConfidence: 0.8,
    maxResults: 10
  });

  assert.deepStrictEqual(result.params, {
    domain: 'finance',
    min_confidence: 0.8,
    max_results: 10
  });
});

// Test 3: Nested object transformation
test('should transform nested object keys', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('analyzeRequirements', {
    description: 'test',
    performanceRequirements: {
      minOpsPerSec: 1000,
      maxLatency: 100
    }
  });

  assert.deepStrictEqual(result.params.performance_requirements, {
    min_ops_per_sec: 1000,
    max_latency: 100
  });
});

// Test 4: Array transformation
test('should transform values in arrays', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('test', {
    items: [
      { itemName: 'test1' },
      { itemName: 'test2' }
    ]
  });

  assert.strictEqual(result.params.items[0].item_name, 'test1');
  assert.strictEqual(result.params.items[1].item_name, 'test2');
});

// Test 5: Pass-through for Python method paths
test('should pass through Python method paths unchanged', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('src.module.method', { param: 'value' });

  assert.strictEqual(result.method, 'src.module.method');
});

// Test 6: Unknown method in non-strict mode
test('should return unknown method as-is in non-strict mode', () => {
  const adapter = new RequestAdapter({ strict: false });
  const result = adapter.adapt('unknownMethod', {});

  assert.strictEqual(result.method, 'unknownMethod');
});

// Test 7: Unknown method in strict mode
test('should throw for unknown method in strict mode', () => {
  const adapter = new RequestAdapter({ strict: true });

  assert.throws(() => {
    adapter.adapt('unknownMethod', {});
  }, /Unknown method/);
});

// Test 8: Batch adaptation
test('should batch adapt multiple requests', () => {
  const adapter = new RequestAdapter();
  const results = adapter.batchAdapt([
    { method: 'getRecommendations', params: { domain: 'finance' } },
    { method: 'getPatternStatistics', params: {} }
  ]);

  assert.strictEqual(results.length, 2);
  assert.strictEqual(
    results[0].method,
    '.claude_code.extension_pattern_learning.get_recommendations'
  );
});

// Test 9: Check if method is supported
test('should check if method is supported', () => {
  const adapter = new RequestAdapter();

  assert.strictEqual(adapter.isSupported('getRecommendations'), true);
  assert.strictEqual(adapter.isSupported('unknownMethod'), false);
  assert.strictEqual(adapter.isSupported('src.module.method'), true); // Has dots
});

// Test 10: Get Python method path
test('should get Python method path', () => {
  const adapter = new RequestAdapter();

  const path = adapter.getPythonMethod('generateExtension');
  assert.strictEqual(
    path,
    'src.generator.llm_agent_interface.generate_extension'
  );

  assert.strictEqual(adapter.getPythonMethod('unknownMethod'), null);
});

// Test 11: Get supported methods
test('should get list of supported methods', () => {
  const adapter = new RequestAdapter();
  const methods = adapter.getSupportedMethods();

  assert(Array.isArray(methods));
  assert(methods.length > 0);
  assert(methods.includes('getRecommendations'));
  assert(methods.includes('generateExtension'));
});

// Test 12: Empty params
test('should handle empty params', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('getRecommendations', {});

  assert.deepStrictEqual(result.params, {});
});

// Test 13: Null/undefined values
test('should preserve null/undefined values', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('test', {
    nullValue: null,
    undefinedValue: undefined
  });

  assert.strictEqual(result.params.null_value, null);
  assert.strictEqual(result.params.undefined_value, undefined);
});

// Test 14: Boolean values
test('should preserve boolean values', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('generateExtension', {
    includeTests: true,
    includeDocumentation: false
  });

  assert.strictEqual(result.params.include_tests, true);
  assert.strictEqual(result.params.include_documentation, false);
});

// Test 15: Number values
test('should preserve number values', () => {
  const adapter = new RequestAdapter();
  const result = adapter.adapt('test', {
    intValue: 42,
    floatValue: 3.14,
    negativeValue: -10
  });

  assert.strictEqual(result.params.int_value, 42);
  assert.strictEqual(result.params.float_value, 3.14);
  assert.strictEqual(result.params.negative_value, -10);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Request Adapter Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
