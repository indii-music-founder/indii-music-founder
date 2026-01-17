import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@agents': path.resolve(__dirname, './agents'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'electron/handlers/agent_security.test.ts',
      'src/services/agent/AgentService.security.test.ts'
    ],
  },
});
