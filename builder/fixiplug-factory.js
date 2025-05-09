/**
 * Factory function to create fixiplug instances with different configurations
 * @param {Object} options - Configuration options
 * @param {boolean} [options.enableLogging=true] - Whether to enable console logging
 * @param {boolean} [options.enableDom=false] - Whether to enable DOM integration
 * @param {boolean} [options.testMode=false] - Whether to enable test-specific features
 * @param {boolean} [options.serverMode=false] - Whether to configure for server environments
 * @param {boolean} [options.minimal=false] - Whether to create a minimal instance without extras
 * @returns {Object} Configured fixiplug instance
 */
import { Fixi } from '../core/fixi-core.js';

export function createFixiplug(options = {}) {
  const {
    enableLogging = true,
    enableDom = false,
    testMode = false,
    serverMode = false,
    minimal = false,
    detectedEnv = null,
    accessibilityMode = 'auto' // 'auto', 'enhanced', or 'standard'
  } = options;
  
  // Store configuration for inspection
  const config = {
    enableLogging,
    enableDom,
    testMode,
    serverMode,
    minimal,
    detectedEnv,
    accessibilityMode
  };
  
  // Load DOM integration if requested
  if (enableDom && typeof window !== 'undefined') {
    import('../core/fixi-dom.js');
  }
  
  // Create test-specific features if requested
  const testFeatures = testMode ? {
    hookCalls: {},
    resetTracking() {
      this.hookCalls = {};
    },
    mockHookResponse(hookName, mockFn) {
      if (!this._originalHandlers) this._originalHandlers = {};
      
      if (!this._originalHandlers[hookName]) {
        this._originalHandlers[hookName] = [...(Fixi.hooks[hookName] || [])];
      }
      
      Fixi.hooks[hookName] = [];
      
      this.use({
        name: `__mock_${hookName}`,
        setup(ctx) {
          ctx.on(hookName, mockFn, 1000);
        }
      });
      
      return this;
    },
    restoreHooks(hookName) {
      if (!this._originalHandlers) return this;
      
      if (hookName) {
        if (this._originalHandlers[hookName]) {
          Fixi.hooks[hookName] = [...this._originalHandlers[hookName]];
          delete this._originalHandlers[hookName];
        }
      } else {
        for (const [hook, handlers] of Object.entries(this._originalHandlers)) {
          Fixi.hooks[hook] = [...handlers];
        }
        this._originalHandlers = {};
      }
      
      return this;
    }
  } : {};
  
  // Create the base fixiplug object
  const fixiplug = {
    /**
     * Public access to configuration 
     */
    config,
    
    /**
     * Priority levels for hook execution
     * @type {Object}
     */
    PRIORITY: Fixi.PRIORITY,
    
    /**
     * Register a plugin with fixiplug
     * @param {import('../types.js').FixiPlug.PluginFunction|import('../types.js').FixiPlug.PluginInstance} plugin - The plugin to register
     * @returns {Object} This fixiplug instance for chaining
     */
    use(plugin) {
      if (enableLogging && !minimal) {
        console.log(`Registering plugin: ${plugin.name || 'anonymous'}`);
      }
      return Fixi.use(plugin);
    },
    
    // Remove a plugin completely
    unuse(pluginName) {
      if (enableLogging && !minimal) {
        console.log(`Removing plugin: ${pluginName}`);
      }
      return Fixi.unuse(pluginName);
    },
    
    /**
     * Swap one plugin for another
     * @param {string|Object} oldPlugin - The plugin name or instance to replace
     * @param {Object} newPlugin - The new plugin to use
     * @returns {Object} This fixiplug instance for chaining
     */
    swap(oldPlugin, newPlugin) {
      const oldPluginName = typeof oldPlugin === 'string' 
        ? oldPlugin 
        : (oldPlugin.name || 'anonymous');
      
      if (enableLogging && !minimal) {
        console.log(`Swapping plugin: ${oldPluginName} with ${newPlugin.name || 'anonymous'}`);
      }
      
      // Remove the old plugin
      this.unuse(oldPluginName);
      
      // Add the new plugin
      return this.use(newPlugin);
    },
    
    // Enable a disabled plugin
    enable(pluginName) {
      if (enableLogging && !minimal) {
        console.log(`Enabling plugin: ${pluginName}`);
      }
      return Fixi.enable(pluginName);
    },
    
    // Disable an active plugin
    disable(pluginName) {
      if (enableLogging && !minimal) {
        console.log(`Disabling plugin: ${pluginName}`);
      }
      return Fixi.disable(pluginName);
    },
    
    // Dispatch a hook through the fixi engine
    async dispatch(hookName, event) {
      if (enableLogging && !minimal) {
        console.log(`Dispatching hook: ${hookName}`, event);
      }
      
      // Track hook calls for testing if in test mode
      if (testMode && !minimal) {
        if (!this.hookCalls[hookName]) {
          this.hookCalls[hookName] = [];
        }
        this.hookCalls[hookName].push({
          timestamp: new Date(),
          event: JSON.parse(JSON.stringify(event))
        });
      }
      
      return await Fixi.dispatch(hookName, event);
    },
    
    // Remove an individual handler from a hook
    off(hookName, handler) {
      if (enableLogging && !minimal) {
        console.log(`Removing handler for hook: ${hookName}`);
      }
      return Fixi.off(hookName, handler);
    },
    
    // Expose internals for debugging
    get hooks() {
      return Fixi.hooks;
    },
    
    get pluginRegistry() {
      return Fixi.pluginRegistry;
    },
    
    // Include test-specific features 
    ...testFeatures
  };
  
  return fixiplug;
}

/**
 * Helper function to export fixiplug object across different module systems
 * @param {Object} fixiplug - The fixiplug instance to export
 * @param {string} [name='fixiplug'] - Module name for AMD exports
 * @param {boolean} [attachToWindow=true] - Whether to attach to window in browser environments
 */
export function exportFixiplug(fixiplug, name = 'fixiplug', attachToWindow = true) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = fixiplug;
  } else if (typeof define === 'function' && define.amd) {
    define(name, [], () => fixiplug);
  }
  
  if (attachToWindow && typeof window !== 'undefined') {
    window[name] = fixiplug;
  }
  
  return fixiplug;
}