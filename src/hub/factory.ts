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
import * as extensions from './extensions/';

// Cache of extensions for performance optimization
let extensionCache: PluginManagerExtension[] | null = null;

/**
 * Gets all available extensions from the extensions module
 * 
 * @returns Array of all extension instances
 */
function getAllExtensions(): PluginManagerExtension[] {
  if (extensionCache === null) {
    extensionCache = Object.values(extensions)
      .filter(Extension => typeof Extension === 'function')
      .map(Extension => new (Extension as any)());
  }
  return extensionCache;
}

/**
 * Create a client instance with specified extensions
 * 
 * @param fixi - Optional Fixi instance (creates new one if not provided)
 * @param options - Plugin manager configuration options
 * @param extensionNames - Array of extension names to include
 * @returns Configured client instance with only specified extensions
 */
export function createClient(
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