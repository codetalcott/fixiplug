/**
 * Fetch Logger Plugin
 * @module plugins/fetch-logger
 *
 * Logs HTTP requests and responses with timing information.
 * Demonstrates usage of the fetch:before and fetch:after hooks.
 *
 * API Hooks Exposed:
 * - None (pure interceptor plugin)
 *
 * Events Listened To:
 * - fetch:before - Logs outgoing requests and starts timing
 * - fetch:after - Logs responses with duration
 *
 * @example
 * import fetchLogger from './plugins/fetch-logger.js';
 *
 * const fixiplug = createFixiplug({ features: [FEATURES.LOGGING] });
 * fixiplug.use(fetchLogger);
 *
 * // All fetch requests will now be logged automatically
 * await fixiplug.fetch({
 *   action: '/api/data',
 *   method: 'GET'
 * });
 * // → GET /api/data
 * // ← 200 OK (45.23ms)
 */

export default function fetchLogger(ctx) {
  // Track request timing
  const timings = new WeakMap();

  // ========================================
  // Intercept: Before Fetch
  // ========================================
  ctx.on('fetch:before', (event) => {
    const { method, url } = event;

    // Log outgoing request
    console.log(`→ ${method} ${url}`);

    // Store start time for duration calculation
    timings.set(event, performance.now());

    return event;
  });

  // ========================================
  // Intercept: After Fetch
  // ========================================
  ctx.on('fetch:after', (event) => {
    const { response, method, url } = event;

    // Calculate duration
    const startTime = timings.get(event) || performance.now();
    const duration = performance.now() - startTime;

    // Log response
    const status = response.status;
    const statusText = response.ok ? 'OK' : 'ERROR';
    console.log(`← ${status} ${statusText} (${duration.toFixed(2)}ms)`);

    // Cleanup
    timings.delete(event);

    return event;
  });

  // ========================================
  // Cleanup
  // ========================================
  ctx.registerCleanup(() => {
    // WeakMap will auto-cleanup, but good practice
  });
}
