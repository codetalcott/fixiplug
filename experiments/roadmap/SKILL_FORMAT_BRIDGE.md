# Skill Format Bridge: FixiPlug ↔ Claude Code Agent Skills

## Overview

FixiPlug will support **both** JavaScript plugin skills and Claude Code SKILL.md files, providing maximum flexibility while maintaining ecosystem compatibility.

## Format Comparison

### JavaScript Plugin Skills (Advanced)

**Use when:**
- Skill needs to listen to hooks
- Skill needs dynamic behavior
- Skill is part of a larger plugin
- Skill needs to register event handlers

**Example:**
```javascript
export default {
  name: 'advancedWorkflowSkill',
  skill: {
    name: 'advanced-workflow',
    description: 'Advanced workflow orchestration with state tracking',
    instructions: '# Advanced Workflow\n\n...',
    tags: ['workflow', 'orchestration'],
    version: '1.0.0'
  },
  setup(ctx) {
    // Listen to workflow events
    ctx.on('workflow:started', (event) => {
      console.log('Workflow started:', event.workflowId);
    });

    // Add custom hook
    ctx.on('api:getWorkflowMetrics', () => {
      return { /* computed metrics */ };
    });
  }
};
```

### SKILL.md Files (Declarative)

**Use when:**
- Skill is purely instructional
- No dynamic behavior needed
- Want portability with Claude Code
- Want easy git-based distribution

**Example:**
```markdown
---
name: django-workflows
description: Expert guidance for Django development workflows including models, views, forms, and deployment
tags:
  - django
  - python
  - web-development
version: 1.0.0
---

# Django Workflows

## Instructions

When working with Django projects, follow these patterns:

### 1. Model-First Development
...

### 2. View Layer Organization
...
```

## Implementation Plan

### Phase 1: SKILL.md Loader Plugin

Create a new plugin that reads SKILL.md files and registers them as skills:

**Location:** `plugins/skill-md-loader.js`

```javascript
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml'; // Will need to add dependency

export default {
  name: 'skillMdLoader',

  async setup(ctx) {
    // Load SKILL.md files from standard locations
    const locations = [
      '.claude/skills',           // Project skills
      path.join(process.env.HOME, '.claude/skills')  // Personal skills
    ];

    for (const location of locations) {
      await this._loadSkillsFromDirectory(ctx, location);
    }

    // Provide API to reload skills
    ctx.on('api:reloadSkillMd', async () => {
      // Re-scan directories
    });
  },

  async _loadSkillsFromDirectory(ctx, dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');

          try {
            const content = await fs.readFile(skillMdPath, 'utf8');
            const skill = this._parseSkillMd(content, skillMdPath);

            // Register as a skill
            ctx.registerSkill(skill.name, skill);

            console.log(`[SkillMdLoader] Loaded skill: ${skill.name}`);
          } catch (err) {
            // SKILL.md doesn't exist in this directory, skip
          }
        }
      }
    } catch (err) {
      // Directory doesn't exist, skip
    }
  },

  _parseSkillMd(content, filePath) {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);

    if (!frontmatterMatch) {
      throw new Error(`Invalid SKILL.md format: ${filePath}`);
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]);
    const instructions = frontmatterMatch[2].trim();

    // Validate required fields
    if (!frontmatter.name) {
      throw new Error(`Missing 'name' field in SKILL.md: ${filePath}`);
    }

    if (!frontmatter.description) {
      throw new Error(`Missing 'description' field in SKILL.md: ${filePath}`);
    }

    // Return skill object in FixiPlug format
    return {
      name: frontmatter.name,
      description: frontmatter.description,
      instructions,
      tags: frontmatter.tags || [],
      version: frontmatter.version || '1.0.0',
      metadata: {
        source: 'skill-md',
        filePath,
        allowedTools: frontmatter['allowed-tools'] || undefined
      }
    };
  }
};
```

### Phase 2: Export Utility

Create a utility to export JavaScript skills to SKILL.md format:

**Location:** `utils/export-skill-to-md.js`

```javascript
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

export async function exportSkillToMd(skill, outputDir) {
  // Create frontmatter
  const frontmatter = {
    name: skill.name,
    description: skill.description,
    tags: skill.tags || [],
    version: skill.version || '1.0.0'
  };

  // Create SKILL.md content
  const content = `---
${yaml.stringify(frontmatter).trim()}
---

${skill.instructions}
`;

  // Write to file
  const skillDir = path.join(outputDir, skill.name);
  await fs.mkdir(skillDir, { recursive: true });

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(skillMdPath, content, 'utf8');

  console.log(`Exported skill to: ${skillMdPath}`);
  return skillMdPath;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createFixiplug } = await import('../builder/fixiplug-factory.js');

  // Load all plugins
  const fixiplug = createFixiplug({ features: [] });
  // ... load plugins ...

  // Export all skills
  const manifest = await fixiplug.dispatch('api:getSkillsManifest', {});

  for (const skillMeta of manifest.skills) {
    const result = await fixiplug.dispatch('api:getSkill', {
      skillName: skillMeta.name
    });

    if (result.success) {
      await exportSkillToMd(result.skill, '.claude/skills');
    }
  }
}
```

### Phase 3: Migration Guide

Provide clear migration paths:

**For existing JavaScript skills:**
```bash
# Export to SKILL.md (if skill is purely declarative)
node utils/export-skill-to-md.js

# Keep as JavaScript (if skill has setup() logic)
# No action needed
```

**For new skills:**
```bash
# Pure skill (no hooks/logic)? Create SKILL.md
mkdir -p .claude/skills/my-skill
cat > .claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: My skill description
---
# My Skill
...
EOF

# Need hooks/logic? Create JavaScript plugin
touch plugins/my-skill.js
```

## Benefits of Hybrid Approach

### 1. **Backward Compatibility**
- Existing JavaScript skills continue to work
- No breaking changes

### 2. **Forward Compatibility**
- New SKILL.md files work in both FixiPlug and Claude Code
- Skills can be shared across ecosystems

### 3. **Progressive Enhancement**
- Start with simple SKILL.md
- Upgrade to JavaScript plugin if you need dynamic behavior

### 4. **Best of Both Worlds**
- Declarative skills: Simple, portable (SKILL.md)
- Advanced skills: Powerful, integrated (JavaScript)

## Implementation Checklist

- [ ] Add `yaml` dependency to package.json
- [ ] Create `plugins/skill-md-loader.js`
- [ ] Create `utils/export-skill-to-md.js`
- [ ] Add tests for SKILL.md parsing
- [ ] Add tests for export utility
- [ ] Update documentation
- [ ] Add examples of both formats
- [ ] Create migration guide for existing skills

## File Structure Examples

### Pure SKILL.md Skill
```
.claude/skills/
└── django-workflows/
    ├── SKILL.md
    ├── examples.md (optional)
    └── templates/ (optional)
        └── model-template.py
```

### Hybrid JavaScript Skill
```
plugins/
└── advanced-workflow-skill.js  (has setup() function)

.claude/skills/
└── advanced-workflow/
    └── SKILL.md  (exported version for Claude Code compatibility)
```

### Conversion Flow
```
JavaScript Plugin Skill
         ↓
    (export utility)
         ↓
      SKILL.md  ←→  Works in Claude Code
         ↓
  (skill-md-loader)
         ↓
    FixiPlug Skill Registry
```

## Skill Registry Unification

Both formats register to the same skill registry:

```javascript
// JavaScript plugin
ctx.registerSkill('reactive-ui-patterns', {
  name: 'reactive-ui-patterns',
  description: '...',
  instructions: '...',
  metadata: { source: 'plugin' }
});

// SKILL.md loader
ctx.registerSkill('django-workflows', {
  name: 'django-workflows',
  description: '...',
  instructions: '...',
  metadata: { source: 'skill-md', filePath: '...' }
});

// Both appear in api:getSkillsManifest
const manifest = await fixiplug.dispatch('api:getSkillsManifest');
// {
//   skills: [
//     { name: 'reactive-ui-patterns', source: 'plugin', ... },
//     { name: 'django-workflows', source: 'skill-md', ... }
//   ]
// }
```

## Recommendation

**Implement hybrid support in this order:**

1. **Phase 1** (1-2 hours): Create skill-md-loader plugin
2. **Phase 2** (1 hour): Create export utility
3. **Phase 3** (1 hour): Add tests and documentation
4. **Phase 4** (optional): Migrate purely declarative skills to SKILL.md

**Leave existing JavaScript skills unchanged** - they work perfectly and provide advanced capabilities that SKILL.md cannot match.

This approach gives FixiPlug users the flexibility to choose the right format for their use case while maintaining compatibility with Claude Code's ecosystem.
