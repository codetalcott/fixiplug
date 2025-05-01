import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  createPlugin, 
  FixiWithPlugins, 
  RequestPluginContext 
} from '../../src/hub'
describe('FixiWithPlugins Enhanced Fetch', () => {
  let fixi: any;
  let proxy: FixiWithPlugins;

  beforeEach(() => {
    // Create a proper spy mock for fetch
    fixi = {
      configure: () => ({ config: { logger: console } }),
      fetch: vi.fn()
    };
    // Set up the mock to return a successful response
    fixi.fetch.mockResolvedValue({ 
      ok: true, 
      status: 200, 
      json: async () => ({ success: true }) 
    });
    
    proxy = new FixiWithPlugins(fixi);
  });

  it('executes beforeRequest and afterResponse hooks around fetch', async () => {
    const calls: string[] = [];
    const tracker = createPlugin({
      name: 'tracker', version: '1.0.0', 
      beforeRequest(ctx: RequestPluginContext) {
        calls.push('before'); return ctx.config;
      },
      afterResponse(ctx: RequestPluginContext) {
        calls.push('after'); return ctx.response!;
      }
    });
    proxy.registerPlugin(tracker);

    const response = await proxy.fetch({ url: '/test', action: '/test', method: 'GET' });
    expect(calls).toEqual(['before', 'after']);
    
    // Verify that fetch was called, ensuring our mock is properly set up
    expect(fixi.fetch).toHaveBeenCalledTimes(1);
    expect(fixi.fetch).toHaveBeenCalledWith({ url: '/test', action: '/test', method: 'GET' });
    expect(response.ok).toBe(true);
  });

  it('invokes onError hook when fetch fails', async () => {
    fixi.fetch = vi.fn().mockRejectedValue(new Error('network fail'));
    proxy = new FixiWithPlugins(fixi);
    const errors: any[] = [];
    const errorPlug = createPlugin({
      name: 'errPlug', version: '1.0.0', 
      onError(ctx: RequestPluginContext) {
        errors.push(ctx.error);
      }
    });
    proxy.registerPlugin(errorPlug);

    await expect(proxy.fetch({ url: '/error', action: '/error', method: 'GET' })).rejects.toThrow('network fail');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('network fail');
  });
});