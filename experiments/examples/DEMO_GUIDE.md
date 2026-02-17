# FixiPlug Demo Guide

This demo showcases the core features and capabilities of FixiPlug.

## Demo Sections

### 1. Idiomorph Swap Plugin
**Purpose:** Demonstrates DOM morphing that preserves element state (e.g., video playback position)

**Features tested:**
- Idiomorph library integration (v0.7.4)
- State preservation during DOM updates
- Dynamic content swapping

### 2. Logging Plugin
**Purpose:** Shows event tracking and logging capabilities

**Features tested:**
- Wildcard `*` hook listener
- Event data capture
- Custom serialization for DOM elements and objects

### 3. Content Modifier + Runtime Toggle
**Purpose:** Dynamic content modification with plugin enable/disable

**Features tested:**
- Hook-based content transformation
- Runtime plugin control (enable/disable)
- Event-driven UI updates

### 4. Error Isolation
**Purpose:** Demonstrates error handling and reporting

**Features tested:**
- Error queue to prevent recursion
- `pluginError` event handling
- Async error processing with setTimeout
- Error display and tracking

### 5. Hook Priority ⭐ NEW
**Purpose:** Shows hook execution order based on priority levels

**Features tested:**
- `PRIORITY.HIGH` (100)
- `PRIORITY.NORMAL` (0)
- `PRIORITY.LOW` (-100)
- Priority-based execution ordering

**Expected output:** Displays hooks executing in HIGH → NORMAL → LOW order

### 6. Data Pipeline ⭐ NEW
**Purpose:** Transform data without DOM manipulation

**Features tested:**
- JSON parsing and transformation
- CSV parsing
- Data-only event processing

**Use cases:**
- API response handling
- Data validation
- Format conversion

### 7. Wildcard Hook Listener ⭐ NEW
**Purpose:** Demonstrates `*` wildcard hook that captures all events

**Features tested:**
- Dynamic wildcard hook registration
- Event filtering (excludes API events)
- Runtime enable/disable
- Multiple event capture

**How to use:**
1. Click "Enable Wildcard Logger"
2. Click "Trigger Any Event" to dispatch 3 test events
3. See all captured events displayed

### 8. Plugin Management ⭐ NEW
**Purpose:** Runtime plugin lifecycle management

**Features tested:**
- Dynamic plugin registration (`use`)
- Plugin removal (`unuse`)
- Plugin swapping (`swap`)
- Plugin listing (`getPlugins`)

**Scenarios:**
- Add custom plugin at runtime
- Remove plugin and verify cleanup
- Swap logger with different implementation

## Testing Checklist

- [ ] All 8 sections render without errors
- [ ] Video playback preserved during swap
- [ ] Logger displays readable event data
- [ ] Content modifier toggles content/style
- [ ] Errors captured and displayed
- [ ] Priority order executes correctly (HIGH → NORMAL → LOW)
- [ ] Data pipeline transforms JSON/CSV
- [ ] Wildcard captures all events when enabled
- [ ] Plugins add/remove/swap successfully

## Known Issues Addressed

✅ Fixed `setImmediate` (Node.js) → `setTimeout` (browser)
✅ Fixed error-reporter plugin structure
✅ Fixed event serialization for DOM elements and Errors
✅ Added async delay for error queue processing

## Files Modified

- `examples/demo.html` - Enhanced with 4 new sections
- `core/hooks.js` - Browser compatibility fix
- `plugins/error-reporter.js` - Plugin structure fix
