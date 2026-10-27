import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      ARCJET_KEY: 'ajkey_test_key_integration',
      FIREBASE_CONFIG: '{"storageBucket":"test.appspot.com","projectId":"test-project"}',
    },
  },
});
