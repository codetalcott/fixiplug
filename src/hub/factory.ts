/**
 * Factory Functions
 * 
 * This file contains factory functions for creating client instances
 * with various configurations.
 */

import { client } from './client';
import { FixiPlugs, PluginManagerExtension } from './types';

type PluginManagerOptions = any;
import { Fixi } from '../core/fixi';
import { StandardExtensions } from './extensions';

// Cache of extensions for performance optimization
let extensionCache: PluginManagerExtension[] | null = null;

/**
 * Create and cache all standard extensions for reuse
 * @returns Array of instantiated extensions
 */
function getAllExtensions(): PluginManagerExtension[] {
  if (extensionCache) return extensionCache;
  
  const extensions = Object.values(StandardExtensions)
    .filter(ext => typeof ext === 'function')
    .map(ExtClass => new (ExtClass as any)());
  
  extensionCache = extensions;
  return extensions;
}

/**
 * Get essential extensions for performance-focused scenarios
 * @returns Array of performance-critical extensions
 */
function getPerformanceExtensions(): PluginManagerExtension[] {
  const names = ['BenchmarkExtension', 'TimeoutExtension', 'CircuitBreakerExtension'];
  return getAllExtensions().filter(ext =>
    names.includes((ext.constructor as any).name)
  );
}

/**
 * Creates a client instance with all available extensions
 * 
 * @param fixi - Optional Fixi instance (creates new one if not provided)
 * @param options - Plugin manager configuration options
 * @param mode - Configuration mode ('standard' includes all extensions, 'performance' includes only performance-critical ones)
 * @returns Configured client instance
 */
export function createClient(
  fixi: Fixi = new Fixi(), 
  options: PluginManagerOptions = {},
  mode: 'standard' | 'performance' = 'standard'
): client {
  const client = new client(fixi, options);
  
  // Apply extensions based on mode
  const extensions = mode === 'performance' 
    ? getPerformanceExtensions() 
    : getAllExtensions();
  
  extensions.forEach(ext => client.use(ext));
  
  return client;
}

/**
 * Create a client instance with only the specified extensions
 * 
 * @param fixi - Optional Fixi instance (creates new one if not provided)
 * @param options - Plugin manager configuration options
 * @param extensionNames - Array of extension names to include
 * @returns Configured client instance with only specified extensions
 */
export function createCustomPluginClient(
  fixi: Fixi = new Fixi(),
  options: PluginManagerOptions = {},
  extensionNames: string[] = []
): client {
  const client = new client(fixi, options);
  
  if (extensionNames.length === 0) {
    return client;
  }
  
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
  
  selectedExtensions.forEach(ext => client.use(ext));
  
  return client;
}

/**
 * Create a minimal client instance with no extensions
 * 
 * @param fixi - Optional Fixi instance (creates new one if not provided)
 * @param options - Plugin manager configuration options
 * @returns Bare client instance without any extensions
 */
export function createMinimalPluginClient(
  fixi: Fixi = new Fixi(),
  options: PluginManagerOptions = {}
): client {
  return new client(fixi, options);
}

/**
 * Helper to register multiple plugins at once
 * 
 * @param client - The target client instance
 * @param plugins - Array of plugins to register
 * @returns Number of successfully registered plugins
 * @throws Error if client is null or undefined
 */
export function registerPlugins(
  client: client,
  plugins: FixiPlugs[]
): number {
  if (!client) {
    throw new Error('Cannot register plugins: client instance is required');
  }
  
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return 0;
  }
  
  let registered = 0;
  
  plugins.forEach(plugin => {
    if (client.register(plugin)) {
      registered++;
    }
  });
  
  return registered;
}