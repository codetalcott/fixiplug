/**
 * Unit tests for MetricsCollector
 */

import assert from 'node:assert';
import { MetricsCollector } from '../../../sdk/adapters/sqlite-framework/metrics.js';

console.log('Running MetricsCollector tests...\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    failedTests++;
  }
}

// Test 1: Record successful request
test('should record successful request', () => {
  const metrics = new MetricsCollector();
  const timer = metrics.startTimer('test');
  timer.success();

  const stats = metrics.getStats();
  assert.strictEqual(stats.totalSuccesses, 1);
  assert.strictEqual(stats.totalRequests, 1);
  assert.strictEqual(stats.totalFailures, 0);
});

// Test 2: Record failed request
test('should record failed request', () => {
  const metrics = new MetricsCollector();
  const timer = metrics.startTimer('test');
  timer.failure();

  const stats = metrics.getStats();
  assert.strictEqual(stats.totalFailures, 1);
  assert.strictEqual(stats.totalRequests, 1);
  assert.strictEqual(stats.totalSuccesses, 0);
});

// Test 3: Track active requests
test('should track active requests', () => {
  const metrics = new MetricsCollector();

  const timer1 = metrics.startTimer('test1');
  const timer2 = metrics.startTimer('test2');

  let stats = metrics.getStats();
  assert.strictEqual(stats.activeRequests, 2);

  timer1.success();
  stats = metrics.getStats();
  assert.strictEqual(stats.activeRequests, 1);

  timer2.success();
  stats = metrics.getStats();
  assert.strictEqual(stats.activeRequests, 0);
});

// Test 4: Calculate success rate
test('should calculate success rate', () => {
  const metrics = new MetricsCollector();

  for (let i = 0; i < 7; i++) {
    const timer = metrics.startTimer('test');
    timer.success();
  }

  for (let i = 0; i < 3; i++) {
    const timer = metrics.startTimer('test');
    timer.failure();
  }

  const stats = metrics.getStats();
  assert.strictEqual(stats.successRate, 70);  // 7/10 = 70%
  assert.strictEqual(stats.failureRate, 30);  // 3/10 = 30%
});

// Test 5: Track latency
test('should track latency', () => {
  const metrics = new MetricsCollector();

  // Simulate some requests with latency
  const timer = metrics.startTimer('test');
  timer.success();

  const stats = metrics.getStats();

  assert(typeof stats.latency.avg === 'number');
  assert(typeof stats.latency.p50 === 'number');
  assert(typeof stats.latency.p95 === 'number');
  assert(typeof stats.latency.p99 === 'number');
});

// Test 6: Track cache hits and misses
test('should track cache hits and misses', () => {
  const metrics = new MetricsCollector();

  metrics.recordCacheHit('l1');
  metrics.recordCacheHit('l1');
  metrics.recordCacheMiss();

  const stats = metrics.getStats();
  assert.strictEqual(stats.cache.hits, 2);
  assert.strictEqual(stats.cache.misses, 1);
  assert.strictEqual(stats.cache.hitRate, (2/3) * 100);
});

// Test 7: Per-method statistics
test('should track per-method statistics', () => {
  const metrics = new MetricsCollector();

  const timer1 = metrics.startTimer('method1');
  timer1.success();

  const timer2 = metrics.startTimer('method2');
  timer2.success();

  const timer3 = metrics.startTimer('method1');
  timer3.success();

  const stats = metrics.getStats();

  assert.strictEqual(stats.methodStats.method1.requests, 2);
  assert.strictEqual(stats.methodStats.method2.requests, 1);
});

// Test 8: Per-method success rate
test('should calculate per-method success rate', () => {
  const metrics = new MetricsCollector();

  // method1: 3 successes, 1 failure
  for (let i = 0; i < 3; i++) {
    const timer = metrics.startTimer('method1');
    timer.success();
  }
  const timer = metrics.startTimer('method1');
  timer.failure();

  const stats = metrics.getStats();
  assert.strictEqual(stats.methodStats.method1.successRate, 75);  // 3/4 = 75%
});

// Test 9: Reset metrics
test('should reset all metrics', () => {
  const metrics = new MetricsCollector();

  const timer = metrics.startTimer('test');
  timer.success();
  metrics.recordCacheHit('l1');

  metrics.reset();

  const stats = metrics.getStats();
  assert.strictEqual(stats.totalRequests, 0);
  assert.strictEqual(stats.totalSuccesses, 0);
  assert.strictEqual(stats.cache.hits, 0);
});

// Test 10: Prometheus export format
test('should export metrics in Prometheus format', () => {
  const metrics = new MetricsCollector();

  const timer = metrics.startTimer('test');
  timer.success();

  const prometheus = metrics.toPrometheus();

  assert(typeof prometheus === 'string');
  assert(prometheus.includes('sqlite_bridge_requests_total'));
  assert(prometheus.includes('sqlite_bridge_successes_total'));
  assert(prometheus.includes('sqlite_bridge_latency_milliseconds'));
});

// Test 11: Prometheus histogram buckets
test('should include histogram buckets in Prometheus export', () => {
  const metrics = new MetricsCollector();

  const timer = metrics.startTimer('test');
  timer.success();

  const prometheus = metrics.toPrometheus();

  assert(prometheus.includes('le="10"'));
  assert(prometheus.includes('le="50"'));
  assert(prometheus.includes('le="100"'));
  assert(prometheus.includes('le="+Inf"'));
});

// Test 12: Disabled metrics
test('should not collect metrics when disabled', () => {
  const metrics = new MetricsCollector({ enabled: false });

  const timer = metrics.startTimer('test');
  timer.success();

  const stats = metrics.getStats();
  assert.strictEqual(stats, null);
});

// Test 13: Uptime tracking
test('should track uptime', async () => {
  const metrics = new MetricsCollector();

  await new Promise(resolve => setTimeout(resolve, 100));

  const stats = metrics.getStats();
  assert(stats.uptime >= 100);
});

// Test 14: Empty statistics
test('should handle empty statistics', () => {
  const metrics = new MetricsCollector();

  const stats = metrics.getStats();

  assert.strictEqual(stats.totalRequests, 0);
  assert.strictEqual(stats.successRate, 0);
  assert.strictEqual(stats.failureRate, 0);
  assert.strictEqual(stats.latency.avg, 0);
});

// Test 15: Percentile calculation with single value
test('should calculate percentiles with single value', () => {
  const metrics = new MetricsCollector();

  const timer = metrics.startTimer('test');
  timer.success();

  const stats = metrics.getStats();

  // All percentiles should be similar with one value
  assert(stats.latency.p50 >= 0);
  assert(stats.latency.p95 >= 0);
  assert(stats.latency.p99 >= 0);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Metrics Collector Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
