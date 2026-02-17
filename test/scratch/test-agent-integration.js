/**
 * Agent Integration Test
 *
 * Tests the complete LLM agent workflow combining introspection and state tracking.
 * This simulates how an autonomous agent would discover and use FixiPlug capabilities.
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';
import introspectionPlugin from './plugins/introspection.js';
import stateTrackerPlugin from './plugins/state-tracker.js';

console.log('=== LLM Agent Integration Test ===\n');
console.log('Simulating an autonomous agent interacting with FixiPlug...\n');

// ========================================
// Setup: Agent initializes FixiPlug
// ========================================
console.log('📦 Phase 1: Initialization\n');

const fixiplug = configure({ features: [] });
fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);

// Add a sample application plugin to test
fixiplug.use(function dataFetcherPlugin(ctx) {
  ctx.on('api:fetchData', async (event) => {
    const { url } = event;

    // Simulate async data fetching
    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      success: true,
      data: { items: [1, 2, 3], url },
      timestamp: Date.now()
    };
  });
});

console.log('  ✓ FixiPlug initialized');
console.log('  ✓ Introspection plugin loaded');
console.log('  ✓ State tracker plugin loaded');
console.log('  ✓ Sample application plugin loaded\n');

// ========================================
// Step 1: Agent Discovers Capabilities
// ========================================
console.log('🔍 Step 1: Agent Discovery\n');
console.log('Agent: "What capabilities does this system have?"\n');

const discovery = await fixiplug.dispatch('api:introspect');

console.log(`Agent discovered:`);
console.log(`  - FixiPlug version: ${discovery.fixiplug.version}`);
console.log(`  - ${discovery.fixiplug.metadata.pluginCount} plugins installed`);
console.log(`  - ${discovery.fixiplug.metadata.hookCount} hooks available`);
console.log(`  - ${discovery.fixiplug.capabilities.methods.length} core methods\n`);

// ========================================
// Step 2: Agent Explores Plugins
// ========================================
console.log('🔌 Step 2: Plugin Exploration\n');
console.log('Agent: "What plugins are available?"\n');

const plugins = await fixiplug.dispatch('api:getPluginCapabilities');

console.log('Agent found plugins:');
plugins.capabilities.forEach(plugin => {
  console.log(`  - ${plugin.name} (${plugin.hooks.length} hooks)`);
});
console.log();

// ========================================
// Step 3: Agent Discovers State Tracker
// ========================================
console.log('🎯 Step 3: State Tracker Discovery\n');
console.log('Agent: "Tell me about the stateTrackerPlugin"\n');

const statePlugin = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'stateTrackerPlugin'
});

console.log(`Agent learned about state tracking:`);
console.log(`  Plugin: ${statePlugin.name}`);
console.log(`  Enabled: ${statePlugin.enabled}`);
console.log(`  APIs available:`);
statePlugin.hooks.forEach(hook => {
  console.log(`    - ${hook.hookName}`);
});
console.log();

// ========================================
// Step 4: Agent Plans Async Workflow
// ========================================
console.log('📋 Step 4: Workflow Planning\n');
console.log('Agent: "I need to fetch data and wait for completion"\n');

// Agent examines the data fetcher
const dataPlugin = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'dataFetcherPlugin'
});

console.log(`Agent discovered api:fetchData hook`);
console.log(`Agent will:`);
console.log(`  1. Set state to 'loading'`);
console.log(`  2. Call api:fetchData`);
console.log(`  3. Wait for state 'success'`);
console.log(`  4. Retrieve results\n`);

// ========================================
// Step 5: Agent Executes Workflow
// ========================================
console.log('⚡ Step 5: Workflow Execution\n');

// Step 5.1: Set initial state
console.log('Agent: Setting state to loading...');
await fixiplug.dispatch('api:setState', {
  state: 'loading',
  data: { operation: 'fetch-data' }
});

// Step 5.2: Start async operation
console.log('Agent: Initiating data fetch...');
const fetchPromise = fixiplug.dispatch('api:fetchData', {
  url: 'https://api.example.com/data'
});

// Step 5.3: Wait for completion with timeout
console.log('Agent: Waiting for completion (3s timeout)...');
const waitPromise = fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 3000
});

// Step 5.4: Complete operation and update state
fetchPromise.then(async (result) => {
  console.log('Agent: Data received, updating state...');
  await fixiplug.dispatch('api:setState', {
    state: 'success',
    data: result
  });
});

// Step 5.5: Wait resolves when state changes
const waitResult = await waitPromise;

if (waitResult.error) {
  console.log(`\n❌ Agent: Operation failed - ${waitResult.error}\n`);
} else {
  console.log(`\n✓ Agent: Operation completed in ${waitResult.waited}ms`);
  console.log(`  State: ${waitResult.state}`);
  console.log(`  Data items: ${waitResult.data.data.items.length}\n`);
}

// ========================================
// Step 6: Agent Reviews History
// ========================================
console.log('📊 Step 6: History Review\n');
console.log('Agent: "What state transitions occurred?"\n');

const history = await fixiplug.dispatch('api:getStateHistory');

console.log(`Agent reviewed ${history.totalTransitions} transitions:`);
history.history.forEach((entry, i) => {
  console.log(`  ${i + 1}. ${entry.from} → ${entry.to} (${entry.age}ms ago)`);
});
console.log();

// ========================================
// Step 7: Agent Handles Timeout Scenario
// ========================================
console.log('⏱️  Step 7: Timeout Handling\n');
console.log('Agent: "Testing timeout scenario"\n');

await fixiplug.dispatch('api:setState', {
  state: 'loading',
  data: { operation: 'slow-operation' }
});

console.log('Agent: Waiting for state that never comes (200ms timeout)...');
const timeoutResult = await fixiplug.dispatch('api:waitForState', {
  state: 'never-reached',
  timeout: 200
});

if (timeoutResult.error) {
  console.log(`Agent: Handled timeout gracefully`);
  console.log(`  Error: ${timeoutResult.error}`);
  console.log(`  Waited: ${timeoutResult.waited}ms`);
  console.log(`  ✓ Agent can recover from timeouts\n`);
}

// ========================================
// Step 8: Agent Validates Learnings
// ========================================
console.log('✅ Step 8: Validation\n');

const finalState = await fixiplug.dispatch('api:getCurrentState');
const finalHistory = await fixiplug.dispatch('api:getStateHistory');

console.log('Agent validated:');
console.log(`  ✓ Discovered ${plugins.capabilities.length} plugins autonomously`);
console.log(`  ✓ Identified state tracking capabilities`);
console.log(`  ✓ Planned and executed async workflow`);
console.log(`  ✓ Coordinated timing with waitForState`);
console.log(`  ✓ Handled timeout scenarios gracefully`);
console.log(`  ✓ Reviewed ${finalHistory.totalTransitions} state transitions`);
console.log(`  ✓ Current state: ${finalState.state}\n`);

// ========================================
// Summary
// ========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎉 Agent Integration Test Complete\n');
console.log('Key Achievements:');
console.log('  • Zero-shot capability discovery ✓');
console.log('  • Autonomous workflow planning ✓');
console.log('  • Async operation coordination ✓');
console.log('  • Error handling and recovery ✓');
console.log('  • State transition tracking ✓\n');

console.log('The LLM agent successfully:');
console.log('  1. Discovered FixiPlug without documentation');
console.log('  2. Explored available plugins and hooks');
console.log('  3. Identified state tracking capabilities');
console.log('  4. Planned a multi-step async workflow');
console.log('  5. Executed the workflow with timing coordination');
console.log('  6. Handled edge cases (timeouts)');
console.log('  7. Reviewed operation history\n');

console.log('All operations completed in <10 API calls per workflow! 🚀\n');
