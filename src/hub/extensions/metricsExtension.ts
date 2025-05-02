import { PluginManagerExtension, PluginManager, PluginHook, PluginContext, PluginHealthMetrics } from '../types';
import type { FixiPlugs } from '../types';

/**
 * Performance measurement utility
 */
class PerformanceTracker {
  private static measures = new Map<string, {
    totalTime: number;
    callCount: number;
    maxTime: number;
    startTime?: number;
  }>();

  /**
   * Start measuring execution time for a specific operation
   */
  static startMeasure(id: string): void {
    const metrics = this.measures.get(id) || { 
      totalTime: 0, 
      callCount: 0, 
      maxTime: 0 
    };
    
    metrics.startTime = performance.now();
    this.measures.set(id, metrics);
  }
  
  /**
   * End measuring execution time for a specific operation
   * @returns duration in milliseconds
   */
  static endMeasure(id: string): number {
    const metrics = this.measures.get(id);
    if (!metrics || metrics.startTime === undefined) {
      console.warn(`No measurement started for ${id}`);
      return 0;
    }
    
    const duration = performance.now() - metrics.startTime;
    
    metrics.totalTime += duration;
    metrics.callCount++;
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.startTime = undefined;
    
    this.measures.set(id, metrics);
    
    return duration;
  }

  /**
   * Get metrics for all measured operations
   */
  static getMetrics(): Record<string, {
    totalTime: number;
    callCount: number;
    maxTime: number;
    avgTime: number;
  }> {
    const result: Record<string, any> = {};
    
    for (const [id, metrics] of this.measures.entries()) {
      result[id] = {
        ...metrics,
        avgTime: metrics.callCount > 0 ? metrics.totalTime / metrics.callCount : 0
      };
    }
    
    return result;
  }

  /**
   * Reset all metrics
   */
  static reset(): void {
    this.measures.clear();
  }
}

/**
 * Extension that provides performance metrics
 */
export class MetricsExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private healthMetrics = new Map<string, PluginHealthMetrics>();
  
  init(manager: PluginManager): void {
    this.manager = manager;
    PerformanceTracker.reset();
  }
  
  beforeExecute<T extends PluginContext>(hookType: PluginHook, context: T): T | void {
    PerformanceTracker.startMeasure(`PluginManager.execute.${hookType}`);
    return context;
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void {
    const pluginKey = `${plugin.name}:${hookType}`;
    let metrics = this.healthMetrics.get(pluginKey) || { 
      totalCalls: 0, 
      errors: 0, 
      totalDuration: 0,
      avgDuration: 0
    };
    
    metrics.totalCalls++;
    metrics.lastExecuted = Date.now();
    
    this.healthMetrics.set(pluginKey, metrics);
    
    // Start measuring hook execution time
    PerformanceTracker.startMeasure(`Plugin.${plugin.name}.${hookType}`);
  }
  
  afterHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error | null): void {
    const pluginKey = `${plugin.name}:${hookType}`;
    let metrics = this.healthMetrics.get(pluginKey) || { 
      totalCalls: 0, 
      errors: 0, 
      totalDuration: 0,
      avgDuration: 0
    };
    
    const duration = PerformanceTracker.endMeasure(`Plugin.${plugin.name}.${hookType}`);
    metrics.totalDuration += duration;
    
    this.healthMetrics.set(pluginKey, metrics);
  }
  
  onHookError<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error): boolean | void {
    const pluginKey = `${plugin.name}:${hookType}`;
    let metrics = this.healthMetrics.get(pluginKey) || { 
      totalCalls: 0, 
      errors: 0, 
      totalDuration: 0,
      avgDuration: 0
    };
    
    metrics.errors++;
    metrics.lastError = error;
    
    this.healthMetrics.set(pluginKey, metrics);
  }
  
  afterExecute<T extends PluginContext>(hookType: PluginHook, context: T): T | void {
    PerformanceTracker.endMeasure(`PluginManager.execute.${hookType}`);
    return context;
  }
  
  getPluginHealth(pluginName?: string): Record<string, PluginHealthMetrics> {
    const result: Record<string, PluginHealthMetrics> = {};
    
    if (pluginName) {
      for (const [key, metrics] of this.healthMetrics.entries()) {
        if (key.startsWith(`${pluginName}:`)) {
          const hookName = key.split(':')[1];
          result[hookName] = {
            ...metrics,
            avgDuration: metrics.totalCalls > 0 ? metrics.totalDuration / metrics.totalCalls : 0
          };
        }
      }
    } else {
      for (const [key, metrics] of this.healthMetrics.entries()) {
        result[key] = {
          ...metrics,
          avgDuration: metrics.totalCalls > 0 ? metrics.totalDuration / metrics.totalCalls : 0
        };
      }
    }
    
    return result;
  }
  
  getPerformanceMetrics(): Record<string, any> {
    return PerformanceTracker.getMetrics();
  }
  
  resetHealthMetrics(pluginName?: string): void {
    if (pluginName) {
      for (const key of Array.from(this.healthMetrics.keys())) {
        if (key.startsWith(`${pluginName}:`)) {
          this.healthMetrics.delete(key);
        }
      }
    } else {
      this.healthMetrics.clear();
    }
  }
}