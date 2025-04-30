import { createPlugin, FixiPlugin, PluginHook, RequestPluginContext, DomPluginContext } from '../plugin';

const devHookTester = createPlugin<FixiPlugin>({
  name: 'dev:hookTester',
  version: '1.0.0',
  apiVersion: '2.0.0',

  onInitialize: (ctx) => {
    console.warn('[dev:hookTester] initialize fired');
  },

  beforeRequest: (ctx: RequestPluginContext) => {
    console.warn('[dev:hookTester] beforeRequest fired', ctx.config);
    return ctx.config;
  },

  afterResponse: (ctx: RequestPluginContext) => {
    console.warn('[dev:hookTester] afterResponse fired', ctx.response);
    return ctx.response!;
  },

  onDomMutated: (ctx: DomPluginContext) => {
    console.warn('[dev:hookTester] domMutated fired', ctx.mutations);
  },

  onError: (ctx: RequestPluginContext) => {
    console.warn('[dev:hookTester] error hook fired', ctx.error);
  },

  onDestroy: (ctx) => {
    console.warn('[dev:hookTester] destroy fired');
  }
});

export default devHookTester;