/**
 * Unit tests for CacheManager
 */

import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CacheManager } from '../../../sdk/adapters/sqlite-framework/cache-manager.js';

console.log('Running CacheManager tests...\n');

let passedTests = 0;
let failedTests = 0;
let testCacheDir;

function test(name, fn) {
  try {
    // Create temp directory for each test
    testCacheDir = mkdtempSync(join(tmpdir(), 'cache-test-'));

    fn();

    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error(`  ${error.stack.split('\n').slice(1, 3).join('\n')}`);
    }
    failedTests++;
  } finally {
    // Cleanup temp directory
    if (testCacheDir) {
      try {
        rmSync(testCacheDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

async function asyncTest(name, fn) {
  try {
    testCacheDir = mkdtempSync(join(tmpdir(), 'cache-test-'));

    await fn();

    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error(`  ${error.stack.split('\n').slice(1, 3).join('\n')}`);
    }
    failedTests++;
  } finally {
    if (testCacheDir) {
      try {
        rmSync(testCacheDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    }
  }
}

// Test 1: Generate cache key
test('should generate consistent cache keys', () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  const key1 = cache.generateKey('getRecommendations', { domain: 'finance' });
  const key2 = cache.generateKey('getRecommendations', { domain: 'finance' });
  const key3 = cache.generateKey('getRecommendations', { domain: 'analytics' });

  assert.strictEqual(key1, key2);
  assert.notStrictEqual(key1, key3);
});

// Test 2: L1 cache set and get
await asyncTest('should set and get from L1 cache', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  const value = { data: 'test' };
  await cache.set('test-key', value);

  const result = await cache.get('test-key', async () => {
    throw new Error('Should not be called (cache hit)');
  });

  assert.deepStrictEqual(result, value);
});

// Test 3: L1 cache miss
await asyncTest('should load on L1 cache miss', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  let loaderCalled = false;
  const value = { data: 'loaded' };

  const result = await cache.get('missing-key', async () => {
    loaderCalled = true;
    return value;
  });

  assert.strictEqual(loaderCalled, true);
  assert.deepStrictEqual(result, value);
});

// Test 4: L1 cache TTL expiration
await asyncTest('should expire L1 cache entries after TTL', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 100  // 100ms TTL
  });

  await cache.set('test-key', { data: 'test' });

  // Wait for TTL to expire
  await new Promise(resolve => setTimeout(resolve, 150));

  let loaderCalled = false;
  await cache.get('test-key', async () => {
    loaderCalled = true;
    return { data: 'reloaded' };
  });

  assert.strictEqual(loaderCalled, true);
});

// Test 5: L1 LRU eviction
await asyncTest('should evict least recently used items', async () => {
  const cache = new CacheManager({
    l1MaxItems: 3,  // Small cache
    l1TTL: 60000
  });

  // Fill cache
  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3');

  // Access key1 (making it most recently used)
  await cache.get('key1', async () => 'value1');

  // Add key4 (should evict key2, the least recently used)
  await cache.set('key4', 'value4');

  // key2 should be evicted
  let loaderCalled = false;
  await cache.get('key2', async () => {
    loaderCalled = true;
    return 'reloaded';
  });

  assert.strictEqual(loaderCalled, true);
});

// Test 6: L2 cache set and get
await asyncTest('should set and get from L2 cache', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000,
    l2Directory: testCacheDir,
    l2MaxSize: 1024 * 1024,
    l2TTL: 60000
  });

  const value = { data: 'test' };
  await cache.set('test-key', value);

  // Create new cache instance to simulate restart
  const cache2 = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000,
    l2Directory: testCacheDir,
    l2MaxSize: 1024 * 1024,
    l2TTL: 60000
  });

  const result = await cache2.get('test-key', async () => {
    throw new Error('Should not be called (L2 cache hit)');
  });

  assert.deepStrictEqual(result, value);
});

// Test 7: Should cache method check
test('should check if method should be cached', () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  assert.strictEqual(cache.shouldCache('getRecommendations'), true);
  assert.strictEqual(cache.shouldCache('generateExtension'), false);
});

// Test 8: Cache invalidation
await asyncTest('should invalidate cache entries matching pattern', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  await cache.set('getRecommendations:key1', 'value1');
  await cache.set('getRecommendations:key2', 'value2');
  await cache.set('otherMethod:key1', 'value3');

  cache.invalidate(/^getRecommendations:/);

  // getRecommendations entries should be invalidated
  let loaderCalled = 0;
  await cache.get('getRecommendations:key1', async () => {
    loaderCalled++;
    return 'reloaded1';
  });
  await cache.get('getRecommendations:key2', async () => {
    loaderCalled++;
    return 'reloaded2';
  });

  // otherMethod should still be cached
  const result = await cache.get('otherMethod:key1', async () => {
    throw new Error('Should not be called');
  });

  assert.strictEqual(loaderCalled, 2);
  assert.strictEqual(result, 'value3');
});

// Test 9: Cache delete
await asyncTest('should delete cache entry', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  await cache.set('test-key', 'value');
  cache.delete('test-key');

  let loaderCalled = false;
  await cache.get('test-key', async () => {
    loaderCalled = true;
    return 'reloaded';
  });

  assert.strictEqual(loaderCalled, true);
});

// Test 10: Cache clear
await asyncTest('should clear all cache entries', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');

  cache.clear();

  let loaderCalled = 0;
  await cache.get('key1', async () => {
    loaderCalled++;
    return 'reloaded1';
  });
  await cache.get('key2', async () => {
    loaderCalled++;
    return 'reloaded2';
  });

  assert.strictEqual(loaderCalled, 2);
});

// Test 11: Cache statistics
await asyncTest('should track cache statistics', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  // Warm up cache
  await cache.get('key1', async () => 'value1');  // Miss
  await cache.get('key1', async () => 'should-not-call');  // L1 hit
  await cache.get('key2', async () => 'value2');  // Miss

  const stats = cache.getStats();

  assert.strictEqual(stats.l1Hits, 1);
  assert.strictEqual(stats.misses, 2);
  assert(stats.hitRate >= 0 && stats.hitRate <= 100);
});

// Test 12: Cache without L2
await asyncTest('should work without L2 cache', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
    // No l2Directory
  });

  const value = { data: 'test' };
  await cache.set('test-key', value);

  const result = await cache.get('test-key', async () => {
    throw new Error('Should not be called');
  });

  assert.deepStrictEqual(result, value);
});

// Test 13: Complex object caching
await asyncTest('should cache complex objects', async () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  const complexObject = {
    recommendations: [
      {
        pattern: 'test',
        confidence: 0.95,
        nested: {
          deep: {
            value: 'test'
          }
        }
      }
    ],
    metadata: {
      execution_time: 150
    }
  };

  await cache.set('complex-key', complexObject);

  const result = await cache.get('complex-key', async () => {
    throw new Error('Should not be called');
  });

  assert.deepStrictEqual(result, complexObject);
});

// Test 14: L1 size tracking
await asyncTest('should track L1 cache size', async () => {
  const cache = new CacheManager({
    l1MaxItems: 5,
    l1TTL: 60000
  });

  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3');

  const stats = cache.getStats();
  assert.strictEqual(stats.l1Size, 3);
});

// Test 15: Cache key generation for complex params
test('should generate different keys for different params', () => {
  const cache = new CacheManager({
    l1MaxItems: 10,
    l1TTL: 60000
  });

  const key1 = cache.generateKey('method', {
    domain: 'finance',
    confidence: 0.8
  });

  const key2 = cache.generateKey('method', {
    domain: 'finance',
    confidence: 0.9  // Different value
  });

  assert.notStrictEqual(key1, key2);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Cache Manager Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
