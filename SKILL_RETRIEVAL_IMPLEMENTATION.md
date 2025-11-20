# Efficient Skill Retrieval Implementation Plan

## Objective

Convert skills from static context injection to dynamic on-demand retrieval, reducing baseline context usage from 86K to ~0K while maintaining full skill availability.

---

## Design: Skill-as-Tool Pattern

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Claude Agent                          │
│  "I need to build a Django CRUD interface"                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool: retrieve_skill                       │
│  Input: { skill_name: "django-workflows" }                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              AnthropicAdapter.executeToolUse()              │
│  1. Validate skill_name                                     │
│  2. Call: api:getPluginSkills({ pluginName })               │
│  3. Return: { instructions, metadata }                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Core Skill Registry                         │
│  Returns: 22K of Django workflow instructions                │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle

**Lazy Loading**: Skills are metadata in the registry, but their full instructions are only sent to Claude when explicitly requested.

---

## Implementation Steps

### Phase 1: Add Skill Retrieval Tool (2-3 hours)

#### File: `sdk/adapters/anthropic-adapter.js`

**Step 1.1: Add helper to get available skills**

```javascript
/**
 * Get list of available skill names from registry
 * @returns {Promise<Array<string>>} Array of skill names
 * @private
 */
async _getAvailableSkillNames() {
  try {
    const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {
      includeInstructions: false // Metadata only
    });

    if (!manifest || !manifest.skills) {
      return [];
    }

    return manifest.skills.map(s => s.skill.name);
  } catch (error) {
    console.warn('Failed to get skill names:', error);
    return [];
  }
}
```

**Step 1.2: Add skill retrieval tool definition**

In `getToolDefinitions()` method, add:

```javascript
async getToolDefinitions() {
  const tools = [];

  // ... existing tools (discover_capabilities, etc.) ...

  // Add skill retrieval tool
  const availableSkills = await this._getAvailableSkillNames();

  if (availableSkills.length > 0) {
    tools.push({
      name: 'retrieve_skill',
      description: 'Retrieve detailed workflow guides and best practices for FixiPlug integrations. Available skills: Django workflows (CRUD, tables, forms), Error recovery (retry, fallback, circuit breakers), Form workflows (multi-step, validation), Reactive UI patterns (state-driven interfaces). Use this when you need domain-specific guidance.',
      input_schema: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            enum: availableSkills,
            description: 'Name of the skill guide to retrieve'
          }
        },
        required: ['skill_name']
      }
    });
  }

  return tools;
}
```

**Step 1.3: Implement tool execution handler**

In `executeToolUse()` method, add:

```javascript
async executeToolUse(toolUse) {
  const { name, input } = toolUse;

  // ... existing tool handlers ...

  // Handle skill retrieval
  if (name === 'retrieve_skill') {
    try {
      const { skill_name } = input;

      if (!skill_name) {
        return {
          success: false,
          error: 'skill_name parameter required'
        };
      }

      // Find plugin that provides this skill
      const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {
        includeInstructions: false
      });

      const skillEntry = manifest.skills?.find(s => s.skill.name === skill_name);

      if (!skillEntry) {
        return {
          success: false,
          error: `Skill "${skill_name}" not found`,
          available_skills: manifest.skills?.map(s => s.skill.name) || []
        };
      }

      // Retrieve full skill instructions
      const result = await this.agent.fixi.dispatch('api:getPluginSkills', {
        pluginName: skillEntry.pluginName
      });

      if (!result || !result.skill) {
        return {
          success: false,
          error: 'Failed to retrieve skill instructions'
        };
      }

      // Return skill instructions
      return {
        success: true,
        skill_name: result.skill.name,
        description: result.skill.description,
        instructions: result.skill.instructions,
        tags: result.skill.tags || [],
        metadata: {
          plugin: skillEntry.pluginName,
          version: result.skill.version || '1.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Skill retrieval failed: ${error.message}`
      };
    }
  }

  // ... rest of tool handlers ...
}
```

**Step 1.4: Create tool result formatter**

In `createToolResult()` method, handle skill retrieval results:

```javascript
createToolResult(toolUseId, result) {
  // ... existing formatting ...

  // Format skill retrieval results
  if (result.skill_name && result.instructions) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: [
        {
          type: 'text',
          text: `# ${result.skill_name}\n\n${result.description}\n\n${result.instructions}`
        }
      ]
    };
  }

  // ... existing formatting ...
}
```

---

### Phase 2: Update Skill Metadata (1 hour)

#### Enhance skill plugins with tags and use cases

**File: `plugins/django-workflows-skill.js`**

```javascript
return {
  skill: {
    name: 'django-workflows',
    version: '1.0',
    tags: ['django', 'crud', 'backend', 'dj-fixi', 'tables', 'forms'],

    useCases: [
      'Building Django CRUD interfaces',
      'Integrating dj-fixi with FixiPlug',
      'Managing tables and forms with Django backends',
      'Implementing master-detail views'
    ],

    description: 'Master Django-FixiPlug integration workflows...',
    instructions: `...`
  }
};
```

**Apply to all skill plugins**:
- `error-recovery-skill.js`: tags: `['error-handling', 'retry', 'resilience']`
- `form-workflows-skill.js`: tags: `['forms', 'validation', 'multi-step']`
- `reactive-ui-patterns-skill.js`: tags: `['ui', 'state', 'reactive']`

---

### Phase 3: Update Default Behavior (30 min)

#### Make dynamic retrieval the default

**File: `sdk/adapters/anthropic-adapter.js`**

```javascript
constructor(agent, options = {}) {
  // ...

  this.options = {
    includeCoreTools: options.includeCoreTools !== false,
    includeWorkflowTools: options.includeWorkflowTools !== false,
    includeCacheTools: options.includeCacheTools !== false,
    includePluginHooks: options.includePluginHooks || false,

    // Change default from false to 'dynamic'
    skillStrategy: options.skillStrategy || 'dynamic', // 'dynamic', 'static', or 'none'
    includeSkills: options.includeSkills || false // Deprecated - use skillStrategy
  };
}
```

**Update `getToolDefinitions()` to respect strategy**:

```javascript
async getToolDefinitions() {
  const tools = [];

  // ... existing tools ...

  // Add skill retrieval tool only for dynamic strategy
  if (this.options.skillStrategy === 'dynamic') {
    const availableSkills = await this._getAvailableSkillNames();
    if (availableSkills.length > 0) {
      tools.push(this._createSkillRetrievalTool(availableSkills));
    }
  }

  return tools;
}
```

---

### Phase 4: Add Tests (2 hours)

#### File: `test/skill-retrieval.test.js`

```javascript
/**
 * Skill Retrieval Test Suite
 * Tests the skill-as-tool pattern for dynamic skill loading
 */

import { createFixiplug } from '../builder/fixiplug-factory.js';
import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';
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
  const adapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });

  // Test 1: retrieve_skill tool is available
  console.log('Test Group 1: Tool Availability');
  console.log('-'.repeat(60));

  const tools = await adapter.getToolDefinitions();
  const skillTool = tools.find(t => t.name === 'retrieve_skill');

  assert(skillTool !== undefined, 'retrieve_skill tool exists');
  assert(skillTool?.input_schema?.properties?.skill_name !== undefined,
    'Tool has skill_name parameter');

  const skillEnum = skillTool?.input_schema?.properties?.skill_name?.enum || [];
  assert(skillEnum.length > 0, 'Tool lists available skills',
    `Found ${skillEnum.length} skills`);
  assert(skillEnum.includes('reactive-ui-patterns'),
    'Includes reactive-ui-patterns skill');
  assert(skillEnum.includes('django-workflows'),
    'Includes django-workflows skill');

  // Test 2: Skill retrieval execution
  console.log('\nTest Group 2: Skill Retrieval Execution');
  console.log('-'.repeat(60));

  const toolUse = {
    id: 'test-1',
    name: 'retrieve_skill',
    input: { skill_name: 'reactive-ui-patterns' }
  };

  const result = await adapter.executeToolUse(toolUse);

  assert(result.success === true, 'Retrieval succeeds');
  assert(result.skill_name === 'reactive-ui-patterns',
    'Returns correct skill name');
  assert(result.instructions && result.instructions.length > 1000,
    'Returns instructions', `Got ${result.instructions?.length || 0} chars`);
  assert(result.description && result.description.length > 0,
    'Returns description');
  assert(Array.isArray(result.tags), 'Returns tags array');

  // Test 3: Error handling
  console.log('\nTest Group 3: Error Handling');
  console.log('-'.repeat(60));

  const badToolUse = {
    id: 'test-2',
    name: 'retrieve_skill',
    input: { skill_name: 'nonexistent-skill' }
  };

  const errorResult = await adapter.executeToolUse(badToolUse);

  assert(errorResult.success === false, 'Returns error for invalid skill');
  assert(errorResult.error && errorResult.error.length > 0,
    'Includes error message');
  assert(Array.isArray(errorResult.available_skills),
    'Lists available skills on error');

  // Test 4: Tool result formatting
  console.log('\nTest Group 4: Tool Result Formatting');
  console.log('-'.repeat(60));

  const toolResult = adapter.createToolResult('test-3', result);

  assert(toolResult.type === 'tool_result', 'Result has correct type');
  assert(toolResult.tool_use_id === 'test-3', 'Result has correct ID');
  assert(Array.isArray(toolResult.content), 'Result has content array');

  const content = toolResult.content[0];
  assert(content.type === 'text', 'Content is text type');
  assert(content.text.includes('reactive-ui-patterns'),
    'Content includes skill name');
  assert(content.text.length > 1000, 'Content is substantial',
    `Got ${content.text.length} chars`);

  // Test 5: Strategy options
  console.log('\nTest Group 5: Strategy Options');
  console.log('-'.repeat(60));

  const dynamicAdapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });
  const dynamicTools = await dynamicAdapter.getToolDefinitions();
  assert(dynamicTools.some(t => t.name === 'retrieve_skill'),
    'Dynamic strategy includes retrieve_skill tool');

  const staticAdapter = new AnthropicAdapter(agent, { skillStrategy: 'static' });
  const staticTools = await staticAdapter.getToolDefinitions();
  assert(!staticTools.some(t => t.name === 'retrieve_skill'),
    'Static strategy excludes retrieve_skill tool');

  const noneAdapter = new AnthropicAdapter(agent, { skillStrategy: 'none' });
  const noneTools = await noneAdapter.getToolDefinitions();
  assert(!noneTools.some(t => t.name === 'retrieve_skill'),
    'None strategy excludes retrieve_skill tool');

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
```

---

### Phase 5: Documentation Updates (30 min)

#### Update README and adapter docs

**File: `sdk/adapters/README.md`**

Add section:

```markdown
## Skill Retrieval (Dynamic Context)

Skills provide domain-specific workflow guides that teach Claude how to use FixiPlug effectively. Instead of loading all skills into context (86K), the `retrieve_skill` tool allows Claude to fetch guides on demand.

### Usage

```javascript
const adapter = new AnthropicAdapter(agent, {
  skillStrategy: 'dynamic' // Default - enables retrieve_skill tool
});

// Claude can now call:
// retrieve_skill({ skill_name: "django-workflows" })
// Returns 22K of Django integration patterns
```

### Available Skills

- **django-workflows**: Django CRUD, tables, forms with dj-fixi
- **error-recovery**: Retry logic, fallback strategies, circuit breakers
- **form-workflows**: Multi-step forms, validation, submission
- **reactive-ui-patterns**: State-driven UI, reactive patterns

### Strategy Options

```javascript
skillStrategy: 'dynamic'  // Claude retrieves skills on demand (default)
skillStrategy: 'static'   // All skills loaded into context (86K overhead)
skillStrategy: 'none'     // Skills disabled
```
```

---

## Performance Comparison

### Before (Static Injection)

```javascript
const adapter = new AnthropicAdapter(agent, { includeSkills: true });

// System message includes all skills:
// - django-workflows: 22.5K
// - error-recovery: 22K
// - form-workflows: 26.9K
// - reactive-ui-patterns: 14.5K
// Total: 86K context overhead on EVERY conversation
```

### After (Dynamic Retrieval)

```javascript
const adapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });

// System message: 0K skills (just tool definitions)
// Claude retrieves only what's needed:
// - Task requires Django patterns → retrieves django-workflows (22.5K)
// - Task requires error handling → retrieves error-recovery (22K)
// Average: 15-25K per conversation (70K savings)
```

---

## Migration Timeline

| Phase | Duration | Outcome |
|-------|----------|---------|
| 1. Add Tool | 2-3 hours | `retrieve_skill` tool available |
| 2. Enhance Metadata | 1 hour | Skills have tags/use cases |
| 3. Update Defaults | 30 min | Dynamic strategy is default |
| 4. Add Tests | 2 hours | Full test coverage |
| 5. Documentation | 30 min | Updated docs and examples |
| **Total** | **6-7 hours** | **Production ready** |

---

## Validation Criteria

### Success Metrics

1. ✅ `retrieve_skill` tool appears in tool definitions
2. ✅ Claude successfully retrieves skills when needed
3. ✅ Skill content is properly formatted and usable
4. ✅ Error handling works for invalid skill names
5. ✅ Context usage reduced by ~70K per conversation
6. ✅ All tests pass (15+ assertions)

### A/B Test Plan

Run 20 test tasks (10 static, 10 dynamic):

**Metrics to compare**:
- Task completion rate
- Response quality (subjective)
- Context tokens used
- Number of tool calls
- Time to completion

**Expected results**:
- Completion rate: Same (100%)
- Quality: Same or better (focused retrieval)
- Context: 70K savings with dynamic
- Tool calls: +1-2 for skill retrieval
- Time: Similar (retrieval is fast)

---

## Risk Mitigation

### Risk 1: Claude doesn't know when to retrieve skills

**Mitigation**: Tool description clearly lists use cases
- "Use this when you need Django integration patterns..."
- Enum includes descriptive skill names

### Risk 2: Skill retrieval adds latency

**Mitigation**: Retrieval is synchronous and fast (< 10ms)
- Skills cached in memory (registry)
- No network calls or disk I/O

### Risk 3: Breaking change for existing code

**Mitigation**: Backward compatible
- `includeSkills: true` still works (static injection)
- New `skillStrategy` option is additive
- Default is opt-in (`dynamic`)

---

## Next Steps After Implementation

1. **Gather metrics**: Track which skills Claude retrieves
2. **Optimize skills**: Compress skills that are rarely fully used
3. **Add skills**: Create new skills based on user needs
4. **Remove unused**: Archive skills that are never retrieved
5. **User-specific**: Allow organizations to define custom skills

---

## Conclusion

This implementation converts skills from wasteful static context (86K always loaded) to efficient dynamic retrieval (0-25K loaded on demand).

**Benefits**:
- ✅ 70K context savings per conversation
- ✅ Scalable to 100+ skills without overhead
- ✅ Measurable skill value (track retrievals)
- ✅ Maintains full skill availability
- ✅ ~6 hours to implement and test

**Skills become true assets**: Teaching Claude your organization's patterns, but only when needed.
