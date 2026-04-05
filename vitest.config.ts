import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@agents': path.resolve(import.meta.dirname, './agents'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(import.meta.dirname, './src/test/setup.ts')],
    clearMocks: true,
    restoreMocks: true,
    environmentOptions: {
      url: 'http://localhost/'
    },
    watch: false,
    reporters: ['default', 'github-actions'],
    teardownTimeout: 1000,
    hookTimeout: 10000,
    pool: 'forks',
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      '**/functions/**',
      // Monorepo workspace packages — run tests from src/ only until migration finalized
      '**/packages/**',
      '**/landing-page/**',
      '**/_archive_pre_monorepo/**',
      // Skip integration tests - they trigger deep module chains
      '**/*.integration.test.ts',
      '**/*.integration.test.tsx',
      // Skip torture tests
      '**/*.torture.test.ts',
      // Skip tests requiring Firebase emulator
      'firestore.rules.test.ts',
      'storage.rules.test.ts',
      'A2UI/**',
      '**/.claude/**',
    ],
    // Item 282: Coverage thresholds — build fails if coverage drops below these
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/types/**',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        branches: 60,
        functions: 50,
        lines: 50,
        statements: 50,
        perFile: true,
      },
    },
  },
});
