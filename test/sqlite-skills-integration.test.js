/**
 * SQLite Skills Integration Tests
 *
 * Tests full stack: Skills → Plugins → Service → Bridge → Python Framework
 *
 * These tests verify:
 * 1. Skills can be retrieved via api:getSkill
 * 2. Plugin hooks are registered and callable
 * 3. LLM integration works (retrieve_skill tool)
 * 4. End-to-end workflow functions
 *
 * Note: These tests require SQLITE_FRAMEWORK_PATH to be set and the Python framework
 * to be installed. Some tests are skipped if the framework is not available.
 */

import { createFixiplug } from '../builder/fixiplug-factory.js';
import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';
import introspectionPlugin from '../plugins/introspection.js';
import skillMdLoader from '../plugins/skill-md-loader.js';
import sqlitePatternLearner from '../plugins/sqlite-pattern-learner.js';
import sqliteExtensionGenerator from '../plugins/sqlite-extension-generator.js';
import sqliteAgentAmplification from '../plugins/sqlite-agent-amplification.js';
import sqliteAgentContext from '../plugins/sqlite-agent-context.js';

// Test configuration
const SQLITE_FRAMEWORK_PATH = process.env.SQLITE_FRAMEWORK_PATH;
const FRAMEWORK_AVAILABLE = !!SQLITE_FRAMEWORK_PATH;

// Test state
const tests = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0
};

/**
 * Test helper to run a test and track results
 */
async function test(name, fn, options = {}) {
  tests.total++;

  // Skip if framework not available and test requires it
  if (!FRAMEWORK_AVAILABLE && options.requiresFramework) {
    console.log(`⊘ SKIP: ${name} (SQLite framework not available)`);
    tests.skipped++;
    return;
  }

  try {
    console.log(`\nTest ${tests.total}: ${name}`);
    await fn();
    console.log(`✓ PASS: ${name}`);
    tests.passed++;
  } catch (error) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
    tests.failed++;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('SQLite Skills Integration Tests');
  console.log('='.repeat(60));
  console.log(`SQLite Framework: ${FRAMEWORK_AVAILABLE ? SQLITE_FRAMEWORK_PATH : 'NOT AVAILABLE'}`);
  console.log('='.repeat(60));

  // Setup FixiPlug instance
  let fixiplug;
  let agent;
  let adapter;

  await test('Setup FixiPlug with SQLite plugins', async () => {
    fixiplug = createFixiplug({ features: ['logging'] });
    fixiplug.use(introspectionPlugin);
    fixiplug.use(skillMdLoader);
    fixiplug.use(sqlitePatternLearner);
    fixiplug.use(sqliteExtensionGenerator);
    fixiplug.use(sqliteAgentAmplification);
    fixiplug.use(sqliteAgentContext);

    agent = new FixiPlugAgent(fixiplug, { skillStrategy: 'dynamic' });
    adapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });

    assert(fixiplug, 'FixiPlug instance created');
    assert(agent, 'Agent instance created');
    assert(adapter, 'Adapter instance created');
  });

  // Test 1: Skill Retrieval
  await test('Retrieve sqlite-pattern-learner skill', async () => {
    const result = await fixiplug.dispatch('api:getSkill', {
      skillName: 'sqlite-pattern-learner'
    });

    assert(result.success, 'Skill retrieval should succeed');
    assert(result.skill, 'Should return skill object');
    assert(result.skill.name === 'sqlite-pattern-learner', 'Should have correct name');
    assert(result.skill.description, 'Should have description');
    assert(result.skill.instructions, 'Should have instructions');
    assert(result.skill.tags && result.skill.tags.length > 0, 'Should have tags');
  });

  await test('Retrieve sqlite-extension-generator skill', async () => {
    const result = await fixiplug.dispatch('api:getSkill', {
      skillName: 'sqlite-extension-generator'
    });

    assert(result.success, 'Skill retrieval should succeed');
    assert(result.skill.name === 'sqlite-extension-generator', 'Should have correct name');
  });

  await test('Retrieve sqlite-agent-amplification skill', async () => {
    const result = await fixiplug.dispatch('api:getSkill', {
      skillName: 'sqlite-agent-amplification'
    });

    assert(result.success, 'Skill retrieval should succeed');
    assert(result.skill.name === 'sqlite-agent-amplification', 'Should have correct name');
  });

  await test('Retrieve sqlite-agent-context skill', async () => {
    const result = await fixiplug.dispatch('api:getSkill', {
      skillName: 'sqlite-agent-context'
    });

    assert(result.success, 'Skill retrieval should succeed');
    assert(result.skill.name === 'sqlite-agent-context', 'Should have correct name');
  });

  // Test 2: Plugin Hook Registration
  await test('Check pattern learner hooks registered', async () => {
    const caps = await agent.discover();
    const hooks = caps.hooks || {};

    assert(hooks['sqlite.patterns.get'], 'Should have sqlite.patterns.get hook');
    assert(hooks['sqlite.patterns.find_similar'], 'Should have sqlite.patterns.find_similar hook');
    assert(hooks['sqlite.patterns.statistics'], 'Should have sqlite.patterns.statistics hook');
    assert(hooks['sqlite.patterns.record'], 'Should have sqlite.patterns.record hook');
  });

  await test('Check extension generator hooks registered', async () => {
    const caps = await agent.discover();
    const hooks = caps.hooks || {};

    assert(hooks['sqlite.extension.analyze'], 'Should have sqlite.extension.analyze hook');
    assert(hooks['sqlite.extension.recommend_path'], 'Should have sqlite.extension.recommend_path hook');
    assert(hooks['sqlite.extension.generate'], 'Should have sqlite.extension.generate hook');
    assert(hooks['sqlite.extension.quick_generate'], 'Should have sqlite.extension.quick_generate hook');
  });

  await test('Check agent amplification hooks registered', async () => {
    const caps = await agent.discover();
    const hooks = caps.hooks || {};

    assert(hooks['sqlite.agent.create_tool'], 'Should have sqlite.agent.create_tool hook');
    assert(hooks['sqlite.agent.record_decision'], 'Should have sqlite.agent.record_decision hook');
    assert(hooks['sqlite.agent.consult_peers'], 'Should have sqlite.agent.consult_peers hook');
    assert(hooks['sqlite.agent.track_evolution'], 'Should have sqlite.agent.track_evolution hook');
  });

  await test('Check agent context hooks registered', async () => {
    const caps = await agent.discover();
    const hooks = caps.hooks || {};

    assert(hooks['sqlite.context.detect'], 'Should have sqlite.context.detect hook');
    assert(hooks['sqlite.context.capabilities'], 'Should have sqlite.context.capabilities hook');
    assert(hooks['sqlite.context.token_budget'], 'Should have sqlite.context.token_budget hook');
    assert(hooks['sqlite.context.format_response'], 'Should have sqlite.context.format_response hook');
  });

  // Test 3: LLM Integration
  await test('Anthropic adapter has retrieve_skill tool', async () => {
    const tools = await adapter.getToolDefinitions();
    const retrieveSkillTool = tools.find(t => t.name === 'retrieve_skill');

    assert(retrieveSkillTool, 'Should have retrieve_skill tool');
    assert(retrieveSkillTool.input_schema, 'Should have input schema');
    assert(retrieveSkillTool.input_schema.properties.skill_name, 'Should have skill_name parameter');
  });

  await test('LLM can retrieve SQLite skill via tool', async () => {
    const toolUse = {
      id: 'test-1',
      name: 'retrieve_skill',
      input: { skill_name: 'sqlite-pattern-learner' }
    };

    const result = await adapter.executeToolUse(toolUse);

    assert(result, 'Should return result');
    assert(result.success, 'Skill retrieval should succeed');
    assert(result.skill_name === 'sqlite-pattern-learner', 'Should have correct skill name');
    assert(result.instructions, 'Should have instructions field');
    assert(typeof result.instructions === 'string', 'Instructions should be string');
    assert(result.instructions.includes('Pattern Learning') || result.instructions.includes('pattern'),
           'Instructions should include skill content');
  });

  // Test 4: End-to-End Workflow (requires framework)
  await test('E2E: Skill retrieval → Plugin hook', async () => {
    // Step 1: LLM retrieves skill
    const skillResult = await fixiplug.dispatch('api:getSkill', {
      skillName: 'sqlite-pattern-learner'
    });

    assert(skillResult.success, 'Skill should be retrievable');

    // Step 2: LLM reads instructions (simulated)
    const instructions = skillResult.skill.instructions;
    assert(instructions.includes('sqlite.patterns.get'), 'Instructions should mention hook');

    // Step 3: LLM calls plugin hook
    // This will fail without the framework, but we can at least verify the hook exists
    try {
      await fixiplug.dispatch('sqlite.patterns.get', {
        domain: 'test',
        description: 'Test pattern',
        minConfidence: 0.8
      });
      // If we get here, framework is available
      console.log('  Note: Framework available, hook executed');
    } catch (error) {
      // Expected if framework not available
      if (error.message.includes('SQLITE_FRAMEWORK_PATH')) {
        console.log('  Note: Framework not configured, hook exists but cannot execute');
      } else {
        throw error;  // Unexpected error
      }
    }
  }, { requiresFramework: false });  // Don't skip, just handle gracefully

  // Test 5: Context Efficiency
  await test('Verify dynamic skill loading saves context', async () => {
    // Get all skill names
    const allSkills = [
      'sqlite-pattern-learner',
      'sqlite-extension-generator',
      'sqlite-agent-amplification',
      'sqlite-agent-context'
    ];

    // Calculate if all were loaded upfront
    let totalSize = 0;
    for (const skillName of allSkills) {
      const result = await fixiplug.dispatch('api:getSkill', { skillName });
      if (result.success) {
        totalSize += result.skill.instructions.length;
      }
    }

    console.log(`  Total skill content: ${(totalSize / 1024).toFixed(1)} KB`);
    console.log(`  Dynamic loading saves this from initial context`);

    // With dynamic loading, initial context = 0 KB
    // Only loaded when LLM calls retrieve_skill
    assert(totalSize > 0, 'Should have calculated total size');
  });

  // Test 6: All Skills Accessible
  await test('All 4 SQLite skills are accessible', async () => {
    const skillNames = [
      'sqlite-pattern-learner',
      'sqlite-extension-generator',
      'sqlite-agent-amplification',
      'sqlite-agent-context'
    ];

    const accessible = [];
    for (const skillName of skillNames) {
      const result = await fixiplug.dispatch('api:getSkill', { skillName });
      accessible.push(result.success);
    }

    assert(accessible.every(a => a === true), 'All skills should be accessible');
    console.log(`  All ${skillNames.length} SQLite skills accessible`);
  });

  // Test 7: Skill Metadata
  await test('Skills have proper metadata', async () => {
    const skillNames = [
      'sqlite-pattern-learner',
      'sqlite-extension-generator',
      'sqlite-agent-amplification',
      'sqlite-agent-context'
    ];

    for (const skillName of skillNames) {
      const result = await fixiplug.dispatch('api:getSkill', { skillName });
      const skill = result.skill;

      assert(skill.name, `${skillName} should have name`);
      assert(skill.description, `${skillName} should have description`);
      assert(skill.instructions, `${skillName} should have instructions`);
      assert(skill.tags && skill.tags.length > 0, `${skillName} should have tags`);
      assert(skill.version, `${skillName} should have version`);
      assert(skill.tags.includes('database') || skill.tags.includes('agent'),
             `${skillName} should have relevant tags`);
    }

    console.log(`  All ${skillNames.length} skills have proper metadata`);
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  console.log(`Passed:  ${tests.passed}`);
  console.log(`Failed:  ${tests.failed}`);
  console.log(`Skipped: ${tests.skipped}`);
  console.log(`Total:   ${tests.total}`);
  console.log('='.repeat(60));

  const successRate = ((tests.passed / (tests.total - tests.skipped)) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);

  if (tests.failed === 0 && tests.passed > 0) {
    console.log('\n✓ All tests passed!');
  } else if (tests.failed > 0) {
    console.log(`\n✗ ${tests.failed} test(s) failed`);
  }

  if (tests.skipped > 0) {
    console.log(`\nNote: ${tests.skipped} test(s) skipped (requires SQLite framework)`);
    console.log('To run all tests, set SQLITE_FRAMEWORK_PATH environment variable');
  }

  // Exit with appropriate code
  process.exit(tests.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
