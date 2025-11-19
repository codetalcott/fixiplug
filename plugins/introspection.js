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
 *
 * TERMINOLOGY:
 * - Plugins: Reusable modules that extend FixiPlug (e.g., 'introspectionPlugin', 'stateTrackerPlugin')
 * - Hooks: Named events that plugins listen to (e.g., 'api:introspect', 'state:transition')
 * - State: Application-wide singleton state machine (e.g., 'idle', 'loading', 'complete')
 */
const HOOK_DOCS = {
  // Introspection hooks
  'api:introspect': 'Discover all FixiPlug capabilities. Returns: {fixiplug: {version: "0.0.3", capabilities: {plugins: [{name, enabled, hooks}], hooks: {hookName: {...}}, methods: [{name, description}]}, metadata: {timestamp, pluginCount, hookCount}}}. Use this first to understand what plugins and hooks are available.',

  'api:getPluginCapabilities': 'List all registered plugins. Plugins are modules that extend FixiPlug by listening to hooks. Returns: {capabilities: [{name: "introspectionPlugin", enabled: true, hooks: [{hookName: "api:introspect", priority: 10}], metadata: {type, version, description}}]}',

  'api:getAvailableHooks': 'List all event hooks. Hooks are named events (like "api:introspect") that plugins listen to. Returns: {hooks: {"api:introspect": {name, handlerCount: 1, plugins: ["introspectionPlugin"], priorities: [10], schema: {type: "query", returns: "data"}, description: "..."}}}',

  'api:getPluginDetails': 'Get detailed info for one plugin. Parameters: {pluginName: "introspectionPlugin"}. Returns: {name, enabled: true, hooks: [{hookName, priority, handlerCount}], metadata, documentation}. Error if plugin not found: {error: "Plugin \'foo\' not found"}',

  'api:getHookSchema': 'Get schema for one hook. Parameters: {hookName: "api:introspect"}. Returns: {hookName, exists: true, handlerCount: 1, schema: {type: "query", returns: "data", inferred: false}, description: "...", plugins: ["introspectionPlugin"]}',

  // State tracker hooks (application-wide state machine)
  'api:getCurrentState': 'Get current app state. State is a singleton shared across all plugins. Returns: {state: "loading", data: {progress: 50}, timestamp: 1234567890, age: 1500}. Age is milliseconds since last state change.',

  'api:setState': 'Change app state. Validates transitions if schema registered. Parameters: {state: "loading", data: {progress: 50}, validate: true}. Returns: {success: true, state: "loading", previousState: "idle", timestamp: 1234567890, transition: {from: "idle", to: "loading"}}. Error on invalid transition: {error: "Invalid transition: idle -> complete", validTransitions: ["loading"]}',

  'api:waitForState': 'Wait for app to reach a state. Useful for coordinating async operations. Parameters: {state: "complete", timeout: 30000}. Returns promise: {success: true, state: "complete", data: {...}, timestamp: 1234567890, waited: 2500}. Timeout error: {error: "Timeout waiting for state: complete", timeout: 30000, waited: 30000}. Example: Start async op, then await waitForState("complete").',

  'api:getStateHistory': 'Get recent state transitions (circular buffer). Parameters: {limit: 20}. Default limit: 50. Returns: {history: [{from: "idle", to: "loading", timestamp: 123, age: 500, data: {...}}], currentState: "loading", totalTransitions: 45}',

  'api:registerStateSchema': 'Define valid states and transitions for validation. Parameters: {states: ["idle", "loading", "success", "error"], transitions: {idle: ["loading"], loading: ["success", "error"], success: ["idle"], error: ["idle"]}, initial: "idle"}. Returns: {success: true, schema: {states: [...], transitionCount: 4, initial: "idle"}}. After registration, setState validates transitions. Error on invalid schema: {error: "Invalid state in transitions: foo"}',

  'api:getCommonStates': 'Get predefined state constants for consistency. Returns: {states: {IDLE: "idle", LOADING: "loading", SUCCESS: "success", ERROR: "error", PENDING: "pending", COMPLETE: "complete"}, description: "Predefined common application states"}. Use these strings in setState() calls.',

  'api:clearStateHistory': 'Clear state transition history. Useful to free memory after long sessions. Returns: {success: true, cleared: 50}. Cleared is number of history entries removed.',

  // Fixi-Agent hooks (DOM/fetch capabilities for LLM agents)
  'api:injectFxHtml': 'Inject HTML with fx- attributes into the DOM. Agents use this to create declarative AJAX elements. Parameters: {html: "<button fx-action=\\"/api/data\\" fx-target=\\"#result\\">Load</button>", selector: "#container", position: "beforeend"}. Returns: {success: true, injected: 123, selector, position}. Position options: "beforebegin", "afterbegin", "beforeend", "afterend". Example: Agent creates a button that fetches data when clicked.',

  'api:readDom': 'Read current DOM content (read-only, safe). Agents use this to understand page state. Parameters: {selector: "#status", property: "textContent"}. Returns: {success: true, value: "...", tagName: "div", attributes: {...}}. Property options: "textContent", "innerHTML", "outerHTML", "value". Error if selector not found: {error: "Selector not found: #foo"}.',

  'api:triggerFxElement': 'Programmatically trigger an existing fx-action element. Agents use this to activate existing AJAX functionality. Parameters: {selector: "#refresh-button"}. Returns: {success: true, triggered: "click", action: "/api/refresh"}. Error if element has no fx-action: {error: "Element does not have fx-action: #foo", suggestion: "Use api:injectFxHtml to create fx-action elements first"}.',

  'api:getFxDocumentation': 'Get complete documentation of the fx- attribute system. Agents call this first to learn how to use fixi. Returns: {description: "...", attributes: {fx-action: {required: true, example: "..."}, fx-method: {...}, fx-target: {...}, fx-swap: {...}, fx-trigger: {...}}, events: {fx:init: {...}, fx:before: {...}, ...}, examples: [{name: "Simple GET", html: "...", description: "..."}], bestPractices: [...], security: [...]}. This teaches agents to write fx-attributed HTML.',

  // Skill discovery hooks
  'api:getSkillsManifest': 'Get all available skills (workflow guidance). Skills are pedagogical metadata that teach agents how to orchestrate tools effectively. Returns: {skills: [{pluginName: "reactiveUiPatternsSkill", skill: {name: "reactive-ui-patterns", description: "...", instructions: "...", references: [...], tags: [...]}}], skillCount: 1}. Skills can be pure metadata (skill-only plugins) or attached to implementation plugins (hybrid plugins).',

  'api:getPluginSkills': 'Get skills for all plugins. Returns: {plugins: [{name: "stateTrackerPlugin", hasSkill: true, skill: {...}}, {name: "fixiAgentPlugin", hasSkill: false, skill: null}]}. Use this to see which plugins have workflow guidance.',

  // Error handling
  'pluginError': 'Event fired when a plugin handler throws an error. Handlers receive: {plugin: "pluginName", hookName: "api:introspect", error: Error object, event: original event object}. Listen to this to debug plugin issues.'
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
    const skillsManifest = getSkillsManifest();

    return {
      fixiplug: {
        version: '0.0.3',
        capabilities: {
          plugins: pluginCapabilities,
          hooks: availableHooks,
          skills: skillsManifest,
          methods: getFixiplugMethods()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          pluginCount: pluginCapabilities.length,
          hookCount: Object.keys(availableHooks).length,
          skillCount: skillsManifest.length
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
    const skill = Fixi.getSkill(pluginName);

    return {
      name: pluginName,
      enabled: !disabled.has(pluginName),
      hooks,
      metadata,
      documentation: extractPluginDocs(pluginData),
      skill: skill || null
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
  // API: Get Skills Manifest
  // ========================================
  ctx.on('api:getSkillsManifest', () => {
    const skillRegistry = Fixi.getSkillRegistry();
    const skills = [];

    for (const [pluginName, skill] of skillRegistry.entries()) {
      skills.push({
        pluginName,
        skill
      });
    }

    return {
      skills,
      skillCount: skills.length
    };
  });

  // ========================================
  // API: Get Plugin Skills
  // ========================================
  ctx.on('api:getPluginSkills', (event) => {
    const { pluginName } = event;

    // If specific plugin requested, return just that one
    if (pluginName) {
      const skill = Fixi.getSkill(pluginName);
      return {
        name: pluginName,
        hasSkill: skill !== null,
        skill: skill || null
      };
    }

    // Otherwise return all plugins
    const registry = Fixi.getPluginRegistry();
    const plugins = [];

    for (const name of registry.keys()) {
      const skill = Fixi.getSkill(name);
      plugins.push({
        name,
        hasSkill: skill !== null,
        skill: skill || null
      });
    }

    return { plugins };
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
   * Get all skills manifest
   */
  function getSkillsManifest() {
    const skillRegistry = Fixi.getSkillRegistry();
    const skills = [];

    for (const [pluginName, skill] of skillRegistry.entries()) {
      skills.push({
        pluginName,
        skill
      });
    }

    return skills;
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
