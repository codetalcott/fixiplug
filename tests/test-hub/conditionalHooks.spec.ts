import { describe, it, expect } from 'vitest';
import { PluginManager, createPlugin, PluginHook, RequestPluginContext } from '../plugin';

describe('Conditional Hook Execution', () => {
  it('skips hook when condition is false and runs when true', async () => {
    const manager = new PluginManager({ configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({}) } as any);
    const conditional = createPlugin({
      name: 'conditional', version: '1.0.0', apiVersion: '2.0.0',
      conditions: {
        [PluginHook.BEFORE_REQUEST]: (ctx: RequestPluginContext) => !!ctx.config.enablePlugin
      },
      beforeRequest(ctx: RequestPluginContext) {
        ctx.config.processed = true;
        return ctx.config;
      }
    });
    manager.register(conditional);

    const ctxFalse = { config: { url: '/test', enablePlugin: false } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctxFalse);
    expect(ctxFalse.config.processed).toBeUndefined();

    const ctxTrue = { config: { url: '/test', enablePlugin: true } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctxTrue);
    expect(ctxTrue.config.processed).toBe(true);
  });
});