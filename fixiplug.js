const fixi = {
  hooks: {
    init: [],
    config: [],
    before: [],
    after: [],
    error: [],
    finally: [],
    swapped: [],
    pluginError: []
  },

  pluginRegistry: {},

  PRIORITY: {
    HIGH: 10,
    NORMAL: 5,
    LOW: 1
  },

  _registerInternalHandler(hookName, handler, priority) {
    if (!Array.isArray(this.hooks[hookName])) {
      this.hooks[hookName] = [];
    }

    const entry = { handler, priority, plugin: 'core' };
    const idx = this.hooks[hookName].findIndex(h => h.priority < priority);
    if (idx > -1) {
      this.hooks[hookName].splice(idx, 0, entry);
    } else {
      this.hooks[hookName].push(entry);
    }
  },

  use(plugin) {
    const name = plugin.name || (typeof plugin === 'function' ? 
                 plugin.toString().match(/function\s+([^(]*)/)?.[1] : null) || 'anonymous';

    this.pluginRegistry[name] = {
      instance: plugin,
      hooks: [],
      enabled: true
    };

    const ctx = {
      pluginName: name,
      on: (hookName, handler, priority = 0) => {
        if (!Array.isArray(this.hooks[hookName])) {
          this.hooks[hookName] = [];
        }
        const entry = { handler, priority, plugin: name };
        this.pluginRegistry[name].hooks.push([hookName, handler]);
        const idx = this.hooks[hookName].findIndex(h => h.priority < priority);
        if (idx > -1) {
          this.hooks[hookName].splice(idx, 0, entry);
        } else {
          this.hooks[hookName].push(entry);
        }
        return ctx;
      },
      off: this.off.bind(this)
    };

    try {
      if (typeof plugin === 'function') {
        plugin(ctx);
      }
    } catch (e) {
      console.error(`Fixi plugin '${name}' failed to initialize: ${e}`);
      this.dispatch('pluginError', { 
        plugin: name, 
        hookName: 'init', 
        error: e 
      });
    }

    return this;
  },

  off(hookName, handler) {
    if (!this.hooks[hookName]) return this;

    const idx = this.hooks[hookName].findIndex(entry => entry.handler === handler);
    if (idx > -1) {
      this.hooks[hookName].splice(idx, 1);
      for (const [name, plugin] of Object.entries(this.pluginRegistry)) {
        const hookIdx = plugin.hooks.findIndex(h => h[1] === handler);
        if (hookIdx > -1) {
          plugin.hooks.splice(hookIdx, 1);
        }
      }
    }

    return this;
  },

  /** Disable a plugin by name, skipping its hooks */
  disable(pluginName) {
    if (this.pluginRegistry[pluginName]) {
      this.pluginRegistry[pluginName].enabled = false;
    }
    return this;
  },

  /** Enable a previously disabled plugin */
  enable(pluginName) {
    if (this.pluginRegistry[pluginName]) {
      this.pluginRegistry[pluginName].enabled = true;
    }
    return this;
  },

  /** Completely remove a plugin and all its hooks */
  unuse(pluginName) {
    if (!this.pluginRegistry[pluginName]) return this;
    // Remove plugin hooks from all phases
    for (const hookName in this.hooks) {
      this.hooks[hookName] = this.hooks[hookName].filter(entry => entry.plugin !== pluginName);
    }
    delete this.pluginRegistry[pluginName];
    return this;
  },

  async dispatch(hookName, event) {
    if (!this.hooks[hookName]) return;
    let lastResult;
    for (const entry of this.hooks[hookName]) {
      if (this.pluginRegistry[entry.plugin] &&
          !this.pluginRegistry[entry.plugin].enabled) {
        continue;
      }
      try {
        const result = entry.handler(event);
        lastResult = await result;
        if (result === false) {
          break;
        }
      } catch (e) {
        console.error(`Error in '${entry.plugin}' plugin handler for '${hookName}': ${e}`);
        await this.dispatch('pluginError', {
          plugin: entry.plugin,
          hookName,
          error: e
        });
      }
    }
    return lastResult;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = fixi;
} else if (typeof define === 'function' && define.amd) {
  define('fixi', [], () => fixi);
}

if (typeof window !== 'undefined') {
  window.fixi = fixi;
}

// Add dispatch to the fixiplug wrapper so tests and demos can call fixiplug.dispatch()
const fixiplug = {
  // Expose priority levels
  PRIORITY: fixi.PRIORITY,

  // Register a plugin
  use(plugin) {
    console.log(`Registering plugin: ${plugin.name || 'anonymous'}`);
    return fixi.use(plugin);
  },

  // Remove a plugin completely
  unuse(pluginName) {
    console.log(`Removing plugin: ${pluginName}`);
    return fixi.unuse(pluginName);
  },

  // Enable a disabled plugin
  enable(pluginName) {
    console.log(`Enabling plugin: ${pluginName}`);
    return fixi.enable(pluginName);
  },

  // Disable an active plugin
  disable(pluginName) {
    console.log(`Disabling plugin: ${pluginName}`);
    return fixi.disable(pluginName);
  },

  // Dispatch a hook through the fixi engine
  async dispatch(hookName, event) {
    console.log(`Dispatching hook: ${hookName}`, event);
    return await fixi.dispatch(hookName, event);
  },

  // Remove an individual handler from a hook
  off(hookName, handler) {
    console.log(`Removing handler for hook: ${hookName}`);
    return fixi.off(hookName, handler);
  },

  // Expose internals for debugging
  get hooks() {
    return fixi.hooks;
  },
  get pluginRegistry() {
    return fixi.pluginRegistry;
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.fixiplug = fixiplug;
}