import { vi } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../plugin';
import { LoadingPlugin } from '../plugins/loadingPlugin';

describe('LoadingPlugin', () => {
  let manager: PluginManager;
  let callCtx: RequestPluginContext;

  beforeEach(() => {
    // Set up jsdom body
    document.body.innerHTML = '<div></div>';
    const fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(LoadingPlugin);
    callCtx = { fixi, config: { url: '/test', method: 'GET' } } as RequestPluginContext;
  });

  test('adds loading class before request', async () => {
    await manager.execute(PluginHook.BEFORE_REQUEST, callCtx);
    expect(document.body.classList.contains('fx-loading')).toBe(true);
  });

  test('removes loading class after response', async () => {
    // Add class first
    document.body.classList.add('fx-loading');
    const res = { ok: true } as any;
    const ctx = { ...callCtx, response: res } as RequestPluginContext;
    await manager.execute(PluginHook.AFTER_RESPONSE, ctx);
    expect(document.body.classList.contains('fx-loading')).toBe(false);
  });
});