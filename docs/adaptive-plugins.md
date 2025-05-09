# Fixiplug Adaptive Plugin System

This guide explains how to use Fixiplug's adaptive plugin system, which automatically swaps plugins based on environment detection and page features.

## Overview

The adaptive plugin system allows Fixiplug to:

1. Detect the current environment and page features
2. Automatically select and activate optimal plugins for the detected environment
3. Swap plugins dynamically as the environment or page content changes

This is particularly useful for optimizing page transitions, DOM manipulation strategies, and overall performance across different devices and content types.

## Key Components

The adaptive plugin system consists of:

- **Feature Detection**: Analyzes the page to identify forms, videos, complex 3D content, etc.
- **Plugin Manager**: Handles registration, activation, and swapping of plugins
- **Swap Plugins**: Different DOM manipulation strategies for different contexts
- **Auto Configuration**: Smart defaults with override capabilities

## Using Adaptive Plugins

### Basic Usage

The simplest way to use adaptive plugins is with the `auto` export:

```javascript
import adaptiveAuto from 'fixiplug/auto';

// Initialize with environment-aware plugin system
adaptiveAuto.setupEnvironmentAdaptation();

// Use as normal
adaptiveAuto.use(myPlugin);
adaptiveAuto.dispatch('init', {});
```

### Registering Environment-Dependent Plugins

You can register plugins that only activate under specific conditions:

```javascript
adaptiveAuto.plugins.register('form-manager', 
  () => createFormManagerPlugin(),
  {
    // Only activate in browser environments
    envRules: { isBrowser: true },
    
    // Only activate on pages with forms
    featureRules: { hasForm: true }
  }
);
```

### Manual Plugin Swap

You can manually trigger a plugin swap:

```javascript
// Force a specific swap mechanism
adaptiveAuto.dispatch('change-swap-mode', { mode: 'idiomorph' });

// Or use simple swap for performance
adaptiveAuto.dispatch('change-swap-mode', { mode: 'simple' });
```

### Responding to Environment Changes

When the environment changes (e.g., when entering production mode):

```javascript
// Update environment detection
refreshEnvironment();

// Refresh auto configuration and update plugins
adaptiveAuto.refreshConfig();
```

## Available Swap Mechanisms

### Idiomorph Swap

Ideal for:
- Form-heavy pages (preserves form state)
- Pages with complex DOM structures
- When fine-grained DOM updates are needed

```javascript
adaptiveAuto.dispatch('change-swap-mode', { mode: 'idiomorph' });
```

### Simple Swap

Ideal for:
- Low-powered devices
- Simple content updates
- Low-bandwidth situations

```javascript
adaptiveAuto.dispatch('change-swap-mode', { mode: 'simple' });
```

## Creating Custom Adaptive Plugins

You can create your own plugins that adapt to the environment:

```javascript
import { detectPageFeatures } from 'fixiplug/core/features';

function createAdaptivePlugin(options = {}) {
  return {
    name: 'my-adaptive-plugin',
    setup(ctx) {
      const features = detectPageFeatures();
      
      // Adapt behavior based on detected features
      if (features.isMobile) {
        // Use mobile-optimized approach
      } else if (features.hasWebGL) {
        // Use enhanced graphics approach
      }
      
      // Register event handlers and other setup...
    }
  };
}
```

## Best Practices

1. **Let Auto-Detection Work**: For most cases, the automatic detection provides optimal results
2. **Test Across Devices**: Verify that your adaptive plugins work well on different devices and browsers
3. **Use Feature Detection**: Base adaptivity on feature detection rather than specific browser detection
4. **Provide Fallbacks**: Always include fallback behavior for when preferred plugins can't be used
5. **Watch Performance**: Monitor the performance impact of plugin swapping on your application

## Advanced Configuration

You can fine-tune the adaptive system by configuring the sensitivity of feature detection:

```javascript
import adaptiveAuto from 'fixiplug/auto';
import createAdaptiveSwap from 'fixiplug/plugins/adaptive-swap';

// Configure with custom options
adaptiveAuto.use(createAdaptiveSwap({
  // Configure idiomorph options
  idiomorphOptions: {
    morphStyle: 'outerHTML',
    ignoreActiveValue: false
  },
  
  // Configure simple swap options
  simpleOptions: {
    preserveFocus: true
  }
}));
```
