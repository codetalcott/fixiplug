/**
 * Factory function to create fixiplug instances with different configurations
 * @module fixiplug/factory
 */
/** @typedef {import('../types').FixiPlug.ConfigOptions} ConfigOptions */

import { Fixi } from './fixi-core.js';
import { queueDeferredEvent } from './hooks.js';

// Available features
export const FEATURES = {
  DOM: 'dom',          // DOM integration
  LOGGING: 'logging',  // Console logging
  TESTING: 'testing',  // Test-specific functionality
  SERVER: 'server'     // Server-optimized settings
};

/**
 * Create a new fixiplug instance
 * @param {ConfigOptions} [options={}] - Configuration options
 * @returns {Object|Promise<Object>} Configured fixiplug instance (Promise if DOM feature is used)
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
        ? (plugin.name || `anonymous_${Date.now()}`)
        : (plugin.name || `anonymous_${Date.now()}`);

      // Extract setup function
      const setup = typeof plugin === 'function' ? plugin : plugin.setup;

      // If plugin is a function, add a name property for future reference
      if (typeof plugin === 'function' && !plugin.name) {
        plugin.pluginId = name;
      }
      
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

        // Emit an event (deferred to prevent recursion)
        emit(hookName, event = {}) {
          queueDeferredEvent(hookName, event);
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
      
      // Store plugin reference locally
      plugins.set(name, {
        instance: plugin,
        context
      });

      // Register in core plugin registry for introspection
      Fixi.use(plugin);

      // Initialize the plugin and capture return value (may contain skill metadata)
      try {
        const pluginReturn = setup(context);

        // If plugin returned an object with skill metadata, register it
        if (pluginReturn && typeof pluginReturn === 'object' && pluginReturn.skill) {
          logger.log(`Registering skill for plugin: ${name}`);
          Fixi.registerSkill(name, pluginReturn.skill);

          // Store skill locally as well
          const pluginData = plugins.get(name);
          if (pluginData) {
            pluginData.skill = pluginReturn.skill;
          }
        }
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

      if (!plugins.has(pluginName)) {
        logger.error(`Cannot enable plugin "${pluginName}": plugin not found`);
        return this;
      }

      // Enable in core
      Fixi.enable(pluginName);

      // Update local status
      const pluginData = plugins.get(pluginName);
      if (pluginData) {
        pluginData.disabled = false;
      }

      return this;
    },

    /**
     * Disable an active plugin
     * @param {string} pluginName - The name of the plugin to disable
     * @returns {Object} This fixiplug instance for chaining
     */
    disable(pluginName) {
      logger.log(`Disabling plugin: ${pluginName}`);

      if (!plugins.has(pluginName)) {
        logger.error(`Cannot disable plugin "${pluginName}": plugin not found`);
        return this;
      }

      // Disable in core (hooks won't fire, but plugin stays registered)
      Fixi.disable(pluginName);

      // Update local status
      const pluginData = plugins.get(pluginName);
      if (pluginData) {
        pluginData.disabled = true;
      }

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
      
      // Testing tracking is now handled by the testing plugin
      // No need for inline tracking here anymore
      
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
     * Get detailed information about all plugins
     * @returns {Array<Object>} Array of plugin info objects
     */
    getPluginsInfo() {
      return Array.from(plugins.entries()).map(([name, data]) => ({
        name,
        disabled: data.disabled || false,
        hasSkill: !!data.skill,
        skill: data.skill || null
      }));
    },

    /**
     * Get information about a specific plugin
     * @param {string} pluginName - The plugin name
     * @returns {Object|null} Plugin info or null if not found
     */
    getPluginInfo(pluginName) {
      if (!plugins.has(pluginName)) {
        return null;
      }

      const data = plugins.get(pluginName);
      return {
        name: pluginName,
        disabled: data.disabled || false,
        hasSkill: !!data.skill,
        skill: data.skill || null
      };
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
    },

    get skillRegistry() {
      return Fixi.skillRegistry;
    },

    /**
     * Get all registered skills
     * @returns {Array<Object>} Array of skill metadata objects
     */
    getSkills() {
      if (!Fixi.skillRegistry) {
        return [];
      }

      return Array.from(Fixi.skillRegistry.entries()).map(([pluginName, skill]) => ({
        pluginName,
        ...skill
      }));
    },

    /**
     * Get a specific skill by name
     * @param {string} skillName - The skill name to retrieve
     * @returns {Object|null} Skill metadata or null if not found
     */
    getSkill(skillName) {
      if (!Fixi.skillRegistry) {
        return null;
      }

      // Search by skill name (not plugin name)
      for (const [pluginName, skill] of Fixi.skillRegistry.entries()) {
        if (skill.name === skillName) {
          return {
            pluginName,
            ...skill
          };
        }
      }

      return null;
    },

    /**
     * Check if a skill exists
     * @param {string} skillName - The skill name to check
     * @returns {boolean} True if skill exists
     */
    hasSkill(skillName) {
      return !!this.getSkill(skillName);
    },

    /**
     * Get skills by tag
     * @param {string} tag - Tag to filter by
     * @returns {Array<Object>} Array of matching skill metadata
     */
    getSkillsByTag(tag) {
      return this.getSkills().filter(skill =>
        skill.tags && skill.tags.includes(tag)
      );
    },

    /**
     * Get skills by level
     * @param {string} level - Level to filter by: 'beginner', 'intermediate', 'advanced'
     * @returns {Array<Object>} Array of matching skill metadata
     */
    getSkillsByLevel(level) {
      return this.getSkills().filter(skill => skill.level === level);
    },

    /**
     * Get skills metadata manifest (for LLM context)
     * @param {Object} [options={}] - Options for metadata format
     * @param {boolean} [options.includeInstructions=false] - Include full instructions
     * @param {Array<string>} [options.includeOnly] - Only include specific skill names
     * @param {Array<string>} [options.excludeSkills=[]] - Exclude specific skill names
     * @param {Array<string>} [options.tags] - Filter by tags
     * @param {string} [options.level] - Filter by level
     * @returns {Object} Skills manifest
     */
    getSkillsManifest(options) {
      options = options || {};
      const {
        includeInstructions = false,
        includeOnly = null,
        excludeSkills = [],
        tags = null,
        level = null
      } = options;

      let skills = this.getSkills();

      // Apply filters
      if (includeOnly) {
        skills = skills.filter(skill => includeOnly.includes(skill.name));
      }

      if (excludeSkills.length > 0) {
        skills = skills.filter(skill => !excludeSkills.includes(skill.name));
      }

      if (tags) {
        skills = skills.filter(skill =>
          skill.tags && tags.some(tag => skill.tags.includes(tag))
        );
      }

      if (level) {
        skills = skills.filter(skill => skill.level === level);
      }

      // Format output
      const manifest = {
        count: skills.length,
        skills: skills.map(skill => {
          const metadata = {
            name: skill.name,
            pluginName: skill.pluginName,
            description: skill.description,
            tags: skill.tags || [],
            level: skill.level || 'intermediate',
            version: skill.version || '1.0.0',
            author: skill.author,
            references: skill.references || []
          };

          if (includeInstructions) {
            metadata.instructions = skill.instructions;
          }

          return metadata;
        })
      };

      return manifest;
    },

    /**
     * Get skill instructions for LLM context injection
     * @param {string} skillName - The skill name
     * @returns {string|null} Full skill instructions or null
     */
    getSkillInstructions(skillName) {
      const skill = this.getSkill(skillName);
      return skill ? skill.instructions : null;
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

  // If DOM feature is requested, return a Promise that resolves when ready
  if (hasFeature(FEATURES.DOM) && typeof window !== 'undefined') {
    return import('../core/fixi-dom.js').then(() => {
      // Wait for fx:dom:ready event to ensure fixi-dom.js is fully initialized
      return new Promise(resolve => {
        // @ts-ignore - Custom property for DOM readiness tracking
        if (document.__fixi_ready) {
          // Already ready
          resolve(fixiplug);
        } else {
          // Wait for ready event
          document.addEventListener('fx:dom:ready', () => resolve(fixiplug), { once: true });
        }
      });
    });
  }

  // Otherwise return synchronously
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