// fixiplug/hook-visualizer.js

/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/**
 * @typedef {Object} PluginContext
 * @property {function(string, function, number=): void} on - Registers a hook listener with optional priority.
 * @property {function(function): void} registerCleanup - Registers a cleanup function.
 * @property {Map<string, any>} [storage] - Shared storage map for the plugin.
 */

/**
 * Hook visualizer plugin for Fixiplug.
 * @param {PluginContext} ctx - The plugin context provided by Fixiplug.
 */
export default function hooksPlug(ctx) {
  try {
    // Store original methods
    const originalDispatch = fixiplug.dispatch;
    const originalUse = fixiplug.use;

    // Track hook execution counts
    const hookExecutionCounts = {};

    // Override dispatch to count hook executions
    fixiplug.dispatch = async function (hookName, event) {
      if (!hookExecutionCounts[hookName]) {
        hookExecutionCounts[hookName] = 0;
      }
      hookExecutionCounts[hookName]++;
      return await originalDispatch.call(this, hookName, event);
    };

    // Add hook visualization with execution counts and plugin usage summary
    ctx.on('api:hooksPlug', () => {
      try {
        console.group('📊 Hook Usage Visualization');

        const pluginUsage = {};

        for (const [hookName, entries] of Object.entries(fixiplug.hooks || {})) {
          if (entries && entries.length) {
            console.group(`${hookName} (${entries.length} handlers, executed ${hookExecutionCounts[hookName] || 0} times)`);

            entries.forEach((entry, i) => {
              console.log(
                `${i + 1}. ${entry.plugin || 'unknown'} (priority: ${entry.priority || 0})`
              );

              // Track plugin usage
              if (entry.plugin) {
                if (!pluginUsage[entry.plugin]) {
                  pluginUsage[entry.plugin] = 0;
                }
                pluginUsage[entry.plugin]++;
              }
            });

            console.groupEnd();
          }
        }

        // Display plugin usage summary
        console.group('📋 Plugin Usage Summary');
        for (const [plugin, count] of Object.entries(pluginUsage)) {
          console.log(`${plugin}: ${count} hooks`);
        }
        console.groupEnd();

        console.groupEnd();
      } catch (err) {
        console.error('Error visualizing hooks:', err);
      }
    });

    // Add plugin dependency visualization
    ctx.on('api:visualizeDependencies', () => {
      // Implementation for visualizing plugin dependencies
    });

    // Register cleanup directly instead of using ctx.registerCleanup
    const cleanupHandler = () => {
      try {
        fixiplug.dispatch = originalDispatch;
        fixiplug.use = originalUse;
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
    };

    // Try to register cleanup through ctx if possible, otherwise handle manually
    try {
      if (typeof ctx.registerCleanup === 'function') {
        ctx.registerCleanup(cleanupHandler);
      } else {
        if (typeof window !== 'undefined') {
          window.addEventListener('unload', cleanupHandler);
        }
      }
    } catch (err) {
      console.warn('Could not register cleanup handler:', err);
      if (typeof window !== 'undefined') {
        window.addEventListener('unload', cleanupHandler);
      }
    }

    console.log('🛠️ Fixiplug Hook Visualizer activated');
  } catch (err) {
    console.error('Failed to initialize Hook Visualizer:', err);
  }
}