# Plan: Separate Core from Experiments

## Goal

Make FixiPlug publishable as a clean, focused plugin framework. Move experimental
and specialized code out of the critical path so new users see a coherent product,
not a research lab.

## Guiding principles

1. **The core package should have zero dependencies** — just the hook system, event
   dispatch, factory, and bundled utility plugins.
2. **Experiments stay in this repo** (for now) but move to a clearly-labeled area
   that's excluded from the published package.
3. **Use npm workspaces** — the `packages/` directory already has a `core/` start.
   Add workspaces for the agent SDK and plugins that depend on external services.
4. **Don't break existing tests** — move files, update imports, verify tests pass.

---

## Step 1: Clean up root-level clutter

Move or remove ~35 files that currently sit at the repo root and make the project
feel unfinished.

### Move to `docs/notes/` (internal reference, not published):

```
AGENT_PLUGINS.md
CODE_COMPLEXITY_ASSESSMENT.md
DOM_DELEGATION_TEST_RESULTS.md
IMPLEMENTATION_SUMMARY.md
MCP_CODE_IMPROVEMENTS.md
MCP_SERVER_DESIGN.md
MCP_SERVER_IMPLEMENTATION_SUMMARY.md
MCP_SERVER_VALIDATION.md
QUICKSTART-TABLE.md
ROADMAP_ANALYSIS.md
SKILL_OPTIMIZATION_PLAN.md
SKILL_RETRIEVAL_IMPLEMENTATION.md
TABLE-PLUGIN-SUMMARY.md
TYPE_CHECK_FINAL.md
TYPE_CHECK_IMPROVEMENTS.md
TYPE_CHECK_REPORT.md
claude-agent-sdk.md
metrics-dashboard.md
suggestions.md
CLAUDE.md.backup
```

### Move to `test/scratch/` (ad-hoc test scripts, not published):

```
benchmark-performance.js
debug-features.js
debug-features-detailed.js
test-agent-integration.js
test-agent-plugins.html
test-clean-logging.js
test-clean-start.js
test-ctx-emit.js
test-fresh-logging.js
test-introspection.js
test-logging-consolidated.js
test-performance.js
test-state-tracker-simple.js
test-state-tracker-timeout-debug.js
test-state-tracker.js
test-table-features.html
test-table-plugin.js
test-table.html
verify-table-plugin.js
demo-table.html
```

### Keep at root:

```
README.md         — rewrite for the published project
CLAUDE.md         — internal, excluded via .npmignore
package.json      — becomes workspace root
fixiplug.js       — main entry point
tsconfig.json
```

---

## Step 2: Reorganize plugins into tiers

The `plugins/` directory currently has 36 files with no visible organization.
Split them into directories by tier.

### `plugins/` — ships with core (9 plugins, already in plugins.json/bundles.json)

These are the utility plugins listed in `builder/plugins.json`:

```
plugins/
  logger.js
  hook-visualizer.js
  performance.js
  security.js
  error-reporter.js
  testing.js
  offline.js
  data-pipeline.js
  content-modifier.js
```

Plus the two DOM swap strategies (referenced by core features):

```
  swap-idiomorph.js
  swap-morphlex.js
```

### `packages/agent-sdk/` — new workspace package

Move the LLM integration layer into its own publishable package:

```
packages/agent-sdk/
  package.json          — @fixiplug/agent-sdk, depends on @fixiplug/core
  index.js
  agent-client.js       ← from sdk/agent-client.js
  workflow-builder.js   ← from sdk/workflow-builder.js
  types.d.ts            ← from sdk/types.d.ts
  adapters/
    base-adapter.js     ← from sdk/adapters/base-adapter.js
    openai-adapter.js   ← from sdk/adapters/openai-adapter.js
    anthropic-adapter.js ← from sdk/adapters/anthropic-adapter.js
    tool-definitions.js ← from sdk/adapters/tool-definitions.js
```

Dependencies: `yaml` (for SKILL.md parsing), `@fixiplug/core`.
Optional peer deps: `openai`, `@anthropic-ai/sdk`.

### `experiments/` — new top-level directory (not published)

Everything exploratory moves here:

```
experiments/
  plugins/
    introspection.js          — advanced, tightly coupled to agent SDK
    state-tracker.js          — 22KB, complex
    skill-versioning.js
    skill-md-loader.js
    dom-delegation.js
    table.js                  — 51KB
    form-schema.js            — 38KB
    agent-commands.js          — 31KB
    fixi-agent.js             — 29KB
    capability-registry.js
    django-integration.js
    hono-sync.js
    fetch-logger.js
    fetch-cache.js
    django-workflows-skill.js
    error-recovery-skill.js
    form-workflows-skill.js
    reactive-ui-patterns-skill.js
    sqlite-pattern-learner.js
    sqlite-extension-generator.js
    sqlite-agent-amplification.js
    sqlite-agent-context.js
  sqlite-framework/           ← from sdk/adapters/sqlite-framework/
  mcp-server/                 ← from mcp-server/
  playground/                 ← from playground/
  skills/                     ← from .claude/skills/
  examples/                   ← from examples/ (most of them)
```

---

## Step 3: Set up npm workspaces

Update root `package.json`:

```json
{
  "name": "fixiplug-workspace",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/agent-sdk"
  ],
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node test/run-all.js",
    "build:core": "cd packages/core && bash build.sh"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "typescript": "^5.9.3"
  }
}
```

Remove `yaml`, `zod`, `@anthropic-ai/claude-agent-sdk` from root — they belong
in the packages that actually use them.

### `packages/core/package.json` (already exists, refine):

```json
{
  "name": "@fixiplug/core",
  "version": "0.1.0",
  "description": "Event-driven plugin framework with hooks system",
  "type": "module",
  "main": "./index.js",
  "exports": {
    ".": { "import": "./index.js", "types": "./types.d.ts" },
    "./dom": { "import": "./dom.js", "types": "./types.d.ts" },
    "./plugins/*": "./plugins/*.js"
  },
  "files": ["*.js", "*.d.ts", "plugins/"],
  "keywords": ["plugin", "hooks", "events", "framework"],
  "license": "MIT",
  "engines": { "node": ">=18" }
}
```

Zero dependencies.

### `packages/agent-sdk/package.json` (new):

```json
{
  "name": "@fixiplug/agent-sdk",
  "version": "0.1.0",
  "description": "LLM agent integration for FixiPlug",
  "type": "module",
  "main": "./index.js",
  "dependencies": {
    "@fixiplug/core": "workspace:*",
    "yaml": "^2.3.4"
  },
  "peerDependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.50.0"
  },
  "peerDependenciesMeta": {
    "openai": { "optional": true },
    "@anthropic-ai/sdk": { "optional": true }
  }
}
```

---

## Step 4: Update the core build

Revise `packages/core/build.sh` to also copy the bundled plugins:

```bash
# Copy core framework
cp core/hooks.js packages/core/
cp core/fixi-core.js packages/core/
cp core/fixi-dom.js packages/core/

# Copy factory
cp builder/fixiplug-factory.js packages/core/
sed -i "s|from '../core/|from './|g" packages/core/fixiplug-factory.js

# Copy bundled plugins
mkdir -p packages/core/plugins
for plugin in logger hook-visualizer performance security \
              error-reporter testing offline data-pipeline \
              content-modifier swap-idiomorph swap-morphlex; do
  cp plugins/${plugin}.js packages/core/plugins/
done
```

---

## Step 5: Slim down README.md

Rewrite the root README to focus on what core does:

```markdown
# FixiPlug

Event-driven plugin framework. Zero dependencies. ~30KB.

## Install

npm install @fixiplug/core

## Quick start

import { createFixiplug } from '@fixiplug/core';
const fp = createFixiplug({ features: ['logging'] });
fp.dispatch('my:event', { data: 123 });

## Plugins

9 built-in plugins: logger, performance, security, testing, ...

## Agent SDK (optional)

npm install @fixiplug/agent-sdk
```

Move the current 500+ line README to `docs/FULL_README.md`.

---

## Step 6: Add .npmignore / files field

Ensure the published packages don't include experiments:

```
# root .npmignore
experiments/
docs/
test/
roadmap/
.claude/
.agent-assist/
*.backup
```

---

## Step 7: Update imports and verify

After moving files, grep for broken imports and fix them:

```bash
# Find all import statements referencing old paths
grep -r "from ['\"]\.\./" packages/ experiments/ --include="*.js"
grep -r "from ['\"]\./" packages/ experiments/ --include="*.js"
```

Run existing tests to verify nothing broke:

```bash
node test/fetch-interceptors.test.js
node test/skill-lifecycle.test.js
node test/skill-retrieval.test.js
node test/skill-md-loader.test.js
node playground/backend/test/server.test.js
```

---

## Step 8: Keep a few examples at root level

Move most examples to `experiments/examples/`, but keep 2-3 minimal ones that
demonstrate core usage:

```
examples/
  basic-plugin.js       — create a plugin, dispatch events (NEW, simple)
  custom-hooks.js       — hook priorities, before/after (NEW, simple)
```

---

## Summary of what ships vs what doesn't

### Published: `@fixiplug/core` (~30KB)

- Hook system (on, off, dispatch, priorities)
- Plugin lifecycle (register, enable, disable)
- Factory with feature sets
- 11 utility plugins
- DOM integration (optional import)
- TypeScript types

### Published: `@fixiplug/agent-sdk` (~70KB)

- FixiPlugAgent class
- OpenAI adapter
- Anthropic adapter
- Dynamic skill retrieval
- Workflow builder

### Not published (stays in repo under `experiments/`):

- 22 experimental/specialized plugins (~350KB)
- SQLite framework bridge (~150KB)
- MCP server
- Playground app
- Skill .md files
- Session docs, roadmaps, notes
- Ad-hoc test scripts

### File count impact:

- **Before**: ~200 files, no clear entry point, 36 plugins
- **After (core)**: ~20 files, clear entry point, 11 plugins
- **After (agent-sdk)**: ~10 files, focused on LLM integration

---

## Migration order

1. Create `experiments/` and `docs/notes/`, `test/scratch/`
2. Move clutter files (Step 1) — low risk, no import changes
3. Move experimental plugins (Step 2) — update any cross-references
4. Set up workspaces (Step 3) — update root package.json
5. Create agent-sdk package (Step 2) — move sdk/ files, update imports
6. Update build script (Step 4)
7. Rewrite README (Step 5)
8. Verify tests (Step 7)
9. Write minimal examples (Step 8)

Steps 1-2 can be done in one commit. Steps 3-5 in another. Steps 6-9 as a final commit.
