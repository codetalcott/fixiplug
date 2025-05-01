import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../hub';

describe('Circuit Breaker Lifecycle', () => {
  let manager: PluginManager;
  let fixi: any;
  let testPlugin: any;
  let ctx: RequestPluginContext;

  beforeEach(() => {
    vi.useFakeTimers();
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn().mockResolvedValue({ ok: true }) };
    manager = new PluginManager(fixi);
    testPlugin = createPlugin({
      name: 'circuitTest', version: '1.0.0', 
      circuitBreaker: { failureThreshold: 2, resetTimeout: 5000 },
      callCount: 0,
      beforeRequest(ctx) {
        this.callCount++;
        if (this.callCount <= 2) throw new Error('fail');
        ctx.config.processed = true;
        return ctx.config;
      }
    });
    manager.register(testPlugin);
    ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('opens circuit after threshold failures and prevents further calls', async () => {
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    expect(testPlugin.callCount).toBe(2);

    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(testPlugin.callCount).toBe(2);
    const health = manager.getPluginHealth('circuitTest');
    expect(health.beforeRequest.circuit?.isOpen).toBe(true);
  });

  it('closes circuit after timeout and allows calls', async () => {
    // First make sure the circuit is open
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    expect(testPlugin.callCount).toBe(2);
    
    // Then reset after timeout
    vi.advanceTimersByTime(6000);
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(testPlugin.callCount).toBe(3);
    expect(ctx.config.processed).toBe(true);
    const healthAfter = manager.getPluginHealth('circuitTest');
    expect(healthAfter.beforeRequest.circuit?.isOpen).toBe(false);
  });
});