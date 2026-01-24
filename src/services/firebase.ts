import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getAI, VertexAIBackend, AI } from 'firebase/ai';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
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

// ============================================================================
// LAZY Firebase AI Initialization
// Only initialize when App Check is configured to avoid Installations API errors
// ============================================================================
let _aiInstance: AI | null = null;

/**
 * Check if App Check is configured (must match FirebaseAIService logic)
 */
function isAppCheckConfigured(): boolean {
    return !!(env.appCheckKey || env.appCheckDebugToken);
}

/**
 * Get the Firebase AI instance. Returns null if App Check is not configured,
 * which signals FirebaseAIService to use direct Gemini SDK fallback.
 */
export function getFirebaseAI(): AI | null {
    if (_aiInstance) return _aiInstance;

    // Only initialize Firebase AI if App Check is configured
    // This prevents the Installations API error when App Check isn't set up
    if (!isAppCheckConfigured()) {
        console.warn('[Firebase] App Check not configured, Firebase AI will not be initialized (using fallback)');
        return null;
    }

    try {
        _aiInstance = getAI(app, {
            backend: new VertexAIBackend('global'),
            useLimitedUseAppCheckTokens: false
        });
        console.log('[Firebase] Firebase AI initialized with Vertex AI backend');
        return _aiInstance;
    } catch (error) {
        console.error('[Firebase] Failed to initialize Firebase AI:', error);
        return null;
    }
}

// For backwards compatibility - lazy getter
export const ai = {
    get instance(): AI | null {
        return getFirebaseAI();
    }
};

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
export const functions = getFunctions(app); // Default (us-central1)
export const functionsWest1 = getFunctions(app, 'us-west1'); // Regional (us-west1)

// Connect to Functions emulator in development (when running locally)
// Production builds skip this entirely - they call deployed Cloud Functions
if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true' && typeof window !== 'undefined') {
    try {
        connectFunctionsEmulator(functions, '127.0.0.1', 5001);
        connectFunctionsEmulator(functionsWest1, '127.0.0.1', 5001);
        console.log('[Firebase] Connected to Functions emulator on port 5001');
    } catch (e) {
        // Emulator connection may fail if already connected or emulator not running
        console.warn('[Firebase] Functions emulator connection skipped:', e);
    }
}

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
    // SKIP in Electron unless a debug token is explicitly provided (ReCaptcha Enterprise requires web origin)
    const isElectron = !!window.electronAPI;
    const shouldInitAppCheck = env.appCheckKey && (!isElectron || env.appCheckDebugToken);

    if (shouldInitAppCheck) {
        if (isElectron && env.appCheckDebugToken) {
            console.log('[App Check] Initializing in Electron with Debug Token');
        }

        try {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider(env.appCheckKey!),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e) {
            console.error('App Check initialization failed:', e);
            // In production, re-throw to prevent running without security
            if (!env.DEV) {
                throw e;
            }
        }
    } else if (isElectron && env.appCheckKey) {
        console.log('[App Check] Skipped initialization in Electron (missing debug token)');
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
