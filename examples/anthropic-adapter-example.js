/**
 * Anthropic Adapter Usage Examples
 *
 * This file demonstrates how to use the Anthropic Adapter to integrate
 * FixiPlug Agent SDK with Anthropic's Claude tool use API.
 *
 * Note: This example shows the integration patterns. To run with actual
 * Anthropic API, you'll need to:
 * 1. npm install @anthropic-ai/sdk
 * 2. Set ANTHROPIC_API_KEY environment variable
 * 3. Uncomment the Anthropic API sections
 */

import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';
import { createFixiplug } from '../builder/fixiplug-factory.js';
import introspectionPlugin from '../plugins/introspection.js';
import stateTrackerPlugin from '../plugins/state-tracker.js';

// Uncomment to use real Anthropic API:
// import Anthropic from '@anthropic-ai/sdk';
// const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log('=== Anthropic Adapter Examples ===\n');

// Setup: Create fixiplug with plugins
const fixiplug = createFixiplug({
  features: ['logging']
});

fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);

// ==================================================
// Example 1: Basic Setup
// ==================================================
console.log('Example 1: Basic Anthropic Adapter Setup');
console.log('----------------------------------------');

const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,
  trackPerformance: true
});

const adapter = new AnthropicAdapter(agent, {
  includeCoreTools: true,
  includeWorkflowTools: true,
  includeCacheTools: true,
  includePluginHooks: false
});

console.log('✓ Created Anthropic adapter');
console.log('✓ Configuration:', adapter.options);
console.log();

// ==================================================
// Example 2: Getting Tool Definitions
// ==================================================
console.log('Example 2: Getting Tool Definitions');
console.log('-----------------------------------');

(async () => {
  try {
    // Get tool definitions in Anthropic format
    const tools = await adapter.getToolDefinitions();

    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });

    console.log('\n✓ Tool definitions ready for Anthropic API\n');

    // ==================================================
    // Example 3: Using Tools with Anthropic API (Pattern)
    // ==================================================
    console.log('Example 3: Anthropic API Integration Pattern');
    console.log('--------------------------------------------');

    console.log('Pattern for Anthropic message with tools:\n');

    console.log('```javascript');
    console.log('const tools = await adapter.getToolDefinitions();');
    console.log('');
    console.log('const message = await anthropic.messages.create({');
    console.log('  model: "claude-3-5-sonnet-20241022",');
    console.log('  max_tokens: 1024,');
    console.log('  tools: tools,');
    console.log('  messages: [');
    console.log('    {');
    console.log('      role: "user",');
    console.log('      content: "What capabilities are available?"');
    console.log('    }');
    console.log('  ]');
    console.log('});');
    console.log('```\n');

    // ==================================================
    // Example 4: Simulating Tool Use Execution
    // ==================================================
    console.log('Example 4: Simulating Tool Use Execution');
    console.log('----------------------------------------');

    // Simulate an Anthropic tool use
    const simulatedToolUse = {
      id: 'toolu_01A12B3C4D5E6F7G8H9I0J',
      type: 'tool_use',
      name: 'discover_capabilities',
      input: {}
    };

    console.log('Simulated tool use from Claude:');
    console.log('  Tool ID:', simulatedToolUse.id);
    console.log('  Tool Name:', simulatedToolUse.name);
    console.log('  Input:', JSON.stringify(simulatedToolUse.input));

    // Execute the tool use
    const result = await adapter.executeToolUse(simulatedToolUse);

    console.log('\nTool result:');
    console.log('  Version:', result.version);
    console.log('  Plugins:', result.plugins.length);
    console.log('  Hooks:', Object.keys(result.hooks).length);

    // Create response for Anthropic
    const toolResult = adapter.createToolResult(simulatedToolUse.id, result);

    console.log('\nCreated tool result for Anthropic:');
    console.log('  Type:', toolResult.type);
    console.log('  Tool Use ID:', toolResult.tool_use_id);
    console.log('  Content length:', toolResult.content.length, 'characters');
    console.log('  Is Error:', toolResult.is_error || false);

    console.log('\n✓ Tool use executed and response formatted\n');

    // ==================================================
    // Example 5: Multi-Turn Conversation Pattern
    // ==================================================
    console.log('Example 5: Multi-Turn Conversation Pattern');
    console.log('------------------------------------------');

    console.log('Typical conversation flow:\n');

    const messages = [
      { role: 'user', content: 'Check if state tracking is available' }
    ];

    console.log('1. Initial user message:', messages[0].content);

    // Simulate Claude response with tool use
    const checkCapabilityUse = {
      id: 'toolu_01B23C45D6E7F8G9H0I1J2',
      type: 'tool_use',
      name: 'check_capability',
      input: { capability: 'fixiplug-state-tracker' }
    };

    console.log('2. Claude requests tool use:', checkCapabilityUse.name);

    // Execute tool use
    const capabilityResult = await adapter.executeToolUse(checkCapabilityUse);

    console.log('3. Tool execution result:', capabilityResult);

    // Add assistant message with tool use
    // @ts-ignore - Anthropic API supports content arrays
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Let me check that capability for you.'
        },
        checkCapabilityUse
      ]
    });

    // Add tool result to conversation
    // @ts-ignore - Anthropic API supports content arrays
    messages.push({
      role: 'user',
      content: [adapter.createToolResult(checkCapabilityUse.id, capabilityResult)]
    });

    console.log('4. Messages in conversation:', messages.length);
    console.log('\n✓ Multi-turn conversation pattern demonstrated\n');

    // ==================================================
    // Example 6: Complete Agent Loop (Simulation)
    // ==================================================
    console.log('Example 6: Complete Agent Loop');
    console.log('------------------------------');

    async function simulateAgentLoop(userQuery) {
      console.log(`User query: "${userQuery}"\n`);

      const conversationMessages = [
        { role: 'user', content: userQuery }
      ];

      // Get available tools
      const availableTools = await adapter.getToolDefinitions();
      console.log(`Available tools: ${availableTools.length}`);

      // Simulate Claude deciding to call discover_capabilities
      console.log('Claude decides to use: discover_capabilities');

      const toolUse = {
        id: 'toolu_01C34D56E7F8G9H0I1J2K3',
        type: 'tool_use',
        name: 'discover_capabilities',
        input: { refresh: false }
      };

      // Execute the tool
      const toolResult = await adapter.executeToolUse(toolUse);

      console.log(`Tool returned: ${toolResult.plugins.length} plugins`);

      // Create tool result
      const toolResultMsg = adapter.createToolResult(toolUse.id, toolResult);

      // @ts-ignore - Anthropic API supports content arrays
      conversationMessages.push({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Let me discover what plugins are available.'
          },
          toolUse
        ]
      });

      // @ts-ignore - Anthropic API supports content arrays
      conversationMessages.push({
        role: 'user',
        content: [toolResultMsg]
      });

      // Simulate Claude's final response
      const finalResponse = {
        role: 'assistant',
        content: `I discovered ${toolResult.plugins.length} available plugins: ` +
                 toolResult.plugins.map(p => p.name).join(', ')
      };

      conversationMessages.push(finalResponse);

      console.log(`\nFinal response: "${finalResponse.content}"`);
      console.log(`\nTotal conversation messages: ${conversationMessages.length}`);

      return conversationMessages;
    }

    await simulateAgentLoop('What plugins are available?');

    console.log('\n✓ Complete agent loop simulated\n');

    // ==================================================
    // Example 7: Workflow Execution via Anthropic
    // ==================================================
    console.log('Example 7: Workflow Execution via Anthropic');
    console.log('-------------------------------------------');

    const workflowUse = {
      id: 'toolu_workflow_01',
      type: 'tool_use',
      name: 'execute_workflow',
      input: {
        steps: [
          {
            name: 'check',
            hook: 'api:getCurrentState',
            params: {}
          },
          {
            name: 'update',
            hook: 'api:setState',
            params: { state: 'processing' }
          },
          {
            name: 'reset',
            hook: 'api:setState',
            params: { state: 'idle' }
          }
        ],
        stopOnError: true
      }
    };

    console.log('Executing workflow with 3 steps...');

    const workflowResult = await adapter.executeToolUse(workflowUse);

    console.log('Workflow result:');
    console.log('  Success:', workflowResult.success);
    console.log('  Completed:', workflowResult.completed.join(', '));
    console.log('  Errors:', workflowResult.errors.length);

    console.log('\n✓ Workflow executed successfully\n');

    // ==================================================
    // Example 8: Use History and Debugging
    // ==================================================
    console.log('Example 8: Use History and Debugging');
    console.log('------------------------------------');

    const history = adapter.getUseHistory();

    console.log(`Total tool uses: ${history.length}`);
    console.log('\nUse history:');

    history.forEach((use, i) => {
      console.log(`  ${i + 1}. ${use.name} (${use.id}) - ${use.success ? '✓' : '✗'}`);
      if (use.error) {
        console.log(`     Error: ${use.error}`);
      }
    });

    console.log('\n✓ Use history tracked\n');

    // ==================================================
    // Example 9: Error Handling
    // ==================================================
    console.log('Example 9: Error Handling');
    console.log('------------------------');

    try {
      await adapter.executeToolUse({
        id: 'toolu_error_test',
        type: 'tool_use',
        name: 'unknown_tool',
        input: {}
      });
    } catch (error) {
      console.log('Caught expected error:');
      console.log('  Message:', error.message);
      console.log('  ✓ Error handled gracefully');
    }

    // Tool result with error flag
    const errorToolUse = {
      id: 'toolu_error_02',
      type: 'tool_use',
      name: 'set_state',
      input: {} // Missing required 'state' parameter
    };

    try {
      await adapter.executeToolUse(errorToolUse);
    } catch (error) {
      const errorResult = adapter.createToolResult(
        errorToolUse.id,
        { error: error.message },
        true // is_error flag
      );
      console.log('\nError tool result created:');
      console.log('  Is Error:', errorResult.is_error);
      console.log('  Content:', errorResult.content);
      console.log('  ✓ Error result formatted for Claude\n');
    }

    // ==================================================
    // Example 10: Real Anthropic Integration Template
    // ==================================================
    console.log('Example 10: Real Anthropic Integration Template');
    console.log('-----------------------------------------------\n');

    console.log('To use with real Anthropic API:\n');

    console.log('```javascript');
    console.log('import Anthropic from "@anthropic-ai/sdk";');
    console.log('import { FixiPlugAgent } from "./sdk/agent-client.js";');
    console.log('import { AnthropicAdapter } from "./sdk/adapters/anthropic-adapter.js";');
    console.log('');
    console.log('const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });');
    console.log('const agent = new FixiPlugAgent(fixiplug);');
    console.log('const adapter = new AnthropicAdapter(agent);');
    console.log('');
    console.log('async function chat(userMessage) {');
    console.log('  const messages = [{ role: "user", content: userMessage }];');
    console.log('  const tools = await adapter.getToolDefinitions();');
    console.log('  ');
    console.log('  let response = await anthropic.messages.create({');
    console.log('    model: "claude-3-5-sonnet-20241022",');
    console.log('    max_tokens: 4096,');
    console.log('    tools,');
    console.log('    messages');
    console.log('  });');
    console.log('  ');
    console.log('  // Handle tool uses');
    console.log('  while (response.stop_reason === "tool_use") {');
    console.log('    const toolUses = response.content.filter(c => c.type === "tool_use");');
    console.log('    ');
    console.log('    // Add assistant message');
    console.log('    messages.push({');
    console.log('      role: "assistant",');
    console.log('      content: response.content');
    console.log('    });');
    console.log('    ');
    console.log('    // Execute tools and collect results');
    console.log('    const toolResults = [];');
    console.log('    for (const toolUse of toolUses) {');
    console.log('      try {');
    console.log('        const result = await adapter.executeToolUse(toolUse);');
    console.log('        toolResults.push(adapter.createToolResult(toolUse.id, result));');
    console.log('      } catch (error) {');
    console.log('        toolResults.push(');
    console.log('          adapter.createToolResult(toolUse.id, { error: error.message }, true)');
    console.log('        );');
    console.log('      }');
    console.log('    }');
    console.log('    ');
    console.log('    // Add tool results');
    console.log('    messages.push({');
    console.log('      role: "user",');
    console.log('      content: toolResults');
    console.log('    });');
    console.log('    ');
    console.log('    // Get next response');
    console.log('    response = await anthropic.messages.create({');
    console.log('      model: "claude-3-5-sonnet-20241022",');
    console.log('      max_tokens: 4096,');
    console.log('      tools,');
    console.log('      messages');
    console.log('    });');
    console.log('  }');
    console.log('  ');
    console.log('  // Extract text response');
    console.log('  const textContent = response.content.find(c => c.type === "text");');
    console.log('  return textContent?.text || "";');
    console.log('}');
    console.log('');
    console.log('// Usage');
    console.log('const answer = await chat("What capabilities are available?");');
    console.log('console.log(answer);');
    console.log('```\n');

    // ==================================================
    // Summary
    // ==================================================
    console.log('=== Summary ===');
    console.log('All Anthropic adapter examples completed!');
    console.log('');
    console.log('Key features demonstrated:');
    console.log('  ✓ Tool definition generation');
    console.log('  ✓ Tool use execution');
    console.log('  ✓ Tool result creation');
    console.log('  ✓ Multi-turn conversations');
    console.log('  ✓ Complete agent loops');
    console.log('  ✓ Workflow execution');
    console.log('  ✓ Use history tracking');
    console.log('  ✓ Error handling');
    console.log('  ✓ Real API integration pattern');
    console.log('');
    console.log('Ready for production Anthropic integration! 🚀');

  } catch (error) {
    console.error('Error in examples:', error);
  }
})();
