/**
 * Unit tests for Logger
 */

import assert from 'node:assert';
import { Logger, LogLevel, createCorrelationId, createRequestLogger } from '../../../sdk/adapters/sqlite-framework/logger.js';

console.log('Running Logger tests...\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    failedTests++;
  }
}

// Test 1: Log at info level
test('should log at info level', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.info('Test message', { key: 'value' });

  assert.strictEqual(logs.length, 1);
  const log = JSON.parse(logs[0]);
  assert.strictEqual(log.level, 'info');
  assert.strictEqual(log.message, 'Test message');
  assert.strictEqual(log.key, 'value');
});

// Test 2: Filter logs by level
test('should filter logs by level', () => {
  const logs = [];
  const logger = new Logger({
    level: 'warn',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.debug('Debug message');  // Should be filtered
  logger.info('Info message');    // Should be filtered
  logger.warn('Warn message');    // Should be logged
  logger.error('Error message');  // Should be logged

  assert.strictEqual(logs.length, 2);
});

// Test 3: JSON format
test('should format logs as JSON', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.info('Test', { data: 'value' });

  const log = JSON.parse(logs[0]);
  assert.strictEqual(typeof log.timestamp, 'string');
  assert.strictEqual(log.level, 'info');
  assert.strictEqual(log.message, 'Test');
  assert.strictEqual(log.data, 'value');
});

// Test 4: Pretty format
test('should format logs in pretty format', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'pretty',
    output: (msg) => logs.push(msg)
  });

  logger.info('Test message', { key: 'value' });

  assert(logs[0].includes('INFO'));
  assert(logs[0].includes('Test message'));
  assert(logs[0].includes('key'));
});

// Test 5: Global context
test('should include global context in all logs', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    component: 'test-component',
    output: (msg) => logs.push(msg)
  });

  logger.info('Message 1');
  logger.info('Message 2');

  const log1 = JSON.parse(logs[0]);
  const log2 = JSON.parse(logs[1]);

  assert.strictEqual(log1.component, 'test-component');
  assert.strictEqual(log2.component, 'test-component');
  assert(typeof log1.pid === 'number');
});

// Test 6: Child logger
test('should create child logger with additional context', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  const childLogger = logger.child({ requestId: 'uuid-123' });
  childLogger.info('Child message');

  const log = JSON.parse(logs[0]);
  assert.strictEqual(log.requestId, 'uuid-123');
});

// Test 7: Child logger inherits settings
test('should inherit settings in child logger', () => {
  const logs = [];
  const logger = new Logger({
    level: 'warn',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  const childLogger = logger.child({ context: 'child' });
  childLogger.info('Should be filtered');
  childLogger.warn('Should be logged');

  assert.strictEqual(logs.length, 1);
});

// Test 8: Enable/disable logging
test('should enable and disable logging', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.info('Message 1');
  logger.disable();
  logger.info('Message 2');  // Should not be logged
  logger.enable();
  logger.info('Message 3');

  assert.strictEqual(logs.length, 2);
});

// Test 9: Check if enabled
test('should check if logging is enabled', () => {
  const logger = new Logger({ level: 'info' });

  assert.strictEqual(logger.isEnabled(), true);

  logger.disable();
  assert.strictEqual(logger.isEnabled(), false);

  logger.enable();
  assert.strictEqual(logger.isEnabled(), true);
});

// Test 10: Set log level
test('should set log level', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.debug('Debug 1');  // Filtered
  assert.strictEqual(logs.length, 0);

  logger.setLevel('debug');
  logger.debug('Debug 2');  // Logged
  assert.strictEqual(logs.length, 1);
});

// Test 11: Get log level
test('should get current log level', () => {
  const logger = new Logger({ level: 'warn' });

  assert.strictEqual(logger.getLevel(), 'warn');

  logger.setLevel('debug');
  assert.strictEqual(logger.getLevel(), 'debug');
});

// Test 12: Create correlation ID
test('should create correlation ID', () => {
  const id1 = createCorrelationId();
  const id2 = createCorrelationId();

  assert(typeof id1 === 'string');
  assert(id1.length > 0);
  assert.notStrictEqual(id1, id2);
});

// Test 13: Create request logger
test('should create request logger with correlation ID', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  const requestLogger = createRequestLogger(logger, {
    method: 'getRecommendations',
    params: { domain: 'finance' }
  });

  requestLogger.info('Request started');

  const log = JSON.parse(logs[0]);
  assert(typeof log.requestId === 'string');
  assert.strictEqual(log.method, 'getRecommendations');
  assert(typeof log.timestamp === 'number');
});

// Test 14: Multiple log levels
test('should support all log levels', () => {
  const logs = [];
  const logger = new Logger({
    level: 'debug',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.debug('Debug message');
  logger.info('Info message');
  logger.warn('Warn message');
  logger.error('Error message');

  assert.strictEqual(logs.length, 4);

  const levels = logs.map(log => JSON.parse(log).level);
  assert.deepStrictEqual(levels, ['debug', 'info', 'warn', 'error']);
});

// Test 15: Complex context objects
test('should handle complex context objects', () => {
  const logs = [];
  const logger = new Logger({
    level: 'info',
    format: 'json',
    output: (msg) => logs.push(msg)
  });

  logger.info('Complex context', {
    nested: {
      object: {
        value: 'deep'
      }
    },
    array: [1, 2, 3],
    number: 42,
    boolean: true
  });

  const log = JSON.parse(logs[0]);
  assert.strictEqual(log.nested.object.value, 'deep');
  assert.deepStrictEqual(log.array, [1, 2, 3]);
  assert.strictEqual(log.number, 42);
  assert.strictEqual(log.boolean, true);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Logger Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
