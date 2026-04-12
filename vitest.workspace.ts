export default [
  {
    extends: './vitest.config.ts',
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['packages/renderer/src/**/*.{test,spec}.{ts,tsx}'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'main',
      environment: 'node',
      include: ['packages/main/src/**/*.{test,spec}.{ts,tsx}'],
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'shared',
      environment: 'node',
      include: ['packages/shared/src/**/*.{test,spec}.{ts,tsx}'],
    }
  }
];
