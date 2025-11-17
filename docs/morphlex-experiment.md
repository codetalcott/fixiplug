# Morphlex vs Idiomorph Experiment

## Executive Summary

This document details an experiment to evaluate whether [Morphlex](https://github.com/yippee-fun/morphlex) can serve as a drop-in replacement for [Idiomorph](https://github.com/bigskysoftware/idiomorph) in the FixiPlug project.

**Conclusion**: Morphlex is **not a pure drop-in replacement** but can be used as an alternative with an adapter layer.

## Background

### Current State
- **Idiomorph Version**: 0.7.4 (latest available)
- **Usage**: Loaded dynamically via CDN in `swap-idiomorph.js` plugin
- **Status**: Already using the latest version of Idiomorph

### Morphlex Overview
- **Version**: 1.0.1 (released November 7, 2025)
- **Size**: ~2.4KB gzipped
- **Language**: TypeScript
- **Algorithm**: ID sets (inspired by Idiomorph) + LIS (Longest Increasing Subsequence) optimization

## API Compatibility Analysis

### Idiomorph API
```javascript
Idiomorph.morph(existingNode, newNode, options)
```

**Options**:
- `morphStyle`: 'innerHTML' | 'outerHTML'
- `ignoreActiveValue`: boolean
- `morphCallbacks`: object with callback functions

### Morphlex API
```javascript
morph(currentNode, newNode, options)
morphInner(currentNode, newNode, options)
morphDocument(document, newDocument, options)
```

**Options**:
- `preserveChanges`: boolean
- `beforeNodeAdded`: function
- `afterNodeVisited`: function
- `beforeAttributeUpdated`: function

### Key Differences

| Feature | Idiomorph | Morphlex |
|---------|-----------|----------|
| **Export Style** | Global object (`window.Idiomorph`) | ES module / UMD |
| **API Signature** | `Idiomorph.morph(...)` | `morph(...)` |
| **State Preservation** | `ignoreActiveValue` option | `preserveChanges` option |
| **Callbacks** | `morphCallbacks` object | Direct function parameters |
| **innerHTML Mode** | `morphStyle: 'innerHTML'` | Separate `morphInner()` function |
| **Algorithm** | ID sets | ID sets + LIS optimization |

## Implementation

### Adapter Layer

We created an adapter in `plugins/swap-morphlex.js` that translates Idiomorph-style API calls to Morphlex:

```javascript
function idiomorphToMorphlexAdapter(existingNode, newNode, idiomorphConfig, morphFn) {
  const morphlexOptions = {
    preserveChanges: idiomorphConfig.ignoreActiveValue || false,
    beforeNodeAdded: (node) => {
      if (idiomorphConfig.morphCallbacks?.beforeNodeAdded) {
        return idiomorphConfig.morphCallbacks.beforeNodeAdded(node);
      }
      return true;
    },
    // ... more callback mappings
  };

  if (idiomorphConfig.morphStyle === 'innerHTML') {
    return morphFn(existingNode, newNode.innerHTML, morphlexOptions);
  } else {
    return morphFn(existingNode, newNode, morphlexOptions);
  }
}
```

### Plugin Structure

The Morphlex plugin follows the same structure as the Idiomorph plugin:

1. **Dynamic Loading**: Loads Morphlex from CDN if not available
2. **Event Hooks**: Registers for `fx:config` and `fx:after` events
3. **Adapter Layer**: Translates API calls between the two libraries
4. **Performance Tracking**: Measures and logs swap operation timing

## Experiment Setup

### Test Demo

Created `examples/morphlex-experiment.html` with side-by-side comparison:

**Test Scenarios**:
1. **Video State Preservation**: Tests whether video playback position is maintained during DOM updates
2. **Form Input Preservation**: Tests whether user input in form fields is preserved
3. **Performance Measurement**: Compares execution time of morph operations

**Features**:
- Split-screen layout (Idiomorph on left, Morphlex on right)
- Identical test scenarios for both libraries
- Real-time performance metrics display
- Automated test suite with pass/fail results

### Running the Experiment

1. Open `examples/morphlex-experiment.html` in a browser
2. Interact with both panels to test manually:
   - Play the videos and click "Toggle Title Position"
   - Fill in form fields and click "Update Form DOM"
3. Click "Run All Tests" to execute automated test suite
4. Compare performance metrics between the two libraries

## Expected Results

### State Preservation

Both libraries should:
- ✅ Preserve video playback position during DOM morphing
- ✅ Preserve form input values during updates
- ✅ Maintain focus states where applicable

### Performance

Expected performance characteristics:
- **Morphlex**: Potentially faster due to LIS optimization
- **Idiomorph**: Well-tested, stable performance
- Both should complete morph operations in < 10ms for typical use cases

### Compatibility Issues

Potential issues to watch for:
- Callback function signature differences
- Edge cases in form input preservation
- Different handling of custom elements
- Memory usage patterns

## API Migration Guide

If migrating from Idiomorph to Morphlex:

### 1. Update Plugin Import
```javascript
// Before
import createIdiomorphSwap from '../plugins/swap-idiomorph.js';

// After
import createMorphlexSwap from '../plugins/swap-morphlex.js';
```

### 2. Update Plugin Usage
```javascript
// Before
fixiplug.use(createIdiomorphSwap({
  morphStyle: 'innerHTML',
  ignoreActiveValue: true
}));

// After
fixiplug.use(createMorphlexSwap({
  morphStyle: 'innerHTML',      // Still works via adapter
  ignoreActiveValue: true       // Mapped to preserveChanges
}));
```

### 3. Callback Mapping

If using custom callbacks:

```javascript
// Idiomorph style (still works with adapter)
createMorphlexSwap({
  morphCallbacks: {
    beforeNodeAdded: (node) => true,
    afterNodeMorphed: (oldNode, newNode) => { }
  }
});

// Native Morphlex style
createMorphlexSwap({
  beforeNodeAdded: (node) => true,
  afterNodeVisited: (oldNode, newNode) => { }
});
```

## Pros and Cons

### Morphlex Advantages
- ✅ Smaller bundle size (~2.4KB gzipped)
- ✅ TypeScript support
- ✅ Newer algorithm with potential performance improvements
- ✅ Modern ES module architecture
- ✅ Active development (recent release)

### Morphlex Disadvantages
- ❌ Not a pure drop-in replacement (requires adapter)
- ❌ Less mature/battle-tested than Idiomorph
- ❌ Different API surface (learning curve)
- ❌ Smaller community/ecosystem
- ❌ Less documentation

### Idiomorph Advantages
- ✅ Well-established in the ecosystem
- ✅ Extensive real-world testing
- ✅ Stable API
- ✅ Good documentation
- ✅ Larger community

### Idiomorph Disadvantages
- ❌ Larger bundle size
- ❌ Older algorithm (slightly slower in some cases)
- ❌ No TypeScript source

## Recommendations

### For Production Use

**Stay with Idiomorph** if:
- You need maximum stability and reliability
- Your application is already using Idiomorph without issues
- Bundle size is not a critical concern
- You value ecosystem maturity

**Consider Morphlex** if:
- Bundle size is critical (bandwidth-constrained environments)
- You're starting a new project
- You want TypeScript support
- You need the latest algorithm optimizations

### For This Project (FixiPlug)

**Recommendation**: **Keep Idiomorph as the default**, but provide Morphlex as an optional alternative.

**Rationale**:
1. FixiPlug is already using the latest Idiomorph version (0.7.4)
2. The adapter layer works but adds complexity
3. Idiomorph is more battle-tested for DOM morphing
4. Users can opt-in to Morphlex if they prefer it

**Implementation**:
```javascript
// Default: Idiomorph
fixiplug.use(createIdiomorphSwap());

// Alternative: Morphlex
fixiplug.use(createMorphlexSwap());
```

## Further Testing Needed

To fully validate Morphlex as a replacement:

1. **Edge Cases**:
   - Custom web components
   - Shadow DOM
   - SVG elements
   - iframes

2. **Performance**:
   - Large DOM trees (1000+ elements)
   - Rapid successive updates
   - Memory leak testing

3. **Browser Compatibility**:
   - Cross-browser testing
   - Mobile browsers
   - Older browser versions

4. **Real-World Scenarios**:
   - Integration with actual application code
   - Complex form interactions
   - Dynamic content loading

## Files Created

1. **`plugins/swap-morphlex.js`**: Morphlex plugin with idiomorph-compatible adapter
2. **`examples/morphlex-experiment.html`**: Side-by-side comparison demo
3. **`docs/morphlex-experiment.md`**: This documentation

## References

- [Morphlex GitHub](https://github.com/yippee-fun/morphlex)
- [Idiomorph GitHub](https://github.com/bigskysoftware/idiomorph)
- [Fixi.js GitHub](https://github.com/bigskysoftware/fixi)
- [FixiPlug Documentation](../README.md)

## Changelog

- **2025-11-17**: Initial experiment setup and documentation
  - Created Morphlex plugin with adapter layer
  - Built side-by-side comparison demo
  - Documented API differences and migration path

---

**Last Updated**: November 17, 2025
