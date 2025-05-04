/**
 * Plugin Manager Implementation
 * 
 * This file contains the core manager class that manages the lifecycle
 * of plugins and coordinates their execution.
 */

import { Fixi } from '../core/fixi';
import { 
  PluginContext,
  RequestPluginContext,
  DomPluginContext,
  PluginHealthMetrics,
  PluginHook,
  PluginManagerExtension,
  Plugin,
  PluginLogger
} from './types';
import { MetricsExtension } from './extensions/metricsExtension';

// Add a namespace for iteration utilities
export namespace PluginIteration {
  /**
   * Checks if execution should continue to the next plugin
   * @param context The current plugin context
   * @returns true if iteration should continue, false if it should stop
   */
  export function shouldContinue<T extends PluginContext>(context: T): boolean {
    return !(context._control?.stopIteration === true);
  }

  /**
   * Signal that hook iteration should stop after the current plugin
   * @param context The context to modify
   * @returns The modified context with control flags
   */
  export function stop<T extends PluginContext>(context: T): T {
    if (!context._control) {
      context._control = {};
    }
    context._control.stopIteration = true;
    return context;
  }

  /**
   * Reset control flags to allow iteration to continue
   * @param context The context to modify
   * @returns The modified context with control flags reset
   */
  export function reset<T extends PluginContext>(context: T): T {
    if (context._control?.stopIteration) {
      delete context._control.stopIteration;
      // Remove the _control object if it's empty
      if (Object.keys(context._control).length === 0) {
        delete context._control;
      }
    }
    return context;
  }
}

/**
 * Core plugin manager implementation
 * 
 * Handles plugin registration, unregistration, and execution of plugin hooks.
 */
export class manager {
  /** Map of active plugins */
  private plugins: Map<string, Plugin> = new Map();
  
  /** Maps each hook type to the plugins that implement it (for faster execution) */
  private hookImplementers: Map<PluginHook, Plugin[]> = new Map();
  
  /** Reference to the Fixi instance */
  private fixi: Fixi;
  
  /** Logger instance from Fixi */
  private logger: PluginLogger;
  
  /** Current API version */
  private readonly API_VERSION = '0.0.1';

  // Optional extensions
  private extensions: PluginManagerExtension[] = [];

  constructor(fixi: Fixi) {
    this.fixi = fixi;
    // Default logger
    this.logger = console;
    
    // Initialize hook implementers map for all hook types
    Object.values(PluginHook).forEach(hook => {
      this.hookImplementers.set(hook as PluginHook, []);
    });
  }

  /**
   * Get the logger instance
   */
  public getLogger(): PluginLogger {
    return this.logger;
  }

  /**
   * Add an extension to enhance manager functionality
   */
  public use(extension: PluginManagerExtension): this {
    this.extensions.push(extension);
    extension.init(this);
    return this;
  }

  /**
   * Register a new plugin
   * @returns true if registration succeeded, false otherwise
   */
  public register(plugin: Plugin): boolean {
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

    // Allow extensions to intercept registration
    for (const ext of this.extensions) {
      const result = ext.beforeRegister?.(plugin);
      if (result === false) return false;
    }

    // Register the plugin
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Plugin "${plugin.name}" v${plugin.version} registered.`);
    
    // Update hook implementers map for faster execution
    this.updateHookImplementersMap(plugin);

    // Initialize plugin
    try {
      plugin.onInitialize?.({
        fixi: this.fixi
      });
    } catch (error) {
      this.logger.error(`Error initializing plugin "${plugin.name}":`, error);
    }

    // Notify extensions
    for (const ext of this.extensions) {
      ext.afterRegister?.(plugin);
    }

    return true;
  }
  
  /**
   * Update the hook implementers map when a plugin is registered
   */
  private updateHookImplementersMap(plugin: Plugin): void {
    Object.values(PluginHook).forEach(hook => {
      const hookType = hook as PluginHook;
      const hookMethod = this.getHookMethod(plugin, hookType);
      
      if (hookMethod) {
        const implementers = this.hookImplementers.get(hookType) || [];
        implementers.push(plugin);
        this.hookImplementers.set(hookType, implementers);
      }
    });
  }

  /**
   * Unregister a plugin by name
   * @returns true if unregistration succeeded, false otherwise
   */
  public unregister(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
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

    // Allow extensions to intercept unregistration
    for (const ext of this.extensions) {
      const result = ext.beforeUnregister?.(pluginName, plugin);
      if (result === false) return false;
    }

    // Clean up plugin
    try {
      plugin.onDestroy?.({
        fixi: this.fixi
      });
    } catch (error) {
      this.logger.error(`Error destroying plugin "${pluginName}":`, error);
    }

    // Remove from plugins map
    this.plugins.delete(pluginName);
    
    // Remove from hook implementers map
    this.removeFromHookImplementersMap(plugin);
    
    this.logger.info(`Plugin "${pluginName}" unregistered.`);
    
    // Notify extensions
    for (const ext of this.extensions) {
      ext.afterUnregister?.(pluginName, plugin);
    }

    return true;
  }
  
  /**
   * Remove a plugin from the hook implementers map
   */
  private removeFromHookImplementersMap(plugin: Plugin): void {
    Object.values(PluginHook).forEach(hook => {
      const hookType = hook as PluginHook;
      const implementers = this.hookImplementers.get(hookType);
      
      if (implementers) {
        // Filter out the plugin
        const updatedImplementers = implementers.filter(p => p.name !== plugin.name);
        this.hookImplementers.set(hookType, updatedImplementers);
      }
    });
  }

  /**
   * Get a registered plugin by name
   */
  public get<T extends Plugin = Plugin>(pluginName: string): T | undefined {
    return this.plugins.get(pluginName) as T | undefined;
  }

  /**
   * Get all registered plugins
   */
  public getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get all extensions
   */
  public getAllExtensions(): PluginManagerExtension[] {
    return [...this.extensions];
  }
  
  /**
   * Get an extension by type
   */
  public getExtension<T extends PluginManagerExtension>(type: new (...args: any[]) => T): T | undefined {
    return this.extensions.find(ext => ext instanceof type) as T | undefined;
  }

  /**
   * Execute all plugin hooks of a specific type
   * @param hookType The type of hook to execute
   * @param context The context to pass to the hooks
   * @returns The modified context
   */
  public async execute<T extends PluginContext>(hookType: PluginHook, context: T): Promise<T> {
    let currentContext = { ...context };
    
    // Process before-execution extensions
    currentContext = this.processBeforeExecuteExtensions(hookType, currentContext);
    
    // Get plugins that implement this hook (already sorted by priority)
    const implementers = this.getPrioritizedImplementers(hookType);
    
    // Execute each plugin's hook
    for (const plugin of implementers) {
      currentContext = await this.executePluginHook(plugin, hookType, currentContext);
      
      if (!PluginIteration.shouldContinue(currentContext)) {
        // stop further execution
        this.logger.debug?.(`Plugin ${plugin.name} signaled to stop further hook execution for ${hookType}`);
        break;
      }
    }
    
    // Clean up control flags before returning
    PluginIteration.reset(currentContext);
    
    // Process after-execution extensions
    currentContext = this.processAfterExecuteExtensions(hookType, currentContext);
    
    return currentContext;
  }

  /**
   * Process extensions that run after hook execution
   */
  private processAfterExecuteExtensions<T extends PluginContext>(hookType: PluginHook, context: T): T {
    let currentContext = context;
    
    for (const ext of this.extensions) {
      const modifiedContext = ext.afterExecute?.(hookType, currentContext);
      if (modifiedContext) currentContext = modifiedContext;
    }
    
    return currentContext;
  }

  /**
   * Process extensions that run before hook execution
   */
  private processBeforeExecuteExtensions<T extends PluginContext>(hookType: PluginHook, context: T): T {
    let currentContext = context;
    for (const ext of this.extensions) {
      const modifiedContext = ext.beforeExecute?.(hookType, currentContext);
      if (modifiedContext) currentContext = modifiedContext;
    }
    return currentContext;
  }

  /**
   * Get prioritized list of plugins implementing the given hook
   */
  private getPrioritizedImplementers(hookType: PluginHook): Plugin[] {
    // Clone to avoid mutating original array
    const implementers = [...(this.hookImplementers.get(hookType) || [])];
    // Sort by descending priority (default 0)
    implementers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return implementers;
  }

  /**
   * Execute a single plugin's hook
   */
  private async executePluginHook<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T
  ): Promise<T> {
    // Skip plugins without the requested hook
    const hookMethod = this.getHookMethod(plugin, hookType);
    if (!hookMethod) return context;
    
    try {
      // Check if hook should be skipped based on extensions
      if (this.shouldSkipHook(plugin, hookType, context)) {
        return context;
      }
      
      // Execute the hook
      const updatedContext = await this.invokeHookMethod(plugin, hookType, context);
      
      // Notify extensions after successful execution
      this.notifyAfterHook(plugin, hookType, updatedContext, null);
      
      return updatedContext;
    } catch (error) {
      this.logger.error(`Error executing ${hookType} hook in plugin "${plugin.name}":`, error);
      
      // Try to handle the error with extensions
      const handled = this.handleHookError(plugin, hookType, context, error as Error);
      
      // Propagate the error if no extension handled it
      if (!handled) throw error;
      
      return context;
    }
  }

  /**
   * Check if a hook should be skipped based on extension feedback
   */
  private shouldSkipHook<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T
  ): boolean {
    for (const ext of this.extensions) {
      const result = ext.beforeHook?.(plugin, hookType, context);
      if (result === false) return true;
    }
    return false;
  }

  /**
   * Invoke the appropriate hook method based on the hook type
   */
  private async invokeHookMethod<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T
  ): Promise<T> {
    const updatedContext = { ...context };
    
    if (hookType === PluginHook.BEFORE_REQUEST && plugin.beforeRequest) {
      const ctx = updatedContext as unknown as RequestPluginContext;
      ctx.config = await plugin.beforeRequest(ctx);
    } 
    else if (hookType === PluginHook.AFTER_RESPONSE && plugin.afterResponse) {
      const ctx = updatedContext as unknown as RequestPluginContext;
      if (ctx.response) {
        ctx.response = await plugin.afterResponse(ctx);
      }
    } 
    else if (hookType === PluginHook.DOM_MUTATED && plugin.onDomMutated) {
      plugin.onDomMutated(updatedContext as unknown as DomPluginContext);
    } 
    else if (hookType === PluginHook.ERROR && plugin.onError) {
      plugin.onError(updatedContext as unknown as RequestPluginContext);
    }
    else if (hookType === PluginHook.INITIALIZE && plugin.onInitialize) {
      plugin.onInitialize(updatedContext as PluginContext);
    }
    else if (hookType === PluginHook.DESTROY && plugin.onDestroy) {
      plugin.onDestroy(updatedContext as PluginContext);
    }
    
    return updatedContext;
  }

  /**
   * Notify extensions after a hook has executed
   */
  private notifyAfterHook<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T, 
    error: Error | null
  ): void {
    for (const ext of this.extensions) {
      ext.afterHook?.(plugin, hookType, context, error);
    }
  }

  /**
   * Handle errors from hook execution using extensions
   * @returns true if the error was handled, false otherwise
   */
  private handleHookError<T extends PluginContext>(
    plugin: Plugin, 
    hookType: PluginHook, 
    context: T, 
    error: Error
  ): boolean {
    for (const ext of this.extensions) {
      const handled = ext.onHookError?.(plugin, hookType, context, error);
      if (handled) return true;
    }
    return false;
  }

  /**
   * Get the appropriate hook method for a plugin
   */
  private getHookMethod(plugin: Plugin, hookType: PluginHook): Function | undefined {
    switch (hookType) {
      case PluginHook.BEFORE_REQUEST: return plugin.beforeRequest;
      case PluginHook.AFTER_RESPONSE: return plugin.afterResponse;
      case PluginHook.DOM_MUTATED: return plugin.onDomMutated;
      case PluginHook.ERROR: return plugin.onError;
      case PluginHook.INITIALIZE: return plugin.onInitialize;
      case PluginHook.DESTROY: return plugin.onDestroy;
      default: return undefined;
    }
  }

  /**
   * Proxy to MetricsExtension to retrieve per-plugin health metrics
   */
  public getPluginHealth(pluginName?: string): Record<string, PluginHealthMetrics> {
    const ext = this.getExtension(MetricsExtension);
    return ext ? ext.getPluginHealth(pluginName) : {};
  }
}