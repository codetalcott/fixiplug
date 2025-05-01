import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../fixi.js';

describe('Fixi AbortController Handling', () => {
  let button: HTMLButtonElement;
  let originalFetch: any;
  let lastError: any;
  let lastCfg: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    button = document.createElement('button');
    button.setAttribute('fx-action', '/api/abort');
    document.body.appendChild(button);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    originalFetch = window.fetch;
    button.addEventListener('fx:config', e => { lastCfg = e.detail.cfg; });
    button.addEventListener('fx:error', e => { lastError = e.detail.error; });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    lastError = lastCfg = undefined;
    document.body.innerHTML = '';
  });

  it('aborts fetch when cfg.abort is called and dispatches fx:error', async () => {
    // stub fetch to respect signal
    window.fetch = (_url: string, cfg: any) => new Promise((_res, rej) => {
      cfg.signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
    });

    // trigger click to populate lastCfg
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // wait for fx:config
    await new Promise(r => setTimeout(r, 0));

    // call abort on captured cfg
    lastCfg.abort();
    // wait for fetch rejection handling
    await new Promise(r => setTimeout(r, 0));

    expect(lastError).toBeInstanceOf(DOMException);
    expect(lastError.name).toBe('AbortError');
  });
});