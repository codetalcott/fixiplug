# FixiPlug + Hono Integration Guide

Complete guide for integrating FixiPlug with Hono server framework for bidirectional state synchronization.

## Table of Contents

- [Overview](#overview)
- [Why Hono?](#why-hono)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Sync Modes](#sync-modes)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The FixiPlug Hono integration provides seamless state synchronization between your Hono server and FixiPlug client applications. It enables:

- **Bidirectional state tracking** - Server knows client state, client knows server state
- **Multiple sync modes** - Headers, SSE, or WebSocket
- **Event-driven architecture** - React to state changes on both sides
- **Type-safe** - Full TypeScript support

## Why Hono?

Hono's middleware architecture is uniquely compatible with FixiPlug's plugin system:

| Feature | Hono | FixiPlug | Compatibility |
|---------|------|----------|---------------|
| Context-based | ✅ `c.set()` | ✅ `ctx.emit()` | Perfect match |
| Middleware pattern | ✅ `(c, next) => {}` | ✅ `ctx.on()` | Aligned |
| Event-driven | ✅ Via context | ✅ Native | Synergistic |
| Lightweight | ✅ <14kB | ✅ Minimal | Both optimized |

Unlike ElysiaJS (instance-chaining) or Express (callback-based), Hono's context model maps directly to FixiPlug's event hooks.

## Installation

### Server (Bun + Hono)

```bash
# Install dependencies
bun add hono

# Install FixiPlug (for shared types/utilities)
bun add fixiplug
```

### Client (FixiPlug)

```bash
# FixiPlug already includes hono-sync plugin
npm install fixiplug
```

## Quick Start

### Server Setup

```javascript
import { Hono } from 'hono';

const app = new Hono();

// FixiPlug-aware middleware
app.use('/*', async (c, next) => {
  // Read client state
  const clientState = c.req.header('X-FX-Client-State');
  console.log('Client is in state:', clientState);

  await next();

  // Send server state
  c.header('X-FX-State', 'success');
});

// Example route
app.get('/api/data', async (c) => {
  const data = { items: [1, 2, 3] };

  // Emit event to client
  c.header('X-FX-Event', JSON.stringify({
    type: 'dataLoaded',
    count: data.items.length
  }));

  return c.json(data);
});

export default app;
```

### Client Setup

```javascript
import { fixiplug } from 'fixiplug';
import honoSync from 'fixiplug/plugins/hono-sync';
import stateTracker from 'fixiplug/plugins/state-tracker';

// Add state tracking
fixiplug.use(stateTracker);

// Add Hono sync
fixiplug.use(honoSync({
  mode: 'headers',
  stateHeader: 'X-FX-State',
  eventHeader: 'X-FX-Event'
}));

// React to server events
fixiplug.use(function myPlugin(ctx) {
  ctx.on('hono:server:state', (event) => {
    console.log('Server state changed:', event.state);
  });

  ctx.on('hono:server:dataLoaded', (event) => {
    console.log('Data loaded:', event.count, 'items');
  });
});

// Make request (client state automatically sent)
await fixiplug.dispatch('api:setState', { state: 'loading' });
const response = await fetch('/api/data');
```

## Sync Modes

### 1. Headers Mode (Default)

Uses HTTP headers for state sync. Works everywhere, no persistent connections.

**Client:**

```javascript
fixiplug.use(honoSync({
  mode: 'headers'
}));
```

**Server:**

```javascript
app.use(async (c, next) => {
  const clientState = c.req.header('X-FX-Client-State');
  await next();
  c.header('X-FX-State', serverState);
});
```

**Pros:**

- ✅ Works everywhere
- ✅ No connection management
- ✅ Stateless

**Cons:**

- ❌ Only syncs on requests
- ❌ No server push

### 2. SSE Mode (Server-Sent Events)

Server can push state changes to client in real-time.

**Client:**

```javascript
fixiplug.use(honoSync({
  mode: 'sse',
  sseEndpoint: '/events'
}));
```

**Server:**

```javascript
import { streamSSE } from 'hono/streaming';

const clients = new Set();

app.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    clients.add(stream);

    await stream.writeSSE({
      event: 'state',
      data: currentServerState
    });

    // Broadcast to all clients when state changes
    function broadcastState(state) {
      clients.forEach(async (client) => {
        await client.writeSSE({
          event: 'state',
          data: state
        });
      });
    }
  });
});
```

**Pros:**

- ✅ Real-time server push
- ✅ Efficient for updates
- ✅ Automatic reconnection

**Cons:**

- ❌ One-way (server → client)
- ❌ Requires persistent connection

### 3. WebSocket Mode

Fully bidirectional real-time communication.

**Client:**

```javascript
fixiplug.use(honoSync({
  mode: 'websocket',
  wsEndpoint: '/ws'
}));
```

**Server:**

```javascript
app.get('/ws', (c) => {
  const { response, socket } = Bun.upgrade(c.req.raw);

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'clientState') {
      console.log('Client state:', message.state);
    }
  });

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'state',
      state: currentServerState
    }));
  });

  return response;
});
```

**Pros:**

- ✅ Fully bidirectional
- ✅ Lowest latency
- ✅ Real-time sync

**Cons:**

- ❌ Most complex
- ❌ Connection management required

## API Reference

### Client API

#### `honoSync(options)`

Creates a Hono sync plugin instance.

**Options:**

```typescript
{
  mode: 'headers' | 'sse' | 'websocket',
  stateHeader: string,              // Default: 'X-FX-State'
  eventHeader: string,              // Default: 'X-FX-Event'
  clientStateHeader: string,        // Default: 'X-FX-Client-State'
  sseEndpoint: string,              // Default: '/events'
  wsEndpoint: string,               // Default: '/ws'
  autoReconnect: boolean,           // Default: true
  reconnectDelay: number,           // Default: 1000ms
  onServerState: (state) => void,   // Callback for server state
  onServerEvent: (event) => void,   // Callback for server events
  getClientState: () => string      // Get current client state
}
```

#### Events Emitted

The plugin emits the following events:

| Event | Data | Description |
|-------|------|-------------|
| `hono:server:state` | `{ state }` | Server state changed |
| `hono:server:{type}` | `{ ...eventData }` | Server event by type |
| `hono:sse:connected` | `{ endpoint }` | SSE connected |
| `hono:sse:error` | `{ endpoint }` | SSE error/disconnected |
| `hono:ws:connected` | `{ endpoint }` | WebSocket connected |
| `hono:ws:disconnected` | `{ endpoint }` | WebSocket disconnected |

### Server API

#### Headers

**Request Headers (Client → Server):**

- `X-FX-Client-State`: Current client state

**Response Headers (Server → Client):**

- `X-FX-State`: Current server state
- `X-FX-Event`: Server event (JSON)

#### SSE Events

```javascript
await stream.writeSSE({
  event: 'state',           // Event type
  data: 'loading',          // State or JSON string
  id: String(Date.now())    // Optional event ID
});
```

**Standard Events:**

- `state` - State change
- `event` - Custom event
- `heartbeat` - Keep-alive

#### WebSocket Messages

**Client → Server:**

```json
{
  "type": "clientState",
  "state": "loading"
}
```

**Server → Client:**

```json
{
  "type": "state",
  "state": "success"
}
```

## Examples

### Example 1: Loading State Sync

**Client:**

```javascript
// Set client state to loading
await fixiplug.dispatch('api:setState', { state: 'loading' });

// Fetch data (loading state sent in header)
const response = await fetch('/api/data');

// Server state received in response header
// → triggers 'hono:server:state' event
```

**Server:**

```javascript
app.get('/api/data', async (c) => {
  const clientState = c.req.header('X-FX-Client-State');
  // → "loading"

  const data = await fetchData();

  c.header('X-FX-State', 'success');
  return c.json(data);
});
```

### Example 2: Error Handling

**Client:**

```javascript
fixiplug.use(function errorHandler(ctx) {
  ctx.on('hono:server:error', (event) => {
    alert(`Server error: ${event.message}`);
  });
});
```

**Server:**

```javascript
app.get('/api/data', async (c) => {
  try {
    const data = await riskyOperation();
    return c.json(data);
  } catch (error) {
    c.header('X-FX-Event', JSON.stringify({
      type: 'error',
      message: error.message
    }));
    return c.json({ error: error.message }, 500);
  }
});
```

### Example 3: Multi-step Workflow

**Client:**

```javascript
async function complexWorkflow() {
  // Step 1: Initialize
  await fixiplug.dispatch('api:setState', { state: 'initializing' });
  await fetch('/api/init');

  // Wait for server to be ready
  await fixiplug.dispatch('api:waitForState', {
    state: 'ready',
    timeout: 5000
  });

  // Step 2: Process
  await fixiplug.dispatch('api:setState', { state: 'processing' });
  await fetch('/api/process');

  // Step 3: Complete
  await fixiplug.dispatch('api:setState', { state: 'complete' });
}
```

**Server:**

```javascript
app.post('/api/init', async (c) => {
  await initialize();
  c.header('X-FX-State', 'ready');
  return c.json({ status: 'initialized' });
});

app.post('/api/process', async (c) => {
  const clientState = c.req.header('X-FX-Client-State');

  if (clientState !== 'processing') {
    return c.json({ error: 'Invalid state' }, 400);
  }

  await processData();
  c.header('X-FX-State', 'processed');
  return c.json({ status: 'processed' });
});
```

### Example 4: Real-time Dashboard (SSE)

**Client:**

```javascript
fixiplug.use(honoSync({
  mode: 'sse',
  sseEndpoint: '/events'
}));

fixiplug.use(function dashboardPlugin(ctx) {
  ctx.on('hono:server:metrics', (event) => {
    updateDashboard(event.data);
  });

  ctx.on('hono:server:alert', (event) => {
    showAlert(event.message, event.severity);
  });
});
```

**Server:**

```javascript
const clients = new Set();

app.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    clients.add(stream);

    // Periodic metrics
    const interval = setInterval(async () => {
      await stream.writeSSE({
        event: 'metrics',
        data: JSON.stringify({
          cpu: getCPU(),
          memory: getMemory()
        })
      });
    }, 1000);

    c.req.raw.signal.addEventListener('abort', () => {
      clearInterval(interval);
      clients.delete(stream);
    });
  });
});

// Broadcast alerts
function broadcastAlert(message, severity) {
  clients.forEach(async (client) => {
    await client.stream.writeSSE({
      event: 'alert',
      data: JSON.stringify({ message, severity })
    });
  });
}
```

## Best Practices

### 1. Choose the Right Sync Mode

- **Headers**: Simple CRUD apps, stateless APIs
- **SSE**: Dashboards, notifications, server-driven updates
- **WebSocket**: Chat, real-time collaboration, gaming

### 2. State Schema Validation

Define valid states and transitions:

```javascript
await fixiplug.dispatch('api:registerStateSchema', {
  states: ['idle', 'loading', 'success', 'error'],
  transitions: {
    idle: ['loading'],
    loading: ['success', 'error'],
    success: ['idle'],
    error: ['idle']
  }
});
```

### 3. Error Handling

Always handle sync errors gracefully:

```javascript
fixiplug.use(function errorHandler(ctx) {
  ctx.on('hono:sse:error', () => {
    // Fallback to headers mode
    setupHonoSync('headers');
  });

  ctx.on('hono:ws:disconnected', () => {
    // Show offline indicator
    showOfflineState();
  });
});
```

### 4. Security

**Server:**

```javascript
// Validate client state
app.use(async (c, next) => {
  const clientState = c.req.header('X-FX-Client-State');

  if (clientState && !isValidState(clientState)) {
    return c.json({ error: 'Invalid state' }, 400);
  }

  await next();
});

// Sanitize events
function sanitizeEvent(event) {
  return {
    type: event.type,
    // Only include safe fields
    data: pick(event.data, ['id', 'name', 'count'])
  };
}
```

### 5. Performance

**Debounce state updates:**

```javascript
const debouncedStateUpdate = debounce(async (state) => {
  await fetch('/api/state', {
    method: 'POST',
    body: JSON.stringify({ state })
  });
}, 300);

ctx.on('state:transition', (event) => {
  debouncedStateUpdate(event.to);
});
```

**Batch SSE messages:**

```javascript
const messageQueue = [];

setInterval(async () => {
  if (messageQueue.length === 0) return;

  const batch = messageQueue.splice(0, 10);
  await stream.writeSSE({
    event: 'batch',
    data: JSON.stringify(batch)
  });
}, 100);
```

## Running the Examples

### Start the Server

```bash
cd examples
bun run hono-server.js
```

Server runs at `http://localhost:3000`

### Open the Client

```bash
# Serve static files
bunx serve .

# Or use Python
python -m http.server 8000
```

Then open `http://localhost:8000/examples/hono-client.html`

## Troubleshooting

### Headers not being sent

Make sure CORS is configured:

```javascript
import { cors } from 'hono/cors';

app.use('/*', cors({
  exposeHeaders: ['X-FX-State', 'X-FX-Event']
}));
```

### SSE not connecting

Check endpoint and CORS:

```javascript
// Server must allow SSE
app.get('/events', (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  // ...
});
```

### WebSocket upgrade fails

Ensure Bun.upgrade is called correctly:

```javascript
app.get('/ws', (c) => {
  const upgradeHeader = c.req.header('Upgrade');

  if (upgradeHeader !== 'websocket') {
    return c.text('Expected websocket', 400);
  }

  return Bun.upgrade(c.req.raw);
});
```

## Further Reading

- [Hono Documentation](https://hono.dev)
- [FixiPlug Plugin Guide](./PLUGINS.md)
- [State Tracker API](./STATE-TRACKER.md)
- [Example Projects](../examples/)

## Contributing

Found a bug or have a feature request? Open an issue or PR at [fixiplug/issues](https://github.com/yourorg/fixiplug/issues).
