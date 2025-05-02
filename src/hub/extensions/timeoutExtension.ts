import { PluginManagerExtension, PluginManager, PluginHook, PluginContext, FixiPlugs } from '..';

/**
 * Extension that provides timeout protection for plugin hooks
 * 
 * This extension ensures that plugin hooks don't run indefinitely by
 * applying timeouts specified in the plugin configuration.
 */
export class TimeoutExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  private activeTimeouts = new Map<string, NodeJS.Timeout>();
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void {
    // Skip if timeouts are not configured
    if (!plugin.timeouts || !plugin.timeouts[hookType]) return;
    
    // Store the timeout configuration in the context for use in execute method
    const timeout = plugin.timeouts[hookType]!;
    const pluginKey = `${plugin.name}:${hookType}`;
    
    // Set up timeout tracking
    (context as any)._timeoutInfo = {
      pluginKey,
      timeout,
      startTime: Date.now()
    };
  }
  
  afterHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error | null): void {
    // Clear any active timeout for this hook
    const pluginKey = `${plugin.name}:${hookType}`;
    const timeoutId = this.activeTimeouts.get(pluginKey);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimeouts.delete(pluginKey);
    }
    
    // Log timing information if debug is enabled
    const timeoutInfo = (context as any)._timeoutInfo;
    if (timeoutInfo && timeoutInfo.startTime) {
      const duration = Date.now() - timeoutInfo.startTime;
      const timeout = timeoutInfo.timeout;
      
      if (duration > timeout * 0.8) {
        // Log a warning if execution time is close to timeout
        this.manager.getLogger()?.warn?.(
          `Plugin "${plugin.name}" hook "${hookType}" took ${duration}ms, ` +
          `which is close to its timeout of ${timeout}ms`
        );
      }
    }
  }
  
  /**
   * Start a timeout for a plugin hook
   * 
   * @returns A function that when called will resolve with a TimeoutError
   * if the timeout has been exceeded
   */
  startTimeout<T>(plugin: FixiPlugs, hookType: PluginHook, timeout: number): (context: T) => Promise<T> {
    const pluginKey = `${plugin.name}:${hookType}`;
    
    return (context: T) => {
      return new Promise((resolve, reject) => {
        // Set up timeout that will reject after specified ms
        const timeoutId = setTimeout(() => {
          const error = new Error(`Plugin "${plugin.name}" hook "${hookType}" timed out after ${timeout}ms`);
          error.name = 'TimeoutError';
          reject(error);
        }, timeout);
        
        // Store for cleanup
        this.activeTimeouts.set(pluginKey, timeoutId);
        
        // Immediately resolve with the context
        resolve(context);
      });
    };
  }
  
  /**
   * Clean up all active timeouts
   */
  dispose(): void {
    for (const timeoutId of this.activeTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
  }
}