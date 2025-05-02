import { PluginManagerExtension, PluginManager, PluginHook, PluginContext, FixiPlugs } from '..';

/**
 * Extension for benchmarking plugin performance
 * 
 * This extension measures execution time for plugins to help identify performance bottlenecks.
 */
export class BenchmarkExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private measurements: Map<string, {
    count: number;
    totalTime: number;
    min: number;
    max: number;
    lastTimestamp: number;
  }> = new Map();
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): void {
    // Store start time on the context object
    (context as any).__benchmarkStart = performance.now();
    return;
  }
  
  afterHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error | null): void {
    const end = performance.now();
    const start = (context as any).__benchmarkStart || end;
    const executionTime = end - start;
    
    // Create measurement key
    const key = `${plugin.name}:${hookType}`;
    
    // Update measurements
    if (!this.measurements.has(key)) {
      this.measurements.set(key, {
        count: 1,
        totalTime: executionTime,
        min: executionTime,
        max: executionTime,
        lastTimestamp: Date.now()
      });
    } else {
      const measurement = this.measurements.get(key)!;
      measurement.count++;
      measurement.totalTime += executionTime;
      measurement.min = Math.min(measurement.min, executionTime);
      measurement.max = Math.max(measurement.max, executionTime);
      measurement.lastTimestamp = Date.now();
      this.measurements.set(key, measurement);
    }
  }
  
  /**
   * Get benchmarking results for all plugins
   */
  getBenchmarks(): {
    [pluginAndHook: string]: {
      avgTime: number;
      totalTime: number;
      callCount: number;
      minTime: number;
      maxTime: number;
      lastRun: Date;
    }
  } {
    const result: any = {};
    
    for (const [key, data] of this.measurements.entries()) {
      result[key] = {
        avgTime: data.totalTime / data.count,
        totalTime: data.totalTime,
        callCount: data.count,
        minTime: data.min,
        maxTime: data.max,
        lastRun: new Date(data.lastTimestamp)
      };
    }
    
    return result;
  }
  
  /**
   * Reset benchmarking data
   */
  resetBenchmarks(): void {
    this.measurements.clear();
  }
}