import { createPlugin, RequestPluginContext } from '../plugin';

export const AnalyticsPlugin = createPlugin({
  name: 'analytics',
  version: '1.0.0',
  
  priority: 100,
  description: 'Tracks custom events for AJAX interactions',
  author: 'Team Fixi',

  events: [] as Array<{ event: string; properties: any }>,

  afterResponse(ctx: RequestPluginContext) {
    const ev = (ctx.config as any).fxAnalyticsEvent;
    const props = (ctx.config as any).fxAnalyticsProperties;
    if (typeof ev === 'string') {
      this.events.push({ event: ev, properties: props });
    }
    return ctx.response!;
  },

  getEvents() {
    return [...this.events];
  }
});