import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: 'html',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [
    tsconfigPaths({ projects: [path.resolve(__dirname, 'tsconfig.json')], ignoreConfigErrors: true })
  ],
  test: {
    root: '.',               // project root for tests
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    reporters: ['default', 'html'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      exclude: [
        'plugin.ts',
        'scripts/**',
        'examples.txt',
        'html/**',
        'plugin-manifest.schema.json',
        'fixi.d.ts',
        'dist/**',
        'node_modules/**'
      ],
      branches: 60,
      functions: 60,
      lines: 60
    }
  }
});