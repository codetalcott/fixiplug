/**
 * Format-agnostic tool definitions for LLM adapters
 * Store once, convert to provider-specific format on-the-fly
 * @module sdk/adapters/tool-definitions
 */

/**
 * Core Agent SDK tools (discover, state, etc.)
 */
export const CORE_TOOLS = [
  {
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
  },
  {
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
  },
  {
    name: 'get_current_state',
    description: 'Get the current application state',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
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
  },
  {
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
];

/**
 * Workflow tools
 */
export const WORKFLOW_TOOLS = [
  {
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
];

/**
 * Cache management tools
 */
export const CACHE_TOOLS = [
  {
    name: 'warm_cache',
    description: 'Warm the capabilities cache by performing an initial discovery. Use at startup for better performance.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'invalidate_cache',
    description: 'Invalidate the capabilities cache, forcing the next discovery to fetch fresh data',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_cache_info',
    description: 'Get information about the current cache state',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Skill retrieval tool template (skills list injected at runtime)
 */
export const SKILL_RETRIEVAL_TOOL = {
  name: 'retrieve_skill',
  description: 'Retrieve workflow guides and best practices for FixiPlug integrations. Use when you need domain-specific implementation patterns (Django, error handling, forms, reactive UI). Returns complete skill instructions.',
  // Note: parameters.properties.skill_name.enum is populated at runtime with available skills
  parameters: {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'Name of the skill guide to retrieve'
      }
    },
    required: ['skill_name']
  }
};

// ============================================================
// Format Converters
// ============================================================

/**
 * Convert a format-agnostic tool definition to OpenAI format
 * @param {Object} tool - Tool definition
 * @returns {Object} OpenAI-formatted tool
 */
export function toOpenAI(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}

/**
 * Convert a format-agnostic tool definition to Anthropic format
 * @param {Object} tool - Tool definition
 * @returns {Object} Anthropic-formatted tool
 */
export function toAnthropic(tool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  };
}

/**
 * Convert an array of tools to OpenAI format
 * @param {Array} tools - Array of tool definitions
 * @returns {Array} OpenAI-formatted tools
 */
export function toOpenAIArray(tools) {
  return tools.map(toOpenAI);
}

/**
 * Convert an array of tools to Anthropic format
 * @param {Array} tools - Array of tool definitions
 * @returns {Array} Anthropic-formatted tools
 */
export function toAnthropicArray(tools) {
  return tools.map(toAnthropic);
}

/**
 * Create a skill retrieval tool with available skills populated
 * @param {Array<string>} availableSkills - List of available skill names
 * @returns {Object} Skill retrieval tool with enum populated
 */
export function createSkillRetrievalTool(availableSkills) {
  return {
    ...SKILL_RETRIEVAL_TOOL,
    parameters: {
      ...SKILL_RETRIEVAL_TOOL.parameters,
      properties: {
        skill_name: {
          ...SKILL_RETRIEVAL_TOOL.parameters.properties.skill_name,
          enum: availableSkills
        }
      }
    }
  };
}

/**
 * Create a plugin hook tool definition
 * @param {string} hookName - Original hook name (e.g., 'api:getData')
 * @param {Object} hookInfo - Hook metadata
 * @returns {Object} Tool definition
 */
export function createHookTool(hookName, hookInfo) {
  return {
    name: `hook_${hookName.replace(/:/g, '_')}`,
    description: hookInfo.description || hookInfo.schema?.description ||
                `Execute the ${hookName} hook` +
                (hookInfo.plugins?.length ? ` (provided by: ${hookInfo.plugins.join(', ')})` : ''),
    parameters: {
      type: 'object',
      properties: hookInfo.schema?.parameters || {},
      required: []
    }
  };
}

/**
 * Core hooks that should be skipped when generating hook tools
 * (already covered by dedicated core tools)
 */
export const CORE_HOOKS_TO_SKIP = new Set([
  'api:getCapabilities',
  'api:getAvailablePlugins',
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
