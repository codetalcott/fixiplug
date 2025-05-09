/**
 * Factory function to create fixiplug instances with different configurations
 * @module fixiplug/factory
 */
import { Fixi } from '../core/fixi-core.js';

// Available features
const FEATURES = {
  DOM: 'dom',          // DOM integration
  LOGGING: 'logging',  // Console logging
  TESTING: 'testing',  // Test-specific functionality
  SERVER: 'server'     // Server-optimized settings
};

/**
 * Create a new fixiplug instance
 * @param {Object} options - Configuration options
 * @param {Array<string>} [options.features=[]] - List of features to enable
 * @param {Object} [options.advanced={}] - Advanced configuration options
 * @returns {Object} Configured fixiplug instance
 */
export function createFixiplug(options = {}) {
  const { 
    features = [],
    advanced = {}
  } = options;
  
  // Store feature configuration
  const config = {
    features: new Set(features),
    advanced: { ...advanced }
  };
  
  // Feature detection helpers
  const hasFeature = (feature) => config.features.has(feature);
  
  // Logger utility
  const logger = {
    log(...args) {
      if (hasFeature(FEATURES.LOGGING)) {
        console.log(...args);
      }
    },
    error(...args) {
      if (hasFeature(FEATURES.LOGGING)) {
        console.error(...args);
      }
    },
    warn(...args) {
      if (hasFeature(FEATURES.LOGGING)) {
        console.warn(...args);
      }
    }
  };
  
  // Load DOM integration if requested
  if (hasFeature(FEATURES.DOM) && typeof window !== 'undefined') {
    import('../core/fixi-dom.js');
  }
  
  // Plugin storage
  const plugins = new Map();
  
  // Create the base fixiplug object
  const fixiplug = {
    /**
     * Public access to configuration 
     */
    config,
    
    /**
     * Access to feature constants
     */
    FEATURES,
    
    /**
     * Priority levels for hook execution
     * @type {Object}
     */
    PRIORITY: Fixi.PRIORITY ?? { HIGH: 100, NORMAL: 0, LOW: -100 },
    
    /**
     * Register a plugin with fixiplug
     * @param {Object|Function} plugin - The plugin to register
     * @returns {Object} This fixiplug instance for chaining
     */
    use(plugin) {
      // Extract plugin metadata
      const name = typeof plugin === 'function' 
        ? (plugin.name || 'anonymous') 
        : (plugin.name || 'anonymous');
      
      // Extract setup function
      const setup = typeof plugin === 'function' ? plugin : plugin.setup;
      
      if (typeof setup !== 'function') {
        logger.error(`Invalid plugin: missing setup function`);
        return this;
      }
      
      logger.log(`Registering plugin: ${name}`);
      
      // Create plugin context
      const context = {
        pluginName: name,
        
        // Register a hook listener
        on(hookName, handler, priority = 0) {
          if (!Fixi.hooks) Fixi.hooks = {};
          if (!Fixi.hooks[hookName]) Fixi.hooks[hookName] = [];
          
          Fixi.hooks[hookName].push({
            plugin: name,
            handler,
            priority
          });
          
          // Sort handlers by priority (high to low)
          Fixi.hooks[hookName].sort((a, b) => b.priority - a.priority);
          
          return this;
        },
        
        // Remove a hook listener
        off(hookName, handler) {
          if (!Fixi.hooks || !Fixi.hooks[hookName]) return this;
          
          Fixi.hooks[hookName] = Fixi.hooks[hookName].filter(h => 
            h.plugin !== name || h.handler !== handler
          );
          
          return this;
        },
        
        // Register a cleanup function
        registerCleanup(fn) {
          if (!plugins.has(name)) {
            plugins.set(name, { cleanup: [] });
          }
          
          const plugin = plugins.get(name);
          plugin.cleanup = plugin.cleanup || [];
          plugin.cleanup.push(fn);
          
          return this;
        },
        
        // Plugin-specific storage
        storage: new Map(),
        
        // Debug flag
        debug: hasFeature(FEATURES.TESTING)
      };
      
      // Store plugin reference
      plugins.set(name, { 
        instance: plugin,
        context
      });
      
      // Initialize the plugin
      try {
        setup(context);
      } catch (err) {
        logger.error(`Error initializing plugin ${name}:`, err);
        this.unuse(name);
      }
      
      return this;
    },
    
    /**
     * Remove a plugin completely
     * @param {string} pluginName - The name of the plugin to remove
     * @returns {Object} This fixiplug instance for chaining
     */
    unuse(pluginName) {
      logger.log(`Removing plugin: ${pluginName}`);
      
      // Run cleanup functions
      if (plugins.has(pluginName)) {
        const plugin = plugins.get(pluginName);
        
        if (plugin.cleanup && Array.isArray(plugin.cleanup)) {
          for (const cleanup of plugin.cleanup) {
            try {
              cleanup();
            } catch (err) {
              logger.error(`Error during plugin cleanup for ${pluginName}:`, err);
            }
          }
        }
        
        plugins.delete(pluginName);
      }
      
      // Remove all hooks for this plugin
      if (Fixi.hooks) {
        for (const [hookName, handlers] of Object.entries(Fixi.hooks)) {
          Fixi.hooks[hookName] = handlers.filter(h => h.plugin !== pluginName);
        }
      }
      
      return this;
    },
    
    /**
     * Swap one plugin for another
     * @param {string} oldPluginName - The plugin name to replace
     * @param {Object|Function} newPlugin - The new plugin to use
     * @returns {Object} This fixiplug instance for chaining
     */
    swap(oldPluginName, newPlugin) {
      logger.log(`Swapping plugin: ${oldPluginName} with ${typeof newPlugin === 'function' 
        ? (newPlugin.name || 'anonymous') 
        : (newPlugin.name || 'anonymous')}`);
      
      // Remove the old plugin
      this.unuse(oldPluginName);
      
      // Add the new plugin
      return this.use(newPlugin);
    },
    
    /**
     * Enable a disabled plugin
     * @param {string} pluginName - The name of the plugin to enable
     * @returns {Object} This fixiplug instance for chaining 
     */
    enable(pluginName) {
      logger.log(`Enabling plugin: ${pluginName}`);
      
      // Implementation depends on how plugin disabling is stored
      // For now, we'll assume plugins are enabled by default and this is a no-op
      
      return this;
    },
    
    /**
     * Disable an active plugin
     * @param {string} pluginName - The name of the plugin to disable
     * @returns {Object} This fixiplug instance for chaining
     */
    disable(pluginName) {
      logger.log(`Disabling plugin: ${pluginName}`);
      
      // Implementation depends on how plugin disabling is stored
      // For now, we'll assume it's similar to unuse but without cleanup
      
      return this;
    },
    
    /**
     * Dispatch a hook through the fixi engine
     * @param {string} hookName - The name of the hook to dispatch
     * @param {Object} event - The event data to pass to handlers
     * @returns {Promise<Object>} The processed event
     */
    async dispatch(hookName, event = {}) {
      logger.log(`Dispatching hook: ${hookName}`, event);
      
      // Track hook calls for testing if enabled
      if (hasFeature(FEATURES.TESTING) && this.hookCalls) {
        if (!this.hookCalls[hookName]) {
          this.hookCalls[hookName] = [];
        }
        
        this.hookCalls[hookName].push({
          timestamp: new Date(),
          event: JSON.parse(JSON.stringify(event))
        });
      }
      
      try {
        return await Fixi.dispatch(hookName, event);
      } catch (err) {
        logger.error(`Error dispatching hook ${hookName}:`, err);
        throw err;
      }
    },
    
    /**
     * Remove an individual handler from a hook
     * @param {string} hookName - The name of the hook
     * @param {Function} handler - The handler function to remove
     * @returns {Object} This fixiplug instance for chaining
     */
    off(hookName, handler) {
      logger.log(`Removing handler for hook: ${hookName}`);
      
      if (!Fixi.hooks || !Fixi.hooks[hookName]) return this;
      
      Fixi.hooks[hookName] = Fixi.hooks[hookName].filter(h => h.handler !== handler);
      
      return this;
    },
    
    /**
     * Get list of registered plugins
     * @returns {Array<string>} List of plugin names
     */
    getPlugins() {
      return Array.from(plugins.keys());
    },
    
    /**
     * Check if a feature is enabled
     * @param {string} feature - The feature to check
     * @returns {boolean} True if the feature is enabled
     */
    hasFeature(feature) {
      return config.features.has(feature);
    },
    
    // Expose internals for debugging
    get hooks() {
      return Fixi.hooks;
    }
  };
  
  // Auto-load testing plugin if testing feature is enabled
  if (hasFeature(FEATURES.TESTING)) {
    // We'll dynamically import the testing plugin in an async context
    (async () => {
      try {
        const { default: testingPlugin } = await import('../plugins/testing.js');
        fixiplug.use(testingPlugin);

        // Add convenience methods that delegate to the plugin API
        fixiplug.resetTracking = () => fixiplug.dispatch('api:testing:resetTracking');
        fixiplug.mockHookResponse = (hookName, mockFn) => fixiplug.dispatch('api:testing:mockHook', { hookName, mockFn });
        fixiplug.restoreHooks = (hookName) => fixiplug.dispatch('api:testing:restoreHook', { hookName });
      } catch (err) {
        logger.error('Failed to load testing plugin:', err);
      }
    })();
  }
  
  return fixiplug;
}

// Predefined feature sets
export const FEATURE_SETS = {
  BROWSER: [FEATURES.DOM, FEATURES.LOGGING],
  CORE: [FEATURES.LOGGING],
  TEST: [FEATURES.TESTING, FEATURES.LOGGING],
  SERVER: [FEATURES.SERVER],
  MINIMAL: []
};