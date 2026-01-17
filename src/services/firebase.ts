import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getAI, VertexAIBackend } from 'firebase/ai';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { AI_MODELS } from '@/core/config/ai-models';

// Prevent crash if config is missing (e.g. CI/Dev without env vars)
const safeConfig = firebaseConfig.apiKey ? firebaseConfig : {
    ...firebaseConfig,
    apiKey: "AIzaSy_FAKE_KEY_FOR_DEV_BYPASS_00000000", // valid format placeholder
    projectId: "demo-project",
    authDomain: "demo-project.firebaseapp.com"
};

export const app = initializeApp(safeConfig);



// Initialize Firebase AI with Production Security (App Check + Vertex AI Backend)
export const ai = getAI(app, {
    backend: new VertexAIBackend('global'),
    useLimitedUseAppCheckTokens: false
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

// Use initializeAuth to ensure persistence is correctly configured for Electron
// This fixes potential hangs where default persistence (IndexedDB) might fail silently
export const auth = initializeAuth(app, {
    persistence: [browserLocalPersistence, browserSessionPersistence]
});

// Initialize Remote Config
export const remoteConfig = getRemoteConfig(app);
remoteConfig.defaultConfig = {
    model_name: AI_MODELS.TEXT.FAST,
    vertex_location: 'global'
};

// Initialize App Check
let appCheck = null;
if (typeof window !== 'undefined') {
    // Debug token for local development - only set if explicitly configured
    if (env.DEV && env.appCheckDebugToken) {
        // @ts-expect-error - Firebase App Check debug token property not in Window interface
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken;
    }

    // SECURITY: Warn in production if App Check is not configured
    // This is a critical security control - App Check prevents unauthorized API access
    if (!env.DEV && !env.appCheckKey) {
        const errorMessage = 'SECURITY WARNING: App Check key missing in production. Application running without App Check.';
        console.warn(errorMessage);
    }

    // Initialize App Check if we have a valid key
    if (env.appCheckKey) {
        try {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider(env.appCheckKey),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e) {
            console.error('App Check initialization failed:', e);
            // In production, re-throw to prevent running without security
            if (!env.DEV) {
                throw e;
            }
        }
    }
}
export { appCheck };




// Expose for e2e testing
// Expose for e2e testing

declare global {
    interface Window {
        db: typeof db;
        firebaseInternals: { doc: typeof doc; setDoc: typeof setDoc };
        functions: typeof functions;
        auth: typeof auth;
    }
}

// SECURE: Only expose Firebase internals in development builds with explicit env flag
// Never expose based on runtime hostname check (can be spoofed)
if (import.meta.env.DEV && import.meta.env.VITE_EXPOSE_INTERNALS === 'true' && typeof window !== 'undefined') {
    console.log("[App] Exposing Firebase Internals for E2E (DEV ONLY)");
    window.db = db;
    window.firebaseInternals = { doc, setDoc };
    window.functions = functions;
    // @ts-expect-error - exposing for testing
    window.httpsCallable = httpsCallable;
    window.auth = auth;
}
