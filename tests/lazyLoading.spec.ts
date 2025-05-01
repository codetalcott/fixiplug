import { describe, it, expect } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../plugin';

describe('Lazy Loading', () => {
  it('does not register plugin until loadPlugin is called', async () => {
    const manager = new PluginManager({ configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({ ok: true }) } as any);
    const lazyDef = {
      name: 'lazyPlugin',
      load: async () => createPlugin({
        name: 'lazyPlugin', version: '1.0.0', apiVersion: '2.0.0',
        beforeRequest(ctx: RequestPluginContext) {
          ctx.config.processed = 'lazy';
          return ctx.config;
        }
      })
    };
    manager.registerLazy(lazyDef);
    expect(manager.get('lazyPlugin')).toBeUndefined();

    const loaded = await manager.loadPlugin('lazyPlugin');
    expect(loaded?.name).toBe('lazyPlugin');

    const ctx = { config: { url: '/test' } } as RequestPluginContext;
    await manager.execute(PluginHook.BEFORE_REQUEST, { fixi: manager['fixi'], ...ctx });
    expect(ctx.config.processed).toBe('lazy');
  });

  it('loadAllPlugins loads every lazy definition', async () => {
    const manager = new PluginManager({ configure: () => ({ config: { logger: console } }), fetch: () => Promise.resolve({ ok: true }) } as any);
    const defs = ['one', 'two'].map(name => ({
      name,
      load: async () => createPlugin({ name, version: '1.0.0', apiVersion: '2.0.0' })
    }));
    defs.forEach(def => manager.registerLazy(def));

    await manager.loadAllPlugins();
    expect(manager.get('one')).toBeDefined();
    expect(manager.get('two')).toBeDefined();
  });
});