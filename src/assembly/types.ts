/**
 * Type definitions for the Fixi.js assembly system
 */

/**
 * Statistics about an individual spoke (plugin)
 */
export interface PlugStats {
    /** The name of the plug/plugin */
    name: string;
    /** Size in kilobytes */
    size: number;
    /** Original file path */
    path: string;
    /** Dependencies on other plugs, if any */
    dependencies?: string[];
  }
  
  /**
   * Detailed size and performance statistics for a bundle
   */
  export interface BundleStats {
    /** Total bundle size in kilobytes */
    totalSize: number;
    /** Size of the core in kilobytes */
    coreSize: number;
    /** Size of the hub (plugin system) in kilobytes */
    hubSize: number;
    /** Size of all plug components (plugins) in kilobytes */
    plugsSize: number;
    /** Estimated file size after gzip compression */
    gzippedSize: number;
    /** Information about individual spokes included in the bundle */
    plugs: PlugStats[];
    /** Estimated startup time in milliseconds (if available) */
    startupTimeEstimate?: number;
    /** Estimated memory usage in kilobytes (if available) */
    memoryEstimate?: number;
  }
  
  /**
   * Format options for bundle output
   */
  export type BundleFormat = 'esm' | 'umd' | 'iife' | 'cjs';
  
  /**
   * Configuration options for bundle creation
   */
  export interface BundleOptions {
    /** Output format for the bundle */
    format: BundleFormat;
    /** Plugins to include: specific list, 'none', or 'all' */
    plugs: string[] | 'none' | 'all';
    /** Whether to minify the output */
    minify: boolean;
    /** Whether to generate sourcemaps */
    sourcemap: boolean;
    /** Whether to perform tree-shaking */
    treeshake: boolean;
    /** ECMAScript target */
    target: 'es2015' | 'es2017' | 'es2020' | 'esnext';
    /** Directory to write output files */
    outputDir: string;
    /** Custom filename (optional) */
    filename?: string;
    /** Custom banner text (optional) */
    banner?: string;
    /** Custom footer text (optional) */
    footer?: string;
  }
  
  /**
   * The result of a successful bundle operation
   */
  export interface BundleResult {
    /** Path to the generated bundle file */
    outputPath: string;
    /** Detailed statistics about the bundle */
    stats: BundleStats;
    /** Any warnings encountered during bundling */
    warnings?: string[];
    /** Error during bundling (if any) */
    error?: Error;
  }
  
  /**
   * Options for generating multiple bundles at once
   */
  export interface MultiBundleOptions extends Omit<BundleOptions, 'format'> {
    /** List of formats to generate */
    formats: BundleFormat[];
  }