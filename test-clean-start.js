/**
 * Clean start test - no module cache clearing needed in fresh process
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';

console.log('=== Clean Start Test (Fresh Node Process) ===\n');

// Test 1: Minimal configuration - should be completely silent
console.log('1. Minimal configuration (no features, no plugins):');
const minimal = configure({ features: [] });

minimal.use(function testHandler(ctx) {
  ctx.on('test1', (event) => {
    console.log('   ✓ Handler executed - only this should print');
    return event;
  });
});

console.log('   About to dispatch - core should be silent:');
await minimal.dispatch('test1', { test: 'minimal' });
console.log('   ✓ Dispatch completed\n');

// Test 2: Factory logging enabled
console.log('2. Factory logging enabled:');
const withLogging = configure({ features: [FEATURES.LOGGING] });

withLogging.use(function testHandler2(ctx) {
  ctx.on('test2', (event) => {
    console.log('   ✓ Handler executed');
    return event;
  });
});

console.log('   About to dispatch - should see factory log:');
await withLogging.dispatch('test2', { test: 'factory' });
console.log('   ✓ Should have seen "Dispatching hook:" above\n');

// Test 3: Performance test - silent mode
console.log('3. Performance test (silent):');
const perf = configure({ features: [] });

let count = 0;
perf.use(function perfHandler(ctx) {
  ctx.on('perfTest', (event) => {
    count++;
    return event;
  });
});

const start = performance.now();
for (let i = 0; i < 1000; i++) {
  await perf.dispatch('perfTest', { i });
}
const end = performance.now();

console.log(`   ✓ ${count} handlers executed silently`);
console.log(`   ✓ Time: ${(end - start).toFixed(3)}ms`);
console.log(`   ✓ Avg: ${((end - start) / 1000).toFixed(3)}ms/dispatch\n`);

console.log('=== Test Results ===');
console.log('If core is truly silent, you should only see:');
console.log('- Handler execution messages');
console.log('- Factory "Dispatching hook:" when FEATURES.LOGGING enabled');
console.log('- No other dispatch-related output');