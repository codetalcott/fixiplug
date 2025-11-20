/**
 * Example Hono Server with FixiPlug Integration
 *
 * Demonstrates bidirectional state synchronization between Hono and FixiPlug:
 * - Header-based state sync
 * - Server-Sent Events (SSE) for real-time updates
 * - WebSocket support for bidirectional communication
 *
 * Run with: bun run examples/hono-server.js
 */

// @ts-ignore - Hono types not available (Bun-specific framework)
import { Hono } from 'hono';
// @ts-ignore - Hono types not available
import { cors } from 'hono/cors';
// @ts-ignore - Hono types not available
import { logger } from 'hono/logger';
// @ts-ignore - Hono types not available
import { streamSSE } from 'hono/streaming';

const app = new Hono();

// State management
let serverState = 'idle';
const connectedClients = new Set();

// Middleware: CORS for client communication
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  exposeHeaders: ['X-FX-State', 'X-FX-Event']
}));

// Middleware: Request logging
app.use('/*', logger());

/**
 * FixiPlug-aware middleware
 * Reads client state and injects server state into responses
 */
app.use('/*', async (c, next) => {
  // Read client state from header
  const clientState = c.req.header('X-FX-Client-State');

  if (clientState) {
    console.log(`[Server] Client state: ${clientState}`);
    c.set('clientState', clientState);
  }

  await next();

  // Inject server state into response headers
  c.header('X-FX-State', serverState);
});

/**
 * API: Get current server state
 */
app.get('/api/state', (c) => {
  return c.json({
    serverState,
    timestamp: new Date().toISOString()
  });
});

/**
 * API: Update server state
 */
app.post('/api/state', async (c) => {
  const { state, data } = await c.req.json();

  const previousState = serverState;
  serverState = state;

  console.log(`[Server] State transition: ${previousState} → ${state}`);

  // Broadcast to SSE clients
  broadcastEvent({
    type: 'state',
    state,
    previousState,
    data,
    timestamp: new Date().toISOString()
  });

  // Include event in response header
  c.header('X-FX-Event', JSON.stringify({
    type: 'stateChanged',
    state,
    previousState
  }));

  return c.json({ success: true, state });
});

/**
 * API: Trigger server event
 */
app.post('/api/events/trigger', async (c) => {
  const { type, data } = await c.req.json();

  const event = {
    type,
    data,
    timestamp: new Date().toISOString()
  };

  console.log(`[Server] Broadcasting event: ${type}`);
  broadcastEvent(event);

  c.header('X-FX-Event', JSON.stringify(event));

  return c.json({ success: true, event });
});

/**
 * Server-Sent Events endpoint
 * Streams server state changes to clients
 */
app.get('/events', (c) => {
  console.log('[Server] SSE client connected');

  return streamSSE(c, async (stream) => {
    const clientId = Date.now();
    const client = { stream, id: clientId };

    connectedClients.add(client);

    // Send initial state
    await stream.writeSSE({
      event: 'state',
      data: serverState,
      id: String(Date.now())
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: new Date().toISOString()
        });
      } catch (error) {
        clearInterval(heartbeat);
        connectedClients.delete(client);
      }
    }, 30000);

    // Wait for client disconnect
    c.req.raw.signal.addEventListener('abort', () => {
      console.log('[Server] SSE client disconnected');
      clearInterval(heartbeat);
      connectedClients.delete(client);
    });
  });
});

/**
 * WebSocket endpoint
 * Bidirectional communication with clients
 */
app.get('/ws', (c) => {
  const upgradeHeader = c.req.header('Upgrade');

  if (upgradeHeader !== 'websocket') {
    return c.text('Expected websocket', 400);
  }

  // @ts-ignore - Bun global available in Bun runtime
  const { response, socket } = Bun.upgrade(c.req.raw, {
    data: { connectedAt: Date.now() }
  });

  socket.addEventListener('open', () => {
    console.log('[Server] WebSocket client connected');

    // Send initial state
    socket.send(JSON.stringify({
      type: 'state',
      state: serverState,
      timestamp: new Date().toISOString()
    }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'clientState') {
        console.log(`[Server] Received client state via WS: ${message.state}`);

        // Acknowledge
        socket.send(JSON.stringify({
          type: 'ack',
          clientState: message.state,
          serverState
        }));
      }
    } catch (error) {
      console.error('[Server] WS message parse error:', error);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[Server] WebSocket client disconnected');
  });

  return response;
});

/**
 * Example: Data fetching with state tracking
 */
app.get('/api/data', async (c) => {
  const clientState = c.get('clientState');

  // Simulate async operation
  serverState = 'loading';
  broadcastEvent({ type: 'state', state: 'loading' });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const data = {
    items: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ],
    clientWasIn: clientState,
    timestamp: new Date().toISOString()
  };

  serverState = 'success';

  c.header('X-FX-Event', JSON.stringify({
    type: 'dataLoaded',
    count: data.items.length
  }));

  broadcastEvent({ type: 'state', state: 'success' });

  return c.json(data);
});

/**
 * Example: Error handling with state tracking
 */
app.get('/api/error', (c) => {
  serverState = 'error';

  const error = {
    type: 'error',
    message: 'Simulated error',
    timestamp: new Date().toISOString()
  };

  c.header('X-FX-Event', JSON.stringify(error));
  broadcastEvent({ type: 'error', data: error });

  return c.json(error, 500);
});

/**
 * Broadcast event to all SSE clients
 */
function broadcastEvent(eventData) {
  connectedClients.forEach(async (client) => {
    try {
      await client.stream.writeSSE({
        event: eventData.type,
        data: JSON.stringify(eventData),
        id: String(Date.now())
      });
    } catch (error) {
      // Client disconnected, will be cleaned up
      connectedClients.delete(client);
    }
  });
}

/**
 * Health check
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    serverState,
    connectedClients: connectedClients.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * Serve static HTML for testing
 */
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FixiPlug + Hono Integration Demo</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        button { margin: 5px; padding: 10px 20px; cursor: pointer; }
        .state { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; }
        .idle { background: #e0e0e0; }
        .loading { background: #2196F3; color: white; }
        .success { background: #4CAF50; color: white; }
        .error { background: #f44336; color: white; }
        #events { background: #f5f5f5; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto; }
        .event { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>FixiPlug + Hono Integration Demo</h1>

      <div>
        <h2>Server State: <span class="state idle" id="serverState">idle</span></h2>
        <h2>Client State: <span class="state idle" id="clientState">idle</span></h2>
      </div>

      <div>
        <h3>Actions</h3>
        <button onclick="fetchData()">Fetch Data</button>
        <button onclick="triggerError()">Trigger Error</button>
        <button onclick="updateState('loading')">Set Loading</button>
        <button onclick="updateState('success')">Set Success</button>
        <button onclick="connectSSE()">Connect SSE</button>
        <button onclick="connectWS()">Connect WebSocket</button>
      </div>

      <div>
        <h3>Events</h3>
        <div id="events"></div>
      </div>

      <script type="module">
        import { fixiplug } from '/fixiplug.js';
        import honoSync from '/plugins/hono-sync.js';
        import stateTracker from '/plugins/state-tracker.js';

        // Setup FixiPlug with Hono sync
        fixiplug.use(stateTracker);
        fixiplug.use(honoSync({
          mode: 'headers', // Change to 'sse' or 'websocket' as needed
          getClientState: () => document.getElementById('clientState').textContent
        }));

        // Update UI on server state changes
        fixiplug.use(function uiPlugin(ctx) {
          ctx.on('hono:server:state', (event) => {
            updateServerStateUI(event.state);
            logEvent('Server state: ' + event.state);
          });

          ctx.on('hono:server:dataLoaded', (event) => {
            logEvent('Data loaded: ' + event.count + ' items');
          });

          ctx.on('state:transition', (event) => {
            updateClientStateUI(event.to);
          });
        });

        function updateServerStateUI(state) {
          const el = document.getElementById('serverState');
          el.textContent = state;
          el.className = 'state ' + state;
        }

        function updateClientStateUI(state) {
          const el = document.getElementById('clientState');
          el.textContent = state;
          el.className = 'state ' + state;
        }

        function logEvent(message) {
          const events = document.getElementById('events');
          const event = document.createElement('div');
          event.className = 'event';
          event.textContent = new Date().toISOString() + ' - ' + message;
          events.prepend(event);
        }

        window.fetchData = async () => {
          await fixiplug.dispatch('api:setState', { state: 'loading' });
          const res = await fetch('/api/data');
          const data = await res.json();
          await fixiplug.dispatch('api:setState', { state: 'success' });
          logEvent('Fetched ' + data.items.length + ' items');
        };

        window.triggerError = async () => {
          await fetch('/api/error');
          await fixiplug.dispatch('api:setState', { state: 'error' });
        };

        window.updateState = async (state) => {
          await fixiplug.dispatch('api:setState', { state });
        };

        window.connectSSE = () => {
          logEvent('Connecting to SSE...');
          // Reinitialize with SSE mode
          window.location.reload();
        };

        window.connectWS = () => {
          logEvent('Connecting to WebSocket...');
          // Reinitialize with WS mode
          window.location.reload();
        };
      </script>
    </body>
    </html>
  `);
});

export default app;

// Run server if executed directly
if (import.meta.main) {
  const port = process.env.PORT || 3000;

  console.log(`
🚀 FixiPlug + Hono Server

Server running at http://localhost:${port}

Endpoints:
  - GET  /                     Demo page
  - GET  /api/state            Get server state
  - POST /api/state            Update server state
  - GET  /api/data             Fetch data with state tracking
  - GET  /events               SSE stream
  - GET  /ws                   WebSocket
  - GET  /health               Health check
  `);

  // @ts-ignore - Bun global available in Bun runtime
  Bun.serve({
    port,
    fetch: app.fetch
  });
}
