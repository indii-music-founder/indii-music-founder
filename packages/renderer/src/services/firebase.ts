import { logger } from '@/utils/logger';

// CRITICAL: Set App Check debug token BEFORE any Firebase SDK initialization
// This must happen in the module scope before any Firebase services load
// In Electron, use debug token to allow development without blocking Referer headers
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    const key = ['FIREBASE', 'APPCHECK', 'DEBUG', 'TOKEN'].join('_');
    const isElectronEnv = typeof (window as any).electronAPI !== 'undefined';

    // Auto-prune stale E2E mock flags from persistent localStorage in local dev
    if (import.meta.env.VITE_FIREBASE_E2E_MOCK !== 'true' && import.meta.env.VITE_E2E !== 'true') {
        try {
            localStorage.removeItem('FIREBASE_E2E_MOCK');
        } catch {
            // ignore
        }
    }

    // Use the registered debug token if available from env
    const debugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;

    // For Electron, use a valid debug token format (Firebase SDK will recognize this in debug mode)
    // Web browsers can leave it as `true` to trigger automatic token generation
    if (typeof (window as any)[key] !== 'string') {
        const val = debugToken || (isElectronEnv ? 'debug-token-electron-local-dev' : true);
        (window as unknown as Record<string, string | boolean>)[key] = val;
        (self as unknown as Record<string, string | boolean>)[key] = val;
    }
}

import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, connectAuthEmulator } from 'firebase/auth';

import { firebaseConfig, env } from '@/config/env';

import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider, CustomProvider } from 'firebase/app-check';
import { getRemoteConfig } from 'firebase/remote-config';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { getE2EMockUser, isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

// If Firebase config is missing critical keys, log clearly and continue with empty config.
// The app will show the login screen with an auth error rather than crashing.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    logger.error('[Firebase] CRITICAL: Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env. Auth will not work.');
}

export const app = initializeApp(firebaseConfig);
const isLocalhostDev = typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// ============================================================================
// LAZY Firebase Autonomous Initialization
// Only initialize when App Check is configured to avoid Installations API errors
// ============================================================================
export type Autonomous = never;

/**
 * Get the Firebase Autonomous instance. Returns null if App Check is not configured,
 * which signals FirebaseIntelligenceService to use direct Gemini SDK fallback.
 * Allows passing an optional location (e.g. 'us-central1') for dynamic Vertex routing.
 */
export function getFirebaseAI(location?: string): Autonomous | null {
    void location;
    logger.debug('[Firebase] Browser Firebase AI SDK is disabled; AI requests must use backend Cloud Function gateways.');
    return null;
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

    const isDev = env.DEV;
    const useEmulator = env.VITE_USE_FUNCTIONS_EMULATOR === 'true';

    if (isDev && useEmulator && typeof window !== 'undefined') {
        try {
            connectFirestoreEmulator(db, '127.0.0.1', 8080);
            logger.debug('[Firebase] Connected to Firestore emulator on port 8080');
            connectStorageEmulator(storage, '127.0.0.1', 9199);
            logger.debug('[Firebase] Connected to Storage emulator on port 9199');
        } catch (e: unknown) {
            logger.warn('[Firebase] Emulators connection skipped:', e);
        }
    }
} catch (e) {
    logger.error('[Firebase] Failed to initialize core services (likely missing config):', e);
}

import { Auth, User } from 'firebase/auth';
let rawAuth: Auth;
if (isFirebaseE2EMockEnabled()) {
    logger.debug('[Firebase] Using E2E Auth Mock');
    
    let currentMockUser = getE2EMockUser<User>();
    const authStateListeners: ((user: User | null) => void)[] = [];
    
    const notifyListeners = () => {
        authStateListeners.forEach(cb => cb(currentMockUser));
    };

    const clearSignedOutFlag = () => {
        try {
            localStorage.removeItem('FIREBASE_E2E_SIGNED_OUT');
        } catch {
            // ignore
        }
    };

    const setSignedOutFlag = () => {
        try {
            localStorage.setItem('FIREBASE_E2E_SIGNED_OUT', '1');
        } catch {
            // ignore
        }
    };

    rawAuth = {
        app,
        _signedOut: false,
        get currentUser() { return currentMockUser; },
        onAuthStateChanged: (cb: (user: User | null) => void) => {
            authStateListeners.push(cb);
            setTimeout(() => cb(currentMockUser), 100);
            return () => { 
                const idx = authStateListeners.indexOf(cb);
                if (idx > -1) authStateListeners.splice(idx, 1);
            };
        },
        signInAnonymously: async () => {
            clearSignedOutFlag();
            currentMockUser = getE2EMockUser<User>();
            (rawAuth as Auth & { _signedOut?: boolean })._signedOut = false;
            notifyListeners();
            return { user: currentMockUser };
        },
        signInWithEmailAndPassword: async () => {
            clearSignedOutFlag();
            currentMockUser = getE2EMockUser<User>();
            (rawAuth as Auth & { _signedOut?: boolean })._signedOut = false;
            notifyListeners();
            return { user: currentMockUser };
        },
        createUserWithEmailAndPassword: async () => {
            clearSignedOutFlag();
            currentMockUser = getE2EMockUser<User>();
            (rawAuth as Auth & { _signedOut?: boolean })._signedOut = false;
            notifyListeners();
            return { user: currentMockUser };
        },
        sendPasswordResetEmail: async (email: string) => {
            logger.debug(`[AuthMock] sendPasswordResetEmail requested for ${email}`);
            return Promise.resolve();
        },
        signInWithPopup: async () => {
            clearSignedOutFlag();
            currentMockUser = getE2EMockUser<User>();
            (rawAuth as Auth & { _signedOut?: boolean })._signedOut = false;
            notifyListeners();
            return { user: currentMockUser };
        },
        signOut: async () => {
            setSignedOutFlag();
            currentMockUser = null;
            (rawAuth as Auth & { _signedOut?: boolean })._signedOut = true;
            notifyListeners();
        },
    } as unknown as Auth;
} else {
    try {
        rawAuth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
        });

        // Connect to Auth emulator in dev mode
        if (env.DEV && env.VITE_USE_FUNCTIONS_EMULATOR === 'true' && typeof window !== 'undefined') {
            try {
                connectAuthEmulator(rawAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
                logger.debug('[Firebase] Connected to Auth emulator on port 9099');
            } catch (e: unknown) {
                logger.warn('[Firebase] Auth emulator connection skipped:', e);
            }
        }
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
            logger.debug('[AuthProxy] currentUser getter accessed.', {
                _signedOut: (target as Auth & { _signedOut?: boolean })._signedOut,
                targetCurrentUser: target.currentUser ? target.currentUser.uid : 'null',
                isE2EMockEnabled: isFirebaseE2EMockEnabled()
            });
            if ((target as Auth & { _signedOut?: boolean })._signedOut) {
                logger.debug('[AuthProxy] _signedOut is true, returning null');
                return null;
            }
            const realUser = target.currentUser;
            if (realUser) {
                logger.debug('[AuthProxy] realUser is found, returning:', realUser.uid);
                return realUser;
            }

            const mockUser = getE2EMockUser<User>();
            if (mockUser) {
                logger.debug('[AuthProxy] mockUser is found, returning:', mockUser.uid);
                return mockUser;
            }
            logger.debug('[AuthProxy] returning null');
            return null;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
    }
});

export { auth };

try {
    functions = getFunctions(app); // Default (us-central1)
    // Legacy aliases kept for existing imports. They intentionally point to the
    // primary us-central1 client so region drift cannot reappear through aliases.
    functionsWest1 = functions;

    const isDev = env.DEV;
    const useEmulator = env.VITE_USE_FUNCTIONS_EMULATOR === 'true';

    if (isDev && useEmulator && typeof window !== 'undefined') {
        try {
            connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            logger.debug('[Firebase] Connected to Functions emulator on port 5001');
        } catch (e: unknown) {
            logger.warn('[Firebase] Functions emulator connection skipped:', e);
        }
    }
} catch (e) {
    logger.error('[Firebase] Failed to initialize Functions:', e);
}

// Export after functions initialization
export { db, storage, functions, functionsWest1 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let remoteConfig: any = null;
try {
    if (!isLocalhostDev) {
        // Initialize Remote Config
        remoteConfig = getRemoteConfig(app);
        remoteConfig.defaultConfig = {
            model_name: INTELLIGENCE_MODELS.TEXT.FAST,
            vertex_location: 'global'
        };
    }
} catch (e) {
    logger.error('[Firebase] Failed to initialize RemoteConfig:', e);
}
export { remoteConfig };

// Initialize Messaging (Client-side only)
// LAZY: Use isSupported() guard to prevent FirebaseError on browsers that lack
// Service Worker / Push API (e.g. Chrome iOS). Sentry fix 2026-04-15.
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import type { Messaging } from 'firebase/messaging';
import { Logger } from '@/core/logger/Logger';

const TAG = 'firebase';


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

// Use getFirebaseMessaging() function below instead of direct messaging export

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
    if (!isLocalhostDev) {
        getFirebasePerf();
    }
}

// Initialize App Check
let appCheck = null;
if (typeof window !== 'undefined') {
    // Debug token is already set at module scope (see top of file)
    // This ensures the Installations API uses the debug token before any Firebase service loads

    if (env.DEV) {
        logger.debug('[App Check] Auto-debug mode enabled (check console for debug token)');
    }

    // SECURITY: Warn in production if App Check is not configured
    // This is a critical security control - App Check prevents unauthorized API access
    if (!env.DEV && !env.appCheckKey) {
        const errorMessage = 'SECURITY WARNING: App Check key missing in production. Application running without App Check.';
        logger.warn(errorMessage);
    }

    // Initialize App Check if we have a valid key
    const isElectron = !!window.electronAPI;

    // Logic:
    // 1. Must have a key.
    // 2. Electron uses a CustomProvider backed by a Cloud Function since ReCaptcha requires a web origin.
    // 3. CRITICAL: In DEV mode with Functions emulator, skip App Check entirely to avoid Installations API blocking.
    const skipAppCheckInEmulator = env.DEV && (
        env.VITE_USE_FUNCTIONS_EMULATOR === 'true' ||
        isLocalhostDev
    );
    const shouldInitAppCheck = !skipAppCheckInEmulator && !!env.appCheckKey;

    if (skipAppCheckInEmulator) {
        logger.info('[App Check] Skipped in emulator mode (dev: true, emulator: true). Auth/Firestore will work without App Check validation.');
    } else if (shouldInitAppCheck) {
        if (env.DEV && isLocalhostDev && !isElectron) {
            Logger.warn(TAG,
                '[indii][AppCheck] Running on localhost without a debug token.\n' +
                'Google Maps and other protected services will fail until you:\n' +
                '1. Check the console for "App Check debug token: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"\n' +
                '2. Register this token in the Firebase Console under App Check > Manage Debug Tokens.'
            );
        }

        try {
            const provider = isElectron
              ? new CustomProvider({
                  getToken: async () => {
                      if (!auth.currentUser) {
                          logger.warn('[App Check] Cannot mint token: User not authenticated yet.');
                          throw new Error('User not authenticated');
                      }
                      try {
                          const mintFn = httpsCallable<{appId: string}, {token: string, expireTimeMillis: number}>(functions, 'mintElectronAppCheckToken');
                          const result = await mintFn({ appId: firebaseConfig.appId });
                          return result.data;
                      } catch (err) {
                          logger.error('[App Check] Failed to mint custom token:', err);
                          throw err;
                      }
                  }
              })
              : new ReCaptchaEnterpriseProvider(env.appCheckKey!);

            appCheck = initializeAppCheck(app, {
                provider,
                isTokenAutoRefreshEnabled: true
            });
            logger.info(isElectron ? '[App Check] Initialized custom provider for Electron' : '[App Check] Initialized successfully');
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
