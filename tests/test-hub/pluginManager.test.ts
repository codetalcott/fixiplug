import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../../src/hub';
import { CircuitBreakerExtension } from '../../src/hub/extensions/circuitBreakerExtension';

describe('PluginManager', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    // Minimal Fixi stub
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    // wire in circuit‑breaker logic for these tests
    manager.use(new CircuitBreakerExtension());
  });

  it('beforeRequest hook modifies config', async () => {
    manager.register({
      name: 'testPlugin',
      version: '1.0.0',
      
      beforeRequest: (ctx: RequestPluginContext) => {
        ctx.config.modified = true;
        return ctx.config;
      },
    });

    const ctx = { fixi, config: { url: '/test', action: 'get', method: 'GET' } } as RequestPluginContext;
    const result = await manager.execute(PluginHook.BEFORE_REQUEST, ctx) as RequestPluginContext;
    expect(result.config.modified).toBe(true);
  });

  it('afterResponse hook modifies response', async () => {
    manager.register({
      name: 'respPlugin',
      version: '1.0.0',
      
      afterResponse: (ctx: RequestPluginContext) => {
        ctx.response = { ...ctx.response, processed: true } as any;
        return ctx.response!;
      },
    });

    const res = { data: 123, ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ data: 123 }), text: () => Promise.resolve('') };
    const ctx = { fixi, config: { url: '/test', action: 'get', method: 'GET' }, response: res } as RequestPluginContext;
    const result = await manager.execute(PluginHook.AFTER_RESPONSE, ctx) as RequestPluginContext;
    expect((result.response as any).processed).toBe(true);
  });

  it('plugins execute in priority order', async () => {
    const calls: string[] = [];
    manager.register({
      name: 'low',
      version: '1.0.0',
      
      priority: 1,
      beforeRequest: (ctx) => {
        calls.push('low');
        return ctx.config;
      },
    });
    manager.register({
      name: 'high',
      version: '1.0.0',
      
      priority: 10,
      beforeRequest: (ctx) => {
        calls.push('high');
        return ctx.config;
      },
    });

    const ctx = { fixi, config: { action: 'get', method: 'GET' } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(calls).toEqual(['high', 'low']);
  });

  it('circuit breaker opens after threshold', async () => {
    manager.register({
      name: 'badPlugin',
      version: '1.0.0',
      
      beforeRequest: () => { throw new Error('fail'); },
      circuitBreaker: { failureThreshold: 2, resetTimeout: 1000 },
    });

    const ctx = { fixi, config: {} } as RequestPluginContext;
    // First failure
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    // Second failure, opens circuit
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
    // Third call: circuit open, plugin should be skipped (no error thrown)
    await expect(manager.execute(PluginHook.BEFORE_REQUEST, ctx)).resolves.toEqual(ctx);

    const metrics = manager.getPluginHealth('badPlugin');
    const hookMetrics = metrics.beforeRequest;
    expect(hookMetrics.circuit!.isOpen).toBe(true);
  });
});