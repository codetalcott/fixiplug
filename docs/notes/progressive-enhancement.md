# Progressive Enhancement with Fixiplug

This document explains how Fixiplug implements progressive enhancement for swap mechanisms, focusing on fast time-to-first-paint while ensuring state preservation when needed.

## Core Concept

Fixiplug uses a progressive enhancement approach:

1. **Start Fast**: Begin with the default [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) built into fixi.js
2. **Detect Needs**: Identify when state preservation is needed (forms, media)
3. **Enhance Automatically**: Add state preservation only when required

This approach combines the best of both worlds: fast initial rendering with the built-in mechanism, plus advanced state handling when necessary.

## Default Swap: View Transitions API

The default swap mechanism in fixi.js uses the browser's View Transitions API when available, falling back to direct DOM updates when not. This provides:

- Fast content swapping
- Smooth visual transitions
- No additional dependencies

However, it doesn't automatically preserve form input values or media playback state.

## Enhanced Swap: State Preservation

When forms or media elements are detected, Fixiplug can enhance the swap process to:

- Preserve form input values
- Maintain checkbox and radio button states
- Continue video/audio playback at the same position
- Keep other DOM element states intact

## Example Usage

```javascript
import { auto } from 'fixiplug';
import createEnhancedSwap from 'fixiplug/plugins/enhanced-swap.js';

// Apply the enhanced swap plugin with progressive enhancement
auto.use(createEnhancedSwap({
  progressiveEnhancement: true,
  preserveFormState: true,
  preserveMediaState: true
}));
```

## How Progressive Enhancement Works

1. **Initial Load**: Fixiplug starts with the default View Transitions mechanism
2. **Fast Detection**: Quick check for forms and media elements
3. **User Interaction**: Detection of user interaction with forms and media
4. **Content Loaded**: Full page analysis after the initial render
5. **State Tracking**: Monitoring of elements that have state to preserve
6. **Enhanced Swaps**: Special handling only for elements that need it

## When to Use

This approach is particularly valuable for:

- Server-side rendered (SSR) applications
- Pages with form inputs that users will interact with
- Content with video or audio elements
- Applications where maintaining state during navigation is important
- Any site where fast initial rendering is a priority

## Configuration Options

The enhanced swap plugin supports several configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `progressiveEnhancement` | `true` | Start with base swap, enhance as needed |
| `preserveFormState` | `true` | Preserve input values during swaps |
| `preserveMediaState` | `true` | Maintain video/audio playback state |
| `detectStateElements` | `true` | Automatically detect elements with state |

## Browser Support

- Modern browsers that support View Transitions API get the best experience
- Older browsers fall back to direct DOM manipulation
- State preservation works in all browsers

## Performance Considerations

The progressive enhancement approach ensures that:

- Initial page load is as fast as possible
- Additional state tracking is only activated when needed
- JavaScript overhead is minimized
- DOM mutations are kept to a minimum

## Comparison with Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| View Transitions Only | Fast, lightweight | No state preservation |
| Full DOM Morphing | Preserves all state | Heavier, slower initial load |
| Progressive Enhancement | Fast start, state preservation when needed | Slightly more complex implementation |

## Server-Side Rendering Integration

For SSR frameworks, you can provide hints to help Fixiplug know when state preservation will be needed:

```html
<!-- Add data attributes to signal state preservation needs -->
<div data-fixiplug-preserve="true">
  <form>...</form>
</div>
```

Or set global configuration:

```html
<script>
  window.__FIXIPLUG_CONFIG__ = {
    preserveState: true,
    hasStatefulForms: true
  };
</script>
```
