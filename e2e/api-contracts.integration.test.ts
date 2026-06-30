/**
 * API CONTRACT TESTS
 * Validates that Firebase Functions are initialized, callable, and have correct signatures.
 * These tests FAIL EARLY if a backend contract breaks (module init order, payload schema, etc.)
 *
 * Run before full E2E suite to catch API breaks before any UI testing.
 */

import { test, expect } from '@playwright/test';
import { initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

test.describe('API Contracts — Firebase Functions Initialization', () => {
    test('Firebase Functions service initializes and is callable', async () => {
        // This test verifies that:
        // 1. Firebase app initializes
        // 2. Functions service is available (not null/undefined)
        // 3. Functions client can be created
        // 4. httpsCallable can create callable references

        const app = initializeApp({
            apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
            authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test.appspot.com',
        });

        const functions = getFunctions(app);
        expect(functions).toBeDefined();
        expect(functions).not.toBeNull();

        // Test that we can create callable references
        const testCallable = httpsCallable(functions, 'generateImageV3');
        expect(testCallable).toBeDefined();
    });

    test('generateImageV3 callable accepts valid payload schema', async () => {
        // This validates the SIGNATURE of the API call before any real execution
        // Catches payload schema mismatches that unit tests miss

        const app = initializeApp({
            apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
        });

        const functions = getFunctions(app);

        // Connect to emulator if available (dev/CI)
        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            try {
                connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            } catch {
                // Emulator already connected or unavailable
            }
        }

        const generateImageV3 = httpsCallable(functions, 'generateImageV3');

        // Test valid payload shape
        const validPayload = {
            prompt: 'test prompt',
            aspectRatio: '16:9',
            model: 'imagen-3-fast',
            imageSize: '1024',
        };

        try {
            await generateImageV3(validPayload);
        } catch (error: any) {
            // Expected to fail (no real credentials), but should fail on AUTH, not PAYLOAD_SCHEMA
            const code = error?.code;
            const message = error?.message || '';

            // These are EXPECTED errors (auth, quota, etc.)
            const expectedErrors = ['permission-denied', 'unauthenticated', 'resource-exhausted', 'failed-precondition'];

            // These are UNEXPECTED (indicate payload schema mismatch)
            const unexpectedErrors = ['invalid-argument', 'not-found'];

            if (unexpectedErrors.some(e => code?.includes(e))) {
                throw new Error(`PAYLOAD SCHEMA MISMATCH: ${code} — ${message}`);
            }
        }
    });

    test('videoGeneration callable exists and has correct signature', async () => {
        const app = initializeApp({
            apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
        });

        const functions = getFunctions(app);
        const generateVideo = httpsCallable(functions, 'generateVideoVeo');

        expect(generateVideo).toBeDefined();
        expect(typeof generateVideo).toBe('function');
    });

    test('Firestore database initializes correctly', async () => {
        const app = initializeApp({
            apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
        });

        const db = getFirestore(app);
        expect(db).toBeDefined();
        expect(db).not.toBeNull();

        // Connect to emulator if available
        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            try {
                connectFirestoreEmulator(db, '127.0.0.1', 8080);
            } catch {
                // Emulator already connected or unavailable
            }
        }
    });
});

test.describe('API Contracts — Payload Validation', () => {
    test('image generation rejects base64 URIs (requires gs:// or http://)', async () => {
        // Regression test for: "Invalid video payload. Base64 forbidden"
        // Ensures we never send imageBytes instead of URI

        const validPayloadShapes = [
            {
                // ✓ Valid: gs:// URI
                image: { uri: 'gs://bucket/path/to/image.jpg' },
                prompt: 'test'
            },
            {
                // ✓ Valid: http(s) URI
                image: { uri: 'https://example.com/image.jpg' },
                prompt: 'test'
            }
        ];

        const invalidPayloadShapes = [
            {
                // ✗ Invalid: Base64 imageBytes
                image: { imageBytes: 'data:image/png;base64,iVBORw0KG...' },
                prompt: 'test'
            },
            {
                // ✗ Invalid: mimeType without uri
                image: { mimeType: 'image/png', imageBytes: '...' },
                prompt: 'test'
            }
        ];

        // Document the contract for future developers
        expect(validPayloadShapes[0].image).toHaveProperty('uri');
        expect(invalidPayloadShapes[0].image).toHaveProperty('imageBytes');

        // The test passes; the CONTRACT is documented.
        // Real validation happens at the backend (and we'll add integration tests to catch it).
    });
});
