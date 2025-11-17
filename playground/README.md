# FixiPlug Agent Playground

Interactive playground for the FixiPlug Agent SDK with multi-LLM provider support.

## Features

- **Multi-LLM Support**: OpenAI GPT and Anthropic Claude models
- **Real-time Streaming**: Server-sent events for streaming responses
- **WebSocket Communication**: Bidirectional real-time updates
- **Conversation Management**: Session tracking and history
- **Tool Execution**: Visual feedback for tool/function calls
- **Agent State Management**: Monitor and control agent state
- **Workflow Execution**: Multi-step workflow visualization

## Architecture

```
playground/
├── backend/                 # Backend server
│   ├── server.js           # Main Express server
│   ├── services/           # Business logic
│   │   ├── conversation-manager.js
│   │   └── llm-provider.js
│   └── websocket/          # WebSocket handlers
│       └── handlers.js
├── frontend/               # Frontend UI (Session 6)
└── package.json           # Dependencies
```

## Quick Start

### Installation

```bash
cd playground
npm install
```

### Configuration

Set environment variables for LLM providers:

```bash
export OPENAI_API_KEY=your_openai_key_here
export ANTHROPIC_API_KEY=your_anthropic_key_here
export PORT=3000  # Optional, defaults to 3000
```

### Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "providers": {
    "openai": true,
    "anthropic": true
  },
  "agent": {
    "plugins": 2,
    "cacheEnabled": true
  }
}
```

## API Endpoints

### Capabilities

#### Get Capabilities
```http
GET /api/capabilities
```

Returns all discovered plugins and hooks.

#### Get Tools for Provider
```http
GET /api/tools/:provider
```

Returns tool definitions for specified provider (openai or anthropic).

### Chat

#### OpenAI Chat Completion
```http
POST /api/chat/openai
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "What can you do?" }
  ],
  "model": "gpt-4",
  "stream": false,
  "conversationId": "optional-id"
}
```

Response:
```json
{
  "success": true,
  "conversationId": "uuid",
  "response": {
    "role": "assistant",
    "content": "I can help with..."
  },
  "usage": { "total_tokens": 100 },
  "iterations": 2
}
```

#### Anthropic Chat
```http
POST /api/chat/anthropic
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "What can you do?" }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "stream": false,
  "conversationId": "optional-id"
}
```

### Streaming

Set `stream: true` to enable server-sent events:

```http
POST /api/chat/openai
Content-Type: application/json

{
  "messages": [...],
  "stream": true
}
```

The response will be streamed as SSE:
```
data: {"type":"chunk","content":"..."}

data: {"type":"tool_call","name":"..."}

data: {"type":"tool_result","result":{...}}

data: [DONE]
```

### Conversations

#### List Conversations
```http
GET /api/conversations
```

#### Get Conversation
```http
GET /api/conversations/:id
```

#### Delete Conversation
```http
DELETE /api/conversations/:id
```

### Agent State

#### Get Current State
```http
GET /api/agent/state
```

#### Set State
```http
POST /api/agent/state
Content-Type: application/json

{
  "state": "processing",
  "metadata": {
    "task": "analysis"
  }
}
```

### Workflow

#### Execute Workflow
```http
POST /api/workflow/execute
Content-Type: application/json

{
  "steps": [
    {
      "name": "step1",
      "hook": "api:getCurrentState",
      "params": {}
    },
    {
      "name": "step2",
      "hook": "api:setState",
      "params": { "state": "complete" }
    }
  ],
  "stopOnError": true
}
```

## WebSocket API

Connect to `ws://localhost:3000`

### Message Types

#### Client → Server

**Ping**
```json
{ "type": "ping" }
```

**Chat**
```json
{
  "type": "chat",
  "provider": "openai",
  "model": "gpt-4",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true
}
```

**Get Capabilities**
```json
{ "type": "get_capabilities" }
```

**Get Tools**
```json
{
  "type": "get_tools",
  "provider": "openai"
}
```

**Execute Tool**
```json
{
  "type": "execute_tool",
  "hook": "api:getCurrentState",
  "params": {}
}
```

**Get State**
```json
{ "type": "get_state" }
```

**Set State**
```json
{
  "type": "set_state",
  "state": "processing",
  "metadata": {}
}
```

#### Server → Client

**Connected**
```json
{
  "type": "connected",
  "clientId": "client_123",
  "timestamp": 1234567890,
  "providers": { ... }
}
```

**Chat Chunk (streaming)**
```json
{
  "type": "chat_chunk",
  "chunk": { ... },
  "provider": "openai"
}
```

**Tool Call**
```json
{
  "type": "tool_call",
  "toolCall": { ... }
}
```

**Tool Result**
```json
{
  "type": "tool_result",
  "result": { ... }
}
```

**Error**
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Usage Examples

### Basic Chat with OpenAI

```javascript
const response = await fetch('http://localhost:3000/api/chat/openai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Discover available capabilities' }
    ],
    model: 'gpt-4'
  })
});

const data = await response.json();
console.log(data.response.content);
```

### Streaming Chat with Anthropic

```javascript
const response = await fetch('http://localhost:3000/api/chat/anthropic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What tools do you have?' }
    ],
    model: 'claude-3-5-sonnet-20241022',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      console.log(JSON.parse(data));
    }
  }
}
```

### WebSocket Example

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Send chat message
  ws.send(JSON.stringify({
    type: 'chat',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);

  switch (message.type) {
    case 'chat_chunk':
      // Handle streaming chunk
      break;
    case 'tool_call':
      // Tool is being called
      break;
    case 'tool_result':
      // Tool result received
      break;
  }
};
```

## Testing

```bash
npm test
```

## Development

### Project Structure

- `backend/server.js` - Main Express application
- `backend/services/conversation-manager.js` - Conversation session management
- `backend/services/llm-provider.js` - LLM provider abstraction
- `backend/websocket/handlers.js` - WebSocket event handlers

### Adding a New Endpoint

1. Add route in `server.js`
2. Implement handler function
3. Update this README

### Adding a New Provider

1. Add provider config to `llm-provider.js`
2. Implement provider-specific chat method
3. Update WebSocket handlers if needed

## Troubleshooting

### "Provider not initialized"

Make sure you've set the API key environment variable:
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-...
```

### "Port already in use"

Change the port:
```bash
export PORT=3001
npm start
```

### WebSocket Connection Failed

Check that the server is running and accessible. Try:
```bash
curl http://localhost:3000/health
```

## License

Part of the FixiPlug project.

## See Also

- [Agent SDK Documentation](../sdk/README.md)
- [OpenAI Adapter](../sdk/adapters/openai-adapter.js)
- [Anthropic Adapter](../sdk/adapters/anthropic-adapter.js)
- [Frontend UI](./frontend/README.md) (Session 6)
