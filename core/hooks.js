/**
 * Hooks system for Fixi
 * @module core/hooks
 */

// Hook storage
const hooks = {};

// Plugin registry
const pluginRegistry = new Map();

// Priority constants
export const PRIORITY = {
  HIGH: 100,
  NORMAL: 0,
  LOW: -100
};

/**
 * Register a hook handler
 * @param {string} hookName - The name of the hook to register for
 * @param {Function} handler - The handler function
 * @param {string} plugin - The plugin name
 * @param {number} [priority=0] - The priority (higher runs first)
 */
export function on(hookName, handler, plugin, priority = 0) {
  if (!hooks[hookName]) {
    hooks[hookName] = [];
  }
  
  hooks[hookName].push({
    plugin,
    handler,
    priority
  });
  
  // Sort handlers by priority (high to low)
  hooks[hookName].sort((a, b) => b.priority - a.priority);
}

/**
 * Remove a hook handler
 * @param {string} hookName - The hook name
 * @param {Function} handler - The handler to remove
 */
export function off(hookName, handler) {
  if (!hooks[hookName]) return;
  
  hooks[hookName] = hooks[hookName].filter(h => h.handler !== handler);
}

/**
 * Remove all handlers for a plugin
 * @param {string} pluginName - The plugin name
 */
export function removePluginHooks(pluginName) {
  for (const hookName in hooks) {
    hooks[hookName] = hooks[hookName].filter(h => h.plugin !== pluginName);
  }
}

/**
 * Dispatch a hook event
 * @param {string} hookName - The hook to dispatch
 * @param {Object} event - The event data
 * @returns {Promise<Object>} The processed event data
 */
export async function dispatch(hookName, event = {}) {
  if (!hooks[hookName] || !hooks[hookName].length) {
    return event;
  }
  
  let result = event;
  
  // Process each handler
  for (const { handler } of hooks[hookName]) {
    try {
      result = await handler(result, hookName) || result;
    } catch (error) {
      console.error(`Error in hook: ${hookName}`, error);
      // Don't rethrow to avoid breaking the chain
    }
  }
  
  return result;
}

/**
 * Register a plugin
 * @param {Object|Function} plugin - The plugin to register
 */
export function registerPlugin(plugin) {
  // Extract plugin metadata
  const name = typeof plugin === 'function' 
    ? (plugin.name || 'anonymous') 
    : (plugin.name || 'anonymous');
  
  pluginRegistry.set(name, plugin);
}

/**
 * Unregister a plugin
 * @param {string} pluginName - The plugin to unregister
 */
export function unregisterPlugin(pluginName) {
  pluginRegistry.delete(pluginName);
  removePluginHooks(pluginName);
}

// Export storage
export { hooks, pluginRegistry };