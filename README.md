# FixiPlug: Improved Fixi Plugin System
<!-- Badges -->
[![npm version](https://img.shields.io/npm/v/fixi-plugins.svg)](https://www.npmjs.com/package/fixi-plugins)  
[![Build Status](https://github.com/your-org/fixiplug/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fixiplug/actions/workflows/ci.yml)  
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FixiPlug is a high-performance, composable plugin system for the Fixi HTTP library. It enables developers to extend and customize behavior (caching, offline support, analytics, accessibility, loading indicators, etc.) without modifying the core library.

## Features
- Priority-based hooks (beforeRequest, afterResponse, onDomMutated, initialize, destroy, error)
- Circuit-breaker, timeouts, fallbacks for reliability
- Lazy-loaded plugins and dependency management
- Plugin SDK with utilities (JSON fetch, ID generator, delay, types)
- CLI generator to scaffold new plugins from JSON schema
- Built-in demo plugins: logging, caching, offline, loading, analytics, accessibility
- Comprehensive Jest tests and GitHub Actions CI

## Installation
```bash
npm install fixi fixi-plugins
```

## Quick Start
```typescript
import Fixi from './fixi.js';
import { createPluginSystem } from './plugin'; // see [API docs](./fixi.d.ts)

const fixi = new Fixi({ baseUrl: 'https://api.example.com' });
const fx = createPluginSystem(fixi, {
  plugins: [
    // Add built-in or custom plugins here
  ]
});

// Perform requests with plugin support
eventualResponse = await fx.get('/users');
```

## Plugin SDK
A dedicated package under `plugin-sdk/` provides:
- `safeJsonFetch`, `delay`, `generatePluginId`
- TypeScript definitions for PluginHook, PluginContext, FixiPlugin, etc.

Install it separately:
```bash
npm install @fixi/plugin-sdk
```

## CLI Generator
Scaffold a new plugin stub by running:
```bash
npm run generate:plugin -- --interactive
# or
npm run generate:plugin -- path/to/plugin-manifest.json
```

The generator validates against `plugin-manifest.schema.json` and writes a TypeScript stub under `plugins/`.
See [manifest schema](./plugin-manifest.schema.json) or [advanced CLI usage](./next-plugins.md).

## Plugins Folder
`plugins/` contains built-in demo plugins (see docs in `/plugins`):
  - `loggingPlugin.ts`  • Request/response logging
  - `cachePlugin.ts`    • GET response caching with TTL
  - `offlinePlugin.ts`  • Queue and retry when offline
  - `loadingPlugin.ts`  • Toggle CSS loading indicator
  - `analyticsPlugin.ts`• Track custom analytics events
  - `accessibilityPlugin.ts` • ARIA live region and focus management

## Testing
Run all unit and performance tests:
```bash
npm test
```

## Examples
Below is a typical setup combining multiple plugins:
```typescript
import Fixi from './fixi.js';
import { createPluginSystem } from './plugin';
import { LoggingPlugin } from './plugins/loggingPlugin';
import { CachePlugin } from './plugins/cachePlugin';

const fx = createPluginSystem(new Fixi({ baseUrl: '/api' }), {
  plugins: [
    LoggingPlugin.configure({ level: 'debug' }),
    CachePlugin.configure({ ttl: 300000 }),
  ]
});
// Now fx.get/post etc. include logging and caching
await fx.get('/users');
```
Expand on these patterns in [Examples guide](./examples.txt).

## Continuous Integration
A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push and PR:
1. `ajv` manifest validation
2. `tsc --noEmit` in root and `plugin-sdk`
3. `npm test` (Jest)
4. `eslint` and `prettier --check`

## Contributing
1. Fork and clone the repo
2. Create a feature branch
3. Run `npm install` and `npm test`
4. Commit with [conventional commits]
5. Open a pull request for review

## License
MIT © Fixi Team