/**
 * SKILL.md Loader Test Suite
 * Tests loading, parsing, and registration of SKILL.md files
 */

import { createFixiplug } from '../builder/fixiplug-factory.js';
import introspectionPlugin from '../plugins/introspection.js';
import skillMdLoader from '../plugins/skill-md-loader.js';

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
  console.log('SKILL.md Loader Tests');
  console.log('='.repeat(60));
  console.log();

  // Setup
  const fixiplug = createFixiplug({ features: ['logging'] });
  fixiplug.use(introspectionPlugin);
  fixiplug.use(skillMdLoader);

  // Wait for async skill loading
  await new Promise(resolve => setTimeout(resolve, 500));

  // ========================================
  // Test Group 1: SKILL.md File Loading
  // ========================================
  console.log('Test Group 1: SKILL.md File Loading');
  console.log('-'.repeat(60));

  // Test that SKILL.md files were loaded
  const manifest = await fixiplug.dispatch('api:getSkillsManifest', {});

  assert(manifest.skills && manifest.skills.length > 0,
    'Loader: Skills were loaded from SKILL.md files',
    `Found ${manifest.skills?.length || 0} skills`);

  // Check for specific exported skills
  const skillNames = manifest.skills.map(s => s.skill.name);

  assert(skillNames.includes('reactive-ui-patterns'),
    'Loader: reactive-ui-patterns skill loaded');

  assert(skillNames.includes('django-workflows'),
    'Loader: django-workflows skill loaded');

  assert(skillNames.includes('error-recovery'),
    'Loader: error-recovery skill loaded');

  assert(skillNames.includes('form-workflows'),
    'Loader: form-workflows skill loaded');

  // ========================================
  // Test Group 2: Skill Metadata
  // ========================================
  console.log('\nTest Group 2: Skill Metadata');
  console.log('-'.repeat(60));

  // Get a specific skill
  const skillResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'reactive-ui-patterns'
  });

  assert(skillResult.success === true,
    'Metadata: Skill retrieval succeeds');

  assert(skillResult.skill.name === 'reactive-ui-patterns',
    'Metadata: Skill has correct name');

  assert(skillResult.skill.description && skillResult.skill.description.length > 0,
    'Metadata: Skill has description');

  assert(skillResult.skill.instructions && skillResult.skill.instructions.length > 1000,
    'Metadata: Skill has instructions',
    `Got ${skillResult.skill.instructions?.length || 0} chars`);

  assert(Array.isArray(skillResult.skill.tags),
    'Metadata: Skill has tags array');

  assert(skillResult.skill.tags.length > 0,
    'Metadata: Skill has tags',
    `Found ${skillResult.skill.tags.length} tags`);

  assert(skillResult.skill.version && skillResult.skill.version.length > 0,
    'Metadata: Skill has version');

  assert(skillResult.skill.metadata && skillResult.skill.metadata.source === 'skill-md',
    'Metadata: Skill marked as SKILL.md source');

  assert(skillResult.skill.metadata.filePath && skillResult.skill.metadata.filePath.includes('SKILL.md'),
    'Metadata: Skill has file path');

  // ========================================
  // Test Group 3: Skill Content Validation
  // ========================================
  console.log('\nTest Group 3: Skill Content Validation');
  console.log('-'.repeat(60));

  // Check Django workflows skill
  const djangoResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'django-workflows'
  });

  assert(djangoResult.success === true,
    'Content: Django skill retrieval succeeds');

  assert(djangoResult.skill.instructions.includes('Django'),
    'Content: Django skill has relevant content');

  assert(djangoResult.skill.tags.includes('django') || djangoResult.skill.tags.includes('python'),
    'Content: Django skill has appropriate tags');

  // Check error recovery skill
  const errorResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'error-recovery'
  });

  assert(errorResult.success === true,
    'Content: Error recovery skill retrieval succeeds');

  assert(errorResult.skill.instructions.includes('error') || errorResult.skill.instructions.includes('Error'),
    'Content: Error recovery skill has relevant content');

  // Check form workflows skill
  const formResult = await fixiplug.dispatch('api:getSkill', {
    skillName: 'form-workflows'
  });

  assert(formResult.success === true,
    'Content: Form workflows skill retrieval succeeds');

  assert(formResult.skill.instructions.includes('form') || formResult.skill.instructions.includes('Form'),
    'Content: Form workflows skill has relevant content');

  // ========================================
  // Test Group 4: API Hooks
  // ========================================
  console.log('\nTest Group 4: API Hooks');
  console.log('-'.repeat(60));

  // Test api:getSkillMdStats
  const stats = await fixiplug.dispatch('api:getSkillMdStats', {});

  assert(stats.loaded > 0,
    'API: getSkillMdStats returns loaded count',
    `Loaded ${stats.loaded} skills`);

  assert(Array.isArray(stats.skills),
    'API: getSkillMdStats returns skills array');

  assert(Array.isArray(stats.locations),
    'API: getSkillMdStats returns locations array');

  assert(stats.locations.length === 2,
    'API: getSkillMdStats checks both locations (project + personal)',
    `Checked ${stats.locations.length} locations`);

  // Test api:reloadSkillMd
  const reloadResult = await fixiplug.dispatch('api:reloadSkillMd', {});

  assert(reloadResult.success === true,
    'API: reloadSkillMd succeeds');

  assert(reloadResult.reloaded >= 0,
    'API: reloadSkillMd returns reload count',
    `Reloaded ${reloadResult.reloaded} skills`);

  assert(Array.isArray(reloadResult.skills),
    'API: reloadSkillMd returns skill names');

  // ========================================
  // Test Group 5: Skill Registry Integration
  // ========================================
  console.log('\nTest Group 5: Skill Registry Integration');
  console.log('-'.repeat(60));

  // Test that SKILL.md skills appear in manifest alongside JS skills
  const fullManifest = await fixiplug.dispatch('api:getSkillsManifest', {});

  assert(fullManifest.skills.length >= 4,
    'Registry: Manifest contains SKILL.md skills',
    `Found ${fullManifest.skills.length} total skills`);

  // Check that skills can be retrieved via api:getSkill (sequentially to avoid recursion warnings)
  const allSkillsAccessible = [];
  for (const name of skillNames.slice(0, 4)) {
    const result = await fixiplug.dispatch('api:getSkill', { skillName: name });
    allSkillsAccessible.push(result.success);
  }

  assert(allSkillsAccessible.every(accessible => accessible === true),
    'Registry: All SKILL.md skills accessible via api:getSkill');

  // ========================================
  // Test Group 6: Skill Retrieval via Adapters
  // ========================================
  console.log('\nTest Group 6: Skill Retrieval via Adapters');
  console.log('-'.repeat(60));

  // Create adapters and test skill retrieval
  const { FixiPlugAgent } = await import('../sdk/agent-client.js');
  const { AnthropicAdapter } = await import('../sdk/adapters/anthropic-adapter.js');
  const { OpenAIAdapter } = await import('../sdk/adapters/openai-adapter.js');

  const agent = new FixiPlugAgent(fixiplug);

  // Test Anthropic adapter
  const anthropicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });
  const anthropicTools = await anthropicAdapter.getToolDefinitions();
  const anthropicSkillTool = anthropicTools.find(t => t.name === 'retrieve_skill');

  assert(anthropicSkillTool !== undefined,
    'Adapters: Anthropic adapter has retrieve_skill tool');

  const anthropicSkillEnum = anthropicSkillTool.input_schema.properties.skill_name.enum;
  assert(anthropicSkillEnum.includes('reactive-ui-patterns'),
    'Adapters: Anthropic retrieve_skill includes SKILL.md skills');

  // Test retrieval
  const anthropicRetrieve = await anthropicAdapter.executeToolUse({
    id: 'test-1',
    name: 'retrieve_skill',
    input: { skill_name: 'django-workflows' }
  });

  assert(anthropicRetrieve.success === true,
    'Adapters: Anthropic can retrieve SKILL.md skill');

  assert(anthropicRetrieve.skill_name === 'django-workflows',
    'Adapters: Anthropic retrieves correct skill');

  // Test OpenAI adapter
  const openaiAdapter = new OpenAIAdapter(agent, { skillStrategy: 'dynamic' });
  const openaiTools = await openaiAdapter.getToolDefinitions();
  const openaiSkillTool = openaiTools.find(t => t.function.name === 'retrieve_skill');

  assert(openaiSkillTool !== undefined,
    'Adapters: OpenAI adapter has retrieve_skill function');

  const openaiSkillEnum = openaiSkillTool.function.parameters.properties.skill_name.enum;
  assert(openaiSkillEnum.includes('reactive-ui-patterns'),
    'Adapters: OpenAI retrieve_skill includes SKILL.md skills');

  // Test retrieval
  const openaiRetrieve = await openaiAdapter.executeFunctionCall({
    name: 'retrieve_skill',
    arguments: JSON.stringify({ skill_name: 'error-recovery' })
  });

  assert(openaiRetrieve.success === true,
    'Adapters: OpenAI can retrieve SKILL.md skill');

  assert(openaiRetrieve.skill_name === 'error-recovery',
    'Adapters: OpenAI retrieves correct skill');

  // ========================================
  // Test Group 7: SKILL.md Format Validation
  // ========================================
  console.log('\nTest Group 7: SKILL.md Format Validation');
  console.log('-'.repeat(60));

  // Verify all loaded skills have required fields
  for (const skillMeta of fullManifest.skills.slice(0, 4)) {
    const skill = skillMeta.skill;

    assert(skill.name && /^[a-z0-9-]+$/.test(skill.name),
      `Format: ${skill.name} has valid name format`);

    assert(skill.name.length <= 64,
      `Format: ${skill.name} name is under 64 chars`,
      `Length: ${skill.name.length}`);

    assert(skill.description && skill.description.length <= 1024,
      `Format: ${skill.name} description is under 1024 chars`,
      `Length: ${skill.description.length}`);

    assert(skill.instructions && skill.instructions.length > 0,
      `Format: ${skill.name} has instructions`);
  }

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
