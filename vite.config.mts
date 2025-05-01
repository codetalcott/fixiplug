import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    reporters: ['default', 'html'],
    coverage: {
      enabled: true,
      reporter: ['text', 'html'],
      all: true
    }
  }
});