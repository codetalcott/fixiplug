// @ts-nocheck
/**
 * Improved Fixi Plugin System
 * 
 * A high-performance, composable plugin system for extending the fixi Library (v9)
 * without modifying its source code. This implementation focuses on speed, reliability,
 * and developer experience.
 * 
 * Features:
 * - Priority-based plugin execution for performance optimization
 * - Conditional hook execution to skip unnecessary processing
 * - Plugin health monitoring and metrics
 * - Circuit breaker pattern for fault isolation
 * - Timeout protection for unresponsive plugins
 * - API versioning for compatibility checking
 * - Lazy loading support for improved startup time
 * - Tree-shaking friendly plugin registration
 * - Memory leak prevention through proper cleanup
 * 
 * Version: 2.0.0
 */

import { Fixi, RequestConfig, FxResponse } from '../core/fixi.js';

/* ============================
   Performance Measurement
============================ */

/**
 * Simple performance measurement utility
 */
class PerformanceTracker {
  private static measures = new Map<string, {
    totalTime: number;
    callCount: number;
    maxTime: number;
  }>();

  /**
   * Start measuring execution time for a specific operation
   */
  static startMeasure(id: string): () => number {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const metrics = this.measures.get(id) || { 
        totalTime: 0, 
        callCount: 0, 
        maxTime: 0 
      };
      
      metrics.totalTime += duration;
      metrics.callCount++;
      metrics.maxTime = Math.max(metrics.maxTime, duration);
      this.measures.set(id, metrics);
      
      return duration;
    };
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

/* ============================
   Plugin System Core Types
============================ */

/** Lifecycle hook points where plugins can register functionality */
export enum PluginHook {
  BEFORE_REQUEST = 'beforeRequest',
  AFTER_RESPONSE = 'afterResponse',
  DOM_MUTATED = 'domMutated',
  INITIALIZE = 'initialize',
  DESTROY = 'destroy',
  ERROR = 'error'
}

/** Base context provided to plugin hooks */
export interface PluginContext {
  fixi: Fixi;
  [key: string]: any;
}

/** Context for request-related hooks */
export interface RequestPluginContext extends PluginContext {
  config: RequestConfig;
  response?: FxResponse;
  error?: Error;
}

/** Context for DOM-related hooks */
export interface DomPluginContext extends PluginContext {
  mutations: MutationRecord[];
  target?: Element;
}

/** 
 * Enhanced plugin definition interface with performance and reliability features
 */
export interface FixiPlugs {
  /** Unique plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  
  /** 
   * Execution priority (higher numbers execute first) 
   * Default: 0
   */
  priority?: number;
  
  /** 
   * Conditions that determine whether a hook should execute
   * Return false to skip this plugin's hook
   */
  conditions?: {
    [key in PluginHook]?: (context: any) => boolean;
  };
  
  /** 
   * Timeouts for each hook in milliseconds
   * If a hook takes longer than the specified time, it will be aborted
   */
  timeouts?: {
    [key in PluginHook]?: number;
  };
  
  /** 
   * Fallback functions for when a hook throws an error
   * These allow the plugin to recover and provide alternative behavior
   */
  fallbacks?: {
    [key in PluginHook]?: (context: any, error: Error) => any;
  };
  
  /** 
   * Circuit breaker configuration to prevent repeated failures
   */
  circuitBreaker?: {
    /** Number of consecutive failures before the circuit opens */
    failureThreshold: number;
    
    /** Milliseconds to wait before attempting to close the circuit */
    resetTimeout: number;
  };
  
  // Hook methods
  beforeRequest?(context: RequestPluginContext): Promise<RequestConfig> | RequestConfig;
  afterResponse?(context: RequestPluginContext): Promise<FxResponse> | FxResponse;
  onDomMutated?(context: DomPluginContext): void;
  onInitialize?(context: PluginContext): void;
  onDestroy?(context: PluginContext): void;
  onError?(context: RequestPluginContext): void;
  
  // Optional plugin metadata
  dependencies?: string[];
  description?: string;
  author?: string;
  
  // Allow plugins to have additional methods/properties
  [key: string]: any;
}

/** Plugin definition for lazy loading */
export interface PluginDefinition {
  name: string;
  dependencies?: string[];
  load: () => Promise<FixiPlugs>;
}

/** Plugin health metrics */
export interface PluginHealthMetrics {
  totalCalls: number;
  errors: number;
  totalDuration: number;
  avgDuration: number;
  lastError?: Error;
  lastExecuted?: number;
  circuit?: {
    isOpen: boolean;
    failures: number;
    lastFailure: number;
  };
}

/* ============================
   Enhanced Plugin Manager
============================ */

/**
 * An enhanced plugin manager with performance optimizations and reliability features
 */
export class PluginManager {
  /** Map of active plugins */
  private plugins: Map<string, FixiPlugs> = new Map();
  
  /** Map of plugin definitions for lazy loading */
  private pendingPlugins: Map<string, PluginDefinition> = new Map();
  
  /** Reference to the Fixi instance */
  private fixi: Fixi;
  
  /** Logger instance from Fixi */
  private logger: any;
  
  /** Plugin health metrics */
  private healthMetrics: Map<string, PluginHealthMetrics> = new Map();
  
  /** Circuit breaker state for plugins */
  private circuitState: Map<string, {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  }> = new Map();
  
  /** Current API version */
  private readonly API_VERSION = '2.0.0';

  constructor(fixi: Fixi) {
    this.fixi = fixi;
    this.logger = fixi.configure({}).config?.logger || console;
    
    // Initialize performance tracking
    PerformanceTracker.reset();
  }

  /**
   * Register a new plugin
   * @returns true if registration succeeded, false otherwise
   */
  public register(plugin: FixiPlugs): boolean {
    // Validate plugin API version compatibility
    if (!this.isVersionCompatible(plugin.apiVersion)) {
      this.logger.error(
        `Plugin "${plugin.name}" v${plugin.version} uses API version ${plugin.apiVersion} which is ` +
        `not compatible with the current API version ${this.API_VERSION}.`
      );
      return false;
    }
    
    // Check if plugin is already registered
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin "${plugin.name}" is already registered.`);
      return false;
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          this.logger.error(`Cannot register plugin "${plugin.name}": Dependency "${dep}" not found.`);
          return false;
        }
      }
    }

    // Register the plugin
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Plugin "${plugin.name}" v${plugin.version} registered.`);
    
    // Initialize plugin
    try {
      plugin.onInitialize?.({
        fixi: this.fixi
      });
    } catch (error) {
      this.logger.error(`Error initializing plugin "${plugin.name}":`, error);
    }

    return true;
  }

  /**
   * Register a plugin for lazy loading
   * @returns true if registration succeeded, false otherwise
   */
  public registerLazy(definition: PluginDefinition): boolean {
    if (this.plugins.has(definition.name) || this.pendingPlugins.has(definition.name)) {
      this.logger.warn(`Plugin "${definition.name}" is already registered.`);
      return false;
    }
    
    this.pendingPlugins.set(definition.name, definition);
    this.logger.info(`Plugin "${definition.name}" registered for lazy loading.`);
    
    return true;
  }

  /**
   * Load a plugin that was registered for lazy loading
   * @returns The loaded plugin or undefined if loading failed
   */
  public async loadPlugin(name: string): Promise<FixiPlugs | undefined> {
    if (this.plugins.has(name)) {
      return this.plugins.get(name);
    }
    
    const definition = this.pendingPlugins.get(name);
    if (!definition) {
      this.logger.warn(`Plugin "${name}" not found for loading.`);
      return undefined;
    }
    
    // Load dependencies first
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.plugins.has(dep) && !this.pendingPlugins.has(dep)) {
          this.logger.error(`Cannot load plugin "${name}": Dependency "${dep}" not found.`);
          return undefined;
        }
        
        if (!this.plugins.has(dep)) {
          const depPlugin = await this.loadPlugin(dep);
          if (!depPlugin) {
            this.logger.error(`Cannot load plugin "${name}": Failed to load dependency "${dep}".`);
            return undefined;
          }
        }
      }
    }
    
    try {
      const plugin = await definition.load();
      
      // Validate API version
      if (!this.isVersionCompatible(plugin.apiVersion)) {
        this.logger.error(
          `Plugin "${plugin.name}" v${plugin.version} uses API version ${plugin.apiVersion} which is ` +
          `not compatible with the current API version ${this.API_VERSION}.`
        );
        return undefined;
      }
      
      this.pendingPlugins.delete(name);
      this.plugins.set(name, plugin);
      
      // Initialize plugin
      plugin.onInitialize?.({
        fixi: this.fixi
      });
      
      this.logger.info(`Plugin "${name}" v${plugin.version} loaded successfully.`);
      return plugin;
    } catch (error) {
      this.logger.error(`Error loading plugin "${name}":`, error);
      return undefined;
    }
  }

  /**
   * Load all plugins that were registered for lazy loading
   */
  public async loadAllPlugins(): Promise<void> {
    const names = Array.from(this.pendingPlugins.keys());
    for (const name of names) {
      await this.loadPlugin(name);
    }
  }

  /**
   * Unregister a plugin by name
   * @returns true if unregistration succeeded, false otherwise
   */
  public unregister(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      // Check if it's in pending plugins
      if (this.pendingPlugins.has(pluginName)) {
        this.pendingPlugins.delete(pluginName);
        this.logger.info(`Pending plugin "${pluginName}" unregistered.`);
        return true;
      }
      
      this.logger.warn(`Plugin "${pluginName}" is not registered.`);
      return false;
    }

    // Check if other plugins depend on this one
    for (const [name, p] of this.plugins.entries()) {
      if (p.dependencies?.includes(pluginName)) {
        this.logger.error(`Cannot unregister plugin "${pluginName}": Plugin "${name}" depends on it.`);
        return false;
      }
    }

    // Clean up plugin
    try {
      plugin.onDestroy?.({
        fixi: this.fixi
      });
    } catch (error) {
      this.logger.error(`Error destroying plugin "${pluginName}":`, error);
    }

    // Clean up metrics
    for (const key of Array.from(this.healthMetrics.keys())) {
      if (key.startsWith(`${pluginName}:`)) {
        this.healthMetrics.delete(key);
      }
    }
    
    // Clean up circuit breaker state
    for (const key of Array.from(this.circuitState.keys())) {
      if (key.startsWith(`${pluginName}:`)) {
        this.circuitState.delete(key);
      }
    }

    this.plugins.delete(pluginName);
    this.logger.info(`Plugin "${pluginName}" unregistered.`);
    
    return true;
  }

  /**
   * Get a registered plugin by name
   */
  public get<T extends FixiPlugs = FixiPlugs>(pluginName: string): T | undefined {
    return this.plugins.get(pluginName) as T | undefined;
  }

  /**
   * Get all registered plugins
   */
  public getAll(): FixiPlugs[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get health metrics for plugins
   * @param pluginName Optional plugin name to filter metrics
   */
  public getPluginHealth(pluginName?: string): Record<string, PluginHealthMetrics> {
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

  /**
   * Reset health metrics for all plugins or a specific plugin
   * @param pluginName Optional plugin name to filter
   */
  public resetHealthMetrics(pluginName?: string): void {
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

  /**
   * Reset circuit breaker state for all plugins or a specific plugin
   * @param pluginName Optional plugin name to filter
   */
  public resetCircuitBreakers(pluginName?: string): void {
    if (pluginName) {
      for (const key of Array.from(this.circuitState.keys())) {
        if (key.startsWith(`${pluginName}:`)) {
          this.circuitState.delete(key);
        }
      }
    } else {
      this.circuitState.clear();
    }
  }

  /**
   * Execute all plugin hooks of a specific type
   * @param hookType The type of hook to execute
   * @param context The context to pass to the hooks
   * @returns The modified context
   */
  public async execute<T extends PluginContext>(hookType: PluginHook, context: T): Promise<T> {
    const measure = PerformanceTracker.startMeasure(`PluginManager.execute.${hookType}`);
    let currentContext = { ...context };
    
    // Create a sorted list of plugins based on priority
    const prioritizedPlugins = Array.from(this.plugins.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const plugin of prioritizedPlugins) {
      const pluginKey = `${plugin.name}:${hookType}`;
      
      // Check circuit breaker state
      const circuit = this.circuitState.get(pluginKey) || { 
        failures: 0, 
        lastFailure: 0, 
        isOpen: false 
      };
      
      if (circuit.isOpen) {
        const resetTimeout = plugin.circuitBreaker?.resetTimeout || 30000;
        if (Date.now() - circuit.lastFailure > resetTimeout) {
          // Try to close the circuit
          circuit.isOpen = false;
          this.logger.debug(`Circuit closed for plugin "${plugin.name}" on hook "${hookType}"`);
        } else {
          // Circuit still open, skip plugin
          this.logger.debug(`Circuit open for plugin "${plugin.name}" on hook "${hookType}"`);
          continue;
        }
      }
      
      // Check conditions
      if (plugin.conditions?.[hookType] && !plugin.conditions[hookType](currentContext)) {
        continue;
      }
      
      // Initialize or get metrics
      let metrics = this.healthMetrics.get(pluginKey) || { 
        totalCalls: 0, 
        errors: 0, 
        totalDuration: 0,
        avgDuration: 0
      };
      
      metrics.totalCalls++;
      metrics.lastExecuted = Date.now();
      
      const pluginMeasure = PerformanceTracker.startMeasure(`Plugin.${plugin.name}.${hookType}`);
      
      try {
        // Execute the appropriate hook based on type
        if (hookType === PluginHook.BEFORE_REQUEST && plugin.beforeRequest) {
          const ctx = currentContext as RequestPluginContext;
          
          // Execute with timeout if configured
          const timeout = plugin.timeouts?.[PluginHook.BEFORE_REQUEST];
          if (timeout) {
            const timeoutPromise = new Promise<RequestConfig>((_, reject) => {
              setTimeout(() => reject(new Error(`Plugin ${plugin.name} beforeRequest timed out after ${timeout}ms`)), 
              timeout);
            });
            
            ctx.config = await Promise.race([
              plugin.beforeRequest(ctx),
              timeoutPromise
            ]);
          } else {
            ctx.config = await plugin.beforeRequest(ctx);
          }
        } 
        else if (hookType === PluginHook.AFTER_RESPONSE && plugin.afterResponse) {
          const ctx = currentContext as RequestPluginContext;
          if (ctx.response) {
            // Execute with timeout if configured
            const timeout = plugin.timeouts?.[PluginHook.AFTER_RESPONSE];
            if (timeout) {
              const timeoutPromise = new Promise<FxResponse>((_, reject) => {
                setTimeout(() => reject(new Error(`Plugin ${plugin.name} afterResponse timed out after ${timeout}ms`)), 
                timeout);
              });
              
              ctx.response = await Promise.race([
                plugin.afterResponse(ctx),
                timeoutPromise
              ]);
            } else {
              ctx.response = await plugin.afterResponse(ctx);
            }
          }
        } 
        else if (hookType === PluginHook.DOM_MUTATED && plugin.onDomMutated) {
          plugin.onDomMutated(currentContext as DomPluginContext);
        } 
        else if (hookType === PluginHook.ERROR && plugin.onError) {
          plugin.onError(currentContext as RequestPluginContext);
        }
        
        // Reset failures on success
        if (circuit.failures > 0) {
          circuit.failures = 0;
          this.circuitState.set(pluginKey, circuit);
        }
      } catch (error) {
        // Track metrics
        metrics.errors++;
        metrics.lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update circuit breaker state
        circuit.failures++;
        circuit.lastFailure = Date.now();
        
        // Check if we should open the circuit
        if (plugin.circuitBreaker && circuit.failures >= plugin.circuitBreaker.failureThreshold) {
          circuit.isOpen = true;
          this.logger.warn(`Circuit opened for plugin "${plugin.name}" on hook "${hookType}" after ${circuit.failures} failures`);
        }
        
        this.circuitState.set(pluginKey, circuit);
        
        // Try fallback if available
        if (plugin.fallbacks?.[hookType]) {
          try {
            const fallbackResult = plugin.fallbacks[hookType](
              currentContext, 
              error instanceof Error ? error : new Error(String(error))
            );
            
            // Apply fallback result based on hook type
            if (hookType === PluginHook.BEFORE_REQUEST) {
              (currentContext as RequestPluginContext).config = fallbackResult;
            } else if (hookType === PluginHook.AFTER_RESPONSE && (currentContext as RequestPluginContext).response) {
              (currentContext as RequestPluginContext).response = fallbackResult;
            }
          } catch (fallbackError) {
            this.logger.error(`Fallback failed for plugin "${plugin.name}" on hook "${hookType}":`, fallbackError);
          }
        } else {
          this.logger.error(`Error executing ${hookType} hook in plugin "${plugin.name}":`, error);
          
          // If no fallback and a hook throws, propagate the error
          if (!plugin.circuitBreaker) {
            throw error;
          }
        }
      } finally {
        const duration = pluginMeasure();
        metrics.totalDuration += duration;
        
        // Update metrics with circuit information
        metrics.circuit = { ...circuit };
        
        this.healthMetrics.set(pluginKey, metrics);
      }
    }
    
    measure();
    return currentContext;
  }

  /**
   * Get performance metrics for all plugins
   */
  public getPerformanceMetrics(): Record<string, any> {
    return PerformanceTracker.getMetrics();
  }

  /**
   * Check if a plugin's API version is compatible with the current version
   */
  private isVersionCompatible(pluginVersion: string): boolean {
    if (!pluginVersion) return false;
    
    // Simple semver major version check
    const currentMajor = this.API_VERSION.split('.')[0];
    const pluginMajor = pluginVersion.split('.')[0];
    
    return currentMajor === pluginMajor;
  }
}

/* ============================
   Enhanced Fixi Implementation
============================ */

/**
 * A plugin-enabled wrapper around a Fixi instance
 * This maintains the original Fixi class unchanged and adds plugin support
 * through composition rather than inheritance
 */
export class FixiWithPlugins {
  private fixi: Fixi;
  private pluginManager: PluginManager;
  
  constructor(fixi: Fixi) {
    this.fixi = fixi;
    this.pluginManager = new PluginManager(fixi);
    
    // Enhance the fetch method
    this.enhanceFetch();
  }
  
  /**
   * Enhance the fetch method via monkey patching to inject plugin processing
   */
  private enhanceFetch(): void {
    // Store a reference to the original fetch method
    const originalFetch = this.fixi.fetch;
    const fixiInstance = this.fixi;
    
    // Replace the fetch method with our enhanced version that preserves the spy functionality
    this.fixi.fetch = async function enhancedFetch(config: RequestConfig): Promise<FxResponse> {
      try {
        // Plugin pre-processing
        const pluginContext: RequestPluginContext = {
          fixi: fixiInstance,
          config
        };
        
        const context = await this.pluginManager.execute(
          PluginHook.BEFORE_REQUEST, 
          pluginContext
        ) as RequestPluginContext;
        
        try {
          // Check if a plugin has set the _skipFetch flag (e.g., cache hit)
          if (context.config._skipFetch && context.response) {
            // If _skipFetch is true and we have a response, return it without calling fetch
            return context.response;
          }
          
          // Call original fetch with possibly modified config
          // Using apply to preserve the spy functionality
          const result = await originalFetch.apply(fixiInstance, [context.config]);
          
          // Plugin post-processing
          const responseContext: RequestPluginContext = {
            fixi: fixiInstance,
            config: context.config,
            response: result
          };
          
          const processedContext = await this.pluginManager.execute(
            PluginHook.AFTER_RESPONSE, 
            responseContext
          ) as RequestPluginContext;
          
          return processedContext.response!;
        } catch (error) {
          // Error handling with plugins
          const errorContext: RequestPluginContext = {
            fixi: fixiInstance,
            config: context.config,
            error: error instanceof Error ? error : new Error('Unknown error')
          };
          
          await this.pluginManager.execute(PluginHook.ERROR, errorContext);
          throw error;
        }
      } catch (error) {
        throw error;
      }
    }.bind(this); // Bind 'this' to preserve the context
  }

  /**
   * Get a reference to the PluginManager
   */
  public plugins(): PluginManager {
    return this.pluginManager;
  }

  /**
   * Register a plugin
   * @returns this instance for chaining
   */
  public registerPlugin(plugin: FixiPlugs): this {
    this.pluginManager.register(plugin);
    return this;
  }

  /**
   * Register a plugin for lazy loading
   * @returns this instance for chaining
   */
  public registerLazyPlugin(definition: PluginDefinition): this {
    this.pluginManager.registerLazy(definition);
    return this;
  }

  /**
   * Load a plugin that was registered for lazy loading
   * @returns The loaded plugin or undefined if loading failed
   */
  public async loadPlugin(name: string): Promise<FixiPlugs | undefined> {
    return this.pluginManager.loadPlugin(name);
  }

  /**
   * Load all plugins that were registered for lazy loading
   */
  public async loadAllPlugins(): Promise<void> {
    return this.pluginManager.loadAllPlugins();
  }

  /**
   * Unregister a plugin
   * @returns this instance for chaining
   */
  public unregisterPlugin(pluginName: string): this {
    this.pluginManager.unregister(pluginName);
    return this;
  }
  
  /**
   * Get the original Fixi instance
   */
  public getFixi(): Fixi {
    return this.fixi;
  }
  
  /**
   * Get plugin health metrics
   */
  public getPluginHealth(pluginName?: string): Record<string, PluginHealthMetrics> {
    return this.pluginManager.getPluginHealth(pluginName);
  }
  
  /**
   * Get performance metrics for all plugins
   */
  public getPerformanceMetrics(): Record<string, any> {
    return this.pluginManager.getPerformanceMetrics();
  }
  
  /**
   * Reset health metrics
   */
  public resetHealthMetrics(pluginName?: string): this {
    this.pluginManager.resetHealthMetrics(pluginName);
    return this;
  }
  
  /**
   * Reset circuit breakers
   */
  public resetCircuitBreakers(pluginName?: string): this {
    this.pluginManager.resetCircuitBreakers(pluginName);
    return this;
  }
  
  /* Proxy methods for all Fixi functionality */
  
  public async fetch(config: RequestConfig): Promise<FxResponse> {
    return this.fixi.fetch(config);
  }
  
  public async get(url: string, data?: any, target?: Element | string): Promise<FxResponse> {
    return this.fixi.get(url, data, target);
  }
  
  public async post(url: string, data?: any, target?: Element | string): Promise<FxResponse> {
    return this.fixi.post(url, data, target);
  }
  
  public async put(url: string, data?: any, target?: Element | string): Promise<FxResponse> {
    return this.fixi.put(url, data, target);
  }
  
  public async patch(url: string, data?: any, target?: Element | string): Promise<FxResponse> {
    return this.fixi.patch(url, data, target);
  }
  
  public async delete(url: string, data?: any, target?: Element | string): Promise<FxResponse> {
    return this.fixi.delete(url, data, target);
  }
  
  public $(selector: string | Element): any {
    return this.fixi.$(selector);
  }
  
  public toggle(selector: string, className: string): this {
    this.fixi.toggle(selector, className);
    return this;
  }
  
  public async loadInto(target: string, url: string, options: Partial<RequestConfig> = {}): Promise<FxResponse> {
    return this.fixi.loadInto(target, url, options);
  }
  
  public createAbortController(timeout?: number): AbortController {
    return this.fixi.createAbortController(timeout);
  }
  
  public getQueueStatus(): { active: number; queued: number } {
    return this.fixi.getQueueStatus();
  }
  
  public setMaxConnections(max: number): this {
    this.fixi.setMaxConnections(max);
    return this;
  }
  
  public configure(config: any): this {
    this.fixi.configure(config);
    return this;
  }
  
  public refreshCsrf(): void {
    this.fixi.refreshCsrf();
  }
}

/* ============================
   Factory Function & Plugin Creation
============================ */

/**
 * Creates a plugin instance with type safety
 * This is a tree-shaking friendly way to create plugins
 * 
 * @param plugin The plugin configuration
 * @returns The plugin instance
 */
export function createPlugin<T extends FixiPlugs>(plugin: T): T {
  return plugin;
}

/**
 * Configuration options for the plugin system
 */
export interface PluginSystemOptions {
  /**
   * Initial plugins to register
   */
  plugins?: FixiPlugs[];
  
  /**
   * Initial plugin definitions to register for lazy loading
   */
  lazyPlugins?: PluginDefinition[];
}

/**
 * Main entry point for the plugin module.
 * Creates an enhanced Fixi instance with plugin support.
 * 
 * @param fixi The original Fixi instance to enhance
 * @param options Optional configuration options
 * @returns An enhanced Fixi instance with plugin support
 */
export function createPluginSystem(fixi: Fixi, options: PluginSystemOptions = {}): FixiWithPlugins {
  const enhanced = new FixiWithPlugins(fixi);
  
  // Register initial plugins if provided
  if (options.plugins) {
    for (const plugin of options.plugins) {
      enhanced.registerPlugin(plugin);
    }
  }
  
  // Register lazy-loaded plugins if provided
  if (options.lazyPlugins) {
    for (const definition of options.lazyPlugins) {
      enhanced.registerLazyPlugin(definition);
    }
  }
  
  return enhanced;
}