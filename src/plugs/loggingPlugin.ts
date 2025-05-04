import type { FixiPlugs, RequestPluginContext } from '../hub/types';
import { PluginHook } from '../hub/types';

export const LoggingPlugin: FixiPlugs = {
  name: 'logging-plugin',
  version: '1.0.0',

  // Log outgoing request configs
  beforeRequest(ctx: RequestPluginContext) {
    console.log(`[${this.name}] [${PluginHook.BEFORE_REQUEST}]`, ctx.config);
    return ctx.config;
  },

  // Log incoming responses
  afterResponse(ctx: RequestPluginContext) {
    console.log(`[${this.name}] [${PluginHook.AFTER_RESPONSE}]`, ctx.response);
    return ctx.response!;
  },

  // Log any errors thrown during fetch
  onError(ctx: RequestPluginContext) {
    console.error(`[${this.name}] [${PluginHook.ERROR}]`, ctx.error);
  }
};