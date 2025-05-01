import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';
import { configDefaults } from 'vitest/config';

// Determine __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  // Use project root when running tests so TS in src/ is transformed
  root: mode === 'test' ? '.' : 'html',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [
    tsconfigPaths({ projects: [path.resolve(__dirname, 'tsconfig.json')], ignoreConfigErrors: true })
  ],
  test: {
    // transform TS files with esbuild before running tests
    transform: { '^.+\\.[jt]s$': 'esbuild' },
    // ensure tests and all src TS get transformed for both web and SSR contexts
    transformMode: { web: [/\.[jt]s$/], ssr: [/\.[jt]s$/] },
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
}));