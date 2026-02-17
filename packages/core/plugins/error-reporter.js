/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/**
 * Error reporter plugin for Fixiplug.
 */
export default {
  name: 'error-reporter',
  setup(ctx) {
  // 1) In-memory error store
  const errors = [];
  
  // Create storage
  ctx.storage = ctx.storage || new Map();
  ctx.storage.set('errors', errors);

  // 2) Handle pluginError events from core dispatch
  ctx.on('pluginError', event => {
    const entry = {
      ts: new Date().toISOString(),
      plugin: event.plugin || 'unknown',
      hookName: event.hookName || 'unknown',
      error: event.error || new Error('Unknown error'),
      event
    };
    
    errors.push(entry);
    
    console.warn(
      `[fixiplug][pluginError]`,
      `plugin=${entry.plugin}`,
      `hook=${entry.hookName}`,
      `at ${entry.ts}`,
      entry.error
    );
    
    return event;
  });

  // Register a handler for 'brokenEvent' to simulate an error
  ctx.on('brokenEvent', () => {
    throw new Error('Simulated error from brokenEvent');
  });

  // 3) Register for uncaught errors
  window.addEventListener('error', (e) => {
    const entry = {
      ts: new Date().toISOString(),
      plugin: 'window',
      hookName: 'error',
      error: e.error || new Error(e.message || 'Unknown error'),
      event: e
    };
    errors.push(entry);
  });

  // 4) Register for promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    const entry = {
      ts: new Date().toISOString(),
      plugin: 'window',
      hookName: 'unhandledrejection',
      error: e.reason || new Error('Unhandled Promise rejection'),
      event: e
    };
    errors.push(entry);
  });

  // 5) Expose an API to retrieve stored errors
  ctx.on('api:getErrors', () => ({ errors }));

  // 6) Register cleanup to remove event listeners
  ctx.registerCleanup(() => {
    window.removeEventListener('error', null);
    window.removeEventListener('unhandledrejection', null);
  });

  console.log('🛑 errorPlug active – capturing errors');
  }
};