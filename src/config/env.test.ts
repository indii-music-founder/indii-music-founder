import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.unstubAllGlobals();
    });

    it('should prioritize environment variables for Firebase API Key', async () => {
        // Set up the environment variable
        process.env.VITE_FIREBASE_API_KEY = 'test-env-api-key';
        process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
        process.env.VITE_FIREBASE_APP_ID = 'test-app-id';

        // Re-import the module to trigger evaluation
        const { firebaseConfig } = await import('./env');

        // This assertion will fail BEFORE the fix, proving the vulnerability/bug
        // because currently it is hardcoded.
        expect(firebaseConfig.apiKey).toBe('test-env-api-key');

        // Ensure the hardcoded key is NOT present (this is the Sentinel check)
        expect(firebaseConfig.apiKey).not.toContain('AIzaSy');
    });
});
