// src/assembly/toolbox.ts
import { BundleResult } from './types';
import chalk from 'chalk'; // For colorized terminal output

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
 * Other utility functions can be added here:
 * - calculateBundleStats()
 * - compressBundle()
 * - visualizeBundleComposition()
 * - etc.
 */