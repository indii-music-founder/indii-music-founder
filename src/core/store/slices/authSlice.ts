import { logger } from '@/utils/logger';

import { StateCreator } from 'zustand';
import {
    Auth,
    User,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    sendPasswordResetEmail
} from 'firebase/auth';

/** Minimal interface for E2E mock auth objects that provide their own listener */
interface E2EMockAuth {
    onAuthStateChanged: (callback: (user: User | null) => void) => () => void;
}

/**
 * Enhanced auth listener with E2E mock support.
 * Ensures that if a mock auth object provides its own listener, we use it.
 */
const onAuthStateChanged = (authObj: Auth | E2EMockAuth, callback: (user: User | null) => void) => {
    if (typeof (authObj as E2EMockAuth).onAuthStateChanged === 'function') {
        return (authObj as E2EMockAuth).onAuthStateChanged(callback);
    }
    return firebaseOnAuthStateChanged(authObj as Auth, callback);
};
import { auth, db } from '@/services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/** Type guard for Firebase Auth errors */
interface FirebaseAuthError {
    code: string;
    message: string;
}

/**
 * Maps a Firebase Auth error code to a user-friendly message.
 * Centralised to avoid duplicating error strings across every auth method.
 */
function getAuthErrorMessage(error: FirebaseAuthError): string | null {
    switch (error.code) {
        // ── Config / service issues ────────────────────────────────────────
        case 'auth/argument-error':
        case 'auth/invalid-api-key':
            return 'Authentication service unavailable. Please try again later.';

        // ── Popup dismissed (not a real error — user cancelled) ────────────
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return null; // Suppress — the user intentionally dismissed the dialog

        // ── Credential errors ──────────────────────────────────────────────
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password. Please try again.';

        // ── Sign-up specific ───────────────────────────────────────────────
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try signing in instead.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';

        // ── Rate limiting ──────────────────────────────────────────────────
        case 'auth/too-many-requests':
            return 'Too many sign-in attempts. Please wait a few minutes and try again.';

        // ── Network ────────────────────────────────────────────────────────
        case 'auth/network-request-failed':
            return 'Network error. Check your internet connection and try again.';

        // ── Account disabled ───────────────────────────────────────────────
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact support for help.';

        // ── Admin-restricted (sign-in provider not enabled) ────────────────
        case 'auth/admin-restricted-operation':
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled. Contact administrator.';

        // ── Re-authentication required (stale session for destructive ops) ─
        case 'auth/requires-recent-login':
            return 'Your session has expired. Please sign in again before making this change.';

        // ── Fallback ───────────────────────────────────────────────────────
        default:
            return error.message ?? 'Authentication failed';
    }
}

// Define the shape of our Auth state
export interface AuthSlice {
    user: User | null;
    authLoading: boolean;
    authError: string | null;
    isSignUpMode: boolean;
    passwordResetSent: boolean;

    // Actions
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    setSignUpMode: (isSignUp: boolean) => void;
    clearAuthError: () => void;
    initializeAuthListener: () => () => void;
}

// Create the slice
export const createAuthSlice: StateCreator<AuthSlice> = (set, _get) => ({
    user: null,
    authLoading: true,
    authError: null,
    isSignUpMode: false,
    passwordResetSent: false,

    loginWithGoogle: async () => {
        try {
            set({ authLoading: true, authError: null });
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const errorMessage = getAuthErrorMessage(firebaseError);
            // If errorMessage is null (popup dismissed), reset loading but don't show an error
            if (errorMessage === null) {
                set({ authLoading: false });
            } else {
                set({ authError: errorMessage, authLoading: false });
            }
        }
    },

    loginWithEmail: async (email: string, pass: string) => {
        try {
            set({ authLoading: true, authError: null });
            await signInWithEmailAndPassword(auth, email, pass);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const errorMessage = getAuthErrorMessage(firebaseError);
            set({ authError: errorMessage ?? 'Sign-in failed', authLoading: false });
            throw error;
        }
    },

    signUpWithEmail: async (email: string, pass: string) => {
        try {
            set({ authLoading: true, authError: null });
            await createUserWithEmailAndPassword(auth, email, pass);
            // State update handled by listener — initializeAuthListener will create the user doc
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const errorMessage = getAuthErrorMessage(firebaseError);
            set({ authError: errorMessage ?? 'Account creation failed', authLoading: false });
            throw error;
        }
    },

    loginAsGuest: async () => {
        if (!import.meta.env.DEV) {
            throw new Error('Guest login is only available in development mode.');
        }
        try {
            set({ authLoading: true, authError: null });
            await signInAnonymously(auth);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            let errorMessage: string;
            if (firebaseError.code === 'auth/admin-restricted-operation') {
                errorMessage = 'Anonymous Auth is disabled. Enable it in Firebase Console → Authentication → Sign-in method → Anonymous.';
            } else {
                // Use the centralised message mapper for everything else
                errorMessage = getAuthErrorMessage(firebaseError) ?? 'Guest login failed';
            }
            set({ authError: errorMessage, authLoading: false });
        }
    },

    resetPassword: async (email: string) => {
        try {
            set({ authLoading: true, authError: null, passwordResetSent: false });
            await sendPasswordResetEmail(auth, email);
            set({ authLoading: false, passwordResetSent: true });
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            let errorMessage: string;

            switch (firebaseError.code) {
                case 'auth/user-not-found':
                    // Security: Don't reveal whether the email exists.
                    // Still show "success" to prevent enumeration attacks.
                    set({ authLoading: false, passwordResetSent: true });
                    return;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many requests. Please wait a few minutes before trying again.';
                    break;
                default:
                    errorMessage = getAuthErrorMessage(firebaseError) ?? 'Failed to send reset email. Please try again.';
            }
            set({ authError: errorMessage, authLoading: false });
        }
    },

    setSignUpMode: (isSignUp: boolean) => {
        set({ isSignUpMode: isSignUp, authError: null, passwordResetSent: false });
    },

    clearAuthError: () => {
        set({ authError: null });
    },

    logout: async () => {
        try {
            await signOut(auth);

            // ST9: Clear cache on logout to prevent stale data cross-contamination
            const { cacheService } = await import('@/services/cache/CacheService');
            cacheService.clear();

            // Clear all active Firestore subscriptions to prevent permission errors
            import('@/core/store').then(({ useStore }) => {
                useStore.getState().clearAllSubscriptions();
            }).catch(err => logger.error('[Auth] Failed to clear subscriptions during logout:', err));

            set({ user: null, authError: null, isSignUpMode: false, passwordResetSent: false });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Logout failed';
            set({ authError: message });
        }
    },

    initializeAuthListener: () => {
        logger.debug('[Auth] Initializing Auth Listener...');

        // FAST FAIL: If no API key, don't wait for Firebase (it might hang or crash)
        // EXCLUSION: If we are using the E2E mock, allow any API key string.
        const apiKey = auth.app?.options?.apiKey;
        const apiKeyLower = apiKey?.toLowerCase() ?? '';
        const isE2EMock = typeof window !== 'undefined' && (window as unknown as Record<string, boolean>).FIREBASE_E2E_MOCK;

        if (!isE2EMock && (!apiKey || apiKeyLower.includes('fake') || apiKeyLower.includes('bypass') || apiKeyLower.includes('mock') || apiKeyLower.includes('your_'))) {
            logger.warn('[Auth] No valid API Key found and not in E2E mode.');
            set({ authLoading: false });
            return () => { };
        }

        // TIMEOUT FAILSAFE: If onAuthStateChanged never fires (API key blocked,
        // network down, SDK error), fall through to login after 10s instead of
        // spinning forever. See: API_KEY_SERVICE_BLOCKED incident 2026-03-11.
        let hasResolved = false;
        const timeoutId = setTimeout(() => {
            if (!hasResolved) {
                logger.error('[Auth] Auth listener timed out after 10s — falling through to login.');
                set({
                    authLoading: false,
                    authError: 'Authentication timed out. The service may be temporarily unavailable. Please try again.',
                });
            }
        }, 10_000);

        // BUG-002 FIX: Debounce rapid null→user transitions during token refresh.
        // Firebase may briefly emit null between token refresh cycles,
        // causing spurious logouts under rapid load (100+ clicks/sec).
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let lastKnownUser: typeof auth.currentUser = null;

        // Return unsubscribe function
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (isE2EMock) {
                logger.debug('[Auth] Mock Auth Listener Fired', { userUid: user?.uid });
            }
            hasResolved = true;
            clearTimeout(timeoutId);

            // If transitioning FROM a valid user TO null, debounce it.
            // This prevents the brief null flash during Firebase Auth token refresh.
            if (!user && lastKnownUser) {
                logger.debug('[Auth] User went null — debouncing for 500ms to guard against token refresh race...');
                debounceTimer = setTimeout(() => {
                    // Re-check: if auth.currentUser is STILL null after 500ms,
                    // it's a genuine logout — not a token refresh blip.
                    if (!auth.currentUser) {
                        logger.info('[Auth] Confirmed logout after debounce.');
                        lastKnownUser = null;
                        set({ user: null, authLoading: false });
                    } else {
                        logger.debug('[Auth] Token refresh resolved — user is still authenticated.');
                        lastKnownUser = auth.currentUser;
                        set({ user: auth.currentUser, authLoading: false });
                    }
                }, 500);
                return;
            }

            // Clear any pending debounce if we received a valid user
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }

            lastKnownUser = user;
            set({ user, authLoading: false });

            if (user) {
                // Optional: Ensure user document exists in Firestore
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        await setDoc(userRef, {
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            createdAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        }, { merge: true });
                    } else {
                        // Update last login
                        await setDoc(userRef, {
                            lastLogin: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (e: unknown) {
                    logger.error("[Auth] Failed to sync user to Firestore", e);
                }
            }
        });

        return () => {
            clearTimeout(timeoutId);
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubscribe();
        };
    }
});
