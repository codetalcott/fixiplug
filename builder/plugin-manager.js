/**
 * Plugin manager for Fixiplug
 * Handles dynamic plugin loading and swapping based on server hints
 * @module plugin-manager
 */

/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

const pluginRegistry = new Map();      // pluginId → { factory, priority }
const activePlugins  = new Map();      // pluginId → { instance, cleanup }

/**
 * @param {string} pluginId
 * @param {() => (function(PluginContext):void)|{name:string,setup:function(PluginContext):void}} pluginFactory
 * @param {{priority?: number}} [options]
 */
export function registerPlugin(pluginId, pluginFactory, options = {}) {
  pluginRegistry.set(pluginId, {
    factory: pluginFactory,
    priority: options.priority || 0
  });
}

/**
 * @param {string}              pluginId
 * @param {import('../fixiplug').fixiplug} fixiplugInstance
 * @returns {boolean}
 */
export function activatePlugin(pluginId, fixiplugInstance) {
  if (!pluginRegistry.has(pluginId)) {
    console.warn(`Plugin "${pluginId}" not found`);
    return false;
  }
  if (activePlugins.has(pluginId)) return true;

  const { factory } = pluginRegistry.get(pluginId);
  const plugin = factory();
  let cleanupFn = null;

  // wrap ctx.registerCleanup to capture cleanup
  const ctx = {
    ...fixiplugInstance._pluginContext,            // your internal context
    registerCleanup(fn) { cleanupFn = fn; }
  };

  try {
    // if plugin is a function, call it; if it's an object, call setup
    if (typeof plugin === 'function') {
      plugin(ctx);
    } else if (plugin && typeof plugin.setup === 'function') {
      plugin.setup(ctx);
    }
    activePlugins.set(pluginId, { instance: plugin, cleanup: cleanupFn });
    return true;
  } catch (err) {
    console.error(`Failed to activate "${pluginId}"`, err);
    return false;
  }
}

/**
 * @param {string}              pluginId
 * @param {import('../fixiplug').fixiplug} fixiplugInstance
 * @returns {boolean}
 */
export function deactivatePlugin(pluginId, fixiplugInstance) {
  if (!activePlugins.has(pluginId)) return true;

  const { instance, cleanup } = activePlugins.get(pluginId);
  try {
    // invoke the plugin’s cleanup if provided
    if (cleanup) cleanup();
    // remove hooks via unuse(name)
    const name = instance.name || pluginId;
    fixiplugInstance.unuse(name);
    activePlugins.delete(pluginId);
    return true;
  } catch (err) {
    console.error(`Failed to deactivate "${pluginId}"`, err);
    return false;
  }
}

/**
 * @param {import('../fixiplug').fixiplug} fixiplugInstance
 * @param {{plugins: string[]}} serverConfig
 * @returns {string[]}
 */
export function updatePlugins(fixiplugInstance, serverConfig) {
  const ids = [];
  // sort by descending priority
  for (const [pluginId] of [...pluginRegistry.entries()]
    .sort(([,a],[,b]) => b.priority - a.priority)) {
    if (serverConfig.plugins.includes(pluginId)) {
      if (activatePlugin(pluginId, fixiplugInstance)) ids.push(pluginId);
    } else {
      deactivatePlugin(pluginId, fixiplugInstance);
    }
  }
  return ids;
}
