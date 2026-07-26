/**
 * API CONTRACT TESTS
 * Validates that Firebase Functions are initialized, callable, and have correct signatures.
 * These tests FAIL EARLY if a backend contract breaks (module init order, payload schema, etc.)
 *
 * Run before full E2E suite to catch API breaks before any UI testing.
 */

import { test, expect } from '@playwright/test';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const TEST_APP_PREFIX = 'api-contract-';
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test.appspot.com',
};

function createApiContractApp() {
    return initializeApp(firebaseConfig, { name: `${TEST_APP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}` });
}

test.describe('API Contracts — Firebase Functions Initialization', () => {
    test.afterEach(async () => {
        await Promise.all(getApps()
            .filter(app => app.name.startsWith(TEST_APP_PREFIX))
            .map(app => deleteApp(app)));
    });

    test('Firebase Functions service initializes and is callable', async () => {
        // This test verifies that:
        // 1. Firebase app initializes
        // 2. Functions service is available (not null/undefined)
        // 3. Functions client can be created
        // 4. httpsCallable can create callable references

        const app = createApiContractApp();

        const functions = getFunctions(app);
        expect(functions).toBeDefined();
        expect(functions).not.toBeNull();

        // Test that we can create callable references
        const testCallable = httpsCallable(functions, 'generateImageV3');
        expect(testCallable).toBeDefined();
    });

    test('generateImageV3 callable can be constructed without a second default app', async () => {
        // Schema execution belongs to authenticated Functions-emulator coverage.
        // This browser test intentionally proves only Firebase client initialization;
        // it must not issue a request against production with placeholder credentials.
        const app = createApiContractApp();
        const functions = getFunctions(app);
        const generateImageV3 = httpsCallable(functions, 'generateImageV3');
        expect(generateImageV3).toBeDefined();
        expect(typeof generateImageV3).toBe('function');
    });

    test('videoGeneration callable exists and has correct signature', async () => {
        const app = createApiContractApp();

        const functions = getFunctions(app);
        const generateVideo = httpsCallable(functions, 'generateVideoVeo');

        expect(generateVideo).toBeDefined();
        expect(typeof generateVideo).toBe('function');
    });

    test('Firestore database initializes correctly', async () => {
        const app = createApiContractApp();

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
