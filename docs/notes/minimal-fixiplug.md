# Minimal Fixiplug

Minimal Fixiplug provides a vanilla wrapper for fixi.js with no added plugins, no environment detection, and minimal overhead. It uses the same factory pattern as other Fixiplug variants, maintaining consistency throughout the codebase while eliminating unnecessary features.

This version is ideal for:

- Production environments where you want full control over plugins
- Performance-critical applications
- Custom plugin development with minimal core dependencies
- CLI applications
- Learning how the core plugin system works
- Projects where consistent API behavior is essential across builds

## Usage

### Direct Import

```javascript
// Import the minimal version
import fixiplug from 'fixiplug/minimal';

// Use your own plugins
fixiplug.use(myPlugin);
```

### CommonJS Import

```javascript
// Import the minimal version in CommonJS
const fixiplug = require('fixiplug/minimal.cjs');

// Use your own plugins
fixiplug.use(myPlugin);
```

### CLI Usage

You can use the Minimal Fixiplug CLI to initialize a project:

```bash
# Install globally
npm install -g fixiplug

# Initialize a minimal project
npx minimal-fixiplug init:minimal
```

This will create:
- A minimal fixiplug.js implementation
- A simple HTML file demonstrating usage
- A README with instructions

## Features

The minimal version includes only the essential functionality:

- Plugin registration (`use`, `unuse`, `enable`, `disable`)
- Hook dispatching system
- Priority-based event handling
- No built-in plugins
- No environment detection
- Lightweight core (< 4KB gzipped)
- Consistent API with other Fixiplug variants

## Architecture

Minimal Fixiplug uses the same factory pattern as other Fixiplug variants, ensuring consistent behavior while removing unnecessary features:

```javascript
// From fixiplug.js
export const minimal = createFixiplug({
  enableLogging: false,
  enableDom: false,
  testMode: false,
  serverMode: false,
  minimal: true
});
```

This approach means:
1. The same core functionality is available in all variants
2. The API remains consistent across all builds
3. The minimal flag disables only non-essential features
4. All plugins developed for the minimal version will work with other variants

## Integrating with fixi.js

When used in a browser environment, minimal fixiplug will automatically connect to fixi.js events:

```javascript
// Your plugin will receive fixi.js events
fixiplug.use({
  name: 'my-plugin',
  setup(ctx) {
    ctx.on('fx:after', (event) => {
      console.log('Content loaded:', event.detail.cfg.text);
      return event;
    });
  }
});
```

## Building Custom Solutions

The minimal version serves as an excellent starting point for custom plugin development:

```javascript
// Create your own plugin
function myPlugin(ctx) {
  // Add event listeners
  ctx.on('init', (event) => {
    console.log('Initialized with:', event);
    return event;
  });
  
  // Clean up when plugin is removed
  ctx.registerCleanup(() => {
    console.log('Plugin cleanup');
  });
}

// Use your plugin
fixiplug.use(myPlugin);

// Dispatch events
fixiplug.dispatch('init', { source: 'example' });
```
