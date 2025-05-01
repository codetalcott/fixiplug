import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext } from '../plugin';
import { CachePlugin } from '../plugins/cachePlugin';

describe('CachePlugin', () => {
  let manager: PluginManager;
  let fixi: any;
  const url = '/test';
  const method = 'GET';

  beforeEach(() => {
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(CachePlugin);
    // Ensure cache is empty
    (CachePlugin as any).cache.clear();
  });

  test('stores response in cache after first request', async () => {
    const fakeResponse = { ok: true, status: 200, data: { a: 1 } } as any;
    const ctx: RequestPluginContext = { fixi, config: { url, method }, response: fakeResponse } as any;

    // Simulate afterResponse
    await manager.execute(PluginHook.AFTER_RESPONSE, ctx);

    const key = `${method}-${url}`;
    const entry = CachePlugin.getCache(key);
    expect(entry).toBeDefined();
    expect(entry!.data).toBe(fakeResponse);
  });

  test('serves cached response on subsequent requests and skips fetch', async () => {
    const fakeResponse = { ok: true, status: 200, data: { b: 2 } } as any;
    const ctx1: RequestPluginContext = { fixi, config: { url, method }, response: fakeResponse } as any;

    // Prime cache
    await manager.execute(PluginHook.AFTER_RESPONSE, ctx1);
    // Spy fetch to detect calls
    (fixi.fetch as vi.Mock).mockImplementation(() => Promise.resolve({}));

    // Next beforeRequest
    const ctx2: RequestPluginContext = { fixi, config: { url, method }, response: undefined } as any;
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx2);

    // Plugin should attach cached response
    expect((ctx2 as any).response).toBe(fakeResponse);
    expect((ctx2 as any)._skipFetch).toBe(true);
  });
});