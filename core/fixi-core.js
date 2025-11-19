//// filepath: fixiplug/src/core/fixi-core.js

import * as hooks from './hooks.js';

/**
 * Core Fixi class (no DOM integration)
 * Same HTTP logic as in fixi.js, but without any MutationObserver or auto‑init IIFE.
 */
export class Fixi {
  constructor(base = '') {
    this.base = base;
  }

  async fetch(cfg) {
    let url = cfg.action,
      m = cfg.method,
      b = cfg.body,
      h = cfg.headers,
      s = cfg.signal;

    // GET/DELETE params
    if (/GET|DELETE/.test(m) && b instanceof FormData) {
      // build query string from FormData
      // @ts-ignore - FormData entries can contain Files, but we only use string values for query params
      const p = new URLSearchParams(Array.from(b.entries()));
      if (p.toString()) url += (url.includes('?') ? '&' : '?') + p;
      b = null;
    }

    const res = await fetch(url, {
      method: m,
      headers: h,
      body: b,
      signal: s
    });

    return {
      ok: res.ok,
      status: res.status,
      json: res.json.bind(res),
      text: res.text.bind(res),
      headers: res.headers
    };
  }
}

// Attach hook methods and properties to the Fixi class
Fixi.hooks = hooks.hooks;
Fixi.pluginRegistry = hooks.pluginRegistry;
Fixi.skillRegistry = hooks.skillRegistry;
Fixi.PRIORITY = hooks.PRIORITY;

// Static hook methods
Fixi.dispatch = hooks.dispatch;
Fixi.on = hooks.on;
Fixi.off = hooks.off;

// Static plugin methods
Fixi.use = function(plugin) {
  hooks.registerPlugin(plugin);
  return this;
};

Fixi.unuse = function(pluginName) {
  hooks.unregisterPlugin(pluginName);
  return this;
};

Fixi.enable = function(pluginName) {
  hooks.enablePlugin(pluginName);
  return this;
};

Fixi.disable = function(pluginName) {
  hooks.disablePlugin(pluginName);
  return this;
};

// Introspection methods for exposing internal state safely
Fixi.getPluginRegistry = function() {
  // Return a copy to prevent mutation
  return new Map(hooks.pluginRegistry);
};

Fixi.getHooks = function() {
  // Return a deep copy without handler functions (security)
  const hooksCopy = {};
  for (const [name, handlers] of Object.entries(hooks.hooks)) {
    hooksCopy[name] = handlers.map(h => ({
      plugin: h.plugin,
      priority: h.priority
      // Omit handler function to prevent direct invocation
    }));
  }
  return hooksCopy;
};

Fixi.getDisabledPlugins = function() {
  // Return a copy to prevent mutation
  return new Set(hooks.disabledPlugins);
};

// Skill registry methods
Fixi.getSkillRegistry = function() {
  // Return a copy to prevent mutation
  return hooks.getAllSkills();
};

Fixi.getSkill = function(pluginName) {
  return hooks.getSkill(pluginName);
};

Fixi.registerSkill = function(pluginName, skillMetadata) {
  hooks.registerSkill(pluginName, skillMetadata);
  return this;
};