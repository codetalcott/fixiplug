#!/usr/bin/env node
/**
 * Unit Test Runner for SQLite Framework Service Layer
 *
 * Runs all unit tests and provides a summary report
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
  'unit/request-adapter.test.js',
  'unit/response-adapter.test.js',
  'unit/validation.test.js',
  'unit/cache-manager.test.js',
  'unit/metrics.test.js',
  'unit/logger.test.js'
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

console.log('═'.repeat(60));
console.log('SQLite Framework Service Layer - Unit Tests');
console.log('═'.repeat(60));
console.log('');

/**
 * Run a single test file
 * @param {string} testFile - Path to test file
 * @returns {Promise<Object>} Test result
 */
function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, testFile);
    const testName = testFile.replace('unit/', '').replace('.test.js', '');

    console.log(`Running ${testName}...`);

    const child = spawn('node', [testPath], {
      stdio: 'pipe',
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Parse output to extract pass/fail counts
      const passMatch = stdout.match(/(\d+) passed/);
      const failMatch = stdout.match(/(\d+) failed/);

      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;

      totalPassed += passed;
      totalFailed += failed;

      results.push({
        name: testName,
        passed,
        failed,
        exitCode: code,
        output: stdout
      });

      // Print test output
      console.log(stdout);

      if (stderr) {
        console.error(stderr);
      }

      resolve({ passed, failed, exitCode: code });
    });

    child.on('error', (error) => {
      console.error(`Error running ${testName}:`, error.message);
      totalFailed++;
      results.push({
        name: testName,
        passed: 0,
        failed: 1,
        exitCode: 1,
        output: `Error: ${error.message}`
      });
      resolve({ passed: 0, failed: 1, exitCode: 1 });
    });
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  for (const test of tests) {
    await runTest(test);
  }

  // Print summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('Test Summary');
  console.log('═'.repeat(60));
  console.log('');

  // Print individual test results
  for (const result of results) {
    const status = result.exitCode === 0 ? '✓' : '✗';
    const color = result.exitCode === 0 ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${color}${status}${reset} ${result.name.padEnd(30)} ${result.passed} passed, ${result.failed} failed`);
  }

  console.log('');
  console.log('─'.repeat(60));

  // Print totals
  const totalTests = totalPassed + totalFailed;
  const successRate = totalTests > 0
    ? ((totalPassed / totalTests) * 100).toFixed(1)
    : 0;

  console.log(`Total Tests:    ${totalTests}`);
  console.log(`Passed:         ${totalPassed}`);
  console.log(`Failed:         ${totalFailed}`);
  console.log(`Success Rate:   ${successRate}%`);
  console.log('');

  if (totalFailed === 0) {
    console.log('\x1b[32m✓ All tests passed!\x1b[0m');
    process.exit(0);
  } else {
    console.log(`\x1b[31m✗ ${totalFailed} test(s) failed\x1b[0m`);
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
