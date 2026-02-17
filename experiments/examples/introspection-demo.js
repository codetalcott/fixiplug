/**
 * Introspection Plugin Demo
 *
 * This example demonstrates how LLM agents can use the introspection plugin
 * to discover and understand FixiPlug capabilities without reading source code.
 *
 * Run with: node examples/introspection-demo.js
 */

import { configure } from '../fixiplug.js';
import { FEATURES } from '../builder/fixiplug-factory.js';
import introspectionPlugin from '../plugins/introspection.js';
import loggerPlugin from '../plugins/logger.js';

console.log('=== FixiPlug Introspection Demo ===\n');
console.log('This demo simulates an LLM agent discovering FixiPlug capabilities.\n');

// Initialize FixiPlug
const fixiplug = configure({ features: [FEATURES.LOGGING] });

// Load introspection plugin (enables discovery)
fixiplug.use(introspectionPlugin);

// Load some example plugins
fixiplug.use(loggerPlugin);
fixiplug.use(function weatherPlugin(ctx) {
  ctx.on('api:getWeather', (event) => {
    const { city = 'San Francisco' } = event;
    return {
      city,
      temperature: 72,
      conditions: 'Sunny',
      timestamp: new Date().toISOString()
    };
  });
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 1: Agent Discovers FixiPlug
// ========================================
console.log('📋 Scenario 1: Agent Discovery\n');
console.log('Agent: "What can I do with this FixiPlug instance?"\n');

const discovery = await fixiplug.dispatch('api:introspect');
console.log(`Agent discovers FixiPlug v${discovery.fixiplug.version}`);
console.log(`  - ${discovery.fixiplug.metadata.pluginCount} plugins installed`);
console.log(`  - ${discovery.fixiplug.metadata.hookCount} hooks available`);
console.log(`  - ${discovery.fixiplug.capabilities.methods.length} methods available\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 2: Agent Lists Plugins
// ========================================
console.log('📋 Scenario 2: Plugin Exploration\n');
console.log('Agent: "What plugins are installed?"\n');

const plugins = await fixiplug.dispatch('api:getPluginCapabilities');
plugins.capabilities.forEach(plugin => {
  console.log(`  🔌 ${plugin.name}`);
  console.log(`     Status: ${plugin.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`     Hooks: ${plugin.hooks.length}`);
});
console.log();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 3: Agent Examines Specific Plugin
// ========================================
console.log('📋 Scenario 3: Plugin Deep Dive\n');
console.log('Agent: "Tell me about the weatherPlugin"\n');

const weatherDetails = await fixiplug.dispatch('api:getPluginDetails', {
  pluginName: 'weatherPlugin'
});

console.log(`  Plugin: ${weatherDetails.name}`);
console.log(`  Type: ${weatherDetails.metadata.type}`);
console.log(`  Enabled: ${weatherDetails.enabled}`);
console.log(`  Hooks registered:`);
weatherDetails.hooks.forEach(hook => {
  console.log(`    - ${hook.hookName} (priority: ${hook.priority})`);
});
console.log();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 4: Agent Discovers Hook Schema
// ========================================
console.log('📋 Scenario 4: Hook Schema Discovery\n');
console.log('Agent: "What does the api:getWeather hook do?"\n');

const weatherSchema = await fixiplug.dispatch('api:getHookSchema', {
  hookName: 'api:getWeather'
});

console.log(`  Hook: ${weatherSchema.hookName}`);
console.log(`  Exists: ${weatherSchema.exists}`);
console.log(`  Type: ${weatherSchema.schema.type}`);
console.log(`  Returns: ${weatherSchema.schema.returns}`);
console.log(`  Implemented by: ${weatherSchema.plugins.join(', ')}`);
console.log();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 5: Agent Uses Discovered API
// ========================================
console.log('📋 Scenario 5: Using Discovered APIs\n');
console.log('Agent: "Now I\'ll use the api:getWeather hook I discovered"\n');

const weather = await fixiplug.dispatch('api:getWeather', {
  city: 'New York'
});

console.log(`  Weather in ${weather.city}:`);
console.log(`    Temperature: ${weather.temperature}°F`);
console.log(`    Conditions: ${weather.conditions}`);
console.log(`    Updated: ${weather.timestamp}`);
console.log();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 6: Agent Explores All Hooks
// ========================================
console.log('📋 Scenario 6: Complete Hook Catalog\n');
console.log('Agent: "Show me all available hooks"\n');

const allHooks = await fixiplug.dispatch('api:getAvailableHooks');
const hookList = Object.keys(allHooks.hooks);

console.log(`  Found ${hookList.length} hooks:\n`);

// Group by type
const hooksByType = {};
for (const hookName of hookList) {
  const hook = allHooks.hooks[hookName];
  const type = hook.schema.type;
  if (!hooksByType[type]) hooksByType[type] = [];
  hooksByType[type].push(hookName);
}

for (const [type, hooks] of Object.entries(hooksByType)) {
  console.log(`  ${type.toUpperCase()} hooks:`);
  hooks.forEach(hook => console.log(`    - ${hook}`));
  console.log();
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Scenario 7: Agent Learns FixiPlug Methods
// ========================================
console.log('📋 Scenario 7: FixiPlug Core Methods\n');
console.log('Agent: "What methods can I call on the fixiplug instance?"\n');

const methods = discovery.fixiplug.capabilities.methods;
console.log(`  Available methods:\n`);
methods.forEach(method => {
  const params = method.params.length > 0 ? method.params.join(', ') : '';
  console.log(`    fixiplug.${method.name}(${params})`);
  console.log(`      → ${method.description}`);
  console.log();
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ========================================
// Summary
// ========================================
console.log('✨ Summary\n');
console.log('The LLM agent successfully:');
console.log('  ✅ Discovered FixiPlug version and capabilities');
console.log('  ✅ Listed all installed plugins');
console.log('  ✅ Examined specific plugin details');
console.log('  ✅ Understood hook schemas and types');
console.log('  ✅ Used discovered APIs autonomously');
console.log('  ✅ Explored complete hook catalog');
console.log('  ✅ Learned available methods\n');

console.log('All without reading a single line of source code! 🎉\n');
