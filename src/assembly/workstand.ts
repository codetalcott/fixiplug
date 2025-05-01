#!/usr/bin/env ts-node

import { program } from 'commander';
import inquirer from 'inquirer';
import { createBundle } from './builder';
import { PRESETS } from './blueprints';
import fs from 'fs';
import path from 'path';
import { reportBundleStats } from './toolbox';
import { BundleOptions } from './types';

// Implementation of interactive CLI

// CLI setup for bundling
program
  .name('fixi-assembly')
  .description('CLI for creating Fixi.js bundles')
  .argument('[preset]', 'bundle preset to use', 'recommended')
  .action(async (preset: string) => {
    const presetOpts = PRESETS[preset as keyof typeof PRESETS];
    if (!presetOpts) {
      console.error(`Unknown preset: ${preset}`);
      process.exit(1);
    }
    try {
      const result = await createBundle({
        ...presetOpts,
        format: presetOpts.format as BundleOptions['format'],
        target: 'target' in presetOpts ? (presetOpts.target as BundleOptions['target']) : undefined,
      });
      reportBundleStats(result);
    } catch (err) {
      console.error('Error creating bundle:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);