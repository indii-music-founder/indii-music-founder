import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration — post-monorepo migration.
 *
 * Tests run from packages/renderer/src/ as the canonical source.
 * The `src/` symlink → `packages/renderer/src/` preserves backward
 * compatibility with open editors and other agents.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './packages/renderer/src'),
      '@agents': path.resolve(import.meta.dirname, './agents'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(import.meta.dirname, './packages/renderer/src/test/setup.ts')],
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
    // Test discovery: scan packages/renderer/src/ for test files
    include: ['packages/renderer/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      // Non-renderer workspace packages (they have their own test configs)
      '**/packages/main/**',
      '**/packages/firebase/**',
      '**/packages/shared/**',
      '**/packages/landing/**',
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
      include: ['packages/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/renderer/src/test/**',
        'packages/renderer/src/**/*.test.{ts,tsx}',
        'packages/renderer/src/**/*.d.ts',
        'packages/renderer/src/types/**',
        'packages/renderer/src/vite-env.d.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 60,
        lines: 60,
        statements: 60,
        perFile: true,
      },
    },
  },
});
