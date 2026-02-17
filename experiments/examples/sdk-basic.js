/**
 * Basic usage examples for FixiPlug Agent SDK
 *
 * This file demonstrates how to use the FixiPlugAgent class to interact
 * with FixiPlug-powered applications as an autonomous agent.
 *
 * Run this example:
 * 1. Open in browser with fixiplug loaded
 * 2. Or use Node.js with appropriate setup
 */

import { FixiPlugAgent } from '../sdk/agent-client.js';
import { createFixiplug } from '../builder/fixiplug-factory.js';

// Import plugins we'll use
import introspectionPlugin from '../plugins/introspection.js';
import stateTrackerPlugin from '../plugins/state-tracker.js';

console.log('=== FixiPlug Agent SDK - Basic Usage Examples ===\n');

// Setup: Create a fixiplug instance with necessary plugins
const fixiplug = createFixiplug({
  features: ['logging']
});

fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);

// ==================================================
// Example 1: Creating an agent
// ==================================================
console.log('Example 1: Creating an Agent');
console.log('----------------------------');

const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,      // Cache introspection results
  trackPerformance: true,   // Track API call performance
  defaultTimeout: 5000      // Default timeout for state waiting
});

console.log('✓ Agent created successfully\n');

// ==================================================
// Example 2: Discovering capabilities
// ==================================================
console.log('Example 2: Discovering Capabilities');
console.log('-----------------------------------');

(async () => {
  try {
    const capabilities = await agent.discover();

    console.log('Version:', capabilities.version);
    console.log('Features:', capabilities.features.join(', '));
    console.log('Plugins:', capabilities.plugins.map(p => p.name).join(', '));
    console.log('Available hooks:', Object.keys(capabilities.hooks).length);

    // Check for specific capability
    const hasStateTracker = await agent.hasCapability('fixiplug-state-tracker');
    console.log('Has state tracker:', hasStateTracker);

    console.log('✓ Discovery complete\n');

  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
  }

  // ==================================================
  // Example 3: Basic state management
  // ==================================================
  console.log('Example 3: Basic State Management');
  console.log('---------------------------------');

  try {
    // Get current state
    const current = await agent.getCurrentState();
    console.log('Current state:', current.state);

    // Set a new state
    await agent.setState('processing');
    console.log('✓ Set state to: processing');

    // Get updated state
    const updated = await agent.getCurrentState();
    console.log('Updated state:', updated.state);

    // Reset to idle
    await agent.setState('idle');
    console.log('✓ Reset to: idle\n');

  } catch (error) {
    console.error('❌ State management failed:', error.message);
  }

  // ==================================================
  // Example 4: Using withState for automatic management
  // ==================================================
  console.log('Example 4: Automatic State Management');
  console.log('------------------------------------');

  try {
    const result = await agent.withState('processing', async () => {
      console.log('  → State set to processing');
      console.log('  → Executing work...');

      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('  → Work completed');
      return { processed: 42, items: 10 };
    });

    console.log('✓ Result:', result);

    const final = await agent.getCurrentState();
    console.log('✓ Final state:', final.state, '\n');

  } catch (error) {
    console.error('❌ Automatic state management failed:', error.message);
  }

  // ==================================================
  // Example 5: Waiting for state
  // ==================================================
  console.log('Example 5: Waiting for State');
  console.log('---------------------------');

  try {
    // Set initial state
    await agent.setState('loading');
    console.log('Set state to: loading');

    // Simulate async operation
    setTimeout(async () => {
      console.log('  → Async operation completing...');
      await agent.setState('complete');
    }, 150);

    // Wait for completion
    console.log('Waiting for state: complete');
    const result = await agent.waitForState('complete', { timeout: 3000 });

    console.log('✓ State reached after', result.waited, 'ms');

    // Reset
    await agent.setState('idle');
    console.log('✓ Reset to idle\n');

  } catch (error) {
    console.error('❌ Wait for state failed:', error.message);
  }

  // ==================================================
  // Example 6: Multi-step workflow
  // ==================================================
  console.log('Example 6: Multi-Step Workflow');
  console.log('------------------------------');

  try {
    const workflow = await agent.executeWorkflow([
      {
        name: 'initialize',
        hook: 'api:setState',
        params: { state: 'initialized' },
        state: 'initializing'
      },
      {
        name: 'getCurrentState',
        hook: 'api:getCurrentState',
        params: {}
      },
      {
        name: 'reset',
        hook: 'api:setState',
        params: { state: 'idle' }
      }
    ]);

    console.log('Workflow success:', workflow.success);
    console.log('Completed steps:', workflow.completed.join(', '));
    console.log('Errors:', workflow.errors.length);

    if (workflow.success) {
      console.log('✓ Workflow completed successfully\n');
    }

  } catch (error) {
    console.error('❌ Workflow execution failed:', error.message);
  }

  // ==================================================
  // Example 7: Workflow with dependencies
  // ==================================================
  console.log('Example 7: Workflow with Dependencies');
  console.log('------------------------------------');

  try {
    const workflow = await agent.executeWorkflow([
      {
        name: 'step1',
        hook: 'api:getCurrentState',
        params: {}
      },
      {
        name: 'step2',
        hook: 'api:setState',
        // Use result from previous step
        params: (ctx) => ({
          state: ctx.results.step1.state === 'idle' ? 'processing' : 'idle'
        })
      },
      {
        name: 'step3',
        hook: 'api:setState',
        params: { state: 'idle' }
      }
    ]);

    console.log('Workflow completed:', workflow.completed.length, 'steps');
    console.log('✓ Dependencies resolved successfully\n');

  } catch (error) {
    console.error('❌ Workflow with dependencies failed:', error.message);
  }

  // ==================================================
  // Example 8: Error handling
  // ==================================================
  console.log('Example 8: Error Handling');
  console.log('------------------------');

  try {
    const workflow = await agent.executeWorkflow([
      {
        name: 'valid',
        hook: 'api:getCurrentState',
        params: {}
      },
      {
        name: 'invalid',
        hook: 'api:nonexistent',
        params: {}
      },
      {
        name: 'never_runs',
        hook: 'api:getCurrentState',
        params: {}
      }
    ], {
      stopOnError: true
    });

    console.log('Workflow success:', workflow.success);
    console.log('Completed steps:', workflow.completed.join(', '));
    console.log('Errors:', workflow.errors.length);
    console.log('Stopped at:', workflow.stoppedAt);
    console.log('✓ Errors handled gracefully\n');

  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }

  // ==================================================
  // Example 9: Performance tracking
  // ==================================================
  console.log('Example 9: Performance Tracking');
  console.log('-------------------------------');

  try {
    // Reset stats to start fresh
    agent.resetStats();

    // Execute some operations
    await agent.discover();
    await agent.getCurrentState();
    await agent.setState('idle');

    // Get performance stats
    const stats = agent.getStats();

    console.log('API calls:', stats.apiCalls);
    console.log('Total time:', stats.totalTime.toFixed(2), 'ms');
    console.log('Average time:', stats.averageTime, 'ms per call');
    console.log('✓ Performance tracking working\n');

  } catch (error) {
    console.error('❌ Performance tracking failed:', error.message);
  }

  // ==================================================
  // Example 10: Real-world usage pattern
  // ==================================================
  console.log('Example 10: Real-World Pattern');
  console.log('------------------------------');

  try {
    console.log('Scenario: Agent processes data with error recovery');

    const processData = async () => {
      // Discover capabilities first
      const caps = await agent.discover();
      console.log('  → Discovered', caps.plugins.length, 'plugins');

      // Check for required capability
      if (!await agent.hasCapability('fixiplug-state-tracker')) {
        throw new Error('State tracker required but not available');
      }

      // Execute workflow with state management
      return await agent.withState('processing', async () => {
        console.log('  → Processing started');

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('  → Processing complete');
        return { success: true, recordsProcessed: 100 };
      });
    };

    const result = await processData();
    console.log('✓ Result:', result);

    const finalState = await agent.getCurrentState();
    console.log('✓ Final state:', finalState.state);
    console.log('✓ Real-world pattern completed\n');

  } catch (error) {
    console.error('❌ Real-world pattern failed:', error.message);

    // Show that error state was set
    const errorState = await agent.getCurrentState();
    console.log('Error state:', errorState.state);
  }

  // ==================================================
  // Summary
  // ==================================================
  console.log('\n=== Summary ===');
  console.log('All examples completed!');
  console.log('The FixiPlug Agent SDK provides:');
  console.log('  • Easy capability discovery');
  console.log('  • Automatic state management');
  console.log('  • Workflow orchestration');
  console.log('  • Error handling');
  console.log('  • Performance tracking');
  console.log('\nReady for autonomous agent development! 🤖');

})();
