/**
 * Anthropic Adapter for FixiPlug Agent SDK
 *
 * Provides integration between FixiPlug Agent SDK and Anthropic's Claude tool use API.
 * Converts Agent SDK capabilities into Anthropic tool definitions and handles
 * tool use execution.
 *
 * @module sdk/adapters/anthropic-adapter
 * @example
 * import { AnthropicAdapter } from './sdk/adapters/anthropic-adapter.js';
 * import { FixiPlugAgent } from './sdk/agent-client.js';
 *
 * const agent = new FixiPlugAgent(fixiplug);
 * const adapter = new AnthropicAdapter(agent);
 *
 * // Get Anthropic-compatible tool definitions
 * const tools = await adapter.getToolDefinitions();
 *
 * // Handle Anthropic tool use
 * const result = await adapter.executeToolUse({
 *   id: 'toolu_123',
 *   name: 'discover_capabilities',
 *   input: {}
 * });
 */

/**
 * Anthropic Adapter for FixiPlug Agent SDK
 *
 * @class AnthropicAdapter
 */
export class AnthropicAdapter {
  /**
   * Create a new Anthropic adapter
   *
   * @param {Object} agent - FixiPlugAgent instance
   * @param {Object} [options={}] - Adapter options
   * @param {boolean} [options.includeCoreTools=true] - Include core Agent SDK tools
   * @param {boolean} [options.includeWorkflowTools=true] - Include workflow tools
   * @param {boolean} [options.includeCacheTools=true] - Include cache management tools
   * @param {boolean} [options.includePluginHooks=false] - Include discovered plugin hooks
   * @param {boolean} [options.includeSkills=false] - Include skills in context generation
   */
  constructor(agent, options = {}) {
    if (!agent) {
      throw new Error('AnthropicAdapter requires a FixiPlugAgent instance');
    }

    this.agent = agent;
    this.options = {
      includeCoreTools: options.includeCoreTools !== false,
      includeWorkflowTools: options.includeWorkflowTools !== false,
      includeCacheTools: options.includeCacheTools !== false,
      includePluginHooks: options.includePluginHooks || false,
      includeSkills: options.includeSkills || false
    };

    // Track tool use history
    this.useHistory = [];
  }

  /**
   * Get Anthropic-compatible tool definitions
   *
   * @param {Object} [options={}] - Generation options
   * @param {boolean} [options.refresh=false] - Force refresh capabilities
   * @returns {Promise<Array>} Array of Anthropic tool definitions
   *
   * @example
   * const tools = await adapter.getToolDefinitions();
   * // Use with Anthropic API
   * const response = await anthropic.messages.create({
   *   model: 'claude-3-5-sonnet-20241022',
   *   messages: [...],
   *   tools: tools
   * });
   */
  async getToolDefinitions(options = {}) {
    const tools = [];

    // Core Agent SDK tools
    if (this.options.includeCoreTools) {
      tools.push(...this._getCoreTools());
    }

    // Workflow tools
    if (this.options.includeWorkflowTools) {
      tools.push(...this._getWorkflowTools());
    }

    // Cache management tools
    if (this.options.includeCacheTools) {
      tools.push(...this._getCacheTools());
    }

    // Plugin hooks (discovered from introspection)
    if (this.options.includePluginHooks) {
      const pluginTools = await this._getPluginHookTools(options.refresh);
      tools.push(...pluginTools);
    }

    return tools;
  }

  /**
   * Execute an Anthropic tool use
   *
   * @param {Object} toolUse - Anthropic tool use object
   * @param {string} toolUse.id - Tool use ID
   * @param {string} toolUse.name - Tool name
   * @param {Object} toolUse.input - Tool input object
   * @returns {Promise<Object>} Tool execution result
   *
   * @example
   * // Handle Anthropic tool use
   * const toolUse = response.content.find(c => c.type === 'tool_use');
   * const result = await adapter.executeToolUse(toolUse);
   */
  async executeToolUse(toolUse) {
    const { id, name, input } = toolUse;

    // Record use
    const useRecord = {
      id,
      name,
      input,
      timestamp: Date.now()
    };

    try {
      const result = await this._executeTool(name, input);
      useRecord.result = result;
      useRecord.success = true;
      this.useHistory.push(useRecord);
      return result;
    } catch (error) {
      useRecord.error = error.message;
      useRecord.success = false;
      this.useHistory.push(useRecord);
      throw error;
    }
  }

  /**
   * Get tool use history
   *
   * @returns {Array} Array of tool use records
   *
   * @example
   * const history = adapter.getUseHistory();
   * console.log('Total uses:', history.length);
   * console.log('Successful:', history.filter(u => u.success).length);
   */
  getUseHistory() {
    return [...this.useHistory];
  }

  /**
   * Clear tool use history
   */
  clearUseHistory() {
    this.useHistory = [];
  }

  /**
   * Create a tool result message for Anthropic
   *
   * @param {string} toolUseId - The tool use ID
   * @param {Object} result - The tool execution result
   * @param {boolean} [isError=false] - Whether this is an error result
   * @returns {Object} Anthropic-compatible tool result content block
   *
   * @example
   * const result = await adapter.executeToolUse(toolUse);
   * const toolResult = adapter.createToolResult(toolUse.id, result);
   *
   * // Add to message
   * const message = {
   *   role: 'user',
   *   content: [toolResult]
   * };
   */
  createToolResult(toolUseId, result, isError = false) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify(result),
      is_error: isError
    };
  }

  /**
   * Get skills context for Claude system message
   *
   * Retrieves all registered skills and formats them as markdown documentation
   * suitable for injection into Claude's system context. This teaches Claude
   * how to orchestrate FixiPlug tools effectively.
   *
   * @param {Object} [options={}] - Context generation options
   * @param {string} [options.format='full'] - Detail level: 'metadata' (name/desc only), 'summary' (name/desc/tags), 'full' (includes instructions)
   * @param {Array<string>} [options.includeOnly] - Only include specific skills by name
   * @param {Array<string>} [options.exclude] - Exclude specific skills by name
   * @returns {Promise<string>} Formatted skills context as markdown
   *
   * @example
   * const adapter = new AnthropicAdapter(agent, { includeSkills: true });
   *
   * // Get full skills context
   * const context = await adapter.getSkillsContext();
   *
   * // Get metadata only (lighter weight)
   * const metadata = await adapter.getSkillsContext({ format: 'metadata' });
   *
   * // Include in system message
   * const response = await anthropic.messages.create({
   *   model: 'claude-3-5-sonnet-20241022',
   *   system: context,
   *   messages: [...],
   *   tools: await adapter.getToolDefinitions()
   * });
   */
  async getSkillsContext(options = {}) {
    const {
      format = 'full',
      includeOnly = null,
      exclude = []
    } = options;

    try {
      // Get skills manifest via introspection
      const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {});

      if (!manifest || !manifest.skills || manifest.skills.length === 0) {
        return ''; // No skills available
      }

      let skills = manifest.skills;

      // Filter skills if requested
      if (includeOnly && Array.isArray(includeOnly)) {
        skills = skills.filter(s => includeOnly.includes(s.skill.name));
      }

      if (exclude && Array.isArray(exclude)) {
        skills = skills.filter(s => !exclude.includes(s.skill.name));
      }

      if (skills.length === 0) {
        return ''; // No skills after filtering
      }

      // Build context based on format
      const sections = [];

      sections.push('# FixiPlug Skills\n');
      sections.push('The following skills provide guidance on how to orchestrate FixiPlug tools effectively.\n');

      for (const { pluginName, skill } of skills) {
        sections.push(`\n## ${skill.name || pluginName}`);

        // Always include description
        if (skill.description) {
          sections.push(`\n${skill.description}\n`);
        }

        // Metadata format: just name and description
        if (format === 'metadata') {
          continue;
        }

        // Summary format: add tags and references
        if (format === 'summary' || format === 'full') {
          if (skill.tags && skill.tags.length > 0) {
            sections.push(`\n**Tags**: ${skill.tags.join(', ')}`);
          }

          if (skill.references && skill.references.length > 0) {
            sections.push(`\n**Related Plugins**: ${skill.references.join(', ')}`);
          }

          if (skill.level) {
            sections.push(`\n**Level**: ${skill.level}`);
          }
        }

        // Full format: include complete instructions
        if (format === 'full' && skill.instructions) {
          sections.push(`\n${skill.instructions}`);
        }
      }

      return sections.join('\n');

    } catch (error) {
      // If introspection fails, return empty string (graceful degradation)
      console.warn('Failed to retrieve skills context:', error);
      return '';
    }
  }

  /**
   * Get core Agent SDK tools
   *
   * @private
   * @returns {Array} Core tool definitions
   */
  _getCoreTools() {
    return [
      {
        name: 'discover_capabilities',
        description: 'Discover all FixiPlug capabilities. Use this FIRST to learn what plugins (modules) and hooks (events) are available. Returns: {version: "0.0.3", plugins: [{name: "introspectionPlugin", enabled: true, hooks: [...]}], hooks: {"api:introspect": {name, handlerCount, plugins, schema, description}}, methods: [{name: "use", description, params, returns}], timestamp: 1234567890}. Plugins extend FixiPlug by listening to hooks. Hooks are named events like "api:introspect" or "state:transition".',
        input_schema: {
          type: 'object',
          properties: {
            refresh: {
              type: 'boolean',
              description: 'Force refresh cached capabilities (default: false). Use true after plugins change or to bypass cache.'
            }
          }
        }
      },
      {
        name: 'check_capability',
        description: 'Check if a plugin or hook exists. Parameters: {capability: "introspectionPlugin"} or {capability: "api:introspect"}. Returns: boolean (true if capability exists). Faster than discover_capabilities when you only need to check one thing. Example: check_capability("api:setState") returns true if state tracker plugin is loaded.',
        input_schema: {
          type: 'object',
          properties: {
            capability: {
              type: 'string',
              description: 'Plugin name (e.g., "introspectionPlugin") or hook name (e.g., "api:introspect") to check'
            }
          },
          required: ['capability']
        }
      },
      {
        name: 'get_current_state',
        description: 'Get current application state from singleton state machine. Returns: {state: "loading", data: {progress: 50}, timestamp: 1234567890, age: 1500}. State is shared across all plugins. Age is milliseconds since last state change. Common states: "idle", "loading", "success", "error", "complete". Use this to understand what the app is currently doing.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'set_state',
        description: 'Change application state. Parameters: {state: "loading", metadata: {progress: 50}}. Metadata becomes data in state. Returns: {success: true, state: "loading", previousState: "idle", timestamp: 1234567890, transition: {from: "idle", to: "loading"}}. If state schema is registered, validates transitions. Error on invalid: {error: "Invalid transition: idle -> complete", validTransitions: ["loading"]}. Other plugins can listen to state changes via "state:transition" event.',
        input_schema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'State name to set. Common: "idle", "loading", "processing", "success", "error", "complete"'
            },
            metadata: {
              type: 'object',
              description: 'Optional data to attach to state (accessible via get_current_state().data)'
            }
          },
          required: ['state']
        }
      },
      {
        name: 'wait_for_state',
        description: 'Wait for state to change to target value. Useful for coordinating async operations. Parameters: {state: "complete", timeout: 30000}. Returns promise: {success: true, state: "complete", data: {...}, timestamp: 1234567890, waited: 2500}. Timeout error: {error: "Timeout waiting for state: complete", timeout: 30000, waited: 30000}. Default timeout: 30000ms. Example: Start async op with set_state("loading"), trigger work, then wait_for_state("complete").',
        input_schema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'State value to wait for (e.g., "complete", "success")'
            },
            timeout: {
              type: 'number',
              description: 'Max wait time in milliseconds. Default: 30000 (30 seconds)'
            }
          },
          required: ['state']
        }
      }
    ];
  }

  /**
   * Get workflow tools
   *
   * @private
   * @returns {Array} Workflow tool definitions
   */
  _getWorkflowTools() {
    return [
      {
        name: 'execute_workflow',
        description: 'Execute a multi-step workflow by dispatching hooks in sequence. Each step can access results from previous steps. Returns: {success: boolean, completed: ["step1", "step2"], results: {step1: {...}, step2: {...}}, errors: [{step, error, index}], stoppedAt?: "stepName"}. Example: [{name: "validate", hook: "api:getCurrentState", params: {}}, {name: "process", hook: "api:setState", params: {state: "loading"}}]. If stopOnError=false, continues after errors.',
        input_schema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              description: 'Array of workflow steps to execute sequentially. Each step dispatches a hook and stores results by name.',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Step name for tracking results (accessible in context.results.stepName)'
                  },
                  hook: {
                    type: 'string',
                    description: 'Hook name to dispatch (e.g., "api:getCurrentState", "api:setState")'
                  },
                  params: {
                    type: 'object',
                    description: 'Parameters object to pass to the hook. Can reference previous results.'
                  },
                  state: {
                    type: 'string',
                    description: 'Optional state to set before executing this step (e.g., "processing")'
                  }
                },
                required: ['name', 'hook']
              }
            },
            stopOnError: {
              type: 'boolean',
              description: 'Stop workflow on first error (true) or continue executing remaining steps (false). Default: true. Failed steps are recorded in errors array.'
            }
          },
          required: ['steps']
        }
      }
    ];
  }

  /**
   * Get cache management tools
   *
   * @private
   * @returns {Array} Cache tool definitions
   */
  _getCacheTools() {
    return [
      {
        name: 'warm_cache',
        description: 'Pre-load capabilities cache to improve performance of future discover_capabilities calls. Use this at session start or before running multiple capability checks. No parameters required. Returns: {version, plugins, hooks, methods, timestamp}. Makes discover_capabilities calls instant until cache expires (default: 5 minutes).',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'invalidate_cache',
        description: 'Clear capabilities cache to force fresh discovery on next call. Use when plugins are dynamically added/removed or you suspect stale data. No parameters required. Returns nothing. Performance impact: Next discover_capabilities will be slower as it must re-fetch. Example: After calling fixiplug.use(newPlugin), invalidate cache to see new capabilities.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_cache_info',
        description: 'Get cache metadata and status. No parameters required. Returns: {enabled: true, valid: boolean, hasData: boolean, timestamp: 1234567890, expiresAt: 1234872890, ttl: 300000, maxTTL: 300000}. Valid=true means cache is fresh. TTL is milliseconds until expiry. Use this to debug caching behavior.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Get plugin hook tools from introspection
   *
   * @private
   * @param {boolean} refresh - Force refresh capabilities
   * @returns {Promise<Array>} Plugin hook tool definitions
   */
  async _getPluginHookTools(refresh = false) {
    const capabilities = await this.agent.discover({ refresh });
    const tools = [];

    // Core hooks that are already covered by dedicated tools
    const coreHooks = new Set([
      'api:introspect',
      'api:getPluginCapabilities',
      'api:getAvailableHooks',
      'api:getPluginDetails',
      'api:getHookSchema',
      'api:getCurrentState',
      'api:setState',
      'api:waitForState',
      'api:registerStateSchema',
      'api:getCommonStates',
      'api:getStateHistory',
      'api:clearStateHistory'
    ]);

    // Convert each hook into a tool definition
    for (const [hookName, hookInfo] of Object.entries(capabilities.hooks)) {
      // Skip core hooks that are covered by dedicated tools
      if (coreHooks.has(hookName)) continue;

      const tool = {
        name: `hook_${hookName.replace(/:/g, '_')}`,
        description: hookInfo.description || hookInfo.schema?.description ||
                    `Execute the ${hookName} hook` +
                    (hookInfo.plugins?.length ? ` (provided by: ${hookInfo.plugins.join(', ')})` : ''),
        input_schema: {
          type: 'object',
          properties: hookInfo.schema?.parameters || {},
          required: []
        }
      };

      tools.push(tool);
    }

    return tools;
  }

  /**
   * Execute a tool by name
   *
   * @private
   * @param {string} name - Tool name
   * @param {Object} input - Tool input
   * @returns {Promise<Object>} Tool result
   */
  async _executeTool(name, input) {
    switch (name) {
      // Core tools
      case 'discover_capabilities':
        return await this.agent.discover({ refresh: input.refresh });

      case 'check_capability':
        return { available: await this.agent.hasCapability(input.capability) };

      case 'get_current_state':
        return await this.agent.getCurrentState();

      case 'set_state':
        return await this.agent.setState(input.state, input.metadata);

      case 'wait_for_state':
        return await this.agent.waitForState(input.state, { timeout: input.timeout });

      // Workflow tools
      case 'execute_workflow':
        return await this.agent.executeWorkflow(input.steps, {
          stopOnError: input.stopOnError
        });

      // Cache tools
      case 'warm_cache':
        return await this.agent.warmCache();

      case 'invalidate_cache':
        this.agent.invalidateCache();
        return { success: true, message: 'Cache invalidated' };

      case 'get_cache_info':
        return this.agent.getCacheInfo();

      // Plugin hooks
      default:
        // Check if it's a hook tool
        if (name.startsWith('hook_')) {
          const hookName = name.substring(5).replace(/_/g, ':');
          const result = await this.agent.fixi.dispatch(hookName, input);
          if (result.error) {
            throw new Error(result.error);
          }
          return result;
        }

        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

/**
 * Export default for convenience
 */
export default AnthropicAdapter;
