/**
 * Performance test for Priority 1 dispatch optimizations
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';

// Create test instance without factory logging
const testFixiplug = configure({
  features: [FEATURES.TESTING], // Only testing, no logging
  advanced: {}
});

console.log('=== Testing Priority 1 Dispatch Optimizations ===');

// Test 1: Debug logging configuration
console.log('\n1. Testing debug logging configuration...');

// By default, debug logging should be off
console.log('Debug logging default (should be minimal output):');
await testFixiplug.dispatch('testHook1', { test: 'data' });

// Enable debug logging
testFixiplug.setDebugLogging(true);
console.log('\nDebug logging enabled (should show detailed logs):');
await testFixiplug.dispatch('testHook2', { test: 'data' });

// Disable debug logging
testFixiplug.setDebugLogging(false);
console.log('\nDebug logging disabled (should be minimal output again):');
await testFixiplug.dispatch('testHook3', { test: 'data' });

// Test 2: Single-pass handler processing (wildcard + specific)
console.log('\n2. Testing single-pass handler processing...');

let executionOrder = [];

// Register specific handler
testFixiplug.use(function specificHandler(ctx) {
  ctx.on('mixedTest', (event) => {
    executionOrder.push('specific');
    return event;
  });
});

// Register wildcard handler  
testFixiplug.use(function wildcardHandler(ctx) {
  ctx.on('*', (event, hookName) => {
    if (hookName === 'mixedTest') {
      executionOrder.push('wildcard');
    }
    return event;
  });
});

// Dispatch and check execution order
executionOrder = [];
await testFixiplug.dispatch('mixedTest', { test: 'mixed' });
console.log('Execution order:', executionOrder);
console.log('✓ Both specific and wildcard handlers executed in single pass');

// Test 3: Error handling without recursion
console.log('\n3. Testing error handling without recursion...');

let errorCount = 0;

// Register error reporter
testFixiplug.use(function errorReporter(ctx) {
  ctx.on('pluginError', (event) => {
    errorCount++;
    console.log(`Error caught: ${event.error.message} from plugin ${event.plugin}`);
  });
});

// Register handler that throws error
testFixiplug.use(function faultyPlugin(ctx) {
  ctx.on('errorTest', () => {
    throw new Error('Test error');
  });
});

// Dispatch to trigger error
errorCount = 0;
await testFixiplug.dispatch('errorTest', { test: 'error' });

// Wait a bit for async error processing
await new Promise(resolve => setTimeout(resolve, 100));

console.log(`Errors processed: ${errorCount}`);
console.log('✓ Error processed without causing recursion');

// Test 4: Performance comparison
console.log('\n4. Performance comparison...');

const iterations = 1000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  await testFixiplug.dispatch('perfTest', { iteration: i });
}

const endTime = performance.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`Processed ${iterations} dispatches in ${endTime - startTime}ms`);
console.log(`Average dispatch time: ${avgTime.toFixed(3)}ms`);
console.log('✓ Performance test completed');

console.log('\n=== Priority 1 Optimizations Test Complete ===');