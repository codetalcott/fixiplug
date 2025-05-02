/**
 * Fixi Built-in Plugins
 * 
 * This module exports a collection of ready-to-use plugins for the Fixi library.
 * These plugins provide common functionality like caching, loading indicators, 
 * offline support, and more.
 * 
 * @module plugs
 */

import { AccessibilityPlugin } from './accessibilityPlugin';
import { AnalyticsPlugin } from './analyticsPlugin';
import { CachePlugin } from './cachePlugin';
import { LoadingPlugin } from './loadingPlugin';
import { LoggingPlugin } from './loggingPlugin';
import { OfflinePlugin } from './offlinePlugin';

/**
 * Bundle of all official plugins
 * 
 * Use this when you want to include all standard Fixi plugins in your application.
 * 
 * @example
 * ```ts
 * import { createPluginSystem } from '../hub';
 * import { OfficialPlugins } from '../plugs';
 * 
 * const enhancedFixi = createPluginSystem(fixi, {
 *   plugins: OfficialPlugins
 * });
 * ```
 */
export const OfficialPlugins = [
  AccessibilityPlugin,
  AnalyticsPlugin,
  CachePlugin,
  LoadingPlugin,
  LoggingPlugin,
  OfflinePlugin
];

/**
 * Performance-focused plugins bundle
 * 
 * A subset of plugins focused on improving application performance.
 */
export const PerformancePlugins = [
  CachePlugin,
  LoadingPlugin
];

/**
 * UX-focused plugins bundle
 * 
 * A subset of plugins focused on improving user experience.
 */
export const UXPlugins = [
  AccessibilityPlugin,
  LoadingPlugin
];

// Individual plugin exports
export {
  /**
   * Improves accessibility by adding ARIA attributes and managing focus
   */
  AccessibilityPlugin,
  
  /**
   * Tracks user interactions and page performance metrics
   */
  AnalyticsPlugin,
  
  /**
   * Caches responses to reduce network requests and improve performance
   */
  CachePlugin,
  
  /**
   * Shows loading indicators during requests and transitions
   */
  LoadingPlugin,
  
  /**
   * Provides enhanced logging capabilities for debugging
   */
  LoggingPlugin,
  
  /**
   * Enables offline support via service workers and IndexedDB
   */
  OfflinePlugin
};

// For testing purposes only
export { default as testplug } from './testplug';

/**
 * ## Plugin Capabilities
 * 
 * | Plugin | Hooks | Features |
 * |--------|-------|----------|
 * | AccessibilityPlugin | DOM_MUTATED | ARIA attributes, focus management |
 * | AnalyticsPlugin | BEFORE_REQUEST, AFTER_RESPONSE | Performance tracking, user behavior analytics |
 * | CachePlugin | BEFORE_REQUEST, AFTER_RESPONSE | Response caching, conditional requests |
 * | LoadingPlugin | BEFORE_REQUEST, AFTER_RESPONSE | Loading indicators, progress feedback |
 * | LoggingPlugin | BEFORE_REQUEST, AFTER_RESPONSE, ERROR | Console logging, error reporting |
 * | OfflinePlugin | BEFORE_REQUEST, AFTER_RESPONSE | Offline caching, background sync |
 * 
 * ## Example Usage
 * 
 * ```ts
 * import { createPluginSystem } from '../hub';
 * import { Fixi } from '../core/fixi';
 * import { CachePlugin, LoadingPlugin } from '../plugs';
 * 
 * // Create enhanced Fixi with selected plugins
 * const fixi = new Fixi();
 * const enhancedFixi = createPluginSystem(fixi, {
 *   plugins: [CachePlugin, LoadingPlugin]
 * });
 * 
 * // Use enhanced Fixi with plugins
 * enhancedFixi.get('/api/data').then(response => {
 *   // CachePlugin may have served from cache
 *   // LoadingPlugin shows/hides loading indicators automatically
 *   console.log(response);
 * });
 * ```
 */
