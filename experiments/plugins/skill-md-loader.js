/**
 * SKILL.md Loader Plugin
 *
 * Loads Claude Code-compatible SKILL.md files and registers them as FixiPlug skills.
 * This enables hybrid skill support: both JavaScript plugins and declarative SKILL.md files.
 *
 * Locations:
 * - Project skills: .claude/skills/ (git-committed, team-shared)
 * - Personal skills: ~/.claude/skills/ (user-specific)
 *
 * SKILL.md Format:
 * ```markdown
 * ---
 * name: skill-name
 * description: Brief description
 * tags:
 *   - tag1
 *   - tag2
 * version: 1.0.0
 * ---
 * # Skill Name
 *
 * ## Instructions
 * ...
 * ```
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { registerSkill } from '../core/hooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Module-level cache for loaded skills
const skillsCache = {
  skills: [],
  errors: [],
  locations: []
};

/**
 * Load skills from a directory (synchronous)
 */
function loadSkillsFromDirectory(dirPath, source) {
  const skills = [];

  try {
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return skills;
    }

    // Read directory entries
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');

        try {
          if (!fs.existsSync(skillMdPath)) {
            continue;
          }

          const content = fs.readFileSync(skillMdPath, 'utf8');
          const skill = parseSkillMd(content, skillMdPath, source);

          skills.push({
            skill,
            source,
            path: skillMdPath
          });

        } catch (err) {
          if (process.env.DEBUG) {
            console.warn(`[SkillMdLoader] Failed to parse ${skillMdPath}:`, err.message);
          }
        }
      }
    }

  } catch (err) {
    // Directory read error, skip
  }

  return skills;
}

/**
 * Parse SKILL.md file content
 */
function parseSkillMd(content, filePath, source) {
  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);

  if (!frontmatterMatch) {
    throw new Error(`Invalid SKILL.md format (missing frontmatter): ${filePath}`);
  }

  let frontmatter;
  try {
    frontmatter = parseYaml(frontmatterMatch[1]);
  } catch (err) {
    throw new Error(`Invalid YAML frontmatter in ${filePath}: ${err.message}`);
  }

  const instructions = frontmatterMatch[2].trim();

  // Validate required fields
  if (!frontmatter.name) {
    throw new Error(`Missing required field 'name' in ${filePath}`);
  }

  if (!frontmatter.description) {
    throw new Error(`Missing required field 'description' in ${filePath}`);
  }

  // Validate name format (lowercase, hyphens, numbers only)
  if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
    throw new Error(`Invalid skill name '${frontmatter.name}' in ${filePath}. Must use lowercase letters, numbers, and hyphens only.`);
  }

  if (frontmatter.name.length > 64) {
    throw new Error(`Skill name '${frontmatter.name}' exceeds 64 characters in ${filePath}`);
  }

  if (frontmatter.description.length > 1024) {
    throw new Error(`Skill description exceeds 1024 characters in ${filePath}`);
  }

  // Return skill object in FixiPlug format
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    instructions,
    tags: frontmatter.tags || [],
    version: frontmatter.version || '1.0.0',
    level: frontmatter.level || 'intermediate',
    references: frontmatter.references || [],
    author: frontmatter.author || 'FixiPlug Team',
    metadata: {
      source: 'skill-md',
      sourceLocation: source,
      filePath,
      allowedTools: frontmatter['allowed-tools'] || undefined
    }
  };
}

/**
 * Load skills from all locations (called at module load time)
 */
function loadAllSkills() {
  const locations = [
    {
      name: 'project',
      path: path.join(process.cwd(), '.claude/skills')
    },
    {
      name: 'personal',
      path: path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude/skills')
    }
  ];

  skillsCache.locations = locations;
  skillsCache.skills = [];
  skillsCache.errors = [];

  for (const location of locations) {
    try {
      const skills = loadSkillsFromDirectory(location.path, location.name);
      skillsCache.skills.push(...skills);
    } catch (error) {
      skillsCache.errors.push({
        location: location.name,
        path: location.path,
        error: error.message
      });
    }
  }
}

// Load skills when module is imported
loadAllSkills();

/**
 * SKILL.md Loader Plugin
 */
export default {
  name: 'skillMdLoader',

  /**
   * Setup function - registers previously loaded skills
   */
  setup(ctx) {
    // Register all skills that were loaded at module import time
    for (const skillData of skillsCache.skills) {
      const virtualPluginName = `skillMd:${skillData.skill.name}`;
      registerSkill(virtualPluginName, skillData.skill);
    }

    // Log summary
    if (skillsCache.skills.length > 0) {
      console.log(`[SkillMdLoader] Registered ${skillsCache.skills.length} SKILL.md file(s):`);
      for (const skillData of skillsCache.skills) {
        console.log(`  - ${skillData.skill.name} (${skillData.source})`);
      }
    }

    if (skillsCache.errors.length > 0 && process.env.DEBUG) {
      console.log(`[SkillMdLoader] Warnings:`, skillsCache.errors);
    }

    // API: Reload skills from SKILL.md files
    ctx.on('api:reloadSkillMd', (event) => {
      // Reload synchronously
      loadAllSkills();

      // Re-register
      for (const skillData of skillsCache.skills) {
        const virtualPluginName = `skillMd:${skillData.skill.name}`;
        registerSkill(virtualPluginName, skillData.skill);
      }

      return {
        success: true,
        reloaded: skillsCache.skills.length,
        skills: skillsCache.skills.map(s => s.skill.name),
        errors: skillsCache.errors
      };
    });

    // API: Get SKILL.md loader stats
    ctx.on('api:getSkillMdStats', () => {
      return {
        loaded: skillsCache.skills.length,
        skills: skillsCache.skills.map(s => ({
          name: s.skill.name,
          source: s.source,
          path: s.path
        })),
        locations: skillsCache.locations.map(l => l.path),
        errors: skillsCache.errors
      };
    });
  }
};
