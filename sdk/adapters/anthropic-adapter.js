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

import { BaseAdapter } from './base-adapter.js';
import { toAnthropic } from './tool-definitions.js';

/**
 * Anthropic Adapter for FixiPlug Agent SDK
 *
 * @class AnthropicAdapter
 * @extends BaseAdapter
 */
export class AnthropicAdapter extends BaseAdapter {
  /**
   * Create a new Anthropic adapter
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
    return 'Anthropic';
  }

  /**
   * Convert a format-agnostic tool to Anthropic format
   * @param {Object} tool - Tool definition
   * @returns {Object} Anthropic-formatted tool
   */
  _formatTool(tool) {
    return toAnthropic(tool);
  }

  // ============================================================
  // Backward Compatibility: useHistory
  // ============================================================

  /**
   * Get tool use history (backward compatible alias)
   * @returns {Array} Array of tool use records
   */
  get useHistory() {
    return this._history;
  }

  /**
   * Set tool use history (backward compatible)
   * @param {Array} value
   */
  set useHistory(value) {
    this._history = value;
  }

  /**
   * Get tool use history
   * @returns {Array} Array of tool use records
   */
  getUseHistory() {
    return this.getHistory();
  }

  /**
   * Clear tool use history
   */
  clearUseHistory() {
    this.clearHistory();
  }

  // ============================================================
  // Anthropic-Specific Methods
  // ============================================================

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
      const result = await this._executeByName(name, input);
      useRecord.result = result;
      useRecord.success = true;
      this._addToHistory(useRecord);
      return result;
    } catch (error) {
      useRecord.error = error.message;
      useRecord.success = false;
      this._addToHistory(useRecord);
      throw error;
    }
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
   * Create a tool result message from an error
   *
   * @param {string} toolUseId - The tool use ID
   * @param {Error|string} error - The error
   * @returns {Object} Anthropic-compatible error tool result
   *
   * @example
   * try {
   *   const result = await adapter.executeToolUse(toolUse);
   *   toolResults.push(adapter.createToolResult(toolUse.id, result));
   * } catch (error) {
   *   toolResults.push(adapter.createErrorResult(toolUse.id, error));
   * }
   */
  createErrorResult(toolUseId, error) {
    const message = error instanceof Error ? error.message : String(error);
    return this.createToolResult(
      toolUseId,
      { error: message },
      true
    );
  }
}

/**
 * Export default for convenience
 */
export default AnthropicAdapter;
