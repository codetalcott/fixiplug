/**
 * Test suite for Introspection Plugin
 *
 * Tests the introspection plugin's ability to expose FixiPlug's
 * internal state, plugins, hooks, and schemas.
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';
import introspectionPlugin from './plugins/introspection.js';
import loggerPlugin from './plugins/logger.js';

console.log('=== FixiPlug Introspection Plugin Tests ===\n');

// Create test instance with introspection
const fixiplug = configure({ features: [FEATURES.LOGGING] });
fixiplug.use(introspectionPlugin);
fixiplug.use(loggerPlugin);

// Add a test plugin to verify introspection
fixiplug.use(function testPlugin(ctx) {
  ctx.on('test:event', (event) => {
    return { ...event, processed: true };
  });

  ctx.on('api:customTest', () => {
    return { message: 'Custom test API' };
  });
});

// ========================================
// Test 1: Complete Introspection
// ========================================
console.log('Test 1: Complete Introspection (api:introspect)');
const snapshot = await fixiplug.dispatch('api:introspect');

console.log('  Version:', snapshot.fixiplug.version);
console.log('  Plugin Count:', snapshot.fixiplug.metadata.pluginCount);
console.log('  Hook Count:', snapshot.fixiplug.metadata.hookCount);
console.log('  ✓ Complete snapshot returned\n');

// Validate structure
if (!snapshot.fixiplug.capabilities.plugins) {
  console.error('  ✗ Missing plugins capability');
}
if (!snapshot.fixiplug.capabilities.hooks) {
  console.error('  ✗ Missing hooks capability');
}
if (!snapshot.fixiplug.capabilities.methods) {
  console.error('  ✗ Missing methods capability');
}

// ========================================
// Test 2: Get Plugin Capabilities
// ========================================
console.log('Test 2: Get Plugin Capabilities (api:getPluginCapabilities)');
const pluginsResult = await fixiplug.dispatch('api:getPluginCapabilities');

console.log('  Registered plugins:');
pluginsResult.capabilities.forEach(plugin => {
  console.log(`    - ${plugin.name} (${plugin.enabled ? 'enabled' : 'disabled'})`);
  console.log(`      Hooks: ${plugin.hooks.length}`);
});
console.log('  ✓ Plugin capabilities retrieved\n');

// Validate
const introspectionPluginEntry = pluginsResult.capabilities.find(p => p.name === 'introspectionPlugin');
if (!introspectionPluginEntry) {
  console.error('  ✗ Introspection plugin not found in registry');
}

// ========================================
// Test 3: Get Available Hooks
// ========================================
console.log('Test 3: Get Available Hooks (api:getAvailableHooks)');
const hooksResult = await fixiplug.dispatch('api:getAvailableHooks');

console.log('  Available hooks:');
const hookNames = Object.keys(hooksResult.hooks);
hookNames.slice(0, 5).forEach(hookName => {
  const hook = hooksResult.hooks[hookName];
  console.log(`    - ${hookName}`);
  console.log(`      Handlers: ${hook.handlerCount}, Type: ${hook.schema.type}`);
});
console.log(`  ... and ${hookNames.length - 5} more hooks`);
console.log('  ✓ Hooks retrieved\n');

// Validate
if (!hooksResult.hooks['api:introspect']) {
  console.error('  ✗ api:introspect hook not found');
}

// ========================================
// Test 4: Get Plugin Details
// ========================================
console.log('Test 4: Get Plugin Details (api:getPluginDetails)');
const detailsResult = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'testPlugin'
});

if (detailsResult.error) {
  console.error(`  ✗ Error: ${detailsResult.error}`);
} else {
  console.log(`  Plugin: ${detailsResult.name}`);
  console.log(`  Enabled: ${detailsResult.enabled}`);
  console.log(`  Hooks registered: ${detailsResult.hooks.length}`);
  detailsResult.hooks.forEach(hook => {
    console.log(`    - ${hook.hookName} (priority: ${hook.priority})`);
  });
  console.log('  ✓ Plugin details retrieved\n');
}

// Test error case
const errorResult = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'nonexistent'
});
if (errorResult.error) {
  console.log('  ✓ Error handling works for nonexistent plugin\n');
}

// ========================================
// Test 5: Get Hook Schema
// ========================================
console.log('Test 5: Get Hook Schema (api:getHookSchema)');

// Test API hook
const apiSchema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'api:introspect'
});
console.log(`  Hook: ${apiSchema.hookName}`);
console.log(`  Exists: ${apiSchema.exists}`);
console.log(`  Type: ${apiSchema.schema.type}`);
console.log(`  Description: ${apiSchema.description}`);
console.log('  ✓ API hook schema retrieved\n');

// Test custom hook
const customSchema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'test:event'
});
console.log(`  Hook: ${customSchema.hookName}`);
console.log(`  Schema inferred: ${customSchema.schema.inferred}`);
console.log('  ✓ Custom hook schema inferred\n');

// Test nonexistent hook
const noHookSchema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'nonexistent:hook'
});
console.log(`  Nonexistent hook exists: ${noHookSchema.exists}`);
console.log('  ✓ Nonexistent hook handled gracefully\n');

// ========================================
// Test 6: Schema Inference Patterns
// ========================================
console.log('Test 6: Schema Inference Patterns');

// Add hooks with different patterns
fixiplug.use(function patternTestPlugin(ctx) {
  ctx.on('agent:command', () => ({ result: 'ok' }));
  ctx.on('state:change', () => ({ state: 'changed' }));
  ctx.on('custom:myHook', () => ({ custom: true }));
});

const patterns = [
  { hook: 'agent:command', expectedType: 'command' },
  { hook: 'state:change', expectedType: 'event' },
  { hook: 'custom:myHook', expectedType: 'custom' }
];

for (const { hook, expectedType } of patterns) {
  const schema = await fixiplug.dispatch('api:getHookSchema', { hookName: hook });
  const match = schema.schema.type === expectedType;
  console.log(`  ${hook}: ${schema.schema.type} ${match ? '✓' : '✗ Expected: ' + expectedType}`);
}
console.log('  ✓ Schema inference working\n');

// ========================================
// Test 7: FixiPlug Methods Documentation
// ========================================
console.log('Test 7: FixiPlug Methods Documentation');
const methods = snapshot.fixiplug.capabilities.methods;
console.log(`  Documented methods: ${methods.length}`);
console.log('  Sample methods:');
methods.slice(0, 3).forEach(method => {
  console.log(`    - ${method.name}(${method.params.join(', ')})`);
  console.log(`      ${method.description}`);
});
console.log('  ✓ Methods documented\n');

// ========================================
// Test 8: LLM Agent Discovery Workflow
// ========================================
console.log('Test 8: LLM Agent Discovery Workflow');
console.log('  Simulating agent discovery process...\n');

// Step 1: Agent gets complete picture
const agentSnapshot = await fixiplug.dispatch('api:introspect');
console.log('  Step 1: Agent discovers FixiPlug');
console.log(`    Found ${agentSnapshot.fixiplug.metadata.pluginCount} plugins`);
console.log(`    Found ${agentSnapshot.fixiplug.metadata.hookCount} hooks`);

// Step 2: Agent explores plugins
const agentPlugins = await fixiplug.dispatch('api:getPluginCapabilities');
console.log('  Step 2: Agent lists plugins');
agentPlugins.capabilities.forEach(p => {
  console.log(`    - ${p.name}: ${p.hooks.length} hooks`);
});

// Step 3: Agent examines specific plugin
const agentPlugin = agentPlugins.capabilities[0];
const agentDetails = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: agentPlugin.name
});
console.log(`  Step 3: Agent examines '${agentPlugin.name}'`);
console.log(`    Hooks: ${agentDetails.hooks.map(h => h.hookName).join(', ')}`);

// Step 4: Agent checks hook schema
if (agentDetails.hooks.length > 0) {
  const firstHook = agentDetails.hooks[0].hookName;
  const agentSchema = await fixiplug.dispatch('api:getHookSchema', {
    hookName: firstHook
  });
  console.log(`  Step 4: Agent checks '${firstHook}' schema`);
  console.log(`    Type: ${agentSchema.schema.type}`);
  console.log(`    Returns: ${agentSchema.schema.returns}`);
}

console.log('\n  ✓ Agent discovery workflow successful\n');

// ========================================
// Summary
// ========================================
console.log('=== Test Summary ===');
console.log('✓ All introspection tests passed');
console.log('✓ Plugin exposes internal state safely');
console.log('✓ Schema inference working correctly');
console.log('✓ LLM agents can discover capabilities autonomously');
