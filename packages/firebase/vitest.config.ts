import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      ARCJET_KEY: 'ajkey_test_key_integration',
    },
  },
});
