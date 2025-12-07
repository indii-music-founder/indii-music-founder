import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

import { env } from '../config/env';

const firebaseConfig = {
    apiKey: env.apiKey,
    authDomain: `${env.projectId}.firebaseapp.com`,
    databaseURL: "https://indiios-alpha-electron-1.firebaseio.com",
    projectId: env.projectId,
    storageBucket: "indiios-alpha-electron.firebasestorage.app",
    messagingSenderId: "563584335869",
    appId: "1:563584335869:web:321321321"
};

// Fallback for production if env vars are missing (though they shouldn't be)
if (!firebaseConfig.projectId) {
    console.warn("Firebase config missing env vars, using fallback.");
    firebaseConfig.authDomain = "indiios-v-1-1.firebaseapp.com";
    firebaseConfig.databaseURL = "https://indiios-alpha-electron-1.firebaseio.com";
    firebaseConfig.projectId = "indiios-v-1-1";
    firebaseConfig.storageBucket = "indiios-alpha-electron.firebasestorage.app";
}

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
