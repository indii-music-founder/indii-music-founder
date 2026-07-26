/**
 * Creative generation client-boundary checks.
 *
 * These browser checks prove that the web client can initialize its Firebase
 * services and create backend callable references. They deliberately do not
 * pretend to validate a protected Cloud Function without an authenticated
 * emulator. Server admission, URI validation, and cost checks belong to the
 * focused Firebase gateway suite until that emulator lane exists.
 */

import { test, expect } from '@playwright/test';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const TEST_APP_PREFIX = 'creative-client-boundary-';
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'test-key',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test.appspot.com',
};

function createCreativeClientApp() {
    return initializeApp(firebaseConfig, { name: `${TEST_APP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}` });
}

test.describe('Creative Generation — Client Boundary Initialization', () => {
    test.afterEach(async () => {
        await Promise.all(getApps()
            .filter(app => app.name.startsWith(TEST_APP_PREFIX))
            .map(app => deleteApp(app)));
    });

    test('constructs image and video callables without direct provider access', async () => {
        const app = createCreativeClientApp();
        const functions = getFunctions(app);

        const imageCallable = httpsCallable(functions, 'generateImageV3');
        const videoCallable = httpsCallable(functions, 'generateVideoV3');

        expect(imageCallable).toBeDefined();
        expect(videoCallable).toBeDefined();
        expect(typeof imageCallable).toBe('function');
        expect(typeof videoCallable).toBe('function');
    });

    test('initializes the Firebase services required by the protected creative flow', async () => {
        const app = createCreativeClientApp();

        expect(initializeAuth(app)).toBeDefined();
        expect(getFunctions(app)).toBeDefined();
        expect(getFirestore(app)).toBeDefined();
        expect(getStorage(app)).toBeDefined();
    });
});
