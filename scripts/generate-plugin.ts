#!/usr/bin/env ts-node
// Ensure this script is run under ts-node
const isTsNode = process.argv[0].includes('ts-node');
if (!isTsNode) {
  console.error('Error: please invoke with ts-node, e.g. `npx ts-node scripts/generate-plugin.ts` or via `npm run generate:plugin`');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

interface PluginManifest {
  name: string;
  version: string;
  main: string;
  priority?: number;
  dependencies?: string[];
  description?: string;
  author?: string;
  timeouts?: Record<string, number>;
  circuitBreaker?: { failureThreshold: number; resetTimeout: number };
}

async function promptManifest(): Promise<PluginManifest> {
  const inquirer = (await import('inquirer')).default;
  // Step 1: ask minimal info
  const { name } = await inquirer.prompt([{ name: 'name', message: 'Plugin name (unique identifier)', type: 'input', validate: (v: any) => v ? true : 'Required' }]);
  // Build default manifest
  const defaultManifest: PluginManifest = {
    name,
    version: '1.0.0',
    main: `plugins/${name}.ts`,
    priority: 0,
    dependencies: [],
    description: '',
    author: '',
    timeouts: {}
  };
  // Confirm or customize
  const { useDefaults } = await inquirer.prompt([
    { name: 'useDefaults', message: 'Use defaults? (choose N to customize)', type: 'confirm', default: true }
  ]);
  if (useDefaults) {
    return defaultManifest;
  }
  // User chose to customize: open defaultManifest in editor
  const { edited } = await inquirer.prompt([
    { name: 'edited', message: 'Edit plugin manifest JSON:', type: 'editor', default: JSON.stringify(defaultManifest, null, 2) }
  ]);
  try {
    return JSON.parse(edited) as PluginManifest;
  } catch (e) {
    console.error('Error parsing JSON:', e);
    process.exit(1);
  }
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
  const { default: Ajv } = await import('ajv');
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

  const stub = `import type { FixiPlugs, PluginHook, RequestPluginContext, DomPluginContext } from '../hub';

// Plugin generated from manifest ${manifestFile ? path.basename(manifestFile) : 'interactive input'}
export const ${manifest.name.charAt(0).toUpperCase() + manifest.name.slice(1)}Plugin: FixiPlugs = {
  name: '${manifest.name}',
  version: '${manifest.version}',
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
};
`;

  fs.writeFileSync(outputPath, stub, 'utf8');
  console.info(`Plugin stub created at ${outputPath}`);
  console.info('Next, fill out the generated template with your plugin logic.');
  console.info('Then import and register your plugin in your application, for example:');
  console.info(`  import MyPlugin from '${path.relative(process.cwd(), outputPath).replace(/\\\\/g,'/')}';`);
  console.info('  fx.registerPlugin(MyPlugin);');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
