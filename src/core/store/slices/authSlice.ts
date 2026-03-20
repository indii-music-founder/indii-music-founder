import { logger } from '@/utils/logger';

import { StateCreator } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/** Type guard for Firebase Auth errors */
interface FirebaseAuthError {
    code: string;
    message: string;
}

// Define the shape of our Auth state
export interface AuthSlice {
    user: User | null;
    authLoading: boolean;
    authError: string | null;
    isSignUpMode: boolean;

    // Actions
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    setSignUpMode: (isSignUp: boolean) => void;
    initializeAuthListener: () => () => void;
}

// Create the slice
export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
    user: null,
    authLoading: true,
    authError: null,
    isSignUpMode: false,

    loginWithGoogle: async () => {
        try {
            set({ authLoading: true, authError: null });
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const isConfigError = firebaseError.code === 'auth/argument-error' || firebaseError.code === 'auth/invalid-api-key';
            const isPopupClosed = firebaseError.code === 'auth/popup-closed-by-user' || firebaseError.code === 'auth/cancelled-popup-request';
            const errorMessage = isConfigError
                ? "Authentication service unavailable. Please try again later."
                : isPopupClosed
                    ? null
                    : firebaseError.message ?? 'Authentication failed';
            set({ authError: errorMessage, authLoading: false });
        }
    },

    loginWithEmail: async (email: string, pass: string) => {
        try {
            set({ authLoading: true, authError: null });
            await signInWithEmailAndPassword(auth, email, pass);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const isConfigError = firebaseError.code === 'auth/argument-error' || firebaseError.code === 'auth/invalid-api-key';
            const errorMessage = isConfigError
                ? "Authentication service unavailable. Please try again later."
                : firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential'
                    ? 'Incorrect email or password. Please try again.'
                    : firebaseError.message ?? 'Authentication failed';
            set({ authError: errorMessage, authLoading: false });
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
            let errorMessage: string;
            switch (firebaseError.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'An account with this email already exists. Try signing in instead.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password must be at least 6 characters.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/argument-error':
                case 'auth/invalid-api-key':
                    errorMessage = 'Authentication service unavailable. Please try again later.';
                    break;
                case 'auth/admin-restricted-operation':
                    errorMessage = 'Email/Password sign-up is disabled. Enable it in Firebase Console → Authentication → Sign-in method → Email/Password.';
                    break;
                default:
                    errorMessage = firebaseError.message ?? 'Account creation failed';
            }
            set({ authError: errorMessage, authLoading: false });
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
            } else if (firebaseError.code === 'auth/argument-error' || firebaseError.code === 'auth/invalid-api-key') {
                errorMessage = 'Firebase Config Missing. Check .env file.';
            } else {
                errorMessage = firebaseError.message ?? 'Guest login failed';
            }
            set({ authError: errorMessage, authLoading: false });
        }
    },

    setSignUpMode: (isSignUp: boolean) => {
        set({ isSignUpMode: isSignUp, authError: null });
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

            set({ user: null, authError: null, isSignUpMode: false });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Logout failed';
            set({ authError: message });
        }
    },

    initializeAuthListener: () => {
        logger.debug('[Auth] Initializing Auth Listener...');

        // FAST FAIL: If no API key, don't wait for Firebase (it might hang or crash)
        const apiKey = auth.app.options.apiKey;
        if (!apiKey || apiKey.includes('Fake')) {
            logger.warn('[Auth] No valid API Key found.');
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
