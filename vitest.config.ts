import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(import.meta.dirname, './src/test/setup.ts')],
    watch: false,
    reporters: ['default', 'github-actions'],
    teardownTimeout: 1000,
    pool: 'forks',
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      '**/functions/**',
    ]
  },
});
