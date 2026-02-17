/**
 * Base Adapter for FixiPlug Agent SDK
 *
 * Provides shared functionality for LLM provider adapters.
 * Subclasses implement provider-specific tool formatting and message creation.
 *
 * @module sdk/adapters/base-adapter
 */

import {
  CORE_TOOLS,
  WORKFLOW_TOOLS,
  CACHE_TOOLS,
  CORE_HOOKS_TO_SKIP,
  createSkillRetrievalTool,
  createHookTool
} from './tool-definitions.js';

/**
 * Base adapter with shared logic for all LLM providers
 * @abstract
 */
export class BaseAdapter {
  /**
   * Create a new adapter
   *
   * @param {Object} agent - FixiPlugAgent instance
   * @param {Object} [options={}] - Adapter options
   * @param {boolean} [options.includeCoreTools=true] - Include core Agent SDK tools
   * @param {boolean} [options.includeWorkflowTools=true] - Include workflow tools
   * @param {boolean} [options.includeCacheTools=true] - Include cache management tools
   * @param {boolean} [options.includePluginHooks=false] - Include discovered plugin hooks
   * @param {boolean} [options.includeSkills=false] - Include skills in context (deprecated)
   * @param {string} [options.skillStrategy='dynamic'] - Skill loading strategy
   * @param {number} [options.skillCacheTTL=600000] - Skill cache TTL in ms (default: 10 minutes)
   * @param {number} [options.skillCacheMaxSize=50] - Maximum number of cached skills
   */
  constructor(agent, options = {}) {
    if (!agent) {
      throw new Error(`${this.constructor.name} requires a FixiPlugAgent instance`);
    }

    this.agent = agent;
    this.options = this._normalizeOptions(options);

    // Skill retrieval cache (per-conversation) with TTL support
    this._skillCache = new Map();
    this._skillCacheTimestamps = new Map();

    // History tracking (subclasses may use callHistory or useHistory)
    this._history = [];
  }

  /**
   * Normalize constructor options with defaults
   * @private
   * @param {Object} options - Raw options
   * @returns {Object} Normalized options
   */
  _normalizeOptions(options) {
    return {
      includeCoreTools: options.includeCoreTools !== false,
      includeWorkflowTools: options.includeWorkflowTools !== false,
      includeCacheTools: options.includeCacheTools !== false,
      includePluginHooks: options.includePluginHooks || false,
      includeSkills: options.includeSkills || false,
      skillStrategy: options.skillStrategy || 'dynamic',
      skillCacheTTL: options.skillCacheTTL || 600000,    // 10 minutes
      skillCacheMaxSize: options.skillCacheMaxSize || 50
    };
  }

  // ============================================================
  // Abstract Methods (must be implemented by subclasses)
  // ============================================================

  /**
   * Convert a format-agnostic tool definition to provider format
   * @abstract
   * @param {Object} tool - Tool definition
   * @returns {Object} Provider-formatted tool
   */
  _formatTool(tool) {
    throw new Error('Subclass must implement _formatTool()');
  }

  /**
   * Get the provider name (for error messages)
   * @abstract
   * @returns {string} Provider name
   */
  get providerName() {
    throw new Error('Subclass must implement providerName getter');
  }

  // ============================================================
  // Shared Tool Definition Methods
  // ============================================================

  /**
   * Get tool definitions in provider-specific format
   *
   * @param {Object} [options={}] - Generation options
   * @param {boolean} [options.refresh=false] - Force refresh capabilities
   * @returns {Promise<Array>} Array of provider-formatted tool definitions
   */
  async getToolDefinitions(options = {}) {
    const tools = [];

    // Core Agent SDK tools
    if (this.options.includeCoreTools) {
      tools.push(...CORE_TOOLS.map(t => this._formatTool(t)));
    }

    // Workflow tools
    if (this.options.includeWorkflowTools) {
      tools.push(...WORKFLOW_TOOLS.map(t => this._formatTool(t)));
    }

    // Cache management tools
    if (this.options.includeCacheTools) {
      tools.push(...CACHE_TOOLS.map(t => this._formatTool(t)));
    }

    // Skill retrieval tool (dynamic strategy)
    if (this.options.skillStrategy === 'dynamic') {
      const skillTool = await this._getSkillRetrievalTool();
      if (skillTool) {
        tools.push(skillTool);
      }
    }

    // Plugin hook tools
    if (this.options.includePluginHooks) {
      const pluginTools = await this._getPluginHookTools(options.refresh);
      tools.push(...pluginTools);
    }

    return tools;
  }

  /**
   * Get list of available skill names
   * @protected
   * @returns {Promise<Array<string>>} Array of skill names
   */
  async _getAvailableSkillNames() {
    try {
      const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {});

      if (!manifest || !manifest.skills) {
        return [];
      }

      return manifest.skills
        .filter(s => s && s.skill)
        .map(s => s.skill.name)
        .filter(name => typeof name === 'string' && name.length > 0);
    } catch (error) {
      console.warn('Failed to get skill names:', error);
      return [];
    }
  }

  /**
   * Get skill retrieval tool in provider format
   * @protected
   * @returns {Promise<Object|null>} Skill retrieval tool or null
   */
  async _getSkillRetrievalTool() {
    const availableSkills = await this._getAvailableSkillNames();

    if (availableSkills.length === 0) {
      return null;
    }

    const tool = createSkillRetrievalTool(availableSkills);
    return this._formatTool(tool);
  }

  /**
   * Get plugin hook tools in provider format
   * @protected
   * @param {boolean} [refresh=false] - Force refresh capabilities
   * @returns {Promise<Array>} Plugin hook tool definitions
   */
  async _getPluginHookTools(refresh = false) {
    const capabilities = await this.agent.discover({ refresh });
    const tools = [];

    for (const [hookName, hookInfo] of Object.entries(capabilities.hooks)) {
      // Skip hooks covered by core tools
      if (hookName.startsWith('api:') || CORE_HOOKS_TO_SKIP.has(hookName)) {
        continue;
      }

      const tool = createHookTool(hookName, hookInfo);
      tools.push(this._formatTool(tool));
    }

    return tools;
  }

  // ============================================================
  // Shared Skills Context Methods
  // ============================================================

  /**
   * Get formatted skills context for inclusion in system messages
   *
   * @param {Object} [options={}] - Context options
   * @param {string} [options.format='full'] - Format: 'full', 'summary', 'metadata'
   * @param {Array<string>} [options.includeOnly=null] - Only include these skills
   * @param {Array<string>} [options.exclude=[]] - Exclude these skills
   * @returns {Promise<string>} Formatted skills context as markdown
   */
  async getSkillsContext(options = {}) {
    const {
      format = 'full',
      includeOnly = null,
      exclude = []
    } = options;

    try {
      const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {});

      if (!manifest || !manifest.skills || manifest.skills.length === 0) {
        return '';
      }

      let skills = manifest.skills;

      // Filter skills if requested
      if (includeOnly && Array.isArray(includeOnly)) {
        skills = skills.filter(s => s.skill?.name && includeOnly.includes(s.skill.name));
      }

      if (exclude && Array.isArray(exclude)) {
        skills = skills.filter(s => !s.skill?.name || !exclude.includes(s.skill.name));
      }

      if (skills.length === 0) {
        return '';
      }

      // Build context based on format
      const sections = [];

      sections.push('# FixiPlug Skills\n');
      sections.push('The following skills provide guidance on how to orchestrate FixiPlug tools effectively.\n');

      for (const { pluginName, skill } of skills) {
        sections.push(`\n## ${skill.name || pluginName}`);

        if (skill.description) {
          sections.push(`\n${skill.description}\n`);
        }

        if (format === 'metadata') {
          continue;
        }

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

        if (format === 'full' && skill.instructions) {
          sections.push(`\n${skill.instructions}`);
        }
      }

      return sections.join('\n');

    } catch (error) {
      console.warn('Failed to retrieve skills context:', error);
      return '';
    }
  }

  // ============================================================
  // Shared Execution Methods
  // ============================================================

  /**
   * Execute skill retrieval with caching
   * @protected
   * @param {Object} args - Arguments with skill_name
   * @returns {Promise<Object>} Skill data or error
   */
  async _executeSkillRetrieval(args) {
    const { skill_name } = args;

    if (!skill_name) {
      return {
        success: false,
        error: 'skill_name parameter required'
      };
    }

    // Check cache first (with TTL)
    const cacheKey = `skill:${skill_name}`;
    if (this._skillCache.has(cacheKey)) {
      const cachedAt = this._skillCacheTimestamps.get(cacheKey) || 0;
      if (Date.now() - cachedAt < this.options.skillCacheTTL) {
        return this._skillCache.get(cacheKey);
      }
      // Expired - remove stale entry
      this._skillCache.delete(cacheKey);
      this._skillCacheTimestamps.delete(cacheKey);
    }

    try {
      const result = await this.agent.fixi.dispatch('api:getSkill', {
        skillName: skill_name
      });

      if (!result.success) {
        return result;
      }

      const response = {
        success: true,
        skill_name: result.skill.name,
        description: result.skill.description,
        instructions: result.skill.instructions,
        tags: result.skill.tags || [],
        references: result.skill.references || [],
        level: result.skill.level || 'intermediate',
        metadata: {
          plugin: result.pluginName,
          version: result.skill.version || '1.0',
          author: result.skill.author || 'FixiPlug Team'
        }
      };

      // Evict oldest entry if cache is full
      if (this._skillCache.size >= this.options.skillCacheMaxSize) {
        const oldestKey = this._skillCache.keys().next().value;
        this._skillCache.delete(oldestKey);
        this._skillCacheTimestamps.delete(oldestKey);
      }

      this._skillCache.set(cacheKey, response);
      this._skillCacheTimestamps.set(cacheKey, Date.now());
      return response;

    } catch (error) {
      return {
        success: false,
        error: `Skill retrieval failed: ${error.message}`
      };
    }
  }

  /**
   * Execute a tool/function by name (shared switch logic)
   * @protected
   * @param {string} name - Tool/function name
   * @param {Object} args - Arguments
   * @returns {Promise<Object>} Result
   */
  async _executeByName(name, args) {
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

      // Skill retrieval
      case 'retrieve_skill':
        return await this._executeSkillRetrieval(args);

      // Plugin hooks
      default:
        if (name.startsWith('hook_')) {
          const hookName = name.substring(5).replace(/_/g, ':');
          const result = await this.agent.fixi.dispatch(hookName, args);
          if (result.error) {
            throw new Error(result.error);
          }
          return result;
        }

        throw new Error(`Unknown function/tool: ${name}`);
    }
  }

  // ============================================================
  // Shared History Methods
  // ============================================================

  /**
   * Get execution history
   * @returns {Array} Copy of history array
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this._history.length = 0;
  }

  /**
   * Add a record to history
   * @protected
   * @param {Object} record - History record
   */
  _addToHistory(record) {
    this._history.push(record);
  }

  /**
   * Clear the skill cache
   */
  clearSkillCache() {
    this._skillCache.clear();
    this._skillCacheTimestamps.clear();
  }
}

export default BaseAdapter;
