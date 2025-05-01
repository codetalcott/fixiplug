import { describe, it, expect, beforeEach } from 'vitest';
import '../fixi.js';

describe('Fixi Swap Logic', () => {
  let button: HTMLElement;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    // container target
    container = document.createElement('div');
    container.id = 'target';
    container.textContent = 'initial';
    document.body.appendChild(container);
    // button with fx-action and fx-target
    button = document.createElement('button');
    button.setAttribute('fx-action', '/');
    button.setAttribute('fx-target', '#target');
    document.body.appendChild(button);
    // initialize
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  it('replaces innerHTML when swap property is innerHTML', async () => {
    button.setAttribute('fx-swap', 'innerHTML');
    // stub fetch and text
    window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('<p>new</p>') } as any);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('appends HTML with insertAdjacentHTML for beforeend', async () => {
    button.setAttribute('fx-swap', 'beforeend');
    window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('<span>app</span>') } as any);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.innerHTML).toBe('initial<span>app</span>');
  });

  it('executes custom swap function when cfg.swap is a function', async () => {
    let cfgRef: any;
    // capture config and override swap
    button.addEventListener('fx:config', e => {
      cfgRef = e.detail.cfg;
      cfgRef.swap = (cfg: any) => { cfg.target.textContent = 'fn-swap'; };
    });
    window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('ignored') } as any);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(container.textContent).toBe('fn-swap');
  });

  it('throws on invalid swap value', async () => {
    button.setAttribute('fx-swap', 'unknownMethod');
    window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('x') } as any);

    let err: any;
    try {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 0));
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('unknownMethod');
  });
});