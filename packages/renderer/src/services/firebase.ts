import { logger } from '@/utils/logger';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getAI, VertexAIBackend, AI as Autonomous } from 'firebase/ai';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { isAppCheckConfigured } from '@/services/intelligence/appcheck';
import { getE2EMockUser, isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

// If Firebase config is missing critical keys, log clearly and continue with empty config.
// The app will show the login screen with an auth error rather than crashing.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    logger.error('[Firebase] CRITICAL: Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env. Auth will not work.');
}

export const app = initializeApp(firebaseConfig);

// ============================================================================
// LAZY Firebase Autonomous Initialization
// Only initialize when App Check is configured to avoid Installations API errors
// ============================================================================
const _aiInstances = new Map<string, Autonomous>();

/**
 * Get the Firebase Autonomous instance. Returns null if App Check is not configured,
 * which signals FirebaseIntelligenceService to use direct Gemini SDK fallback.
 * Allows passing an optional location (e.g. 'us-central1') for dynamic Vertex routing.
 */
export function getFirebaseAI(location?: string): Autonomous | null {
    const targetLocation = location || import.meta.env.VITE_VERTEX_LOCATION || 'global';
    if (_aiInstances.has(targetLocation)) {
        return _aiInstances.get(targetLocation)!;
    }

    // Only initialize Firebase Autonomous if App Check is configured
    // This prevents the Installations API error when App Check isn't set up
    if (!isAppCheckConfigured()) {
        logger.warn('[Firebase] App Check not configured, Firebase Autonomous will not be initialized (using fallback)');
        return null;
    }

    try {
        const instance = getAI(app, {
            backend: new VertexAIBackend(targetLocation),
            useLimitedUseAppCheckTokens: false
        });
        _aiInstances.set(targetLocation, instance);
        logger.info(`[Firebase] Firebase Autonomous initialized with Vertex Autonomous backend (${targetLocation})`);
        return instance;
    } catch (error: unknown) {
        logger.error(`[Firebase] Failed to initialize Firebase AI for location ${targetLocation}:`, error);
        return null;
    }
}

// For backwards compatibility - lazy getter
export const ai = {
    get instance(): Autonomous | null {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof initializeFirestore> | any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storage: ReturnType<typeof getStorage> | any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let functions: ReturnType<typeof getFunctions> | any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let functionsWest1: ReturnType<typeof getFunctions> | any = null;

try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true
    });
    storage = getStorage(app);
    functions = getFunctions(app); // Default (us-central1)
    functionsWest1 = getFunctions(app); // Migrated to us-central1

    const isDev = env.DEV;
    const useEmulator = env.VITE_USE_FUNCTIONS_EMULATOR === 'true';

    if (isDev && useEmulator && typeof window !== 'undefined') {
        try {
            connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            connectFunctionsEmulator(functionsWest1, '127.0.0.1', 5001);
            logger.debug('[Firebase] Connected to Functions emulator on port 5001');
        } catch (e: unknown) {
            logger.warn('[Firebase] Functions emulator connection skipped:', e);
        }
    }
} catch (e) {
    logger.error('[Firebase] Failed to initialize core services (likely missing config):', e);
}

export { db, storage, functions, functionsWest1 };

import { Auth, User } from 'firebase/auth';
let rawAuth: Auth;
if (isFirebaseE2EMockEnabled()) {
    logger.debug('[Firebase] Using E2E Auth Mock');
    const mockUser = getE2EMockUser<User>();
    rawAuth = {
        app,
        currentUser: mockUser,
        onAuthStateChanged: (cb: (user: User | null) => void) => {
            setTimeout(() => cb(mockUser), 100);
            return () => { };
        },
        signInAnonymously: () => Promise.resolve({ user: mockUser }),
        signInWithEmailAndPassword: () => Promise.resolve({ user: mockUser }),
        createUserWithEmailAndPassword: () => Promise.resolve({ user: mockUser }),
        sendPasswordResetEmail: () => Promise.resolve(),
        signInWithPopup: () => Promise.resolve({ user: mockUser }),
        signOut: () => Promise.resolve(),
    } as unknown as Auth;
} else {
    try {
        rawAuth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
        });
    } catch (e: unknown) {
        logger.error('[Firebase] Failed to initialize Auth (likely missing API key):', e);
        rawAuth = {
            app,
            currentUser: null,
            onAuthStateChanged: (cb: (user: User | null) => void) => {
                setTimeout(() => cb(null), 100);
                return () => { };
            },
            signInAnonymously: () => Promise.reject(new Error("Missing VITE_FIREBASE_API_KEY in .env")),
            signInWithEmailAndPassword: () => Promise.reject(new Error("Missing VITE_FIREBASE_API_KEY in .env")),
            createUserWithEmailAndPassword: () => Promise.reject(new Error("Missing VITE_FIREBASE_API_KEY in .env")),
            sendPasswordResetEmail: () => Promise.reject(new Error("Missing VITE_FIREBASE_API_KEY in .env")),
            signInWithPopup: () => Promise.reject(new Error("Missing VITE_FIREBASE_API_KEY in .env")),
            signOut: () => Promise.resolve(),
        } as unknown as Auth;
    }
}

// Wrap Auth in a Proxy to support explicit E2E auth injection.
const auth = new Proxy(rawAuth, {
    get(target, prop, receiver) {
        if (prop === 'currentUser') {
            const realUser = target.currentUser;
            if (realUser) return realUser;

            const mockUser = getE2EMockUser<User>();
            if (mockUser) return mockUser;
            return null;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
    }
});

export { auth };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let remoteConfig: any = null;
try {
    // Initialize Remote Config
    remoteConfig = getRemoteConfig(app);
    remoteConfig.defaultConfig = {
        model_name: INTELLIGENCE_MODELS.TEXT.FAST,
        vertex_location: 'global'
    };
} catch (e) {
    logger.error('[Firebase] Failed to initialize RemoteConfig:', e);
}
export { remoteConfig };

// Initialize Messaging (Client-side only)
// LAZY: Use isSupported() guard to prevent FirebaseError on browsers that lack
// Service Worker / Push API (e.g. Chrome iOS). Sentry fix 2026-04-15.
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import type { Messaging } from 'firebase/messaging';

let _messagingInstance: Messaging | null = null;
let _messagingChecked = false;

/**
 * Get Firebase Messaging instance. Returns null on unsupported browsers
 * (Chrome iOS, in-app WebViews, etc.) without throwing.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
    if (_messagingChecked) return _messagingInstance;
    _messagingChecked = true;

    if (typeof window === 'undefined') return null;

    try {
        const supported = await isMessagingSupported().catch(() => false);
        if (!supported) {
            logger.debug('[Firebase] Messaging not supported in this browser — skipping FCM init.');
            return null;
        }
        _messagingInstance = getMessaging(app);
        logger.debug('[Firebase] Messaging initialized successfully.');
        return _messagingInstance;
    } catch (e: unknown) {
        const errMessage = e instanceof Error ? e.message : String(e);
        // Do not pass the raw error object to logger to prevent Sentry from capturing expected unsupported browser errors
        logger.warn(`[Firebase] Messaging init failed: ${errMessage}`);
        return null;
    }
}

// Backwards-compat: eager reference (null until first async call)
export const messaging = null as Messaging | null;

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
    // Debug token for local development
    // Set global debug token if provided in env
    if (env.DEV) {
        if (env.appCheckDebugToken) {
            window.FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken;
        } else {
            window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
    }

    // SECURITY: Warn in production if App Check is not configured
    // This is a critical security control - App Check prevents unauthorized API access
    if (!env.DEV && !env.appCheckKey) {
        const errorMessage = 'SECURITY WARNING: App Check key missing in production. Application running without App Check.';
        logger.warn(errorMessage);
    }

    // Initialize App Check if we have a valid key
    // SKIP in Electron unless a debug token is explicitly provided (ReCaptcha Enterprise requires web origin)
    // ALLOW in DEV if key is present to trigger the Firebase SDK's local debug token logging
    const isElectron = !!window.electronAPI;
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Logic: 
    // 1. Must have a key.
    // 2. If Electron, must have a debug token (unless in DEV, where we want to trigger the prompt).
    // 3. If in DEV, we initialize even without a debug token so the SDK logs the "Missing debug token" message to the console.
    const shouldInitAppCheck = !!env.appCheckKey && (
        !isElectron || env.appCheckDebugToken || env.DEV
    );

    if (shouldInitAppCheck) {
        if (env.DEV && !env.appCheckDebugToken && isLocalhost) {
            console.warn(
                '[indii][AppCheck] Running on localhost without a debug token.\n' +
                'Google Maps and other protected services will fail until you:\n' +
                '1. Check the console for "App Check debug token: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"\n' +
                '2. Add this token to your .env as VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN\n' +
                '3. Register this token in the Firebase Console under App Check > Manage Debug Tokens.'
            );
        }

        if (isElectron && env.appCheckDebugToken) {
            logger.debug('[App Check] Initializing in Electron with Debug Token');
        }

        try {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(env.appCheckKey!),
                isTokenAutoRefreshEnabled: true
            });
            logger.info('[App Check] Initialized successfully');
        } catch (e: unknown) {
            // CRITICAL: Do NOT re-throw here. A failed App Check must not crash
            // the entire app (killing React before it mounts). Firestore/Storage
            // Security Rules still enforce authorization even without App Check.
            logger.error('[App Check] Initialization failed — app running without App Check:', e);
        }
    } else if (env.appCheckKey) {
        logger.debug('[App Check] Skipping initialization (Electron/Dev constraints not met)');
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
        FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
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
