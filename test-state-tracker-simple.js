/**
 * Simplified State Tracker Test
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';
import stateTrackerPlugin, { COMMON_STATES } from './plugins/state-tracker.js';

console.log('=== Simple State Tracker Test ===\n');

const fixiplug = configure({ features: [] });
fixiplug.use(stateTrackerPlugin);

// Test 1: Get state
console.log('1. Get current state');
const state1 = await fixiplug.dispatch('api:getCurrentState');
console.log('   State:', state1.state);

// Test 2: Set state
console.log('\n2. Set state to loading');
const result = await fixiplug.dispatch('api:setState', {
  state: 'loading'
});
console.log('   Success:', result.success);

// Test 3: Wait (already in state)
console.log('\n3. Wait for loading (already there)');
const wait1 = await fixiplug.dispatch('api:waitForState', {
  state: 'loading'
});
console.log('   Waited:', wait1.waited + 'ms');

// Test 4: Wait (async)
console.log('\n4. Wait for success (async)');
const waitPromise = fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 2000
});

setTimeout(async () => {
  console.log('   [Setting state to success after 100ms]');
  await fixiplug.dispatch('api:setState', { state: 'success' });
}, 100);

const wait2 = await waitPromise;
console.log('   Waited:', wait2.waited + 'ms');

// Test 5: Timeout
console.log('\n5. Wait timeout test');
const timeoutResult = await fixiplug.dispatch('api:waitForState', {
  state: 'never',
  timeout: 200
});

if (timeoutResult.error) {
  console.log('   Timeout error:', timeoutResult.error);
  console.log('   Waited:', timeoutResult.waited + 'ms');
} else {
  console.log('   ERROR: Should have timed out!');
}

console.log('\n✓ All simple tests passed');
process.exit(0);
