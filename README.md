# FixiPlug

FixiPlug aims to provide a plugin wrapper for fixi.js. Fixi.js is already easily extensible, so why bother? Imagine a scenario where you want to run multiple swappable extensions; this might be early in your dev process when you need optimal debug logging as well as a streamlined pre-production build. FixiPlug wants to make that easy -- maybe even hot swappable -- through a framework for testing extension interoperability. We'll also (try to) honor the fixi core philosophy: no dependencies and careful attention to character count. [fixi.js](https://github.com/bigskysoftware/fixi/blob/master/fixi.js) is an experimental, minimalist implementation of [generalized hypermedia controls](https://dl.acm.org/doi/fullHtml/10.1145/3648188.3675127)

## FixiPlug Usage

### Quick Start with CLI

FixiPlug provides a command-line interface for quickly setting up different environments:

```bash
# Install fixiplug globally
npm install -g fixiplug

# Set up a browser environment
npx fixiplug init:browser

# Set up a test environment
npx fixiplug init:test

# Set up a server environment
npx fixiplug init:server

# Set up a minimal environment (no plugins or environment detection)
npx minimal-fixiplug init:minimal

# Show help
npx fixiplug help
```

Each command sets up a basic project structure with templates for the selected environment.

For more details on the minimal version, see the [Minimal Fixiplug Guide](./docs/minimal-fixiplug.md).


## Import Options

FixiPlug now offers a unified package with different variants to match your specific needs:

```javascript
// Full browser version with DOM integration
import { fixiplug } from 'fixiplug';

// Core version without DOM dependencies 
import { core } from 'fixiplug';

// Test version with enhanced debugging
import { test } from 'fixiplug';

// Server optimized version
import { server } from 'fixiplug';

// Auto-detecting version (recommended)
import { auto } from 'fixiplug';

// Minimal version with no plugins or environment detection
import minimal from 'fixiplug/minimal';

// Or configure your own
import { configure } from 'fixiplug';
const custom = configure({
  logging: true,
  dom: false,
  test: true
});
```

## Creating Plugins

Plugins are simple objects that expose a setup function:

```javascript
// Simple logger plugin
const loggerPlugin = {
  name: 'simple-logger',
  setup(context) {
    // Register event listeners
    context.on('init', event => {
      console.log('Init event:', event);
      return event; // Return the event to continue the chain
    });
    
    // Optional cleanup function
    context.registerCleanup(() => {
      console.log('Plugin cleanup');
    });
  }
};

// Use the plugin
fixiplug.use(loggerPlugin);
```

## Dispatching Events

Events can be dispatched and will trigger registered handlers:

```javascript
// Dispatch a named event with data
fixiplug.dispatch('init', { source: 'example' })
  .then(result => {
    console.log('Event processed:', result);
  });
```

## Included Plugins

FixiPlug comes with several useful plugins:

- `logger`: Detailed logging of events and timing
- `errorReporter`: Catches and reports errors in the event pipeline
- `performance`: Measures and reports plugin execution time
- `security`: Validates event data against schemas
- `hookVisualizer`: Visual representation of hook execution (browser only)

```javascript
// Import specific plugins
import { logger, errorReporter } from 'fixiplug/plugins';

// Use plugins
fixiplug.use(logger());
fixiplug.use(errorReporter({ reportTo: '/api/errors' }));
```

See the [full documentation](#) for plugin options and configuration.

# 💀 *Memento Mori*

Nothing lasts forever, including this plugin. Approach digital eternity with an appropriate level of suspicion. Consider this a thought experiment, built explicitly to explore the problem space. Please take liberally and build much more wisely.
