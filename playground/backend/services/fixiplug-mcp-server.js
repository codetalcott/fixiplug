/**
 * FixiPlug SDK MCP Server
 *
 * Exposes FixiPlug Agent SDK tools as an in-process MCP server
 * for use with Claude Agent SDK.
 *
 * @module playground/backend/services/fixiplug-mcp-server
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Create FixiPlug SDK MCP Server
 *
 * @param {Object} agent - FixiPlugAgent instance
 * @param {Object} anthropicAdapter - AnthropicAdapter instance
 * @returns {Promise<Object>} SDK MCP server
 */
export async function createFixiPlugMcpServer(agent, anthropicAdapter) {
  // Get tool definitions from the Anthropic adapter
  const toolDefs = anthropicAdapter.getToolDefinitions ?
    await anthropicAdapter.getToolDefinitions() :
    [];

  console.log(`Creating FixiPlug MCP server with ${toolDefs.length} tools`);

  const tools = toolDefs.map(toolDef => {
    // Convert Anthropic tool schema to Zod schema
    const zodSchema = convertAnthropicSchemaToZod(toolDef.input_schema);

    return tool(
      toolDef.name,
      toolDef.description,
      zodSchema,
      async (args) => {
        try {
          console.log(`Executing FixiPlug tool: ${toolDef.name}`, args);

          // Execute via Anthropic adapter
          const result = await anthropicAdapter.executeToolUse({
            name: toolDef.name,
            input: args
          });

          // Return in Claude Agent SDK format
          return {
            content: [{
              type: "text",
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error(`FixiPlug tool error (${toolDef.name}):`, error);
          return {
            content: [{
              type: "text",
              text: `Error: ${error.message}`
            }],
            isError: true
          };
        }
      }
    );
  });

  // Create the SDK MCP server
  const server = createSdkMcpServer({
    name: "fixiplug",
    version: "1.0.0",
    tools
  });

  console.log('FixiPlug MCP server created successfully');
  console.log('Available tools:', tools.map(t => `mcp__fixiplug__${t.name}`).join(', '));

  return server;
}

/**
 * Convert Anthropic JSON schema to Zod schema
 *
 * @param {Object} schema - Anthropic input_schema
 * @returns {Object} Zod schema object
 */
function convertAnthropicSchemaToZod(schema) {
  if (!schema || !schema.properties) {
    return {};
  }

  const zodSchema = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    zodSchema[key] = convertPropertyToZod(prop, schema.required?.includes(key));
  }

  return zodSchema;
}

/**
 * Convert a single property to Zod validator
 *
 * @param {Object} prop - Property definition
 * @param {boolean} isRequired - Whether property is required
 * @returns {Object} Zod validator
 */
function convertPropertyToZod(prop, isRequired = false) {
  let validator;

  switch (prop.type) {
    case 'string':
      validator = z.string();
      break;
    case 'number':
      validator = z.number();
      break;
    case 'integer':
      validator = z.number().int();
      break;
    case 'boolean':
      validator = z.boolean();
      break;
    case 'array':
      if (prop.items) {
        const itemValidator = convertPropertyToZod(prop.items, true);
        validator = z.array(itemValidator);
      } else {
        validator = z.array(z.any());
      }
      break;
    case 'object':
      if (prop.properties) {
        const nestedSchema = {};
        for (const [k, v] of Object.entries(prop.properties)) {
          nestedSchema[k] = convertPropertyToZod(v, prop.required?.includes(k));
        }
        validator = z.object(nestedSchema);
      } else {
        validator = z.record(z.any());
      }
      break;
    default:
      validator = z.any();
  }

  // Add description if present
  if (prop.description) {
    validator = validator.describe(prop.description);
  }

  // Make optional if not required
  if (!isRequired) {
    validator = validator.optional();
  }

  return validator;
}

export default createFixiPlugMcpServer;
