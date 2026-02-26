import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
            '@agents': path.resolve(import.meta.dirname, './agents'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [path.resolve(import.meta.dirname, './src/test/setup.ts')],
        clearMocks: true,
        restoreMocks: true,
        watch: false,
        pool: 'forks',
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp,claude}/**',
            '**/*.config.*',
            '**/e2e/**',
            '**/functions/**',
            'A2UI/**'
        ],
    },
});
