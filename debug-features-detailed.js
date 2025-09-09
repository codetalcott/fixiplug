/**
 * Detailed debug of features system
 */

import { configure } from './fixiplug.js';
import { FEATURES } from './builder/fixiplug-factory.js';

console.log('=== Detailed Features Debug ===\n');

// Create configure function and inspect its behavior 
console.log('FEATURES object:', FEATURES);
console.log('FEATURES.LOGGING value:', JSON.stringify(FEATURES.LOGGING));

// Test the configure function step by step
console.log('\nTesting empty features:');
const features = [];
console.log('Features array:', features);

const fixiplug = configure({ features: features });

// Let's see what the config contains internally
console.log('hasFeature method:', typeof fixiplug.hasFeature);

// Test the feature check
const loggingEnabled = fixiplug.hasFeature(FEATURES.LOGGING);
console.log(`hasFeature("${FEATURES.LOGGING}"):`, loggingEnabled);

// Let's also test with undefined vs empty array
console.log('\nTesting with undefined features:');
const fixiplugUndef = configure({});
console.log('hasFeature(LOGGING) with undefined features:', fixiplugUndef.hasFeature(FEATURES.LOGGING));

console.log('\nTesting with null features:');
const fixiplugNull = configure({ features: null });
console.log('hasFeature(LOGGING) with null features:', fixiplugNull.hasFeature(FEATURES.LOGGING));

console.log('\nTesting default configure:');
const fixiplugDefault = configure();
console.log('hasFeature(LOGGING) with default configure:', fixiplugDefault.hasFeature(FEATURES.LOGGING));