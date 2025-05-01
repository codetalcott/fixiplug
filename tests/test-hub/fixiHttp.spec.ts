import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../fixi.js'; // side-effect registers global fx behavior

describe('Fixi Core HTTP Wrappers', () => {
  let button: HTMLButtonElement;
  let originalFetch: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    // create a button with fx-action
    button = document.createElement('button');
    button.setAttribute('fx-action', '/api/data');
    document.body.appendChild(button);
    // trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    originalFetch = window.fetch;
  });

  afterEach(() => {
    // restore fetch and DOM
    window.fetch = originalFetch;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('uses GET wrapper: converts formData to query params and null body', async () => {
    // stub fetch
    const fakeResponse = { ok: true, text: () => Promise.resolve('ok') };
    const spy = vi.spyOn(window, 'fetch').mockResolvedValue(fakeResponse as any);

    // simulate click
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // wait for async handler
    await Promise.resolve();

    expect(spy).toHaveBeenCalled();
    const [url, cfg] = spy.mock.calls[0];
    expect(url.startsWith('/api/data')).toBe(true);
    // body should be null for GET
    expect(cfg.body).toBeNull();
    expect(cfg.method).toBe('GET');
    // header injection
    expect(cfg.headers['FX-Request']).toBe('true');
  });

  it('uses POST wrapper: sends FormData body and headers', async () => {
    // set method to POST
    button.setAttribute('fx-method', 'POST');
    document.dispatchEvent(new Event('fx:process', { target: button }));

    const fakeResponse = { ok: true, text: () => Promise.resolve('ok') };
    const spy = vi.spyOn(window, 'fetch').mockResolvedValue(fakeResponse as any);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(spy).toHaveBeenCalled();
    const [url, cfg] = spy.mock.calls[0];
    expect(cfg.method).toBe('POST');
    expect(cfg.body instanceof FormData).toBe(true);
    expect(cfg.headers['FX-Request']).toBe('true');
  });

  it('handles fetch error and dispatches fx:error event', async () => {
    // stub fetch to reject
    const err = new Error('network');
    vi.spyOn(window, 'fetch').mockRejectedValue(err);

    let caught = false;
    let errorDetail = null;
    button.addEventListener('fx:error', (e: any) => { 
      caught = true; 
      errorDetail = e.detail;
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // allow more time for async error handling
    await new Promise(r => setTimeout(r, 10));

    expect(caught).toBe(true);
    expect(errorDetail.error).toBe(err);
  });
});