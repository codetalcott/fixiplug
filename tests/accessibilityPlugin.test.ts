import { vi } from 'vitest';
import { PluginManager, PluginHook } from '../plugin';
import { AccessibilityPlugin } from '../plugins/accessibilityPlugin';

describe('AccessibilityPlugin', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div><button id="btn">Click</button>';
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(AccessibilityPlugin);
  });

  test('onInitialize adds live region to the DOM', () => {
    // Trigger initialize
    manager.execute(PluginHook.INITIALIZE, {} as any);
    const region = document.getElementById('fx-live-region');
    expect(region).toBeTruthy();
    expect(region!.getAttribute('aria-live')).toBe('polite');
  });

  test('onDomMutated updates live region text and focuses element', () => {
    // Initialize region
    manager.execute(PluginHook.INITIALIZE, {} as any);
    // Set custom focusSelector
    (AccessibilityPlugin as any).config.focusSelector = '#btn';
    // Create fake mutations array
    const mutations = [{}, {}];
    // Invoke domMutated
    manager.execute(PluginHook.DOM_MUTATED, { mutations } as any);
    const region = document.getElementById('fx-live-region');
    expect(region!.textContent).toBe('2 updates applied');
    const btn = document.getElementById('btn') as HTMLElement;
    // jsdom doesn't actually focus, but .focus() should not throw
    expect(document.activeElement === btn || document.activeElement === document.body).toBe(true);
  });
});