import { PluginManagerExtension, PluginManager, PluginHook, PluginContext } from '../types';
import type { FixiPlugs } from '../types';

/**
 * Extension that handles conditional hook execution
 * 
 * This extension evaluates the conditions provided by plugins to determine
 * whether their hooks should execute based on the current context.
 */
export class ConditionalExecutionExtension implements PluginManagerExtension {
  private manager!: PluginManager;
  
  init(manager: PluginManager): void {
    this.manager = manager;
  }
  
  beforeHook<T extends PluginContext>(plugin: FixiPlugs, hookType: PluginHook, context: T): boolean | void {
    // Skip if conditions are not configured
    if (!plugin.conditions || !plugin.conditions[hookType]) return;
    
    // Check if the condition is met
    const result = plugin.conditions[hookType](context);
    
    // Only return false to indicate skipping the hook
    // Otherwise return undefined to allow normal execution
    return result === false ? false : undefined;
  }
}