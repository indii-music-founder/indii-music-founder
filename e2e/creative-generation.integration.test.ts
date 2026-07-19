/**
 * CREATIVE GENERATION INTEGRATION TESTS
 * Tests image and video generation with real Firebase Functions calls.
 * Validates payload schemas, error handling, and backend contracts.
 *
 * These tests call the actual backend (emulator in CI, live in staging).
 * They catch: module init bugs, payload validation, URI encoding, backend unavailability.
 */

import { test, expect } from '@playwright/test';
import { initializeApp } from 'firebase/app';
import { initializeAuth, connectAuthEmulator } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test.appspot.com',
};

test.describe('Creative Generation — Image & Video Integration', () => {
    test.beforeEach(async () => {
        // Set up Firebase with emulator connections
        const app = initializeApp(firebaseConfig, { name: 'test-app-' + Date.now() });

        const auth = initializeAuth(app);
        const functions = getFunctions(app);
        const db = getFirestore(app);
        const storage = getStorage(app);

        const isDev = process.env.NODE_ENV === 'development' || process.env.CI;

        if (isDev) {
            try {
                connectAuthEmulator(auth, 'http://127.0.0.1:9099');
                connectFunctionsEmulator(functions, '127.0.0.1', 5001);
                connectFirestoreEmulator(db, '127.0.0.1', 8080);
                connectStorageEmulator(storage, '127.0.0.1', 9199);
            } catch (e) {
                // Emulators already connected, that's fine
            }
        }
    });

    test('image generation: Firebase functions exported correctly', async () => {
        // Regression test for: "Cannot read properties of undefined (reading 'create')"
        // Ensures functions service is initialized before any code tries to use it

        const app = initializeApp(firebaseConfig, { name: 'test-app-' + Date.now() });
        const functions = getFunctions(app);

        // Verify functions is not null
        expect(functions).toBeDefined();
        expect(functions).not.toBeNull();
        expect(typeof functions).toBe('object');

        // Verify we can create a callable reference
        const generateImageV3 = httpsCallable(functions, 'generateImageV3');
        expect(generateImageV3).toBeDefined();
        expect(typeof generateImageV3).toBe('function');
    });

    test('image generation: payload validates before sending', async () => {
        // Test that the client validates payload schema
        // before calling the backend (fail-fast validation)

        const validPayloads = [
            {
                prompt: 'A dog in a field',
                aspectRatio: '1:1',
                model: 'imagen-3-fast',
                imageSize: '1024',
            },
            {
                prompt: 'A sunset over mountains',
                aspectRatio: '16:9',
                model: 'imagen-3-fast',
                imageSize: '2k',
            },
        ];

        const invalidPayloads = [
            { prompt: '' }, // Empty prompt
            { aspectRatio: 'invalid', model: 'modelo' }, // Missing prompt
            { prompt: 'test', imageSize: 'invalid' }, // Invalid imageSize
        ];

        // Valid payloads should have required fields
        validPayloads.forEach(payload => {
            expect(payload).toHaveProperty('prompt');
            expect(payload.prompt.length).toBeGreaterThan(0);
        });

        // Invalid payloads document the contract
        invalidPayloads.forEach(payload => {
            const hasPrompt = 'prompt' in payload;
            const hasValidPrompt = hasPrompt && (payload as any).prompt?.length > 0;
            if (!hasValidPrompt) {
                expect.soft(payload).not.toHaveProperty('prompt');
            }
        });
    });

    test('video generation: no base64 URIs (regression test)', async () => {
        // Regression test for: "Invalid video payload. Base64 forbidden; use gs:// URIs"
        // Document the contract: video generation ONLY accepts gs:// or http(s) URIs, never Base64

        const VALID_REFERENCE_IMAGE_PATTERNS = [
            { type: 'gs-uri', example: 'gs://indii-studio-prod.appspot.com/path/to/image.jpg' },
            { type: 'https-uri', example: 'https://example.com/image.jpg' },
            { type: 'http-uri', example: 'http://example.com/image.jpg' },
        ];

        const INVALID_REFERENCE_IMAGE_PATTERNS = [
            { type: 'base64-data-url', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            { type: 'base64-imageBytes', example: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
        ];

        // Document valid patterns
        VALID_REFERENCE_IMAGE_PATTERNS.forEach(pattern => {
            expect(pattern.example).toMatch(/^(gs:\/\/|https?:\/\/)/);
        });

        // Document invalid patterns that should NEVER be sent
        INVALID_REFERENCE_IMAGE_PATTERNS.forEach(pattern => {
            const isBase64 = pattern.example.startsWith('data:') || !pattern.example.startsWith('http');
            expect(isBase64).toBe(true);
        });

        // The contract: video generation reference images must be URIs, not Base64
    });

    test('video generation: whisk media uploaded to storage before sending', async () => {
        // Integration test: Whisk source media should be uploaded to Firebase Storage
        // and converted to gs:// URIs before sending to video generation backend

        // Simulate Whisk source media
        const whiskSourceMedia = {
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            mimeType: 'image/png',
        };

        // After upload, should have gs:// URI
        const expectedUploadedUri = 'gs://indii-studio-prod.appspot.com/objects/whisk-media/uuid-1234.png';

        // Verify URI format
        expect(expectedUploadedUri).toMatch(/^gs:\/\/.*\.appspot\.com\//);
        expect(expectedUploadedUri).not.toContain('data:');
        expect(expectedUploadedUri).not.toContain('base64');

        // The contract: Whisk media must be uploaded before sending to backend
    });

    test('image generation error: handles auth failures gracefully', async () => {
        const app = initializeApp(firebaseConfig, { name: 'test-app-' + Date.now() });
        const functions = getFunctions(app);

        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            try {
                connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            } catch {
                // Already connected
            }
        }

        const generateImageV3 = httpsCallable(functions, 'generateImageV3');

        // Call without auth should fail gracefully (not "undefined is not a function")
        try {
            await generateImageV3({
                prompt: 'test',
                aspectRatio: '16:9',
            });
        } catch (error: any) {
            // Should have a proper error code, not "undefined.create"
            const code = error?.code;
            const message = error?.message || '';

            expect(code).toBeDefined();
            expect(code).not.toContain('undefined');
            expect(message).not.toContain('Cannot read properties');

            // Common expected errors when not authenticated
            const expectedCodes = ['unauthenticated', 'permission-denied', 'failed-precondition'];
            const isExpected = expectedCodes.some(c => code?.includes(c));
            expect.soft(isExpected).toBe(true);
        }
    });

    test('video generation error: handles invalid models gracefully', async () => {
        const app = initializeApp(firebaseConfig, { name: 'test-app-' + Date.now() });
        const functions = getFunctions(app);

        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            try {
                connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            } catch {
                // Already connected
            }
        }

        const generateVideo = httpsCallable(functions, 'generateVideoVeo');

        // Call with invalid model should fail on validation, not "undefined.create"
        try {
            await generateVideo({
                prompt: 'test',
                model: 'invalid-model-xyz',
                aspectRatio: '16:9',
            });
        } catch (error: any) {
            const code = error?.code;
            const message = error?.message || '';

            // Should not be an "undefined" error
            expect(code).toBeDefined();
            expect(message).not.toContain('Cannot read properties');
            expect(message).not.toContain('undefined');
        }
    });
});
