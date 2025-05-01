import { Fixi } from '../core/fixi.js';
import { PluginManager, PluginHook } from '../../plugin';
import * as builtIns from '../../plugins';  // src/plugins/index.ts

export function createFixiWithPlugins(plugins = Object.values(builtIns)) {
  const fixi = new Fixi(), pm = new PluginManager();
  plugins.forEach(p => pm.register(p));

  const init = (elt: Element) => {
    if ((elt as any).__fixi || elt.closest('[fx-ignore]')) return;
    // request tracking
    let reqs = (elt as any).__fixiReqs ||= new Set();
    // event handler
    (elt as any).__fixi = async (evt: Event) => {
      // build form/body
      let form = (elt as any).form || elt.closest('form'),
          body = new FormData(form ?? undefined, (evt as any).submitter);
      if (!form && (elt as any).name) body.append((elt as any).name, (elt as any).value);
      // abort controller
      let ac = new AbortController();
      // config
      let cfg: any = {
        trigger: evt,
        action: elt.getAttribute('fx-action'),
        method: (elt.getAttribute('fx-method') || 'GET').toUpperCase(),
        target: document.querySelector(elt.getAttribute('fx-target') || '') || elt,
        swap: elt.getAttribute('fx-swap') || 'outerHTML',
        body,
        drop: reqs.size,
        headers: { 'FX-Request': 'true' },
        abort: ac.abort.bind(ac),
        signal: ac.signal,
        preventTrigger: true,
        transition: document.startViewTransition?.bind(document),
        fetch: fixi.fetch.bind(fixi)
      };
      // plugin beforeRequest
      let ctx: any = { fixi, config: cfg };
      ctx = await pm.execute(PluginHook.BEFORE_REQUEST, ctx);
      try {
        // network or cache skip
        let res = ctx.config._skipFetch && ctx.response
          ? ctx.response
          : await cfg.fetch(ctx.config);
        ctx.response = res;
        // plugin afterResponse
        ctx = await pm.execute(PluginHook.AFTER_RESPONSE, ctx);
        // extract text
        cfg.text = await ctx.response.text();
        // plugin DOM_MUTATED before swap
        await pm.execute(PluginHook.DOM_MUTATED, { fixi, elt, cfg });
        // swap
        if (typeof cfg.swap === 'function') cfg.swap(cfg);
        else if (/(before|after)(begin|end)/.test(cfg.swap)) cfg.target.insertAdjacentHTML(cfg.swap, cfg.text);
        else if (cfg.swap in cfg.target) (cfg.target as any)[cfg.swap] = cfg.text;
        else throw new Error(`Invalid swap: ${cfg.swap}`);
      } catch (error) {
        // plugin onError
        await pm.execute(PluginHook.ERROR, { fixi, config: cfg, error });
      } finally {
        // cleanup
        reqs.delete(cfg);
      }
    };
    // event bind
    elt.addEventListener(
      elt.getAttribute('fx-trigger') || (elt.matches('form') ? 'submit' : 'click'),
      (elt as any).__fixi
    );
  };

  const process = (node: Node) => {
    const el = node as Element;
    if (el.matches('[fx-action]')) init(el);
    el.querySelectorAll?.('[fx-action]').forEach(init);
  };

  return {
    init,
    process,
    observe: () => {
      if (!(document as any).__fixi_mo) {
        (document as any).__fixi_mo = new MutationObserver(m =>
          m.forEach(r => r.addedNodes.forEach(process))
        );
        document.addEventListener('DOMContentLoaded', () => {
          (document as any).__fixi_mo.observe(document.documentElement, {
            childList: true,
            subtree: true
          });
          process(document.body);
        });
      }
    }
  };
}

// Auto-init for backward compatibility
const defaultFixi = createFixiWithPlugins();
defaultFixi.observe();
export default defaultFixi;
