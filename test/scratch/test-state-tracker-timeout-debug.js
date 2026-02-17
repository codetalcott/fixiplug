/**
 * Debug timeout issue
 */

import { configure } from './fixiplug.js';
import stateTrackerPlugin from './plugins/state-tracker.js';

const fixiplug = configure({ features: [] });
fixiplug.use(stateTrackerPlugin);

console.log('Testing timeout...\n');

const promise = fixiplug.dispatch('api:waitForState', {
  state: 'never',
  timeout: 200
});

console.log('Promise created:', promise);

promise
  .then(result => {
    console.log('RESOLVED:', result);
    process.exit(1);
  })
  .catch(err => {
    console.log('REJECTED:', err.message);
    process.exit(0);
  });

// Fallback timeout
setTimeout(() => {
  console.log('HUNG - promise never settled');
  process.exit(1);
}, 1000);
