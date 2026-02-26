import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@agents': path.resolve(__dirname, './agents')
        },
        // Prevent parallel execution for this diagnostic run
        fileParallelism: false,
        maxWorkers: 1,
        forks: {
            singleFork: true
        }
    },
});
