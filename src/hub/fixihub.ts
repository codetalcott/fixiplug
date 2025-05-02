/**
 * DEPRECATED: This file has been refactored into multiple files.
 * 
 * Please import from the new files:
 * - types from './types'
 * - PluginManager from './pluginManager'
 * - FixiWithPlugins from './fixiWithPlugins'
 * - Factory functions from './factory'
 * - or simply import from './' for everything
 */

// Reexport everything from the new structure for backward compatibility
export * from './types';
export { PluginManager } from './pluginManager';
export { FixiWithPlugins } from './fixiWithPlugins';
export { 
  createFixiWithPlugins,
  createCustomFixiWithPlugins,
  createMinimalFixiWithPlugins,
  registerPlugins
} from './factory';

// Default export for backward compatibility
export { FixiWithPlugins as default } from './fixiWithPlugins';