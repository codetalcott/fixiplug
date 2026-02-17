# FixiPlug

Event-driven plugin framework. Zero dependencies. ~30KB.

Built on [fixi.js](https://github.com/bigskysoftware/fixi).

## Install

```bash
npm install @fixiplug/core
```

## Quick Start

```javascript
import { createFixiplug } from "@fixiplug/core";

const fp = createFixiplug({ features: ["logging"] });

// Create a plugin
const greeter = {
  name: "greeter",
  setup(ctx) {
    ctx.on("greet", (data) => {
      console.log(`Hello, ${data.name}!`);
      return { ...data, greeted: true };
    });
  }
};

fp.use(greeter);

// Dispatch events
const result = await fp.dispatch("greet", { name: "World" });
// => Hello, World!
// result.greeted === true
```

## Core Concepts

**Plugins** register event handlers through a `setup(context)` function.
**Hooks** are named events that flow through the plugin chain.
**Dispatch** sends an event through all registered handlers, sorted by priority.

```javascript
// Priorities control execution order (higher runs first)
const PRIORITY = { HIGH: 100, NORMAL: 0, LOW: -100 };

const validator = {
  name: "validator",
  setup(ctx) {
    ctx.on("form:submit", (data) => {
      if (!data.email) throw new Error("Email required");
      return data;
    }, PRIORITY.HIGH);  // runs before normal handlers
  }
};
```

## Features

Pass features to `createFixiplug()` to enable built-in behavior:

| Feature | Description |
|---------|-------------|
| `logging` | Console logging for dispatches and plugin lifecycle |
| `dom` | DOM integration (MutationObserver, event handling, fx-action elements) |
| `testing` | Test utilities (hook mocking, dispatch tracking) |
| `server` | Server-optimized settings |

```javascript
// Browser with DOM integration (returns a Promise)
const fp = await createFixiplug({ features: ["dom", "logging"] });

// Server-side
const fp = createFixiplug({ features: ["server"] });

// Testing
const fp = createFixiplug({ features: ["testing", "logging"] });
```

## Bundled Plugins

11 utility plugins ship with `@fixiplug/core`:

| Plugin | Purpose |
|--------|---------|
| `logger` | Event logging |
| `hook-visualizer` | Visual hook execution display |
| `performance` | Execution timing |
| `security` | Input validation |
| `error-reporter` | Error capture and reporting |
| `testing` | Mock hooks and track dispatches |
| `offline` | Offline detection and queuing |
| `data-pipeline` | Data transformation chains |
| `content-modifier` | Content modification |
| `swap-idiomorph` | DOM morphing (idiomorph) |
| `swap-morphlex` | DOM morphing (morphlex) |

```javascript
import logger from "@fixiplug/core/plugins/logger";
import performance from "@fixiplug/core/plugins/performance";

fp.use(logger);
fp.use(performance);
```

## Plugin API

Every plugin is an object with `name` and `setup`:

```javascript
const myPlugin = {
  name: "my-plugin",
  setup(ctx) {
    // ctx.on(hookName, handler, priority?) — listen for events
    // ctx.off(hookName, handler) — remove listener
    // ctx.emit(hookName, event) — emit deferred event
    // ctx.storage — Map for plugin-local state
    // ctx.pluginName — this plugin's name
    // ctx.registerCleanup(fn) — cleanup on unuse()

    ctx.on("my:event", (data) => {
      ctx.storage.set("lastEvent", data);
      return { ...data, processed: true };
    });
  }
};
```

## Instance API

```javascript
fp.use(plugin)          // Register a plugin
fp.unuse("pluginName")  // Remove a plugin (runs cleanup)
fp.swap("old", newPlug) // Replace one plugin with another
fp.enable("name")       // Re-enable a disabled plugin
fp.disable("name")      // Disable without removing

await fp.dispatch("hookName", data)  // Send event through handlers
fp.off("hookName", handler)          // Remove specific handler

fp.getPlugins()         // List registered plugin names
fp.getPluginsInfo()     // Detailed plugin info
fp.hasFeature("dom")    // Check if feature is enabled
```

## Agent SDK (optional)

For LLM agent integration (OpenAI function calling, Anthropic tool use):

```bash
npm install @fixiplug/agent-sdk
```

```javascript
import { FixiPlugAgent, OpenAIAdapter } from "@fixiplug/agent-sdk";

const agent = new FixiPlugAgent(fp);
const adapter = new OpenAIAdapter(agent);

// Generate tool definitions for your LLM
const tools = await adapter.getToolDefinitions();
```

See [packages/agent-sdk](packages/agent-sdk/) for full documentation.

## Writing a Plugin

1. Create a file exporting an object with `name` and `setup`
2. Register hooks in `setup(context)`
3. Return skill metadata if the plugin provides LLM capabilities

```javascript
// plugins/word-counter.js
export default {
  name: "word-counter",
  setup(ctx) {
    ctx.on("text:analyze", (data) => {
      const words = data.text.split(/\s+/).length;
      return { ...data, wordCount: words };
    });
  }
};
```

## TypeScript

Full type definitions are included:

```typescript
import type { ConfigOptions, PluginContext } from "@fixiplug/core";
```

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Requires ES6 modules.

## License

MIT
