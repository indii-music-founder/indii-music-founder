import { logger } from '@/utils/logger';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getAI, VertexAIBackend, AI } from 'firebase/ai';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { AI_MODELS } from '@/core/config/ai-models';

// If Firebase config is missing critical keys, log clearly and continue with empty config.
// The app will show the login screen with an auth error rather than crashing.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    logger.error('[Firebase] CRITICAL: Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env. Auth will not work.');
}

export const app = initializeApp(firebaseConfig);

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
        logger.warn('[Firebase] App Check not configured, Firebase AI will not be initialized (using fallback)');
        return null;
    }

    try {
        _aiInstance = getAI(app, {
            backend: new VertexAIBackend('us-central1'),
            useLimitedUseAppCheckTokens: false
        });
        logger.debug('[Firebase] Firebase AI initialized with Vertex AI backend (us-central1)');
        return _aiInstance;
    } catch (error: unknown) {
        logger.error('[Firebase] Failed to initialize Firebase AI:', error);
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
const isDev = env.DEV;
const useEmulator = env.VITE_USE_FUNCTIONS_EMULATOR === 'true';

if (isDev && useEmulator && typeof window !== 'undefined') {
    try {
        connectFunctionsEmulator(functions, '127.0.0.1', 5001);
        connectFunctionsEmulator(functionsWest1, '127.0.0.1', 5001);
        logger.debug('[Firebase] Connected to Functions emulator on port 5001');
    } catch (e: unknown) {
        // Emulator connection may fail if already connected or emulator not running
        logger.warn('[Firebase] Functions emulator connection skipped:', e);
    }
}

// Use initializeAuth to ensure persistence is correctly configured for Electron
// HINT: Added indexedDBLocalPersistence to fix Bug M1 where localStorage full causes silent auth drop.
import { Auth, User } from 'firebase/auth';
let auth: Auth;
if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).FIREBASE_E2E_MOCK) {
    logger.debug('[Firebase] Using E2E Auth Mock');
    const mockUser = (window as unknown as Record<string, unknown>).FIREBASE_USER_MOCK as User || null;
    auth = {
        app,
        currentUser: mockUser,
        onAuthStateChanged: (cb: (user: User | null) => void) => {
            setTimeout(() => cb(mockUser), 100);
            return () => { };
        },
        signInAnonymously: () => Promise.resolve({ user: mockUser }),
        signOut: () => Promise.resolve(),
        // Add other required Auth members for type safety if needed, or cast
    } as unknown as Auth;
} else {
    auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
    });
}
export { auth };

// Initialize Remote Config
export const remoteConfig = getRemoteConfig(app);
remoteConfig.defaultConfig = {
    model_name: AI_MODELS.TEXT.FAST,
    vertex_location: 'global'
};

// Initialize Messaging (Client-side only)
import { getMessaging } from 'firebase/messaging';
export const messaging = typeof window !== 'undefined' ? (() => {
    try {
        return getMessaging(app);
    } catch (e: unknown) {
        logger.warn('Firebase Messaging not supported:', e);
        return null;
    }
})() : null;

// Item 259: Initialize Firebase Performance Monitoring
// Lazy-loaded to avoid adding to the critical path
let _perfInstance: ReturnType<typeof import('firebase/performance').getPerformance> | null = null;
export function getFirebasePerf() {
    if (_perfInstance) return _perfInstance;
    if (typeof window === 'undefined') return null;
    try {
        // Dynamic import to avoid bundling perf SDK in critical path
        import('firebase/performance').then(({ getPerformance }) => {
            _perfInstance = getPerformance(app);
            logger.info('[Firebase] Performance Monitoring initialized');
        }).catch(() => {
            logger.debug('[Firebase] Performance Monitoring not available');
        });
    } catch {
        // Silently skip if not available
    }
    return null;
}
// Auto-initialize on load
if (typeof window !== 'undefined') {
    getFirebasePerf();
}

// Initialize App Check
let appCheck = null;
if (typeof window !== 'undefined') {
    // Debug token for local development - only set if explicitly configured
    if (env.DEV && env.appCheckDebugToken) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken;
    }

    // SECURITY: Warn in production if App Check is not configured
    // This is a critical security control - App Check prevents unauthorized API access
    if (!env.DEV && !env.appCheckKey) {
        const errorMessage = 'SECURITY WARNING: App Check key missing in production. Application running without App Check.';
        logger.warn(errorMessage);
    }

    // Initialize App Check if we have a valid key
    // SKIP in Electron unless a debug token is explicitly provided (ReCaptcha Enterprise requires web origin)
    // Or skip in development for bypass
    // Initialize App Check if we have a valid key
    // SKIP in Electron unless a debug token is explicitly provided (ReCaptcha Enterprise requires web origin)
    // ALLOW in DEV if debug token is present (Fixes localhost "Permission Denied")
    const isElectron = !!window.electronAPI;
    const shouldInitAppCheck = env.appCheckKey &&
        (!isElectron || env.appCheckDebugToken) &&
        (!env.DEV || env.appCheckDebugToken);

    if (shouldInitAppCheck) {
        if (isElectron && env.appCheckDebugToken) {
            logger.debug('[App Check] Initializing in Electron with Debug Token');
        }

        try {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider(env.appCheckKey!),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e: unknown) {
            // CRITICAL: Do NOT re-throw here. A failed App Check must not crash
            // the entire app (killing React before it mounts). Firestore/Storage
            // Security Rules still enforce authorization even without App Check.
            // Incident 2026-03-11: blocked API key caused App Check re-throw → 
            // JS bundle death → infinite CSS spinner on production.
            logger.error('[App Check] Initialization failed — app running without App Check:', e);
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
        httpsCallable: typeof httpsCallable;
        FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
    }
}

// SECURE: Only expose Firebase internals in development builds with explicit env flag
// Never expose based on runtime hostname check (can be spoofed)
if (env.DEV && env.VITE_EXPOSE_INTERNALS === 'true' && typeof window !== 'undefined') {
    logger.debug("[App] Exposing Firebase Internals for E2E (DEV ONLY)");
    window.db = db;
    window.firebaseInternals = { doc, setDoc };
    window.functions = functions;
    window.httpsCallable = httpsCallable;
    window.auth = auth;
}
