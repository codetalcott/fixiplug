# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

FixiPlug is a modular plugin framework with advanced LLM agent integration capabilities. The project consists of:

1. **Core Plugin System**: Event-driven architecture for extensible plugins
2. **Agent SDK**: LLM agent framework with tool execution
3. **LLM Adapters**: OpenAI and Anthropic integrations
4. **Agent Playground**: Full-stack web application for testing

## Commands

### Agent Playground

```bash
# Start the playground (backend + frontend)
cd playground
npm install
npm start
# Server runs on http://localhost:3000

# Development mode with auto-reload
npm run dev

# Run backend tests
npm test
```

### Testing

```bash
# Backend tests (Node.js)
node playground/backend/test/server.test.js

# SDK tests (Browser - open in browser)
open test/sdk/agent-client.test.html
open test/sdk/openai-adapter.test.html
open test/sdk/anthropic-adapter.test.html

# Run examples
node examples/openai-adapter-example.js
node examples/anthropic-adapter-example.js
node playground/examples/backend-usage.js

# TypeScript type checking
npx tsc --noEmit

# Syntax validation
node --check <file.js>
```

### Build and Run

```bash
# No build step required - uses ES6 modules directly

# Run playground
cd playground && npm start

# Run specific example
node examples/openai-adapter-example.js
```

## Project Architecture

FixiPlug follows a modular, event-driven architecture with three main layers:

### 1. Core Layer

**Builder** (`builder/fixiplug-factory.js`)
- Factory for creating fixiplug instances
- Feature-based configuration

**Core** (`core/`)
- Base fixiplug implementation
- Event dispatch system
- Plugin management

### 2. Plugin Layer

**Introspection Plugin** (`plugins/introspection.js`)
- Capability discovery
- Hook metadata
- Version tracking

**State Tracker Plugin** (`plugins/state-tracker.js`)
- Application state management
- State change notifications
- State history

**Other Plugins** (`plugins/`)
- Data transformer
- Table management
- Form schema
- Agent commands

### 3. Agent SDK Layer

**Agent Client** (`sdk/agent-client.js`)
- Main FixiPlugAgent class
- Capability discovery
- Workflow orchestration
- State management
- Performance tracking
- Caching

**OpenAI Adapter** (`sdk/adapters/openai-adapter.js`)
- Function calling integration
- Tool definition generation (OpenAI format)
- Tool call execution
- Message formatting

**Anthropic Adapter** (`sdk/adapters/anthropic-adapter.js`)
- Tool use integration
- Tool definition generation (Anthropic format)
- Tool use execution
- Tool result formatting

### 4. Application Layer

**Backend** (`playground/backend/`)
- Express.js HTTP server
- WebSocket server
- REST API (11 endpoints)
- Conversation management
- LLM provider abstraction
- Services layer

**Frontend** (`playground/frontend/`)
- Vanilla JavaScript SPA
- WebSocket client
- REST API client
- Real-time chat UI
- Tool execution visualization
- Responsive design

### Architectural Patterns

- **Factory Pattern**: Used in builder/, SDK adapters
- **Observer Pattern**: Core event system, plugin hooks
- **Adapter Pattern**: LLM provider adapters (OpenAI, Anthropic)
- **Strategy Pattern**: LLM provider service
- **Singleton Pattern**: Conversation manager, agent instances

## Core Components

### Agent SDK

**FixiPlugAgent** (`sdk/agent-client.js`)
- Entry point for LLM agent features
- Methods:
  - `discover()` - Get capabilities
  - `hasCapability()` - Check capability
  - `getCurrentState()` / `setState()` - State management
  - `executeWorkflow()` - Run workflows
  - `warmCache()` / `invalidateCache()` - Cache control

**OpenAIAdapter** (`sdk/adapters/openai-adapter.js`)
- OpenAI function calling integration
- Methods:
  - `getToolDefinitions()` - Generate tools
  - `executeToolCall()` - Execute function
  - `createToolMessage()` - Format response

**AnthropicAdapter** (`sdk/adapters/anthropic-adapter.js`)
- Anthropic tool use integration
- Methods:
  - `getToolDefinitions()` - Generate tools
  - `executeToolUse()` - Execute tool
  - `createToolResult()` - Format response

### Playground Backend

**Server** (`playground/backend/server.js`)
- Main Express application
- Endpoints:
  - `/health` - Health check
  - `/api/capabilities` - Get capabilities
  - `/api/tools/:provider` - Get tools
  - `/api/chat/:provider` - Chat endpoint
  - `/api/conversations` - Conversation management
  - `/api/agent/state` - State management
  - `/api/workflow/execute` - Workflow execution
- WebSocket integration
- SSE streaming support

**Services** (`playground/backend/services/`)
- ConversationManager - Session tracking
- LLMProviderService - Provider abstraction

**WebSocket** (`playground/backend/websocket/handlers.js`)
- Real-time communication
- Message routing
- Tool execution feedback

### Playground Frontend

**App** (`playground/frontend/js/app.js`)
- Main AgentPlayground class
- UI coordination
- State management
- Message display
- Tool visualization

**WebSocketClient** (`playground/frontend/js/websocket-client.js`)
- WebSocket connection
- Auto-reconnect
- Event handling

**APIClient** (`playground/frontend/js/api-client.js`)
- REST API wrapper
- All backend endpoints

## Domain Terminology

### Core Concepts

- **Plugin**: Module that extends fixiplug functionality
- **Hook**: Named event that plugins can listen to
- **Dispatch**: Trigger an event/hook
- **Context**: Plugin's interface to fixiplug

### Agent SDK

- **Agent**: FixiPlugAgent instance
- **Capability**: Plugin or hook that's available
- **Tool**: LLM-callable function
- **Adapter**: Provider-specific integration
- **Workflow**: Multi-step execution plan

### LLM Integration

- **Tool Call** (OpenAI): Function execution request
- **Tool Use** (Anthropic): Tool execution request
- **Tool Definition**: JSON schema for LLM
- **Tool Result**: Execution response

### Playground

- **Provider**: LLM service (OpenAI, Anthropic)
- **Conversation**: Chat session
- **Streaming**: Real-time response chunks
- **WebSocket**: Bidirectional connection

## File Organization

```
fixiplug/
├── builder/                 # Factory patterns
├── core/                    # Base implementation
├── plugins/                 # Plugin implementations
│   ├── introspection.js    # Capability discovery
│   ├── state-tracker.js    # State management
│   └── ...
├── sdk/                     # Agent SDK
│   ├── agent-client.js     # Main agent class
│   ├── adapters/           # LLM adapters
│   │   ├── openai-adapter.js
│   │   ├── anthropic-adapter.js
│   │   └── README.md
│   ├── types.d.ts          # TypeScript definitions
│   └── README.md
├── playground/              # Web application
│   ├── backend/            # Server
│   │   ├── server.js
│   │   ├── services/
│   │   ├── websocket/
│   │   └── test/
│   ├── frontend/           # UI
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   └── README.md
│   ├── examples/
│   ├── package.json
│   └── README.md
├── examples/                # Usage examples
├── test/                    # Test suites
├── docs/                    # Documentation
│   ├── SESSION_1_SUMMARY.md
│   ├── SESSION_2_SUMMARY.md
│   ├── SESSION_3_SUMMARY.md
│   ├── SESSION_4_SUMMARY.md
│   ├── SESSION_5_SUMMARY.md
│   └── SESSION_6_SUMMARY.md
└── README.md
```

## Code Style

- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Modules**: ES6 modules (import/export)
- **Async**: Prefer async/await over promises
- **Comments**: JSDoc for public APIs
- **Naming**:
  - Classes: PascalCase
  - Functions/methods: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Private methods: _prefixWithUnderscore

## Environment Variables

### Playground

```bash
# Required for LLM functionality
OPENAI_API_KEY=sk-...        # OpenAI API key
ANTHROPIC_API_KEY=sk-...     # Anthropic API key

# Optional
PORT=3000                     # Server port (default: 3000)
NODE_ENV=development          # Environment mode
```

### Testing

```bash
# For running examples with real APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

## Development Guidelines

### Adding a New Plugin

1. Create file in `plugins/` directory
2. Export object with `name` and `setup` function
3. Register hooks in `setup(context)`
4. Add tests in `test/` directory
5. Document in plugin's JSDoc comments

### Adding a New LLM Adapter

1. Create file in `sdk/adapters/`
2. Implement tool definition generation
3. Implement tool execution
4. Add TypeScript types in `sdk/types.d.ts`
5. Create tests in `test/sdk/`
6. Add examples in `examples/`
7. Document in `sdk/adapters/README.md`

### Adding a Playground Feature

**Backend:**
1. Add endpoint in `playground/backend/server.js`
2. Create service if needed in `services/`
3. Add WebSocket handler if needed
4. Write tests in `backend/test/`

**Frontend:**
1. Add UI elements in `frontend/index.html`
2. Style in `frontend/css/styles.css`
3. Add logic in `frontend/js/app.js`
4. Update API client if needed

## Testing Strategy

### Unit Tests

- **SDK**: Browser-based tests (test/sdk/*.test.html)
- **Backend**: Node.js tests (playground/backend/test/)
- **Services**: Unit tests for ConversationManager, LLMProviderService

### Integration Tests

- **Adapters**: Test with mock LLM responses
- **Backend**: Test API endpoints
- **WebSocket**: Test real-time communication

### Manual Testing

- **Playground**: Run server and test in browser
- **Examples**: Execute example files
- **LLM Integration**: Test with real API keys

## Common Tasks

### Run the Playground

```bash
cd playground
npm install
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-...
npm start
# Open http://localhost:3000
```

### Test SDK Changes

```bash
# Update code in sdk/
node --check sdk/agent-client.js
npx tsc --noEmit
open test/sdk/agent-client.test.html
```

### Test Adapter Changes

```bash
# Update code in sdk/adapters/
node --check sdk/adapters/openai-adapter.js
node examples/openai-adapter-example.js
```

### Test Backend Changes

```bash
# Update code in playground/backend/
node --check playground/backend/server.js
node playground/backend/test/server.test.js
```

### Test Frontend Changes

```bash
# Update code in playground/frontend/
# No build step needed - just refresh browser
cd playground && npm start
# Open http://localhost:3000
```

## Debugging

### Backend Debugging

```javascript
// Enable logging in server
const fixiplug = createFixiplug({
  features: ['logging']  // Enables console logging
});
```

### Frontend Debugging

```javascript
// Use browser console
console.log(window.app);  // Access main app instance
console.log(window.app.wsClient.isConnected());
console.log(window.app.stats);
```

### Agent SDK Debugging

```javascript
// Enable performance tracking
const agent = new FixiPlugAgent(fixiplug, {
  trackPerformance: true
});

// Get metrics
const metrics = agent.getPerformanceMetrics();
console.log(metrics);
```

## Recent Major Changes

Recent significant commits:
- 2181598: feat: add Agent Playground frontend with real-time chat UI (Session 6)
- 0efa7ee: feat: add Agent Playground backend with multi-LLM support (Session 5)
- 080b610: feat: add Anthropic adapter for Claude tool use integration (Session 4)
- 99fa4c2: feat: add OpenAI adapter for function calling integration (Session 3)
- Earlier: Agent SDK foundation and advanced features (Sessions 1-2)

## Documentation

- **README.md**: Project overview and quick start
- **sdk/README.md**: Agent SDK documentation
- **sdk/adapters/README.md**: Adapter documentation
- **playground/README.md**: Playground backend documentation
- **playground/frontend/README.md**: Playground frontend documentation
- **docs/SESSION_*_SUMMARY.md**: Detailed session summaries

## Known Issues

- TypeScript warnings in examples (expected, non-blocking)
- Optional dependencies (openai, @anthropic-ai/sdk) needed for full functionality
- Conversations stored in memory (backend restart clears)
- No authentication in playground (development only)

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires:
- ES6 Modules
- Fetch API
- WebSocket API
- CSS Grid (for UI)
- CSS Custom Properties

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
