/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/**
 * @typedef {Object} PluginContext
 * @property {function(string, function): void} on - Registers a hook listener.
 * @property {function(function): void} registerCleanup - Registers a cleanup function.
 * @property {Map<string, any>} storage - A shared storage map for the plugin.
 */

/**
 * Logger plugin for Fixiplug.
 * @param {PluginContext} ctx - The plugin context provided by Fixiplug.
 */
export default function loggerPlug(ctx) {
  const logs = [];

  const logEvent = (hookName, event) => {
    const timestamp = new Date().toISOString();
    logs.push({ ts: timestamp, hookName, event });
    console.log(`[${timestamp}] ${hookName} →`, event);
  };

  // Listen for all events and log them
  ctx.on('*', (event, hookName) => {
    if (hookName === 'api:getLogs') return; // Prevent infinite loop
    logEvent(hookName, event);
  });

  // Expose logs via a custom hook
  ctx.on('api:getLogs', () => ({ logs }));
}