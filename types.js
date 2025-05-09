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
 * @property {Map<string, any> | Object<string, any>} [storage] - A shared storage map for the plugin.
 * @property {Object<string, any>} [utils] - Namespace for utility functions.
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