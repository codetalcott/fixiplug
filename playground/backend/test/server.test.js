/**
 * Agent Playground Backend - Tests
 *
 * Simple tests for backend server functionality
 *
 * @module playground/backend/test/server.test
 */

import { ConversationManager } from '../services/conversation-manager.js';
import { LLMProviderService } from '../services/llm-provider.js';

console.log('=== Agent Playground Backend Tests ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============================================================
// ConversationManager Tests
// ============================================================

console.log('ConversationManager Tests');
console.log('------------------------');

test('Create conversation returns ID', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  assert(typeof id === 'string', 'ID should be a string');
  assert(id.length > 0, 'ID should not be empty');
});

test('Get conversation returns correct data', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  const conv = manager.getConversation(id);
  assert(conv !== null, 'Conversation should exist');
  assert(conv.id === id, 'IDs should match');
  assert(Array.isArray(conv.messages), 'Messages should be an array');
});

test('Get non-existent conversation returns null', () => {
  const manager = new ConversationManager();
  const conv = manager.getConversation('non-existent');
  assert(conv === null, 'Should return null for non-existent conversation');
});

test('Save conversation updates messages', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ];

  manager.saveConversation(id, messages);
  const conv = manager.getConversation(id);
  assert(conv.messages.length === 2, 'Should have 2 messages');
  assert(conv.messages[0].content === 'Hello', 'First message should match');
});

test('Append message adds to conversation', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  manager.appendMessage(id, { role: 'user', content: 'Test' });

  const conv = manager.getConversation(id);
  assert(conv.messages.length === 1, 'Should have 1 message');
  assert(conv.messages[0].content === 'Test', 'Message should match');
});

test('Delete conversation removes it', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  manager.deleteConversation(id);

  const conv = manager.getConversation(id);
  assert(conv === null, 'Conversation should be deleted');
});

test('Get all conversations returns array', () => {
  const manager = new ConversationManager();
  manager.createConversation();
  manager.createConversation();

  const all = manager.getAllConversations();
  assert(Array.isArray(all), 'Should return an array');
  assert(all.length === 2, 'Should have 2 conversations');
});

test('Clear all removes all conversations', () => {
  const manager = new ConversationManager();
  manager.createConversation();
  manager.createConversation();
  manager.clearAll();

  const all = manager.getAllConversations();
  assert(all.length === 0, 'Should have no conversations');
});

test('Get stats returns correct data', () => {
  const manager = new ConversationManager();
  const id = manager.createConversation();
  manager.saveConversation(id, [
    { role: 'user', content: 'Test' },
    { role: 'assistant', content: 'Response' }
  ]);

  const stats = manager.getStats();
  assert(stats.conversationCount === 1, 'Should have 1 conversation');
  assert(stats.totalMessages === 2, 'Should have 2 messages');
  assert(parseFloat(stats.avgMessagesPerConversation) === 2, 'Average should be 2');
});

test('Cleanup old conversations works', () => {
  const manager = new ConversationManager();
  manager.maxConversations = 10;

  // Create 11 conversations (one over max triggers cleanup)
  for (let i = 0; i < 11; i++) {
    manager.createConversation();
  }

  const all = manager.getAllConversations();
  // After cleanup, should have removed 20% (2 conversations), leaving 9
  assert(all.length <= 10, 'Should cleanup to or below max limit');
});

console.log('');

// ============================================================
// LLMProviderService Tests
// ============================================================

console.log('LLMProviderService Tests');
console.log('-----------------------');

test('Initialize without config', () => {
  const provider = new LLMProviderService();
  assert(provider !== null, 'Should initialize');
});

test('Check provider availability', () => {
  const provider = new LLMProviderService();
  const available = provider.isProviderAvailable('openai');
  assert(typeof available === 'boolean', 'Should return boolean');
});

test('Get available providers returns array', () => {
  const provider = new LLMProviderService();
  const providers = provider.getAvailableProviders();
  assert(Array.isArray(providers), 'Should return an array');
});

test('Get provider info returns object', () => {
  const provider = new LLMProviderService();
  const info = provider.getProviderInfo();
  assert(typeof info === 'object', 'Should return object');
  assert('openai' in info, 'Should have openai info');
  assert('anthropic' in info, 'Should have anthropic info');
});

test('Provider info has correct structure', () => {
  const provider = new LLMProviderService();
  const info = provider.getProviderInfo();

  assert(typeof info.openai.available === 'boolean', 'OpenAI available should be boolean');
  assert(Array.isArray(info.openai.models), 'OpenAI models should be array');
  assert(typeof info.anthropic.available === 'boolean', 'Anthropic available should be boolean');
  assert(Array.isArray(info.anthropic.models), 'Anthropic models should be array');
});

test('Chat with invalid provider throws error', async () => {
  const provider = new LLMProviderService();
  let error;

  try {
    await provider.chat({ provider: 'invalid' });
  } catch (e) {
    error = e;
  }

  assert(error !== undefined, 'Should throw error');
  assert(error.message.includes('Unknown provider'), 'Error message should mention provider');
});

console.log('');

// ============================================================
// Summary
// ============================================================

console.log('=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);
console.log('');

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
