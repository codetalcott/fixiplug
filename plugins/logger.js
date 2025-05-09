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
  // 1) keep original dispatch
  const originalDispatch = fixiplug.dispatch.bind(fixiplug);

  // 2) in-memory storage for logs
  const logs = [];
  ctx.storage = new Map();
  ctx.storage.set('logs', logs);

  // 3) override dispatch
  fixiplug.dispatch = async function (hookName, event) {
    const ts = new Date().toISOString();
    const handlers = (this.hooks[hookName] || []).map(e => e.plugin);
    console.groupCollapsed(`[fixiplug][${hookName}] @ ${ts}`);
    console.log('→ event:', event);
    console.log('→ handlers:', handlers.join(', ') || '(none)');
    const start = performance.now();

    let result;
    try {
      result = await originalDispatch(hookName, event);
    } catch (err) {
      console.error(`❌ [${hookName}]`, err);
    }

    const duration = performance.now() - start;
    console.log(`← duration: ${duration.toFixed(2)}ms`);
    console.groupEnd();

    // 4) record to in-memory log
    logs.push({ hookName, event, handlers, ts, duration });

    // 4.1) append log to DOM element if available
    const logEl = document.getElementById('log');
    if (logEl) {
      const p = document.createElement('p');
      p.textContent = `…`;
      logEl.appendChild(p);
    }

    return result;
  };

  // 5) expose an API to retrieve logs
  ctx.on('api:getLogs', () => ({ logs }));

  // 6) cleanup on plugin unload
  if (typeof ctx.registerCleanup === 'function') {
    ctx.registerCleanup(() => {
      fixiplug.dispatch = originalDispatch;
    });
  }

  console.log('🔍 Fixiplug logger active – tracking all hooks');
}