import path from 'path';

export default [
  {
    extends: './vitest.config.ts',
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['packages/renderer/src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'landing',
      environment: 'jsdom',
      include: ['packages/landing/src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'main',
      environment: 'node',
      include: ['packages/main/src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'shared',
      environment: 'node',
      include: ['packages/shared/src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'firebase',
      environment: 'node',
      include: [
        'packages/firebase/src/**/*.{test,spec}.{ts,tsx}',
      ],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**', 'packages/firebase/src/test/security/**'],
      setupFiles: [path.resolve(import.meta.dirname, './packages/firebase/src/test/setup.ts')],
      hookTimeout: 30000,
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'sdk',
      environment: 'node',
      include: ['packages/sdk/src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'admin-dashboard',
      environment: 'jsdom',
      include: [
        'packages/admin-dashboard/**/*.{test,spec}.{ts,tsx}',
        'packages/admin-dashboard/src/**/*.{test,spec}.{ts,tsx}',
      ],
      exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
      // The root config's setupFiles mock Firebase client SDKs and jsdom globals
      // for the renderer; admin-dashboard uses firebase-admin (server-side) and
      // its own React tree, neither of which needs that mock surface.
      setupFiles: [],
    }
  },
];
