import { describe, it, expect } from 'vitest';
import { PluginManager, createPlugin, PluginHook, RequestPluginContext } from '../../src/hub';

describe('Plugin Dependencies', () => {
  it('rejects plugins with missing dependencies', () => {
    const manager = new PluginManager({ 
      configure: () => ({ config: { logger: console } }),
      fetch: () => Promise.resolve({})
    } as any);
    const dependent = createPlugin({
      name: 'dependent', version: '1.0.0', 
      dependencies: ['missing'],
      beforeRequest(ctx: RequestPluginContext) { return ctx.config; }
    });
    const result = manager.register(dependent);
    expect(result).toBe(false);
  });

  it('executes dependent plugins in correct order', async () => {
    const manager = new PluginManager({ configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({}) } as any);
    const order: string[] = [];
    const first = createPlugin({
      name: 'first', version: '1.0.0', 
      beforeRequest(ctx: RequestPluginContext) { order.push('first'); return ctx.config; }
    });
    const second = createPlugin({
      name: 'second', version: '1.0.0',  dependencies: ['first'],
      beforeRequest(ctx: RequestPluginContext) { order.push('second'); return ctx.config; }
    });
    manager.register(first);
    manager.register(second);
    await manager.execute(PluginHook.BEFORE_REQUEST, { config: { url: '/test' } } as any);
    expect(order).toEqual(['first', 'second']);
  });
});