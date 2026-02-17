# FixiPlug

A modular plugin framework with advanced LLM agent integration capabilities.

## Overview

FixiPlug is a lightweight, extensible plugin system built on [fixi.js](https://github.com/bigskysoftware/fixi) that now includes a powerful **Agent SDK** for building LLM-powered applications with multi-provider support (OpenAI & Anthropic) and an interactive **Agent Playground** for testing and demonstrations.

### Key Features

- **Plugin System**: Event-driven architecture with hot-swappable plugins
- **Agent SDK**: Complete LLM agent framework with tool execution
- **Multi-LLM Support**: OpenAI and Anthropic adapters
- **Agent Playground**: Interactive web UI with real-time chat
- **Zero Dependencies**: Core framework has no external dependencies
- **TypeScript Support**: Full TypeScript definitions included

## Quick Start

### Basic Plugin Usage

```javascript
import { createFixiplug } from './builder/fixiplug-factory.js';

// Create instance
const fixiplug = createFixiplug({
  features: ['logging']
});

// Create a simple plugin
const myPlugin = {
  name: 'my-plugin',
  setup(context) {
    context.on('myEvent', (data) => {
      console.log('Event received:', data);
      return data;
    });
  }
};

// Use the plugin
fixiplug.use(myPlugin);

// Dispatch events
fixiplug.dispatch('myEvent', { message: 'Hello!' });
```

### Agent SDK Usage

```javascript
import { FixiPlugAgent } from './sdk/agent-client.js';
import { OpenAIAdapter } from './sdk/adapters/openai-adapter.js';
import introspectionPlugin from './plugins/introspection.js';

// Create fixiplug with plugins
const fixiplug = createFixiplug({ features: ['logging'] });
fixiplug.use(introspectionPlugin);

// Create agent
const agent = new FixiPlugAgent(fixiplug, {
  enableCaching: true,
  trackPerformance: true
});

// Create adapter
const adapter = new OpenAIAdapter(agent);

// Get tool definitions
const tools = await adapter.getToolDefinitions();

// Use with OpenAI
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What can you do?' }],
  tools
});
```

### Agent Playground

```bash
# Install dependencies
cd playground
npm install

# Set API keys
export OPENAI_API_KEY=your_key_here
export ANTHROPIC_API_KEY=your_key_here

# Start server
npm start

# Open browser
open http://localhost:3000
```

## Project Structure

```
fixiplug/
├── builder/              # Factory for creating fixiplug instances
├── plugins/              # Core plugins (introspection, state-tracker, etc.)
├── sdk/                  # Agent SDK
│   ├── agent-client.js  # Main agent class
│   ├── adapters/        # LLM provider adapters
│   │   ├── openai-adapter.js
│   │   └── anthropic-adapter.js
│   └── types.d.ts       # TypeScript definitions
├── playground/           # Interactive web application
│   ├── backend/         # Express server with WebSocket
│   │   ├── server.js
│   │   ├── services/
│   │   └── websocket/
│   └── frontend/        # Web UI
│       ├── index.html
│       ├── css/
│       └── js/
├── examples/             # Usage examples
├── test/                 # Test suites
└── docs/                 # Documentation

```

## Agent SDK

The Agent SDK provides a complete framework for building LLM-powered applications with tool execution capabilities.

### Features

- **Capability Discovery**: Automatic introspection of available plugins and hooks
- **State Management**: Track and manage application state
- **Workflow Orchestration**: Execute multi-step workflows
- **Performance Tracking**: Monitor execution times and statistics
- **Caching**: Smart caching of capabilities with TTL
- **Multi-Provider Support**: OpenAI and Anthropic adapters

### Core Capabilities

```javascript
const agent = new FixiPlugAgent(fixiplug);

// Discover capabilities
const capabilities = await agent.discover();
// Returns: { version, plugins, hooks }

// Check specific capability
const available = await agent.hasCapability('my-capability');

// State management
await agent.setState('processing', { task: 'analysis' });
const state = await agent.getCurrentState();
await agent.waitForState('complete', { timeout: 5000 });

// Execute workflow
const result = await agent.executeWorkflow([
  { name: 'step1', hook: 'api:getData', params: {} },
  { name: 'step2', hook: 'api:processData', params: {} }
], { stopOnError: true });

// Performance metrics
const metrics = agent.getPerformanceMetrics();
```

## LLM Adapters

### OpenAI Adapter

```javascript
import { OpenAIAdapter } from './sdk/adapters/openai-adapter.js';

const adapter = new OpenAIAdapter(agent, {
  includeCoreTools: true,      // discover_capabilities, check_capability, etc.
  includeWorkflowTools: true,  // execute_workflow
  includeCacheTools: true,     // warm_cache, invalidate_cache
  includePluginHooks: false    // Discovered hooks
});

// Get tools for OpenAI
const tools = await adapter.getToolDefinitions();

// Execute tool call
const result = await adapter.executeToolCall(toolCall);

// Create response message
const message = adapter.createToolMessage(toolCall, result);
```

**Supported Models:**
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo

### Anthropic Adapter

```javascript
import { AnthropicAdapter } from './sdk/adapters/anthropic-adapter.js';

const adapter = new AnthropicAdapter(agent, {
  includeCoreTools: true,
  includeWorkflowTools: true,
  includeCacheTools: true
});

// Get tools for Anthropic
const tools = await adapter.getToolDefinitions();

// Execute tool use
const result = await adapter.executeToolUse(toolUse);

// Create tool result
const toolResult = adapter.createToolResult(toolUse.id, result);
```

**Supported Models:**
- Claude 3.5 Sonnet
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

## Agent Playground

Interactive web application for testing LLM agents with real-time tool execution visualization.

### Backend Features

- **REST API**: 11 endpoints for chat, capabilities, state, workflows
- **WebSocket**: Real-time bidirectional communication
- **Server-Sent Events**: Streaming responses
- **Conversation Management**: Session tracking and history
- **Multi-Provider**: OpenAI and Anthropic support

**API Endpoints:**
```
GET  /health                    - Server health check
GET  /api/capabilities          - Agent capabilities
GET  /api/tools/:provider       - Tool definitions
POST /api/chat/openai           - OpenAI chat
POST /api/chat/anthropic        - Anthropic chat
GET  /api/conversations         - List conversations
GET  /api/agent/state           - Get agent state
POST /api/workflow/execute      - Execute workflow
```

### Frontend Features

- **Real-Time Chat**: Interactive conversation with streaming
- **Provider Switching**: Toggle between OpenAI and Anthropic
- **Tool Visualization**: See tool executions in real-time
- **Conversation History**: Save and load conversations
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Statistics**: Track messages, tools, and tokens

## Core Plugins

### Introspection Plugin

Provides capability discovery and metadata.

```javascript
import introspectionPlugin from './plugins/introspection.js';

fixiplug.use(introspectionPlugin);

// Dispatches api:introspect hook
const result = await fixiplug.dispatch('api:introspect', {});
// Returns: { version, plugins: [...], hooks: {...} }
```

### State Tracker Plugin

Manages application state with history.

```javascript
import stateTrackerPlugin from './plugins/state-tracker.js';

fixiplug.use(stateTrackerPlugin);

// Set state
await fixiplug.dispatch('api:setState', {
  state: 'processing',
  metadata: { task: 'analysis' }
});

// Get current state
const state = await fixiplug.dispatch('api:getCurrentState', {});

// Wait for state change
const result = await fixiplug.dispatch('api:waitForState', {
  state: 'complete',
  timeout: 5000
});
```

## Examples

### Complete OpenAI Integration

```javascript
import OpenAI from 'openai';
import { FixiPlugAgent } from './sdk/agent-client.js';
import { OpenAIAdapter } from './sdk/adapters/openai-adapter.js';
import { createFixiplug } from './builder/fixiplug-factory.js';
import introspectionPlugin from './plugins/introspection.js';

// Setup
const fixiplug = createFixiplug({ features: ['logging'] });
fixiplug.use(introspectionPlugin);

const agent = new FixiPlugAgent(fixiplug);
const adapter = new OpenAIAdapter(agent);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Chat loop
async function chat(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  const tools = await adapter.getToolDefinitions();

  let response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    tools
  });

  // Handle tool calls
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
const answer = await chat('What capabilities do you have?');
console.log(answer);
```

### Complete Anthropic Integration

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { FixiPlugAgent } from './sdk/agent-client.js';
import { AnthropicAdapter } from './sdk/adapters/anthropic-adapter.js';

// Setup
const agent = new FixiPlugAgent(fixiplug);
const adapter = new AnthropicAdapter(agent);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Chat loop
async function chat(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  const tools = await adapter.getToolDefinitions();

  let response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    tools,
    messages
  });

  // Handle tool uses
  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(c => c.type === 'tool_use');

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      const result = await adapter.executeToolUse(toolUse);
      toolResults.push(adapter.createToolResult(toolUse.id, result));
    }

    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools,
      messages
    });
  }

  const textContent = response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}
```

## Testing

```bash
# Run all tests
node test/sdk/agent-client.test.html  # Open in browser
node test/sdk/openai-adapter.test.html  # Open in browser
node test/sdk/anthropic-adapter.test.html  # Open in browser

# Backend tests
node playground/backend/test/server.test.js

# Run examples
node examples/openai-adapter-example.js
node examples/anthropic-adapter-example.js
node playground/examples/backend-usage.js
```

## Documentation

- [Agent SDK Documentation](./sdk/README.md)
- [OpenAI Adapter Guide](./sdk/adapters/README.md#openai-adapter)
- [Anthropic Adapter Guide](./sdk/adapters/README.md#anthropic-adapter)
- [Playground Backend](./playground/README.md)
- [Playground Frontend](./playground/frontend/README.md)
- [Session Summaries](./docs/)

## Development Roadmap

See [ROADMAP.md](./docs/roadmap.md) for planned features and improvements.

**Completed:**
- ✅ Core plugin system
- ✅ Agent SDK foundation
- ✅ OpenAI adapter
- ✅ Anthropic adapter
- ✅ Agent Playground backend
- ✅ Agent Playground frontend

**In Progress:**
- 🔄 Additional LLM providers (Cohere, Google AI)
- 🔄 Enhanced plugin ecosystem
- 🔄 Production deployment guides

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { FixiPlugAgent, AgentOptions } from './sdk/agent-client.js';
import { OpenAIAdapter, OpenAIAdapterOptions } from './sdk/adapters/openai-adapter.js';
import { AnthropicAdapter, AnthropicAdapterOptions } from './sdk/adapters/anthropic-adapter.js';

const options: AgentOptions = {
  enableCaching: true,
  cacheTTL: 300000,
  trackPerformance: true
};

const agent = new FixiPlugAgent(fixiplug, options);
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires:
- ES6 Modules
- Fetch API
- WebSocket API (for Playground)
- CSS Grid (for Playground UI)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[License information here]

## Credits

Built on [fixi.js](https://github.com/bigskysoftware/fixi) - an experimental implementation of [generalized hypermedia controls](https://dl.acm.org/doi/fullHtml/10.1145/3648188.3675127).

## Support

- Issues: [GitHub Issues](https://github.com/your-repo/fixiplug/issues)
- Discussions: [GitHub Discussions](https://github.com/your-repo/fixiplug/discussions)
- Documentation: [Full Docs](./docs/)
