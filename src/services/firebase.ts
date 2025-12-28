import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { firebaseConfig } from '@/config/env';

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
export const functions = getFunctions(app);



// Expose for e2e testing
import { doc, setDoc } from 'firebase/firestore';

declare global {
    interface Window {
        db: typeof db;
        firestore: { doc: typeof doc; setDoc: typeof setDoc };
        functions: typeof functions;
    }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.db = db;
    window.firestore = { doc, setDoc };
    window.functions = functions;
}
