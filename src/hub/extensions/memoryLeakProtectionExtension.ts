/**
 * Extension for memory leak protection
 * 
 * This extension helps prevent memory leaks by tracking resources allocated
 * by plugins and ensuring they're properly released when plugins are unregistered.
 */
export class MemoryLeakProtectionExtension implements PluginManagerExtension {
  private manager: PluginManager;
  private resourceRegistry: Map<string, { 
    type: string;
    handle: any; 
    cleanupFn?: () => void;
  }[]> = new Map();
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  afterRegister(plugin: FixiPlugs): void {
    // Initialize resource tracking for this plugin
    if (!this.resourceRegistry.has(plugin.name)) {
      this.resourceRegistry.set(plugin.name, []);
    }
    
    // Add resource tracking methods to the plugin
    this.enhancePlugin(plugin);
  }
  
  beforeUnregister(name: string, plugin: FixiPlugs): void {
    // Clean up all tracked resources
    this.cleanupPluginResources(name);
  }
  
  /**
   * Add resource tracking methods to a plugin
   */
  private enhancePlugin(plugin: FixiPlugs): void {
    // Skip if plugin already has these methods
    if (plugin._trackResource) return;
    
    // Add resource tracking methods
    plugin._trackResource = (type: string, handle: any, cleanupFn?: () => void): void => {
      const resources = this.resourceRegistry.get(plugin.name) || [];
      resources.push({ type, handle, cleanupFn });
      this.resourceRegistry.set(plugin.name, resources);
    };
    
    plugin._releaseResource = (handle: any): boolean => {
      const resources = this.resourceRegistry.get(plugin.name) || [];
      const index = resources.findIndex(r => r.handle === handle);
      
      if (index >= 0) {
        const resource = resources[index];
        if (resource.cleanupFn) {
          try {
            resource.cleanupFn();
          } catch (error) {
            console.error(`Error cleaning up resource in plugin "${plugin.name}":`, error);
          }
        }
        
        resources.splice(index, 1);
        this.resourceRegistry.set(plugin.name, resources);
        return true;
      }
      
      return false;
    };
    
    // Convenience method for DOM listeners
    plugin._trackListener = (element: HTMLElement | Document | Window, eventType: string, listener: EventListener): void => {
      plugin._trackResource(
        'event-listener', 
        { element, eventType, listener },
        () => element.removeEventListener(eventType, listener)
      );
    };
  }
  
  /**
   * Clean up all resources for a plugin
   */
  private cleanupPluginResources(pluginName: string): void {
    const resources = this.resourceRegistry.get(pluginName) || [];
    
    // Execute cleanup functions in reverse order (LIFO)
    for (let i = resources.length - 1; i >= 0; i--) {
      const resource = resources[i];
      if (resource.cleanupFn) {
        try {
          resource.cleanupFn();
        } catch (error) {
          console.error(`Error cleaning up ${resource.type} resource in plugin "${pluginName}":`, error);
        }
      }
    }
    
    // Clear the registry
    this.resourceRegistry.delete(pluginName);
  }
  
  /**
   * Get current resource usage statistics
   */
  getResourceStats(): Record<string, { 
    resourceCount: number; 
    byType: Record<string, number>;
  }> {
    const stats: Record<string, any> = {};
    
    for (const [pluginName, resources] of this.resourceRegistry.entries()) {
      const byType: Record<string, number> = {};
      
      for (const resource of resources) {
        byType[resource.type] = (byType[resource.type] || 0) + 1;
      }
      
      stats[pluginName] = {
        resourceCount: resources.length,
        byType
      };
    }
    
    return stats;
  }
}