# Skill Plugin Optimization Plan

## Current State

**4 skill-only plugins = 86K characters**
- `django-workflows-skill.js`: 22.5K
- `error-recovery-skill.js`: 22K
- `form-workflows-skill.js`: 26.9K
- `reactive-ui-patterns-skill.js`: 14.5K

**Current behavior**: All skills injected into context when `includeSkills: true`

**Problem**: Wastes context window on skills Claude may not need

---

## Optimization: Skill-as-Tool Pattern

### Concept

Instead of injecting all skills into system context, expose them as **tools that Claude can call on demand**.

### Benefits

1. ✅ **Zero baseline cost**: No skills loaded until needed
2. ✅ **Just-in-time**: Claude retrieves relevant skill when task requires it
3. ✅ **Scalable**: Add 100 skills without bloating every conversation
4. ✅ **Measurable**: Track which skills are actually useful
5. ✅ **Composable**: Claude can retrieve multiple skills per task

### Implementation

#### Step 1: Add Skill Retrieval Tool

In `sdk/adapters/anthropic-adapter.js`, add new tool:

```javascript
getToolDefinitions() {
  const tools = [];

  // ... existing tools ...

  // Add skill retrieval tool
  tools.push({
    name: "retrieve_skill_guide",
    description: "Get detailed guide for a specific workflow pattern or integration (Django, forms, error handling, reactive UI). Use this when you need domain-specific guidance for FixiPlug patterns.",
    input_schema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          enum: await this._getAvailableSkills(),
          description: "Which skill guide to retrieve"
        }
      },
      required: ["skill"]
    }
  });

  return tools;
}

async _getAvailableSkills() {
  const manifest = await this.agent.fixi.dispatch('api:getSkillsManifest', {});
  return manifest.skills.map(s => s.skill.name);
}
```

#### Step 2: Implement Tool Execution

```javascript
async executeToolUse(toolUse) {
  // ... existing tool handling ...

  if (toolUse.name === 'retrieve_skill_guide') {
    const { skill } = toolUse.input;

    // Get skill instructions via introspection
    const result = await this.agent.fixi.dispatch('api:getPluginSkills', {
      pluginName: this._skillNameToPluginName(skill)
    });

    if (result && result.skill && result.skill.instructions) {
      return {
        success: true,
        skill: result.skill.name,
        instructions: result.skill.instructions,
        tags: result.skill.tags || []
      };
    }

    return { error: 'Skill not found' };
  }

  // ... rest of tool handling ...
}
```

#### Step 3: Update Skill Metadata (Optional Enhancement)

Add tags and use cases to skills for better discoverability:

```javascript
// In skill plugins
return {
  skill: {
    name: 'django-workflows',
    tags: ['django', 'crud', 'backend', 'dj-fixi'],
    useCases: [
      'Building Django CRUD interfaces',
      'Table management with dj-fixi',
      'Form handling with Django backends'
    ],
    description: '...',
    instructions: '...'
  }
};
```

Then update tool description to include tags:

```javascript
description: "Get detailed guide for: Django workflows (CRUD, tables, forms), Error recovery (retry, fallback), Form workflows (multi-step, validation), Reactive UI (state-driven patterns)"
```

---

## Migration Path

### Phase 1: Add Tool (Non-Breaking)

- Implement `retrieve_skill_guide` tool
- Keep existing `includeSkills` option working
- Test both approaches in parallel

### Phase 2: Default to Dynamic (Breaking)

- Change default: `includeSkills: false`
- Document: "Use retrieve_skill_guide tool for domain-specific guidance"
- Remove automatic injection (save 86K context)

### Phase 3: Validate & Iterate

- Track which skills Claude retrieves
- Remove unused skills
- Compress verbose skills based on usage patterns
- Add new skills based on user needs

---

## Example Usage

### Before (Static Injection)

```javascript
// 86K of skills injected into EVERY conversation
const adapter = new AnthropicAdapter(agent, { includeSkills: true });
const tools = adapter.getToolDefinitions();
const messages = [
  {
    role: 'user',
    content: 'Build a Django product CRUD interface'
  }
];

// System message includes all 4 skills (86K overhead)
```

### After (Dynamic Retrieval)

```javascript
// Zero skills in context by default
const adapter = new AnthropicAdapter(agent, { includeSkills: false });
const tools = adapter.getToolDefinitions(); // Includes retrieve_skill_guide

const messages = [
  {
    role: 'user',
    content: 'Build a Django product CRUD interface'
  }
];

// Claude's response:
// "I'll retrieve the Django workflows guide first"
// → Calls retrieve_skill_guide({ skill: "django-workflows" })
// → Gets 22K of instructions
// → Uses them to build the interface
```

**Context saved**: 64K (only loaded 1 of 4 skills)

---

## Validation Strategy

### Metrics to Track

1. **Skill retrieval rate**: How often does Claude call `retrieve_skill_guide`?
2. **Skill usage distribution**: Which skills are most/least used?
3. **Task completion rate**: Does dynamic retrieval work as well as static injection?
4. **Context efficiency**: How much context is saved per conversation?

### A/B Test

Run 20 test tasks with both approaches:

**Group A**: Static injection (`includeSkills: true`)
**Group B**: Dynamic retrieval (`retrieve_skill_guide` tool)

Compare:
- Task completion rate
- Response quality
- Context tokens used
- Number of tool calls

---

## Expected Outcomes

**Context Savings**:
- Before: 86K skills always loaded
- After: 0-22K loaded on demand (average ~15K if 1 skill per task)
- **Net savings: ~70K context per conversation**

**Scalability**:
- Can add 10-20 more skills without impact
- Each skill only loaded when relevant

**Usage Insights**:
- Track which skills are valuable (keep & improve)
- Identify unused skills (remove)
- Find gaps (create new skills)

---

## Future Enhancements

### 1. Skill Composition

Allow Claude to combine multiple skills:

```javascript
retrieve_skill_guide({ skills: ["django-workflows", "error-recovery"] })
```

### 2. Skill Versioning

Track skill versions for backward compatibility:

```javascript
{
  name: "django-workflows",
  version: "2.0",
  deprecated: false,
  changelog: "Added pagination patterns"
}
```

### 3. User-Specific Skills

Allow organizations to define custom skills:

```javascript
// Load from .fixiplug/skills/
{
  name: "acme-payment-integration",
  tags: ["acme", "payments", "stripe"],
  instructions: "How to integrate Acme's payment system..."
}
```

### 4. Skill Recommendations

Tool suggests relevant skills based on task:

```javascript
{
  name: "suggest_skills",
  description: "Get skill recommendations for a task",
  input: { task_description: "Build user authentication" },
  output: {
    recommended_skills: ["error-recovery", "form-workflows"],
    reason: "Auth requires form handling and error recovery"
  }
}
```

---

## Implementation Checklist

- [ ] Add `retrieve_skill_guide` tool to AnthropicAdapter
- [ ] Implement tool execution handler
- [ ] Add skill name enumeration (dynamic from registry)
- [ ] Add tags/use cases to existing skills (optional)
- [ ] Write tests for skill retrieval
- [ ] Update documentation
- [ ] Run A/B test (static vs dynamic)
- [ ] Analyze metrics
- [ ] Update default to `includeSkills: false`
- [ ] Archive unused skills based on metrics

---

## Decision Points

**Should you compress existing skills?**

Wait until you have usage data. If Claude retrieves a skill but doesn't use all 22K of instructions, compress it. If it uses everything, keep it comprehensive.

**Should you keep static injection as an option?**

Yes, for backward compatibility. Some users may prefer loading all skills upfront. Make dynamic retrieval the default, but allow:

```javascript
new AnthropicAdapter(agent, {
  skillStrategy: 'dynamic' // default - retrieve on demand
  // OR
  skillStrategy: 'static'  // load all in context
  // OR
  skillStrategy: 'selective', // load specific skills
  skills: ['django-workflows']
})
```

**Should you remove any current skills?**

Not yet. Implement dynamic retrieval first, track usage, then remove based on data.

---

## Summary

**Current**: 86K skills always in context (wasteful)
**Proposed**: 0K skills by default, retrieved on demand (efficient)
**Benefit**: 70K+ context savings, better scalability, measurable value
**Implementation**: ~200 lines in AnthropicAdapter + tests
**Timeline**: 1-2 days to implement, 1-2 weeks to validate

This makes skills truly "selective and dynamic" as intended.
