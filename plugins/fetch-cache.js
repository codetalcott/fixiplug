/**
 * Fetch Cache Plugin
 * @module plugins/fetch-cache
 *
 * Simple in-memory cache for GET requests with configurable TTL.
 * Demonstrates advanced usage of fetch:before and fetch:ready hooks.
 *
 * API Hooks Exposed:
 * - api:clearCache - Clear all cached entries
 * - api:getCacheStats - Get cache statistics
 *
 * Events Listened To:
 * - fetch:before - Check cache for GET requests
 * - fetch:ready - Store successful GET responses
 *
 * @example
 * import fetchCache from './plugins/fetch-cache.js';
 *
 * const fixiplug = createFixiplug();
 * fixiplug.use(fetchCache);
 *
 * // First request hits the network
 * await fixiplug.fetch({ action: '/api/data', method: 'GET' });
 *
 * // Second request uses cache (within TTL)
 * await fixiplug.fetch({ action: '/api/data', method: 'GET' });
 *
 * // Clear cache programmatically
 * await fixiplug.dispatch('api:clearCache');
 */

const DEFAULT_TTL = 60000; // 60 seconds
const MAX_CACHE_SIZE = 100;

export default function fetchCache(ctx) {
  const cache = new Map();
  let hits = 0;
  let misses = 0;

  // ========================================
  // Cache Entry Structure
  // ========================================
  function createEntry(response, timestamp) {
    return {
      response: {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        data: null // Will be populated async
      },
      timestamp,
      hits: 0
    };
  }

  // ========================================
  // Cache Key Generation
  // ========================================
  function getCacheKey(url, method) {
    return `${method}:${url}`;
  }

  // ========================================
  // Cache Cleanup
  // ========================================
  function evictExpired(ttl = DEFAULT_TTL) {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > ttl) {
        cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  function evictLRU() {
    // Find least recently used (oldest timestamp, fewest hits)
    let lruKey = null;
    let lruScore = Infinity;

    for (const [key, entry] of cache.entries()) {
      const score = entry.timestamp / (entry.hits + 1);
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
    }
  }

  // ========================================
  // Intercept: Before Fetch (Check Cache)
  // ========================================
  ctx.on('fetch:before', (event) => {
    const { url, method, cfg } = event;

    // Only cache GET requests
    if (method !== 'GET') return event;

    // Generate cache key from original URL (before any modifications)
    const key = getCacheKey(cfg?.action || url, method);
    event.__cacheKey = key; // Store for later use

    const entry = cache.get(key);
    const ttl = cfg?.cacheTTL || DEFAULT_TTL;

    // Check if cached and not expired
    if (entry && Date.now() - entry.timestamp < ttl) {
      hits++;
      entry.hits++;

      // Mark event as cached (prevents actual fetch)
      event.__cached = true;
      event.__cacheEntry = entry;

      if (ctx.debug) {
        console.log(`[Cache] HIT: ${key}`);
      }
    } else {
      misses++;

      if (ctx.debug && entry) {
        console.log(`[Cache] EXPIRED: ${key}`);
        cache.delete(key);
      } else if (ctx.debug) {
        console.log(`[Cache] MISS: ${key}`);
      }
    }

    return event;
  });

  // ========================================
  // Intercept: Response Ready (Store in Cache)
  // ========================================
  ctx.on('fetch:ready', async (event) => {
    const { cfg, response } = event;

    // Only cache successful GET requests
    if (cfg.method !== 'GET' || !response.ok) return event;

    // Skip if already cached (from before hook)
    if (event.__cached) return event;

    // Use the same key that was generated in fetch:before
    const key = event.__cacheKey || getCacheKey(cfg.action, cfg.method);

    // Evict expired entries
    evictExpired();

    // Enforce max cache size (LRU eviction)
    if (cache.size >= MAX_CACHE_SIZE) {
      evictLRU();
    }

    // Store in cache
    const entry = createEntry(event.response, Date.now());
    cache.set(key, entry);

    if (ctx.debug) {
      console.log(`[Cache] STORE: ${key} (size: ${cache.size})`);
    }

    return event;
  });

  // ========================================
  // API: Clear Cache
  // ========================================
  ctx.on('api:clearCache', (event) => {
    const size = cache.size;
    cache.clear();
    hits = 0;
    misses = 0;

    return {
      success: true,
      cleared: size
    };
  });

  // ========================================
  // API: Get Cache Stats
  // ========================================
  ctx.on('api:getCacheStats', (event) => {
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    return {
      size: cache.size,
      hits,
      misses,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      entries: Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        hits: entry.hits
      }))
    };
  });

  // ========================================
  // Cleanup
  // ========================================
  ctx.registerCleanup(() => {
    cache.clear();
  });
}
