//// filepath: fixiplug/src/core/fixi-dom.js

import { Fixi } from './fixi-core.js';
import { send, attr, ignore } from 'fixi-common/utils';

/**
 * DOM‑integration IIFE for Fixi.
 * Watches for [fx-action], wires up event handlers, swaps HTML, dispatches fx:… events.
 *
 * Includes event buffering to prevent race conditions:
 * - Buffers fx:process events dispatched before initialization completes
 * - Replays buffered events once ready
 * - Dispatches fx:dom:ready event when fully initialized
 */
;(function () {
  if (typeof document === 'undefined' || document.__fixi_mo) return;

  // ========================================
  // Event Buffering for Race Condition Prevention
  // ========================================
  const earlyEvents = [];
  let isReady = false;

  // Temporary listener to buffer early fx:process events
  const bufferListener = (evt) => {
    if (!isReady) {
      earlyEvents.push(evt.target);
      evt.stopImmediatePropagation();
    }
  };

  // Install buffer listener immediately (capture phase)
  document.addEventListener('fx:process', bufferListener, { capture: true });

  // observe new elements
  document.__fixi_mo = new MutationObserver((recs) =>
    recs.forEach((r) =>
      r.type === 'childList' &&
      r.addedNodes.forEach((n) => process(n))
    )
  );

  function init(elt) {
    let options = {};
    if (elt.__fixi || ignore(elt) || !send(elt, 'init', { options })) return;

    elt.__fixi = async (evt) => {
      let reqs = (elt.__fixi.requests ||= new Set());
      let form = elt.form || elt.closest('form');
      let body = new FormData(form ?? undefined, evt.submitter);
      if (!form && elt.name) body.append(elt.name, elt.value);

      let ac = new AbortController();
      let cfg = {
        trigger: evt,
        action: attr(elt, 'fx-action'),
        method: attr(elt, 'fx-method', 'GET').toUpperCase(),
        target: document.querySelector(attr(elt, 'fx-target')) ?? elt,
        swap: attr(elt, 'fx-swap', 'outerHTML'),
        body,
        drop: reqs.size,
        headers: { 'FX-Request': 'true' },
        abort: ac.abort.bind(ac),
        signal: ac.signal,
        preventTrigger: true,
        transition: document.startViewTransition?.bind(document),
        fetch: fetch.bind(window)
      };

      let go = send(elt, 'config', { cfg, requests: reqs });
      if (cfg.preventTrigger) evt.preventDefault();
      if (!go || cfg.drop) return;

      // handle GET/DELETE automatic param build
      if (/GET|DELETE/.test(cfg.method)) {
        // @ts-ignore - cfg.body can be FormData which URLSearchParams accepts
        let params = new URLSearchParams(cfg.body);
        if (params.size)
          cfg.action += (/\?/.test(cfg.action) ? '&' : '?') + params;
        cfg.body = null;
      }

      reqs.add(cfg);
      try {
        if (cfg.confirm) {
          let result = await cfg.confirm();
          if (!result) return;
        }
        if (!send(elt, 'before', { cfg, requests: reqs })) return;

        cfg.response = await cfg.fetch(cfg.action, cfg);
        cfg.text = await cfg.response.text();

        if (!send(elt, 'after', { cfg })) return;
      } catch (error) {
        send(elt, 'error', { cfg, error });
        return;
      } finally {
        reqs.delete(cfg);
        send(elt, 'finally', { cfg });
      }

      const doSwap = () => {
        if (cfg.swap instanceof Function) return cfg.swap(cfg);
        else if (/(before|after)(begin|end)/.test(cfg.swap))
          cfg.target.insertAdjacentHTML(cfg.swap, cfg.text);
        else if (cfg.swap in cfg.target) cfg.target[cfg.swap] = cfg.text;
        else throw cfg.swap;
      };

      if (cfg.transition) await cfg.transition(doSwap).finished;
      else await doSwap();

      send(elt, 'swapped', { cfg });
      if (!document.contains(elt)) send(document, 'swapped', { cfg });
    };

    // determine trigger event
    elt.__fixi.evt = attr(
      elt,
      'fx-trigger',
      elt.matches('form')
        ? 'submit'
        : elt.matches('input:not([type=button]),select,textarea')
        ? 'change'
        : 'click'
    );

    // Only attach individual listener if delegation is not active
    if (!options.__delegated) {
      elt.addEventListener(elt.__fixi.evt, elt.__fixi, options);
    }

    send(elt, 'inited', {}, false);
  }

  function process(n) {
    if (n.matches) {
      if (ignore(n)) return;
      if (n.matches('[fx-action]')) init(n);
    }
    if (n.querySelectorAll) n.querySelectorAll('[fx-action]').forEach(init);
  }

  // ========================================
  // Readiness Initialization
  // ========================================

  // Remove buffer listener and install real processor
  document.removeEventListener('fx:process', bufferListener, { capture: true });
  document.addEventListener('fx:process', (evt) => process(evt.target));

  // Mark as ready
  isReady = true;
  // @ts-ignore - Custom property for DOM readiness tracking
  document.__fixi_ready = true;

  // Process buffered events that arrived before initialization
  const bufferedCount = earlyEvents.length;
  if (bufferedCount > 0) {
    earlyEvents.forEach(target => process(target));
    earlyEvents.length = 0;
  }

  // Signal that DOM feature is ready
  document.dispatchEvent(new CustomEvent('fx:dom:ready', {
    bubbles: true,
    detail: {
      bufferedEvents: bufferedCount,
      timestamp: Date.now()
    }
  }));

  // Setup MutationObserver on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    document.__fixi_mo.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    process(document.body);
  });
})();

export { Fixi };