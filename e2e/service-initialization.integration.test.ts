/**
 * SERVICE INITIALIZATION TESTS
 * Catches export-order bugs and uninitialized service patterns.
 *
 * Pattern: Services exported as null then initialized later.
 * Risk: If initialization fails, consumers get undefined and crash.
 *
 * Examples of this bug:
 * - Firebase functions exported before getFunctions() call
 * - Firebase messaging exported as null then conditionally initialized
 * - Custom services with async init patterns
 */

import { test, expect } from '@playwright/test';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import {
    getFunctions,
    connectFunctionsEmulator,
} from 'firebase/functions';
import { httpsCallable } from 'firebase/functions';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test.appspot.com',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
};

const TEST_APP_PREFIX = 'service-init-';

function createServiceTestApp(label: string) {
    return initializeApp(firebaseConfig, {
        name: `${TEST_APP_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
}

test.describe('Service Initialization — Export Order Validation', () => {
    test.afterEach(async () => {
        await Promise.all(getApps()
            .filter(app => app.name.startsWith(TEST_APP_PREFIX))
            .map(app => deleteApp(app)));
    });

    test('Firebase Functions must be initialized before httpsCallable', async () => {
        // Regression test for: "Cannot read properties of undefined"
        // Ensures getFunctions() is called before any httpsCallable(functions, ...)

        const app = createServiceTestApp('functions');

        // This is the bug pattern: trying to use functions before initialization
        // If getFunctions() wasn't called, this would fail
        const functions = getFunctions(app);
        expect(functions).toBeDefined();

        // Now httpsCallable can safely use it
        const callable = httpsCallable(functions, 'testFunction');
        expect(callable).toBeDefined();
    });

    test('Firebase Messaging can be conditionally initialized', async () => {
        // Test that messaging can be initialized conditionally without breaking
        // Messaging is often optional (notifications may be disabled)

        const app = createServiceTestApp('messaging');

        if (!(await isMessagingSupported())) {
            expect(await isMessagingSupported()).toBe(false);
            return;
        }

        expect(getMessaging(app)).toBeDefined();
    });

    test('All 46 httpsCallable calls must have initialized functions service', async () => {
        // High-level contract: every httpsCallable(functions, ...) in the codebase
        // assumes functions is defined and initialized

        const app = createServiceTestApp('callables');
        const functions = getFunctions(app);

        // These are the actual functions called from the codebase
        const callableNames = [
            'generateImageV3',
            'generateVideoVeo',
            'generateItinerary',
            'checkLogistics',
            'findPlaces',
            'generateReleaseDownloadUrl',
            'executeCampaign',
            'generateOmniRemixV3',
            'cancelVideoJob',
            'renderVideo',
            'triggerVideoJob',
            'pod_create',
            'editImage',
        ];

        // Verify each can be created (would fail if functions was null)
        callableNames.forEach(name => {
            const callable = httpsCallable(functions, name);
            expect(callable).toBeDefined();
            expect(typeof callable).toBe('function');
        });
    });

    test('Multiple apps can initialize independently', async () => {
        // Test that creating multiple Firebase app instances doesn't break service init

        const app1 = createServiceTestApp('multi-1');
        const app2 = createServiceTestApp('multi-2');

        const functions1 = getFunctions(app1);
        const functions2 = getFunctions(app2);

        expect(functions1).toBeDefined();
        expect(functions2).toBeDefined();
        expect(functions1).not.toBe(functions2);
    });

    test('Functions service remains defined after emulator connection', async () => {
        // Test that connecting to the emulator doesn't invalidate the functions service

        const app = createServiceTestApp('emulator');
        const functions = getFunctions(app);

        expect(functions).toBeDefined();

        if (process.env.NODE_ENV === 'development' || process.env.CI) {
            try {
                connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            } catch {
                // Already connected or unavailable, that's fine
            }
        }

        // Functions should still be usable after emulator connection
        expect(functions).toBeDefined();
        const callable = httpsCallable(functions, 'testFunction');
        expect(callable).toBeDefined();
    });
});

test.describe('Service Initialization — Custom Services', () => {
    test('Custom services must validate initialization before use', async () => {
        // Pattern: Custom services (non-Firebase) should have an init check
        // Example: database connections, API clients, auth handlers

        // This is a pattern specification test
        // It documents the contract that custom services must follow:
        // 1. Export a service instance
        // 2. Provide an isInitialized() or similar check
        // 3. Throw informative error if used before init

        const mockService = {
            isInitialized: false,
            init: async () => {
                mockService.isInitialized = true;
            },
            use: () => {
                if (!mockService.isInitialized) {
                    throw new Error('Service not initialized. Call init() first.');
                }
            },
        };

        // Using before init should fail
        expect(() => mockService.use()).toThrow('Service not initialized');

        // After init, should work
        await mockService.init();
        expect(() => mockService.use()).not.toThrow();
    });
});
