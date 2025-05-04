import { PluginManagerExtension, PluginHook, PluginContext, PluginHealthMetrics, Plugin } from '../types';
import type { manager } from '../manager';

/**
 * Performance measurement utility with improved memory efficiency
 */
class PerformanceTracker {
  // Use a WeakMap for better memory management when possible
  private readonly measures = new Map<string, PerformanceMetric>();

  /**
   * Clear performance metrics for specific prefix or all if not specified
   */
  public reset(prefix?: string): void {
    if (prefix) {
      // More efficient deletion of prefix-matching keys
      for (const key of Array.from(this.measures.keys())) {
        if (key.startsWith(prefix)) {
          this.measures.delete(key);
        }
      }
    } else {
      this.measures.clear();
    }
  }

  /**
   * Start measuring execution time for a specific operation
   */
  public startMeasure(id: string): void {
    // Get existing or create new with defaults in one operation
    const metrics = this.measures.get(id) || { 
      totalTime: 0, 
      callCount: 0, 
      maxTime: 0,
      startTime: performance.now()
    };
    
    metrics.startTime = performance.now();
    this.measures.set(id, metrics);
  }
  
  /**
   * End measuring execution time and update metrics
   * @returns duration in milliseconds
   */
  public endMeasure(id: string): number {
    const metrics = this.measures.get(id);
    if (!metrics || metrics.startTime === undefined) {
      console.warn(`No measurement started for ${id}`);
      return 0;
    }
    
    const duration = performance.now() - metrics.startTime;
    
    // Update metrics in-place to reduce object creation
    metrics.totalTime += duration;
    metrics.callCount++;
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.startTime = undefined;
    
    return duration;
  }

  /**
   * Get metrics for all measured operations
   */
  public getMetrics(): Record<string, PerformanceMetricReport> {
    const result: Record<string, PerformanceMetricReport> = {};
    
    // Compute averages only when needed instead of on every update
    for (const [id, metrics] of this.measures.entries()) {
      if (metrics.callCount > 0) {
        result[id] = {
          totalTime: metrics.totalTime,
          callCount: metrics.callCount,
          maxTime: metrics.maxTime,
          avgTime: metrics.totalTime / metrics.callCount
        };
      }
    }
    
    return result;
  }

  /**
   * Get filtered metrics based on prefix
   */
  public getMetricsForPrefix(prefix: string): Record<string, PerformanceMetricReport> {
    const result: Record<string, PerformanceMetricReport> = {};
    
    for (const [id, metrics] of this.measures.entries()) {
      if (id.startsWith(prefix) && metrics.callCount > 0) {
        result[id] = {
          totalTime: metrics.totalTime,
          callCount: metrics.callCount,
          maxTime: metrics.maxTime,
          avgTime: metrics.totalTime / metrics.callCount
        };
      }
    }
    
    return result;
  }
}

// Type definitions for better type safety
interface PerformanceMetric {
  totalTime: number;
  callCount: number;
  maxTime: number;
  startTime?: number;
}

interface PerformanceMetricReport {
  totalTime: number;
  callCount: number;
  maxTime: number;
  avgTime: number;
}

/**
 * Optimized extension that provides performance metrics
 */
export class MetricsExtension implements PluginManagerExtension {
  private manager!: manager;
  // Use a composite key to reduce lookup complexity
  private readonly healthMetrics = new Map<string, PluginHealthMetrics>();
  // Instance-based performance tracker instead of static
  private readonly performanceTracker = new PerformanceTracker();
  
  init(managerInstance: manager): void {
    this.manager = managerInstance;
    this.performanceTracker.reset();
  }
  
  // Use more efficient return pattern
  beforeExecute<T extends PluginContext>(hookType: PluginHook, context: T): T {
    this.performanceTracker.startMeasure(`manager.execute.${hookType}`);
    return context;
  }
  
  // Use composite key for more efficient lookup
  beforeHook<T extends PluginContext>(plugin: Plugin, hookType: PluginHook, context: T): void {
    const pluginKey = `${plugin.name}:${hookType}`;
    
    // Use get-or-initialize pattern for better performance
    let metrics = this.healthMetrics.get(pluginKey);
    if (!metrics) {
      metrics = { 
        totalCalls: 0, 
        errors: 0, 
        totalDuration: 0,
        avgDuration: 0
      };
      this.healthMetrics.set(pluginKey, metrics);
    }
    
    // Update counter directly instead of reassigning
    metrics.totalCalls++;
    metrics.lastExecuted = Date.now();
    
    // Start measuring hook execution time
    this.performanceTracker.startMeasure(`Plugin.${plugin.name}.${hookType}`);
  }
  
  afterHook<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T, 
    error: Error | null
  ): void {
    const pluginKey = `${plugin.name}:${hookType}`;
    const metrics = this.healthMetrics.get(pluginKey);
    
    if (metrics) {
      const duration = this.performanceTracker.endMeasure(`Plugin.${plugin.name}.${hookType}`);
      metrics.totalDuration += duration;
      // Pre-calculate avgDuration to avoid doing it repeatedly during retrieval
      metrics.avgDuration = metrics.totalDuration / metrics.totalCalls;
    }
  }
  
  onHookError<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T, 
    error: Error
  ): void {
    const pluginKey = `${plugin.name}:${hookType}`;
    const metrics = this.healthMetrics.get(pluginKey);
    
    if (metrics) {
      metrics.errors++;
      metrics.lastError = error;
    }
  }
  
  afterExecute<T extends PluginContext>(hookType: PluginHook, context: T): T {
    this.performanceTracker.endMeasure(`manager.execute.${hookType}`);
    return context;
  }
  
  /**
   * Optimized method to retrieve health metrics for plugins
   */
  getPluginHealth(pluginName?: string): Record<string, PluginHealthMetrics> {
    const result: Record<string, PluginHealthMetrics> = {};
    
    if (pluginName) {
      const prefix = `${pluginName}:`;
      
      // Batch process matching entries for better performance
      for (const [key, metrics] of this.healthMetrics.entries()) {
        if (key.startsWith(prefix)) {
          const hookName = key.substring(prefix.length);
          // Clone to avoid mutation of original metrics
          result[hookName] = { ...metrics };
        }
      }
    } else {
      // Batch copy all metrics
      for (const [key, metrics] of this.healthMetrics.entries()) {
        result[key] = { ...metrics };
      }
    }
    
    return result;
  }
  
  /**
   * Get performance metrics with optional filtering
   */
  getPerformanceMetrics(prefix?: string): Record<string, PerformanceMetricReport> {
    return prefix 
      ? this.performanceTracker.getMetricsForPrefix(prefix)
      : this.performanceTracker.getMetrics();
  }
  
  /**
   * Reset health metrics for a specific plugin or all plugins
   */
  resetHealthMetrics(pluginName?: string): void {
    if (pluginName) {
      const prefix = `${pluginName}:`;
      // Efficient batch deletion
      for (const key of Array.from(this.healthMetrics.keys())) {
        if (key.startsWith(prefix)) {
          this.healthMetrics.delete(key);
        }
      }
      // Also reset corresponding performance metrics
      this.performanceTracker.reset(`Plugin.${pluginName}.`);
    } else {
      this.healthMetrics.clear();
      this.performanceTracker.reset();
    }
  }
}