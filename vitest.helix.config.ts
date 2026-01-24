
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
        'src/services/agent/evolution/HelixMutationSafety.test.ts',
        'src/services/agent/evolution/HelixGeminiMutation.test.ts'
    ],
  },
});
