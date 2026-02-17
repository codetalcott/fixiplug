/**
 * Unit tests for ResponseAdapter
 */

import assert from 'node:assert';
import { ResponseAdapter } from '../../../sdk/adapters/sqlite-framework/response-adapter.js';

console.log('Running ResponseAdapter tests...\n');

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

// Test 1: Transform snake_case to camelCase
test('should transform snake_case keys to camelCase', () => {
  const adapter = new ResponseAdapter();
  const result = adapter.adapt('test', {
    data: {
      simple_key: 'value',
      another_key: 'value2'
    }
  });

  assert.strictEqual(result.simpleKey, 'value');
  assert.strictEqual(result.anotherKey, 'value2');
});

// Test 2: Adapt recommendations response
test('should adapt recommendations response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      recommendations: [
        {
          pattern_name: 'finance_pattern',
          confidence_score: 0.95,
          domain: 'finance',
          success_rate: 0.92,
          avg_performance_ms: 150,
          usage_count: 42,
          description: 'Test pattern',
          anti_patterns: ['avoid_blocking']
        }
      ],
      total_patterns: 1,
      execution_time_ms: 50
    },
    metadata: {
      execution_time: 50,
      cached: false
    }
  };

  const result = adapter.adapt('getRecommendations', pythonResponse);

  assert.strictEqual(result.recommendations.length, 1);
  assert.strictEqual(result.recommendations[0].pattern, 'finance_pattern');
  assert.strictEqual(result.recommendations[0].confidence, 0.95);
  assert.strictEqual(result.recommendations[0].successRate, 0.92);
  assert.strictEqual(result.recommendations[0].avgPerformance, 150);
  assert.strictEqual(result.totalPatterns, 1);
});

// Test 3: Adapt similar patterns response
test('should adapt similar patterns response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      similar_patterns: [
        {
          pattern_name: 'pattern1',
          similarity_score: 0.89,
          description: 'Similar pattern'
        }
      ]
    }
  };

  const result = adapter.adapt('findSimilarPatterns', pythonResponse);

  assert.strictEqual(result.patterns.length, 1);
  assert.strictEqual(result.patterns[0].pattern, 'pattern1');
  assert.strictEqual(result.patterns[0].similarity, 0.89);
});

// Test 4: Adapt pattern statistics response
test('should adapt pattern statistics response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      total_patterns: 156,
      domains: {
        finance: 42,
        analytics: 38
      },
      avg_success_rate: 0.91,
      total_usage: 1243
    }
  };

  const result = adapter.adapt('getPatternStatistics', pythonResponse);

  assert.strictEqual(result.totalPatterns, 156);
  assert.strictEqual(result.domains.finance, 42);
  assert.strictEqual(result.avgSuccessRate, 0.91);
});

// Test 5: Adapt requirements analysis response
test('should adapt requirements analysis response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      requirements: {
        domain: 'analytics',
        backend: 'python',
        complexity: 'medium',
        estimated_time: '2-5 minutes'
      },
      recommended_path: 'advanced_yaml',
      confidence: 0.88
    }
  };

  const result = adapter.adapt('analyzeRequirements', pythonResponse);

  assert.strictEqual(result.requirements.domain, 'analytics');
  assert.strictEqual(result.requirements.estimatedTime, '2-5 minutes');
  assert.strictEqual(result.recommendedPath, 'advanced_yaml');
});

// Test 6: Adapt extension generation response
test('should adapt extension generation response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      success: true,
      extension_path: '/path/to/extension',
      backend: 'mojo',
      generated_files: ['ext.mojo', 'test.mojo'],
      test_suite: 'test.mojo',
      performance: {
        estimated_ops_per_sec: 350000,
        memory_usage: 1024
      }
    }
  };

  const result = adapter.adapt('generateExtension', pythonResponse);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.extensionPath, '/path/to/extension');
  assert.strictEqual(result.performance.estimatedOpsPerSec, 350000);
  assert.strictEqual(result.performance.memoryUsage, 1024);
});

// Test 7: Adapt agent detection response
test('should adapt agent detection response', () => {
  const adapter = new ResponseAdapter();
  const pythonResponse = {
    data: {
      agent_type: 'claude_code',
      capabilities: ['rich_feedback', 'code_generation'],
      token_budget: 5000,
      tier: 'development'
    }
  };

  const result = adapter.adapt('detectAgentType', pythonResponse);

  assert.strictEqual(result.agentType, 'claude_code');
  assert.strictEqual(result.capabilities.length, 2);
  assert.strictEqual(result.tokenBudget, 5000);
});

// Test 8: Preserve metadata
test('should preserve metadata when enabled', () => {
  const adapter = new ResponseAdapter({ preserveMetadata: true });
  const result = adapter.adapt('test', {
    data: { key: 'value' },
    metadata: {
      execution_time: 150,
      cached: true,
      version: '1.0.0'
    }
  });

  assert(result._metadata);
  assert.strictEqual(result._metadata.executionTime, 150);
  assert.strictEqual(result._metadata.cached, true);
  assert.strictEqual(result._metadata.version, '1.0.0');
});

// Test 9: Omit metadata when disabled
test('should omit metadata when disabled', () => {
  const adapter = new ResponseAdapter({ preserveMetadata: false });
  const result = adapter.adapt('test', {
    data: { key: 'value' },
    metadata: { execution_time: 150 }
  });

  assert.strictEqual(result._metadata, undefined);
});

// Test 10: Handle nested objects
test('should handle nested objects', () => {
  const adapter = new ResponseAdapter();
  const result = adapter.adapt('test', {
    data: {
      outer_key: {
        inner_key: {
          deep_key: 'value'
        }
      }
    }
  });

  assert.strictEqual(result.outerKey.innerKey.deepKey, 'value');
});

// Test 11: Handle arrays
test('should handle arrays', () => {
  const adapter = new ResponseAdapter();
  const result = adapter.adapt('test', {
    data: {
      items: [
        { item_name: 'item1' },
        { item_name: 'item2' }
      ]
    }
  });

  assert.strictEqual(result.items[0].itemName, 'item1');
  assert.strictEqual(result.items[1].itemName, 'item2');
});

// Test 12: Batch adaptation
test('should batch adapt multiple responses', () => {
  const adapter = new ResponseAdapter();
  const results = adapter.batchAdapt([
    {
      method: 'getRecommendations',
      response: {
        data: {
          recommendations: [],
          total_patterns: 0
        }
      }
    },
    {
      method: 'getPatternStatistics',
      response: {
        data: {
          total_patterns: 100
        }
      }
    }
  ]);

  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].totalPatterns, 0);
  assert.strictEqual(results[1].totalPatterns, 100);
});

// Test 13: Extract data only
test('should extract data only', () => {
  const adapter = new ResponseAdapter();
  const data = adapter.extractData({
    data: { key: 'value' },
    metadata: { execution_time: 100 }
  });

  assert.deepStrictEqual(data, { key: 'value' });
});

// Test 14: Extract metadata only
test('should extract metadata only', () => {
  const adapter = new ResponseAdapter();
  const metadata = adapter.extractMetadata({
    data: { key: 'value' },
    metadata: {
      execution_time: 100,
      cached: true
    }
  });

  assert.strictEqual(metadata.executionTime, 100);
  assert.strictEqual(metadata.cached, true);
});

// Test 15: Handle null/undefined values
test('should handle null/undefined values', () => {
  const adapter = new ResponseAdapter();
  const result = adapter.adapt('test', {
    data: {
      null_value: null,
      undefined_value: undefined
    }
  });

  assert.strictEqual(result.nullValue, null);
  assert.strictEqual(result.undefinedValue, undefined);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Response Adapter Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
