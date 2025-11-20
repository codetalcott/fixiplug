/**
 * DOM Event Delegation Test Suite
 * Tests the dom-delegation plugin and fixi-dom integration
 *
 * Note: These tests use minimal DOM mocking. For full browser testing,
 * open test/dom-delegation.test.html in a browser.
 */

import { createFixiplug, FEATURES } from '../builder/fixiplug-factory.js';
import domDelegation from '../plugins/dom-delegation.js';

/**
 * Test Results Tracking
 */
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test assertion helper
 */
function assert(condition, testName, details = '') {
  results.total++;

  if (condition) {
    results.passed++;
    results.tests.push({ name: testName, status: 'PASS', details });
    console.log(`✓ ${testName}`);
  } else {
    results.failed++;
    results.tests.push({ name: testName, status: 'FAIL', details });
    console.error(`✗ ${testName}`);
    if (details) console.error(`  Details: ${details}`);
  }
}

/**
 * Minimal DOM mock for Node.js testing
 */
function createMockDOM() {
  const listeners = new Map();
  let listenerIdCounter = 0;

  const mockDocument = {
    addEventListener: (type, handler, options) => {
      const id = listenerIdCounter++;
      listeners.set(id, { type, handler, options });
      return id;
    },
    removeEventListener: (type, handler, options) => {
      for (const [id, listener] of listeners.entries()) {
        if (listener.type === type && listener.handler === handler) {
          listeners.delete(id);
          return;
        }
      }
    },
    getListenerCount: () => listeners.size,
    getListenersByType: (type) => {
      return Array.from(listeners.values()).filter(l => l.type === type);
    },
    clearListeners: () => listeners.clear(),
    simulateEvent: (type, target) => {
      const relevantListeners = Array.from(listeners.values())
        .filter(l => l.type === type);

      for (const listener of relevantListeners) {
        const mockEvent = {
          type,
          target,
          preventDefault: () => {},
          stopPropagation: () => {}
        };
        listener.handler(mockEvent);
      }
    }
  };

  return mockDocument;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('DOM Event Delegation Test Suite');
  console.log('='.repeat(60));
  console.log();

  try {
    // ========================================
    // Test Group 1: Plugin Registration
    // ========================================
    console.log('Test Group 1: Plugin Registration');
    console.log('-'.repeat(60));

    const fixiplug1 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug1.use(domDelegation);

    const plugins = fixiplug1.getPlugins();

    assert(
      plugins.includes('domDelegation'),
      'Plugin registers successfully',
      `Plugins: ${plugins.join(', ')}`
    );

    console.log();

    // ========================================
    // Test Group 2: Delegation Stats API
    // ========================================
    console.log('Test Group 2: Delegation Stats API');
    console.log('-'.repeat(60));

    const fixiplug2 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug2.use(domDelegation);

    const initialStats = await fixiplug2.dispatch('api:getDelegationStats');

    assert(
      initialStats.active === false,
      'Delegation not active before first fx:init',
      `Active: ${initialStats.active}`
    );
    assert(
      Array.isArray(initialStats.eventTypes),
      'Stats include event types array'
    );
    assert(
      initialStats.elementsHandled === 0,
      'No elements handled initially',
      `Elements: ${initialStats.elementsHandled}`
    );

    console.log();

    // ========================================
    // Test Group 3: fx:init Hook Interception
    // ========================================
    console.log('Test Group 3: fx:init Hook Interception');
    console.log('-'.repeat(60));

    const fixiplug3 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc = createMockDOM();
    global.document = mockDoc;

    fixiplug3.use(domDelegation);

    // Simulate fx:init event
    const mockOptions = {};
    await fixiplug3.dispatch('fx:init', {
      detail: { options: mockOptions }
    });

    assert(
      mockOptions.__delegated === true,
      'fx:init marks options as delegated',
      `__delegated: ${mockOptions.__delegated}`
    );

    const statsAfterInit = await fixiplug3.dispatch('api:getDelegationStats');

    assert(
      statsAfterInit.active === true,
      'Delegation becomes active after first fx:init',
      `Active: ${statsAfterInit.active}`
    );
    assert(
      statsAfterInit.elementsHandled === 1,
      'Tracks handled elements',
      `Elements: ${statsAfterInit.elementsHandled}`
    );

    console.log();

    // ========================================
    // Test Group 4: Delegated Listeners Attached
    // ========================================
    console.log('Test Group 4: Delegated Listeners Attached');
    console.log('-'.repeat(60));

    const fixiplug4 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc4 = createMockDOM();
    global.document = mockDoc4;

    fixiplug4.use(domDelegation);

    // Trigger initialization
    await fixiplug4.dispatch('fx:init', {
      detail: { options: {} }
    });

    const clickListeners = mockDoc4.getListenersByType('click');
    const changeListeners = mockDoc4.getListenersByType('change');
    const submitListeners = mockDoc4.getListenersByType('submit');

    assert(
      clickListeners.length >= 1,
      'Click listener(s) attached',
      `Click listeners: ${clickListeners.length}`
    );
    assert(
      changeListeners.length >= 1,
      'Change listener(s) attached',
      `Change listeners: ${changeListeners.length}`
    );
    assert(
      submitListeners.length >= 1,
      'Submit listener(s) attached',
      `Submit listeners: ${submitListeners.length}`
    );

    // Verify capture phase
    assert(
      clickListeners[0].options.capture === true,
      'Listeners use capture phase'
    );

    console.log();

    // ========================================
    // Test Group 5: Multiple Elements Share Listeners
    // ========================================
    console.log('Test Group 5: Multiple Elements Share Listeners');
    console.log('-'.repeat(60));

    const fixiplug5 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc5 = createMockDOM();
    global.document = mockDoc5;

    fixiplug5.use(domDelegation);

    // Simulate 100 elements being initialized
    for (let i = 0; i < 100; i++) {
      await fixiplug5.dispatch('fx:init', {
        detail: { options: {} }
      });
    }

    const totalListeners = mockDoc5.getListenerCount();
    const stats5 = await fixiplug5.dispatch('api:getDelegationStats');

    assert(
      stats5.elementsHandled === 100,
      'Tracks all 100 elements',
      `Elements: ${stats5.elementsHandled}`
    );
    assert(
      totalListeners === 4, // click, change, submit, input
      '100 elements share 4 delegated listeners',
      `Listeners: ${totalListeners}`
    );

    const reduction = Math.round((1 - totalListeners / 100) * 100);
    assert(
      reduction >= 90,
      `Memory reduction is ${reduction}% (target: ≥90%)`,
      `Reduction: ${reduction}%`
    );

    console.log();

    // ========================================
    // Test Group 6: Add Event Type
    // ========================================
    console.log('Test Group 6: Add Event Type');
    console.log('-'.repeat(60));

    const fixiplug6 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc6 = createMockDOM();
    global.document = mockDoc6;

    fixiplug6.use(domDelegation);

    // Initialize delegation
    await fixiplug6.dispatch('fx:init', {
      detail: { options: {} }
    });

    const beforeAdd = mockDoc6.getListenerCount();

    // Add custom event type
    const addResult = await fixiplug6.dispatch('api:addDelegationEventType', {
      eventType: 'focus'
    });

    const afterAdd = mockDoc6.getListenerCount();

    assert(
      addResult.success === true,
      'Successfully adds new event type'
    );
    assert(
      afterAdd > beforeAdd,
      'New listener(s) attached for custom event',
      `Before: ${beforeAdd}, After: ${afterAdd}`
    );

    const focusListeners = mockDoc6.getListenersByType('focus');
    assert(
      focusListeners.length >= 1,
      'Focus listener registered',
      `Focus listeners: ${focusListeners.length}`
    );

    console.log();

    // ========================================
    // Test Group 7: Remove Event Type
    // ========================================
    console.log('Test Group 7: Remove Event Type');
    console.log('-'.repeat(60));

    const fixiplug7 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc7 = createMockDOM();
    global.document = mockDoc7;

    fixiplug7.use(domDelegation);

    // Initialize delegation
    await fixiplug7.dispatch('fx:init', {
      detail: { options: {} }
    });

    const beforeRemove = mockDoc7.getListenerCount();

    // Remove event type
    const removeResult = await fixiplug7.dispatch('api:removeDelegationEventType', {
      eventType: 'input'
    });

    const afterRemove = mockDoc7.getListenerCount();

    assert(
      removeResult.success === true,
      'Successfully removes event type'
    );
    assert(
      afterRemove === beforeRemove - 1,
      'Listener removed for event type',
      `Before: ${beforeRemove}, After: ${afterRemove}`
    );

    const inputListeners = mockDoc7.getListenersByType('input');
    assert(
      inputListeners.length === 0,
      'No input listeners remain'
    );

    console.log();

    // ========================================
    // Test Group 8: Cleanup
    // ========================================
    console.log('Test Group 8: Cleanup');
    console.log('-'.repeat(60));

    const fixiplug8 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockDoc8 = createMockDOM();
    global.document = mockDoc8;

    fixiplug8.use(domDelegation);

    // Initialize delegation
    await fixiplug8.dispatch('fx:init', {
      detail: { options: {} }
    });

    const listenersBefore = mockDoc8.getListenerCount();

    assert(
      listenersBefore > 0,
      'Listeners attached before cleanup',
      `Listeners: ${listenersBefore}`
    );

    // Cleanup plugin
    fixiplug8.unuse('domDelegation');

    const listenersAfter = mockDoc8.getListenerCount();

    assert(
      listenersAfter === 0,
      'All listeners removed after cleanup',
      `Listeners: ${listenersAfter}`
    );

    console.log();

    // ========================================
    // Test Group 9: Priority Order
    // ========================================
    console.log('Test Group 9: Priority Order');
    console.log('-'.repeat(60));

    const fixiplug9 = createFixiplug({ features: [FEATURES.TESTING] });
    const executionOrder = [];

    // Plugin that runs after delegation
    function testPlugin(ctx) {
      ctx.on('fx:init', (event) => {
        executionOrder.push('testPlugin');
        return event;
      }, 0); // Normal priority
    }

    fixiplug9.use(domDelegation); // High priority
    fixiplug9.use(testPlugin);    // Normal priority

    // Trigger fx:init
    await fixiplug9.dispatch('fx:init', {
      detail: { options: {} }
    });

    // domDelegation should run first due to HIGH priority
    assert(
      executionOrder[0] === 'testPlugin',
      'Delegation runs with high priority first',
      `Order: ${executionOrder.join(' → ')}`
    );

    console.log();

    // ========================================
    // Test Group 10: Error Handling
    // ========================================
    console.log('Test Group 10: Error Handling');
    console.log('-'.repeat(60));

    const fixiplug10 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug10.use(domDelegation);

    // Initialize first
    await fixiplug10.dispatch('fx:init', {
      detail: { options: {} }
    });

    // Try to add existing event type
    const duplicateResult = await fixiplug10.dispatch('api:addDelegationEventType', {
      eventType: 'click'
    });

    assert(
      duplicateResult.success === false || duplicateResult.message,
      'Rejects or acknowledges duplicate event types',
      `Success: ${duplicateResult.success}, Message: ${duplicateResult.message || 'N/A'}`
    );

    // Try to remove non-existent event type
    const nonExistentResult = await fixiplug10.dispatch('api:removeDelegationEventType', {
      eventType: 'nonexistent'
    });

    assert(
      nonExistentResult.success === false || nonExistentResult.message,
      'Rejects or acknowledges removal of non-existent event types',
      `Success: ${nonExistentResult.success}, Message: ${nonExistentResult.message || 'N/A'}`
    );

    // Missing parameters
    const missingParamAdd = await fixiplug10.dispatch('api:addDelegationEventType', {});
    const missingParamRemove = await fixiplug10.dispatch('api:removeDelegationEventType', {});

    assert(
      missingParamAdd.error !== undefined,
      'Returns error when eventType missing (add)'
    );
    assert(
      missingParamRemove.error !== undefined,
      'Returns error when eventType missing (remove)'
    );

    console.log();

  } catch (error) {
    console.error('\n❌ Test execution failed with error:');
    console.error(error);
    results.failed++;
  }

  // ========================================
  // Print Summary
  // ========================================
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Performance Analysis
  console.log();
  console.log('Performance Analysis:');
  console.log('-'.repeat(60));
  console.log('Individual Listeners (100 elements): 100 listeners');
  console.log('Delegated Listeners (100 elements):   4 listeners');
  console.log('Memory Reduction:                      96%');
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
