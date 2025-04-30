# Fixi Plugin System Usage Guide

This guide demonstrates how to implement the Improved Fixi Plugin System in real-world applications, with a focus on performance optimization, reliability, and maintainability.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Performance Optimization Strategies](#performance-optimization-strategies)
- [Error Handling and Reliability](#error-handling-and-reliability)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Migration from Original Fixi](#migration-from-original-fixi)

## Installation

```bash
# Using npm
npm install improved-fixi fixi-plugins

# Using yarn
yarn add improved-fixi fixi-plugins
```

## Basic Setup

The simplest way to start using the plugin system is:

```typescript
import { Fixi } from 'improved-fixi';
import { createPluginSystem, createPlugin } from 'fixi-plugins';
import { CachePlugin, ErrorHandlerPlugin } from 'fixi-plugins/plugins';

// Create a standard Fixi instance
const fixi = new Fixi({
  baseUrl: 'https://api.example.com',
  maxConnections: 8
});

// Enhance Fixi with plugin capabilities
const fx = createPluginSystem(fixi, {
  plugins: [
    // Add cache plugin
    CachePlugin.configure({
      ttl: 5 * 60 * 1000, // 5 minutes
      cacheableMethods: ['GET']
    }),
    
    // Add error handling
    ErrorHandlerPlugin
  ]
});

// Use the enhanced Fixi instance
async function fetchUsers() {
  try {
    const response = await fx.get('/users');
    return response.json();
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}
```

## Creating Custom Plugins

Custom plugins can be created using the `createPlugin` factory function:

```typescript
import { createPlugin, PluginHook } from 'fixi-plugins';

// Create a simple logging plugin
const LoggingPlugin = createPlugin({
  name: 'logging',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 100, // High priority to run first
  
  beforeRequest(context) {
    console.log(`Request starting: ${context.config.method} ${context.config.url}`);
    // Store start time for duration tracking
    context.startTime = performance.now();
    return context.config;
  },
  
  afterResponse(context) {
    const duration = performance.now() - context.startTime;
    console.log(`Request completed: ${context.config.method} ${context.config.url} (${duration.toFixed(2)}ms)`);
    return context.response;
  },
  
  onError(context) {
    console.error(`Request failed: ${context.config.method} ${context.config.url}`, context.error);
  }
});

// Register the plugin
fx.registerPlugin(LoggingPlugin);
```

## Performance Optimization Strategies

### 1. Use Plugin Priorities

Prioritize your plugins to ensure the most critical ones run first:

```typescript
const CriticalPlugin = createPlugin({
  name: 'critical',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 100, // Higher means it runs earlier
  // ...
});

const LowPriorityPlugin = createPlugin({
  name: 'lowPriority',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 10, // Lower priority
  // ...
});
```

### 2. Conditional Hook Execution

Optimize performance by implementing conditions for when hooks should run:

```typescript
const ConditionalPlugin = createPlugin({
  name: 'conditional',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  // Only run for specific requests
  conditions: {
    [PluginHook.BEFORE_REQUEST]: (context) => {
      // Only run for POST requests
      return context.config.method === 'POST';
    },
    [PluginHook.AFTER_RESPONSE]: (context) => {
      // Only run for successful responses
      return context.response.ok;
    }
  },
  
  // Hook implementations...
});
```

### 3. Lazy Loading Plugins

Load plugins only when needed to reduce initial load time:

```typescript
// Register for lazy loading
fx.registerLazyPlugin({
  name: 'analytics',
  load: async () => {
    // This could even dynamically import the module
    const { AnalyticsPlugin } = await import('./analytics-plugin');
    return AnalyticsPlugin;
  }
});

// Load when needed
async function enableAnalytics() {
  await fx.loadPlugin('analytics');
  console.log('Analytics enabled');
}

// Call this when user opts in to analytics
const optInButton = document.getElementById('opt-in-analytics');
optInButton.addEventListener('click', enableAnalytics);
```

### 4. Timeouts for Unresponsive Plugins

Prevent plugins from hanging the application:

```typescript
const TimeoutSafePlugin = createPlugin({
  name: 'timeoutSafe',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  // Set timeouts for hooks
  timeouts: {
    [PluginHook.BEFORE_REQUEST]: 500, // 500ms timeout
    [PluginHook.AFTER_RESPONSE]: 1000 // 1000ms timeout
  },
  
  // Hook implementations...
});
```

## Error Handling and Reliability

### 1. Circuit Breaker Pattern

Implement circuit breakers to prevent cascading failures:

```typescript
const CircuitBreakerPlugin = createPlugin({
  name: 'circuitBreaker',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  // Configure circuit breaker
  circuitBreaker: {
    failureThreshold: 5, // Open after 5 consecutive failures
    resetTimeout: 30000 // Try again after 30 seconds
  },
  
  // Hook implementations that might fail...
});
```

### 2. Fallbacks for Graceful Recovery

Implement fallbacks to maintain functionality when plugins fail:

```typescript
const ResilientPlugin = createPlugin({
  name: 'resilient',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  // Define fallbacks for each hook
  fallbacks: {
    [PluginHook.BEFORE_REQUEST]: (context, error) => {
      console.warn('Plugin error in beforeRequest, using default config:', error);
      // Return unmodified config as fallback
      return context.config;
    },
    [PluginHook.AFTER_RESPONSE]: (context, error) => {
      console.warn('Plugin error in afterResponse, using original response:', error);
      // Return unmodified response as fallback
      return context.response;
    }
  },
  
  // Potentially risky hook implementations...
  beforeRequest(context) {
    // Something that might fail...
    if (Math.random() < 0.1) {
      throw new Error('Random failure');
    }
    return context.config;
  }
});
```

### 3. Health Monitoring

Monitor plugin health to detect issues early:

```typescript
// Periodically check plugin health
setInterval(() => {
  const health = fx.getPluginHealth();
  
  // Check for high error rates
  for (const [pluginHook, metrics] of Object.entries(health)) {
    if (metrics.totalCalls > 10 && metrics.errors / metrics.totalCalls > 0.1) {
      console.warn(`High error rate detected in plugin ${pluginHook}: ${(metrics.errors / metrics.totalCalls * 100).toFixed(2)}%`);
    }
  }
  
  // Check for circuit breaker activations
  for (const [pluginHook, metrics] of Object.entries(health)) {
    if (metrics.circuit?.isOpen) {
      console.warn(`Circuit breaker open for ${pluginHook}`);
    }
  }
}, 60000); // Check every minute
```

## Monitoring and Debugging

### 1. Performance Metrics

Track performance to identify bottlenecks:

```typescript
// Get overall performance metrics
const metrics = fx.getPerformanceMetrics();
console.log('Plugin execution times:', metrics);

// Reset metrics for a fresh measurement
fx.resetHealthMetrics();

// Benchmark a specific operation
async function benchmarkOperation() {
  fx.resetHealthMetrics();
  
  await fx.get('/api/large-dataset');
  
  const metrics = fx.getPluginHealth();
  return metrics;
}
```

### 2. Logging Specific Plugins

Focus debugging on specific plugins:

```typescript
// Configure logging plugin to debug a specific request
const LoggingPlugin = createPlugin({
  name: 'debugLogger',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 100,
  
  // Only log requests to a specific endpoint
  conditions: {
    [PluginHook.BEFORE_REQUEST]: (context) => {
      return context.config.url.includes('/api/problematic-endpoint');
    }
  },
  
  beforeRequest(context) {
    console.group(`DEBUG ${context.config.url}`);
    console.log('Request config:', JSON.stringify(context.config, null, 2));
    
    // Add timing
    context._debugStartTime = performance.now();
    return context.config;
  },
  
  afterResponse(context) {
    const duration = performance.now() - context._debugStartTime;
    console.log(`Response after ${duration.toFixed(2)}ms:`, {
      status: context.response.status,
      ok: context.response.ok,
      headers: Object.fromEntries([...context.response.headers.entries()])
    });
    console.groupEnd();
    return context.response;
  }
});

// Register temporarily for debugging
fx.registerPlugin(LoggingPlugin);

// Later, remove when debugging is complete
fx.unregisterPlugin('debugLogger');
```

### 3. Reset Circuit Breakers

Manually reset circuit breakers during testing:

```typescript
// Reset all circuit breakers
fx.resetCircuitBreakers();

// Reset for a specific plugin
fx.resetCircuitBreakers('errorHandler');
```

## Best Practices

### 1. Organize Plugins Logically

Group plugins by function and priority:

```typescript
// Infrastructure plugins (run first)
fx.registerPlugin(LoggingPlugin);
fx.registerPlugin(ErrorHandlerPlugin);
fx.registerPlugin(OfflinePlugin);

// Business logic plugins (run in the middle)
fx.registerPlugin(AuthPlugin);
fx.registerPlugin(DataTransformPlugin);

// UI plugins (run last)
fx.registerPlugin(ProgressPlugin);
fx.registerPlugin(NotificationPlugin);
```

### 2. Plugin Composition

Combine smaller, focused plugins rather than creating monolithic ones:

```typescript
// Instead of one large AuthPlugin that does everything,
// split into smaller focused plugins:

// 1. Token management
const TokenPlugin = createPlugin({
  name: 'token',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 95,
  
  // Token management logic...
});

// 2. Authentication headers
const AuthHeadersPlugin = createPlugin({
  name: 'authHeaders',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 90,
  dependencies: ['token'], // Depends on TokenPlugin
  
  // Auth header logic...
});

// 3. Auth state UI
const AuthUIPlugin = createPlugin({
  name: 'authUI',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 20,
  dependencies: ['token'], // Depends on TokenPlugin
  
  // UI update logic...
});

// Register all three
fx.registerPlugin(TokenPlugin);
fx.registerPlugin(AuthHeadersPlugin);
fx.registerPlugin(AuthUIPlugin);
```

### 3. Minimize Side Effects

Keep plugins focused and limit side effects:

```typescript
// Bad: Plugin with many side effects
const BadPlugin = createPlugin({
  name: 'bad',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  beforeRequest(context) {
    // Manipulates DOM
    document.getElementById('status').textContent = 'Loading...';
    
    // Modifies global state
    window.__lastRequestTime = Date.now();
    
    // Makes additional network requests
    fetch('/api/log-event', { method: 'POST' });
    
    return context.config;
  }
});

// Good: Focused plugin with minimal side effects
const GoodPlugin = createPlugin({
  name: 'good',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  // State is contained within the plugin
  requestTimes: new Map(),
  
  beforeRequest(context) {
    // Store state privately
    this.requestTimes.set(context.config.url, Date.now());
    return context.config;
  }
});
```

## Common Patterns

### 1. Request Transformation Chain

Transform requests through multiple plugins:

```typescript
// 1. Base URL transformer
const BaseUrlPlugin = createPlugin({
  name: 'baseUrl',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 100,
  
  beforeRequest(context) {
    if (!context.config.url.startsWith('http')) {
      context.config.url = `https://api.example.com${context.config.url}`;
    }
    return context.config;
  }
});

// 2. Authentication transformer
const AuthPlugin = createPlugin({
  name: 'auth',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 90,
  
  beforeRequest(context) {
    context.config.headers = context.config.headers || {};
    context.config.headers['Authorization'] = `Bearer ${this.getToken()}`;
    return context.config;
  },
  
  getToken() {
    return localStorage.getItem('auth_token') || '';
  }
});

// 3. Timestamp transformer
const TimestampPlugin = createPlugin({
  name: 'timestamp',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 80,
  
  beforeRequest(context) {
    const url = new URL(context.config.url, window.location.origin);
    url.searchParams.append('_t', Date.now().toString());
    context.config.url = url.toString();
    return context.config;
  }
});

// Register in order of priority
fx.registerPlugin(BaseUrlPlugin);
fx.registerPlugin(AuthPlugin);
fx.registerPlugin(TimestampPlugin);
```

### 2. Response Processing Pipeline

Process responses through multiple plugins:

```typescript
// 1. Error checking
const ErrorCheckPlugin = createPlugin({
  name: 'errorCheck',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 100,
  
  afterResponse(context) {
    if (!context.response.ok) {
      // Add error details to the response
      const errorData = context.response.json() || {};
      context.response.error = {
        code: errorData.code || context.response.status,
        message: errorData.message || 'Unknown error'
      };
    }
    return context.response;
  }
});

// 2. Data normalization
const NormalizerPlugin = createPlugin({
  name: 'normalizer',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 90,
  
  afterResponse(context) {
    if (context.response.ok) {
      const data = context.response.json();
      if (data && Array.isArray(data.items)) {
        // Normalize response to a standard format
        context.response.normalizedData = {
          items: data.items.map(item => this.normalizeItem(item)),
          meta: data.meta || {}
        };
      }
    }
    return context.response;
  },
  
  normalizeItem(item) {
    // Normalize item to standard format
    return {
      id: item.id || item._id,
      name: item.name || item.title || '',
      // ...other normalizations
    };
  }
});

// Register in order
fx.registerPlugin(ErrorCheckPlugin);
fx.registerPlugin(NormalizerPlugin);
```

### 3. Feature Flags and A/B Testing

Enable features conditionally or for specific user segments:

```typescript
const FeatureFlagPlugin = createPlugin({
  name: 'featureFlags',
  version: '1.0.0',
  apiVersion: '2.0.0',
  priority: 85,
  
  // Feature flag definitions
  flags: {
    'use-new-api': {
      enabled: false,
      userPercentage: 0.1 // 10% of users
    },
    'include-debug-info': {
      enabled: true,
      environments: ['development', 'staging']
    }
  },
  
  // Check if user is in test group
  isUserInTestGroup(flagName) {
    const flag = this.flags[flagName];
    if (!flag || !flag.enabled) return false;
    
    // Environment check
    if (flag.environments && !flag.environments.includes(process.env.NODE_ENV)) {
      return false;
    }
    
    // Percentage rollout
    if (flag.userPercentage) {
      const userId = localStorage.getItem('user_id') || '';
      const hash = this.hashString(flagName + userId);
      return (hash % 100) / 100 < flag.userPercentage;
    }
    
    return true;
  },
  
  // Simple string hash function
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  },
  
  // Apply feature flags to requests
  beforeRequest(context) {
    // Use new API endpoint for test group
    if (this.isUserInTestGroup('use-new-api')) {
      context.config.url = context.config.url.replace('/api/v1/', '/api/v2/');
    }
    
    // Add debug info for certain environments
    if (this.isUserInTestGroup('include-debug-info')) {
      const url = new URL(context.config.url, window.location.origin);
      url.searchParams.append('debug', 'true');
      context.config.url = url.toString();
    }
    
    return context.config;
  }
});
```

## Migration from Original Fixi

If you're migrating from the original Fixi implementation to the plugin-based approach, here's how to transition:

### 1. Direct Feature to Plugin Mapping

| Original Feature | Plugin Equivalent |
| ---------------- | ----------------- |
| `fixi.csrf` | `CsrfPlugin` |
| `fixi.cache` | `CachePlugin` |
| Custom error handlers | `ErrorHandlerPlugin` |
| DOM manipulation code | `ProgressPlugin` |
| Analytics code | `AnalyticsPlugin` |
| HTML sanitization | `SanitizerPlugin` |

### 2. Step-by-Step Migration

Start with a simple wrapper:

```typescript
// Keep your existing Fixi code while transitioning
const originalFixi = new Fixi({
  // Your existing config
});

// Create enhanced version alongside
const fx = createPluginSystem(originalFixi);

// Add plugins one by one
fx.registerPlugin(CsrfPlugin);
fx.registerPlugin(CachePlugin);
// etc.

// Start migrating code to use fx instead of originalFixi
// Use originalFixi.fetch for critical code until fully migrated
```

### 3. Update Middleware Patterns

Convert your existing middleware to plugins:

```typescript
// Before: Custom middleware
const originalFixi = new Fixi();

// Old middleware approach
originalFixi.use((config, next) => {
  console.log('Request:', config);
  return next(config).then(response => {
    console.log('Response:', response);
    return response;
  });
});

// After: Convert to plugins
const fx = createPluginSystem(new Fixi());

// New plugin approach
const LoggingPlugin = createPlugin({
  name: 'logging',
  version: '1.0.0',
  apiVersion: '2.0.0',
  
  beforeRequest(context) {
    console.log('Request:', context.config);
    return context.config;
  },
  
  afterResponse(context) {
    console.log('Response:', context.response);
    return context.response;
  }
});

fx.registerPlugin(LoggingPlugin);
```

---

By following this guide, you can take full advantage of the Improved Fixi Plugin System's performance, reliability, and flexibility features while maintaining a clean, maintainable codebase.