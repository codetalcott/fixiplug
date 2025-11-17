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
      includePluginHooks: options.includePluginHooks || false
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
   * Get core Agent SDK tools
   *
   * @private
   * @returns {Array} Core tool definitions
   */
  _getCoreTools() {
    return [
      {
        name: 'discover_capabilities',
        description: 'Discover available capabilities, plugins, and hooks from the FixiPlug instance. Use this first to understand what\'s available.',
        input_schema: {
          type: 'object',
          properties: {
            refresh: {
              type: 'boolean',
              description: 'Force refresh cached capabilities (default: false)'
            }
          }
        }
      },
      {
        name: 'check_capability',
        description: 'Check if a specific capability (plugin or hook) is available',
        input_schema: {
          type: 'object',
          properties: {
            capability: {
              type: 'string',
              description: 'Name of the capability to check (plugin name or hook name)'
            }
          },
          required: ['capability']
        }
      },
      {
        name: 'get_current_state',
        description: 'Get the current application state',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'set_state',
        description: 'Set the application state',
        input_schema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'The state to set (e.g., "loading", "processing", "complete")'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata to include with state change'
            }
          },
          required: ['state']
        }
      },
      {
        name: 'wait_for_state',
        description: 'Wait for the application to reach a specific state',
        input_schema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'The state to wait for'
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 5000)'
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
        description: 'Execute a multi-step workflow with automatic state management and error handling',
        input_schema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              description: 'Array of workflow steps to execute',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Step name for result tracking'
                  },
                  hook: {
                    type: 'string',
                    description: 'Hook to dispatch for this step'
                  },
                  params: {
                    type: 'object',
                    description: 'Parameters to pass to the hook'
                  },
                  state: {
                    type: 'string',
                    description: 'Optional state to set before executing this step'
                  }
                },
                required: ['name', 'hook']
              }
            },
            stopOnError: {
              type: 'boolean',
              description: 'Whether to stop workflow on first error (default: true)'
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
        description: 'Warm the capabilities cache by performing an initial discovery. Use at startup for better performance.',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'invalidate_cache',
        description: 'Invalidate the capabilities cache, forcing the next discovery to fetch fresh data',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_cache_info',
        description: 'Get information about the current cache state',
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

    // Convert each hook into a tool definition
    for (const [hookName, hookInfo] of Object.entries(capabilities.hooks)) {
      // Skip API hooks (they're covered by core tools)
      if (hookName.startsWith('api:')) continue;

      const tool = {
        name: `hook_${hookName.replace(/:/g, '_')}`,
        description: hookInfo.schema?.description ||
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
