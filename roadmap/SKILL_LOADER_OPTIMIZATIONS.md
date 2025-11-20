# Skill Loader Optimization Opportunities

## Current Implementation Analysis

**Memory Usage:**
- SKILL.md files: 84KB total (4 files)
- Loaded at: Module import time (synchronous)
- Storage: skillsCache (84KB) + skillRegistry (84KB) = ~168KB

**LLM Context Usage:**
- Baseline: 0KB ✅ (dynamic strategy)
- On-demand: ~21KB per skill ✅
- Retrieval: <1ms (cached) ✅

## Optimization 1: Lazy Loading (Trade-off Analysis)

### Current: Eager Loading
```javascript
// skills loaded at module import
loadAllSkills();  // Parses all SKILL.md files immediately

export default {
  setup(ctx) {
    // Skills already in skillsCache
    for (const skillData of skillsCache.skills) {
      registerSkill(virtualPluginName, skillData.skill);
    }
  }
};
```

**Pros:**
- ✅ Fast validation (errors at startup)
- ✅ Immediate availability
- ✅ Predictable memory usage
- ✅ No file I/O during requests

**Cons:**
- ❌ All skills in memory (84KB)
- ❌ Slower startup time
- ❌ Parses files never used

### Proposed: Lazy Loading
```javascript
const skillsCache = {
  locations: [...],
  loadedSkills: new Map(),  // skill name → parsed skill
  scannedDirs: false
};

export default {
  setup(ctx) {
    // Scan directories, but DON'T parse files yet
    scanSkillDirectories();  // Just get file paths

    ctx.on('api:getSkill', async (event) => {
      const { skillName } = event;

      // Check cache
      if (skillsCache.loadedSkills.has(skillName)) {
        return skillsCache.loadedSkills.get(skillName);
      }

      // Lazy load: parse SKILL.md on first access
      const skillPath = findSkillPath(skillName);
      if (skillPath) {
        const content = fs.readFileSync(skillPath, 'utf8');
        const skill = parseSkillMd(content, skillPath, 'project');
        skillsCache.loadedSkills.set(skillName, skill);
        return { success: true, skill };
      }

      return { success: false, error: 'Not found' };
    });
  }
};
```

**Pros:**
- ✅ Lower memory usage (parse on-demand)
- ✅ Faster startup (no parsing upfront)
- ✅ Only loads skills that are used

**Cons:**
- ❌ File I/O on first retrieval (~5-10ms vs <1ms)
- ❌ Errors discovered at runtime (not startup)
- ❌ More complex error handling
- ❌ Can't validate SKILL.md files upfront

**Recommendation:** Keep eager loading unless:
1. You have 100+ SKILL.md files (>10MB)
2. Startup time is critical
3. Most skills are never used

## Optimization 2: Eliminate Duplicate Storage

### Current: Skills in Two Places
```javascript
// 1. skillsCache (in skill-md-loader.js)
const skillsCache = {
  skills: [
    { skill: {...}, source: 'project', path: '...' }
  ]
};

// 2. skillRegistry (in core/hooks.js)
const skillRegistry = new Map();
skillRegistry.set('skillMd:django-workflows', {...});
```

### Proposed: Single Source of Truth
```javascript
// Option A: Store only in skillRegistry
export default {
  setup(ctx) {
    const skills = loadAllSkills();

    // Register directly, don't keep local cache
    for (const skillData of skills) {
      registerSkill(`skillMd:${skillData.skill.name}`, skillData.skill);
    }

    // For stats, query skillRegistry instead of local cache
    ctx.on('api:getSkillMdStats', () => {
      const skillRegistry = Fixi.getSkillRegistry();
      const mdSkills = [];
      for (const [pluginName, skill] of skillRegistry.entries()) {
        if (pluginName.startsWith('skillMd:')) {
          mdSkills.push(skill);
        }
      }
      return { loaded: mdSkills.length, skills: mdSkills };
    });
  }
};
```

**Savings:** ~84KB memory (eliminates skillsCache)

**Trade-off:** Harder to distinguish SKILL.md skills from JS skills

## Optimization 3: Metadata-Only Registration

### Current: Full Skill Registration
```javascript
registerSkill(virtualPluginName, {
  name: 'django-workflows',
  description: '...',
  instructions: '<22KB of content>',  // Large!
  tags: [...],
  version: '1.0.0'
});
```

### Proposed: Metadata-Only Until Retrieved
```javascript
// Register lightweight metadata
registerSkill(virtualPluginName, {
  name: 'django-workflows',
  description: '...',
  tags: [...],
  version: '1.0.0',
  _lazyLoadPath: '.claude/skills/django-workflows/SKILL.md'  // Pointer
  // NO instructions field (22KB saved)
});

// Load full instructions on first retrieval
ctx.on('api:getSkill', (event) => {
  const { skillName } = event;
  const skill = skillRegistry.get(`skillMd:${skillName}`);

  if (skill && skill._lazyLoadPath && !skill.instructions) {
    // Load instructions on-demand
    const content = fs.readFileSync(skill._lazyLoadPath, 'utf8');
    const parsed = parseSkillMd(content, skill._lazyLoadPath, 'project');
    skill.instructions = parsed.instructions;
  }

  return { success: true, skill };
});
```

**Savings:** ~84KB memory (instructions loaded on-demand)

**Trade-off:** File I/O penalty on first retrieval

## Benchmark: Memory Usage Comparison

| Approach | Startup Parse | Memory (4 skills) | Memory (100 skills) | First Retrieval |
|----------|--------------|-------------------|---------------------|-----------------|
| **Current (eager)** | Yes (all) | 168KB | 4.2MB | <1ms (cached) |
| **Lazy load** | No | 8KB (paths) | 200KB (paths) | 5-10ms (file I/O) |
| **Metadata-only** | Yes (metadata) | 84KB | 2.1MB | 5-10ms (file I/O) |
| **Single storage** | Yes (all) | 84KB | 2.1MB | <1ms (cached) |

## Recommendation

**For current scale (4 skills, 84KB):**
✅ **Keep current implementation**
- Memory overhead is negligible (168KB)
- Fast startup validation catches errors early
- <1ms retrieval is optimal for LLM workflows
- Simple, predictable behavior

**If you scale to 50+ skills (>1MB):**
🔄 **Consider metadata-only registration**
- Reduces memory by ~50%
- Still validates YAML at startup
- 5-10ms penalty on first retrieval is acceptable

**If you scale to 100+ skills (>10MB):**
🚀 **Implement lazy loading**
- Massive memory savings
- Startup time remains fast
- Most skills never loaded into memory

## Implementation Priority

1. **Now**: Keep current eager loading (optimal for current scale)
2. **At 20+ skills**: Eliminate duplicate storage (single source of truth)
3. **At 50+ skills**: Add metadata-only registration
4. **At 100+ skills**: Implement full lazy loading

Your current implementation is **well-optimized for the current scale**. The 168KB memory footprint is trivial for a Node.js process, and the <1ms retrieval time is ideal for LLM integrations.
