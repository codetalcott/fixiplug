/**
 * Debug what features are actually enabled
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';

console.log('=== Debug Features ===\n');

console.log('Available FEATURES:', FEATURES);

// Test 1: Empty features array
console.log('\n1. Empty features array:');
const empty = configure({ features: [] });

console.log('Features passed:', []);
console.log('hasFeature(LOGGING):', empty.hasFeature(FEATURES.LOGGING));

// Try to inspect internal config
console.log('Features config:', empty.hasFeature ? 'hasFeature method exists' : 'no hasFeature method');

await empty.dispatch('debug1', { test: 'empty' });

// Test 2: Explicit LOGGING feature
console.log('\n2. With LOGGING feature:');
const withLogging = configure({ features: [FEATURES.LOGGING] });

console.log('Features passed:', [FEATURES.LOGGING]);
console.log('hasFeature(LOGGING):', withLogging.hasFeature(FEATURES.LOGGING));

await withLogging.dispatch('debug2', { test: 'logging' });