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

import { BaseAdapter } from './base-adapter.js';
import { toOpenAI } from './tool-definitions.js';

/**
 * OpenAI Adapter for FixiPlug Agent SDK
 *
 * @class OpenAIAdapter
 * @extends BaseAdapter
 */
export class OpenAIAdapter extends BaseAdapter {
  /**
   * Create a new OpenAI adapter
   *
   * @param {Object} agent - FixiPlugAgent instance
   * @param {Object} [options={}] - Adapter options
   * @param {boolean} [options.includeCoreTools=true] - Include core Agent SDK tools
   * @param {boolean} [options.includeWorkflowTools=true] - Include workflow tools
   * @param {boolean} [options.includeCacheTools=true] - Include cache management tools
   * @param {boolean} [options.includePluginHooks=false] - Include discovered plugin hooks
   * @param {boolean} [options.includeSkills=false] - Include skills in context generation (deprecated - use skillStrategy)
   * @param {string} [options.skillStrategy='dynamic'] - Skill loading strategy: 'dynamic' (on-demand via tool), 'static' (all in context), 'none' (disabled)
   */
  constructor(agent, options = {}) {
    super(agent, options);
  }

  /**
   * Get provider name for error messages
   * @returns {string}
   */
  get providerName() {
    return 'OpenAI';
  }

  /**
   * Convert a format-agnostic tool to OpenAI format
   * @param {Object} tool - Tool definition
   * @returns {Object} OpenAI-formatted tool
   */
  _formatTool(tool) {
    return toOpenAI(tool);
  }

  // ============================================================
  // Backward Compatibility: callHistory
  // ============================================================

  /**
   * Get function call history (backward compatible alias)
   * @returns {Array} Array of function call records
   */
  get callHistory() {
    return this._history;
  }

  /**
   * Set function call history (backward compatible)
   * @param {Array} value
   */
  set callHistory(value) {
    this._history = value;
  }

  /**
   * Get function call history
   * @returns {Array} Array of function call records
   */
  getCallHistory() {
    return this.getHistory();
  }

  /**
   * Clear function call history
   */
  clearCallHistory() {
    this.clearHistory();
  }

  // ============================================================
  // OpenAI-Specific Methods
  // ============================================================

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
   * const toolCall = response.choices[0].message.tool_calls[0];
   * const result = await adapter.executeFunctionCall({
   *   name: toolCall.function.name,
   *   arguments: toolCall.function.arguments
   * });
   */
  async executeFunctionCall(functionCall) {
    if (!functionCall || typeof functionCall !== 'object') {
      throw new Error('executeFunctionCall() requires a function call object');
    }

    const { name, arguments: argsStr } = functionCall;

    if (!name) {
      throw new Error('Function call object must have a name');
    }

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
      const result = await this._executeByName(name, args);
      callRecord.result = result;
      callRecord.success = true;
      this._addToHistory(callRecord);
      return result;
    } catch (error) {
      callRecord.error = error.message;
      callRecord.success = false;
      this._addToHistory(callRecord);
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
    if (!toolCall?.function?.name) {
      throw new Error('executeToolCall() requires a tool call object with function.name');
    }

    return await this.executeFunctionCall({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments
    });
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
