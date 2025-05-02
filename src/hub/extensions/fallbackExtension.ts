import { PluginManagerExtension, PluginManager, PluginHook, PluginContext, RequestPluginContext } from '../types';
import type { FixiPlugs } from '../types';

/**
 * Extension that provides fallback functionality
 * 
 * This extension enables graceful error recovery by invoking fallback functions
 * when plugin hooks encounter errors.
 */
export class FallbackExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  onHookError<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T, error: Error): boolean | void {
    // Skip if fallbacks are not configured
    if (!plugin.fallbacks || !plugin.fallbacks[hookType]) return;
    
    try {
      const fallbackResult = plugin.fallbacks[hookType](context, error);
      
      // Apply fallback result based on hook type
      if (hookType === PluginHook.BEFORE_REQUEST) {
        (context as unknown as RequestPluginContext).config = fallbackResult;
      } else if (hookType === PluginHook.AFTER_RESPONSE && (context as unknown as RequestPluginContext).response) {
        (context as unknown as RequestPluginContext).response = fallbackResult;
      }
      
      // Log that a fallback was used
      this.manager.getLogger()?.debug?.(
        `Fallback executed for plugin "${plugin.name}" on hook "${hookType}" after error: ${error.message}`
      );
      
      // Indicate that we've handled the error
      return true;
    } catch (fallbackError) {
      // If the fallback itself fails, log and continue
      this.manager.getLogger()?.error?.(
        `Fallback failed for plugin "${plugin.name}" on hook "${hookType}":`, 
        fallbackError
      );
      return false;
    }
  }
}