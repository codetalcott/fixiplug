#!/usr/bin/env node

/**
 * Export SQLite plugin skills to SKILL.md format
 *
 * This utility exports all 4 SQLite plugins to .claude/skills/ directory.
 */

import { exportSkillToMd } from './export-skill-to-md.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('Exporting SQLite Plugin Skills to SKILL.md Format');
  console.log('='.repeat(60));

  const outputDir = path.join(projectRoot, '.claude', 'skills');
  const pluginsToExport = [
    'sqlite-pattern-learner.js',
    'sqlite-extension-generator.js',
    'sqlite-agent-amplification.js',
    'sqlite-agent-context.js'
  ];

  const results = [];

  for (const pluginFile of pluginsToExport) {
    try {
      console.log(`\nExporting: ${pluginFile}`);

      // Import the plugin
      const pluginPath = path.join(projectRoot, 'plugins', pluginFile);
      const plugin = await import(pluginPath);
      const pluginDefault = plugin.default;

      if (!pluginDefault.skill) {
        console.warn(`  ⚠ Plugin ${pluginFile} has no skill property, skipping`);
        continue;
      }

      // Export to SKILL.md
      const mdPath = await exportSkillToMd(pluginDefault.skill, outputDir);

      console.log(`  ✓ Exported to: ${path.relative(projectRoot, mdPath)}`);
      results.push({
        plugin: pluginFile,
        skill: pluginDefault.skill.name,
        path: mdPath,
        success: true
      });
    } catch (error) {
      console.error(`  ✗ Failed to export ${pluginFile}:`, error.message);
      results.push({
        plugin: pluginFile,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Export Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`  ✓ ${r.skill} (${r.plugin})`);
  });

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`  ✗ ${r.plugin}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(successful.length === results.length ? '✓ All exports completed successfully!' : '⚠ Some exports failed');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
