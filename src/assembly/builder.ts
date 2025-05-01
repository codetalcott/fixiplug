#!/usr/bin/env ts-node
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';  

import { BundleOptions, BundleResult } from './types';
import { getAllAvailablePlugins, createEntryFile, generateBanner, calculateBundleStats } from './toolbox';

export async function createBundle(options: Partial<BundleOptions>): Promise<BundleResult> {
  // Merge with defaults
  const config: BundleOptions = {
    format: options.format || 'esm',
    plugs: options.plugs || 'none',
    minify: options.minify ?? true,
    sourcemap: options.sourcemap ?? true,
    treeshake: options.treeshake ?? true,
    target: options.target || 'es2020',
    outputDir: options.outputDir || 'dist',
    filename: options.filename
  };
  
  // Determine plugins to include
  const pluginsToInclude: string[] = 
    config.plugs === 'none' ? [] :
    config.plugs === 'all' ? getAllAvailablePlugins() :
    Array.isArray(config.plugs) ? config.plugs : [];
  
  // Create entry file
  const entryFile = await createEntryFile(pluginsToInclude, config);
  
  // Build with esbuild
  const outputFilename = config.filename || 
    `fixi${pluginsToInclude.length ? '-with-plugins' : ''}.${config.format}.js`;
  const outputPath = path.join(config.outputDir, outputFilename);
  
  await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    format: config.format as 'esm' | 'cjs' | 'iife',
    minify: config.minify,
    sourcemap: config.sourcemap,
    target: config.target,
    outfile: outputPath,
    banner: { js: generateBanner(pluginsToInclude, config) },
  });
  
  // Clean up temp file
  fs.unlinkSync(entryFile);
  
  // Calculate bundle stats
  const stats = await calculateBundleStats(outputPath, pluginsToInclude);
  
  return {
    outputPath,
    stats
  };
}