
import { StateCreator } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
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

    // Actions
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    initializeAuthListener: () => () => void;
}

// Create the slice
export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
    user: null,
    authLoading: true,
    authError: null,

    loginWithGoogle: async () => {
        try {
            set({ authLoading: true, authError: null });
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // State update handled by listener
        } catch (error: unknown) {
            const firebaseError = error as FirebaseAuthError;
            const isConfigError = firebaseError.code === 'auth/argument-error' || firebaseError.code === 'auth/invalid-api-key';
            const errorMessage = isConfigError
                ? "Firebase Config Missing. Check .env or use Guest Login."
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
                ? "Firebase Config Missing. Check .env or use Guest Login."
                : firebaseError.message ?? 'Authentication failed';
            set({ authError: errorMessage, authLoading: false });
            throw error;
        }
    },

    loginAsGuest: async () => {
        // SECURE: Guest login is disabled to enforce real authentication
        // ONLY permitted in DEV for testing/demo purposes
        if (!import.meta.env.DEV) {
            console.error('Guest login is disabled in production.');
            return;
        }

        // Create a mock Firebase User object
        const mockUser = {
            uid: 'guest-123',
            email: 'guest@indiios.com',
            displayName: 'Guest User',
            emailVerified: true,
            isAnonymous: true,
            metadata: {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
            },
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => 'mock-token',
            getIdTokenResult: async () => ({
                authTime: new Date().toISOString(),
                expirationTime: new Date().toISOString(),
                issuedAtTime: new Date().toISOString(),
                signInProvider: 'custom',
                signInSecondFactor: null,
                token: 'mock-token',
                claims: {}
            }),
            reload: async () => {},
            toJSON: () => ({}),
            phoneNumber: null,
            photoURL: null,
        } as unknown as User;

        set({ user: mockUser, authLoading: false, authError: null });
    },

    logout: async () => {
        try {
            await signOut(auth);
            set({ user: null });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Logout failed';
            set({ authError: message });
        }
    },

    initializeAuthListener: () => {
        console.log('[Auth] Initializing Auth Listener...');

        // FAST FAIL: If no API key, don't wait for Firebase (it might hang or crash)
        const apiKey = auth.app.options.apiKey;
        if (!apiKey || apiKey.includes('Fake')) {
            console.warn('[Auth] No valid API Key found.');
            set({ authLoading: false, authError: "Firebase Configuration Missing" });
            return () => { };
        }

        // Return unsubscribe function
        return onAuthStateChanged(auth, async (user) => {
            // Log removed (Platinum Polish)
            set({ user, authLoading: false });

            if (user) {
                // Optional: Ensure user document exists in Firestore
                // We could move this to ProfileSlice, but doing it here ensures
                // we have a base user record.
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        // console.info("[Auth] Creating new user profile for", user.uid);
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
                    console.error("[Auth] Failed to sync user to Firestore", e);
                }
            }
        });
    }
});
