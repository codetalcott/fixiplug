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

    // Hook: Before fetch (allows request modification)
    const beforeEvt = await hooks.dispatch('fetch:before', {
      url, method: m, body: b, headers: h, signal: s, cfg
    });

    // Apply modifications from hooks
    url = beforeEvt.url;
    m = beforeEvt.method;
    b = beforeEvt.body;
    h = beforeEvt.headers;
    s = beforeEvt.signal;

    let res;

    // Check if response is cached (skip network call)
    if (beforeEvt.__cached && beforeEvt.__cacheEntry) {
      // Use cached response
      const cached = beforeEvt.__cacheEntry.response;
      const cachedData = cached.data;
      res = {
        ok: cached.ok !== undefined ? cached.ok : true,
        status: cached.status || 200,
        headers: cached.headers || new Headers(),
        json: async () => typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData,
        text: async () => typeof cachedData === 'string' ? cachedData : JSON.stringify(cachedData)
      };
    } else {
      // Perform actual network request
      res = await fetch(url, {
        method: m,
        headers: h,
        body: b,
        signal: s
      });
    }

    // Hook: After fetch (response received, before parsing)
    await hooks.dispatch('fetch:after', {
      response: res, cfg, url, method: m
    });

    const wrapped = {
      ok: res.ok,
      status: res.status,
      json: typeof res.json === 'function' ? res.json.bind(res) : async () => ({}),
      text: typeof res.text === 'function' ? res.text.bind(res) : async () => '',
      headers: res.headers,
      raw: res
    };

    // Hook: Response ready (wrapped response created)
    await hooks.dispatch('fetch:ready', {
      response: wrapped, cfg
    });

    return wrapped;
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