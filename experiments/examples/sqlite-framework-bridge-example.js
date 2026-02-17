/**
 * SQLite Framework Bridge - Usage Example
 *
 * Demonstrates how to use the bridge to communicate with
 * the SQLite Extensions Framework.
 */

import { createBridge, ConfigBuilder } from '../sdk/adapters/sqlite-framework/index.js';

/**
 * Example 1: Basic Usage
 */
async function basicUsage() {
  console.log('=== Example 1: Basic Usage ===\n');

  // Create and start bridge
  const bridge = await createBridge({
    frameworkPath: '/Users/williamtalcott/projects/sqlite-extensions-framework'
  });

  try {
    // Get pattern recommendations
    const result = await bridge.call(
      'pattern_learning.get_recommendations',
      {
        domain: 'finance',
        description: 'Portfolio risk analysis'
      }
    );

    console.log('Pattern Recommendations:');
    for (const pattern of result.data.recommendations) {
      console.log(`  - ${pattern.pattern_name} (confidence: ${pattern.confidence_score})`);
      console.log(`    Success rate: ${(pattern.success_rate * 100).toFixed(1)}%`);
      console.log(`    Avg performance: ${pattern.avg_performance_ms}ms\n`);
    }

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Example 2: Extension Generation
 */
async function extensionGeneration() {
  console.log('=== Example 2: Extension Generation ===\n');

  const bridge = await createBridge({
    frameworkPath: '/Users/williamtalcott/projects/sqlite-extensions-framework'
  });

  try {
    // Analyze requirements
    console.log('Analyzing requirements...');
    const analysis = await bridge.call(
      'extension_generator.analyze_requirements',
      {
        description: 'Real-time customer analytics with conversion tracking',
        domain: 'analytics'
      }
    );

    console.log('Analysis:');
    console.log(`  Domain: ${analysis.data.requirements.domain}`);
    console.log(`  Recommended backend: ${analysis.data.requirements.backend}`);
    console.log(`  Complexity: ${analysis.data.requirements.complexity}`);
    console.log(`  Confidence: ${(analysis.data.confidence * 100).toFixed(1)}%\n`);

    // Generate extension
    console.log('Generating extension...');
    const generation = await bridge.call(
      'extension_generator.generate',
      {
        description: 'Real-time customer analytics with conversion tracking',
        backend_language: 'mojo'
      },
      {
        timeout: 120000  // 2 minute timeout for generation
      }
    );

    if (generation.data.success) {
      console.log('Extension generated successfully!');
      console.log(`  Path: ${generation.data.extension_path}`);
      console.log(`  Backend: ${generation.data.backend}`);
      console.log(`  Files generated: ${generation.data.generated_files.length}`);
      console.log(`  Estimated performance: ${generation.data.performance.estimated_ops_per_sec} ops/sec\n`);
    }

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Example 3: Advanced Configuration
 */
async function advancedConfiguration() {
  console.log('=== Example 3: Advanced Configuration ===\n');

  // Build configuration with fluent API
  const config = new ConfigBuilder()
    .setFrameworkPath('/Users/williamtalcott/projects/sqlite-extensions-framework')
    .setMaxProcesses(8)              // Use 8 processes for high throughput
    .setRequestTimeout(60000)        // 60 second timeout
    .setRetry(5, 'exponential')      // 5 retries with exponential backoff
    .setCircuitBreaker(true, 10, 120000)  // Circuit breaker with threshold 10
    .enableDebug()                   // Enable debug mode
    .build();

  const bridge = await createBridge(config);

  try {
    // Make some calls
    for (let i = 0; i < 5; i++) {
      const result = await bridge.call(
        'pattern_learning.get_statistics',
        { domain: 'analytics' }
      );
      console.log(`Call ${i + 1}: ${result.data.total_patterns} patterns available`);
    }

    // Get statistics
    const stats = bridge.getStats();
    console.log('\nBridge Statistics:');
    console.log(`  Total calls: ${stats.totalCalls}`);
    console.log(`  Success rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  Avg latency: ${stats.averageLatency.toFixed(0)}ms`);
    console.log(`  P95 latency: ${stats.latency.p95}ms`);
    console.log(`  P99 latency: ${stats.latency.p99}ms`);
    console.log(`  Active processes: ${stats.processPool.processCount}`);

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Example 4: Error Handling
 */
async function errorHandling() {
  console.log('=== Example 4: Error Handling ===\n');

  const bridge = await createBridge({
    frameworkPath: '/Users/williamtalcott/projects/sqlite-extensions-framework'
  });

  try {
    // Set up event listeners
    bridge.on('retry', (info) => {
      console.log(`Retrying ${info.method} (attempt ${info.attempt}/${info.maxAttempts})`);
    });

    bridge.on('circuit-breaker-state-change', (info) => {
      console.log(`Circuit breaker: ${info.from} -> ${info.to}`);
    });

    // Try a call that might fail
    try {
      const result = await bridge.call(
        'pattern_learning.find_similar',
        {
          description: 'Complex geospatial queries',
          threshold: 0.8
        }
      );

      console.log('Found similar patterns:', result.data.similar_patterns.length);

    } catch (error) {
      console.error('Error:', error.name);
      console.error('Message:', error.message);

      if (error.recoverable) {
        console.log('Error is recoverable, could retry');
      }
    }

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Example 5: Monitoring and Metrics
 */
async function monitoringAndMetrics() {
  console.log('=== Example 5: Monitoring and Metrics ===\n');

  const bridge = await createBridge({
    frameworkPath: '/Users/williamtalcott/projects/sqlite-extensions-framework',
    enableMetrics: true
  });

  try {
    // Make various calls
    const calls = [
      { method: 'pattern_learning.get_recommendations', params: { domain: 'finance' } },
      { method: 'pattern_learning.get_recommendations', params: { domain: 'analytics' } },
      { method: 'pattern_learning.get_statistics', params: {} },
      { method: 'extension_generator.analyze_requirements', params: { description: 'Test' } }
    ];

    for (const call of calls) {
      await bridge.call(call.method, call.params);
    }

    // Get Prometheus metrics
    console.log('Prometheus Metrics:');
    console.log(bridge.getMetrics());

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Example 6: Agent Detection
 */
async function agentDetection() {
  console.log('=== Example 6: Agent Detection ===\n');

  const bridge = await createBridge({
    frameworkPath: '/Users/williamtalcott/projects/sqlite-extensions-framework'
  });

  try {
    // Detect agent type
    const result = await bridge.call('agent.detect_type', {});

    console.log('Agent Detection:');
    console.log(`  Type: ${result.data.agent_type}`);
    console.log(`  Capabilities: ${result.data.capabilities.join(', ')}`);
    console.log(`  Token budget: ${result.data.token_budget}`);
    console.log(`  Tier: ${result.data.tier}`);

  } finally {
    await bridge.shutdown();
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    // Check if framework path exists
    const frameworkPath = '/Users/williamtalcott/projects/sqlite-extensions-framework';

    // Run examples
    // await basicUsage();
    // await extensionGeneration();
    // await advancedConfiguration();
    // await errorHandling();
    // await monitoringAndMetrics();
    // await agentDetection();

    console.log('Note: Uncomment the example functions above to run them.');
    console.log('Make sure the SQLite Extensions Framework is installed at:');
    console.log(frameworkPath);

  } catch (error) {
    console.error('Example error:', error);
    process.exit(1);
  }
}

// Run examples
runExamples();
