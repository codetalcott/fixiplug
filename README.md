# FixiPlugs: Fixi Plugin System (pre-alpha)
<!-- Badges -->
<!-- [![npm version](https://img.shields.io/npm/v/fixi-plugins.svg)](https://www.npmjs.com/package/fixi-plugins)  
[![Build Status](https://github.com/your-org/fixiplug/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fixiplug/actions/workflows/ci.yml)   -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FixiPlugs aims to provide a composable plugin system for the tiny Fixi HTTP library. The goal: a lightweight framework to extend and customize behavior (caching, offline support, analytics, accessibility, loading indicators, etc.) without modifying the core library.

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

### Options for Basic Usage

### Import bare-frame fixi
<!-- TODO -->

### Import fixi with custom plugs



## Built-in Plugins

FixiPlugs comes with several built-in plugins:

- **LoggingPlugin** - Comprehensive request/response logging with metrics
- **CachePlugin** - Browser and memory caching strategies
- **OfflinePlugin** - Handle requests when offline
- **LoadingPlugin** - Simplified loading indicators for UI
- **AnalyticsPlugin** - Collect and analyze API usage data
- **AccessibilityPlugin** - Improve accessibility during loading states

## Creating Custom Plugins
Plugins are plain objects implementing the FixiPlugs interface, you register them via `createFixiWithPlugins`.
For example:

```ts
import { createFixiWithPlugins } from 'fixiplug';
import type { FixiPlugs, RequestPluginContext } from 'fixiplug';
import { Fixi } from 'fixiplug';

// 1) Define your plugin object
const MyPlugin: FixiPlugs = {
  name: 'my-plugin',
  version: '1.0.0',

  // Run before each request
  // — Intercept and mutate the outgoing RequestConfig (e.g. headers, URL, body)
  beforeRequest(ctx: RequestPluginContext) {
    ctx.config.headers = {
      ...ctx.config.headers,
      'X-Custom-Header': 'Hello from MyPlugin'
    };
    return ctx.config;
  },

  // Run after each response
  // — Inspect or transform the incoming FxResponse before passing it back
  afterResponse(ctx) {
    console.log(`Status was: ${ctx.response.status}`);
    return ctx.response;
  }
};

// 2) Create an enhanced Fixi instance with your plugin
const fixi = createFixiWithPlugins(new Fixi(), {
  plugins: [ MyPlugin ]
});

// 3) Use exactly like Fixi — your hooks will fire automatically
(async () => {
  const res = await fixi.get('https://api.example.com/data');
  console.log(res.data);
})();
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

## Optional Advanced Features

Beyond core priority ordering and basic error handling, these “advanced” capabilities are implemented as standalone extensions in `src/hub/extensions`. Load only what you need:

- **ConditionalExecutionExtension** – Apply rule‑based execution guards  
- **CircuitBreakerExtension** – Stop repeatedly failing plugins  
- **DependencyManagementExtension** – Enforce plugin dependency order  
- **LazyLoadingExtension** – Register plugins as definitions, initializing them on demand  
- **Custom Extensions** – Build your own and add via `fixi.use(...)`

**mode: 'standard'**
By default `createFixiWithPlugins(new Fixi(), { mode: 'standard' })` wires in all of the above extensions. 

**mode: 'performance'**  
Loads only the most performance‑critical extensions (benchmarking, timeouts, circuit breakers), omitting optional features to minimize overhead and maximize throughput.

**mode: 'minimal'**
Loads no built‑in extensions—only the core plugin manager with basic hook ordering and error handling. Use this for maximum speed or to manually add just the extensions you need via `createCustomFixiWithPlugins(...)` or `fixi.use(...)`.

For example:

```js
import { createCustomFixiWithPlugins } from 'fixiplug';
import { Fixi } from 'fixiplug';

// example loading only the circuit‑breaker and lazy‑loading extensions
const fx = createCustomFixiWithPlugins(
  new Fixi(),
  { plugins: [ MyPlugin ] },
  ['CircuitBreakerExtension', 'LazyLoadingExtension']
);
```

If you pass an empty array (or omit that argument), no built‑in extensions are loaded. You can also register extensions one‑by‑one at runtime via `fx.use(...)`

## License

MIT
