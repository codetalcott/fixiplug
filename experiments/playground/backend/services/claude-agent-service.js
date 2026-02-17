/**
 * Claude Agent SDK Service
 *
 * Integration service for Anthropic's Claude Agent SDK
 * Provides full Claude Code capabilities including:
 * - Agentic tool execution (file ops, bash, web search)
 * - Automatic context management
 * - Session management and resumption
 * - Streaming query API
 * - Built-in permission system
 *
 * @module playground/backend/services/claude-agent-service
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Claude Agent Service
 *
 * Handles interactions with Claude Agent SDK
 */
export class ClaudeAgentService {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'claude-haiku-4-5-20251001',  // Default to Haiku 4.5 (fastest)
      cwd: config.cwd || process.cwd(),
      mcpServer: config.mcpServer || null,  // SDK MCP server (e.g., FixiPlug tools)
      ...config
    };

    this.sessions = new Map();
    this.initialized = true;
  }

  /**
   * Check if service is available
   *
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.config.apiKey;
  }

  /**
   * Execute a query using Claude Agent SDK
   *
   * @param {Object} options - Query options
   * @param {string} options.prompt - User prompt
   * @param {string} [options.sessionId] - Session ID for continuity
   * @param {boolean} [options.stream=true] - Enable streaming
   * @param {string} [options.permissionMode='default'] - Permission mode
   * @param {Array} [options.allowedTools] - Allowed tools
   * @param {Array} [options.disallowedTools] - Disallowed tools
   * @param {Object} [options.env] - Environment variables
   * @returns {AsyncGenerator} Message stream
   */
  async *executeQuery(options) {
    const {
      prompt,
      sessionId,
      stream = true,
      permissionMode = 'default',
      allowedTools,
      disallowedTools,
      env
    } = options;

    // Build query options
    const queryOptions = {
      model: this.config.model,
      cwd: this.config.cwd,
      permissionMode,
      includePartialMessages: stream
    };

    // Add API key
    if (this.config.apiKey) {
      queryOptions.apiKey = this.config.apiKey;
    }

    // Add tool permissions
    if (allowedTools) {
      queryOptions.allowedTools = allowedTools;
    }

    if (disallowedTools) {
      queryOptions.disallowedTools = disallowedTools;
    }

    // Add environment variables
    if (env) {
      queryOptions.env = env;
    }

    // Add MCP servers
    if (this.config.mcpServer) {
      queryOptions.mcpServers = {
        "fixiplug": this.config.mcpServer
      };
      console.log('Added FixiPlug MCP server to query options');
    }

    // Handle session resumption
    if (sessionId && this.sessions.has(sessionId)) {
      queryOptions.resume = this.sessions.get(sessionId);
    }

    try {
      // Execute query with correct API signature (single object parameter)
      const queryGen = query({
        prompt,
        // @ts-ignore - queryOptions has additional properties beyond base Options type
        options: queryOptions
      });

      // Stream messages
      for await (const message of queryGen) {
        yield message;

        // Save session ID for resumption
        if (message.type === 'system' && message.session_id) {
          if (sessionId) {
            this.sessions.set(sessionId, message.session_id);
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: {
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Execute a single (non-streaming) query
   *
   * @param {Object} options - Query options
   * @returns {Promise<Array>} All messages
   */
  async executeSingleQuery(options) {
    const messages = [];

    for await (const message of this.executeQuery({ ...options, stream: true })) {
      messages.push(message);
    }

    return messages;
  }

  /**
   * Get active session
   *
   * @param {string} sessionId - Session ID
   * @returns {string|undefined} Internal session ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Clear session
   *
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    this.sessions.clear();
  }

  /**
   * Get session count
   *
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }
}

export default ClaudeAgentService;
