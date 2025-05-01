import { describe, it, expect } from 'vitest';
import { PluginManager, createPlugin, PluginHook, RequestPluginContext } from '../../src/hub';

describe('Error Fallbacks', () => {
  it('uses configured fallbacks when hooks throw errors', async () => {
    const manager = new PluginManager({ configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({}) } as any);
    const plugin = createPlugin({
      name: 'fallbackTest', version: '1.0.0', 
      beforeRequest(ctx: RequestPluginContext) {
        throw new Error('fail');
      },
      fallbacks: {
        [PluginHook.BEFORE_REQUEST]: (ctx: RequestPluginContext) => {
          ctx.config.processed = 'fallback';
          return ctx.config;
        }
      }
    });
    manager.register(plugin);
    const ctx = { 
      config: { url: '/test', action: 'test', method: 'GET' }, 
      fixi: { 
        fetch: () => Promise.resolve({ 
          ok: true, 
          status: 200, 
          headers: new Headers(), 
          json: () => Promise.resolve({}), 
          text: () => Promise.resolve('') 
        }) 
      } 
    } as unknown as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(ctx.config.processed).toBe('fallback');
  });
});