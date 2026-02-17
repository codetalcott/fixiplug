# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

FixiPlug is a modular, event-driven plugin framework. The repo is organized as an npm workspace with two publishable packages and an experiments area.

### Repository Structure

```
fixiplug/
├── core/                    # Framework engine (hooks, events, dispatch)
├── builder/                 # Factory (createFixiplug) and plugin manager
├── plugins/                 # 11 bundled utility plugins
├── sdk/                     # Agent SDK source (LLM adapters)
├── packages/
│   ├── core/                # @fixiplug/core — publishable package
│   └── agent-sdk/           # @fixiplug/agent-sdk — publishable package
├── test/                    # Core tests
│   ├── sdk/                 # SDK browser tests
│   └── scratch/             # Ad-hoc test scripts (not maintained)
├── experiments/             # Experimental/specialized code (not published)
│   ├── plugins/             # 22 experimental plugins
│   ├── playground/          # Full-stack demo app (Express + frontend)
│   ├── mcp-server/          # MCP server (TypeScript)
│   ├── sqlite-framework/    # SQLite extensions bridge
│   ├── skills/              # SKILL.md files for Claude Code
│   ├── examples/            # Usage examples
│   ├── test/                # Tests for experimental features
│   ├── utils/               # Export utilities
│   └── roadmap/             # Planning documents
├── docs/                    # Published docs
│   └── notes/               # Internal notes, session summaries
├── utils/                   # Shared utilities (logger, validation)
├── examples/                # Minimal core examples
├── fixiplug.js              # Main entry point
├── package.json             # Workspace root
└── CLAUDE.md                # This file
```

## Commands

### Testing

```bash
# Core browser tests (open in browser)
open test/fixiplug.test.html
open test/event-buffering.test.html

# SDK browser tests
open test/sdk/agent-client.test.html
open test/sdk/openai-adapter.test.html
open test/sdk/anthropic-adapter.test.html

# TypeScript type checking
npx tsc --noEmit

# Syntax validation
node --check <file.js>
```

### Build

```bash
# Build @fixiplug/core package
cd packages/core && bash build.sh

# Build @fixiplug/agent-sdk package
cd packages/agent-sdk && bash build.sh

# No build step for development — uses ES6 modules directly
```

### Experimental Features

```bash
# Playground (requires experiments/playground/)
cd experiments/playground && npm install && npm start

# Experimental tests
node experiments/test/fetch-interceptors.test.js
node experiments/test/skill-lifecycle.test.js
node experiments/test/skill-retrieval.test.js
node experiments/test/skill-md-loader.test.js
```

## Architecture

### Core Layer

- **`core/fixi-core.js`** — Base Fixi class, hook dispatch engine
- **`core/hooks.js`** — Hook lifecycle (register, unregister, enable, disable, priorities)
- **`core/fixi-dom.js`** — DOM integration (MutationObserver, fx-action, event buffering)
- **`builder/fixiplug-factory.js`** — Factory function, features, plugin context

### Plugin Layer (11 bundled plugins)

- `logger.js` — Event logging
- `hook-visualizer.js` — Visual hook execution display
- `performance.js` — Execution timing
- `security.js` — Input validation
- `error-reporter.js` — Error capture
- `testing.js` — Hook mocking, dispatch tracking
- `offline.js` — Offline detection
- `data-pipeline.js` — Data transformation
- `content-modifier.js` — Content modification
- `swap-idiomorph.js` / `swap-morphlex.js` — DOM morphing strategies

### Agent SDK Layer (`sdk/`)

- **`agent-client.js`** — FixiPlugAgent class (discovery, state, workflows, caching)
- **`adapters/base-adapter.js`** — Shared adapter logic
- **`adapters/openai-adapter.js`** — OpenAI function calling
- **`adapters/anthropic-adapter.js`** — Anthropic tool use
- **`adapters/tool-definitions.js`** — Dynamic tool generation from plugins

### Experiments (`experiments/`)

Experimental and specialized code that is **not published**:

- **22 plugins**: introspection, state-tracker, table (51KB), form-schema (38KB), agent-commands, DOM delegation, fetch interceptors, skill plugins, SQLite plugins, etc.
- **Playground**: Express.js backend + vanilla JS frontend for testing
- **MCP Server**: TypeScript Model Context Protocol implementation
- **SQLite Framework**: Bridge to Python SQLite extensions
- **Skills**: SKILL.md files for Claude Code compatibility

## Code Style

- **Indentation**: 2 spaces
- **Quotes**: Double quotes
- **Semicolons**: Required
- **Modules**: ES6 (import/export)
- **Async**: Prefer async/await
- **Naming**: PascalCase (classes), camelCase (functions), UPPER_SNAKE_CASE (constants), _prefix (private)

## Key Patterns

- **Factory**: `createFixiplug({ features: [...] })` returns configured instance
- **Observer**: Plugins register hooks via `context.on(name, handler, priority)`
- **Adapter**: OpenAI/Anthropic adapters wrap the agent client
- **Plugin Context**: Each plugin gets an isolated context with on/off/emit/storage

## Adding a Plugin

1. Create file in `plugins/` with `name` and `setup(context)` export
2. Register hooks in setup: `context.on('hookName', handler, priority)`
3. Optionally return `{ skill: { ... } }` for LLM-accessible metadata
4. Add tests in `test/`

## Packages

### @fixiplug/core

Zero dependencies. Contains the framework engine + 11 bundled plugins.
Built from `core/`, `builder/`, `plugins/` into `packages/core/`.

### @fixiplug/agent-sdk

Depends on `@fixiplug/core` and `yaml`. Provides LLM agent integration.
Built from `sdk/` into `packages/agent-sdk/`.
