import { createPlugin, FixiPlugs, PluginHook, RequestPluginContext } from '../plugin';

export const LoadingPlugin = createPlugin<FixiPlugs>({
  name: 'loading',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 90,
  description: 'Toggles a loading indicator class on the body during requests',
  author: 'Fixi Team',

  config: {
    loadingClass: 'fx-loading'
  },

  beforeRequest(ctx: RequestPluginContext) {
    document.body.classList.add(this.config.loadingClass);
    return ctx.config;
  },

  afterResponse(ctx: RequestPluginContext) {
    document.body.classList.remove(this.config.loadingClass);
    return ctx.response!;
  }
});