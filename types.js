/**
 * @namespace FixiPlug
 */

/**
 * @typedef {Object} FixiPlug.PluginContext
 * @property {string} pluginName - The name of the plugin
 * @property {function(string, function, number=): void} on - Registers a hook listener with optional priority.
 * @property {function(string, function): void} [beforeAll] - Registers a handler to run before all handlers for a specific hook.
 * @property {function(string, function): void} off - Removes a hook listener.
 * @property {function(function): void} registerCleanup - Registers a cleanup function.
 * @property {function(string, any=): Promise<any>} [dispatch] - Dispatches an event (optional, available in some contexts).
 * @property {Map<string, any> | Object<string, any>} [storage] - A shared storage map for the plugin.
 * @property {Object<string, any>} [utils] - Namespace for utility functions.
 * @property {any} [fixiplug] - Reference to the fixiplug instance (optional, used by some plugins).
 * @property {boolean} [debug] - Flag indicating debug mode.
 */

/**
 * Plugin function that receives a PluginContext
 * @typedef {function(FixiPlug.PluginContext): void} FixiPlug.PluginFunction
 */

/**
 * Plugin object definition
 * @typedef {Object} FixiPlug.PluginInstance
 * @property {string} name - The name of the plugin
 * @property {string} [version] - Plugin version
 * @property {Array<string>} [dependencies] - List of plugin dependencies
 * @property {function(FixiPlug.PluginContext): void} setup - Function called during plugin initialization
 */

/**
 * Configuration options for createFixiplug
 * @typedef {Object} FixiPlug.ConfigOptions
 * @property {boolean} [logging] - Enable logging (deprecated - use features array)
 * @property {boolean} [dom] - Enable DOM integration (deprecated - use features array)
 * @property {boolean} [test] - Enable testing mode (deprecated - use features array)
 * @property {boolean} [server] - Enable server mode (deprecated - use features array)
 * @property {Array<string>} [features] - List of features to enable (e.g., ['dom', 'logging'])
 * @property {Object} [advanced] - Advanced configuration options
 */

// Export to make this a proper ES module for TypeScript
export {};