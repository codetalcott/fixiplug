/**
 * Factory Functions
 * 
 * This file contains factory functions for creating FixiWithPlugins instances
 * with various configurations.
 */

import { PluginManager } from './types';
import { Fixi } from '../core/fixi';
import { StandardExtensions, createPluginManager } from './extensions';

// Cache of extensions for performance optimization
let extensionCache: any[] | null = null;

/**
 * Create and cache all extensions for reuse
 */
function getAllExtensions(): any[] {
  if (extensionCache) return extensionCache;
  
  const extensions = Object.values(StandardExtensions)
    .filter(ext => typeof ext === 'function')
    .map(ExtClass => new (ExtClass as any)());
  
  extensionCache = extensions;
  return extensions;
}

/**
 * Get essential extensions for performance mode
 */
function getPerformanceExtensions(): any[] {
  return [
    new StandardExtensions.BenchmarkExtension(),
    new StandardExtensions.TimeoutExtension(),
    new StandardExtensions.CircuitBreakerExtension()
  ];
}

/**
 * Creates a FixiWithPlugins instance with all available extensions
 */
export function createFixiWithPlugins(
  fixi: Fixi = new Fixi(), 
  options: PluginManager = {},
  mode: 'standard' | 'performance' = 'standard'
): FixiWithPlugins {
  const fixiWithPlugins = new FixiWithPlugins(fixi, options);
  
  // Apply extensions based on mode
  const extensions = mode === 'performance' 
    ? getPerformanceExtensions() 
    : getAllExtensions();
  
  extensions.forEach(ext => fixiWithPlugins.use(ext));
  
  return fixiWithPlugins;
}

/**
 * Create a FixiWithPlugins instance with only the specified extensions
 */
export function createCustomFixiWithPlugins(
  fixi: Fixi = new Fixi(),
  options: PluginManager = {},
  extensionNames: string[] = []
): FixiWithPlugins {
  const fixiWithPlugins = new FixiWithPlugins(fixi, options);
  
  // Filter extensions by name
  const allAvailableExtensions = getAllExtensions();
  const selectedExtensions = allAvailableExtensions.filter(ext => {
    const constructor = ext.constructor as any;
    const name = constructor.name || '';
    return extensionNames.some(extName => 
      name === extName || 
      name === `${extName}Extension`
    );
  });
  
  selectedExtensions.forEach(ext => fixiWithPlugins.use(ext));
  
  return fixiWithPlugins;
}

/**
 * Create a minimal FixiWithPlugins instance with no extensions
 */
export function createMinimalFixiWithPlugins(
  fixi: Fixi = new Fixi(),
  options: PluginManager = {}
): FixiWithPlugins {
  return new FixiWithPlugins(fixi, options);
}

/**
 * Helper to register multiple plugins at once
 */
export function registerPlugins(
  fixiWithPlugins: FixiWithPlugins,
  plugins: FixiPlugs[]
): number {
  let registered = 0;
  
  plugins.forEach(plugin => {
    if (fixiWithPlugins.register(plugin)) {
      registered++;
    }
  });
  
  return registered;
}