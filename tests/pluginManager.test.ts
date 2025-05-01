import { vi, describe, it, expect } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../plugin';

describe('PluginManager', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    // Minimal Fixi stub
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
  });

  test('beforeRequest hook modifies config', async () => {
    manager.register({
      name: 'testPlugin',
      version: '1.0.0',
      
      beforeRequest: (ctx: RequestPluginContext) => {
        ctx.config.modified = true;
        return ctx.config;
      },
    });

    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
    const result = await manager.execute(PluginHook.BEFORE_REQUEST, ctx) as RequestPluginContext;
    expect(result.config.modified).toBe(true);
  });

  test('afterResponse hook modifies response', async () => {
    manager.register({
      name: 'respPlugin',
      version: '1.0.0',
      
      afterResponse: (ctx: RequestPluginContext) => {
        ctx.response = { ...ctx.response, processed: true };
        return ctx.response!;
      },
    });

    const res = { data: 123 };
    const ctx = { fixi, config: { url: '/test' }, response: res } as RequestPluginContext;
    const result = await manager.execute(PluginHook.AFTER_RESPONSE, ctx) as RequestPluginContext;
    expect(result.response.processed).toBe(true);
  });

  test('plugins execute in priority order', async () => {
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

    const ctx = { fixi, config: {} } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(calls).toEqual(['high', 'low']);
  });

  test('circuit breaker opens after threshold', async () => {
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