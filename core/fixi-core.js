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
  // For now, similar to use - can be expanded later
  return this;
};

Fixi.disable = function(pluginName) {
  // For now, similar to unuse - can be expanded later
  return this;
};