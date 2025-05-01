// src/core/fixi.js
export class Fixi {
  constructor(base=''){ this.base = base }
  async fetch(cfg) {
    let url = cfg.action, m = cfg.method, b = cfg.body, h = cfg.headers, s = cfg.signal;
    // GET/DELETE params
    if (/GET|DELETE/.test(m) && b instanceof FormData) {
      const p = new URLSearchParams(b as any);
      if (p.toString()) url += (url.includes('?') ? '&' : '?') + p;
      b = null;
    }
    // perform fetch
    const res = await fetch(url, { method: m, headers: h, body: b, signal: s });
    return {
      ok: res.ok,
      status: res.status,
      json: res.json.bind(res),
      text: res.text.bind(res),
      headers: res.headers
    };
  }
}
