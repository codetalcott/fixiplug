/**
 * Factory Functions
 * 
 * This file contains factory functions for creating client instances
 * with various configurations.
 */

import { PluginClient } from './client';
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

// Removed mode-specific extension filtering

/**
 * Creates a client instance with all available extensions
 * 
 * @param fixi - Optional Fixi instance (creates new one if not provided)
 * @param options - Plugin manager configuration options
 * @returns Configured client instance
 */
export function createClient(
  fixi: Fixi = new Fixi(),
  options: PluginManagerOptions = {}
): PluginClient {
  const client = new PluginClient(fixi, options);
  // Apply all standard extensions
  getAllExtensions().forEach(ext => client.use(ext));
  return client;
}

// Removed minimal client creator; use createClient or custom creator as needed

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
): PluginClient {
  const client = new PluginClient(fixi, options);
  
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
 * Helper to register multiple plugins at once
 * 
 * @param client - The target client instance
 * @param plugins - Array of plugins to register
 * @returns Number of successfully registered plugins
 * @throws Error if client is null or undefined
 */
export function registerPlugins(
  client: PluginClient,
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