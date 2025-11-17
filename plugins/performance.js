/** @typedef {import('../types').FixiPlug.PluginContext} PluginContext */

/* global fixiplug */

/**
 * Performance monitoring plugin for Fixiplug.
 * @param {PluginContext} ctx - The plugin context provided by Fixiplug.
 */
export default function performancePlug(ctx) {
    // Store stats for each plugin/hook combo
    const stats = new Map();

    // Track the original dispatch method
    const originalDispatch = fixiplug.dispatch;
    
    // Replace dispatch with instrumented version
    fixiplug.dispatch = async function(hookName, event) {
      if (!this.hooks[hookName]) return;
      
      if (this.debug) {
        console.group(`fixi:${hookName}`);
        console.log('Event:', event);
      }
      
      for (const entry of this.hooks[hookName]) {
        // Skip disabled plugins
        if (this.pluginRegistry[entry.plugin] && 
            !this.pluginRegistry[entry.plugin].enabled) {
          continue;
        }
        
        try {
          // Performance tracking - START
          const startTime = performance.now();
          
          const result = entry.handler(event);
          
          // Track performance statistics
          const execTime = performance.now() - startTime;
          const key = `${entry.plugin}:${hookName}`;
          
          if (!stats.has(key)) {
            stats.set(key, { calls: 0, totalTime: 0, lastExecTime: 0 });
          }
          
          const pluginStats = stats.get(key);
          pluginStats.calls++;
          pluginStats.totalTime += execTime;
          pluginStats.lastExecTime = execTime;
          
          // Warn on slow handlers
          if (execTime > 10) {
            console.warn(`Slow plugin handler: ${entry.plugin}.${hookName} took ${execTime.toFixed(2)}ms`);
          }
          // Performance tracking - END
          
          // Handle async results and allow breaking the chain with false return
          if (result instanceof Promise) {
            try {
              const asyncResult = await result;
              if (asyncResult === false) break;
            } catch (e) {
              console.error(`Async error in '${entry.plugin}' plugin handler for '${hookName}': ${e}`);
              this.dispatch('pluginError', { 
                plugin: entry.plugin, 
                hookName, 
                error: e 
              });
            }
          } else if (result === false) {
            break;
          }
        } catch (e) {
          console.error(`Error in '${entry.plugin}' plugin handler for '${hookName}': ${e}`);
          this.dispatch('pluginError', { 
            plugin: entry.plugin, 
            hookName, 
            error: e 
          });
        }
      }
      
      if (this.debug) {
        console.groupEnd();
      }
    };
    
    // Add API to retrieve performance data
    ctx.on('api:getPerformanceStats', () => stats);
    
    // Add API to reset stats
    ctx.on('api:resetPerformanceStats', () => stats.clear());
    
    // Register cleanup to restore original dispatch
    ctx.registerCleanup(() => {
      fixiplug.dispatch = originalDispatch;
    });
  }