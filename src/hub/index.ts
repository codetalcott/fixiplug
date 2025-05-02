/**
 * Fixi Plugin System
 * 
 * This is the main entry point for the Fixi plugin system.
 * It provides a clean public API for creating plugin-enhanced Fixi instances.
 */

// Export types
export * from './types';

// Export core classes
export { PluginManager } from './pluginManager';
export { FixiWithPlugins } from './fixiWithPlugins';

// Export factory functions
export { 
  createFixiWithPlugins,
  createCustomFixiWithPlugins,
  createMinimalFixiWithPlugins,
  registerPlugins
} from './factory';

// Export all built-in extensions
export * from './extensions';

// Default export for convenience
export { createFixiWithPlugins as default } from './factory';