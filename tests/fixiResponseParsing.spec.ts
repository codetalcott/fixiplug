import { describe, it, expect, beforeEach } from 'vitest';
import '../fixi.js'; // register element behavior

describe('Fixi Response Parsing', () => {
  let button: HTMLButtonElement;
  let fakeResponse: any;
  let lastCfg: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    button = document.createElement('button');
    button.setAttribute('fx-action', '/api');
    document.body.appendChild(button);
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // create a fake response with all parsers
    fakeResponse = {
      ok: true,
      text: () => Promise.resolve('plain text'),
      json: () => Promise.resolve({ a: 1 }),
      blob: () => Promise.resolve(new Blob(['x'])),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('hi').buffer),
      formData: () => Promise.resolve(new FormData())
    };
    // reset lastCfg to ensure fresh capture
    lastCfg = null;
    // capture cfg in fx:after event
    button.addEventListener('fx:after', e => { lastCfg = e.detail.cfg; });
  });

  it('sets cfg.text from response.text()', async () => {
    window.fetch = () => Promise.resolve(fakeResponse);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    
    // Wait until lastCfg is populated with the response
    await new Promise(r => setTimeout(r, 50));
    
    expect(lastCfg).not.toBeNull();
    expect(lastCfg.text).toBe('plain text');
  });

  it('exposes response.json, blob, arrayBuffer, formData methods', async () => {
    window.fetch = () => Promise.resolve(fakeResponse);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    
    // Wait until lastCfg is populated with the response
    await new Promise(r => setTimeout(r, 50));
    
    expect(lastCfg).not.toBeNull();
    expect(lastCfg.response).toBeDefined();

    // ensure parser methods exist and work
    await expect(lastCfg.response.json()).resolves.toEqual({ a: 1 });
    await expect(lastCfg.response.blob()).resolves.toBeInstanceOf(Blob);
    await expect(lastCfg.response.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
    await expect(lastCfg.response.formData()).resolves.toBeInstanceOf(FormData);
  });
});