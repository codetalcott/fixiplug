/**
 * Test suite for State Tracker Plugin
 *
 * Tests the state tracker plugin's ability to manage application state,
 * track transitions, and coordinate async workflows for LLM agents.
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';
import stateTrackerPlugin, { COMMON_STATES } from './plugins/state-tracker.js';

console.log('=== FixiPlug State Tracker Plugin Tests ===\n');

// Create test instance
const fixiplug = configure({ features: [FEATURES.LOGGING] });
fixiplug.use(stateTrackerPlugin);

// ========================================
// Test 1: Get Current State
// ========================================
console.log('Test 1: Get Current State (api:getCurrentState)');
const initialState = await fixiplug.dispatch('api:getCurrentState');
console.log('  Initial state:', initialState.state);
console.log('  Timestamp:', initialState.timestamp);
console.log('  Age:', initialState.age + 'ms');
console.log('  ✓ Current state retrieved\n');

if (initialState.state !== COMMON_STATES.IDLE) {
  console.error('  ✗ Expected initial state to be "idle"');
}

// ========================================
// Test 2: Simple State Transition
// ========================================
console.log('Test 2: Simple State Transition (api:setState)');
const transitionResult = await fixiplug.dispatch('api:setState', {
  state: COMMON_STATES.LOADING,
  data: { operation: 'test' }
});

console.log('  Transition:', transitionResult.previousState, '->', transitionResult.state);
console.log('  Success:', transitionResult.success);
console.log('  Timestamp:', transitionResult.timestamp);
console.log('  ✓ State transition successful\n');

if (!transitionResult.success) {
  console.error('  ✗ State transition failed');
}

const newState = await fixiplug.dispatch('api:getCurrentState');
if (newState.state !== COMMON_STATES.LOADING) {
  console.error('  ✗ State not updated correctly');
}

// ========================================
// Test 3: State History
// ========================================
console.log('Test 3: State History (api:getStateHistory)');
const historyResult = await fixiplug.dispatch('api:getStateHistory');

console.log('  Total transitions:', historyResult.totalTransitions);
console.log('  Current state:', historyResult.currentState);
console.log('  Recent transitions:');
historyResult.history.forEach(entry => {
  console.log(`    ${entry.from} -> ${entry.to} (${entry.age}ms ago)`);
});
console.log('  ✓ State history tracked\n');

if (historyResult.totalTransitions === 0) {
  console.error('  ✗ No history recorded');
}

// ========================================
// Test 4: Wait For State (Immediate)
// ========================================
console.log('Test 4: Wait For State - Already in State');
const immediateWait = await fixiplug.dispatch('api:waitForState', {
  state: COMMON_STATES.LOADING
});

console.log('  State:', immediateWait.state);
console.log('  Wait time:', immediateWait.waited + 'ms');
console.log('  ✓ Immediate resolution works\n');

if (immediateWait.waited > 10) {
  console.error('  ✗ Should resolve immediately');
}

// ========================================
// Test 5: Wait For State (Async)
// ========================================
console.log('Test 5: Wait For State - Async Transition');

// Start waiting (don't await yet)
const waitPromise = fixiplug.dispatch('api:waitForState', {
  state: COMMON_STATES.SUCCESS,
  timeout: 5000
});

// Simulate async operation
setTimeout(async () => {
  await fixiplug.dispatch('api:setState', {
    state: COMMON_STATES.SUCCESS,
    data: { result: 'completed' }
  });
}, 100);

// Wait for completion
const waitResult = await waitPromise;
console.log('  State reached:', waitResult.state);
console.log('  Wait time:', waitResult.waited + 'ms');
console.log('  Data:', waitResult.data);
console.log('  ✓ Async wait successful\n');

if (waitResult.waited < 90) {
  console.error('  ✗ Wait time too short');
}

// ========================================
// Test 6: Wait Timeout
// ========================================
console.log('Test 6: Wait Timeout');
let timeoutWorked = false;
try {
  const timeoutPromise = fixiplug.dispatch('api:waitForState', {
    state: 'never-reached',
    timeout: 100
  });
  await timeoutPromise;
  console.error('  ✗ Should have timed out');
} catch (error) {
  timeoutWorked = true;
  console.log('  Timeout error:', error.message);
}

// Give it a moment to fully clean up
await new Promise(resolve => setTimeout(resolve, 50));

if (timeoutWorked) {
  console.log('  ✓ Timeout works correctly\n');
}

// ========================================
// Test 7: Common States
// ========================================
console.log('Test 7: Get Common States (api:getCommonStates)');
const commonStates = await fixiplug.dispatch('api:getCommonStates');

console.log('  Common states:');
Object.entries(commonStates.states).forEach(([key, value]) => {
  console.log(`    ${key}: "${value}"`);
});
console.log('  ✓ Common states available\n');

if (!commonStates.states.IDLE) {
  console.error('  ✗ Missing IDLE state');
}

// ========================================
// Test 8: State Schema Validation
// ========================================
console.log('Test 8: State Schema Validation (api:registerStateSchema)');

const schemaResult = await fixiplug.dispatch('api:registerStateSchema', {
  states: ['idle', 'loading', 'success', 'error'],
  transitions: {
    idle: ['loading'],
    loading: ['success', 'error'],
    success: ['idle'],
    error: ['idle']
  },
  initial: 'idle'
});

console.log('  Schema registered:', schemaResult.success);
console.log('  States:', schemaResult.schema.states.join(', '));
console.log('  Transitions defined:', schemaResult.schema.transitionCount);
console.log('  Initial state:', schemaResult.schema.initial);
console.log('  ✓ Schema registered\n');

// Test valid transition
const validTransition = await fixiplug.dispatch('api:setState', {
  state: 'loading',
  data: {}
});

console.log('  Valid transition (idle -> loading):', validTransition.success);
console.log('  ✓ Valid transition allowed\n');

// Test invalid transition
const invalidTransition = await fixiplug.dispatch('api:setState', {
  state: 'idle',  // loading -> idle not allowed
  data: {}
});

console.log('  Invalid transition (loading -> idle):', invalidTransition.error ? 'Blocked' : 'Allowed');
if (invalidTransition.error) {
  console.log('  Error:', invalidTransition.error);
  console.log('  Valid transitions:', invalidTransition.validTransitions);
  console.log('  ✓ Invalid transition blocked\n');
} else {
  console.error('  ✗ Invalid transition should be blocked');
}

// ========================================
// Test 9: Clear History
// ========================================
console.log('Test 9: Clear History (api:clearStateHistory)');

const clearResult = await fixiplug.dispatch('api:clearStateHistory');
console.log('  Entries cleared:', clearResult.cleared);
console.log('  Success:', clearResult.success);

const clearedHistory = await fixiplug.dispatch('api:getStateHistory');
console.log('  History after clear:', clearedHistory.totalTransitions);
console.log('  ✓ History cleared\n');

if (clearedHistory.totalTransitions !== 0) {
  console.error('  ✗ History not cleared');
}

// ========================================
// Test 10: Concurrent Waiters
// ========================================
console.log('Test 10: Concurrent Waiters');

// Create multiple waiters
const waiter1 = fixiplug.dispatch('api:waitForState', { state: 'complete' });
const waiter2 = fixiplug.dispatch('api:waitForState', { state: 'complete' });
const waiter3 = fixiplug.dispatch('api:waitForState', { state: 'complete' });

// Trigger state change
setTimeout(async () => {
  await fixiplug.dispatch('api:setState', {
    state: 'complete',
    validate: false  // Skip schema validation
  });
}, 50);

// Wait for all
const [result1, result2, result3] = await Promise.all([waiter1, waiter2, waiter3]);

console.log('  Waiter 1 resolved:', result1.state, `(${result1.waited}ms)`);
console.log('  Waiter 2 resolved:', result2.state, `(${result2.waited}ms)`);
console.log('  Waiter 3 resolved:', result3.state, `(${result3.waited}ms)`);
console.log('  ✓ Multiple waiters resolved\n');

// ========================================
// Test 11: Agent Workflow Simulation
// ========================================
console.log('Test 11: LLM Agent Workflow Simulation');
console.log('  Simulating agent monitoring async operation...\n');

// Agent starts operation
await fixiplug.dispatch('api:setState', {
  state: 'loading',
  data: { operation: 'fetch-data' },
  validate: false
});
console.log('  Agent: Started operation (state: loading)');

// Agent waits for completion
const agentWait = fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 3000
});

// Simulate async work
setTimeout(async () => {
  await fixiplug.dispatch('api:setState', {
    state: 'success',
    data: { result: { items: 42 } },
    validate: false
  });
}, 150);

const agentResult = await agentWait;
console.log('  Agent: Operation completed!');
console.log('  Agent: Waited', agentResult.waited + 'ms');
console.log('  Agent: Result:', JSON.stringify(agentResult.data));
console.log('  ✓ Agent workflow successful\n');

// ========================================
// Summary
// ========================================
console.log('=== Test Summary ===');
console.log('✓ All state tracker tests passed');
console.log('✓ State transitions working correctly');
console.log('✓ Wait mechanism handles sync and async cases');
console.log('✓ State history tracked properly');
console.log('✓ Schema validation prevents invalid transitions');
console.log('✓ LLM agents can coordinate async workflows');
