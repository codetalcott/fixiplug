/**
 * Fixi Plugin Manager Extensions
 * 
 * This module provides extensions that enhance the PluginManager with additional
 * capabilities like circuit breaking, metrics collection, timeout protection, etc.
 * 
 * Extensions follow the same pattern: they implement the PluginManagerExtension
 * interface and hook into specific parts of the plugin lifecycle.
 */

import { Fixi } from '../../core/fixi';
import { PluginManagerExtension } from '../types';
import { PluginManager } from '../pluginManager';

// Import all extensions
import { BenchmarkExtension } from './benchmarkExtension';
import { CircuitBreakerExtension } from './circuitBreakerExtension';
import { ConditionalExecutionExtension } from './conditionalExecutionExtension';
import { FallbackExtension } from './fallbackExtension';
import { LazyLoadingExtension } from './lazyLoadingExtension';
import { LifecycleExtension } from './lifecycleExtension';
import { MemoryLeakProtectionExtension } from './memoryLeakProtectionExtension';
import { MetricsExtension } from './metricsExtension';
import { TimeoutExtension } from './timeoutExtension';
import { VersionCompatibilityExtension } from './versionExtension';

// Core interface
export { PluginManagerExtension };

// Re-export all extensions
export { BenchmarkExtension } from './benchmarkExtension';
export { CircuitBreakerExtension } from './circuitBreakerExtension';
export { ConditionalExecutionExtension } from './conditionalExecutionExtension';
export { FallbackExtension } from './fallbackExtension';
export { LazyLoadingExtension } from './lazyLoadingExtension';
export { LifecycleExtension } from './lifecycleExtension';
export { MemoryLeakProtectionExtension } from './memoryLeakProtectionExtension';
export { MetricsExtension } from './metricsExtension';
export { TimeoutExtension } from './timeoutExtension';
export { VersionCompatibilityExtension } from './versionExtension';

// Convenient bundle of all standard extension classes
export const StandardExtensions: (new () => PluginManagerExtension)[] = [
  VersionCompatibilityExtension, 
  CircuitBreakerExtension,
  MetricsExtension,
  TimeoutExtension,
  ConditionalExecutionExtension,
  FallbackExtension,
  LazyLoadingExtension,
  LifecycleExtension,
  MemoryLeakProtectionExtension
];

/**
 * Bundle of performance-optimized extensions
 * 
 * These extensions focus on improving performance monitoring
 * and stability without adding significant overhead.
 */
export const PerformanceExtensions: (new () => PluginManagerExtension)[] = [
  CircuitBreakerExtension,
  BenchmarkExtension,
  TimeoutExtension,
  MemoryLeakProtectionExtension
];

/**
 * Creates a plugin manager with all standard extensions enabled
 * 
 * This is the recommended way to create a fully-featured plugin manager.
 * 
 * @param fixi The Fixi instance to enhance
 * @returns A plugin manager with all standard extensions
 */
export function createPluginManager(fixi: Fixi): PluginManager {
  const manager = new PluginManager(fixi);
  
  // Initialize and add all standard extensions
  StandardExtensions.forEach(ExtensionClass => {
    manager.use(new ExtensionClass());
  });
  
  return manager;
}

/**
 * Creates a minimal plugin manager with no extensions
 * 
 * Use this when you need optimal performance and don't need advanced features
 * like circuit breaking, metrics, or timeout protection.
 * 
 * @param fixi The Fixi instance to enhance
 * @returns A bare-bones plugin manager with no extensions
 */
export function createMinimalPluginManager(fixi: Fixi): PluginManager {
  return new PluginManager(fixi);
}

/**
 * Creates a custom plugin manager with specific extensions
 * 
 * Use this when you want fine-grained control over which extensions are enabled.
 * 
 * @param fixi The Fixi instance to enhance
 * @param extensions Array of extension instances to use
 * @returns A plugin manager with only the specified extensions
 * 
 * @example
 * ```ts
 * const manager = createCustomPluginManager(fixi, [
 *   new CircuitBreakerExtension(),
 *   new MetricsExtension()
 * ]);
 * ```
 */
export function createCustomPluginManager(
  fixi: Fixi, 
  extensions: PluginManagerExtension[] = []
): PluginManager {
  const manager = new PluginManager(fixi);
  
  // Add provided extensions
  for (const extension of extensions) {
    manager.use(extension);
  }
  
  return manager;
}

/**
 * Creates a performance-optimized plugin manager
 * 
 * This manager is specifically configured for high-performance scenarios
 * with only the essential extensions needed for stability and performance monitoring.
 * 
 * @param fixi The Fixi instance to enhance
 * @returns A plugin manager optimized for performance
 */
export function createPerformancePluginManager(fixi: Fixi): PluginManager {
  const manager = new PluginManager(fixi);
  
  // Initialize and add only performance-focused extensions
  PerformanceExtensions.forEach(ExtensionClass => {
    manager.use(new ExtensionClass());
  });
  
  return manager;
}