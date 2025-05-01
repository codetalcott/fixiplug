import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginManager, PluginHook, RequestPluginContext, createPlugin } from '../plugin';

describe('Plugin Advanced Features', () => {
  let manager: PluginManager;
  let fixi: any;

  beforeEach(() => {
    // Reset mocks and timers for each test
    vi.useFakeTimers();
    
    // Set up a minimal Fixi stub
    fixi = { 
      configure: () => ({ config: { logger: console } }), 
      fetch: vi.fn().mockResolvedValue({ ok: true }) 
    };
    
    // Create a new plugin manager for each test
    manager = new PluginManager(fixi);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('Circuit Breaker Lifecycle', () => {
    // Test the complete lifecycle of the circuit breaker pattern
    it('should open after threshold failures, remain open, then close after timeout', async () => {
      // Create a plugin with circuit breaker that fails and then succeeds
      const testPlugin = createPlugin({
        name: 'circuitTest',
        version: '1.0.0',
        apiVersion: '2.0.0',
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 5000 // 5 seconds timeout
        },
        
        // Counter to track calls
        callCount: 0,
        
        // This hook will fail twice, then succeed
        beforeRequest(ctx: RequestPluginContext) {
          this.callCount++;
          
          if (this.callCount <= 2) {
            throw new Error('Simulated failure');
          }
          
          // After two failures, start succeeding
          ctx.config.processed = true;
          return ctx.config;
        }
      });
      
      manager.register(testPlugin);
      
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      
      // First call - should fail but circuit remains closed
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
      expect(testPlugin.callCount).toBe(1);
      
      // Second call - should fail and open the circuit
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx).catch(() => {});
      expect(testPlugin.callCount).toBe(2);
      
      // Third call - circuit is open, so plugin should be skipped
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      expect(testPlugin.callCount).toBe(2); // Count shouldn't increase
      expect(ctx.config.processed).toBeUndefined();
      
      // Check plugin health metrics show circuit is open
      const health = manager.getPluginHealth('circuitTest');
      expect(health.beforeRequest.circuit?.isOpen).toBe(true);
      
      // Advance time past the reset timeout
      vi.advanceTimersByTime(6000);
      
      // Next call - circuit should close and allow call through, which succeeds
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      expect(testPlugin.callCount).toBe(3);
      expect(ctx.config.processed).toBe(true);
      
      // Check plugin health metrics show circuit is closed
      const healthAfter = manager.getPluginHealth('circuitTest');
      expect(healthAfter.beforeRequest.circuit?.isOpen).toBe(false);
    });
  });

  describe('Timeout Protection', () => {
    it('should abort slow plugin hooks after timeout', async () => {
      // Create a plugin with a hook that takes too long
      const slowPlugin = createPlugin({
        name: 'slowPlugin',
        version: '1.0.0',
        apiVersion: '2.0.0',
        timeouts: {
          [PluginHook.BEFORE_REQUEST]: 1000 // 1 second timeout
        },
        
        async beforeRequest(ctx: RequestPluginContext) {
          // Simulate a hook that never resolves by setting up a promise that resolves after timeout
          await new Promise(resolve => {
            setTimeout(resolve, 5000); // 5 seconds, longer than timeout
          });
          
          // This should never execute due to timeout
          ctx.config.processed = true;
          return ctx.config;
        }
      });
      
      manager.register(slowPlugin);
      
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      
      // Execute hook with timeout protection
      const executePromise = manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      
      // Advance past the timeout
      vi.advanceTimersByTime(1500);
      
      // Execution should complete with timeout error
      await executePromise.catch(() => {});
      
      // The hook should have been aborted before setting the flag
      expect(ctx.config.processed).toBeUndefined();
      
      // Check plugin health metrics
      const health = manager.getPluginHealth('slowPlugin');
      expect(health.beforeRequest.errors).toBe(1);
    });
  });

  describe('Plugin Dependencies', () => {
    it('should reject plugins with missing dependencies', () => {
      const dependentPlugin = createPlugin({
        name: 'dependent',
        version: '1.0.0',
        apiVersion: '2.0.0',
        dependencies: ['missing'],
        
        beforeRequest(ctx: RequestPluginContext) {
          return ctx.config;
        }
      });
      
      // Attempt to register plugin with missing dependency
      const result = manager.register(dependentPlugin);
      
      // Should fail registration
      expect(result).toBe(false);
    });
    
    it('should respect dependency order when executing hooks', async () => {
      const executionOrder: string[] = [];
      
      // Create first plugin (dependency)
      const firstPlugin = createPlugin({
        name: 'first',
        version: '1.0.0',
        apiVersion: '2.0.0',
        priority: 5, // Lower priority, but should run first due to being a dependency
        
        beforeRequest(ctx: RequestPluginContext) {
          executionOrder.push('first');
          return ctx.config;
        }
      });
      
      // Create second plugin that depends on first
      const secondPlugin = createPlugin({
        name: 'second',
        version: '1.0.0',
        apiVersion: '2.0.0',
        priority: 10, // Higher priority, but should run after dependency
        dependencies: ['first'],
        
        beforeRequest(ctx: RequestPluginContext) {
          executionOrder.push('second');
          return ctx.config;
        }
      });
      
      // Register plugins
      manager.register(firstPlugin);
      manager.register(secondPlugin);
      
      // Execute hook
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      
      // Check execution order respects dependencies
      expect(executionOrder).toEqual(['first', 'second']);
    });
  });

  describe('Error Fallbacks', () => {
    it('should use fallbacks when hooks throw errors', async () => {
      // Create a plugin with error fallbacks
      const fallbackPlugin = createPlugin({
        name: 'fallbackTest',
        version: '1.0.0',
        apiVersion: '2.0.0',
        
        // This hook will fail
        beforeRequest(ctx: RequestPluginContext) {
          throw new Error('Simulated error');
        },
        
        // Fallback will be used instead
        fallbacks: {
          [PluginHook.BEFORE_REQUEST]: (ctx: RequestPluginContext) => {
            ctx.config.processed = 'by-fallback';
            return ctx.config;
          }
        }
      });
      
      manager.register(fallbackPlugin);
      
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      
      // Execute hook with fallback
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      
      // Fallback should have processed the context
      expect(ctx.config.processed).toBe('by-fallback');
    });
  });

  describe('Lazy Loading', () => {
    it('should register and load lazy plugins on demand', async () => {
      // Define a lazy plugin
      const lazyDef = {
        name: 'lazyPlugin',
        load: async () => createPlugin({
          name: 'lazyPlugin',
          version: '1.0.0',
          apiVersion: '2.0.0',
          
          beforeRequest(ctx: RequestPluginContext) {
            ctx.config.processed = 'lazy-loaded';
            return ctx.config;
          }
        })
      };
      
      // Register the lazy plugin
      manager.registerLazy(lazyDef);
      
      // Verify it's not available yet
      expect(manager.get('lazyPlugin')).toBeUndefined();
      
      // Load the plugin
      const loadedPlugin = await manager.loadPlugin('lazyPlugin');
      
      // Verify it loaded correctly
      expect(loadedPlugin).toBeDefined();
      expect(loadedPlugin?.name).toBe('lazyPlugin');
      
      // Test the plugin works
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      
      expect(ctx.config.processed).toBe('lazy-loaded');
    });
    
    it('should load all lazy plugins with loadAllPlugins', async () => {
      // Define multiple lazy plugins
      const lazyDef1 = {
        name: 'lazy1',
        load: async () => createPlugin({
          name: 'lazy1',
          version: '1.0.0',
          apiVersion: '2.0.0'
        })
      };
      
      const lazyDef2 = {
        name: 'lazy2',
        load: async () => createPlugin({
          name: 'lazy2',
          version: '1.0.0',
          apiVersion: '2.0.0'
        })
      };
      
      // Register the lazy plugins
      manager.registerLazy(lazyDef1);
      manager.registerLazy(lazyDef2);
      
      // Load all plugins
      await manager.loadAllPlugins();
      
      // Verify both plugins loaded
      expect(manager.get('lazy1')).toBeDefined();
      expect(manager.get('lazy2')).toBeDefined();
    });
  });

  describe('Conditional Hook Execution', () => {
    it('should skip hooks when conditions are not met', async () => {
      const conditionalPlugin = createPlugin({
        name: 'conditional',
        version: '1.0.0',
        apiVersion: '2.0.0',
        
        // Add a condition that checks for a flag
        conditions: {
          [PluginHook.BEFORE_REQUEST]: (ctx: RequestPluginContext) => {
            return !!ctx.config.enablePlugin;
          }
        },
        
        beforeRequest(ctx: RequestPluginContext) {
          ctx.config.processed = true;
          return ctx.config;
        }
      });
      
      manager.register(conditionalPlugin);
      
      // Test with condition not met
      const ctx1 = { fixi, config: { url: '/test', enablePlugin: false } } as RequestPluginContext;
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx1);
      expect(ctx1.config.processed).toBeUndefined();
      
      // Test with condition met
      const ctx2 = { fixi, config: { url: '/test', enablePlugin: true } } as RequestPluginContext;
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx2);
      expect(ctx2.config.processed).toBe(true);
    });
  });

  describe('Plugin Health Monitoring', () => {
    it('should track execution metrics', async () => {
      const metricPlugin = createPlugin({
        name: 'metrics',
        version: '1.0.0',
        apiVersion: '2.0.0',
        
        beforeRequest(ctx: RequestPluginContext) {
          // Slow operation to measure
          for (let i = 0; i < 100000; i++) {
            // Just burn some CPU cycles
          }
          return ctx.config;
        }
      });
      
      manager.register(metricPlugin);
      
      // Execute hook multiple times
      const ctx = { fixi, config: { url: '/test' } } as RequestPluginContext;
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      await manager.execute(PluginHook.BEFORE_REQUEST, ctx);
      
      // Check health metrics were tracked
      const health = manager.getPluginHealth('metrics');
      expect(health.beforeRequest.totalCalls).toBe(2);
      expect(health.beforeRequest.errors).toBe(0);
      expect(health.beforeRequest.totalDuration).toBeGreaterThan(0);
      
      // Reset metrics
      manager.resetHealthMetrics('metrics');
      
      // Check metrics were reset
      const resetHealth = manager.getPluginHealth('metrics');
      expect(resetHealth.beforeRequest).toBeUndefined();
    });
  });

  describe('API Version Compatibility', () => {
    it('should reject plugins with incompatible API versions', () => {
      const incompatiblePlugin = createPlugin({
        name: 'incompatible',
        version: '1.0.0',
        apiVersion: '3.0.0', // Different major version from current 2.0.0
        
        beforeRequest(ctx: RequestPluginContext) {
          return ctx.config;
        }
      });
      
      // Attempt to register incompatible plugin
      const result = manager.register(incompatiblePlugin);
      
      // Should fail registration
      expect(result).toBe(false);
    });
    
    it('should accept plugins with compatible API versions', () => {
      const compatiblePlugin = createPlugin({
        name: 'compatible',
        version: '1.0.0',
        apiVersion: '2.1.0', // Same major version, different minor
        
        beforeRequest(ctx: RequestPluginContext) {
          return ctx.config;
        }
      });
      
      // Attempt to register compatible plugin
      const result = manager.register(compatiblePlugin);
      
      // Should succeed
      expect(result).toBe(true);
      expect(manager.get('compatible')).toBeDefined();
    });
  });

  describe('FixiWithPlugins Enhanced Fetch', () => {
    it('integration test for FixiWithPlugins.fetch handling', async () => {
      // Import FixiWithPlugins and create a test instance
      const { FixiWithPlugins } = await import('../plugin');
      
      // Track execution of hooks
      const hookExecutions: string[] = [];
      
      // Register plugins to track hook execution
      const testFixi = new FixiWithPlugins(fixi);
      
      testFixi.registerPlugin(createPlugin({
        name: 'tracker',
        version: '1.0.0',
        apiVersion: '2.0.0',
        
        beforeRequest(ctx: RequestPluginContext) {
          hookExecutions.push('beforeRequest');
          return ctx.config;
        },
        
        afterResponse(ctx: RequestPluginContext) {
          hookExecutions.push('afterResponse');
          return ctx.response!;
        }
      }));
      
      // Make a request using enhanced fetch
      await testFixi.fetch({ url: '/test' });
      
      // Verify both hooks were called in correct order
      expect(hookExecutions).toEqual(['beforeRequest', 'afterResponse']);
      
      // Verify original fetch was called
      expect(fixi.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
