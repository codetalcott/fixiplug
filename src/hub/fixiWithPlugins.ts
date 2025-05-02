/**
 * Fixi With Plugins
 * 
 * A wrapper around the Fixi library that adds robust plugin support,
 * enabling extensible HTTP client functionality through a plugin ecosystem.
 */

import { Fixi, RequestConfig, FxResponse } from '../core/fixi';
import { PluginManager } from './pluginManager';
import { 
  FixiPlugs,
  PluginHook,
  RequestPluginContext,
  PluginManagerExtension,
  PluginSystemOptions,
  PluginDefinition
} from './types';

/**
 * Extension of Fixi library that adds plugin support
 * 
 * @remarks
 * FixiWithPlugins orchestrates the plugin lifecycle and provides a plugin-enhanced
 * interface to the base Fixi functionality. It handles plugin registration,
 * hook execution, and DOM observation capabilities.
 */
export class FixiWithPlugins {
  /** The base Fixi instance */
  private readonly fixi: Fixi;
  
  /** The plugin manager responsible for plugin lifecycle */
  private readonly manager: PluginManager;
  
  /** Whether DOM observation is enabled */
  private isDomObserving = false;
  
  /** MutationObserver for watching DOM changes */
  private domObserver?: MutationObserver;

  /**
   * Create a new FixiWithPlugins instance
   * 
   * @param fixi - The base Fixi instance
   * @param options - Configuration options for the plugin system
   */
  constructor(fixi: Fixi, options: PluginSystemOptions = {}) {
    this.fixi = fixi;
    this.manager = new PluginManager(fixi);
    
    // Register initial plugins
    if (options.plugins?.length) {
      options.plugins.forEach(plugin => this.register(plugin));
    }
    
    // Register lazy-loaded plugins
    if (options.lazyPlugins?.length) {
      this.setupLazyPlugins(options.lazyPlugins);
    }
  }

  /**
   * Register a plugin
   * 
   * @param plugin - The plugin to register
   * @returns True if registration succeeded, false otherwise
   */
  public register(plugin: FixiPlugs): boolean {
    return this.manager.register(plugin);
  }

  /**
   * Unregister a plugin by name
   * 
   * @param pluginName - The name of the plugin to unregister
   * @returns True if unregistration succeeded, false otherwise
   */
  public unregister(pluginName: string): boolean {
    return this.manager.unregister(pluginName);
  }

  /**
   * Get a registered plugin by name
   * 
   * @param pluginName - The name of the plugin to retrieve
   * @returns The plugin if found, undefined otherwise
   */
  public getPlugin<T extends FixiPlugs = FixiPlugs>(pluginName: string): T | undefined {
    return this.manager.get<T>(pluginName);
  }

  /**
   * Get all registered plugins
   * 
   * @returns An array of all registered plugins
   */
  public getPlugins(): FixiPlugs[] {
    return this.manager.getAll();
  }

  /**
   * Get the underlying plugin manager
   * 
   * @returns The plugin manager instance
   */
  public getManager(): PluginManager {
    return this.manager;
  }

  /**
   * Enhanced fetch method that runs plugins before and after requests
   * 
   * @param url - The URL to fetch
   * @param options - Request configuration options
   * @returns A promise that resolves to the response
   * @throws Will throw if the request fails or if a plugin throws an error
   */
  public async fetch(url: string, options: Partial<RequestConfig> = {}): Promise<FxResponse> {
    try {
      // Create the initial context for plugins
      const requestContext: RequestPluginContext = {
        fixi: this.fixi,
        config: {
          url,
          ...options
        } as RequestConfig
      };
      
      // Execute beforeRequest hooks
      const beforeRequestContext = await this.manager.execute(
        PluginHook.BEFORE_REQUEST, 
        requestContext
      );
      
      // Perform the fetch
      let response: FxResponse;
      try {
        // Pass the full config object including URL
        response = await this.fixi.fetch(beforeRequestContext.config);
      } catch (error) {
        // Execute error hooks
        const errorContext: RequestPluginContext = {
          ...beforeRequestContext,
          error: error as Error
        };
        
        const handledContext = await this.manager.execute(PluginHook.ERROR, errorContext);
        
        // If error was handled by a plugin, return the response (if provided)
        if (handledContext.handled && handledContext.response) {
          return handledContext.response;
        }
        
        throw error;
      }
      
      // Execute afterResponse hooks
      const afterResponseContext = await this.manager.execute(
        PluginHook.AFTER_RESPONSE, 
        {
          ...beforeRequestContext,
          response
        }
      );
      
      return afterResponseContext.response!;
    } catch (error) {
      this.manager.getLogger().error('Error in FixiWithPlugins.fetch:', error);
      throw error;
    }
  }

  /**
   * Start observing DOM mutations to trigger plugin hooks
   * 
   * @param targetElement - The DOM element to observe (defaults to document.body)
   * @param options - MutationObserver configuration options
   */
  public startObservingDom(
    targetElement: Element = document.body, 
    options = { subtree: true, childList: true }
  ): void {
    if (this.isDomObserving) return;
    
    if (typeof window === 'undefined' || !window?.MutationObserver) {
      this.manager.getLogger().warn('MutationObserver not available, DOM mutation hooks will not be triggered.');
      return;
    }
    
    this.domObserver = new MutationObserver(mutations => {
      this.manager.execute(PluginHook.DOM_MUTATED, {
        fixi: this.fixi,
        mutations,
        target: targetElement
      });
    });
    
    this.domObserver.observe(targetElement, options);
    this.isDomObserving = true;
  }

  /**
   * Stop observing DOM mutations
   */
  public stopObservingDom(): void {
    if (!this.isDomObserving || !this.domObserver) return;
    
    this.domObserver.disconnect();
    this.isDomObserving = false;
  }

  /**
   * Check if DOM observation is active
   * 
   * @returns True if currently observing DOM mutations, false otherwise
   */
  public isObservingDom(): boolean {
    return this.isDomObserving;
  }

  /**
   * Use an extension with the plugin manager
   * 
   * @param extension - The extension to add to the plugin manager
   * @returns This instance for method chaining
   */
  public use(extension: PluginManagerExtension): this {
    this.manager.use(extension);
    return this;
  }
  
  /**
   * Setup lazy-loaded plugins
   * 
   * @private
   * @param lazyPlugins - Array of plugin definitions for lazy loading
   */
  private setupLazyPlugins(lazyPlugins: PluginDefinition[]): void {
    // This is a stub that would be implemented by the LazyLoadingExtension
    // The extension would handle the actual lazy loading logic
  }
}