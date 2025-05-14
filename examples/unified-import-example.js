/**
 * Example usage of the unified package with named exports
 */

// Standard browser version with DOM integration
import fixiplug from '../fixiplug.js';
console.log('Standard browser version loaded');

// Core version (no DOM)
import { core } from '../fixiplug.js';
console.log('Core version loaded');

// Test version
import { test } from '../fixiplug.js';
console.log('Test version loaded');

// Server version
import { server } from '../fixiplug.js';
console.log('Server version loaded');

// Custom configured version
import { configure } from '../fixiplug.js';
const custom = configure({
  logging: true,
  dom: false,
  test: true,
  server: false,
  advanced: {
    customHooks: ['myHook1', 'myHook2']
  }
});
console.log('Custom configured version loaded');

// Alternative import methods
// These imports access the same objects as above but through different entry points
import coreAlternative from '../core/index.js';
// Note: Direct test module not available - using main export instead
import { test as testAlternative } from '../fixiplug.js';
import { server as serverAlternative } from '../fixiplug.js';

// Example plugin
function examplePlugin(ctx) {
  ctx.on('init', (event) => {
    console.log('Plugin initialized');
    return event;
  });
  
  ctx.registerCleanup(() => {
    console.log('Plugin cleanup');
  });
}

// Using the different versions
fixiplug.use(examplePlugin);
core.use(examplePlugin);
test.use(examplePlugin);
server.use(examplePlugin);
custom.use(examplePlugin);

// Dispatch events
fixiplug.dispatch('init', { source: 'example' })
  .then(() => console.log('Standard version dispatched'));

core.dispatch('init', { source: 'example' })
  .then(() => console.log('Core version dispatched'));

test.dispatch('init', { source: 'example' })
  .then(() => console.log('Test version dispatched'));

server.dispatch('init', { source: 'example' })
  .then(() => console.log('Server version dispatched'));

custom.dispatch('init', { source: 'example' })
  .then(() => console.log('Custom version dispatched'));
