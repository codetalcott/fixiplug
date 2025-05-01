import { createPlugin, PluginHook, RequestPluginContext } from '../hub';

export const CachePlugin = createPlugin({
  name: 'cache',
  version: '1.0.0',
  
  priority: 90,
  description: 'Caches GET responses with configurable TTL',
  author: 'Team Fixi',

  config: {
    ttl: 5 * 60 * 1000,
    cacheableMethods: ['GET'] as string[]
  },

  cache: new Map<string, { timestamp: number; data: any }>(),

  beforeRequest(ctx: RequestPluginContext) {
    const key = `${ctx.config.method || 'GET'}-${ctx.config.url}`;
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.ttl) {
      // Attach the cached response directly to ctx
      ctx.response = entry.data;
      // Set a flag to skip the fetch operation
      return { ...ctx.config, _cached: true, _skipFetch: true };
    }
    return ctx.config;
  },

  afterResponse(ctx: RequestPluginContext) {
    // If we've already set a cached response in beforeRequest, just return it
    if (ctx.config._cached) {
      return ctx.response!;
    }
    
    // Otherwise store the new response in cache
    if (ctx.response?.ok && this.config.cacheableMethods.includes(ctx.config.method || 'GET')) {
      const key = `${ctx.config.method || 'GET'}-${ctx.config.url}`;
      this.cache.set(key, { timestamp: Date.now(), data: ctx.response });
    }
    return ctx.response!;
  },

  getCache(key: string) {
    return this.cache.get(key);
  }
});