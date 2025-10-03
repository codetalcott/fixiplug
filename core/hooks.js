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

// Error queue to prevent recursive dispatching
const errorQueue = [];
let processingErrors = false;

/**
 * Process queued errors without causing recursion
 */
async function processErrorQueue() {
  if (processingErrors || errorQueue.length === 0) return;

  processingErrors = true;
  while (errorQueue.length > 0) {
    const errorEvent = errorQueue.shift();
    try {
      // Process error handlers directly without going through dispatch
      if (hooks['pluginError'] && hooks['pluginError'].length) {
        for (const { handler, plugin } of hooks['pluginError']) {
          if (!disabledPlugins.has(plugin)) {
            try {
              await handler(errorEvent);
            } catch (e) {
              // Silent fail - error handlers should not throw
              console.error('Error in error handler:', e);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error processing error queue:', e);
    }
  }
  processingErrors = false;
}

// Deferred event queue for plugin-emitted events
const deferredQueue = [];
let processingDeferred = false;
const MAX_DEFERRED_QUEUE_SIZE = 1000;

// Track deferred event counts to detect infinite loops
const deferredEventCounts = new Map();

/**
 * Process deferred events emitted by plugins
 * This prevents infinite recursion by processing events after the current dispatch completes
 */
async function processDeferredQueue() {
  if (processingDeferred || deferredQueue.length === 0) return;

  processingDeferred = true;

  // Process in batches to prevent infinite loops
  const batchSize = Math.min(50, deferredQueue.length);
  let processed = 0;

  while (deferredQueue.length > 0 && processed < batchSize) {
    const { hookName, event } = deferredQueue.shift();
    processed++;

    try {
      await dispatch(hookName, event);
    } catch (e) {
      console.error('Error processing deferred event:', e);
    }
  }

  processingDeferred = false;

  // If queue still has items, schedule next batch
  if (deferredQueue.length > 0) {
    setTimeout(() => processDeferredQueue(), 0);
  } else {
    // Clear counts when queue is empty
    deferredEventCounts.clear();
  }
}

/**
 * Queue an event for deferred dispatch
 * Used by ctx.emit() to prevent recursion
 * @param {string} hookName - The hook to dispatch
 * @param {Object} event - The event data
 */
export function queueDeferredEvent(hookName, event) {
  // Prevent queue from growing too large (infinite loop protection)
  if (deferredQueue.length >= MAX_DEFERRED_QUEUE_SIZE) {
    console.warn(`[FixiPlug] Deferred queue is full (${MAX_DEFERRED_QUEUE_SIZE}). Dropping event: ${hookName}`);
    console.warn('[FixiPlug] This usually indicates an infinite event loop.');
    return;
  }

  // Track event frequency to detect tight loops
  const count = (deferredEventCounts.get(hookName) || 0) + 1;
  deferredEventCounts.set(hookName, count);

  if (count > 100) {
    console.warn(`[FixiPlug] Event "${hookName}" has been emitted ${count} times. Possible infinite loop.`);
    if (count > 500) {
      console.error(`[FixiPlug] Event "${hookName}" emitted too many times (${count}). Dropping to prevent infinite loop.`);
      return;
    }
  }

  deferredQueue.push({ hookName, event });

  // Trigger processing if not already running
  if (!processingDeferred) {
    setTimeout(() => processDeferredQueue(), 0);
  }
}

// Re-entrance prevention: track currently executing hooks
const activeHooks = new Set();

/**
 * Dispatch a hook event
 * @param {string} hookName - The hook to dispatch
 * @param {Object} event - The event data
 * @returns {Promise<Object>} The processed event data
 */
export async function dispatch(hookName, event = {}) {
  // Prevent re-entrance to same hook
  if (activeHooks.has(hookName)) {
    console.warn(`[FixiPlug] Hook "${hookName}" is already executing. Skipping recursive call to prevent infinite loop.`);
    return event;
  }

  activeHooks.add(hookName);

  try {
    let result = event;

    // Get all relevant handlers (specific + wildcard) in single pass
    const allHandlers = [];

    // Add specific handlers
    if (hooks[hookName] && hooks[hookName].length) {
      allHandlers.push(...hooks[hookName]);
    }

    // Add wildcard handlers
    if (hooks['*'] && hooks['*'].length) {
      allHandlers.push(...hooks['*']);
    }

    // Process all handlers in single pass
    for (const { handler, plugin } of allHandlers) {
      // Skip handlers from disabled plugins
      if (disabledPlugins.has(plugin)) {
        continue;
      }

      try {
        result = await handler(result, hookName) || result;
      } catch (error) {
        // Queue error for async processing to prevent recursion
        errorQueue.push({
          plugin,
          hookName,
          error,
          event: result
        });

        // Don't rethrow to avoid breaking the chain
      }
    }

    // Process any queued errors asynchronously
    if (errorQueue.length > 0) {
      setTimeout(() => processErrorQueue(), 0);
    }

    return result;
  } finally {
    activeHooks.delete(hookName);

    // Process deferred events after this dispatch completes
    if (deferredQueue.length > 0 && !processingDeferred) {
      setTimeout(() => processDeferredQueue(), 0);
    }
  }
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
  disabledPlugins.add(pluginName);
}

/**
 * Enable a disabled plugin's hooks
 * @param {string} pluginName - The plugin to enable
 */
export function enablePlugin(pluginName) {
  disabledPlugins.delete(pluginName);
}

// Export storage
export { hooks, pluginRegistry, disabledPlugins };