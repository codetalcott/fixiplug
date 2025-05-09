/**
 * Hooks system for Fixi
 * @module core/hooks
 */

// Hook storage
const hooks = {};

// Plugin registry
const pluginRegistry = new Map();

// Disabled plugins
const disabledPlugins = new Set();

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
  let result = event;

  // Process specific hook handlers
  if (hooks[hookName] && hooks[hookName].length) {
    // Process each handler, skipping disabled plugins
    for (const { handler, plugin } of hooks[hookName]) {
      // Skip handlers from disabled plugins
      if (disabledPlugins.has(plugin)) {
        continue;
      }

      try {
        result = await handler(result, hookName) || result;
      } catch (error) {
        console.error(`Error in hook: ${hookName}`, error);
        // Don't rethrow to avoid breaking the chain
      }
    }
  }

  // Process wildcard handlers (if any)
  if (hooks['*'] && hooks['*'].length) {
    for (const { handler, plugin } of hooks['*']) {
      // Skip handlers from disabled plugins
      if (disabledPlugins.has(plugin)) {
        continue;
      }

      try {
        result = await handler(result, hookName) || result;
      } catch (error) {
        console.error(`Error in wildcard hook for: ${hookName}`, error);
      }
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
  disabledPlugins.delete(pluginName); // Clean up if it was disabled
}

/**
 * Disable a plugin's hooks
 * @param {string} pluginName - The plugin to disable
 */
export function disablePlugin(pluginName) {
  console.log(`[hooks] Disabling plugin: ${pluginName}`);
  console.log(`[hooks] Current hooks:`, hooks);
  disabledPlugins.add(pluginName);
  console.log(`[hooks] Disabled plugins:`, Array.from(disabledPlugins));
}

/**
 * Enable a disabled plugin's hooks
 * @param {string} pluginName - The plugin to enable
 */
export function enablePlugin(pluginName) {
  console.log(`[hooks] Enabling plugin: ${pluginName}`);
  disabledPlugins.delete(pluginName);
  console.log(`[hooks] Disabled plugins after enable:`, Array.from(disabledPlugins));
}

// Export storage
export { hooks, pluginRegistry, disabledPlugins };