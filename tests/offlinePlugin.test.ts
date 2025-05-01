import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../plugin';
import { OfflinePlugin } from '../plugins/offlinePlugin';

describe('OfflinePlugin', () => {
  let manager: PluginManager;
  let ctx: RequestPluginContext;

  beforeEach(() => {
    // Minimal Fixi stub
    const fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(OfflinePlugin);

    // Force offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    ctx = { fixi, config: { url: '/test', method: 'GET' } } as RequestPluginContext;
    // Clear queue
    (OfflinePlugin as any).queue.length = 0;
  });

  test('queues requests when offline', async () => {
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect((OfflinePlugin as any).queue).toHaveLength(1);
    expect((OfflinePlugin as any).queue[0].config.url).toBe('/test');
  });

  test('does not queue when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true });
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect((OfflinePlugin as any).queue).toHaveLength(0);
  });
});