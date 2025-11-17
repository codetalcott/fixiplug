/**
 * OpenAI Adapter for FixiPlug Agent SDK
 *
 * Provides integration between FixiPlug Agent SDK and OpenAI's function calling API.
 * Converts Agent SDK capabilities into OpenAI function definitions and handles
 * function call execution.
 *
 * @module sdk/adapters/openai-adapter
 * @example
 * import { OpenAIAdapter } from './sdk/adapters/openai-adapter.js';
 * import { FixiPlugAgent } from './sdk/agent-client.js';
 *
 * const agent = new FixiPlugAgent(fixiplug);
 * const adapter = new OpenAIAdapter(agent);
 *
 * // Get OpenAI-compatible function definitions
 * const tools = await adapter.getToolDefinitions();
 *
 * // Handle OpenAI function call
 * const result = await adapter.executeFunctionCall({
 *   name: 'discover_capabilities',
 *   arguments: '{}'
 * });
 */

/**
 * OpenAI Adapter for FixiPlug Agent SDK
 *
 * @class OpenAIAdapter
 */
export class OpenAIAdapter {
  /**
   * Create a new OpenAI adapter
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
      throw new Error('OpenAIAdapter requires a FixiPlugAgent instance');
    }

    this.agent = agent;
    this.options = {
      includeCoreTools: options.includeCoreTools !== false,
      includeWorkflowTools: options.includeWorkflowTools !== false,
      includeCacheTools: options.includeCacheTools !== false,
      includePluginHooks: options.includePluginHooks || false
    };

    // Track function call history
    this.callHistory = [];
  }

  /**
   * Get OpenAI-compatible tool definitions (OpenAI tools format)
   *
   * @param {Object} [options={}] - Generation options
   * @param {boolean} [options.refresh=false] - Force refresh capabilities
   * @returns {Promise<Array>} Array of OpenAI tool definitions
   *
   * @example
   * const tools = await adapter.getToolDefinitions();
   * // Use with OpenAI API
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4',
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
   * Get OpenAI-compatible function definitions (legacy functions format)
   *
   * @param {Object} [options={}] - Generation options
   * @returns {Promise<Array>} Array of OpenAI function definitions
   *
   * @example
   * const functions = await adapter.getFunctionDefinitions();
   * // Use with OpenAI API (legacy format)
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-3.5-turbo',
   *   messages: [...],
   *   functions: functions
   * });
   */
  async getFunctionDefinitions(options = {}) {
    const tools = await this.getToolDefinitions(options);
    // Convert tools format to functions format
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));
  }

  /**
   * Execute an OpenAI function call
   *
   * @param {Object} functionCall - OpenAI function call object
   * @param {string} functionCall.name - Function name
   * @param {string} functionCall.arguments - JSON string of arguments
   * @returns {Promise<Object>} Function execution result
   *
   * @example
   * // Handle OpenAI function call
   * const toolCall = response.choices[0].message.tool_calls[0];
   * const result = await adapter.executeFunctionCall({
   *   name: toolCall.function.name,
   *   arguments: toolCall.function.arguments
   * });
   */
  async executeFunctionCall(functionCall) {
    const { name, arguments: argsStr } = functionCall;

    // Parse arguments
    let args;
    try {
      args = JSON.parse(argsStr || '{}');
    } catch (error) {
      return {
        error: 'Invalid function arguments',
        message: `Failed to parse arguments: ${error.message}`
      };
    }

    // Record call
    const callRecord = {
      name,
      arguments: args,
      timestamp: Date.now()
    };

    try {
      const result = await this._executeFunction(name, args);
      callRecord.result = result;
      callRecord.success = true;
      this.callHistory.push(callRecord);
      return result;
    } catch (error) {
      callRecord.error = error.message;
      callRecord.success = false;
      this.callHistory.push(callRecord);
      throw error;
    }
  }

  /**
   * Execute a tool call (OpenAI tools format)
   *
   * @param {Object} toolCall - OpenAI tool call object
   * @returns {Promise<Object>} Tool execution result
   *
   * @example
   * const toolCall = response.choices[0].message.tool_calls[0];
   * const result = await adapter.executeToolCall(toolCall);
   */
  async executeToolCall(toolCall) {
    return await this.executeFunctionCall({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments
    });
  }

  /**
   * Get function call history
   *
   * @returns {Array} Array of function call records
   *
   * @example
   * const history = adapter.getCallHistory();
   * console.log('Total calls:', history.length);
   * console.log('Successful:', history.filter(c => c.success).length);
   */
  getCallHistory() {
    return [...this.callHistory];
  }

  /**
   * Clear function call history
   */
  clearCallHistory() {
    this.callHistory = [];
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
        type: 'function',
        function: {
          name: 'discover_capabilities',
          description: 'Discover available capabilities, plugins, and hooks from the FixiPlug instance. Use this first to understand what\'s available.',
          parameters: {
            type: 'object',
            properties: {
              refresh: {
                type: 'boolean',
                description: 'Force refresh cached capabilities (default: false)'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_capability',
          description: 'Check if a specific capability (plugin or hook) is available',
          parameters: {
            type: 'object',
            properties: {
              capability: {
                type: 'string',
                description: 'Name of the capability to check (plugin name or hook name)'
              }
            },
            required: ['capability']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_current_state',
          description: 'Get the current application state',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'set_state',
          description: 'Set the application state',
          parameters: {
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
        }
      },
      {
        type: 'function',
        function: {
          name: 'wait_for_state',
          description: 'Wait for the application to reach a specific state',
          parameters: {
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
        type: 'function',
        function: {
          name: 'execute_workflow',
          description: 'Execute a multi-step workflow with automatic state management and error handling',
          parameters: {
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
        type: 'function',
        function: {
          name: 'warm_cache',
          description: 'Warm the capabilities cache by performing an initial discovery. Use at startup for better performance.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'invalidate_cache',
          description: 'Invalidate the capabilities cache, forcing the next discovery to fetch fresh data',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_cache_info',
          description: 'Get information about the current cache state',
          parameters: {
            type: 'object',
            properties: {}
          }
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
        type: 'function',
        function: {
          name: `hook_${hookName.replace(/:/g, '_')}`,
          description: hookInfo.schema?.description ||
                      `Execute the ${hookName} hook` +
                      (hookInfo.plugins?.length ? ` (provided by: ${hookInfo.plugins.join(', ')})` : ''),
          parameters: {
            type: 'object',
            properties: hookInfo.schema?.parameters || {},
            required: []
          }
        }
      };

      tools.push(tool);
    }

    return tools;
  }

  /**
   * Execute a function by name
   *
   * @private
   * @param {string} name - Function name
   * @param {Object} args - Function arguments
   * @returns {Promise<Object>} Function result
   */
  async _executeFunction(name, args) {
    switch (name) {
      // Core tools
      case 'discover_capabilities':
        return await this.agent.discover({ refresh: args.refresh });

      case 'check_capability':
        return { available: await this.agent.hasCapability(args.capability) };

      case 'get_current_state':
        return await this.agent.getCurrentState();

      case 'set_state':
        return await this.agent.setState(args.state, args.metadata);

      case 'wait_for_state':
        return await this.agent.waitForState(args.state, { timeout: args.timeout });

      // Workflow tools
      case 'execute_workflow':
        return await this.agent.executeWorkflow(args.steps, {
          stopOnError: args.stopOnError
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
        // Check if it's a hook function
        if (name.startsWith('hook_')) {
          const hookName = name.substring(5).replace(/_/g, ':');
          const result = await this.agent.fixi.dispatch(hookName, args);
          if (result.error) {
            throw new Error(result.error);
          }
          return result;
        }

        throw new Error(`Unknown function: ${name}`);
    }
  }

  /**
   * Create a message for OpenAI from a function result
   *
   * @param {Object} toolCall - The tool call object
   * @param {Object} result - The function execution result
   * @returns {Object} OpenAI-compatible message object
   *
   * @example
   * const message = adapter.createToolMessage(toolCall, result);
   * messages.push(message);
   */
  createToolMessage(toolCall, result) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    };
  }

  /**
   * Create a message for OpenAI from a function result (legacy format)
   *
   * @param {string} functionName - The function name
   * @param {Object} result - The function execution result
   * @returns {Object} OpenAI-compatible message object
   */
  createFunctionMessage(functionName, result) {
    return {
      role: 'function',
      name: functionName,
      content: JSON.stringify(result)
    };
  }
}

/**
 * Export default for convenience
 */
export default OpenAIAdapter;
