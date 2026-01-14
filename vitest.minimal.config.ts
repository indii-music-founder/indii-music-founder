
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/services/agent/evolution/HelixBloat.test.ts'],
  },
});
