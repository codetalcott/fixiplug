/**
 * Skill Lifecycle Hooks Test Suite
 * Tests the skill:registered, skill:updated, and skill:removed hooks
 * along with the skill-versioning plugin
 */

import { createFixiplug, FEATURES } from '../builder/fixiplug-factory.js';
import skillVersioning from '../plugins/skill-versioning.js';

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

async function runTests() {
  console.log('='.repeat(60));
  console.log('Skill Lifecycle Hooks Test Suite');
  console.log('='.repeat(60));
  console.log();

  try {
    // ========================================
    // Test Group 1: skill:registered Hook
    // ========================================
    console.log('Test Group 1: skill:registered Hook');
    console.log('-'.repeat(60));

    const fixiplug1 = createFixiplug({ features: [FEATURES.TESTING] });

    let registeredEvent = null;

    // Plugin to listen for skill:registered
    function testListenerPlugin(ctx) {
      ctx.on('skill:registered', (event) => {
        registeredEvent = event;
        return event;
      });
    }

    fixiplug1.use(testListenerPlugin);

    // Plugin that registers a skill
    function testSkillPlugin(ctx) {
      return {
        skill: {
          name: 'test-skill',
          description: 'A test skill',
          version: '1.0.0',
          tags: ['test']
        }
      };
    }

    fixiplug1.use(testSkillPlugin);

    // Wait for deferred events to process
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(registeredEvent !== null, 'skill:registered event fires');
    assert(registeredEvent?.plugin === 'testSkillPlugin', 'Event contains plugin name', `Plugin: ${registeredEvent?.plugin}`);
    assert(registeredEvent?.skill?.name === 'test-skill', 'Event contains skill metadata');
    assert(registeredEvent?.previous === null, 'New registrations have no previous value');
    assert(typeof registeredEvent?.timestamp === 'number', 'Event includes timestamp');

    console.log();

    // ========================================
    // Test Group 2: skill:updated Hook
    // ========================================
    console.log('Test Group 2: skill:updated Hook');
    console.log('-'.repeat(60));

    const {  Fixi } = await import('../core/fixi-core.js');
    const fixiplug2 = createFixiplug({ features: [FEATURES.TESTING] });

    let updatedEvent = null;

    // Plugin to listen for skill:updated
    function updateListenerPlugin(ctx) {
      ctx.on('skill:updated', (event) => {
        updatedEvent = event;
        return event;
      });
    }

    fixiplug2.use(updateListenerPlugin);

    // Register initial skill
    Fixi.registerSkill('testPlugin', {
      name: 'test-skill',
      description: 'Initial description',
      version: '1.0.0'
    });

    // Wait for first event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the skill
    Fixi.registerSkill('testPlugin', {
      name: 'test-skill',
      description: 'Updated description',
      version: '2.0.0'
    });

    // Wait for update event
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(updatedEvent !== null, 'skill:updated event fires');
    assert(updatedEvent?.plugin === 'testPlugin', 'Event contains plugin name');
    assert(updatedEvent?.skill?.version === '2.0.0', 'Event contains updated skill');
    assert(updatedEvent?.previous?.version === '1.0.0', 'Event includes previous skill version');
    assert(updatedEvent?.previous?.description === 'Initial description', 'Previous skill has old values');

    console.log();

    // ========================================
    // Test Group 3: skill:removed Hook
    // ========================================
    console.log('Test Group 3: skill:removed Hook');
    console.log('-'.repeat(60));

    const fixiplug3 = createFixiplug({ features: [FEATURES.TESTING] });

    let removedEvent = null;

    // Plugin to listen for skill:removed
    function removeListenerPlugin(ctx) {
      ctx.on('skill:removed', (event) => {
        removedEvent = event;
        return event;
      });
    }

    fixiplug3.use(removeListenerPlugin);

    // Register and then remove a skill
    const { unregisterSkill } = await import('../core/hooks.js');

    Fixi.registerSkill('tempPlugin', {
      name: 'temp-skill',
      description: 'Temporary skill',
      version: '1.0.0'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    unregisterSkill('tempPlugin');

    await new Promise(resolve => setTimeout(resolve, 100));

    assert(removedEvent !== null, 'skill:removed event fires');
    assert(removedEvent?.plugin === 'tempPlugin', 'Event contains plugin name');
    assert(removedEvent?.skill?.name === 'temp-skill', 'Event contains removed skill metadata');
    assert(typeof removedEvent?.timestamp === 'number', 'Event includes timestamp');

    console.log();

    // ========================================
    // Test Group 4: Skill Versioning Plugin - Registration
    // ========================================
    console.log('Test Group 4: Skill Versioning Plugin - Registration');
    console.log('-'.repeat(60));

    const fixiplug4 = createFixiplug({ features: [FEATURES.TESTING] });
    fixiplug4.use(skillVersioning);

    // Register a skill
    Fixi.registerSkill('versionedPlugin', {
      name: 'versioned-skill',
      description: 'Versioned skill',
      version: '1.0.0'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Get version history
    const history1 = await fixiplug4.dispatch('api:getSkillHistory', {
      plugin: 'versionedPlugin'
    });

    assert(history1.history?.length === 1, 'Version history tracked on registration', `Length: ${history1.history?.length}`);
    assert(history1.history[0]?.action === 'registered', 'First entry marks registration');
    assert(history1.history[0]?.version === '1.0.0', 'Version tracked correctly');

    console.log();

    // ========================================
    // Test Group 5: Skill Versioning Plugin - Updates
    // ========================================
    console.log('Test Group 5: Skill Versioning Plugin - Updates');
    console.log('-'.repeat(60));

    // Update the skill
    Fixi.registerSkill('versionedPlugin', {
      name: 'versioned-skill',
      description: 'Updated description',
      version: '2.0.0',
      tags: ['new-tag']
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const history2 = await fixiplug4.dispatch('api:getSkillHistory', {
      plugin: 'versionedPlugin'
    });

    assert(history2.history?.length === 2, 'Updates add to history', `Length: ${history2.history?.length}`);
    assert(history2.history[1]?.action === 'updated', 'Second entry marks update');
    assert(history2.history[1]?.version === '2.0.0', 'New version tracked');
    assert(history2.history[1]?.previous?.version === '1.0.0', 'Previous version included');
    assert(history2.history[1]?.changes?.version !== undefined, 'Changes detected', `Changes: ${JSON.stringify(history2.history[1]?.changes)}`);

    console.log();

    // ========================================
    // Test Group 6: Skill Versioning Plugin - Get Current Version
    // ========================================
    console.log('Test Group 6: Skill Versioning Plugin - Get Current Version');
    console.log('-'.repeat(60));

    const currentVersion = await fixiplug4.dispatch('api:getSkillVersion', {
      plugin: 'versionedPlugin'
    });

    assert(currentVersion.version === '2.0.0', 'Current version returns latest');
    assert(currentVersion.action === 'updated', 'Action reflects last operation');
    assert(typeof currentVersion.timestamp === 'number', 'Timestamp included');

    console.log();

    // ========================================
    // Test Group 7: Skill Versioning Plugin - Get All Versions
    // ========================================
    console.log('Test Group 7: Skill Versioning Plugin - Get All Versions');
    console.log('-'.repeat(60));

    const allVersions = await fixiplug4.dispatch('api:getAllSkillVersions');

    assert(allVersions.skills?.length >= 1, 'Returns all tracked skills', `Count: ${allVersions.skills?.length}`);

    const versionedSkill = allVersions.skills.find(s => s.plugin === 'versionedPlugin');
    assert(versionedSkill !== undefined, 'Versioned skill included in results');
    assert(versionedSkill?.version === '2.0.0', 'Shows current version');
    assert(versionedSkill?.status === 'active', 'Status is active');
    assert(versionedSkill?.historyCount === 2, 'History count is correct', `Count: ${versionedSkill?.historyCount}`);

    console.log();

    // ========================================
    // Test Group 8: Skill Versioning Plugin - Removal
    // ========================================
    console.log('Test Group 8: Skill Versioning Plugin - Removal');
    console.log('-'.repeat(60));

    unregisterSkill('versionedPlugin');

    await new Promise(resolve => setTimeout(resolve, 100));

    const history3 = await fixiplug4.dispatch('api:getSkillHistory', {
      plugin: 'versionedPlugin'
    });

    assert(history3.history?.length === 3, 'Removal adds to history', `Length: ${history3.history?.length}`);
    assert(history3.history[2]?.action === 'removed', 'Last entry marks removal');

    const versionAfterRemoval = await fixiplug4.dispatch('api:getSkillVersion', {
      plugin: 'versionedPlugin'
    });

    // After removal, getSkillVersion finds the last non-removed entry
    assert(versionAfterRemoval.version === '2.0.0', 'Returns last active version after removal');
    assert(versionAfterRemoval.action === 'updated', 'Action shows last active state');

    // Check that getAllSkillVersions shows it as removed
    const allAfterRemoval = await fixiplug4.dispatch('api:getAllSkillVersions');
    const removedSkill = allAfterRemoval.skills.find(s => s.plugin === 'versionedPlugin');
    assert(removedSkill?.status === 'removed', 'Status shows as removed in all versions list');

    console.log();

    // ========================================
    // Test Group 9: Change Detection
    // ========================================
    console.log('Test Group 9: Change Detection');
    console.log('-'.repeat(60));

    Fixi.registerSkill('changeTest', {
      name: 'change-test',
      description: 'Original',
      version: '1.0.0',
      tags: ['tag1'],
      references: ['ref1']
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    Fixi.registerSkill('changeTest', {
      name: 'change-test',
      description: 'Updated',
      version: '1.1.0',
      tags: ['tag1', 'tag2'],
      references: ['ref1', 'ref2']
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const changeHistory = await fixiplug4.dispatch('api:getSkillHistory', {
      plugin: 'changeTest'
    });

    const changes = changeHistory.history[1]?.changes;

    assert(changes?.description !== undefined, 'Description change detected');
    assert(changes?.version !== undefined, 'Version change detected');
    assert(changes?.tags !== undefined, 'Tags change detected');
    assert(changes?.references !== undefined, 'References change detected');
    assert(changes?.description?.from === 'Original', 'Change tracks old value');
    assert(changes?.description?.to === 'Updated', 'Change tracks new value');

    console.log();

  } catch (error) {
    console.error('\n❌ Test execution failed with error:');
    console.error(error);
    results.failed++;
  }

  // ========================================
  // Print Summary
  // ========================================
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
