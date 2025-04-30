#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import inquirer from 'inquirer';

interface PluginManifest {
  name: string;
  version: string;
  apiVersion: string;
  main: string;
  priority?: number;
  dependencies?: string[];
  description?: string;
  author?: string;
  timeouts?: Record<string, number>;
  circuitBreaker?: { failureThreshold: number; resetTimeout: number };
}

async function promptManifest(): Promise<PluginManifest> {
  const questions: inquirer.QuestionCollection = [
    { name: 'name', message: 'Plugin name', type: 'input', validate: (v: any) => v ? true : 'Required' },
    { name: 'version', message: 'Version', type: 'input', default: '1.0.0' },
    { name: 'apiVersion', message: 'API Version', type: 'input', default: '2.0.0' },
    { name: 'main', message: 'Entry file (relative)', type: 'input', default: (answers: any) => `plugins/${answers.name}.ts` },
    { name: 'priority', message: 'Priority (integer)', type: 'number', default: 0 },
    { name: 'dependencies', message: 'Dependencies (comma-separated)', type: 'input', filter: (v: string) => v.split(',').map((s: string) => s.trim()).filter(Boolean) },
    { name: 'description', message: 'Description', type: 'input' },
    { name: 'author', message: 'Author', type: 'input' },
    { name: 'timeouts', message: 'Timeouts (json)', type: 'input', default: '{}', filter: (v: string) => JSON.parse(v) },
    { name: 'circuitBreaker', message: 'CircuitBreaker (json)', type: 'input', default: '{}', filter: (v: string) => JSON.parse(v) }
  ];
  const answers = await inquirer.prompt(questions);
  return answers as PluginManifest;
}

async function main() {
  const args = process.argv.slice(2);
  let manifest: PluginManifest;
  let manifestFile: string | undefined;

  const interactive = args.includes('--interactive') || args.includes('-i');
  if (interactive) {
    manifest = await promptManifest();
  } else {
    manifestFile = args[0];
    if (!manifestFile) {
      console.error('Usage: generate-plugin <plugin-manifest.json> [--interactive]');
      process.exit(1);
    }
    const manifestPath = path.resolve(manifestFile);
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  // Validate manifest against schema
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../plugin-manifest.schema.json'), 'utf8'));
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  if (!validate(manifest)) {
    console.error('Manifest validation errors:', validate.errors);
    process.exit(1);
  }

  // Ensure required fields
  for (const key of ['name', 'version', 'apiVersion', 'main']) {
    if (!(manifest as any)[key]) {
      console.error(`Manifest missing required field: ${key}`);
      process.exit(1);
    }
  }

  // Determine output file
  const outputPath = path.resolve(manifest.main.startsWith('.') ? manifest.main : `plugins/${manifest.name}.ts`);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const stub = `import { createPlugin, FixiPlugin, PluginHook, RequestPluginContext, DomPluginContext } from '../plugin';

// Plugin generated from manifest ${manifestFile ? path.basename(manifestFile) : 'interactive input'}
export default createPlugin<FixiPlugin>({
  name: '${manifest.name}',
  version: '${manifest.version}',
  apiVersion: '${manifest.apiVersion}',
  ${manifest.priority !== undefined ? `priority: ${manifest.priority},` : ''}
  ${manifest.dependencies ? `dependencies: ${JSON.stringify(manifest.dependencies)},` : ''}
  ${manifest.description ? `description: '${manifest.description}',` : ''}
  ${manifest.author ? `author: '${manifest.author}',` : ''}
  ${manifest.timeouts ? `timeouts: ${JSON.stringify(manifest.timeouts)},` : ''}
  ${manifest.circuitBreaker ? `circuitBreaker: ${JSON.stringify(manifest.circuitBreaker)},` : ''}

  // Hook implementations
  onInitialize(ctx) {
    // TODO: initialization logic
  },

  beforeRequest(ctx: RequestPluginContext) {
    // TODO: modify ctx.config as needed
    return ctx.config;
  },

  afterResponse(ctx: RequestPluginContext) {
    // TODO: process ctx.response as needed
    return ctx.response!;
  },

  onDomMutated(ctx: DomPluginContext) {
    // TODO: handle DOM mutations
  },

  onError(ctx: RequestPluginContext) {
    // TODO: error handling logic
  },

  onDestroy(ctx) {
    // TODO: cleanup logic
  }
});
`;

  fs.writeFileSync(outputPath, stub, 'utf8');
  console.info(`Plugin stub created at ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
