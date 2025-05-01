import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../plugin';

describe('Plugin Health Monitoring', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    fixi = { configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({ ok: true }) };
    manager = new PluginManager(fixi);
  });

  it('tracks totalCalls and errors for a plugin hook', async () => {
    const plugin = createPlugin({
      name: 'healthPlugin', version: '1.0.0', 
      beforeRequest(ctx: RequestPluginContext) {
        return ctx.config;
      }
    });
    manager.register(plugin);

    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);

    const health = manager.getPluginHealth('healthPlugin');
    expect(health.beforeRequest.totalCalls).toBe(2);
    expect(health.beforeRequest.errors).toBe(0);
  });

  it('resets health metrics when resetHealthMetrics is called', async () => {
    const plugin = createPlugin({
      name: 'healthPlugin', version: '1.0.0', 
      beforeRequest(ctx: RequestPluginContext) {
        return ctx.config;
      }
    });
    manager.register(plugin);

    const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);

    manager.resetHealthMetrics('healthPlugin');
    const healthAfter = manager.getPluginHealth('healthPlugin');
    expect(healthAfter.beforeRequest).toBeUndefined();
  });
});