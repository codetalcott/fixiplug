/**
 * Fixiplug - A plugin system for fixi.js
 * @module fixiplug
 * @see {@link types.js} for full type definitions
 * @description Unified entry point providing different configurations for various environments
 */

import { createFixiplug } from './builder/fixiplug-factory.js';

/**
 * Standard browser version with DOM integration
 * @type {Object}
 */
export const fixiplug = createFixiplug({
  enableLogging: true,
  enableDom: true,
  testMode: false,
  serverMode: false
});

/**
 * Core version without DOM dependencies
 * @type {Object}
 */
export const core = createFixiplug({
  enableLogging: true,
  enableDom: false,
  testMode: false,
  serverMode: false
});

/**
 * Test-friendly version with enhanced debugging
 * @type {Object}
 */
export const test = createFixiplug({
  enableLogging: true,
  enableDom: false,
  testMode: true,
  serverMode: false
});

/**
 * Server-optimized version
 * @type {Object}
 */
export const server = createFixiplug({
  enableLogging: false,
  enableDom: false,
  testMode: false,
  serverMode: true
});

/**
 * Minimal version with no plugins or environment detection
 * @type {Object}
 */
export const minimal = createFixiplug({
  enableLogging: false,
  enableDom: false,
  testMode: false,
  serverMode: false,
  minimal: true
});


/**
 * Create a custom fixiplug instance with specified configuration
 * @param {Object} config - Configuration options
 * @param {boolean} [config.logging=true] - Enable logging
 * @param {boolean} [config.dom=false] - Enable DOM integration
 * @param {boolean} [config.test=false] - Enable test features
 * @param {boolean} [config.server=false] - Optimize for server environment
 * @param {Object} [config.advanced] - Advanced configuration options
 * @returns {Object} Custom fixiplug instance
 */
export function configure(config = {}) {
  return createFixiplug({
    ...baseConfig,
    // Override with explicit settings
    enableLogging: config.logging ?? baseConfig.enableLogging ?? true,
    enableDom: config.dom ?? baseConfig.enableDom ?? false,
    testMode: config.test ?? baseConfig.testMode ?? false,
    serverMode: config.server ?? baseConfig.serverMode ?? false,
    ...config.advanced
  });
}

// Export standard version as default
export default fixiplug;


// Auto-attach the default version to window in browser environments
if (typeof window !== 'undefined') {
  window.fixiplug = fixiplug;
}