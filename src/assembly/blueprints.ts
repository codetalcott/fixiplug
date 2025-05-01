export const PRESETS = {
    minimal: {
      plugins: 'none',
      format: 'esm',
      minify: true,
    },
    recommended: {
      plugins: ['cache', 'loading', 'analytics'],
      format: 'esm',
      minify: true,
    },
    full: {
      plugins: 'all',
      format: 'esm',
      minify: true,
    },
    legacy: {
      plugins: ['cache', 'loading'],
      format: 'umd',
      target: 'es2015',
      minify: true,
    }
  };