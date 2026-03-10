import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for Firestore Security Rules tests.
 * Uses Node environment (not jsdom) and requires the Firebase Emulator
 * to be running on localhost:8080.
 *
 * Run via: npm run test:rules
 * Which sets FIRESTORE_EMULATOR_HOST=localhost:8080 before invoking vitest.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/test/security/firestore.rules.test.ts'],
        // Rules tests are slow (emulator round-trips) — allow generous timeout
        testTimeout: 30000,
        hookTimeout: 30000,
        // Sequential: rules tests share a single TestEnvironment
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: true },
        },
    },
});
