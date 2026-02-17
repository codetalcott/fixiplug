# TypeScript Type Check Report

**Date**: November 17, 2025
**Total Errors**: 91 across 38 files

## Executive Summary

Type checking has been run on all JavaScript files in the project using TypeScript's compiler in `checkJs` mode. The project has **91 type errors** across various categories. The errors are primarily related to:

1. Missing type definitions for dynamically loaded libraries
2. Type definitions file (`types.js`) not being recognized as a module
3. Missing `features` property in configuration objects
4. Custom properties on DOM objects

## Error Breakdown by Category

| Error Code | Count | Description |
|------------|-------|-------------|
| TS2353 | 29 | Object literal may only specify known properties |
| TS2339 | 19 | Property does not exist on type |
| TS2304 | 14 | Cannot find name |
| TS2300 | 10 | Duplicate identifier |
| TS2306 | 9 | File is not a module |
| TS2580 | 6 | Cannot find name (Node.js globals) |
| TS2345 | 3 | Argument type not assignable |
| TS1192 | 1 | Module has no default export |

## Newly Created Files

### [plugins/swap-morphlex.js](plugins/swap-morphlex.js) - 3 errors ✓

**Status**: Same error pattern as existing idiomorph plugin

```
plugins/swap-morphlex.js(82,27): error TS2339: Property 'morphlex' does not exist on type 'Window & typeof globalThis'.
plugins/swap-morphlex.js(83,35): error TS2339: Property 'morphlex' does not exist on type 'Window & typeof globalThis'.
plugins/swap-morphlex.js(93,37): error TS2339: Property 'morphlex' does not exist on type 'Window & typeof globalThis'.
```

**Analysis**: These errors are expected and consistent with the idiomorph plugin. They occur because `window.morphlex` is loaded dynamically from a CDN and not part of the standard Window interface.

**Recommendation**: Add type declaration in a `.d.ts` file (same fix applies to idiomorph).

### Comparison with Idiomorph Plugin

[plugins/swap-idiomorph.js](plugins/swap-idiomorph.js) has identical error pattern (3 errors):

```
plugins/swap-idiomorph.js(26,27): error TS2339: Property 'Idiomorph' does not exist on type 'Window & typeof globalThis'.
plugins/swap-idiomorph.js(31,50): error TS2339: Property 'Idiomorph' does not exist on type 'Window & typeof globalThis'.
plugins/swap-idiomorph.js(36,23): error TS2339: Property 'Idiomorph' does not exist on type 'Window & typeof globalThis'.
```

**✅ Conclusion**: The new morphlex plugin follows the same pattern as the existing idiomorph plugin and has equivalent type issues.

## Major Error Categories

### 1. TS2353 - Unknown Properties (29 errors)

**Pattern**: `'features' does not exist in type`

**Affected Files**:
- benchmark-performance.js
- debug-features.js
- debug-features-detailed.js
- test-*.js files
- examples/introspection-demo.js
- fixiplug.js

**Root Cause**: The `features` property is being added to configuration objects but not defined in the type definition.

**Example**:
```javascript
// benchmark-performance.js(10,3)
const fixi = createFixiplug({
  features: {  // <-- Error: features doesn't exist
    // ...
  }
});
```

**Fix**: Update type definitions to include `features` property.

### 2. TS2339 - Property Does Not Exist (19 errors)

**Pattern**: Properties on Window, Document, or Event objects

**Categories**:

#### a) Window Properties (6 errors)
- `window.Idiomorph` (3 errors in swap-idiomorph.js)
- `window.morphlex` (3 errors in swap-morphlex.js)

**Fix**: Add global type declarations:
```typescript
// global.d.ts
declare global {
  interface Window {
    Idiomorph?: any;
    morphlex?: any;
    fixiplug?: any;
  }
}
```

#### b) Document Properties (6 errors)
- `document.__fixi_mo` in core/fixi-dom.js, core/fixi.js

**Fix**: Extend Document interface or use type assertion.

#### c) Event Properties (3 errors)
- `event.detail` in plugins/data-pipeline.js

**Fix**: Use `CustomEvent` type instead of `Event`.

#### d) Missing DOM APIs (4 errors)
- `fixiplug.js(62,28)`: Property 'features' does not exist
- `fixiplug.js(64,24)`: Property 'features' does not exist
- `fixiplug.js(88,10)`: Property 'fixiplug' does not exist on Window

### 3. TS2306 - File Is Not a Module (9 errors)

**Pattern**: `File '/Users/williamtalcott/projects/fixiplug/types.js' is not a module`

**Affected Files**:
- builder/plugin-manager.js
- plugins/content-modifier.js
- plugins/error-reporter.js
- plugins/hook-visualizer.js
- plugins/logger.js
- plugins/offline.js
- plugins/performance.js
- plugins/security.js
- plugins/testing.js

**Root Cause**: [types.js](types.js) file contains only JSDoc type definitions but no exports.

**Fix**: Convert types.js to export type definitions or use triple-slash references.

### 4. TS2300 - Duplicate Identifier (10 errors)

**Pattern**: `Duplicate identifier 'PluginContext'`

**Affected Files**:
- plugins/error-reporter.js (2 errors)
- plugins/hook-visualizer.js (2 errors)
- plugins/logger.js (2 errors)
- plugins/performance.js (2 errors)
- plugins/security.js (2 errors)

**Root Cause**: Multiple imports/definitions of PluginContext from types.js.

**Fix**: Ensure single import per file and proper module structure in types.js.

### 5. TS2304 - Cannot Find Name (14 errors)

**Pattern**: References to `fixiplug` global variable

**Affected Files**:
- plugins/hook-visualizer.js (6 errors)
- plugins/performance.js (2 errors)
- plugins/security.js (4 errors)
- plugins/testing.js (2 errors)

**Root Cause**: Plugins referencing global `fixiplug` without type declaration.

**Fix**: Add to global.d.ts or inject via context.

### 6. TS2580 - Node.js Globals (6 errors)

**Pattern**: `Cannot find name 'require'` or `'process'`

**Affected Files**:
- test-fresh-logging.js (2 errors - require)
- test-state-tracker-simple.js (1 error - process)
- test-state-tracker-timeout-debug.js (3 errors - process)

**Root Cause**: Test files using Node.js APIs without Node.js types.

**Fix**: Install `@types/node` and add to tsconfig.

### 7. TS2345 - Type Assignment (3 errors)

**Pattern**: FormData type incompatibility

**Files**:
- core/fixi-core.js(24,37)
- core/fixi-dom.js(66,42)
- core/fixi.js(35,38)

**Root Cause**: FormData cannot be directly converted to URLSearchParams.

**Fix**: Add proper type conversion or assertion.

### 8. TS1192 - Missing Default Export (1 error)

**File**: examples/unified-import-example.js(36,8)

**Error**: `Module '"/Users/williamtalcott/projects/fixiplug/core/index"' has no default export`

**Fix**: Use named import or add default export to core/index.js.

## Recommended Fixes

### Immediate (High Priority)

1. **Create global type declarations** (`global.d.ts`):
```typescript
declare global {
  interface Window {
    Idiomorph?: any;
    morphlex?: {
      morph: (currentNode: HTMLElement, newNode: HTMLElement | string, options?: any) => void;
      morphInner: (currentNode: HTMLElement, newNode: HTMLElement | string, options?: any) => void;
      morphDocument: (doc: Document, newDoc: Document, options?: any) => void;
    };
    fixiplug?: any;
  }

  interface Document {
    __fixi_mo?: MutationObserver;
  }
}

export {};
```

2. **Fix types.js** to be a proper ES module:
```javascript
// types.js
/**
 * @typedef {Object} PluginContext
 * ...
 */

export {};  // Make it a module
```

3. **Add Node.js types** for test files:
```bash
npm install --save-dev @types/node
```

### Medium Priority

4. **Update configuration types** to include `features` property
5. **Fix Event types** in data-pipeline.js to use `CustomEvent`
6. **Add type assertions** for FormData conversions

### Low Priority

7. Fix duplicate identifier warnings by cleaning up imports
8. Add proper return types to function signatures
9. Enable stricter type checking incrementally

## Files with Zero Errors

The following core files have no type errors:
- core/dom.js
- core/hooks.js
- plugins/introspection.js
- plugins/state-tracker.js

## Configuration Files

### [tsconfig.json](tsconfig.json)
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["**/*.js"],
  "exclude": ["node_modules", "dist", "build"]
}
```

### [jsconfig.json](jsconfig.json)
Also created for IDE support (same settings).

## Running Type Checks

```bash
# Run full type check
npx tsc --noEmit

# Count errors
npx tsc --noEmit 2>&1 | grep -c "error TS"

# Categorize errors
npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/.*error \(TS[0-9]*\).*/\1/' | sort | uniq -c | sort -rn

# Check specific file
npx tsc --noEmit plugins/swap-morphlex.js
```

## Summary

- **Total Errors**: 91
- **Newly Created Files**: swap-morphlex.js has 3 errors (same pattern as existing code)
- **Most Common Issues**:
  1. Missing `features` property in types (29 errors)
  2. Missing Window/Document property declarations (19 errors)
  3. types.js module structure (9 errors)

**Status**: ✅ The new morphlex plugin does not introduce any new categories of type errors. It follows the same patterns as the existing idiomorph plugin.

**Next Steps**: Consider implementing the recommended fixes to reduce type errors across the codebase, starting with creating `global.d.ts` for Window/Document type extensions.
