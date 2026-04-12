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
    }
  },
];
