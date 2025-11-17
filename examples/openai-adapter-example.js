/**
 * OpenAI Adapter Usage Examples
 *
 * This file demonstrates how to use the OpenAI Adapter to integrate
 * FixiPlug Agent SDK with OpenAI's function calling API.
 *
 * Note: This example shows the integration patterns. To run with actual
 * OpenAI API, you'll need to:
 * 1. npm install openai
 * 2. Set OPENAI_API_KEY environment variable
 * 3. Uncomment the OpenAI API sections
 */

import { FixiPlugAgent } from '../sdk/agent-client.js';
import { OpenAIAdapter } from '../sdk/adapters/openai-adapter.js';
import { createFixiplug } from '../builder/fixiplug-factory.js';
import introspectionPlugin from '../plugins/introspection.js';
import stateTrackerPlugin from '../plugins/state-tracker.js';

// Uncomment to use real OpenAI API:
// import OpenAI from 'openai';
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('=== OpenAI Adapter Examples ===\n');

// Setup: Create fixiplug with plugins
const fixiplug = createFixiplug({
  features: ['logging']
});

fixiplug.use(introspectionPlugin);
fixiplug.use(stateTrackerPlugin);

// ==================================================
// Example 1: Basic Setup
// ==================================================
console.log('Example 1: Basic OpenAI Adapter Setup');
console.log('-------------------------------------');

const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,
  trackPerformance: true
});

const adapter = new OpenAIAdapter(agent, {
  includeCoreTools: true,
  includeWorkflowTools: true,
  includeCacheTools: true,
  includePluginHooks: false
});

console.log('✓ Created OpenAI adapter');
console.log('✓ Configuration:', adapter.options);
console.log();

// ==================================================
// Example 2: Getting Tool Definitions
// ==================================================
console.log('Example 2: Getting Tool Definitions');
console.log('-----------------------------------');

(async () => {
  try {
    // Get tool definitions in OpenAI format
    const tools = await adapter.getToolDefinitions();

    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.function.name}: ${tool.function.description.substring(0, 60)}...`);
    });

    console.log('\n✓ Tool definitions ready for OpenAI API\n');

    // ==================================================
    // Example 3: Using Tools with OpenAI API (Pattern)
    // ==================================================
    console.log('Example 3: OpenAI API Integration Pattern');
    console.log('-----------------------------------------');

    console.log('Pattern for OpenAI chat completion with tools:\n');

    console.log('```javascript');
    console.log('const tools = await adapter.getToolDefinitions();');
    console.log('');
    console.log('const response = await openai.chat.completions.create({');
    console.log('  model: "gpt-4",');
    console.log('  messages: [');
    console.log('    {');
    console.log('      role: "user",');
    console.log('      content: "What capabilities are available?"');
    console.log('    }');
    console.log('  ],');
    console.log('  tools: tools,');
    console.log('  tool_choice: "auto"');
    console.log('});');
    console.log('```\n');

    // ==================================================
    // Example 4: Simulating Function Call Execution
    // ==================================================
    console.log('Example 4: Simulating Function Call Execution');
    console.log('--------------------------------------------');

    // Simulate an OpenAI tool call
    const simulatedToolCall = {
      id: 'call_abc123',
      type: 'function',
      function: {
        name: 'discover_capabilities',
        arguments: '{}'
      }
    };

    console.log('Simulated tool call from OpenAI:');
    console.log('  Function:', simulatedToolCall.function.name);
    console.log('  Arguments:', simulatedToolCall.function.arguments);

    // Execute the function call
    const result = await adapter.executeToolCall(simulatedToolCall);

    console.log('\nFunction result:');
    console.log('  Version:', result.version);
    console.log('  Plugins:', result.plugins.length);
    console.log('  Hooks:', Object.keys(result.hooks).length);

    // Create response message for OpenAI
    const toolMessage = adapter.createToolMessage(simulatedToolCall, result);

    console.log('\nCreated tool message for OpenAI:');
    console.log('  Role:', toolMessage.role);
    console.log('  Tool Call ID:', toolMessage.tool_call_id);
    console.log('  Content length:', toolMessage.content.length, 'characters');

    console.log('\n✓ Function call executed and response formatted\n');

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

    // Simulate OpenAI response with tool call
    const checkCapabilityCall = {
      id: 'call_def456',
      type: 'function',
      function: {
        name: 'check_capability',
        arguments: JSON.stringify({ capability: 'fixiplug-state-tracker' })
      }
    };

    console.log('2. OpenAI requests tool call:', checkCapabilityCall.function.name);

    // Execute tool call
    const capabilityResult = await adapter.executeToolCall(checkCapabilityCall);

    console.log('3. Tool execution result:', capabilityResult);

    // Add tool message to conversation
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [checkCapabilityCall]
    });

    messages.push(adapter.createToolMessage(checkCapabilityCall, capabilityResult));

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

      // Simulate OpenAI deciding to call discover_capabilities
      console.log('OpenAI decides to call: discover_capabilities');

      const toolCall = {
        id: 'call_xyz789',
        type: 'function',
        function: {
          name: 'discover_capabilities',
          arguments: '{"refresh": false}'
        }
      };

      // Execute the tool
      const toolResult = await adapter.executeToolCall(toolCall);

      console.log(`Tool returned: ${toolResult.plugins.length} plugins`);

      // Create tool response message
      const toolResponseMsg = adapter.createToolMessage(toolCall, toolResult);

      conversationMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: [toolCall]
      });

      conversationMessages.push(toolResponseMsg);

      // Simulate OpenAI's final response
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
    // Example 7: Workflow Execution via OpenAI
    // ==================================================
    console.log('Example 7: Workflow Execution via OpenAI');
    console.log('----------------------------------------');

    const workflowCall = {
      id: 'call_workflow_1',
      type: 'function',
      function: {
        name: 'execute_workflow',
        arguments: JSON.stringify({
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
        })
      }
    };

    console.log('Executing workflow with 3 steps...');

    const workflowResult = await adapter.executeToolCall(workflowCall);

    console.log('Workflow result:');
    console.log('  Success:', workflowResult.success);
    console.log('  Completed:', workflowResult.completed.join(', '));
    console.log('  Errors:', workflowResult.errors.length);

    console.log('\n✓ Workflow executed successfully\n');

    // ==================================================
    // Example 8: Call History and Debugging
    // ==================================================
    console.log('Example 8: Call History and Debugging');
    console.log('-------------------------------------');

    const history = adapter.getCallHistory();

    console.log(`Total function calls: ${history.length}`);
    console.log('\nCall history:');

    history.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.name} - ${call.success ? '✓' : '✗'}`);
      if (call.error) {
        console.log(`     Error: ${call.error}`);
      }
    });

    console.log('\n✓ Call history tracked\n');

    // ==================================================
    // Example 9: Error Handling
    // ==================================================
    console.log('Example 9: Error Handling');
    console.log('------------------------');

    try {
      await adapter.executeFunctionCall({
        name: 'unknown_function',
        arguments: '{}'
      });
    } catch (error) {
      console.log('Caught expected error:');
      console.log('  Message:', error.message);
      console.log('  ✓ Error handled gracefully');
    }

    // Invalid JSON arguments
    const invalidResult = await adapter.executeFunctionCall({
      name: 'discover_capabilities',
      arguments: 'not valid json'
    });

    console.log('\nInvalid arguments result:');
    console.log('  Error:', invalidResult.error);
    console.log('  ✓ Invalid arguments handled\n');

    // ==================================================
    // Example 10: Real OpenAI Integration Template
    // ==================================================
    console.log('Example 10: Real OpenAI Integration Template');
    console.log('--------------------------------------------\n');

    console.log('To use with real OpenAI API:\n');

    console.log('```javascript');
    console.log('import OpenAI from "openai";');
    console.log('import { FixiPlugAgent } from "./sdk/agent-client.js";');
    console.log('import { OpenAIAdapter } from "./sdk/adapters/openai-adapter.js";');
    console.log('');
    console.log('const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });');
    console.log('const agent = new FixiPlugAgent(fixiplug);');
    console.log('const adapter = new OpenAIAdapter(agent);');
    console.log('');
    console.log('async function chat(userMessage) {');
    console.log('  const messages = [{ role: "user", content: userMessage }];');
    console.log('  const tools = await adapter.getToolDefinitions();');
    console.log('  ');
    console.log('  let response = await openai.chat.completions.create({');
    console.log('    model: "gpt-4",');
    console.log('    messages,');
    console.log('    tools');
    console.log('  });');
    console.log('  ');
    console.log('  // Handle tool calls');
    console.log('  while (response.choices[0].message.tool_calls) {');
    console.log('    const toolCalls = response.choices[0].message.tool_calls;');
    console.log('    ');
    console.log('    messages.push(response.choices[0].message);');
    console.log('    ');
    console.log('    for (const toolCall of toolCalls) {');
    console.log('      const result = await adapter.executeToolCall(toolCall);');
    console.log('      messages.push(adapter.createToolMessage(toolCall, result));');
    console.log('    }');
    console.log('    ');
    console.log('    response = await openai.chat.completions.create({');
    console.log('      model: "gpt-4",');
    console.log('      messages,');
    console.log('      tools');
    console.log('    });');
    console.log('  }');
    console.log('  ');
    console.log('  return response.choices[0].message.content;');
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
    console.log('All OpenAI adapter examples completed!');
    console.log('');
    console.log('Key features demonstrated:');
    console.log('  ✓ Tool definition generation');
    console.log('  ✓ Function call execution');
    console.log('  ✓ Tool message creation');
    console.log('  ✓ Multi-turn conversations');
    console.log('  ✓ Complete agent loops');
    console.log('  ✓ Workflow execution');
    console.log('  ✓ Call history tracking');
    console.log('  ✓ Error handling');
    console.log('  ✓ Real API integration pattern');
    console.log('');
    console.log('Ready for production OpenAI integration! 🚀');

  } catch (error) {
    console.error('Error in examples:', error);
  }
})();
