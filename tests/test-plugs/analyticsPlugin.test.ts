import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../hub';
import { AnalyticsPlugin } from '../plugins/analyticsPlugin';

describe('AnalyticsPlugin', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(AnalyticsPlugin);
    // Reset events
    (AnalyticsPlugin as any).events.length = 0;
  });

  test('captures fxAnalyticsEvent from config on afterResponse', async () => {
    const ctx: RequestPluginContext = { fixi, config: { url: '/data', method: 'GET', fxAnalyticsEvent: 'test_event', fxAnalyticsProperties: { foo: 'bar' } }, response: { ok: true } } as any;
    await manager.execute(PluginHook.AFTER_RESPONSE, ctx);
    const events = (AnalyticsPlugin as any).getEvents();
    expect(events).toEqual([{ event: 'test_event', properties: { foo: 'bar' } }]);
  });

  test('ignores if fxAnalyticsEvent not provided', async () => {
    const ctx: RequestPluginContext = { fixi, config: { url: '/data', method: 'GET' }, response: { ok: true } } as any;
    await manager.execute(PluginHook.AFTER_RESPONSE, ctx);
    expect((AnalyticsPlugin as any).getEvents()).toHaveLength(0);
  });
});