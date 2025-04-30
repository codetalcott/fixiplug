#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

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

async function main() {
  const [,, manifestFile] = process.argv;
  if (!manifestFile) {
    console.error('Usage: generate-plugin <plugin-manifest.json>');
    process.exit(1);
  }

  const manifestPath = path.resolve(manifestFile);
  const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

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

// Plugin generated from manifest ${path.basename(manifestFile)}
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
