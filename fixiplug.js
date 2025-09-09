/**
 * Fixiplug - A plugin system for fixi.js
 * @module fixiplug
 * @see {@link types.js} for full type definitions
 * @description Unified entry point providing different configurations for various environments
 */

import { createFixiplug, FEATURE_SETS, FEATURES } from './builder/fixiplug-factory.js';

/**
 * Standard browser version with DOM integration
 * @type {Object}
 */
export const fixiplug = createFixiplug({
  features: FEATURE_SETS.BROWSER
});

/**
 * Core version without DOM dependencies
 * @type {Object}
 */
export const core = createFixiplug({
  features: FEATURE_SETS.CORE
});

/**
 * Test-friendly version with enhanced debugging
 * @type {Object}
 */
export const test = createFixiplug({
  features: FEATURE_SETS.TEST
});

/**
 * Server-optimized version
 * @type {Object}
 */
export const server = createFixiplug({
  features: FEATURE_SETS.SERVER
});

/**
 * Minimal version with no plugins
 * @type {Object}
 */
export const minimal = createFixiplug({
  features: FEATURE_SETS.MINIMAL
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
  // If explicit features array provided, use it directly
  if (Array.isArray(config.features)) {
    return createFixiplug({
      features: config.features,
      advanced: config.advanced || {}
    });
  }
  
  // Otherwise, convert legacy boolean config to features array
  const features = [];
  
  if (config.logging !== false) features.push(FEATURES.LOGGING);
  if (config.dom === true) features.push(FEATURES.DOM);
  if (config.test === true) features.push(FEATURES.TESTING);
  if (config.server === true) features.push(FEATURES.SERVER);
  
  return createFixiplug({
    features,
    advanced: config.advanced || {}
  });
}

// Export standard version as default
export default fixiplug;

// Auto-attach the default version to window in browser environments
if (typeof window !== 'undefined') {
  window.fixiplug = fixiplug;
}