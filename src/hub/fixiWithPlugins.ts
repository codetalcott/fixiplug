/**
 * Fixi With Plugins
 * 
 * This file contains the FixiWithPlugins class, which is a wrapper around the 
 * Fixi library that adds plugin support.
 */

import { Fixi } from '../core/fixi';
import { PluginManager } from './pluginManager';
import { FixiPlugs, PluginHook, RequestPluginContext } from './types';

/**
 * Extension of Fixi library that adds plugin support
 */
export class FixiWithPlugins {
  /** The base Fixi instance */
  private fixi: Fixi;
  
  /** The plugin manager */
  private manager: PluginManager;
  
  /** Whether DOM observation is enabled */
  private isDomObserving = false;
  
  /** MutationObserver for watching DOM changes */
  private domObserver?: MutationObserver;

  /**
   * Create a new FixiWithPlugins instance
   */
  constructor(fixi: Fixi, options: PluginSystemOptions = {}) {
    this.fixi = fixi;
    this.manager = new PluginManager(fixi);
    
    // Register initial plugins
    if (options.plugins) {
      options.plugins.forEach(plugin => this.register(plugin));
    }
    
    // Register lazy-loaded plugins
    if (options.lazyPlugins) {
      this.setupLazyPlugins(options.lazyPlugins);
    }
  }

  /**
   * Register a plugin
   * @returns true if registration succeeded, false otherwise
   */
  public register(plugin: FixiPlugs): boolean {
    return this.manager.register(plugin);
  }

  /**
   * Unregister a plugin by name
   * @returns true if unregistration succeeded, false otherwise
   */
  public unregister(pluginName: string): boolean {
    return this.manager.unregister(pluginName);
  }

  /**
   * Get a registered plugin by name
   */
  public getPlugin<T extends FixiPlugs = FixiPlugs>(pluginName: string): T | undefined {
    return this.manager.get<T>(pluginName);
  }

  /**
   * Get all registered plugins
   */
  public getPlugins(): FixiPlugs[] {
    return this.manager.getAll();
  }

  /**
   * Get the underlying plugin manager
   */
  public getManager(): PluginManager {
    return this.manager;
  }

  /**
   * Enhanced fetch method that runs plugins before and after requests
   */
  public async fetch(url: string, options: RequestConfig = {}): Promise<FxResponse> {
    try {
      // Create the initial context for plugins
      const requestContext: RequestPluginContext = {
        fixi: this.fixi,
        config: {
          url,
          ...options
        }
      };
      
      // Execute beforeRequest hooks
      const beforeRequestContext = await this.manager.execute(
        PluginHook.BEFORE_REQUEST, 
        requestContext
      );
      
      // Perform the fetch
      let response: FxResponse;
      try {
        response = await this.fixi.fetch(
          beforeRequestContext.config.url, 
          beforeRequestContext.config
        );
      } catch (error) {
        // Execute error hooks
        const errorContext: RequestPluginContext = {
          ...beforeRequestContext,
          error: error as Error
        };
        
        await this.manager.execute(PluginHook.ERROR, errorContext);
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
   */
  public startObservingDom(targetElement: Element = document.body, options = { subtree: true, childList: true }): void {
    if (this.isDomObserving) return;
    
    if (!window?.MutationObserver) {
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
   */
  public isObservingDom(): boolean {
    return this.isDomObserving;
  }

  /**
   * Use an extension with the plugin manager
   */
  public use(extension: any): this {
    this.manager.use(extension);
    return this;
  }
  
  /**
   * Setup lazy-loaded plugins
   */
  private setupLazyPlugins(lazyPlugins: PluginDefinition[]): void {
    // Implementation for lazy plugin loading
    // This would be implemented by the LazyLoadingExtension
  }
}