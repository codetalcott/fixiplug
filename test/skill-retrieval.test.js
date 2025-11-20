/**
 * Skill Retrieval Test Suite
 * Tests the skill-as-tool pattern for dynamic skill loading
 */

import { createFixiplug } from '../builder/fixiplug-factory.js';
import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';
import { OpenAIAdapter } from '../sdk/adapters/openai-adapter.js';
import introspectionPlugin from '../plugins/introspection.js';
import reactiveUiPatternsSkill from '../plugins/reactive-ui-patterns-skill.js';
import djangoWorkflowsSkill from '../plugins/django-workflows-skill.js';

const results = { total: 0, passed: 0, failed: 0, tests: [] };

function assert(condition, testName, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    results.tests.push({ name: testName, status: 'PASS', details });
    console.log(`✓ ${testName}`);
  } else {
    results.failed++;
    results.tests.push({ name: testName, status: 'FAIL', details });
    console.error(`✗ ${testName}`);
    if (details) console.error(`  Details: ${details}`);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Skill Retrieval Tests');
  console.log('='.repeat(60));
  console.log();

  // Setup
  const fixiplug = createFixiplug({ features: ['logging'] });
  fixiplug.use(introspectionPlugin);
  fixiplug.use(reactiveUiPatternsSkill);
  fixiplug.use(djangoWorkflowsSkill);

  const agent = new FixiPlugAgent(fixiplug);

  // ========================================
  // Test Group 1: api:getSkill Hook
  // ========================================
  console.log('Test Group 1: api:getSkill Hook');
  console.log('-'.repeat(60));

  // Test successful skill retrieval
  const skillResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'reactive-ui-patterns'
  });

  assert(skillResult.success === true, 'Hook returns success for valid skill');
  assert(skillResult.skillName === 'reactive-ui-patterns', 'Hook returns correct skill name');
  assert(skillResult.skill !== undefined, 'Hook returns skill object');
  assert(skillResult.skill.name === 'reactive-ui-patterns', 'Skill object has correct name');
  assert(skillResult.skill.instructions && skillResult.skill.instructions.length > 1000,
    'Skill has instructions', `Got ${skillResult.skill.instructions?.length || 0} chars`);
  assert(skillResult.pluginName === 'reactiveUiPatternsSkill', 'Hook returns plugin name');

  // Test skill not found
  const notFoundResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'nonexistent-skill'
  });

  assert(notFoundResult.success === false, 'Hook returns error for invalid skill');
  assert(notFoundResult.error && notFoundResult.error.includes('not found'),
    'Hook returns error message');
  assert(Array.isArray(notFoundResult.availableSkills),
    'Hook lists available skills on error');
  assert(notFoundResult.availableSkills.length > 0,
    'Available skills list is not empty', `Found ${notFoundResult.availableSkills.length} skills`);

  // Test missing parameter
  const missingParamResult = await fixiplug.dispatch('api:getSkill', {});

  assert(missingParamResult.success === false, 'Hook returns error for missing parameter');
  assert(missingParamResult.error && missingParamResult.error.includes('required'),
    'Hook returns parameter required error');

  // ========================================
  // Test Group 2: Anthropic Adapter Tool
  // ========================================
  console.log('\nTest Group 2: Anthropic Adapter retrieve_skill Tool');
  console.log('-'.repeat(60));

  const anthropicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });
  const anthropicTools = await anthropicAdapter.getToolDefinitions();
  const anthropicSkillTool = anthropicTools.find(t => t.name === 'retrieve_skill');

  assert(anthropicSkillTool !== undefined, 'Anthropic: retrieve_skill tool exists');
  assert(anthropicSkillTool.description && anthropicSkillTool.description.length > 0,
    'Anthropic: Tool has description');
  assert(anthropicSkillTool.input_schema !== undefined,
    'Anthropic: Tool has input schema');
  assert(anthropicSkillTool.input_schema.properties.skill_name !== undefined,
    'Anthropic: Tool has skill_name parameter');

  const skillEnum = anthropicSkillTool.input_schema.properties.skill_name.enum || [];
  assert(skillEnum.length > 0, 'Anthropic: Tool lists available skills',
    `Found ${skillEnum.length} skills`);
  assert(skillEnum.includes('reactive-ui-patterns'),
    'Anthropic: Includes reactive-ui-patterns skill');
  assert(skillEnum.includes('django-workflows'),
    'Anthropic: Includes django-workflows skill');

  // Test execution
  const anthropicToolUse = {
    id: 'test-1',
    name: 'retrieve_skill',
    input: { skill_name: 'reactive-ui-patterns' }
  };

  const anthropicResult = await anthropicAdapter.executeToolUse(anthropicToolUse);

  assert(anthropicResult.success === true, 'Anthropic: Retrieval succeeds');
  assert(anthropicResult.skill_name === 'reactive-ui-patterns',
    'Anthropic: Returns correct skill name');
  assert(anthropicResult.instructions && anthropicResult.instructions.length > 1000,
    'Anthropic: Returns instructions', `Got ${anthropicResult.instructions?.length || 0} chars`);
  assert(anthropicResult.description && anthropicResult.description.length > 0,
    'Anthropic: Returns description');
  assert(Array.isArray(anthropicResult.tags), 'Anthropic: Returns tags array');
  assert(anthropicResult.metadata && anthropicResult.metadata.plugin,
    'Anthropic: Returns metadata with plugin name');

  // Test error handling
  const anthropicBadToolUse = {
    id: 'test-2',
    name: 'retrieve_skill',
    input: { skill_name: 'nonexistent-skill' }
  };

  const anthropicErrorResult = await anthropicAdapter.executeToolUse(anthropicBadToolUse);

  assert(anthropicErrorResult.success === false, 'Anthropic: Returns error for invalid skill');
  assert(anthropicErrorResult.error && anthropicErrorResult.error.length > 0,
    'Anthropic: Includes error message');
  assert(Array.isArray(anthropicErrorResult.availableSkills),
    'Anthropic: Lists available skills on error');

  // ========================================
  // Test Group 3: OpenAI Adapter Function
  // ========================================
  console.log('\nTest Group 3: OpenAI Adapter retrieve_skill Function');
  console.log('-'.repeat(60));

  const openaiAdapter = new OpenAIAdapter(agent, { skillStrategy: 'dynamic' });
  const openaiTools = await openaiAdapter.getToolDefinitions();
  const openaiSkillTool = openaiTools.find(t => t.function.name === 'retrieve_skill');

  assert(openaiSkillTool !== undefined, 'OpenAI: retrieve_skill tool exists');
  assert(openaiSkillTool.type === 'function', 'OpenAI: Tool has correct type');
  assert(openaiSkillTool.function.description && openaiSkillTool.function.description.length > 0,
    'OpenAI: Function has description');
  assert(openaiSkillTool.function.parameters !== undefined,
    'OpenAI: Function has parameters');
  assert(openaiSkillTool.function.parameters.properties.skill_name !== undefined,
    'OpenAI: Function has skill_name parameter');

  const openaiSkillEnum = openaiSkillTool.function.parameters.properties.skill_name.enum || [];
  assert(openaiSkillEnum.length > 0, 'OpenAI: Function lists available skills',
    `Found ${openaiSkillEnum.length} skills`);
  assert(openaiSkillEnum.includes('reactive-ui-patterns'),
    'OpenAI: Includes reactive-ui-patterns skill');
  assert(openaiSkillEnum.includes('django-workflows'),
    'OpenAI: Includes django-workflows skill');

  // Test execution
  const openaiResult = await openaiAdapter.executeFunctionCall({
    name: 'retrieve_skill',
    arguments: JSON.stringify({ skill_name: 'django-workflows' })
  });

  assert(openaiResult.success === true, 'OpenAI: Retrieval succeeds');
  assert(openaiResult.skill_name === 'django-workflows',
    'OpenAI: Returns correct skill name');
  assert(openaiResult.instructions && openaiResult.instructions.length > 1000,
    'OpenAI: Returns instructions', `Got ${openaiResult.instructions?.length || 0} chars`);
  assert(openaiResult.description && openaiResult.description.length > 0,
    'OpenAI: Returns description');
  assert(Array.isArray(openaiResult.tags), 'OpenAI: Returns tags array');
  assert(openaiResult.metadata && openaiResult.metadata.plugin,
    'OpenAI: Returns metadata with plugin name');

  // Test error handling
  const openaiErrorResult = await openaiAdapter.executeFunctionCall({
    name: 'retrieve_skill',
    arguments: JSON.stringify({ skill_name: 'nonexistent-skill' })
  });

  assert(openaiErrorResult.success === false, 'OpenAI: Returns error for invalid skill');
  assert(openaiErrorResult.error && openaiErrorResult.error.length > 0,
    'OpenAI: Includes error message');
  assert(Array.isArray(openaiErrorResult.availableSkills),
    'OpenAI: Lists available skills on error');

  // ========================================
  // Test Group 4: Caching Behavior
  // ========================================
  console.log('\nTest Group 4: Caching Behavior');
  console.log('-'.repeat(60));

  // Create fresh adapters
  const anthropicCacheAdapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });
  const openaiCacheAdapter = new OpenAIAdapter(agent, { skillStrategy: 'dynamic' });

  // First retrieval (cache miss)
  const firstAnthropicCall = await anthropicCacheAdapter.executeToolUse({
    id: 'cache-test-1',
    name: 'retrieve_skill',
    input: { skill_name: 'reactive-ui-patterns' }
  });

  assert(firstAnthropicCall.success === true, 'Cache: First Anthropic retrieval succeeds');

  // Second retrieval (cache hit)
  const secondAnthropicCall = await anthropicCacheAdapter.executeToolUse({
    id: 'cache-test-2',
    name: 'retrieve_skill',
    input: { skill_name: 'reactive-ui-patterns' }
  });

  assert(secondAnthropicCall.success === true, 'Cache: Second Anthropic retrieval succeeds');
  assert(JSON.stringify(firstAnthropicCall) === JSON.stringify(secondAnthropicCall),
    'Cache: Anthropic cached result matches original');

  // Test OpenAI caching
  const firstOpenAICall = await openaiCacheAdapter.executeFunctionCall({
    name: 'retrieve_skill',
    arguments: JSON.stringify({ skill_name: 'django-workflows' })
  });

  assert(firstOpenAICall.success === true, 'Cache: First OpenAI retrieval succeeds');

  const secondOpenAICall = await openaiCacheAdapter.executeFunctionCall({
    name: 'retrieve_skill',
    arguments: JSON.stringify({ skill_name: 'django-workflows' })
  });

  assert(secondOpenAICall.success === true, 'Cache: Second OpenAI retrieval succeeds');
  assert(JSON.stringify(firstOpenAICall) === JSON.stringify(secondOpenAICall),
    'Cache: OpenAI cached result matches original');

  // ========================================
  // Test Group 5: Strategy Options
  // ========================================
  console.log('\nTest Group 5: Strategy Options');
  console.log('-'.repeat(60));

  // Dynamic strategy (default)
  const dynamicAnthropicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });
  const dynamicTools = await dynamicAnthropicAdapter.getToolDefinitions();
  assert(dynamicTools.some(t => t.name === 'retrieve_skill'),
    'Strategy: Dynamic Anthropic includes retrieve_skill tool');

  const dynamicOpenAIAdapter = new OpenAIAdapter(agent, { skillStrategy: 'dynamic' });
  const dynamicOpenAITools = await dynamicOpenAIAdapter.getToolDefinitions();
  assert(dynamicOpenAITools.some(t => t.function.name === 'retrieve_skill'),
    'Strategy: Dynamic OpenAI includes retrieve_skill tool');

  // Static strategy (no retrieve_skill tool)
  const staticAnthropicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'static' });
  const staticTools = await staticAnthropicAdapter.getToolDefinitions();
  assert(!staticTools.some(t => t.name === 'retrieve_skill'),
    'Strategy: Static Anthropic excludes retrieve_skill tool');

  const staticOpenAIAdapter = new OpenAIAdapter(agent, { skillStrategy: 'static' });
  const staticOpenAITools = await staticOpenAIAdapter.getToolDefinitions();
  assert(!staticOpenAITools.some(t => t.function.name === 'retrieve_skill'),
    'Strategy: Static OpenAI excludes retrieve_skill tool');

  // None strategy (no retrieve_skill tool)
  const noneAnthropicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'none' });
  const noneTools = await noneAnthropicAdapter.getToolDefinitions();
  assert(!noneTools.some(t => t.name === 'retrieve_skill'),
    'Strategy: None Anthropic excludes retrieve_skill tool');

  const noneOpenAIAdapter = new OpenAIAdapter(agent, { skillStrategy: 'none' });
  const noneOpenAITools = await noneOpenAIAdapter.getToolDefinitions();
  assert(!noneOpenAITools.some(t => t.function.name === 'retrieve_skill'),
    'Strategy: None OpenAI excludes retrieve_skill tool');

  // ========================================
  // Test Group 6: getSkillsContext Method
  // ========================================
  console.log('\nTest Group 6: getSkillsContext Method');
  console.log('-'.repeat(60));

  // Test Anthropic getSkillsContext
  const anthropicFullContext = await anthropicAdapter.getSkillsContext({ format: 'full' });
  assert(anthropicFullContext.length > 5000, 'Anthropic: Full context is substantial',
    `Got ${anthropicFullContext.length} chars`);
  assert(anthropicFullContext.includes('reactive-ui-patterns'),
    'Anthropic: Context includes skill name');
  assert(anthropicFullContext.includes('# FixiPlug Skills'),
    'Anthropic: Context has header');

  const anthropicMetadataContext = await anthropicAdapter.getSkillsContext({ format: 'metadata' });
  assert(anthropicMetadataContext.length < anthropicFullContext.length,
    'Anthropic: Metadata context is shorter than full',
    `Metadata: ${anthropicMetadataContext.length} < Full: ${anthropicFullContext.length}`);

  // Test OpenAI getSkillsContext
  const openaiFullContext = await openaiAdapter.getSkillsContext({ format: 'full' });
  assert(openaiFullContext.length > 5000, 'OpenAI: Full context is substantial',
    `Got ${openaiFullContext.length} chars`);
  assert(openaiFullContext.includes('reactive-ui-patterns'),
    'OpenAI: Context includes skill name');
  assert(openaiFullContext.includes('# FixiPlug Skills'),
    'OpenAI: Context has header');

  const openaiMetadataContext = await openaiAdapter.getSkillsContext({ format: 'metadata' });
  assert(openaiMetadataContext.length < openaiFullContext.length,
    'OpenAI: Metadata context is shorter than full',
    `Metadata: ${openaiMetadataContext.length} < Full: ${openaiFullContext.length}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (results.failed === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
