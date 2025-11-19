/**
 * Multi-Level Cache Manager for SQLite Framework Bridge
 *
 * Implements two-level caching:
 * - L1: In-memory LRU cache (hot data, fast access)
 * - L2: File-based cache (warm data, persistent)
 *
 * @module sdk/adapters/sqlite-framework/cache-manager
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CacheError } from './errors.js';

/**
 * LRU Cache implementation
 *
 * @class LRUCache
 * @private
 */
class LRUCache {
  /**
   * Create an LRU cache
   * @param {number} maxItems - Maximum number of items
   * @param {number} ttl - Time to live in milliseconds
   */
  constructor(maxItems, ttl) {
    this.maxItems = maxItems;
    this.ttl = ttl;
    this.cache = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxItems) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} Number of entries
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all keys
   * @returns {Array<string>} Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }
}

/**
 * File-based cache implementation
 *
 * @class FileCache
 * @private
 */
class FileCache {
  /**
   * Create a file cache
   * @param {string} directory - Cache directory
   * @param {number} maxSize - Maximum total size in bytes
   * @param {number} ttl - Time to live in milliseconds
   */
  constructor(directory, maxSize, ttl) {
    this.directory = directory;
    this.maxSize = maxSize;
    this.ttl = ttl;

    // Ensure directory exists
    try {
      mkdirSync(directory, { recursive: true });
    } catch (error) {
      throw new CacheError(`Failed to create cache directory: ${directory}`, {
        error: error.message
      });
    }
  }

  /**
   * Get cache file path for a key
   * @param {string} key - Cache key
   * @returns {string} File path
   * @private
   */
  _getPath(key) {
    const hash = createHash('md5').update(key).digest('hex');
    return join(this.directory, `${hash}.json`);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null
   */
  async get(key) {
    const path = this._getPath(key);

    try {
      const content = readFileSync(path, 'utf-8');
      const entry = JSON.parse(content);

      // Check TTL
      if (Date.now() - entry.timestamp > this.ttl) {
        unlinkSync(path);
        return null;
      }

      return entry.value;

    } catch (error) {
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const path = this._getPath(key);

    try {
      const entry = {
        value,
        timestamp: Date.now(),
        key
      };

      writeFileSync(path, JSON.stringify(entry));

      // Check total size and evict if needed
      await this._evictIfNeeded();

    } catch (error) {
      throw new CacheError('Failed to write cache file', {
        key,
        error: error.message
      });
    }
  }

  /**
   * Delete a key
   * @param {string} key - Cache key
   */
  delete(key) {
    const path = this._getPath(key);

    try {
      unlinkSync(path);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    try {
      const files = readdirSync(this.directory);

      for (const file of files) {
        if (file.endsWith('.json')) {
          unlinkSync(join(this.directory, file));
        }
      }
    } catch (error) {
      throw new CacheError('Failed to clear cache', {
        error: error.message
      });
    }
  }

  /**
   * Get total cache size
   * @returns {number} Total size in bytes
   * @private
   */
  _getTotalSize() {
    try {
      const files = readdirSync(this.directory);
      let total = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const stat = statSync(join(this.directory, file));
          total += stat.size;
        }
      }

      return total;

    } catch (error) {
      return 0;
    }
  }

  /**
   * Evict old files if total size exceeds limit
   * @private
   */
  async _evictIfNeeded() {
    const totalSize = this._getTotalSize();

    if (totalSize <= this.maxSize) {
      return;
    }

    try {
      // Get all cache files with their stats
      const files = readdirSync(this.directory)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const path = join(this.directory, f);
          const stat = statSync(path);
          return { path, mtime: stat.mtime };
        })
        .sort((a, b) => a.mtime - b.mtime); // Oldest first

      // Delete oldest files until under limit
      let currentSize = totalSize;
      for (const file of files) {
        if (currentSize <= this.maxSize) {
          break;
        }

        const stat = statSync(file.path);
        unlinkSync(file.path);
        currentSize -= stat.size;
      }

    } catch (error) {
      // Log but don't throw
      console.error('Cache eviction error:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    try {
      const files = readdirSync(this.directory).filter(f => f.endsWith('.json'));
      const totalSize = this._getTotalSize();

      return {
        entries: files.length,
        totalSize,
        maxSize: this.maxSize,
        utilizationPercent: (totalSize / this.maxSize) * 100
      };

    } catch (error) {
      return {
        entries: 0,
        totalSize: 0,
        maxSize: this.maxSize,
        utilizationPercent: 0
      };
    }
  }
}

/**
 * Multi-level cache manager
 *
 * @class CacheManager
 *
 * @example
 * const cache = new CacheManager({
 *   l1MaxItems: 1000,
 *   l1TTL: 60000,
 *   l2Directory: '.cache',
 *   l2MaxSize: 100 * 1024 * 1024,
 *   l2TTL: 3600000
 * });
 *
 * // Get with cache-aside pattern
 * const value = await cache.get('key', async () => {
 *   return await expensiveOperation();
 * });
 */
export class CacheManager {
  /**
   * Create a cache manager
   * @param {Object} config - Cache configuration
   */
  constructor(config) {
    this.config = config;

    // L1: In-memory LRU cache
    this.l1 = new LRUCache(
      config.l1MaxItems || 1000,
      config.l1TTL || 60000
    );

    // L2: File-based cache
    if (config.l2Directory) {
      this.l2 = new FileCache(
        config.l2Directory,
        config.l2MaxSize || 100 * 1024 * 1024,
        config.l2TTL || 3600000
      );
    } else {
      this.l2 = null;
    }

    // Statistics
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Generate cache key
   *
   * @param {string} method - Method name
   * @param {Object} params - Method parameters
   * @returns {string} Cache key
   *
   * @example
   * const key = cache.generateKey('getRecommendations', { domain: 'finance' });
   */
  generateKey(method, params) {
    const hash = createHash('sha256')
      .update(JSON.stringify({ method, params }))
      .digest('hex');
    return `${method}:${hash}`;
  }

  /**
   * Get value from cache with cache-aside pattern
   *
   * @param {string} key - Cache key
   * @param {Function} loader - Async function to load value on miss
   * @returns {Promise<*>} Cached or loaded value
   *
   * @example
   * const value = await cache.get('key', async () => {
   *   return await loadFromDatabase();
   * });
   */
  async get(key, loader) {
    // Try L1 cache
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      this.stats.l1Hits++;
      return l1Value;
    }

    // Try L2 cache
    if (this.l2) {
      const l2Value = await this.l2.get(key);
      if (l2Value !== null) {
        this.stats.l2Hits++;
        // Promote to L1
        this.l1.set(key, l2Value);
        return l2Value;
      }
    }

    // Cache miss - load value
    this.stats.misses++;
    const value = await loader();

    // Store in both levels
    this.l1.set(key, value);
    if (this.l2) {
      await this.l2.set(key, value);
    }

    this.stats.sets++;

    return value;
  }

  /**
   * Set value in cache
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @returns {Promise<void>}
   *
   * @example
   * await cache.set('key', value);
   */
  async set(key, value) {
    this.l1.set(key, value);

    if (this.l2) {
      await this.l2.set(key, value);
    }

    this.stats.sets++;
  }

  /**
   * Delete key from cache
   *
   * @param {string} key - Cache key
   *
   * @example
   * cache.delete('key');
   */
  delete(key) {
    this.l1.delete(key);

    if (this.l2) {
      this.l2.delete(key);
    }
  }

  /**
   * Clear all caches
   */
  clear() {
    this.l1.clear();

    if (this.l2) {
      this.l2.clear();
    }

    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Invalidate cache entries matching a pattern
   *
   * @param {string|RegExp} pattern - Pattern to match
   *
   * @example
   * cache.invalidate(/^getRecommendations:/);
   */
  invalidate(pattern) {
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern)
      : pattern;

    // Invalidate L1
    for (const key of this.l1.keys()) {
      if (regex.test(key)) {
        this.l1.delete(key);
      }
    }

    // L2 invalidation not implemented (would require scanning directory)
  }

  /**
   * Check if method should be cached
   *
   * @param {string} method - Method name
   * @returns {boolean} True if method results should be cached
   */
  shouldCache(method) {
    const cacheableMethods = [
      'getRecommendations',
      'findSimilarPatterns',
      'getPatternStatistics',
      'detectAgentType',
      'getAgentCapabilities',
      'getTokenBudget'
    ];

    return cacheableMethods.includes(method);
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   *
   * @example
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${stats.hitRate}%`);
   */
  getStats() {
    const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;

    return {
      ...this.stats,
      totalRequests,
      totalHits,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      l1Size: this.l1.size,
      l2Stats: this.l2 ? this.l2.getStats() : null
    };
  }
}

/**
 * Create a cache manager instance
 *
 * @param {Object} config - Cache configuration
 * @returns {CacheManager} Cache manager instance
 *
 * @example
 * const cache = createCacheManager({ l1MaxItems: 1000 });
 */
export function createCacheManager(config) {
  return new CacheManager(config);
}
