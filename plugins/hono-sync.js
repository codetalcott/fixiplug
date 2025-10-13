/**
 * Hono Sync Plugin for FixiPlug
 *
 * Bidirectional state synchronization between Hono server and FixiPlug client.
 * Enables server-driven state updates and client state awareness on the server.
 *
 * Features:
 * - Sync server state to client via response headers
 * - Send client state to server via request headers
 * - SSE support for real-time server events
 * - WebSocket support for bidirectional streaming
 * - State history tracking across client/server boundary
 *
 * @module plugins/hono-sync
 *
 * @example
 * // Client setup
 * import { fixiplug } from 'fixiplug';
 * import honoSync from './plugins/hono-sync.js';
 *
 * fixiplug.use(honoSync({
 *   stateHeader: 'X-FX-State',
 *   eventHeader: 'X-FX-Event',
 *   mode: 'headers' // or 'sse' or 'websocket'
 * }));
 *
 * @example
 * // Server setup (Hono)
 * import { Hono } from 'hono';
 *
 * const app = new Hono();
 *
 * app.use(async (c, next) => {
 *   // Read client state
 *   const clientState = c.req.header('X-FX-Client-State');
 *
 *   await next();
 *
 *   // Send server state to client
 *   c.header('X-FX-State', 'success');
 *   c.header('X-FX-Event', JSON.stringify({
 *     type: 'notification',
 *     message: 'Operation completed'
 *   }));
 * });
 */

/**
 * Sync modes
 */
export const SYNC_MODES = {
  HEADERS: 'headers',      // HTTP headers (default, works everywhere)
  SSE: 'sse',             // Server-Sent Events (server push)
  WEBSOCKET: 'websocket'  // WebSocket (bidirectional)
};

/**
 * Creates Hono sync plugin
 * @param {Object} [options] - Configuration options
 * @param {string} [options.stateHeader='X-FX-State'] - Header for state sync
 * @param {string} [options.eventHeader='X-FX-Event'] - Header for event data
 * @param {string} [options.clientStateHeader='X-FX-Client-State'] - Header for sending client state
 * @param {string} [options.mode='headers'] - Sync mode: 'headers', 'sse', or 'websocket'
 * @param {string} [options.sseEndpoint='/events'] - SSE endpoint path
 * @param {string} [options.wsEndpoint='/ws'] - WebSocket endpoint path
 * @param {boolean} [options.autoReconnect=true] - Auto-reconnect for SSE/WS
 * @param {number} [options.reconnectDelay=1000] - Reconnect delay in ms
 * @param {Function} [options.onServerState] - Callback when server state received
 * @param {Function} [options.onServerEvent] - Callback when server event received
 * @param {Function} [options.getClientState] - Function to get current client state
 * @returns {Object} Plugin instance
 */
export default function createHonoSync(options = {}) {
  const config = {
    stateHeader: 'X-FX-State',
    eventHeader: 'X-FX-Event',
    clientStateHeader: 'X-FX-Client-State',
    mode: SYNC_MODES.HEADERS,
    sseEndpoint: '/events',
    wsEndpoint: '/ws',
    autoReconnect: true,
    reconnectDelay: 1000,
    onServerState: null,
    onServerEvent: null,
    getClientState: null,
    ...options
  };

  let eventSource = null;
  let webSocket = null;
  let reconnectTimer = null;
  let currentClientState = null;

  /**
   * Initialize SSE connection
   */
  function initSSE(ctx) {
    if (eventSource) return;

    try {
      eventSource = new EventSource(config.sseEndpoint);

      eventSource.addEventListener('state', (e) => {
        const state = e.data;
        handleServerState(ctx, state);
      });

      eventSource.addEventListener('event', (e) => {
        const eventData = JSON.parse(e.data);
        handleServerEvent(ctx, eventData);
      });

      eventSource.onerror = () => {
        ctx.emit('hono:sse:error', { endpoint: config.sseEndpoint });
        if (config.autoReconnect) {
          reconnectTimer = setTimeout(() => {
            eventSource?.close();
            eventSource = null;
            initSSE(ctx);
          }, config.reconnectDelay);
        }
      };

      eventSource.onopen = () => {
        ctx.emit('hono:sse:connected', { endpoint: config.sseEndpoint });
      };
    } catch (error) {
      console.error('[HonoSync] SSE initialization failed:', error);
    }
  }

  /**
   * Initialize WebSocket connection
   */
  function initWebSocket(ctx) {
    if (webSocket) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${config.wsEndpoint}`;

      webSocket = new WebSocket(wsUrl);

      webSocket.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);

          if (message.type === 'state') {
            handleServerState(ctx, message.state);
          } else if (message.type === 'event') {
            handleServerEvent(ctx, message.data);
          }
        } catch (error) {
          console.error('[HonoSync] WS message parse error:', error);
        }
      };

      webSocket.onerror = (error) => {
        ctx.emit('hono:ws:error', { endpoint: config.wsEndpoint, error });
      };

      webSocket.onclose = () => {
        ctx.emit('hono:ws:disconnected', { endpoint: config.wsEndpoint });

        if (config.autoReconnect) {
          reconnectTimer = setTimeout(() => {
            webSocket = null;
            initWebSocket(ctx);
          }, config.reconnectDelay);
        }
      };

      webSocket.onopen = () => {
        ctx.emit('hono:ws:connected', { endpoint: config.wsEndpoint });

        // Send initial client state
        if (currentClientState) {
          sendClientStateViaWS(currentClientState);
        }
      };
    } catch (error) {
      console.error('[HonoSync] WebSocket initialization failed:', error);
    }
  }

  /**
   * Handle server state update
   */
  function handleServerState(ctx, state) {
    if (config.onServerState) {
      config.onServerState(state);
    }
    ctx.emit('hono:server:state', { state });
  }

  /**
   * Handle server event
   */
  function handleServerEvent(ctx, eventData) {
    if (config.onServerEvent) {
      config.onServerEvent(eventData);
    }

    // Emit the server event with type prefix
    const eventType = eventData.type || 'unknown';
    ctx.emit(`hono:server:${eventType}`, eventData);
  }

  /**
   * Send client state via WebSocket
   */
  function sendClientStateViaWS(state) {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({
        type: 'clientState',
        state
      }));
    }
  }

  /**
   * Get current client state
   */
  function getCurrentClientState() {
    if (config.getClientState) {
      return config.getClientState();
    }
    return currentClientState || 'unknown';
  }

  return {
    name: 'hono-sync',

    setup(ctx) {
      // Initialize connection based on mode
      if (typeof window !== 'undefined') {
        if (config.mode === SYNC_MODES.SSE) {
          initSSE(ctx);
        } else if (config.mode === SYNC_MODES.WEBSOCKET) {
          initWebSocket(ctx);
        }
      }

      /**
       * Intercept requests to add client state header
       */
      ctx.on('fx:request:before', (event) => {
        const clientState = getCurrentClientState();

        // Add client state to headers
        if (!event.headers) event.headers = {};
        event.headers[config.clientStateHeader] = clientState;

        return event;
      }, ctx.PRIORITY?.HIGH || 100);

      /**
       * Intercept responses to extract server state/events
       */
      ctx.on('fx:response:after', (event) => {
        if (!event.response) return event;

        // Extract server state from header
        const serverState = event.response.headers?.get?.(config.stateHeader);
        if (serverState) {
          handleServerState(ctx, serverState);
        }

        // Extract server event from header
        const serverEventHeader = event.response.headers?.get?.(config.eventHeader);
        if (serverEventHeader) {
          try {
            const eventData = JSON.parse(serverEventHeader);
            handleServerEvent(ctx, eventData);
          } catch (error) {
            console.error('[HonoSync] Failed to parse server event:', error);
          }
        }

        return event;
      }, ctx.PRIORITY?.HIGH || 100);

      /**
       * Track client state changes
       */
      ctx.on('state:transition', (event) => {
        currentClientState = event.to;

        // Send to server via WebSocket if connected
        if (config.mode === SYNC_MODES.WEBSOCKET) {
          sendClientStateViaWS(event.to);
        }

        return event;
      });

      /**
       * API: Manually sync state
       */
      ctx.on('api:syncState', (event) => {
        if (config.mode === SYNC_MODES.WEBSOCKET) {
          sendClientStateViaWS(event.state || getCurrentClientState());
        }
        return event;
      });

      /**
       * Cleanup
       */
      ctx.registerCleanup(() => {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (webSocket) {
          webSocket.close();
          webSocket = null;
        }
      });
    }
  };
}
