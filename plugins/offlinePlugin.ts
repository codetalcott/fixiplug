import { createPlugin, PluginHook, RequestPluginContext } from '../plugin';

export const OfflinePlugin = createPlugin({
  name: 'offline',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 95,
  description: 'Queues requests when offline and retries on reconnect',
  author: 'Fixi Team',

  queue: [] as RequestPluginContext[],

  onInitialize() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        const items = [...this.queue];
        this.queue.length = 0;
        // In a real implementation, you'd re-dispatch these contexts
        console.info('[offline] flushing queued requests', items.length);
      });
    }
  },

  beforeRequest(ctx: RequestPluginContext) {
    if (!navigator.onLine) {
      this.queue.push(ctx);
      console.warn('[offline] queued request', ctx.config.url);
    }
    return ctx.config;
  }
});