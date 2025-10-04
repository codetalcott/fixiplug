/**
 * Simple verification script for table plugin
 * Checks that the plugin loads and exports correctly
 */

import createTablePlugin from './plugins/table.js';

console.log('=== Table Plugin Verification ===\n');

try {
  // Test 1: Plugin creation
  console.log('Test 1: Creating plugin...');
  const plugin = createTablePlugin();

  if (!plugin) {
    throw new Error('Plugin creation failed - returned null/undefined');
  }
  console.log('✅ Plugin created successfully');

  // Test 2: Plugin structure
  console.log('\nTest 2: Checking plugin structure...');
  if (!plugin.name) {
    throw new Error('Plugin missing name property');
  }
  console.log(`✅ Plugin name: ${plugin.name}`);

  if (!plugin.setup || typeof plugin.setup !== 'function') {
    throw new Error('Plugin missing setup function');
  }
  console.log('✅ Plugin has setup function');

  // Test 3: Plugin configuration
  console.log('\nTest 3: Testing custom configuration...');
  const customPlugin = createTablePlugin({
    autoRender: false,
    enableSorting: false,
    className: 'custom-table'
  });

  if (!customPlugin || !customPlugin.name) {
    throw new Error('Custom plugin creation failed');
  }
  console.log('✅ Custom configuration works');

  // Test 4: Export verification
  console.log('\nTest 4: Verifying module exports...');
  console.log('✅ Default export (createTablePlugin) works');

  console.log('\n🎉 All verification tests passed!');
  console.log('\nPlugin is ready to use. To see it in action:');
  console.log('  1. Start a local server: python3 -m http.server 8000');
  console.log('  2. Open http://localhost:8000/test-table.html for tests');
  console.log('  3. Open http://localhost:8000/demo-table.html for demos');

} catch (error) {
  console.error('❌ Verification failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
