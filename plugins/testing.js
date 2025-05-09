/**
 * Testing plugin for Fixiplug
 * Provides utilities for mocking hooks and tracking hook calls
 * @module plugins/testing
 */

/**
 * @typedef {import('../types').FixiPlug.PluginContext} PluginContext
 */

/**
 * Testing plugin for Fixiplug
 * @param {PluginContext} ctx - The plugin context
 */
export default function testingPlugin(ctx) {
  // Initialize plugin storage
  ctx.storage = new Map();
  ctx.storage.set('hookCalls', {});
  ctx.storage.set('originalHandlers', {});
  
  // Register hooks to track all events
  ctx.on('*', (event, hookName) => {
    const hookCalls = ctx.storage.get('hookCalls');
    
    if (!hookCalls[hookName]) {
      hookCalls[hookName] = [];
    }
    
    hookCalls[hookName].push({
      timestamp: new Date(),
      event: JSON.parse(JSON.stringify(event))
    });
    
    return event;
  }, -999); // Very low priority to run last
  
  // Add testing API
  ctx.on('api:testing:resetTracking', () => {
    ctx.storage.set('hookCalls', {});
    return { success: true };
  });
  
  ctx.on('api:testing:getHookCalls', (event) => {
    const hookName = event?.hookName;
    const hookCalls = ctx.storage.get('hookCalls');
    
    if (hookName) {
      return { 
        calls: hookCalls[hookName] || [] 
      };
    }
    
    return { 
      calls: hookCalls 
    };
  });
  
  ctx.on('api:testing:mockHook', (event) => {
    const { hookName, mockFn, priority = 1000 } = event;
    
    if (!hookName) {
      return { 
        success: false, 
        error: 'Missing hookName parameter' 
      };
    }
    
    if (typeof mockFn !== 'function') {
      return { 
        success: false, 
        error: 'Missing or invalid mockFn parameter' 
      };
    }
    
    const originalHandlers = ctx.storage.get('originalHandlers');
    const globalHooks = ctx.fixiplug.hooks;
    
    // Back up original handlers
    if (!originalHandlers[hookName]) {
      originalHandlers[hookName] = [...(globalHooks[hookName] || [])];
    }
    
    // Clear existing handlers
    if (globalHooks[hookName]) {
      globalHooks[hookName] = [];
    }
    
    // Register mock handler
    ctx.on(hookName, mockFn, priority);
    
    return { success: true };
  });
  
  ctx.on('api:testing:restoreHook', (event) => {
    const { hookName } = event;
    const originalHandlers = ctx.storage.get('originalHandlers');
    const globalHooks = ctx.fixiplug.hooks;
    
    if (hookName) {
      if (originalHandlers[hookName]) {
        globalHooks[hookName] = [...originalHandlers[hookName]];
        delete originalHandlers[hookName];
      }
    } else {
      // Restore all hooks
      for (const [hook, handlers] of Object.entries(originalHandlers)) {
        globalHooks[hook] = [...handlers];
      }
      ctx.storage.set('originalHandlers', {});
    }
    
    return { success: true };
  });
  
  // Register cleanup
  ctx.registerCleanup(() => {
    const originalHandlers = ctx.storage.get('originalHandlers');
    const globalHooks = ctx.fixiplug.hooks;
    
    // Restore any mocked hooks
    for (const [hook, handlers] of Object.entries(originalHandlers)) {
      globalHooks[hook] = [...handlers];
    }
  });
  
  console.log('📊 Fixiplug testing plugin activated');
}