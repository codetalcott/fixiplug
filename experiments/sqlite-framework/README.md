## # SQLite Extensions Framework Bridge

High-performance, resilient bridge connecting FixiPlug to the [SQLite Extensions Framework](https://github.com/user/sqlite-extensions-framework).

## Features

- **🔄 Process Pool**: Manages multiple Python processes for concurrent execution
- **🛡️ Resilience**: Built-in retry logic and circuit breaker patterns
- **⚡ Performance**: Multi-level caching and connection pooling
- **📊 Observability**: Comprehensive metrics, logging, and event tracking
- **🎯 Type Safety**: Full TypeScript definitions
- **🔧 Configuration**: Flexible configuration with sensible defaults

## Quick Start

```javascript
import { createBridge } from './sdk/adapters/sqlite-framework/index.js';

// Create and start bridge
const bridge = await createBridge({
  frameworkPath: '/path/to/sqlite-extensions-framework'
});

// Call Python methods
const result = await bridge.call(
  'src.generator.llm_agent_interface.analyze_requirements',
  {
    description: 'Calculate portfolio value at risk',
    domain: 'finance'
  }
);

console.log('Recommendations:', result);

// Shutdown gracefully
await bridge.shutdown();
```

## Architecture

```
┌─────────────────────────────────────────┐
│      SQLiteFrameworkBridge              │
│  ┌────────────┐  ┌─────────────────┐    │
│  │   Retry    │  │ Circuit Breaker │    │
│  └────────────┘  └─────────────────┘    │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│         Process Pool                    │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Process1 │ │ Process2 │ │Process3 │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│   SQLite Extensions Framework (Python)  │
└─────────────────────────────────────────┘
```

## Configuration

### Basic Configuration

```javascript
const bridge = new SQLiteFrameworkBridge({
  frameworkPath: '/path/to/sqlite-extensions-framework',
  maxProcesses: 4,
  requestTimeout: 30000
});

await bridge.start();
```

### Configuration Builder

```javascript
import { ConfigBuilder } from './sdk/adapters/sqlite-framework/index.js';

const config = new ConfigBuilder()
  .setFrameworkPath('/path/to/framework')
  .setMaxProcesses(8)
  .setRequestTimeout(60000)
  .setRetry(5, 'exponential')
  .setCircuitBreaker(true, 10, 120000)
  .enableDebug()
  .build();

const bridge = new SQLiteFrameworkBridge(config);
```

### Environment Variables

```bash
export SQLITE_FRAMEWORK_PATH=/path/to/framework
export PYTHON_EXECUTABLE=python3
export MAX_PROCESSES=8
export REQUEST_TIMEOUT=60000
export RETRY_ATTEMPTS=5
export CIRCUIT_BREAKER_THRESHOLD=10
export CACHE_ENABLED=true
export LOG_LEVEL=info
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `frameworkPath` | string | (required) | Path to SQLite Extensions Framework |
| `pythonExecutable` | string | `'python3'` | Python interpreter path |
| `maxProcesses` | number | `4` | Maximum number of Python processes |
| `processIdleTimeout` | number | `300000` | Process idle timeout (ms) |
| `requestTimeout` | number | `30000` | Per-request timeout (ms) |
| `retryAttempts` | number | `3` | Maximum retry attempts |
| `retryBackoff` | string | `'exponential'` | Backoff strategy |
| `circuitBreakerEnabled` | boolean | `true` | Enable circuit breaker |
| `circuitBreakerThreshold` | number | `5` | Failures before opening |
| `circuitBreakerTimeout` | number | `60000` | Reset timeout (ms) |
| `cacheEnabled` | boolean | `true` | Enable caching |
| `enableMetrics` | boolean | `true` | Track metrics |
| `logLevel` | string | `'info'` | Log level (debug/info/warn/error) |
| `debug` | boolean | `false` | Debug mode |

## API Reference

### SQLiteFrameworkBridge

#### `constructor(config)`

Create a new bridge instance.

```javascript
const bridge = new SQLiteFrameworkBridge({
  frameworkPath: '/path/to/framework'
});
```

#### `async start()`

Start the bridge and initialize process pool.

```javascript
await bridge.start();
```

#### `async call(method, params, options)`

Execute a Python method.

- `method` (string): Full method path (e.g., `'module.Class.method'`)
- `params` (Object): Method parameters
- `options` (Object): Call options
  - `timeout` (number): Override request timeout
  - `retry` (boolean): Enable retry (default: true)
  - `maxRetries` (number): Override max retries
  - `cacheKey` (string): Cache key

Returns: `Promise<any>` - Method result

```javascript
const result = await bridge.call(
  'src.generator.llm_agent_interface.generate_extension',
  {
    description: 'Real-time customer analytics',
    backend_language: 'mojo'
  },
  {
    timeout: 120000,
    retry: true,
    maxRetries: 5
  }
);
```

#### `getStats()`

Get bridge statistics.

Returns: `Object` - Statistics including:
- Total calls, successes, failures
- Success/failure rates
- Latency percentiles (p50, p95, p99)
- Process pool stats
- Circuit breaker stats

```javascript
const stats = bridge.getStats();
console.log(`Success rate: ${stats.successRate.toFixed(2)}%`);
console.log(`P95 latency: ${stats.latency.p95}ms`);
```

#### `getMetrics()`

Get metrics in Prometheus format.

```javascript
const metrics = bridge.getMetrics();
console.log(metrics);
```

#### `isHealthy()`

Check if bridge is healthy.

Returns: `boolean`

```javascript
if (!bridge.isHealthy()) {
  console.error('Bridge is unhealthy');
}
```

#### `async waitForReady(timeout)`

Wait for bridge to be ready.

```javascript
await bridge.waitForReady(10000);
```

#### `async shutdown()`

Gracefully shutdown the bridge.

```javascript
await bridge.shutdown();
```

### Events

The bridge emits the following events:

```javascript
bridge.on('started', () => {
  console.log('Bridge started');
});

bridge.on('process-started', (info) => {
  console.log(`Process ${info.id} started`);
});

bridge.on('process-error', (info) => {
  console.error(`Process ${info.id} error:`, info.error);
});

bridge.on('retry', (info) => {
  console.log(`Retry ${info.attempt}/${info.maxAttempts} for ${info.method}`);
});

bridge.on('circuit-breaker-state-change', (info) => {
  console.log(`Circuit breaker: ${info.from} -> ${info.to}`);
});

bridge.on('shutdown', () => {
  console.log('Bridge shutdown');
});
```

## Error Handling

### Error Types

```javascript
import {
  SQLiteFrameworkError,
  BridgeError,
  ProcessError,
  TimeoutError,
  ValidationError,
  PythonError,
  CircuitBreakerError
} from './sdk/adapters/sqlite-framework/index.js';

try {
  const result = await bridge.call('method', params);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof CircuitBreakerError) {
    console.error('Circuit breaker open, retry in:', error.retryAfter);
  } else if (error instanceof PythonError) {
    console.error('Python error:', error.pythonType);
    console.error('Traceback:', error.traceback);
  } else if (error instanceof ValidationError) {
    console.error('Validation errors:', error.validationErrors);
  }
}
```

### Recoverable Errors

```javascript
import { isRecoverableError } from './sdk/adapters/sqlite-framework/index.js';

try {
  await bridge.call('method', params);
} catch (error) {
  if (isRecoverableError(error)) {
    // Retry is recommended
    console.log('Error is recoverable, will retry');
  } else {
    // Fatal error, don't retry
    console.error('Fatal error:', error);
  }
}
```

## Advanced Usage

### Custom Retry Logic

```javascript
import { Retry } from './sdk/adapters/sqlite-framework/index.js';

const result = await new Retry()
  .withMaxAttempts(10)
  .withExponentialBackoff(2000, 60000)
  .onRetry((error, attempt) => {
    console.log(`Retry ${attempt} after error:`, error.message);
  })
  .execute(async () => {
    return await bridge.call('method', params);
  });
```

### Circuit Breaker Management

```javascript
import { CircuitBreakerManager } from './sdk/adapters/sqlite-framework/index.js';

const manager = new CircuitBreakerManager({
  threshold: 10,
  timeout: 120000
});

const result = await manager.execute('endpoint1', async () => {
  return await bridge.call('method', params);
});

// Get stats for specific endpoint
const stats = manager.getStats('endpoint1');
console.log('Circuit state:', stats.state);
```

### Process Pool Events

```javascript
bridge.processPool.on('process-restarted', () => {
  console.log('Process auto-restarted after crash');
});

bridge.processPool.on('process-recycling', (info) => {
  console.log(`Recycling idle process ${info.id}`);
});
```

## Performance Tuning

### High Throughput

```javascript
const bridge = new ConfigBuilder()
  .setFrameworkPath('/path/to/framework')
  .setMaxProcesses(16)  // More processes
  .setRequestTimeout(10000)  // Lower timeout
  .setRetry(1, 'linear')  // Fewer retries
  .setCache(true)  // Enable caching
  .build();
```

### High Reliability

```javascript
const bridge = new ConfigBuilder()
  .setFrameworkPath('/path/to/framework')
  .setMaxProcesses(4)
  .setRequestTimeout(120000)  // Longer timeout
  .setRetry(10, 'exponential')  // More retries
  .setCircuitBreaker(true, 20, 180000)  // Higher threshold
  .build();
```

### Low Latency

```javascript
const bridge = new ConfigBuilder()
  .setFrameworkPath('/path/to/framework')
  .setMaxProcesses(8)
  .setRequestTimeout(5000)  // Lower timeout
  .setRetry(0, 'exponential')  // No retries
  .setCircuitBreaker(false)  // No circuit breaker
  .build();
```

## Monitoring

### Statistics

```javascript
setInterval(() => {
  const stats = bridge.getStats();
  console.log('Bridge Statistics:');
  console.log(`  Total calls: ${stats.totalCalls}`);
  console.log(`  Success rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Avg latency: ${stats.averageLatency.toFixed(0)}ms`);
  console.log(`  P95 latency: ${stats.latency.p95}ms`);
  console.log(`  Active processes: ${stats.processPool.processCount}`);
  console.log(`  Available processes: ${stats.processPool.availableProcesses}`);
}, 60000);
```

### Prometheus Metrics

```javascript
import express from 'express';

const app = express();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(bridge.getMetrics());
});

app.listen(9090);
```

## Testing

See `test/sqlite-framework/` for comprehensive test suites.

### Unit Tests

```bash
node test/sqlite-framework/unit/errors.test.js
node test/sqlite-framework/unit/protocol.test.js
node test/sqlite-framework/unit/config.test.js
```

### Integration Tests

```bash
node test/sqlite-framework/integration/bridge.test.js
```

## Troubleshooting

### Bridge Won't Start

**Problem**: `FrameworkNotFoundError` when starting

**Solution**: Verify framework path is correct:
```bash
ls /path/to/sqlite-extensions-framework
```

### Process Crashes

**Problem**: Processes crash immediately

**Solution**: Check Python dependencies:
```bash
cd /path/to/sqlite-extensions-framework
python3 -m pip install -r requirements.txt
```

### High Latency

**Problem**: Requests are slow

**Solutions**:
1. Increase process pool size
2. Enable caching
3. Check Python framework performance
4. Review network latency

### Circuit Breaker Open

**Problem**: All requests rejected with `CircuitBreakerError`

**Solution**: Check error logs, fix underlying issue, then:
```javascript
bridge.circuitBreakers.reset('method-name');
```

## Contributing

See main FixiPlug contributing guidelines.

## License

See main FixiPlug license.
