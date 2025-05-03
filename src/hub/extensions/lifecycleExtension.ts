import { PluginManagerExtension, manager, PluginHook, PluginContext, FixiPlugs } from '..';

/**
 * Extension that manages plugin lifecycle events
 * 
 * This extension ensures proper initialization and cleanup of plugins,
 * and tracks their lifecycle state.
 */
export class LifecycleExtension implements PluginManagerExtension {
  private manager!: manager;
  private lifecycleState = new Map<string, {
    initialized: boolean;
    initTime: number;
    lastActive: number;
  }>();
  
  init(manager: manager): void {
    this.manager = manager;
  }
  
  beforeRegister(plugin: FixiPlugs): boolean | void {
    // Initialize lifecycle tracking for new plugin
    this.lifecycleState.set(plugin.name, {
      initialized: false,
      initTime: 0,
      lastActive: 0
    });
  }
  
  afterRegister(plugin: FixiPlugs): void {
    // Mark plugin as initialized
    const state = this.lifecycleState.get(plugin.name);
    if (state) {
      state.initialized = true;
      state.initTime = Date.now();
      state.lastActive = Date.now();
      
      this.manager.getLogger()?.debug?.(
        `Plugin "${plugin.name}" initialized at ${new Date(state.initTime).toISOString()}`
      );
    }
  }
  
  beforeUnregister(name: string): boolean | void {
    // Log the plugin's lifecycle information before unregistering
    const state = this.lifecycleState.get(name);
    if (state && state.initialized) {
      const uptime = Date.now() - state.initTime;
      const lastActiveAgo = Date.now() - state.lastActive;
      
      this.manager.getLogger()?.info?.(
        `Plugin "${name}" being unregistered after ${this.formatTime(uptime)} uptime. ` +
        `Last active ${this.formatTime(lastActiveAgo)} ago.`
      );
    }
  }
  
  afterUnregister(name: string): void {
    // Clean up lifecycle state
    this.lifecycleState.delete(name);
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void {
    // Update last active time when a hook is called
    const state = this.lifecycleState.get(plugin.name);
    if (state) {
      state.lastActive = Date.now();
    }
  }
  
  /**
   * Get lifecycle information for all plugins or a specific plugin
   */
  getLifecycleInfo(pluginName?: string): Record<string, {
    initialized: boolean;
    uptime: number;
    lastActiveAgo: number;
  }> {
    const now = Date.now();
    const result: Record<string, any> = {};
    
    if (pluginName) {
      const state = this.lifecycleState.get(pluginName);
      if (state) {
        result[pluginName] = {
          initialized: state.initialized,
          uptime: state.initialized ? now - state.initTime : 0,
          lastActiveAgo: now - state.lastActive
        };
      }
    } else {
      for (const [name, state] of this.lifecycleState.entries()) {
        result[name] = {
          initialized: state.initialized,
          uptime: state.initialized ? now - state.initTime : 0,
          lastActiveAgo: now - state.lastActive
        };
      }
    }
    
    return result;
  }
  
  /**
   * Format time in ms to a human-readable string
   */
  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }
}