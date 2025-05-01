import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../plugin';

describe('Timeout Protection', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    vi.useFakeTimers();
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn().mockResolvedValue({ ok: true }) };
    manager = new PluginManager(fixi);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('aborts slow plugin hooks after timeout and records an error', async () => {
    const slowPlugin = createPlugin({
      name: 'slowPlugin', version: '1.0.0', 
      timeouts: { [PluginHook.BEFORE_REQUEST]: 1000 },
      async beforeRequest(ctx: RequestPluginContext) {
        await new Promise(r => setTimeout(r, 5000));
        ctx.config.processed = true;
        return ctx.config;
      }
    });
    manager.register(slowPlugin);
    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;

    const p = manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    vi.advanceTimersByTime(1500);
    await p.catch(() => {});

    expect(ctx.config.processed).toBeUndefined();
    const health = manager.getPluginHealth('slowPlugin');
    expect(health.beforeRequest.errors).toBe(1);
  });
});