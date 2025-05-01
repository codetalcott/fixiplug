import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: 'html',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [tsconfigPaths()],
  test: {
    root: '../',
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    reporters: ['default', 'html'],
    coverage: {
      enabled: true,
      provider: 'v8',            // use v8 for coverage
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
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60
    }
  }
});