# FixiPlug OpenAI Adapter

OpenAI Adapter for FixiPlug Agent SDK - seamlessly integrate FixiPlug capabilities with OpenAI's function calling API.

## Overview

The OpenAI Adapter translates FixiPlug Agent SDK capabilities into OpenAI-compatible function/tool definitions, handles function call execution, and manages the conversation flow.

## Quick Start

```javascript
import { FixiPlugAgent } from '../agent-client.js';
import { OpenAIAdapter } from './openai-adapter.js';
import OpenAI from 'openai';

// Create agent and adapter
const agent = new FixiPlugAgent(fixiplug);
const adapter = new OpenAIAdapter(agent);

// Get tool definitions for OpenAI
const tools = await adapter.getToolDefinitions();

// Use with OpenAI API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What can you do?' }],
  tools: tools
});

// Handle tool calls
for (const toolCall of response.choices[0].message.tool_calls || []) {
  const result = await adapter.executeToolCall(toolCall);
  const message = adapter.createToolMessage(toolCall, result);
  // Add message to conversation...
}
```

## Features

- **Automatic Tool Generation**: Converts Agent SDK capabilities to OpenAI tools
- **Both Formats Supported**: Works with new "tools" and legacy "functions" formats
- **Function Execution**: Handles OpenAI function/tool calls automatically
- **Call History**: Tracks all function calls for debugging
- **Error Handling**: Graceful error handling with detailed messages
- **Type Safety**: Full TypeScript definitions included

## Configuration

```javascript
const adapter = new OpenAIAdapter(agent, {
  includeCoreTools: true,      // Core Agent SDK tools (default: true)
  includeWorkflowTools: true,  // Workflow execution tools (default: true)
  includeCacheTools: true,     // Cache management tools (default: true)
  includePluginHooks: false    // Discovered plugin hooks (default: false)
});
```

## Available Tools

### Core Tools (includeCoreTools: true)

- `discover_capabilities` - Discover available plugins and hooks
- `check_capability` - Check if specific capability is available
- `get_current_state` - Get current application state
- `set_state` - Set application state
- `wait_for_state` - Wait for specific state

### Workflow Tools (includeWorkflowTools: true)

- `execute_workflow` - Execute multi-step workflows

### Cache Tools (includeCacheTools: true)

- `warm_cache` - Warm the capabilities cache
- `invalidate_cache` - Invalidate the cache
- `get_cache_info` - Get cache status

### Plugin Hooks (includePluginHooks: true)

Dynamically generates tools for all discovered plugin hooks.

## Usage Examples

### Complete Chat Loop

```javascript
async function chat(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  const tools = await adapter.getToolDefinitions();

  let response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    tools
  });

  // Handle tool calls in a loop
  while (response.choices[0].message.tool_calls) {
    const toolCalls = response.choices[0].message.tool_calls;

    messages.push(response.choices[0].message);

    for (const toolCall of toolCalls) {
      const result = await adapter.executeToolCall(toolCall);
      messages.push(adapter.createToolMessage(toolCall, result));
    }

    response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      tools
    });
  }

  return response.choices[0].message.content;
}

// Usage
const answer = await chat('What capabilities are available?');
console.log(answer);
```

### Workflow Execution

```javascript
// OpenAI can request workflow execution
const toolCall = {
  function: {
    name: 'execute_workflow',
    arguments: JSON.stringify({
      steps: [
        { name: 's1', hook: 'api:getCurrentState' },
        { name: 's2', hook: 'api:setState', params: { state: 'processing' } }
      ]
    })
  }
};

const result = await adapter.executeToolCall(toolCall);
console.log('Workflow completed:', result.success);
```

### Call History

```javascript
// Execute some functions
await adapter.executeFunctionCall({ name: 'discover_capabilities', arguments: '{}' });
await adapter.executeFunctionCall({ name: 'get_current_state', arguments: '{}' });

// Get history
const history = adapter.getCallHistory();
console.log('Total calls:', history.length);
console.log('Successful:', history.filter(c => c.success).length);

// Clear history
adapter.clearCallHistory();
```

## API Reference

### `getToolDefinitions(options?)`

Get OpenAI-compatible tool definitions (tools format).

**Parameters:**
- `options.refresh` (boolean): Force refresh capabilities

**Returns:** `Promise<OpenAITool[]>`

### `getFunctionDefinitions(options?)`

Get OpenAI-compatible function definitions (legacy format).

**Returns:** `Promise<OpenAIFunction[]>`

### `executeToolCall(toolCall)`

Execute an OpenAI tool call.

**Parameters:**
- `toolCall` (OpenAIToolCall): Tool call from OpenAI response

**Returns:** `Promise<any>` - Function execution result

### `executeFunctionCall(functionCall)`

Execute an OpenAI function call (legacy format).

**Parameters:**
- `functionCall` (OpenAIFunctionCall): Function call object

**Returns:** `Promise<any>` - Function execution result

### `createToolMessage(toolCall, result)`

Create tool message for OpenAI (tools format).

**Returns:** OpenAI-compatible tool message

### `createFunctionMessage(functionName, result)`

Create function message for OpenAI (legacy format).

**Returns:** OpenAI-compatible function message

### `getCallHistory()`

Get function call history.

**Returns:** `FunctionCallRecord[]`

### `clearCallHistory()`

Clear function call history.

## Testing

```bash
# Open test suite in browser
open test/sdk/openai-adapter.test.html
```

24 tests covering:
- Constructor validation
- Tool definition generation
- Function execution
- Call history
- Message creation
- Error handling

## Examples

See [examples/openai-adapter-example.js](../../examples/openai-adapter-example.js) for:
- Basic setup
- Tool definition generation
- Multi-turn conversations
- Complete agent loops
- Workflow execution
- Error handling patterns
- Real API integration template

## TypeScript Support

Full TypeScript definitions available in [sdk/types.d.ts](../types.d.ts):

```typescript
import { OpenAIAdapter, OpenAIAdapterOptions } from './sdk/adapters/openai-adapter.js';

const options: OpenAIAdapterOptions = {
  includeCoreTools: true,
  includeWorkflowTools: true
};

const adapter = new OpenAIAdapter(agent, options);
```

## License

Part of the FixiPlug project.

## See Also

- [Agent SDK Documentation](../README.md)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Examples](../../examples/openai-adapter-example.js)
- [Tests](../../test/sdk/openai-adapter.test.html)
- [TypeScript Definitions](../types.d.ts)
