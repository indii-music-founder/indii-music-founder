import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

import { firebaseConfig } from '@/config/env';
// Get Firebase API key from environment (Vite injects import.meta.env at build time)
const getFirebaseApiKey = (): string => {
    // Try Vite environment variables (VITE_FIREBASE_API_KEY or fallback to VITE_API_KEY)
    const envKey = import.meta.env?.VITE_FIREBASE_API_KEY || import.meta.env?.VITE_API_KEY;
    if (envKey) return envKey;

    // Fallback for Node.js environment
    if (typeof process !== 'undefined') {
        const processKey = process.env?.VITE_FIREBASE_API_KEY || process.env?.VITE_API_KEY;
        if (processKey) return processKey;
    }

    // No hardcoded fallback for security - Firebase will fail with clear error
    console.error('[Firebase] API key not found. Set VITE_FIREBASE_API_KEY or VITE_API_KEY in .env');
    return '';
};

const firebaseConfig = {
    apiKey: getFirebaseApiKey(),
    authDomain: "indiios-v-1-1.firebaseapp.com",
    databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:3af738739465ea4095e9bd",
    measurementId: "G-7WW3HEHFTF"
};

import { getFunctions } from 'firebase/functions';

const app = initializeApp(firebaseConfig);

/**
 * Firestore with offline persistence enabled (modern API).
 *
 * This provides:
 * - Multi-device sync: Changes sync automatically across all devices
 * - Offline support: App works offline, syncs when back online
 * - Multi-tab support: Works across browser tabs simultaneously
 *
 * Data is stored in Firestore (cloud) with automatic IndexedDB caching.
 * No custom IndexedDB schema needed - Firebase handles it internally.
 */
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export const storage = getStorage(app);
export const auth = getAuth(app);
// signInAnonymously(auth).catch(console.error);
export const functions = getFunctions(app);

// if (env.DEV) {
//     connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }
