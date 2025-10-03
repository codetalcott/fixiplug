# LLM Agent Plugin Implementation Plan

## Overview

This document outlines the phased implementation plan for LLM agent-friendly plugins in FixiPlug. The goal is to enable LLM agents to autonomously discover and interact with FixiPlug-powered applications.

## Success Criteria

- ✅ LLM agents can discover FixiPlug capabilities without reading source code
- ✅ Agents can understand application state and timing
- ✅ Agents can execute workflows with minimal API calls
- ✅ System remains lightweight and maintains FixiPlug philosophy (no dependencies)

---

## Phase 1: Introspection Foundation 🔍

**Timeline:** 1-2 hours
**Priority:** CRITICAL - Foundational infrastructure

### Goals
- Enable LLM agents to discover what FixiPlug can do
- Expose plugin registry, hooks, and capabilities via API
- Provide machine-readable schemas for all components

### Implementation Tasks

#### 1.1 Add Core Getters ([core/fixi-core.js](../core/fixi-core.js))

Add static methods to expose internal state safely:

```javascript
// Add to Fixi class
Fixi.getPluginRegistry = function() {
  return new Map(hooks.pluginRegistry); // Return copy to prevent mutation
};

Fixi.getHooks = function() {
  const hooksCopy = {};
  for (const [name, handlers] of Object.entries(hooks.hooks)) {
    hooksCopy[name] = handlers.map(h => ({
      plugin: h.plugin,
      priority: h.priority
      // Omit handler function for security
    }));
  }
  return hooksCopy;
};

Fixi.getDisabledPlugins = function() {
  return new Set(hooks.disabledPlugins);
};
```

**Why this approach:**
- Returns copies, not references (prevents accidental mutation)
- Maintains encapsulation (internal structure hidden)
- Simple, direct access (no dispatch overhead)
- Easy to test and mock

#### 1.2 Create Introspection Plugin ([plugins/introspection.js](../plugins/introspection.js))

Implement plugin with these API hooks:

**Core APIs:**
- `api:introspect` - Complete FixiPlug state snapshot
- `api:getPluginCapabilities` - List all plugins with metadata
- `api:getAvailableHooks` - List all hooks with schemas
- `api:getPluginDetails` - Detailed info for specific plugin
- `api:getHookSchema` - Schema and docs for specific hook

**Implementation Structure:**
```javascript
export default function introspectionPlugin(ctx) {
  // 1. Complete introspection
  ctx.on('api:introspect', () => { /* ... */ });

  // 2. Plugin capabilities
  ctx.on('api:getPluginCapabilities', () => { /* ... */ });

  // 3. Available hooks
  ctx.on('api:getAvailableHooks', () => { /* ... */ });

  // 4. Plugin details
  ctx.on('api:getPluginDetails', (event) => { /* ... */ });

  // 5. Hook schema
  ctx.on('api:getHookSchema', (event) => { /* ... */ });

  // Helper functions for metadata extraction
}
```

#### 1.3 Schema Inference System

Build intelligent schema inference from hook naming patterns:

```javascript
const HOOK_PATTERNS = {
  'api:*': { type: 'query', returns: 'data', description: 'API query hook' },
  'agent:*': { type: 'command', returns: 'result', description: 'Agent command' },
  'state:*': { type: 'event', returns: 'state', description: 'State event' },
  'internal:*': { type: 'system', returns: 'data', description: 'Internal system hook' }
};
```

#### 1.4 Testing & Validation

**Test Cases:**
```javascript
// Test: Agent discovers all plugins
const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
assert(plugins.capabilities.length > 0);

// Test: Agent explores hooks
const hooks = await fixiplug.dispatch('api:getAvailableHooks');
assert(hooks.hooks['api:introspect'] !== undefined);

// Test: Agent gets complete snapshot
const snapshot = await fixiplug.dispatch('api:introspect');
assert(snapshot.fixiplug.version);
assert(snapshot.fixiplug.capabilities);
```

### Deliverables
- ✅ Core getters implemented
- ✅ Introspection plugin complete
- ✅ Tests passing
- ✅ Documentation in plugin file

---

## Phase 2: State Machine Tracker Plugin 🎯

**Timeline:** 2-3 hours
**Priority:** HIGH - Immediate agent value

### Goals
- Solve async timing problems for LLM agents
- Track application state transitions
- Provide "wait for state" capabilities
- Enable agents to know *when* to act

### Why This Plugin First?
1. **High impact** - Solves real pain point (async coordination)
2. **Independent** - Works standalone, doesn't need other plugins
3. **Validates introspection** - Tests if discovery API actually works
4. **Practical value** - Immediately useful for agent workflows

### Implementation Tasks

#### 2.1 Core State Tracker ([plugins/state-tracker.js](../plugins/state-tracker.js))

```javascript
export default function stateTrackerPlugin(ctx) {
  // State storage
  const currentState = { status: 'idle', data: {} };
  const stateHistory = [];
  const maxHistorySize = 50;

  // Pending waiters
  const waiters = new Map(); // state -> [resolver functions]

  // API implementations...
}
```

**Core APIs:**
- `api:getCurrentState` - Get current application state
- `api:setState` - Transition to new state (with validation)
- `api:waitForState` - Promise that resolves when state reached
- `api:getStateHistory` - Get recent state transitions
- `api:registerStateSchema` - Define valid states and transitions

**Events Dispatched:**
- `state:transition` - Fired on every state change
- `state:entered:{stateName}` - Fired when entering specific state
- `state:exited:{stateName}` - Fired when exiting specific state

#### 2.2 State Transition Logic

```javascript
async function transitionTo(newState, data = {}) {
  const previousState = { ...currentState };

  // Validate transition (if schema defined)
  const schema = ctx.storage.get('stateSchema');
  if (schema && !isValidTransition(previousState.status, newState)) {
    throw new Error(`Invalid transition: ${previousState.status} -> ${newState}`);
  }

  // Update state
  currentState.status = newState;
  currentState.data = data;
  currentState.timestamp = Date.now();

  // Record history
  stateHistory.push({ ...currentState, previous: previousState.status });
  if (stateHistory.length > maxHistorySize) {
    stateHistory.shift();
  }

  // Notify waiters
  resolveWaiters(newState);

  // Dispatch events
  await ctx.dispatch('state:transition', {
    from: previousState.status,
    to: newState,
    data,
    timestamp: currentState.timestamp
  });

  await ctx.dispatch(`state:entered:${newState}`, { data });
  await ctx.dispatch(`state:exited:${previousState.status}`, { data });
}
```

#### 2.3 Wait Mechanism

```javascript
function waitForState(targetState, options = {}) {
  const { timeout = 30000 } = options;

  // Already in target state?
  if (currentState.status === targetState) {
    return Promise.resolve(currentState);
  }

  // Create waiter promise
  return new Promise((resolve, reject) => {
    // Add to waiters
    if (!waiters.has(targetState)) {
      waiters.set(targetState, []);
    }
    waiters.get(targetState).push(resolve);

    // Timeout handler
    if (timeout) {
      setTimeout(() => {
        const waiterList = waiters.get(targetState) || [];
        const index = waiterList.indexOf(resolve);
        if (index > -1) {
          waiterList.splice(index, 1);
          reject(new Error(`Timeout waiting for state: ${targetState}`));
        }
      }, timeout);
    }
  });
}
```

#### 2.4 Common State Patterns

Pre-define common application states:

```javascript
const COMMON_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  COMPLETE: 'complete'
};

// Export for use in applications
ctx.on('api:getCommonStates', () => ({ states: COMMON_STATES }));
```

#### 2.5 Integration Examples

```javascript
// Example: Agent waits for async operation
fixiplug.dispatch('api:setState', { state: 'loading' });

// Agent knows to wait
await fixiplug.dispatch('api:waitForState', {
  state: 'success',
  timeout: 5000
});

// Now agent can proceed
console.log('Operation complete, proceeding...');
```

#### 2.6 Testing & Validation

**Test Cases:**
```javascript
// Test: State transitions
await fixiplug.dispatch('api:setState', { state: 'loading' });
const state = await fixiplug.dispatch('api:getCurrentState');
assert(state.status === 'loading');

// Test: Wait mechanism
const promise = fixiplug.dispatch('api:waitForState', { state: 'success' });
setTimeout(() => fixiplug.dispatch('api:setState', { state: 'success' }), 100);
await promise; // Should resolve

// Test: State history
const history = await fixiplug.dispatch('api:getStateHistory');
assert(history.length > 0);
```

### Deliverables
- ✅ State tracker plugin complete
- ✅ Wait mechanism working
- ✅ State history functional
- ✅ Tests passing
- ✅ Integration example in demo

---

## Phase 3: Validation & Iteration 🔄

**Timeline:** 1-2 hours
**Priority:** MEDIUM - Quality assurance

### Goals
- Validate plugins work together
- Test with actual LLM agent
- Identify gaps and pain points
- Document learnings

### Tasks

#### 3.1 Integration Testing

**Test Scenario: Agent Discovers & Uses FixiPlug**

```javascript
// 1. Agent discovers FixiPlug capabilities
const introspection = await fixiplug.dispatch('api:introspect');
console.log('Available plugins:', introspection.fixiplug.capabilities.plugins);

// 2. Agent finds state tracker
const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
const stateTracker = plugins.capabilities.find(p => p.name === 'state-tracker');
console.log('State tracker hooks:', stateTracker.hooks);

// 3. Agent uses state tracker
await fixiplug.dispatch('api:setState', { state: 'loading' });
await fixiplug.dispatch('api:waitForState', { state: 'success' });

// 4. Agent inspects what happened
const history = await fixiplug.dispatch('api:getStateHistory');
console.log('State transitions:', history);
```

#### 3.2 LLM Agent Testing

**Setup:**
1. Create test application with FixiPlug
2. Use Puppeteer/Playwright with LLM agent (Claude, GPT-4)
3. Give agent task: "Monitor application state and report when complete"

**Agent Prompt:**
```
You are controlling a web application with FixiPlug installed.

1. First, discover what capabilities FixiPlug provides
2. Find the state tracking system
3. Monitor application state
4. Report when state becomes 'success'

Use dispatch('api:introspect') to start.
```

**Success Metrics:**
- Agent discovers introspection API without help
- Agent finds and uses state tracker
- Agent correctly waits for state transitions
- Agent completes task in <10 API calls

#### 3.3 Gap Analysis

**Document Missing Pieces:**
- What did the agent struggle with?
- What APIs were missing?
- What documentation would have helped?
- What errors occurred?

**Create Issues for:**
- Missing hook schemas
- Confusing API naming
- Better error messages
- Additional helper methods

#### 3.4 Documentation Updates

Update documentation based on findings:

**[docs/agent-guide.md](../docs/agent-guide.md)** (new file)
```markdown
# LLM Agent Guide to FixiPlug

## Quick Start

1. Discover capabilities: `dispatch('api:introspect')`
2. Explore plugins: `dispatch('api:getPluginCapabilities')`
3. Use state tracking: `dispatch('api:waitForState', { state: 'success' })`

## Common Workflows

### Wait for Async Operation
[examples...]

### Discover Available Actions
[examples...]
```

### Deliverables
- ✅ Integration tests passing
- ✅ LLM agent successfully uses plugins
- ✅ Gap analysis documented
- ✅ Agent guide written
- ✅ Roadmap updated with learnings

---

## Phase 4: Future Enhancements 🚀

**Timeline:** TBD (data-driven)
**Priority:** LOW - Based on Phase 3 findings

### Candidates for Next Implementation

#### Option A: Semantic Context Annotator
**Build if:** Agents struggle with DOM queries in testing

#### Option B: Capability Discovery
**Build if:** Agents can't find application actions

#### Option C: Agent Command Interface
**Build if:** Agents need higher-level abstraction

### Decision Criteria
- Agent struggled with X in Phase 3
- Multiple use cases require Y
- Community feedback requests Z

---

## Implementation Guidelines

### Code Quality Standards
- ✅ All plugins must include JSDoc comments
- ✅ All APIs must return consistent JSON structures
- ✅ All state changes must be immutable
- ✅ All errors must be caught and reported via `pluginError` hook
- ✅ All plugins must work in browser, server, and test environments

### Testing Requirements
- ✅ Unit tests for each API hook
- ✅ Integration tests with other plugins
- ✅ Example usage in demos
- ✅ LLM agent validation

### Documentation Standards
- ✅ README section for each plugin
- ✅ Hook schemas documented
- ✅ Usage examples provided
- ✅ Common pitfalls noted

### Performance Considerations
- ✅ Avoid synchronous blocking operations
- ✅ Limit state history size (default: 50)
- ✅ Use weak references for cleanup
- ✅ Debounce frequent state updates

---

## Success Metrics

### Phase 1 Success
- [ ] Introspection plugin returns complete data
- [ ] Agent can list all plugins without source code access
- [ ] Schema inference works for 90%+ of hooks

### Phase 2 Success
- [ ] State tracker handles async workflows
- [ ] Wait mechanism works reliably
- [ ] State history captures transitions

### Phase 3 Success
- [ ] LLM agent completes test scenario
- [ ] Agent uses <10 API calls for basic workflows
- [ ] Zero blocking issues found
- [ ] Agent guide is clear and actionable

---

## Timeline Summary

| Phase | Duration | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1: Introspection | 1-2 hours | Low | None |
| Phase 2: State Tracker | 2-3 hours | Medium | Phase 1 |
| Phase 3: Validation | 1-2 hours | Low | Phase 1+2 |
| **Total** | **4-7 hours** | **Medium** | Sequential |

---

## Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Implement Phase 1** - Build introspection foundation
3. **Implement Phase 2** - Build state tracker
4. **Run Phase 3** - Validate with real agent
5. **Iterate** - Build next plugin based on data

---

## Questions & Decisions

### Open Questions
- [ ] Should state schema be optional or required?
- [ ] What's max state history size? (current: 50)
- [ ] Should introspection be auto-loaded like testing plugin?
- [ ] Do we need state persistence (localStorage)?

### Decisions Made
- ✅ Use Option 2 (core getters) for introspection access
- ✅ Build state tracker before semantic annotator
- ✅ Prioritize validation over building all plugins
- ✅ Let agent usage guide next priorities

---

*Last Updated: 2025-10-03*
*Status: Ready for Implementation*
