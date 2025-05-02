# FixiPlugs: Fixi Plugin System (pre-alpha)
<!-- Badges -->
<!-- [![npm version](https://img.shields.io/npm/v/fixi-plugins.svg)](https://www.npmjs.com/package/fixi-plugins)  
[![Build Status](https://github.com/your-org/fixiplug/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fixiplug/actions/workflows/ci.yml)   -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FixiPlugs aims to be a high-performance, composable plugin system for the tiny Fixi HTTP library. The project has two goals: to provide an ESM version of fixi, and offer a lightweight framework to extend and customize behavior (caching, offline support, analytics, accessibility, loading indicators, etc.) without modifying the core library.

## Why a Plugin System for Fixi?

Fixi provides a wonderfully focused core. Plugins let you opt-in only to what's necessary for a specific project. Start with bare-bones Fixi, then progressively add capabilities as your applications demand. This approach allows Fixi to grow its capabilities without growing its footprint.

## Core Features

- 🔌 **Modular Plugin System** - Compose functionality with small, focused plugins
- 🪝 **Lifecycle Hooks** - Intercept and modify requests/responses at various stages
- 🛡️ **Robust Error Handling** - Fallbacks, circuit breakers, and error recovery
- ⚡ **High Performance** - Designed for minimal overhead and maximum speed
- 🧩 **Extensible Architecture** - Create custom plugins for your specific needs

## Getting Started

### Installation

```bash
npm install fixiplug
```

### Basic Usage

```javascript
import { createFixiWithPlugins } from 'fixiplug';
import { CachePlugin, LoggingPlugin, OfflinePlugin } from 'fixiplug/plugs';

// Create an enhanced Fixi instance with plugins
const fixi = createFixiWithPlugins([
  LoggingPlugin,
  CachePlugin.configure({ maxAge: 600000 }),
  OfflinePlugin
]);

// Use like regular Fixi
const response = await fixi.get('https://api.example.com/data');
```

## Built-in Plugins

FixiPlugs comes with several built-in plugins:

- **LoggingPlugin** - Comprehensive request/response logging with metrics
- **CachePlugin** - Browser and memory caching strategies
- **OfflinePlugin** - Handle requests when offline
- **LoadingPlugin** - Simplified loading indicators for UI
- **AnalyticsPlugin** - Collect and analyze API usage data
- **AccessibilityPlugin** - Improve accessibility during loading states

## Creating Custom Plugins

Plugins are just objects that implement specific hook methods:

```javascript
import { createPlugin } from 'fixiplug';

const MyPlugin = createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  // Hook into request lifecycle
  beforeRequest(context) {
    // Modify request config
    context.config.headers = {
      ...context.config.headers,
      'X-Custom-Header': 'value'
    };
    return context.config;
  },
  
  // Process responses
  afterResponse(context) {
    // Process response
    console.log(`Received ${context.response.data.length} bytes`);
    return context.response;
  }
});
```

## Plugin Lifecycle

Plugins can hook into these key lifecycle points:

- `beforeRequest` - Modify request config before sending
- `afterResponse` - Process or transform response data
- `onError` - Handle request errors
- `onInitialize` - Run when plugin is first registered
- `onDestroy` - Clean up resources when plugin is removed
- `onDomMutated` - React to DOM changes (for UI-related plugins)

## Advanced Features

FixiPlugs includes several advanced capabilities:

- **Conditional Execution** - Run hooks only when specific conditions are met
- **Hook Prioritization** - Control execution order of plugins
- **Circuit Breakers** - Prevent cascading failures
- **Dependency Management** - Define plugin dependencies
- **Lazy Loading** - Load plugins only when needed
- **Extension System** - Enhance plugin manager functionality

## License

MIT
