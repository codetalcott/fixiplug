#!/usr/bin/env ts-node
import inquirer from 'inquirer';
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function main() {
  const pluginsDir = path.resolve(__dirname, '../plugins');
  const allFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.ts'));
  const choices = allFiles.map(f => ({ name: f.replace(/\.ts$/, ''), value: f }));

  const answers = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selected',
    message: 'Select plugins to include in bundle',
    choices,
  }]);

  const entryLines: string[] = [
    "import Fixi from '../fixi.js';",
    "import { createPluginSystem } from '../plugin.js';",
  ];
  answers.selected.forEach((file: string) => {
    const importName = file.replace(/\.ts$/, '');
    entryLines.push(`import { ${importName} } from '../plugins/${file}';`);
  });
  entryLines.push(
    'const fx = createPluginSystem(new Fixi({}), {',
    '  plugins: [' + answers.selected.map((f: string) => f.replace(/\.ts$/, '')).join(', ') + ']',
    '});',
    'export default fx;'
  );

  const tempEntry = path.resolve(__dirname, '.bundle-entry.ts');
  fs.writeFileSync(tempEntry, entryLines.join('\n'), 'utf8');

  // ensure output dir
  const outDir = path.resolve(__dirname, '../dist');
  fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [tempEntry],
    bundle: true,
    format: 'esm',
    outfile: path.join(outDir, 'fixi-bundle.js'),
    sourcemap: true,
    platform: 'browser',
    external: [],
  });

  fs.unlinkSync(tempEntry);
  console.info('Bundle created at dist/fixi-bundle.js');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});