
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/services/agent/SchemaLockTest.test.ts', 'src/services/agent/AgentDefinitions.test.ts'],
        // Attempt to bypass EPERM by moving cache out of node_modules
        cache: {
            dir: '/tmp/vitest-cache'
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@agents': path.resolve(__dirname, './agents')
        }
    }
});
