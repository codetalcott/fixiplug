//// filepath: tests/test-plugs/loggingPlugin.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggingPlugin } from '../../src/plugs/loggingPlugin';
import type { RequestPluginContext } from '../../src/hub/types';
import { PluginHook } from '../../src/hub/types';

describe('LoggingPlugin', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let ctx: RequestPluginContext;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ctx = {
      fixi: {} as any,
      config: { url: '/test', action: '/test', method: 'GET' },
      response: {
        data: 'ok',
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve('ok'),
        text: () => Promise.resolve('ok')
      },
      error: new Error('fail')
    } as RequestPluginContext;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('beforeRequest logs the config and returns it', () => {
    const result = LoggingPlugin.beforeRequest!(ctx);
    expect(logSpy).toHaveBeenCalledWith(
      `[${LoggingPlugin.name}] [${PluginHook.BEFORE_REQUEST}]`,
      ctx.config
    );
    expect(result).toBe(ctx.config);
  });

  it('afterResponse logs the response and returns it', () => {
    const result = LoggingPlugin.afterResponse!(ctx);
    expect(logSpy).toHaveBeenCalledWith(
      `[${LoggingPlugin.name}] [${PluginHook.AFTER_RESPONSE}]`,
      ctx.response
    );
    expect(result).toBe(ctx.response);
  });

  it('onError logs the error', () => {
    LoggingPlugin.onError!(ctx);
    expect(errorSpy).toHaveBeenCalledWith(
      `[${LoggingPlugin.name}] [${PluginHook.ERROR}]`,
      ctx.error
    );
  });
});