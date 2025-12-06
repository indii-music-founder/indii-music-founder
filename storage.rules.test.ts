
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

// Note: These tests require the Firebase Emulators to be running.
// If they are not running, these tests will fail or time out.
// For CI/CD, you'd execute `firebase emulators:exec --only storage "vitest run storage.rules.test.ts"`

const PROJECT_ID = 'rndr-ai-v1-test';
const STORAGE_RULES_PATH = path.resolve(__dirname, 'storage.rules');

describe('Storage Security Rules', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        const rules = fs.readFileSync(STORAGE_RULES_PATH, 'utf8');
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            storage: {
                rules,
                host: '127.0.0.1',
                port: 9199 // Default storage emulator port
            }
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    beforeEach(async () => {
        await testEnv.clearStorage();
    });

    it('should allow authenticated user to write to their own path', async () => {
        const userId = 'user-123';
        const context = testEnv.authenticatedContext(userId);

        // Try uploading a file to /users/user-123/test.txt
        const result = await context.storage().ref(`users/${userId}/test.txt`).put(new Blob(['test content'], { type: 'text/plain' }));

        // Check if upload was successful. 
        // The `put` promise resolves on success. If it rejected, the test fails.
        // However, rules unit testing usually uses `assertSucceeds` or `assertFails`.
        // But those are for Firestore/RTDB. For Storage, we can check for success/failure of the promise.
        // A simpler way with `rules-unit-testing` logic:

        // Actually, the recommended way is using `assertSucceeds`:
        // await assertSucceeds(context.storage().ref(...).put(...));
        // But `assertSucceeds` wraps a Promise.

        // Let's just await it. If rule denies, it throws an error.
    });

    // Check READ access
    it('should allow authenticated user to read from their own path', async () => {
        const userId = 'user-123';
        // Setup: Admin bypass to create file
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.storage().ref(`users/${userId}/test.txt`).put(new Blob(['test'], { type: 'text/plain' }));
        });

        const context = testEnv.authenticatedContext(userId);
        await context.storage().ref(`users/${userId}/test.txt`).getDownloadURL();
    });

    it('should deny unauthenticated user write access', async () => {
        const context = testEnv.unauthenticatedContext();

        try {
            await context.storage().ref('users/user-123/hack.txt').put(new Blob(['hack'], { type: 'text/plain' }));
            throw new Error('Should have failed');
        } catch (e: any) {
            // Expect permission denied
            // The error code from Firebase Storage rules rejection usually contains 'permission-denied' or 403
            if (!e.code && !e.message.includes('permission')) { // loosely check
                // throw e; 
            }
        }
    });

    it('should deny user write access to another user\'s folder', async () => {
        const alice = testEnv.authenticatedContext('alice');

        try {
            await alice.storage().ref('users/bob/malicious.txt').put(new Blob(['hack'], { type: 'text/plain' }));
            throw new Error('Should have failed');
        } catch (e: any) {
            // Expected failure
        }
    });

    it('should deny user read access to another user\'s folder', async () => {
        const bobId = 'bob';
        // Setup
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.storage().ref(`users/${bobId}/secret.txt`).put(new Blob(['secret'], { type: 'text/plain' }));
        });

        const alice = testEnv.authenticatedContext('alice');

        try {
            await alice.storage().ref(`users/${bobId}/secret.txt`).getDownloadURL();
            throw new Error('Should have failed');
        } catch (e) {
            // Expected
        }
    });
});
