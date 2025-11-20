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

# Core feature tests (Node.js)
node test/fetch-interceptors.test.js
node test/skill-lifecycle.test.js
node test/dom-delegation.test.js

# Browser automated tests (Playwright)
# Requires server running on localhost:3000
cd playground
npm run test:browser

# SDK tests (Browser - open in browser)
open test/sdk/agent-client.test.html
open test/sdk/openai-adapter.test.html
open test/sdk/anthropic-adapter.test.html
open test/event-buffering.test.html

# DOM delegation demo (manual testing)
open http://localhost:3000/dom-delegation-demo.html

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
- DOM Delegation (`dom-delegation.js`) - Event delegation for memory optimization
- Fetch Logger (`fetch-logger.js`) - Request/response logging
- Fetch Cache (`fetch-cache.js`) - In-memory caching with TTL
- Skill Versioning (`skill-versioning.js`) - Track skill version history

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
- REST API (15 endpoints)
  - Chat and capabilities
  - Conversation management
  - Agent state management
  - Workflow execution
  - Plugin management (enable/disable/list)
  - Skill registry
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

### DOM Features and Browser Testing

**DOM Delegation Plugin** (`plugins/dom-delegation.js`)

- Event delegation for memory optimization
- Reduces listeners from N (one per element) to M (one per event type)
- Dynamic event type management via hooks:
  - `api:addDelegationEventType` - Add new event types at runtime
  - `api:getDelegationStats` - Get delegation statistics
- Achieves ~96% memory reduction for 100+ elements
- See: `playground/frontend/dom-delegation-demo.html`

**DOM Feature** (`core/fixi-dom.js`)

- Async factory pattern with event buffering
- Prevents race conditions during module loading
- `fx:dom:ready` event signals initialization complete
- `document.__fixi_ready` flag for synchronous checks
- See: `docs/DOM_FEATURE_INITIALIZATION.md`

**Browser Testing** (`playground/test/`)

- Playwright-based automated testing
- Tests all 8 event types: click, double-click, mouseenter, change, input, focus, submit, keydown
- Validates delegation statistics and memory reduction
- Run: `cd playground && npm run test:browser`
- See: `test/BROWSER_TESTING.md`

**Event Validation Features** (in `dom-delegation-demo.html`)

- Live counter badges showing event fire counts
- Visual feedback (element flashing on events)
- Detailed console logging of all events
- Validation tools: `showEventCounts()`, `resetEventCounts()`, `showEventTypes()`
- Track individual event type firing via `eventTypeCounts` object

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

## New Features

### 1. Fetch Response Interceptors

**Purpose**: Hook into HTTP fetch lifecycle for request modification, response caching, and logging.

**Core Implementation** (`core/fixi-core.js`):
- Three new hooks: `fetch:before`, `fetch:after`, `fetch:ready`
- Allows plugins to modify requests, cache responses, and intercept network calls

**Example Plugins**:
- **fetch-logger.js**: Logs all HTTP requests/responses with timing
- **fetch-cache.js**: In-memory caching with TTL (60s default) and LRU eviction

**Usage**:
```javascript
const fixiplug = createFixiplug({ features: ['logging'] });
fixiplug.use(fetchLogger);    // Log all requests
fixiplug.use(fetchCache);     // Cache GET requests

// Check cache stats
const stats = await fixiplug.dispatch('api:getCacheStats');
// Clear cache
await fixiplug.dispatch('api:clearCache');
```

**Tests**: `test/fetch-interceptors.test.js` (23/23 passing)

---

### 2. Skill Registry Lifecycle Hooks

**Purpose**: Track and version skill registration/updates/removals with full history.

**Core Implementation** (`core/hooks.js`):
- Three new events: `skill:registered`, `skill:updated`, `skill:removed`
- Emitted automatically when skills are registered/updated/removed

**Example Plugin**:
- **skill-versioning.js**: Tracks complete version history with change detection

**Usage**:
```javascript
const fixiplug = createFixiplug({ features: ['logging'] });
fixiplug.use(skillVersioning);

// Get version history for a plugin
const history = await fixiplug.dispatch('api:getSkillHistory', {
  plugin: 'stateTrackerPlugin'
});

// Get all versions across all skills
const allVersions = await fixiplug.dispatch('api:getAllSkillVersions');
```

**Tests**: `test/skill-lifecycle.test.js` (41/41 passing)

---

### 3. DOM Event Delegation

**Purpose**: Reduce memory usage by 96% using single delegated listeners instead of per-element listeners.

**Core Implementation**:
- **Plugin**: `plugins/dom-delegation.js` - Intercepts `fx:init` with HIGH priority
- **Core Integration**: `core/fixi-dom.js` - Checks `__delegated` flag to skip individual listeners

**Memory Optimization**:
- Traditional: 100 elements = 100 listeners
- Delegated: 100 elements = 4 listeners (96% reduction)

**Usage**:
```javascript
const fixiplug = createFixiplug({ features: ['dom'] });
fixiplug.use(domDelegation);

// Get delegation statistics
const stats = await fixiplug.dispatch('api:getDelegationStats');
// {
//   active: true,
//   eventTypes: ['click', 'change', 'submit', 'input'],
//   elementsHandled: 100,
//   listenersAttached: 4,
//   memoryReduction: '~96%'
// }

// Add custom event type
await fixiplug.dispatch('api:addDelegationEventType', { eventType: 'focus' });

// Remove event type
await fixiplug.dispatch('api:removeDelegationEventType', { eventType: 'input' });
```

**Tests**: `test/dom-delegation.test.js` (25/27 passing, 92.6%)

---

### 4. Plugin Management API

**Purpose**: Enable/disable plugins at runtime with full status tracking.

**Core Implementation**:
- **Core**: `core/hooks.js` - `enablePlugin()` and `disablePlugin()` functions
- **Factory**: `builder/fixiplug-factory.js` - `enable()`, `disable()`, `getPluginsInfo()`, `getPluginInfo()`
- **Backend**: 4 new REST endpoints in `playground/backend/server.js`
- **Frontend**: 4 new API client methods in `playground/frontend/js/api-client.js`

**API Endpoints**:
```bash
GET    /api/plugins                # List all plugins with status
POST   /api/plugins/:name/enable   # Enable a plugin
POST   /api/plugins/:name/disable  # Disable a plugin
GET    /api/skills                 # List all skills
```

**Usage**:

Backend (Node.js):
```javascript
// Disable plugin
fixiplug.disable('stateTrackerPlugin');

// Enable plugin
fixiplug.enable('stateTrackerPlugin');

// Get plugin info
const info = fixiplug.getPluginInfo('stateTrackerPlugin');
// { name, disabled: false, hasSkill: true, skill: {...} }

// Get all plugins
const allPlugins = fixiplug.getPluginsInfo();
```

Frontend (Browser):
```javascript
// List plugins
const response = await apiClient.listPlugins();
// { success: true, plugins: [...], count: 3 }

// Disable plugin
await apiClient.disablePlugin('stateTrackerPlugin');

// Enable plugin
await apiClient.enablePlugin('stateTrackerPlugin');

// List skills
const skills = await apiClient.listSkills();
```

**Behavior**:
- Disabled plugins stay registered but their hooks won't execute
- Non-destructive - can be re-enabled without losing state
- Local and core status tracking synchronized

---

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
