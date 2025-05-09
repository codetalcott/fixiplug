# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FixiPlug is a plugin system for fixi.js, a minimalist implementation of generalized hypermedia controls. FixiPlug aims to make it easy to run multiple swappable extensions, with a focus on the fixi core philosophy: no dependencies and careful attention to character count.

## Project Structure

- `/core/`: Core functionality modules including fixi integration
- `/plugins/`: Individual plugins that can be used with fixiplug
- `/builder/`: Factory and manager files for creating fixiplug instances
- `/examples/`: Example implementations and demos
- `/docs/`: Documentation for various features
- `/test/`: Test files for the project

## Import Options

FixiPlug offers different variants to match specific needs:

```javascript
// Full browser version with DOM integration
import { fixiplug } from 'fixiplug';

// Core version without DOM dependencies 
import { core } from 'fixiplug';

// Test version with enhanced debugging
import { test } from 'fixiplug';

// Server optimized version
import { server } from 'fixiplug';

// Minimal version with no plugins
import minimal from 'fixiplug/minimal';
```

## Plugin Development

Plugins are objects that expose a setup function:

```javascript
const myPlugin = {
  name: 'my-plugin',
  setup(context) {
    // Register event listeners
    context.on('eventName', event => {
      console.log('Event received:', event);
      return event; // Return the event to continue the chain
    });
    
    // Optional cleanup function
    context.registerCleanup(() => {
      console.log('Plugin cleanup');
    });
  }
};

// Use the plugin
fixiplug.use(myPlugin);
```

## Development Commands

### Running Tests

```bash
# Open the test HTML file in a browser
open test/fixiplug.test.html
```

The tests run in-browser and are accessible through the HTML test page.

### Common Plugin Operations

```javascript
// Register a plugin
fixiplug.use(myPlugin);

// Disable a plugin
fixiplug.disable('myPlugin');

// Re-enable a plugin
fixiplug.enable('myPlugin');

// Remove a plugin
fixiplug.unuse('myPlugin');

// Dispatch an event
fixiplug.dispatch('eventName', { data: value })
  .then(result => {
    console.log('Event processed:', result);
  });
```

## Core Architecture

FixiPlug is built around a plugin system that allows for:

1. **Event-Based Architecture**: Plugins can listen for and react to events using the context.on() method.
2. **Hooks and Priorities**: Events can be prioritized to control execution order.
3. **Build Variants**: Different builds can be used based on specific needs (browser, server, test).
4. **Cleanup Handling**: Plugins can register cleanup functions to ensure proper resource management.

The main components are:

- **FixiPlug Factory**: Creates configured instances of FixiPlug
- **Plugin Manager**: Handles plugin registration, enabling/disabling, and removal
- **Core Event System**: Dispatches events and manages the execution of handlers

## Working with Plugins

The repository includes several built-in plugins:

- `logger`: Detailed logging of events and timing
- `errorReporter`: Catches and reports errors in the event pipeline
- `performance`: Measures and reports plugin execution time
- `security`: Validates event data against schemas
- `hookVisualizer`: Visual representation of hook execution (browser only)

When developing new code, follow these practices:

1. Check existing plugins for patterns and conventions
2. Test plugin interoperability with multiple activated plugins
3. Return events from handlers to maintain the event chain
4. Register cleanup functions for resource management