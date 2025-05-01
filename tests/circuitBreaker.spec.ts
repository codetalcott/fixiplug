import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../plugin';

describe('Circuit Breaker Lifecycle', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    vi.useFakeTimers();
    fixi = {
      configure: () => ({ config: { logger: console } }),
      fetch: vi.fn().mockResolvedValue({ ok: true })
    };
    manager = new PluginManager(fixi);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('opens circuit after threshold failures and prevents further calls', async () => {
    const testPlugin = createPlugin({
      name: 'circuitTest', version: '1.0.0', apiVersion: '2.0.0',
      circuitBreaker: { failureThreshold: 2, resetTimeout: 5000 },
      callCount: 0,
      beforeRequest(ctx: RequestPluginContext) {
        this.callCount++;
        if (this.callCount <= 2) throw new Error('fail');
        ctx.config.processed = true;
        return ctx.config;
      }
    });
    manager.register(testPlugin);
    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;

    // first two failures
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    expect(testPlugin.callCount).toBe(2);

    // third call skipped due to open circuit
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(testPlugin.callCount).toBe(2);
    const health = manager.getPluginHealth('circuitTest');
    expect(health.beforeRequest.circuit?.isOpen).toBe(true);
  });

  it('closes circuit after timeout and allows calls', async () => {
    const testPlugin = manager.get('circuitTest') as any; // reuse same plugin
    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;

    // fast-forward past reset timeout
    vi.advanceTimersByTime(6000);
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(testPlugin.callCount).toBe(3);
    expect(ctx.config.processed).toBe(true);
    const healthAfter = manager.getPluginHealth('circuitTest');
    expect(healthAfter.beforeRequest.circuit?.isOpen).toBe(false);
  });
});