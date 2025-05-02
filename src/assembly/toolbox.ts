// src/assembly/toolbox.ts
import { BundleResult } from './types';
import chalk from 'chalk'; // For colorized terminal output
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import type { BundleOptions, BundleStats } from './types';

/**
 * Reports detailed bundle statistics to the console
 * @param result The bundle result containing size metrics
 */
export function reportBundleStats(result: BundleResult): void {
  console.log(chalk.bold('\n📊 Bundle Statistics:'));
  console.table({
    'Total size': `${result.stats.totalSize} KB`,
    'Core size': `${result.stats.coreSize} KB`,
    'Hub size': `${result.stats.hubSize} KB`,
    'Plugs size': `${result.stats.plugsSize} KB`,
    'Gzipped size': `${result.stats.gzippedSize} KB`,
  });
  
  if (result.stats.plugs.length > 0) {
    console.log(chalk.bold('\n🚲 plug (Plugin) Breakdown:'));
    console.table(result.stats.plugs.map(p => ({
      name: p.name,
      size: `${p.size} KB`,
      percentage: `${(p.size / result.stats.totalSize * 100).toFixed(1)}%`
    })));
  }
  
  // Additional metrics that might be useful
  console.log(chalk.bold('\n⚡ Performance Impact:'));
  console.table({
    'Startup time estimate': `${result.stats.startupTimeEstimate || 'N/A'} ms`,
    'Memory footprint estimate': `${result.stats.memoryEstimate || 'N/A'} KB`,
  });
}

/**
 * Return all available plugin names by scanning the plugs directory.
 */
export function getAllAvailablePlugins(): string[] {
  const pluginsDir = path.resolve(__dirname, '../plugs');
  return fs.readdirSync(pluginsDir)
    .filter(file => file.endsWith('.ts') && file !== 'index.ts')
    .map(file => file.replace(/\.ts$/, ''));
}

/**
 * Generate temporary entry file that imports specified plugins and exports bundle entry.
 */
export async function createEntryFile(plugins: string[], config: BundleOptions): Promise<string> {
  const contentLines: string[] = [];
  contentLines.push('import { Fixi } from "../core/fixi";');
  contentLines.push('import { createPluginSystem } from "../hub/fixihub.js";');
  plugins.forEach(name => {
    contentLines.push(`import ${name}Plugin from "../plugs/${name}.ts";`);
  });
  contentLines.push('');
  contentLines.push('const fixi = createPluginSystem(new Fixi(), { plugins: [');
  contentLines.push(plugins.map(name => `${name}Plugin`).join(', '));
  contentLines.push('] });');
  contentLines.push('export default fixi;');

  const entryContent = contentLines.join('\n');
  const tmpDir = os.tmpdir();
  const entryFile = path.join(tmpDir, `fixi-entry-${Date.now()}.js`);
  fs.writeFileSync(entryFile, entryContent, 'utf8');
  return entryFile;
}

/**
 * Create a banner comment for the bundle including plugin list.
 */
export function generateBanner(plugins: string[], config: BundleOptions): string {
  const pluginList = plugins.length ? plugins.join(', ') : 'none';
  return `/* Fixi Bundle - format: ${config.format}, plugins: ${pluginList} */`;
}

/**
 * Calculate bundle statistics including size metrics.
 */
export async function calculateBundleStats(outputPath: string, plugins: string[]): Promise<BundleStats> {
  const stats: BundleStats = {
    totalSize: 0,
    coreSize: 0,
    hubSize: 0,
    plugsSize: 0,
    gzippedSize: 0,
    plugs: []
  };
  const fileBuffer = fs.readFileSync(outputPath);
  stats.totalSize = parseFloat((fileBuffer.length / 1024).toFixed(2));
  const gzipped = zlib.gzipSync(fileBuffer);
  stats.gzippedSize = parseFloat((gzipped.length / 1024).toFixed(2));
  // Basic plug size estimation
  const perPlugSize = stats.totalSize / (plugins.length || 1);
  stats.plugs = plugins.map(name => ({
    name,
    size: parseFloat(perPlugSize.toFixed(2)),
    path: name
  }));
  stats.plugsSize = parseFloat((stats.plugs.reduce((sum, p) => sum + p.size, 0)).toFixed(2));
  stats.coreSize = parseFloat((stats.totalSize - stats.plugsSize).toFixed(2));
  stats.hubSize = 0;
  return stats;
}

/**
 * Other utility functions can be added here:
 * - calculateBundleStats()
 * - compressBundle()
 * - visualizeBundleComposition()
 * - etc.
 */