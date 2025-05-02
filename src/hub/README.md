# Fixi Plugin System

A high-performance, modular plugin system for extending the Fixi JavaScript library.

## Architecture

The plugin system follows a modular "Core + Extensions" architecture:

```
┌─────────────────────────────────────────────────────┐
│ FixiWithPlugins                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ PluginManager                                   │ │
│ │ ┌───────────────┐ ┌───────────────┐            │ │
│ │ │ Plugin 1      │ │ Plugin 2      │            │ │
│ │ └───────────────┘ └───────────────┘            │ │
│ │                                                 │ │
│ │ ┌─────────────────────────────┐                │ │
│ │ │ Extensions                  │                │ │
│ │ │ ┌─────────────────────────┐ │                │ │
│ │ │ │ CircuitBreakerExtension │ │                │ │
│ │ │ ├─────────────────────────┤ │                │ │
│ │ │ │ MetricsExtension        │ │                │ │
│ │ │ ├─────────────────────────┤ │                │ │
│ │ │ │ TimeoutExtension        │ │                │ │
│ │ │ ├─────────────────────────┤ │                │ │
│ │ │ │ ...                     │ │                │ │
│ │ │ └─────────────────────────┘ │                │ │
│ │ └─────────────────────────────┘                │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Core Components

- **FixiWithPlugins**: The main wrapper around Fixi that adds plugin support
- **PluginManager**: Handles registration and execution of plugins
- **Plugin Interface (FixiPlugs)**: Standard interface for creating plugins

### Extension System

The extension system allows adding capabilities to the PluginManager without bloating the core code. Extensions can:

- Hook into plugin registration/unregistration
- Intercept hook executions
- Add cross-cutting concerns like monitoring, timeouts, and error handling

## Usage

### Creating a Plugin

```typescript
import { createPlugin, PluginHook } from './hub';

export const MyPlugin = createPlugin({
  name: 'myPlugin',
  version: '1.0.0',
  
  beforeRequest(ctx) {
    // Modify request before it's sent
    ctx.config.headers = {
      ...ctx.config.headers,
      'X-Custom-Header': 'Value'
    };
    return ctx.config;
  },
  
  afterResponse(ctx) {
    // Process response before returning to application
    console.log(`Response from ${ctx.config.url}: ${ctx.response.status}`);
    return ctx.response;
  }
});
```

### Using Plugins

```typescript
import { Fixi } from './core/fixi';
import { createPluginSystem } from './hub';
import { CachePlugin, LoadingPlugin } from './plugs';

// Create base Fixi instance
const fixi = new Fixi();

// Enhance with plugins
const enhancedFixi = createPluginSystem(fixi, {
  plugins: [CachePlugin, LoadingPlugin]
});

// Use as normal
enhancedFixi.get('/api/data').then(response => {
  // Plugins have been executed during this request
  console.log(response);
});
```

### Custom Plugin Manager Configuration

For more control, you can create a custom plugin manager:

```typescript
import { Fixi } from './core/fixi';
import { 
  createCustomPluginManager, 
  CircuitBreakerExtension,
  MetricsExtension
} from './hub';

const fixi = new Fixi();
const manager = createCustomPluginManager(fixi, [
  new CircuitBreakerExtension(),
  new MetricsExtension()
]);

// Use the manager directly
manager.register(MyPlugin);
```

## Available Extensions

| Extension | Purpose |
|-----------|---------|
| CircuitBreakerExtension | Prevents cascading failures by temporarily disabling plugins that repeatedly fail |
| ConditionalExecutionExtension | Allows plugins to conditionally execute based on context |
| FallbackExtension | Provides graceful error recovery through fallback functions |
| LazyLoadingExtension | Enables on-demand loading of plugins for better startup performance |
| LifecycleExtension | Manages plugin lifecycle and tracks plugin activity |
| MetricsExtension | Collects performance metrics and health stats |
| TimeoutExtension | Prevents long-running plugins from blocking execution |
| VersionCompatibilityExtension | Ensures plugins are compatible with the current API version |

## Hook Execution Sequence

1. **beforeExecute** extensions run
2. For each plugin (sorted by priority):
   - **beforeHook** extensions run
   - Plugin hook executes
   - **afterHook** extensions run
3. **afterExecute** extensions run

## Error Handling

When a plugin hook throws an error:

1. Error is logged
2. All **onHookError** extensions get a chance to handle it
3. If no extension handles it, the error propagates to the application

## Performance Optimization

The plugin system is designed for high performance:

- Only loaded plugins are executed
- Plugins are priority-sorted for more important plugins to run first
- Extensions can skip unnecessary processing
- Circuit breakers prevent repeatedly failing plugins from consuming resources