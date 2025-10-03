/**
 * FixiPlug Introspection Plugin
 *
 * Exposes FixiPlug's internal capabilities, plugins, and hooks for LLM agent discovery.
 * This plugin enables autonomous agents to discover and understand FixiPlug's API surface
 * without needing to read source code.
 *
 * @module plugins/introspection
 *
 * API Hooks Exposed:
 * - api:introspect - Get complete FixiPlug state snapshot
 * - api:getPluginCapabilities - List all registered plugins with metadata
 * - api:getAvailableHooks - List all hooks with schemas
 * - api:getPluginDetails - Get detailed info for specific plugin
 * - api:getHookSchema - Get schema and docs for specific hook
 *
 * @example
 * // Agent discovers FixiPlug capabilities
 * const snapshot = await fixiplug.dispatch('api:introspect');
 * console.log(snapshot.fixiplug.capabilities);
 *
 * @example
 * // Agent lists all plugins
 * const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
 * plugins.capabilities.forEach(p => console.log(p.name, p.enabled));
 */

import { Fixi } from '../core/fixi-core.js';

/**
 * Hook naming patterns for schema inference
 */
const HOOK_PATTERNS = {
  'api:*': {
    type: 'query',
    returns: 'data',
    description: 'API query hook that returns data'
  },
  'agent:*': {
    type: 'command',
    returns: 'result',
    description: 'Agent command that performs an action'
  },
  'state:*': {
    type: 'event',
    returns: 'state',
    description: 'State transition event'
  },
  'internal:*': {
    type: 'system',
    returns: 'data',
    description: 'Internal system hook'
  },
  'annotate:*': {
    type: 'mutation',
    returns: 'void',
    description: 'DOM annotation hook'
  },
  'pluginError': {
    type: 'error',
    params: ['plugin', 'hookName', 'error', 'event'],
    description: 'Fired when a plugin encounters an error'
  }
};

/**
 * Built-in hook documentation
 */
const HOOK_DOCS = {
  'api:introspect': 'Returns complete FixiPlug introspection data including version, features, and capabilities',
  'api:getPluginCapabilities': 'Returns list of all registered plugins with metadata, enabled status, and hooks',
  'api:getAvailableHooks': 'Returns all available hooks with their handler counts, plugins, and schemas',
  'api:getPluginDetails': 'Returns detailed information for a specific plugin by name',
  'api:getHookSchema': 'Returns schema and documentation for a specific hook by name',
  'pluginError': 'Fired when a plugin handler throws an error during execution'
};

/**
 * Introspection plugin factory
 * @param {Object} ctx - Plugin context
 */
export default function introspectionPlugin(ctx) {

  // ========================================
  // API: Complete Introspection
  // ========================================
  ctx.on('api:introspect', async () => {
    const pluginCapabilities = await getPluginCapabilities();
    const availableHooks = await getAvailableHooks();

    return {
      fixiplug: {
        version: '0.0.3',
        capabilities: {
          plugins: pluginCapabilities,
          hooks: availableHooks,
          methods: getFixiplugMethods()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          pluginCount: pluginCapabilities.length,
          hookCount: Object.keys(availableHooks).length
        }
      }
    };
  });

  // ========================================
  // API: Get All Plugin Capabilities
  // ========================================
  ctx.on('api:getPluginCapabilities', async () => {
    const capabilities = await getPluginCapabilities();
    return { capabilities };
  });

  // ========================================
  // API: Get Available Hooks
  // ========================================
  ctx.on('api:getAvailableHooks', async () => {
    const hooks = await getAvailableHooks();
    return { hooks };
  });

  // ========================================
  // API: Get Plugin Details
  // ========================================
  ctx.on('api:getPluginDetails', (event) => {
    const { pluginName } = event;

    if (!pluginName) {
      return { error: 'pluginName parameter required' };
    }

    const registry = Fixi.getPluginRegistry();
    const pluginData = registry.get(pluginName);

    if (!pluginData) {
      return { error: `Plugin '${pluginName}' not found` };
    }

    const disabled = Fixi.getDisabledPlugins();
    const hooks = getPluginHooks(pluginName);
    const metadata = extractPluginMetadata(pluginData);

    return {
      name: pluginName,
      enabled: !disabled.has(pluginName),
      hooks,
      metadata,
      documentation: extractPluginDocs(pluginData)
    };
  });

  // ========================================
  // API: Get Hook Schema
  // ========================================
  ctx.on('api:getHookSchema', (event) => {
    const { hookName } = event;

    if (!hookName) {
      return { error: 'hookName parameter required' };
    }

    const allHooks = Fixi.getHooks();
    const handlers = allHooks[hookName] || [];

    return {
      hookName,
      exists: handlers.length > 0,
      handlerCount: handlers.length,
      schema: inferHookSchema(hookName, handlers),
      description: getHookDescription(hookName),
      plugins: handlers.map(h => h.plugin)
    };
  });

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * Get all plugin capabilities
   */
  async function getPluginCapabilities() {
    const registry = Fixi.getPluginRegistry();
    const disabled = Fixi.getDisabledPlugins();
    const capabilities = [];

    for (const [name, pluginData] of registry.entries()) {
      capabilities.push({
        name,
        enabled: !disabled.has(name),
        hooks: getPluginHooks(name),
        metadata: extractPluginMetadata(pluginData)
      });
    }

    return capabilities;
  }

  /**
   * Get all available hooks with metadata
   */
  async function getAvailableHooks() {
    const allHooks = Fixi.getHooks();
    const hooksData = {};

    for (const [hookName, handlers] of Object.entries(allHooks)) {
      hooksData[hookName] = {
        name: hookName,
        handlerCount: handlers.length,
        plugins: handlers.map(h => h.plugin),
        priorities: handlers.map(h => h.priority),
        schema: inferHookSchema(hookName, handlers),
        description: getHookDescription(hookName)
      };
    }

    return hooksData;
  }

  /**
   * Get hooks registered by a specific plugin
   */
  function getPluginHooks(pluginName) {
    const allHooks = Fixi.getHooks();
    const pluginHooks = [];

    for (const [hookName, handlers] of Object.entries(allHooks)) {
      const pluginHandlers = handlers.filter(h => h.plugin === pluginName);
      if (pluginHandlers.length > 0) {
        pluginHooks.push({
          hookName,
          priority: pluginHandlers[0].priority,
          handlerCount: pluginHandlers.length
        });
      }
    }

    return pluginHooks;
  }

  /**
   * Extract metadata from plugin data
   */
  function extractPluginMetadata(pluginData) {
    const metadata = {};

    if (typeof pluginData === 'function') {
      metadata.type = 'function';
      metadata.name = pluginData.name || pluginData.pluginId || 'anonymous';
    } else if (typeof pluginData === 'object' && pluginData !== null) {
      metadata.type = 'object';
      metadata.name = pluginData.name || 'anonymous';
      metadata.version = pluginData.version;
      metadata.description = pluginData.description;
      metadata.author = pluginData.author;
    }

    return metadata;
  }

  /**
   * Extract documentation from plugin data
   */
  function extractPluginDocs(pluginData) {
    if (typeof pluginData === 'object' && pluginData !== null) {
      return pluginData.docs || pluginData.documentation || null;
    }
    return null;
  }

  /**
   * Infer hook schema from naming patterns
   */
  function inferHookSchema(hookName, handlers) {
    // Check for exact match first
    if (HOOK_PATTERNS[hookName]) {
      return { ...HOOK_PATTERNS[hookName], inferred: false };
    }

    // Check for pattern match (wildcard)
    for (const [pattern, schema] of Object.entries(HOOK_PATTERNS)) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (hookName.startsWith(prefix)) {
          return { ...schema, inferred: true };
        }
      }
    }

    // Default schema for unknown hooks
    return {
      type: 'custom',
      returns: 'unknown',
      description: 'Custom hook with no predefined schema',
      inferred: true
    };
  }

  /**
   * Get description for a hook
   */
  function getHookDescription(hookName) {
    return HOOK_DOCS[hookName] || 'No description available';
  }

  /**
   * Get FixiPlug core methods
   */
  function getFixiplugMethods() {
    return [
      {
        name: 'use',
        description: 'Register a plugin',
        params: ['plugin'],
        returns: 'fixiplug instance (chainable)'
      },
      {
        name: 'unuse',
        description: 'Unregister a plugin completely',
        params: ['pluginName'],
        returns: 'fixiplug instance (chainable)'
      },
      {
        name: 'enable',
        description: 'Enable a disabled plugin',
        params: ['pluginName'],
        returns: 'fixiplug instance (chainable)'
      },
      {
        name: 'disable',
        description: 'Disable an active plugin',
        params: ['pluginName'],
        returns: 'fixiplug instance (chainable)'
      },
      {
        name: 'dispatch',
        description: 'Dispatch a hook event',
        params: ['hookName', 'event'],
        returns: 'Promise<event>'
      },
      {
        name: 'off',
        description: 'Remove a specific hook handler',
        params: ['hookName', 'handler'],
        returns: 'fixiplug instance (chainable)'
      },
      {
        name: 'getPlugins',
        description: 'Get list of registered plugin names',
        params: [],
        returns: 'Array<string>'
      },
      {
        name: 'hasFeature',
        description: 'Check if a feature is enabled',
        params: ['feature'],
        returns: 'boolean'
      }
    ];
  }
}
