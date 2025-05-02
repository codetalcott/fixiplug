import { vi, describe, it, expect, test, beforeEach } from 'vitest';
import { PluginManager, PluginHook } from '../../src/hub';
import { Fixi } from '../../src/core/fixi';
import { createPluginSystem, createPlugin } from '../../src/hub/factory';

// Create a set of test plugins
const createTestPlugins = (count: number) => {
  const plugins = [];
  
  for (let i = 0; i < count; i++) {
    plugins.push(createPlugin({
      name: `test-plugin-${i}`,
      version: '1.0.0',
      priority: Math.floor(Math.random() * 10),
      
      beforeRequest: async (ctx: any) => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 1) {} // Busy wait for 1ms
        
        return {
          ...ctx.config,
          headers: {
            ...ctx.config.headers,
            [`X-Plugin-${i}`]: 'processed'
          }
        };
      },
      
      afterResponse: async (ctx: any) => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 1) {} // Busy wait for 1ms
        
        return ctx.response!;
      }
    }));
  }
  
  return plugins;
};

describe('Plugin Performance', () => {
  it('measures average execution time for empty plugin set', async () => {
    // Minimal Fixi stub
    const fixi = { configure: () => ({ config: { logger: console } }), fetch: vi.fn() };
    const manager = new PluginManager(fixi);

    const reps = 500;
    const start = performance.now();
    for (let i = 0; i < reps; i++) {
      // Execute hook with no plugins registered
      await manager.execute(PluginHook.BEFORE_REQUEST, { fixi, config: { url: '/', method: 'GET' } });
    }
    const duration = performance.now() - start;
    const avg = duration / reps;

    console.info(`Executed ${reps} empty hooks in ${duration.toFixed(2)}ms (avg ${avg.toFixed(2)}ms)`);
    // Sanity check: avg should be positive
    expect(avg).toBeGreaterThan(0);
  });
});

describe('Performance Benchmarks', () => {
  let fixi: Fixi;
  
  beforeEach(() => {
    // Create a mock Fixi instance
    fixi = {
      fetch: vi.fn().mockResolvedValue({ status: 200, data: {} }),
      configure: vi.fn().mockReturnThis(),
      $: vi.fn(),
    } as any as Fixi;
  });
  
  test('Compare different plugin system configurations', async () => {
    const testPlugins = createTestPlugins(10);
    const iterations = 50;
    
    // Test setup
    console.log(`Running performance test with ${testPlugins.length} plugins, ${iterations} iterations`);
    
    // Test the original configuration
    const standardFixi = createPluginSystem(fixi, { plugins: testPlugins }, 'full');
    
    // Test the performance-optimized configuration
    const optimizedFixi = createPluginSystem(fixi, { plugins: testPlugins }, 'performance');
    
    // Test the minimal configuration (baseline)
    const minimalFixi = createPluginSystem(fixi, { plugins: testPlugins }, 'minimal');
    
    // Warm-up requests
    await standardFixi.fetch({ url: 'https://example.com/warmup' });
    await optimizedFixi.fetch({ url: 'https://example.com/warmup' });
    await minimalFixi.fetch({ url: 'https://example.com/warmup' });
    
    // Benchmark standard configuration
    const standardStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await standardFixi.fetch({ url: `https://example.com/standard/${i}` });
    }
    const standardDuration = performance.now() - standardStart;
    
    // Benchmark optimized configuration
    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await optimizedFixi.fetch({ url: `https://example.com/optimized/${i}` });
    }
    const optimizedDuration = performance.now() - optimizedStart;
    
    // Benchmark minimal configuration
    const minimalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await minimalFixi.fetch({ url: `https://example.com/minimal/${i}` });
    }
    const minimalDuration = performance.now() - minimalStart;
    
    // Log results
    console.log('Performance Benchmark Results:');
    console.log(`- Standard configuration: ${standardDuration.toFixed(2)}ms (${(standardDuration / iterations).toFixed(2)}ms per request)`);
    console.log(`- Optimized configuration: ${optimizedDuration.toFixed(2)}ms (${(optimizedDuration / iterations).toFixed(2)}ms per request)`);
    console.log(`- Minimal configuration: ${minimalDuration.toFixed(2)}ms (${(minimalDuration / iterations).toFixed(2)}ms per request)`);
    console.log(`- Optimization improvement: ${((standardDuration - optimizedDuration) / standardDuration * 100).toFixed(2)}% faster than standard`);
    
    // Get benchmark details (only available in optimized mode)
    const benchmarks = optimizedFixi.getBenchmarks();
    console.log('Plugin Benchmark Details:');
    Object.entries(benchmarks).forEach(([key, data]: [string, any]) => {
      console.log(`- ${key}: avg=${data.avgTime.toFixed(2)}ms, min=${data.minTime.toFixed(2)}ms, max=${data.maxTime.toFixed(2)}ms, calls=${data.callCount}`);
    });
    
    // Get resource stats
    const resourceStats = optimizedFixi.getResourceStats();
    if (Object.keys(resourceStats).length > 0) {
      console.log('Resource Usage:');
      Object.entries(resourceStats).forEach(([plugin, stats]: [string, any]) => {
        console.log(`- ${plugin}: ${stats.resourceCount} resources`);
      });
    }
    
    // Expect the optimized version to be faster than the standard version
    expect(optimizedDuration).toBeLessThan(standardDuration);
  });
});