# Fixiplug Environment Detection Guide

Fixiplug provides a powerful environment detection system that automatically adapts to your runtime environment. This guide explains how it works and how you can customize it.

## Automatic Environment Detection

Fixiplug can detect:

- **Runtime Environment**: Browser, Node.js, or Deno
- **Test Environments**: Jest, Mocha, Jasmine, etc.
- **Development vs Production**: Based on URL, NODE_ENV, etc.

### Using Auto-detected Configuration

```javascript
// Import the auto-configured version
import { auto } from 'fixiplug';

// Use it just like any other fixiplug instance
auto.use(myPlugin);
auto.dispatch('init', {});

// Check detected environment
console.log(auto.config); 
// {
//   enableLogging: true, // false in production
//   enableDom: true,     // true in browser, false in Node.js
//   testMode: false,     // true in test environments
//   serverMode: false,   // true in Node.js server environment
//   detectedEnv: 'browser',
//   isProduction: false,
//   isDevelopment: true
// }
```

## Overriding Environment Detection

### Option 1: Using the `configure()` function

```javascript
import { configure } from 'fixiplug';

// Create a custom instance with auto-detection plus overrides
const myFixiplug = configure({
  // Use auto-detection but override specific settings
  logging: true,     // force logging on
  test: false,       // force test mode off
  
  // Optional: disable auto-detection completely
  autoDetect: false
});
```

### Option 2: Using the `forceEnvironment()` function

```javascript
import { forceEnvironment, auto, configure } from 'fixiplug';

// Force specific environment flags
forceEnvironment({
  isProduction: true,
  isTest: true
});

// All new instances will respect these settings
const myFixiplug = configure();

// Reset to normal detection
forceEnvironment(null);
```

## Detection Logic

### Browser Detection
- Checks for `window` and `document` objects
- Detects browser test frameworks (Jest, Mocha, Jasmine, etc.)
- Production is determined by:
  - Non-localhost URLs
  - Absence of dev tools
  - Explicit environment flags

### Node.js Detection
- Checks for `process.versions.node`
- Detects Node.js test runners
- Production is determined by `NODE_ENV=production`

### Deno Detection
- Checks for `typeof Deno !== 'undefined'`
- Production is determined by `DENO_ENV=production`

## Refreshing Environment Detection

If your application needs to react to environment changes during runtime, you can refresh the detection:

```javascript
import { auto, refreshEnvironment } from 'fixiplug';

// Use the auto-configured version
auto.use(myPlugin);

// Later, if environment changes (e.g., switching to production mode)
refreshEnvironment(); // Clears cache and forces re-detection

// Update the auto instance to use new environment settings
auto.refreshConfig();

// Now auto.config reflects the current environment
console.log(auto.config.enableLogging); // Will be false if production mode was detected
```

This is particularly useful for:
- Single-page applications that might change environment during runtime
- Testing different environments without reloading the application
- Server applications that need to adapt to environment changes

## Global Overrides

You can force environment settings by setting a global flag:

```javascript
// Force production mode
globalThis.__FIXIPLUG_PRODUCTION__ = true;

// Or set detailed environment overrides
globalThis.__FIXIPLUG_ENV_OVERRIDE__ = {
  isProduction: true,
  isTest: true
};
```

## Best Practices

1. For most use cases, simply import and use the `auto` version
2. For testing, use the `test` version or `forceEnvironment({ isTest: true })`
3. For configuration that changes at runtime, use `configure()` or `auto.refreshConfig()`
4. If auto-detection doesn't work for your environment, use `forceEnvironment()`
