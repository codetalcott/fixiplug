import { vi } from 'vitest';
import { PluginManager, PluginHook } from '../plugin';
import { LoggingPlugin } from '../plugins/loggingPlugin';

describe('LoggingPlugin', () => {
  let manager: PluginManager;
  let fixi: any;
  let consoleInfoSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;

  beforeEach(() => {
    // Stub Fixi with minimal interface
    fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    manager = new PluginManager(fixi);
    manager.register(LoggingPlugin);

    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('increments metrics on beforeRequest and afterResponse', async () => {
    const ctx = { fixi, config: { url: '/test', method: 'GET' } };
    // BEFORE_REQUEST
    const before = await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    expect(before.config).toBe(before.config);
    // metrics: totalRequests = 1
    let metrics = (LoggingPlugin as any).getMetrics();
    expect(metrics.totalRequests).toBe(1);

    // Prepare fake response
    const fakeResponse = { ok: true, status: 200, url: '/test' } as any;

    // AFTER_RESPONSE
    const afterCtx = { fixi, config: before.config, response: fakeResponse };
    const after = await manager.execute(PluginHook.AFTER_RESPONSE, afterCtx);
    expect(after.response).toBe(fakeResponse);

    metrics = (LoggingPlugin as any).getMetrics();
    expect(metrics.successRequests).toBe(1);
    expect(metrics.totalDuration).toBeGreaterThanOrEqual(0);
    expect(metrics.requestsByEndpoint['/test'].count).toBe(1);
  });

  test('logs errors on onError hook', async () => {
    // Prepare plugin for error
    (fixi.fetch as vi.Mock).mockRejectedValue(new Error('fail'));
    const ctx = { fixi, config: { url: '/err', method: 'POST' } };

    // Simulate error
    await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
    await manager.execute(PluginHook.AFTER_RESPONSE, { ...ctx, response: { ok: false, status: 500 } as any });
    await manager.execute(PluginHook.ERROR, { ...ctx, error: new Error('fail') as any });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});