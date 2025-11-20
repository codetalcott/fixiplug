#!/usr/bin/env node

/**
 * Export FixiPlug JavaScript Skills to SKILL.md Format
 *
 * This utility converts FixiPlug JavaScript plugin skills to Claude Code-compatible
 * SKILL.md format, enabling portability between both ecosystems.
 *
 * Usage:
 *   # Export all skills
 *   node utils/export-skill-to-md.js
 *
 *   # Export to specific directory
 *   node utils/export-skill-to-md.js --output .claude/skills
 *
 *   # Export specific skill
 *   node utils/export-skill-to-md.js --skill reactive-ui-patterns
 *
 *   # Use as module
 *   import { exportSkillToMd } from './utils/export-skill-to-md.js';
 *   await exportSkillToMd(skill, '.claude/skills');
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { stringify as stringifyYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export a skill object to SKILL.md format
 *
 * @param {Object} skill - Skill object from FixiPlug
 * @param {string} outputDir - Output directory for SKILL.md files
 * @returns {Promise<string>} Path to created SKILL.md file
 *
 * @example
 * const skill = {
 *   name: 'reactive-ui-patterns',
 *   description: 'Best practices for reactive UI patterns',
 *   instructions: '# Reactive UI Patterns\n\n...',
 *   tags: ['ui', 'reactive'],
 *   version: '1.0.0'
 * };
 *
 * const mdPath = await exportSkillToMd(skill, '.claude/skills');
 * console.log(`Exported to: ${mdPath}`);
 */
export async function exportSkillToMd(skill, outputDir) {
  if (!skill || !skill.name) {
    throw new Error('Invalid skill object: missing name');
  }

  if (!skill.description) {
    throw new Error(`Skill '${skill.name}' missing required field: description`);
  }

  if (!skill.instructions) {
    throw new Error(`Skill '${skill.name}' missing required field: instructions`);
  }

  // Build frontmatter object
  const frontmatter = {
    name: skill.name,
    description: skill.description
  };

  // Add optional fields if present
  if (skill.tags && skill.tags.length > 0) {
    frontmatter.tags = skill.tags;
  }

  if (skill.version) {
    frontmatter.version = skill.version;
  }

  if (skill.level) {
    frontmatter.level = skill.level;
  }

  if (skill.author) {
    frontmatter.author = skill.author;
  }

  if (skill.references && skill.references.length > 0) {
    frontmatter.references = skill.references;
  }

  // Handle allowed-tools from metadata
  if (skill.metadata?.allowedTools) {
    frontmatter['allowed-tools'] = skill.metadata.allowedTools;
  }

  // Create SKILL.md content
  const yamlContent = stringifyYaml(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN'
  });

  const content = `---
${yamlContent.trim()}
---

${skill.instructions}
`;

  // Create skill directory
  const skillDir = path.join(outputDir, skill.name);
  await fs.mkdir(skillDir, { recursive: true });

  // Write SKILL.md
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(skillMdPath, content, 'utf8');

  return skillMdPath;
}

/**
 * Export all skills from a FixiPlug instance
 *
 * @param {Object} fixiplug - FixiPlug instance
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object>} Export results
 */
export async function exportAllSkills(fixiplug, outputDir) {
  const results = {
    exported: [],
    failed: []
  };

  try {
    // Get skills manifest
    const manifest = await fixiplug.dispatch('api:getSkillsManifest', {});

    if (!manifest || !manifest.skills || manifest.skills.length === 0) {
      return {
        ...results,
        message: 'No skills found'
      };
    }

    // Export each skill
    for (const skillMeta of manifest.skills) {
      try {
        // Get full skill details
        const result = await fixiplug.dispatch('api:getSkill', {
          skillName: skillMeta.skill.name
        });

        if (!result.success) {
          results.failed.push({
            name: skillMeta.skill.name,
            error: result.error
          });
          continue;
        }

        // Export to SKILL.md
        const mdPath = await exportSkillToMd(result.skill, outputDir);

        results.exported.push({
          name: result.skill.name,
          path: mdPath,
          source: result.pluginName
        });

      } catch (error) {
        results.failed.push({
          name: skillMeta.skill.name,
          error: error.message
        });
      }
    }

  } catch (error) {
    throw new Error(`Failed to export skills: ${error.message}`);
  }

  return results;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let outputDir = '.claude/skills';
  let specificSkill = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--skill' && args[i + 1]) {
      specificSkill = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Export FixiPlug Skills to SKILL.md Format

Usage:
  node utils/export-skill-to-md.js [options]

Options:
  --output <dir>   Output directory (default: .claude/skills)
  --skill <name>   Export specific skill only
  --help, -h       Show this help message

Examples:
  # Export all skills
  node utils/export-skill-to-md.js

  # Export to custom directory
  node utils/export-skill-to-md.js --output ~/my-skills

  # Export specific skill
  node utils/export-skill-to-md.js --skill reactive-ui-patterns
      `);
      process.exit(0);
    }
  }

  console.log('='.repeat(60));
  console.log('FixiPlug Skill Export Utility');
  console.log('='.repeat(60));
  console.log();

  // Load FixiPlug
  const { createFixiplug } = await import('../builder/fixiplug-factory.js');

  // Import all skill plugins
  const reactiveUiPatternsSkill = (await import('../plugins/reactive-ui-patterns-skill.js')).default;
  const djangoWorkflowsSkill = (await import('../plugins/django-workflows-skill.js')).default;
  const errorRecoverySkill = (await import('../plugins/error-recovery-skill.js')).default;
  const formWorkflowsSkill = (await import('../plugins/form-workflows-skill.js')).default;
  const introspectionPlugin = (await import('../plugins/introspection.js')).default;

  // Create fixiplug instance
  const fixiplug = createFixiplug({ features: [] });
  fixiplug.use(introspectionPlugin);
  fixiplug.use(reactiveUiPatternsSkill);
  fixiplug.use(djangoWorkflowsSkill);
  fixiplug.use(errorRecoverySkill);
  fixiplug.use(formWorkflowsSkill);

  try {
    if (specificSkill) {
      // Export specific skill
      console.log(`Exporting skill: ${specificSkill}`);
      console.log(`Output directory: ${outputDir}`);
      console.log();

      const result = await fixiplug.dispatch('api:getSkill', {
        skillName: specificSkill
      });

      if (!result.success) {
        console.error(`Error: ${result.error}`);
        if (result.availableSkills) {
          console.log('\nAvailable skills:');
          result.availableSkills.forEach(s => console.log(`  - ${s}`));
        }
        process.exit(1);
      }

      const mdPath = await exportSkillToMd(result.skill, outputDir);
      console.log(`✓ Exported: ${result.skill.name}`);
      console.log(`  Path: ${mdPath}`);

    } else {
      // Export all skills
      console.log('Exporting all skills...');
      console.log(`Output directory: ${outputDir}`);
      console.log();

      const results = await exportAllSkills(fixiplug, outputDir);

      if (results.exported.length > 0) {
        console.log(`✓ Exported ${results.exported.length} skill(s):`);
        results.exported.forEach(s => {
          console.log(`  - ${s.name}`);
          console.log(`    Path: ${s.path}`);
          console.log(`    Source: ${s.source}`);
        });
      }

      if (results.failed.length > 0) {
        console.log();
        console.log(`✗ Failed to export ${results.failed.length} skill(s):`);
        results.failed.forEach(f => {
          console.log(`  - ${f.name}: ${f.error}`);
        });
      }

      if (results.message) {
        console.log(results.message);
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Export complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
