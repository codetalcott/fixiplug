# ctx.emit() Implementation

**Date**: 2025-10-03
**Status**: ✅ Implemented and Tested

## Overview

Added `ctx.emit()` to enable plugin-to-plugin communication while preventing infinite recursion through deferred event processing and loop detection.

---

## Implementation Strategy

### Approach: Hybrid Deferred Dispatch + Loop Detection

Combined two protection mechanisms:

1. **Deferred Processing**: Events queued and processed asynchronously after handlers complete
2. **Loop Detection**: Track event frequency, warn at 100, block at 500

---

## Files Modified

| File | Changes | Lines Changed |
|------|---------|---------------|
| [core/hooks.js](../core/hooks.js) | Added deferred queue, loop detection, re-entrance prevention | +80 |
| [builder/fixiplug-factory.js](../builder/fixiplug-factory.js) | Added `ctx.emit()` to plugin context | +5 |
| [plugins/state-tracker.js](../plugins/state-tracker.js) | Emit state transition events | +25 |

---

## API

### ctx.emit(hookName, event)

**Purpose**: Emit an event from within a plugin that other plugins can listen to.

**Parameters**:
- `hookName` (string) - Name of the hook to emit
- `event` (object) - Event data to pass

**Returns**: `this` (chainable)

**Behavior**:
- Events are queued and processed asynchronously
- Events fire AFTER the current handler completes
- Infinite loops are detected and prevented

**Example**:
```javascript
fixiplug.use(function myPlugin(ctx) {
  ctx.on('userAction', (event) => {
    // Process action
    const result = processAction(event);

    // Notify other plugins
    ctx.emit('actionComplete', {
      action: event.action,
      result
    });

    return event;
  });
});

// Another plugin listens
fixiplug.use(function listenerPlugin(ctx) {
  ctx.on('actionComplete', (event) => {
    console.log('Action completed:', event.result);
  });
});
```

---

## Protection Mechanisms

### 1. Deferred Processing

**How it works**:
- Events added to queue instead of dispatched immediately
- Processed in batches of 50 after current dispatch completes
- Uses `setTimeout(..., 0)` to defer to next event loop tick

**Benefits**:
- Prevents most recursion (event fires AFTER handler exits)
- Maintains execution order
- Low performance overhead

### 2. Event Frequency Tracking

**Limits**:
- **Warning** at 100 emissions of same event
- **Block** at 500 emissions of same event

**Behavior**:
```javascript
// After 100 emissions
console.warn('[FixiPlug] Event "foo" has been emitted 101 times. Possible infinite loop.');

// At 501 emissions
console.error('[FixiPlug] Event "foo" emitted too many times (501). Dropping to prevent infinite loop.');
// Event is dropped, not queued
```

### 3. Queue Size Limit

**Maximum**: 1000 events in queue

**Behavior**:
```javascript
// When queue reaches 1000
console.warn('[FixiPlug] Deferred queue is full (1000). Dropping event: foo');
console.warn('[FixiPlug] This usually indicates an infinite event loop.');
// Event is dropped
```

### 4. Re-entrance Prevention

**How it works**:
- Track actively executing hooks in `activeHooks` Set
- Prevent same hook from being called while it's running

**Behavior**:
```javascript
// If hook "foo" tries to dispatch "foo" while running
console.warn('[FixiPlug] Hook "foo" is already executing. Skipping recursive call to prevent infinite loop.');
// Returns event unchanged
```

---

## Event Timing

### Deferred Execution Order

```javascript
fixiplug.use(function plugin(ctx) {
  ctx.on('test', (event) => {
    console.log('1. Handler starts');
    ctx.emit('deferred', { data: 'test' });
    console.log('2. Handler ends');
    return event;
  });

  ctx.on('deferred', () => {
    console.log('4. Deferred event received');
  });
});

await fixiplug.dispatch('test');
console.log('3. Dispatch returned');

// Output:
// 1. Handler starts
// 2. Handler ends
// 3. Dispatch returned
// 4. Deferred event received
```

**Key Point**: Emitted events fire AFTER the current dispatch completes.

---

## State Tracker Integration

The state tracker now emits events:

```javascript
// When state changes from 'idle' to 'loading'
ctx.emit('state:transition', {
  from: 'idle',
  to: 'loading',
  data: { operation: 'fetch' },
  timestamp: 1696348800000
});

ctx.emit('state:exited:idle', {
  to: 'loading',
  data: { operation: 'fetch' },
  timestamp: 1696348800000
});

ctx.emit('state:entered:loading', {
  from: 'idle',
  data: { operation: 'fetch' },
  timestamp: 1696348800000
});
```

**Usage**:
```javascript
fixiplug.use(stateTrackerPlugin);

fixiplug.use(function myPlugin(ctx) {
  ctx.on('state:transition', (event) => {
    console.log(`State changed: ${event.from} -> ${event.to}`);
  });

  ctx.on('state:entered:success', (event) => {
    console.log('Operation succeeded!');
  });
});
```

---

## Testing

### Test Suite: [test-ctx-emit.js](../test-ctx-emit.js)

**Tests Covered**:
1. ✅ Basic event emission
2. ✅ Recursion prevention (stops at ~330 emissions)
3. ✅ State tracker events
4. ✅ Event chaining (A → B → C)
5. ✅ Deferred timing (events fire after handler)
6. ✅ Multiple listeners

**Results**: All tests passing ✅

---

## Performance Characteristics

### Overhead

**Per emit() call**:
- Queue push: O(1)
- Frequency check: O(1) Map lookup
- Queue size check: O(1)

**Per dispatch**:
- Re-entrance check: O(1) Set lookup/add/delete
- Deferred trigger: O(1) setTimeout schedule

**Batch processing**:
- Process up to 50 events per tick
- Each event dispatches normally (existing overhead)

**Total**: Minimal overhead, mostly queue operations

### Memory

- Deferred queue: Max 1000 events * ~100 bytes = ~100KB worst case
- Event counts Map: Max ~100 unique hooks * ~50 bytes = ~5KB
- Active hooks Set: Max ~10 concurrent * ~50 bytes = ~500 bytes

**Total**: <200KB worst case, typically <10KB

---

## Limitations & Trade-offs

### ✅ Advantages

1. **Safe by default** - Infinite loops prevented automatically
2. **Simple mental model** - "Events fire after my handler completes"
3. **No API changes** - Existing code unaffected
4. **Predictable** - Clear execution order

### ⚠️ Trade-offs

1. **Async only** - Can't get return value from emitted event
2. **Timing delay** - Small delay (next tick) before event fires
3. **Order dependency** - Emitted events process after current dispatch
4. **Limits required** - Hard limits (500, 1000) may need tuning

---

## Best Practices

### DO ✅

```javascript
// Notify other plugins of state changes
ctx.emit('userLoggedIn', { userId: 123 });

// Chain events for workflows
ctx.on('step1Complete', () => {
  ctx.emit('step2Start');
});

// Broadcast updates
ctx.emit('dataUpdated', { collection: 'users', id: 456 });
```

### DON'T ❌

```javascript
// DON'T expect return values
const result = ctx.emit('getConfig'); // ❌ Returns undefined

// DON'T emit from same event
ctx.on('foo', () => {
  ctx.emit('foo'); // ❌ Creates loop (but will be caught)
});

// DON'T rely on immediate execution
ctx.emit('save');
useData(); // ❌ Save hasn't happened yet

// DO this instead
ctx.emit('save');
setTimeout(() => useData(), 10); // ✅ Wait for event to process
```

---

## Future Enhancements

### Potential Improvements

1. **Configurable limits** - Allow apps to set custom loop limits
2. **Event priorities** - Process high-priority events first
3. **Synchronous mode** - Opt-in sync dispatch for specific events (careful!)
4. **Better diagnostics** - Show call stack for loop detection
5. **Event namespaces** - Scoped events for plugin isolation

### Not Planned

- **Rejectable events** - Use error objects instead
- **Event cancellation** - Use return values in handlers
- **Synchronous dispatch** - Too risky for loops

---

## Migration Guide

### For Plugin Authors

**Before** (broken - ctx.emit didn't exist):
```javascript
// This never worked
ctx.emit('myEvent'); // ❌ Method didn't exist
```

**After**:
```javascript
// Now works!
ctx.emit('myEvent', { data: 'test' }); // ✅
```

### For App Developers

No changes needed - this is purely additive. Existing plugins continue working exactly as before.

---

## Examples

### Example 1: Workflow Coordination

```javascript
fixiplug.use(function stepA(ctx) {
  ctx.on('workflow:start', (event) => {
    console.log('Step A running...');
    ctx.emit('workflow:stepAComplete', { result: 'A done' });
  });
});

fixiplug.use(function stepB(ctx) {
  ctx.on('workflow:stepAComplete', (event) => {
    console.log('Step B running with:', event.result);
    ctx.emit('workflow:complete', { finalResult: 'All done' });
  });
});

// Start workflow
await fixiplug.dispatch('workflow:start');
```

### Example 2: State Broadcasting

```javascript
fixiplug.use(stateTrackerPlugin);

fixiplug.use(function analytics(ctx) {
  ctx.on('state:transition', (event) => {
    sendAnalytics({
      event: 'state_change',
      from: event.from,
      to: event.to,
      timestamp: event.timestamp
    });
  });
});

fixiplug.use(function logger(ctx) {
  ctx.on('state:entered:error', (event) => {
    logError('Application error state', event.data);
  });
});
```

### Example 3: Event Aggregation

```javascript
const events = [];

fixiplug.use(function aggregator(ctx) {
  ctx.on('user:action', (event) => {
    events.push(event);

    if (events.length >= 10) {
      ctx.emit('batch:ready', { events: [...events] });
      events.length = 0;
    }
  });

  ctx.on('batch:ready', (event) => {
    sendBatch(event.events);
  });
});
```

---

## Conclusion

`ctx.emit()` successfully enables plugin-to-plugin communication while maintaining safety through:
- Deferred processing
- Loop detection
- Queue limits
- Re-entrance prevention

**Status**: Production ready ✅
**Test Coverage**: 6/6 tests passing ✅
**Performance**: Minimal overhead ✅
**Safety**: Multiple protection layers ✅

---

*Implementation Date: 2025-10-03*
*Author: Implementation based on Phase 3 findings*
*Next Steps: Update agent guide with ctx.emit() documentation*
