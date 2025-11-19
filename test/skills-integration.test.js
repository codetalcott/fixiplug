/**
 * Skills Integration Test
 *
 * Tests the complete skill system implementation:
 * 1. Skill registration (skill-only, hybrid, implementation-only plugins)
 * 2. Skill discovery via introspection API
 * 3. Skills context generation for Anthropic adapter
 *
 * @module test/skills-integration
 */

import { createFixiplug, FEATURES } from '../builder/fixiplug-factory.js';
import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';

// Import plugins with hooks
import introspectionPlugin from '../plugins/introspection.js';
import stateTrackerPlugin from '../plugins/state-tracker.js';
import agentCommands from '../plugins/agent-commands.js';
import tablePlugin from '../plugins/table.js';
import fixiAgent from '../plugins/fixi-agent.js';
import formSchema from '../plugins/form-schema.js';

// Import skill-only plugins
import reactiveUiPatternsSkill from '../plugins/reactive-ui-patterns-skill.js';
import djangoWorkflows from '../plugins/django-workflows-skill.js';
import errorRecovery from '../plugins/error-recovery-skill.js';
import formWorkflows from '../plugins/form-workflows-skill.js';

/**
 * Test Results Tracking
 */
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test assertion helper
 */
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

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Skills Integration Tests');
  console.log('='.repeat(60));
  console.log();

  try {
    // Setup: Create fixiplug instance with plugins
    console.log('Setting up test environment...');
    const fixiplug = createFixiplug({
      features: [FEATURES.LOGGING]
    });

    // Register plugins with hooks
    fixiplug.use(introspectionPlugin);
    fixiplug.use(stateTrackerPlugin);
    fixiplug.use(agentCommands);
    fixiplug.use(tablePlugin);
    fixiplug.use(fixiAgent);
    fixiplug.use(formSchema);

    // Register skill-only plugins
    fixiplug.use(reactiveUiPatternsSkill);
    fixiplug.use(djangoWorkflows);
    fixiplug.use(errorRecovery);
    fixiplug.use(formWorkflows);

    console.log(`Registered ${fixiplug.getPlugins().length} plugins successfully\n`);

    // Create agent and adapter
    const agent = new FixiPlugAgent(fixiplug);
    const adapter = new AnthropicAdapter(agent, { includeSkills: true });

    console.log('Agent and adapter created\n');

    // ========================================
    // Test 1: Skill Registry in Core
    // ========================================
    console.log('Test Group 1: Skill Registry in Core');
    console.log('-'.repeat(60));

    const skillRegistry = fixiplug.skillRegistry;

    assert(
      skillRegistry instanceof Map,
      'Skill registry exists and is a Map',
      `Type: ${skillRegistry.constructor.name}`
    );

    assert(
      skillRegistry.size >= 7,
      'Skill registry contains at least 7 skills',
      `Found ${skillRegistry.size} skills`
    );

    console.log();

    // ========================================
    // Test 2: Skill Discovery via Introspection
    // ========================================
    console.log('Test Group 2: Skill Discovery via Introspection');
    console.log('-'.repeat(60));

    // Test api:getSkillsManifest hook
    const manifest = await fixiplug.dispatch('api:getSkillsManifest', {});

    assert(
      manifest && manifest.skills,
      'api:getSkillsManifest returns manifest with skills array',
      `Manifest structure: ${JSON.stringify(Object.keys(manifest))}`
    );

    assert(
      manifest.skills.length >= 2,
      'Skills manifest contains at least 2 skills',
      `Found ${manifest.skills.length} skills`
    );

    assert(
      manifest.skillCount === manifest.skills.length,
      'skillCount matches skills array length',
      `skillCount: ${manifest.skillCount}, array length: ${manifest.skills.length}`
    );

    // Verify skill structure
    const firstSkill = manifest.skills[0];
    assert(
      firstSkill && firstSkill.pluginName && firstSkill.skill,
      'Skill has correct structure (pluginName + skill)',
      `Structure: ${JSON.stringify(Object.keys(firstSkill))}`
    );

    assert(
      firstSkill.skill.name && firstSkill.skill.description,
      'Skill metadata has name and description',
      `name: ${firstSkill.skill.name}, has description: ${!!firstSkill.skill.description}`
    );

    console.log();

    // ========================================
    // Test 3: Individual Skill Retrieval
    // ========================================
    console.log('Test Group 3: Individual Skill Retrieval');
    console.log('-'.repeat(60));

    // Test getting skill for state-tracker (hybrid plugin)
    const stateTrackerSkill = await fixiplug.dispatch('api:getPluginSkills', {
      pluginName: 'stateTrackerPlugin'
    });

    assert(
      stateTrackerSkill && stateTrackerSkill.skill,
      'Can retrieve skill for state-tracker plugin',
      `Has skill: ${!!stateTrackerSkill?.skill}`
    );

    assert(
      stateTrackerSkill.skill?.name === 'state-machine-coordination',
      'State-tracker skill has correct name',
      `Name: ${stateTrackerSkill.skill?.name}`
    );

    // Test getting skill for reactive-ui-patterns (skill-only plugin)
    const reactiveSkill = await fixiplug.dispatch('api:getPluginSkills', {
      pluginName: 'reactiveUiPatternsSkill'
    });

    assert(
      reactiveSkill && reactiveSkill.skill,
      'Can retrieve skill for reactive-ui-patterns plugin',
      `Has skill: ${!!reactiveSkill?.skill}`
    );

    assert(
      reactiveSkill.skill?.name === 'reactive-ui-patterns',
      'Reactive-ui-patterns skill has correct name',
      `Name: ${reactiveSkill.skill?.name}`
    );

    // Test getting skill for introspection (should have no skill)
    const introspectionSkill = await fixiplug.dispatch('api:getPluginSkills', {
      pluginName: 'introspectionPlugin'
    });

    assert(
      introspectionSkill && introspectionSkill.skill === null,
      'Introspection plugin correctly returns null (no skill)',
      `Skill value: ${introspectionSkill?.skill}`
    );

    console.log();

    // ========================================
    // Test 4: Anthropic Adapter Skills Context
    // ========================================
    console.log('Test Group 4: Anthropic Adapter Skills Context');
    console.log('-'.repeat(60));

    // Test full format
    const fullContext = await adapter.getSkillsContext({ format: 'full' });

    assert(
      fullContext && fullContext.length > 0,
      'getSkillsContext returns non-empty string (full format)',
      `Length: ${fullContext?.length} chars`
    );

    assert(
      fullContext.includes('# FixiPlug Skills'),
      'Full context includes header',
      `Has header: ${fullContext.includes('# FixiPlug Skills')}`
    );

    assert(
      fullContext.includes('state-machine-coordination'),
      'Full context includes state-machine-coordination skill',
      `Has skill: ${fullContext.includes('state-machine-coordination')}`
    );

    assert(
      fullContext.includes('reactive-ui-patterns'),
      'Full context includes reactive-ui-patterns skill',
      `Has skill: ${fullContext.includes('reactive-ui-patterns')}`
    );

    // Test that full format includes instructions
    assert(
      fullContext.includes('## Overview') || fullContext.includes('## Core Concepts'),
      'Full context includes detailed instructions',
      `Has instructions section: ${fullContext.includes('## Overview') || fullContext.includes('## Core Concepts')}`
    );

    // Test metadata format
    const metadataContext = await adapter.getSkillsContext({ format: 'metadata' });

    assert(
      metadataContext && metadataContext.length > 0,
      'getSkillsContext returns non-empty string (metadata format)',
      `Length: ${metadataContext?.length} chars`
    );

    assert(
      metadataContext.length < fullContext.length,
      'Metadata format is shorter than full format',
      `Metadata: ${metadataContext.length} chars, Full: ${fullContext.length} chars`
    );

    // Test summary format
    const summaryContext = await adapter.getSkillsContext({ format: 'summary' });

    assert(
      summaryContext && summaryContext.length > 0,
      'getSkillsContext returns non-empty string (summary format)',
      `Length: ${summaryContext?.length} chars`
    );

    assert(
      summaryContext.length > metadataContext.length && summaryContext.length < fullContext.length,
      'Summary format is between metadata and full in size',
      `Metadata: ${metadataContext.length}, Summary: ${summaryContext.length}, Full: ${fullContext.length}`
    );

    // Test filtering
    const filteredContext = await adapter.getSkillsContext({
      format: 'metadata',
      includeOnly: ['reactive-ui-patterns']
    });

    assert(
      filteredContext.includes('reactive-ui-patterns') && !filteredContext.includes('state-machine-coordination'),
      'Filtering with includeOnly works correctly',
      `Has reactive: ${filteredContext.includes('reactive-ui-patterns')}, Has state: ${filteredContext.includes('state-machine-coordination')}`
    );

    console.log();

    // ========================================
    // Test 5: Skill Metadata Completeness
    // ========================================
    console.log('Test Group 5: Skill Metadata Completeness');
    console.log('-'.repeat(60));

    // Check state-tracker skill completeness
    assert(
      stateTrackerSkill.skill.instructions && stateTrackerSkill.skill.instructions.length > 100,
      'State-tracker skill has substantial instructions',
      `Instructions length: ${stateTrackerSkill.skill.instructions?.length} chars`
    );

    assert(
      Array.isArray(stateTrackerSkill.skill.tags) && stateTrackerSkill.skill.tags.length > 0,
      'State-tracker skill has tags',
      `Tags: ${stateTrackerSkill.skill.tags?.join(', ')}`
    );

    assert(
      Array.isArray(stateTrackerSkill.skill.references),
      'State-tracker skill has references array',
      `References: ${stateTrackerSkill.skill.references?.join(', ')}`
    );

    assert(
      stateTrackerSkill.skill.version,
      'State-tracker skill has version',
      `Version: ${stateTrackerSkill.skill.version}`
    );

    assert(
      stateTrackerSkill.skill.level,
      'State-tracker skill has level',
      `Level: ${stateTrackerSkill.skill.level}`
    );

    // Check reactive-ui-patterns skill completeness
    assert(
      reactiveSkill.skill.instructions && reactiveSkill.skill.instructions.length > 100,
      'Reactive-ui-patterns skill has substantial instructions',
      `Instructions length: ${reactiveSkill.skill.instructions?.length} chars`
    );

    assert(
      Array.isArray(reactiveSkill.skill.tags) && reactiveSkill.skill.tags.length > 0,
      'Reactive-ui-patterns skill has tags',
      `Tags: ${reactiveSkill.skill.tags?.join(', ')}`
    );

    console.log();

    // ========================================
    // Test 6: Builder Skill Helper Methods
    // ========================================
    console.log('Test Group 6: Builder Skill Helper Methods');
    console.log('-'.repeat(60));

    // Test getSkills()
    const allSkills = fixiplug.getSkills();
    assert(
      Array.isArray(allSkills) && allSkills.length >= 7,
      'fixiplug.getSkills() returns array of skills',
      `Found ${allSkills.length} skills`
    );

    // Test getSkill()
    const djangoSkill = fixiplug.getSkill('django-workflows');
    assert(
      djangoSkill && djangoSkill.name === 'django-workflows',
      'fixiplug.getSkill() retrieves correct skill',
      `Skill name: ${djangoSkill?.name}`
    );

    // Test hasSkill()
    assert(
      fixiplug.hasSkill('error-recovery'),
      'fixiplug.hasSkill() returns true for existing skill',
      `error-recovery exists: ${fixiplug.hasSkill('error-recovery')}`
    );

    assert(
      !fixiplug.hasSkill('nonexistent-skill'),
      'fixiplug.hasSkill() returns false for non-existing skill',
      `nonexistent-skill exists: ${fixiplug.hasSkill('nonexistent-skill')}`
    );

    // Test getSkillsByTag()
    const djangoSkills = fixiplug.getSkillsByTag('django');
    assert(
      djangoSkills.length > 0,
      'fixiplug.getSkillsByTag() finds skills with django tag',
      `Found ${djangoSkills.length} django skills`
    );

    const formsSkills = fixiplug.getSkillsByTag('forms');
    assert(
      formsSkills.length > 0,
      'fixiplug.getSkillsByTag() finds skills with forms tag',
      `Found ${formsSkills.length} forms skills`
    );

    // Test getSkillsByLevel()
    const beginnerSkills = fixiplug.getSkillsByLevel('beginner');
    const advancedSkills = fixiplug.getSkillsByLevel('advanced');

    assert(
      beginnerSkills.length > 0,
      'fixiplug.getSkillsByLevel() finds beginner skills',
      `Found ${beginnerSkills.length} beginner skills`
    );

    assert(
      advancedSkills.length > 0,
      'fixiplug.getSkillsByLevel() finds advanced skills',
      `Found ${advancedSkills.length} advanced skills`
    );

    // Test getSkillsManifest() basic
    const manifestBasic = fixiplug.getSkillsManifest();
    assert(
      manifestBasic && manifestBasic.count > 0 && Array.isArray(manifestBasic.skills),
      'fixiplug.getSkillsManifest() returns manifest with count and skills',
      `Count: ${manifestBasic.count}, Skills array: ${Array.isArray(manifestBasic.skills)}`
    );

    assert(
      manifestBasic.skills.every(s => !s.instructions),
      'Default manifest excludes instructions',
      `First skill has instructions: ${!!manifestBasic.skills[0]?.instructions}`
    );

    // Test getSkillsManifest() with includeInstructions
    const manifestWithInst = fixiplug.getSkillsManifest({ includeInstructions: true });
    assert(
      manifestWithInst.skills.every(s => s.instructions && s.instructions.length > 0),
      'Manifest with includeInstructions includes instructions',
      `First skill instructions length: ${manifestWithInst.skills[0]?.instructions?.length}`
    );

    // Test getSkillsManifest() with filters
    const manifestFiltered = fixiplug.getSkillsManifest({
      includeOnly: ['django-workflows', 'error-recovery']
    });

    assert(
      manifestFiltered.count === 2,
      'Manifest with includeOnly filter returns correct count',
      `Count: ${manifestFiltered.count}`
    );

    // Test getSkillsManifest() with tags
    const manifestDjango = fixiplug.getSkillsManifest({ tags: ['django'] });
    assert(
      manifestDjango.count > 0 && manifestDjango.skills.every(s => s.tags.includes('django')),
      'Manifest with tags filter returns only matching skills',
      `Count: ${manifestDjango.count}`
    );

    // Test getSkillInstructions()
    const instructions = fixiplug.getSkillInstructions('form-workflows');
    assert(
      instructions && typeof instructions === 'string' && instructions.length > 100,
      'fixiplug.getSkillInstructions() returns instructions',
      `Instructions length: ${instructions?.length}`
    );

    assert(
      instructions.includes('wizard') || instructions.includes('Wizard'),
      'Form workflows instructions include wizard content',
      `Has wizard content: ${instructions.includes('wizard')}`
    );

    console.log();

    // ========================================
    // Test 7: Plugin Types Verification
    // ========================================
    console.log('Test Group 7: Plugin Types Verification');
    console.log('-'.repeat(60));

    // Get full introspection data
    const introspection = await fixiplug.dispatch('api:introspect', {});

    // Verify introspection returned valid data
    if (!introspection || !introspection.fixiplug || !introspection.fixiplug.capabilities ||!introspection.fixiplug.capabilities.plugins) {
      console.error('Introspection returned invalid data:', introspection);
      throw new Error('Introspection failed to return plugins array');
    }

    const plugins = introspection.fixiplug.capabilities.plugins;

    // Find plugins
    const stateTrackerPluginInfo = plugins.find(p => p.name === 'stateTrackerPlugin');
    const reactivePluginInfo = plugins.find(p => p.name === 'reactiveUiPatternsSkill');
    const introspectionPluginInfo = plugins.find(p => p.name === 'introspectionPlugin');

    // Verify hybrid plugin (state-tracker: has hooks AND skill)
    assert(
      stateTrackerPluginInfo && stateTrackerPluginInfo.hooks.length > 0,
      'State-tracker is a hybrid plugin (has hooks)',
      `Hook count: ${stateTrackerPluginInfo?.hooks.length}`
    );

    const stateTrackerHasSkill = skillRegistry.has('stateTrackerPlugin');
    assert(
      stateTrackerHasSkill,
      'State-tracker is a hybrid plugin (has skill)',
      `In skill registry: ${stateTrackerHasSkill}`
    );

    // Verify skill-only plugin (reactive-ui-patterns: NO hooks, only skill)
    assert(
      reactivePluginInfo && reactivePluginInfo.hooks.length === 0,
      'Reactive-ui-patterns is a skill-only plugin (no hooks)',
      `Hook count: ${reactivePluginInfo?.hooks.length}`
    );

    const reactiveHasSkill = skillRegistry.has('reactiveUiPatternsSkill');
    assert(
      reactiveHasSkill,
      'Reactive-ui-patterns is a skill-only plugin (has skill)',
      `In skill registry: ${reactiveHasSkill}`
    );

    // Verify implementation-only plugin (introspection: has hooks, NO skill)
    assert(
      introspectionPluginInfo && introspectionPluginInfo.hooks.length > 0,
      'Introspection is an implementation-only plugin (has hooks)',
      `Hook count: ${introspectionPluginInfo?.hooks.length}`
    );

    const introspectionHasSkill = skillRegistry.has('introspectionPlugin');
    assert(
      !introspectionHasSkill,
      'Introspection is an implementation-only plugin (no skill)',
      `In skill registry: ${introspectionHasSkill}`
    );

    console.log();

  } catch (error) {
    console.error('\n❌ Test execution failed with error:');
    console.error(error);
    results.failed++;
  }

  // Print summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Exit with appropriate code
  if (results.failed > 0) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
