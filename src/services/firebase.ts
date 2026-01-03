import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getAI, VertexAIBackend } from 'firebase/ai';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { AI_MODELS } from '@/core/config/ai-models';

export const app = initializeApp(firebaseConfig);

// Initialize Firebase AI with Production Security (App Check + Vertex AI Backend)
export const ai = getAI(app, {
    backend: new VertexAIBackend('global'),
    useLimitedUseAppCheckTokens: true
});

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
export const auth = getAuth(app);

// Initialize Remote Config
export const remoteConfig = getRemoteConfig(app);
remoteConfig.defaultConfig = {
    model_name: AI_MODELS.TEXT.FAST,
    vertex_location: 'global'
};

// Initialize App Check

// Initialize App Check
let appCheck = null;
if (typeof window !== 'undefined') {
    // Debug token for local development
    if (env.DEV) {
        // @ts-ignore
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken || true;
    }

    // Warn if missing key in production
    if (!env.DEV && !env.appCheckKey) {
        console.warn('App Check key missing in production. Security verification may fail.');
    }

    // Initialize if key exists or strictly in DEV mode
    if (env.appCheckKey || env.DEV) {
        try {
            // Use a placeholder if dependent on env.appCheckKey but it is undefined in DEV/TEST
            const key = env.appCheckKey || '6Lc...PLACEHOLDER...';
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider(key),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e) {
            console.warn('App Check init failed:', e);
        }
    }
}
export { appCheck };




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
