import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

import { env } from '../config/env';

const firebaseConfig = {
    apiKey: env.apiKey || "AIzaSyD7bmREk0yo8-WtJIngr7ek9U1-BC7BTC0",
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
