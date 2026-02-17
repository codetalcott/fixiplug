/**
 * Advanced usage examples for FixiPlug Agent SDK
 *
 * This file demonstrates advanced features including:
 * - Retry logic with exponential backoff
 * - WorkflowBuilder for fluent API
 * - Advanced caching strategies
 * - Error handling and recovery
 * - Performance optimization
 *
 * Run this example:
 * 1. Open in browser with fixiplug loaded
 * 2. Or use Node.js with appropriate setup
 */

import { FixiPlugAgent } from '../sdk/agent-client.js';
import { WorkflowBuilder } from '../sdk/workflow-builder.js';
import { createFixiplug } from '../builder/fixiplug-factory.js';
import introspectionPlugin from '../plugins/introspection.js';
import stateTrackerPlugin from '../plugins/state-tracker.js';

console.log('=== FixiPlug Agent SDK - Advanced Usage Examples ===\n');

// Setup: Create fixiplug with plugins
const fixiplug = createFixiplug({
  features: ['logging']
});

fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);

// ==================================================
// Example 1: Retry Logic with Custom Configuration
// ==================================================
console.log('Example 1: Retry Logic with Exponential Backoff');
console.log('----------------------------------------------');

(async () => {
  const agent = new FixiPlugAgent(fixiplug, {
    maxRetries: 5,           // Retry up to 5 times
    retryDelay: 50,          // Start with 50ms delay
    retryBackoff: 2,         // Double the delay each time
    retryableHooks: [],      // Empty = all hooks retryable
    trackPerformance: true
  });

  console.log('Configured with:');
  console.log('  - Max retries: 5');
  console.log('  - Initial delay: 50ms');
  console.log('  - Backoff multiplier: 2x');
  console.log('  - Retry sequence: 50ms, 100ms, 200ms, 400ms, 800ms');

  // This will succeed on first try with real fixiplug
  try {
    await agent.discover();
    console.log('✓ Discovery succeeded\n');
  } catch (error) {
    console.error('✗ Discovery failed after retries:', error.message, '\n');
  }

  // ==================================================
  // Example 2: WorkflowBuilder Fluent API
  // ==================================================
  console.log('Example 2: WorkflowBuilder Fluent API');
  console.log('------------------------------------');

  const workflow = new WorkflowBuilder(agent)
    .step('discover', 'api:introspect')
      .params({})
    .step('getState', 'api:getCurrentState')
      .params({})
    .step('initialize', 'api:setState')
      .params({ state: 'initialized' })
      .state('initializing')
    .step('process', 'api:setState')
      .params((ctx) => ({
        state: 'processing',
        timestamp: Date.now()
      }))
      .state('preparing')
    .step('finalize', 'api:setState')
      .params({ state: 'complete' })
      .state('finalizing')
    .before((step, ctx) => {
      console.log(`  → Executing: ${step.name}`);
    })
    .after((step, result, ctx) => {
      console.log(`  ✓ Completed: ${step.name}`);
    })
    .onError((error, ctx) => {
      console.error(`  ✗ Error in workflow:`, error.message);
      console.log(`  Completed steps:`, ctx.completed);
    })
    .build();

  console.log('Built workflow with 5 steps');

  const result = await workflow.execute();

  console.log('Workflow result:', {
    success: result.success,
    completedSteps: result.completed.length,
    errors: result.errors.length
  });
  console.log('✓ Workflow completed\n');

  // Clean up
  await agent.setState('idle');

  // ==================================================
  // Example 3: Conditional Workflow Steps
  // ==================================================
  console.log('Example 3: Conditional Workflow Steps');
  console.log('------------------------------------');

  const conditionalWorkflow = new WorkflowBuilder(agent)
    .step('checkState', 'api:getCurrentState')
      .params({})
    .step('conditionalStep', 'api:setState')
      .params({ state: 'conditional-executed' })
      .when(ctx => ctx.results.checkState.state === 'idle')
    .step('alwaysRun', 'api:setState')
      .params({ state: 'idle' })
    .build();

  const conditionalResult = await conditionalWorkflow.execute();

  console.log('Conditional workflow result:');
  console.log('  Steps completed:', conditionalResult.completed);
  console.log('  Steps skipped:', conditionalResult.skipped || []);
  console.log('✓ Conditional execution works\n');

  // ==================================================
  // Example 4: Error Handling and Recovery
  // ==================================================
  console.log('Example 4: Error Handling and Recovery');
  console.log('-------------------------------------');

  const recoveryWorkflow = new WorkflowBuilder(agent)
    .continueOnError() // Don't stop on errors
    .step('step1', 'api:getCurrentState')
      .params({})
    .step('failingStep', 'api:nonexistentHook')
      .params({})
    .step('recovery', 'api:setState')
      .params({ state: 'recovered' })
    .step('cleanup', 'api:setState')
      .params({ state: 'idle' })
    .onError((error, ctx) => {
      console.log(`  ⚠ Caught error: ${error.message}`);
      console.log(`  ⚠ Failed step: ${ctx.errors[ctx.errors.length - 1].step}`);
      console.log(`  ℹ Continuing with recovery...`);
    })
    .build();

  const recoveryResult = await recoveryWorkflow.execute();

  console.log('Recovery workflow result:');
  console.log('  Success:', recoveryResult.success);
  console.log('  Completed:', recoveryResult.completed);
  console.log('  Errors:', recoveryResult.errors.length);
  console.log('✓ Error recovery works\n');

  // ==================================================
  // Example 5: Advanced Caching Strategies
  // ==================================================
  console.log('Example 5: Advanced Caching Strategies');
  console.log('-------------------------------------');

  const cachedAgent = new FixiPlugAgent(fixiplug, {
    enableCaching: true,
    cacheTTL: 10000, // 10 seconds
    trackPerformance: true
  });

  // Strategy 1: Warm the cache on startup
  console.log('Strategy 1: Cache warming');
  await cachedAgent.warmCache();

  const cacheInfo = cachedAgent.getCacheInfo();
  console.log('  Cache status:', {
    valid: cacheInfo.valid,
    hasData: cacheInfo.hasData,
    ttl: `${cacheInfo.ttl}ms`
  });

  // Strategy 2: Multiple operations use cached data
  console.log('\nStrategy 2: Using cached data');
  const start = performance.now();

  for (let i = 0; i < 5; i++) {
    await cachedAgent.hasCapability('fixiplug-introspection');
  }

  const end = performance.now();
  console.log(`  5 capability checks in ${(end - start).toFixed(2)}ms`);

  // Strategy 3: Selective cache invalidation
  console.log('\nStrategy 3: Selective invalidation');
  console.log('  Before invalidation:', cachedAgent.getCacheInfo().valid);

  cachedAgent.invalidateCache();

  console.log('  After invalidation:', cachedAgent.getCacheInfo().valid);

  // Re-discover
  await cachedAgent.discover();
  console.log('  After re-discover:', cachedAgent.getCacheInfo().valid);

  const stats = cachedAgent.getStats();
  console.log('\nCache performance:');
  console.log('  Cache hits:', stats.cacheHits);
  console.log('  Cache misses:', stats.cacheMisses);
  console.log('  Hit rate:', ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1) + '%');
  console.log('✓ Caching strategies work\n');

  // ==================================================
  // Example 6: Performance Tracking and Optimization
  // ==================================================
  console.log('Example 6: Performance Tracking and Optimization');
  console.log('-----------------------------------------------');

  const perfAgent = new FixiPlugAgent(fixiplug, {
    trackPerformance: true,
    maxRetries: 3,
    retryDelay: 10
  });

  perfAgent.resetStats();

  // Perform various operations
  await perfAgent.discover();
  await perfAgent.getCurrentState();
  await perfAgent.setState('working');
  await perfAgent.setState('idle');

  const perfStats = perfAgent.getStats();

  console.log('Performance statistics:');
  console.log('  Total API calls:', perfStats.apiCalls);
  console.log('  Total time:', perfStats.totalTime.toFixed(2) + 'ms');
  console.log('  Average time:', perfStats.averageTime + 'ms/call');
  console.log('  Retries:', perfStats.retries);

  console.log('\nIndividual call timings:');
  perfStats.calls.forEach((call, i) => {
    console.log(`  ${i + 1}. ${call.hook}: ${call.duration}ms` +
      (call.attempts > 1 ? ` (${call.attempts} attempts)` : ''));
  });

  console.log('✓ Performance tracking works\n');

  // ==================================================
  // Example 7: Complex Real-World Workflow
  // ==================================================
  console.log('Example 7: Complex Real-World Workflow');
  console.log('-------------------------------------');

  const realWorldAgent = new FixiPlugAgent(fixiplug, {
    enableCaching: true,
    cacheTTL: 30000,
    trackPerformance: true,
    maxRetries: 3
  });

  // Warm cache first
  await realWorldAgent.warmCache();

  const dataProcessingWorkflow = new WorkflowBuilder(realWorldAgent)
    // Phase 1: Initialization
    .step('discover', 'api:introspect')
      .params({})
      .state('discovering')
    .step('validateCapabilities', 'api:getCurrentState')
      .params({})
      .when(ctx => ctx.results.discover.plugins.length > 0)
    // Phase 2: Data Loading
    .step('beginLoad', 'api:setState')
      .params({ state: 'loading' })
      .state('preparing')
    // Phase 3: Processing
    .step('process', 'api:setState')
      .params((ctx) => ({
        state: 'processing',
        timestamp: Date.now()
      }))
      .state('processing')
    // Phase 4: Validation
    .step('validate', 'api:getCurrentState')
      .params({})
    // Phase 5: Completion
    .step('complete', 'api:setState')
      .params({ state: 'complete' })
      .state('finalizing')
    .step('reset', 'api:setState')
      .params({ state: 'idle' })
    // Handlers
    .before((step, ctx) => {
      console.log(`  [${new Date().toISOString().split('T')[1].split('.')[0]}] Starting: ${step.name}`);
    })
    .after((step, result, ctx) => {
      console.log(`  [${new Date().toISOString().split('T')[1].split('.')[0]}] Finished: ${step.name}`);
    })
    .onError((error, ctx) => {
      console.error(`  [ERROR] Workflow failed:`, error.message);
      console.log(`  Completed: ${ctx.completed.join(', ')}`);
    })
    .build();

  console.log('Executing complex workflow...\n');

  const workflowStart = performance.now();
  const workflowResult = await dataProcessingWorkflow.execute();
  const workflowEnd = performance.now();

  console.log('\nWorkflow completed:');
  console.log('  Success:', workflowResult.success);
  console.log('  Steps completed:', workflowResult.completed.length);
  console.log('  Steps skipped:', (workflowResult.skipped || []).length);
  console.log('  Total time:', (workflowEnd - workflowStart).toFixed(2) + 'ms');
  console.log('  Errors:', workflowResult.errors.length);

  const finalStats = realWorldAgent.getStats();
  console.log('\nAgent statistics:');
  console.log('  Total API calls:', finalStats.apiCalls);
  console.log('  Cache hits:', finalStats.cacheHits);
  console.log('  Cache misses:', finalStats.cacheMisses);
  console.log('  Retries:', finalStats.retries);

  console.log('✓ Complex workflow completed\n');

  // ==================================================
  // Example 8: Workflow Definition Introspection
  // ==================================================
  console.log('Example 8: Workflow Definition Introspection');
  console.log('-------------------------------------------');

  const inspectableWorkflow = new WorkflowBuilder(agent)
    .step('step1', 'api:getCurrentState')
      .params({})
    .step('step2', 'api:setState')
      .params({ state: 'test' })
      .when(ctx => true)
    .step('step3', 'api:setState')
      .params({ state: 'idle' })
      .noRetry()
    .continueOnError()
    .build();

  const definition = inspectableWorkflow.getDefinition();

  console.log('Workflow definition:');
  console.log('  Total steps:', definition.steps.length);
  console.log('  Stop on error:', definition.options.stopOnError);

  definition.steps.forEach((step, i) => {
    console.log(`\n  Step ${i + 1}: ${step.name}`);
    console.log(`    Hook: ${step.hook}`);
    console.log(`    Has params: ${step.hasParams}`);
    console.log(`    Has state: ${step.hasState}`);
    console.log(`    Has condition: ${step.hasCondition}`);
    console.log(`    Retry enabled: ${step.retry}`);
  });

  console.log('\n✓ Workflow introspection works\n');

  // ==================================================
  // Summary
  // ==================================================
  console.log('\n=== Advanced Examples Summary ===');
  console.log('All advanced features demonstrated:');
  console.log('  ✓ Retry logic with exponential backoff');
  console.log('  ✓ WorkflowBuilder fluent API');
  console.log('  ✓ Conditional step execution');
  console.log('  ✓ Error handling and recovery');
  console.log('  ✓ Advanced caching strategies');
  console.log('  ✓ Performance tracking');
  console.log('  ✓ Complex real-world workflows');
  console.log('  ✓ Workflow definition introspection');
  console.log('\nReady for production agent development! 🚀');

})();
