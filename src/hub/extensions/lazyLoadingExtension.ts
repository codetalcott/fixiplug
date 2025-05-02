import { PluginManagerExtension, PluginManager, PluginDefinition } from '../types';
import type { FixiPlugs } from '../types';

/**
 * Extension that provides lazy loading functionality
 * 
 * This extension enables plugins to be registered as definitions
 * that will only be loaded and initialized when needed.
 */
export class LazyLoadingExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private pendingPlugins = new Map<string, PluginDefinition>();
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  registerLazy(definition: PluginDefinition): boolean {
    if (this.manager.get(definition.name) || this.pendingPlugins.has(definition.name)) {
      this.manager.getLogger()?.warn(`Plugin "${definition.name}" is already registered.`);
      return false;
    }
    
    this.pendingPlugins.set(definition.name, definition);
    this.manager.getLogger()?.info(`Plugin "${definition.name}" registered for lazy loading.`);
    
    return true;
  }
  
  async loadPlugin(name: string): Promise<FixiPlugs | undefined> {
    if (this.manager.get(name)) {
      return this.manager.get(name);
    }
    
    const definition = this.pendingPlugins.get(name);
    if (!definition) {
      this.manager.getLogger()?.warn(`Plugin "${name}" not found for loading.`);
      return undefined;
    }
    
    // Load dependencies first
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.manager.get(dep) && !this.pendingPlugins.has(dep)) {
          this.manager.getLogger()?.error(`Cannot load plugin "${name}": Dependency "${dep}" not found.`);
          return undefined;
        }
        
        if (!this.manager.get(dep)) {
          const depPlugin = await this.loadPlugin(dep);
          if (!depPlugin) {
            this.manager.getLogger()?.error(`Cannot load plugin "${name}": Failed to load dependency "${dep}".`);
            return undefined;
          }
        }
      }
    }
    
    try {
      this.manager.getLogger()?.debug(`Loading plugin "${name}"...`);
      const plugin = await definition.load();
      this.pendingPlugins.delete(name);
      
      // Register the plugin
      if (this.manager.register(plugin)) {
        return plugin;
      }
      
      return undefined;
    } catch (error) {
      this.manager.getLogger()?.error(`Error loading plugin "${name}":`, error);
      return undefined;
    }
  }
  
  async loadAllPlugins(): Promise<void> {
    const names = Array.from(this.pendingPlugins.keys());
    this.manager.getLogger()?.info(`Loading ${names.length} pending plugins...`);
    
    for (const name of names) {
      await this.loadPlugin(name);
    }
  }
  
  beforeUnregister(name: string, plugin: FixiPlugs): boolean | void {
    // If this is a pending plugin, allow unregistration
    if (this.pendingPlugins.has(name)) {
      this.pendingPlugins.delete(name);
      this.manager.getLogger()?.info(`Pending plugin "${name}" unregistered.`);
      return false; // Skip normal unregistration
    }
  }
  
  /**
   * Get all pending plugin names
   */
  getPendingPluginNames(): string[] {
    return Array.from(this.pendingPlugins.keys());
  }
  
  /**
   * Check if a plugin is pending for lazy loading
   */
  isPending(name: string): boolean {
    return this.pendingPlugins.has(name);
  }
}