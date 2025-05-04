import { expectType, expectAssignable } from 'tsd';
import {
  Plugin,
  PluginHook,
  PluginContext,
  RequestPluginContext,
  DomPluginContext,
  PluginDefinition,
  PluginHealthMetrics,
  PluginManagerExtension,
  PluginLogger,
  PluginSystemOptions
} from '../../src/hub/types';

// Logger interface
declare const logger: PluginLogger;
expectType<void>(logger.info('msg'));
expectType<void>(logger.warn('msg'));
expectType<void>(logger.error('msg'));
expectType<void | undefined>(logger.debug?.('msg'));

// Enum values
expectAssignable<PluginHook>(PluginHook.BEFORE_REQUEST);
expectAssignable<PluginHook>(PluginHook.AFTER_RESPONSE);

// Context extensions
declare const reqCtx: RequestPluginContext;
expectAssignable<PluginContext>(reqCtx);
expectAssignable<RequestPluginContext>(reqCtx);

declare const domCtx: DomPluginContext;
expectAssignable<PluginContext>(domCtx);
expectAssignable<DomPluginContext>(domCtx);

// Minimal Plugin
expectAssignable<Plugin>({ name: 'test', version: '1.0.0' });

// Full Plugin example
expectAssignable<Plugin>({
  name: 'full',
  version: '2.0.0',
  priority: 5,
  conditions: { [PluginHook.AFTER_RESPONSE]: ctx => true },
  timeouts: { [PluginHook.BEFORE_REQUEST]: 500 },
  fallbacks: { [PluginHook.ERROR]: (ctx, err) => {} },
  circuitBreaker: { failureThreshold: 3, resetTimeout: 1000 },
  beforeRequest(ctx) { return ctx.config; },
  afterResponse(ctx) { return ctx.response!; },
  onDomMutated(ctx) {},
  onInitialize(ctx) {},
  onDestroy(ctx) {},
  onError(ctx) {},
  dependencies: ['dep'],
  description: 'desc',
  author: 'me',
  customField: 123
});

// PluginDefinition
expectAssignable<PluginDefinition>({
  name: 'lazy',
  load: async () => ({ name: 'lazy', version: '1.0.0' })
});

// PluginHealthMetrics
declare const metrics: PluginHealthMetrics;
expectType<number>(metrics.totalCalls);
expectType<number>(metrics.errors);
expectType<number>(metrics.totalDuration);
expectType<number>(metrics.avgDuration);
expectType<Error | undefined>(metrics.lastError);
expectType<number | undefined>(metrics.lastExecuted);
expectType<{ isOpen: boolean; failures: number; lastFailure: number } | undefined>(metrics.circuit);

// PluginManagerExtension
expectAssignable<PluginManagerExtension>({
  init(manager) {},
  beforeRegister(plugin) { return false; },
  afterRegister(plugin) {},
  beforeUnregister(name, plugin) { return true; },
  afterUnregister(name, plugin) {},
  beforeExecute(hookType, context) { return context; },
  afterExecute(hookType, context) { return context; },
  beforeHook(plugin, hookType, context) { return false; },
  afterHook(plugin, hookType, context, error) {},
  onHookError(plugin, hookType, context, error) { return true; }
});

// PluginSystemOptions
expectAssignable<PluginSystemOptions>({
  plugins: [{ name: 'p1', version: '1.0.0' }],
  lazyPlugins: [{ name: 'lazy', load: async () => ({ name: 'p1', version: '1.0.0' }) }]
});
