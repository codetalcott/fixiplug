/**
 * Fetch Interceptors Test Suite
 * Tests the fetch:before, fetch:after, and fetch:ready hooks
 * along with the fetch-logger and fetch-cache plugins
 */

import { createFixiplug, FEATURES } from '../builder/fixiplug-factory.js';
import fetchLogger from '../plugins/fetch-logger.js';
import fetchCache from '../plugins/fetch-cache.js';

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
 * Mock fetch for testing
 */
function createMockFetch() {
  const calls = [];

  const mockFetch = async (url, options) => {
    calls.push({ url, options });

    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ data: 'test' }),
      text: async () => 'test response'
    };
  };

  mockFetch.calls = calls;
  mockFetch.reset = () => calls.length = 0;

  return mockFetch;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Fetch Interceptors Test Suite');
  console.log('='.repeat(60));
  console.log();

  try {
    // ========================================
    // Test Group 1: Core Hook Execution
    // ========================================
    console.log('Test Group 1: Core Hook Execution');
    console.log('-'.repeat(60));

    const { Fixi } = await import('../core/fixi-core.js');
    const fixiplug = createFixiplug({ features: [FEATURES.TESTING] });
    const mockFetch = createMockFetch();
    global.fetch = mockFetch;

    let beforeCalled = false;
    let afterCalled = false;
    let readyCalled = false;

    // Create a test plugin to register hooks
    function testHooksPlugin(ctx) {
      ctx.on('fetch:before', (event) => {
        beforeCalled = true;
        return event;
      });

      ctx.on('fetch:after', (event) => {
        afterCalled = true;
        return event;
      });

      ctx.on('fetch:ready', (event) => {
        readyCalled = true;
        return event;
      });
    }

    fixiplug.use(testHooksPlugin);

    // Execute fetch using Fixi instance
    const fixi = new Fixi();
    await fixi.fetch({
      action: '/test',
      method: 'GET',
      headers: {},
      signal: null
    });

    assert(beforeCalled, 'fetch:before hook fires');
    assert(afterCalled, 'fetch:after hook fires');
    assert(readyCalled, 'fetch:ready hook fires');
    assert(mockFetch.calls.length === 1, 'Fetch is called once', `Calls: ${mockFetch.calls.length}`);

    console.log();

    // ========================================
    // Test Group 2: Request Modification
    // ========================================
    console.log('Test Group 2: Request Modification');
    console.log('-'.repeat(60));

    const fixiplug2 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockFetch2 = createMockFetch();
    global.fetch = mockFetch2;

    // Plugin that modifies request
    function requestModifierPlugin(ctx) {
      ctx.on('fetch:before', (event) => {
        event.headers = {
          ...event.headers,
          'X-Custom-Header': 'test-value'
        };
        event.url = event.url + '?modified=true';
        return event;
      });
    }

    fixiplug2.use(requestModifierPlugin);

    const fixi2 = new Fixi();
    await fixi2.fetch({
      action: '/test',
      method: 'GET',
      headers: {},
      signal: null
    });

    const call = mockFetch2.calls[0];
    assert(
      call.url.includes('?modified=true'),
      'URL modification in fetch:before works',
      `URL: ${call.url}`
    );
    assert(
      call.options.headers['X-Custom-Header'] === 'test-value',
      'Header modification in fetch:before works',
      `Headers: ${JSON.stringify(call.options.headers)}`
    );

    console.log();

    // ========================================
    // Test Group 3: Response Wrapping
    // ========================================
    console.log('Test Group 3: Response Wrapping');
    console.log('-'.repeat(60));

    const fixiplug3 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockFetch3 = createMockFetch();
    global.fetch = mockFetch3;

    const fixi3 = new Fixi();
    const response = await fixi3.fetch({
      action: '/test',
      method: 'GET',
      headers: {},
      signal: null
    });

    assert(response.ok !== undefined, 'Response has ok property');
    assert(response.status !== undefined, 'Response has status property');
    assert(typeof response.json === 'function', 'Response has json method');
    assert(typeof response.text === 'function', 'Response has text method');
    assert(response.headers !== undefined, 'Response has headers property');
    assert(response.raw !== undefined, 'Response has raw property (new)');

    console.log();

    // ========================================
    // Test Group 4: Fetch Logger Plugin
    // ========================================
    console.log('Test Group 4: Fetch Logger Plugin');
    console.log('-'.repeat(60));

    const fixiplug4 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug4.use(fetchLogger);
    const mockFetch4 = createMockFetch();
    global.fetch = mockFetch4;

    // Capture console output
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    const fixi4 = new Fixi();
    await fixi4.fetch({
      action: '/api/data',
      method: 'GET',
      headers: {},
      signal: null
    });

    console.log = originalLog;

    const hasOutgoingLog = logs.some(log => log.includes('→ GET'));
    const hasResponseLog = logs.some(log => log.includes('← 200'));

    assert(hasOutgoingLog, 'Logger logs outgoing requests');
    assert(hasResponseLog, 'Logger logs responses with status');

    console.log();

    // ========================================
    // Test Group 5: Fetch Cache Plugin - Basic Caching
    // ========================================
    console.log('Test Group 5: Fetch Cache Plugin - Basic Caching');
    console.log('-'.repeat(60));

    const fixiplug5 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug5.use(fetchCache);
    const mockFetch5 = createMockFetch();
    global.fetch = mockFetch5;

    const fixi5 = new Fixi();

    // First request (miss)
    await fixi5.fetch({
      action: '/api/cached',
      method: 'GET',
      headers: {},
      signal: null
    });

    const firstCallCount = mockFetch5.calls.length;

    // Second request (should be cached)
    await fixi5.fetch({
      action: '/api/cached',
      method: 'GET',
      headers: {},
      signal: null
    });

    const secondCallCount = mockFetch5.calls.length;

    assert(
      firstCallCount === 1,
      'First request hits network',
      `Calls: ${firstCallCount}`
    );
    assert(
      secondCallCount === 1,
      'Second request uses cache (no new network call)',
      `Calls: ${secondCallCount}`
    );

    // Check cache stats
    const stats = await fixiplug5.dispatch('api:getCacheStats');
    assert(stats.hits >= 1, 'Cache records hits', `Hits: ${stats.hits}`);
    assert(stats.size >= 1, 'Cache has entries', `Size: ${stats.size}`);

    console.log();

    // ========================================
    // Test Group 6: Fetch Cache Plugin - POST Not Cached
    // ========================================
    console.log('Test Group 6: Fetch Cache Plugin - POST Not Cached');
    console.log('-'.repeat(60));

    const fixiplug6 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug6.use(fetchCache);
    const mockFetch6 = createMockFetch();
    global.fetch = mockFetch6;

    const fixi6 = new Fixi();

    // POST request
    await fixi6.fetch({
      action: '/api/post',
      method: 'POST',
      body: new FormData(),
      headers: {},
      signal: null
    });

    // Second POST request
    await fixi6.fetch({
      action: '/api/post',
      method: 'POST',
      body: new FormData(),
      headers: {},
      signal: null
    });

    assert(
      mockFetch6.calls.length === 2,
      'POST requests are not cached',
      `Calls: ${mockFetch6.calls.length}`
    );

    console.log();

    // ========================================
    // Test Group 7: Fetch Cache Plugin - Clear Cache
    // ========================================
    console.log('Test Group 7: Fetch Cache Plugin - Clear Cache');
    console.log('-'.repeat(60));

    const fixiplug7 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug7.use(fetchCache);
    const mockFetch7 = createMockFetch();
    global.fetch = mockFetch7;

    const fixi7 = new Fixi();

    // Add some cached entries
    await fixi7.fetch({
      action: '/api/one',
      method: 'GET',
      headers: {},
      signal: null
    });

    await fixi7.fetch({
      action: '/api/two',
      method: 'GET',
      headers: {},
      signal: null
    });

    const statsBeforeClear = await fixiplug7.dispatch('api:getCacheStats');

    // Clear cache
    const clearResult = await fixiplug7.dispatch('api:clearCache');

    const statsAfterClear = await fixiplug7.dispatch('api:getCacheStats');

    assert(
      statsBeforeClear.size >= 2,
      'Cache has entries before clear',
      `Size: ${statsBeforeClear.size}`
    );
    assert(
      clearResult.success === true,
      'Clear cache returns success'
    );
    assert(
      statsAfterClear.size === 0,
      'Cache is empty after clear',
      `Size: ${statsAfterClear.size}`
    );

    console.log();

    // ========================================
    // Test Group 8: Hook Priority Order
    // ========================================
    console.log('Test Group 8: Hook Priority Order');
    console.log('-'.repeat(60));

    const fixiplug8 = createFixiplug({ features: [FEATURES.TESTING] });
    const mockFetch8 = createMockFetch();
    global.fetch = mockFetch8;

    const order = [];

    // Plugin with different priority handlers
    function priorityTestPlugin(ctx) {
      ctx.on('fetch:before', () => {
        order.push('normal');
        return undefined; // Pass through
      }, 0);

      ctx.on('fetch:before', () => {
        order.push('high');
        return undefined; // Pass through
      }, 100);

      ctx.on('fetch:before', () => {
        order.push('low');
        return undefined; // Pass through
      }, -100);
    }

    fixiplug8.use(priorityTestPlugin);

    const fixi8 = new Fixi();
    await fixi8.fetch({
      action: '/test',
      method: 'GET',
      headers: {},
      signal: null
    });

    assert(
      order[0] === 'high' && order[1] === 'normal' && order[2] === 'low',
      'Hooks execute in priority order (high → normal → low)',
      `Order: ${order.join(', ')}`
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
