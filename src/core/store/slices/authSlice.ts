
import { StateCreator } from 'zustand';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Define the shape of our Auth state
export interface AuthSlice {
    user: User | null;
    authLoading: boolean;
    authError: string | null;

    // Actions
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, pass: string) => Promise<void>;
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
        } catch (error: any) {
            // console.error("Login failed:", error);
            set({ authError: error.message, authLoading: false });
        }
    },

    loginWithEmail: async (email: string, pass: string) => {
        try {
            set({ authLoading: true, authError: null });
            await signInWithEmailAndPassword(auth, email, pass);
            // State update handled by listener
        } catch (error: any) {
            // console.error("Email login failed:", error);
            set({ authError: error.message, authLoading: false });
            throw error;
        }
    },

    logout: async () => {
        try {
            await signOut(auth);
            set({ user: null });
            // Profile clearing should be handled by ProfileSlice reacting to user=null
            // or we can invoke it here if we had access to the store actions
        } catch (error: any) {
            // console.error("Logout failed:", error);
            set({ authError: error.message });
        }
    },

    initializeAuthListener: () => {
        // SECURE: TEST_MODE only allowed in development builds AND with explicit env flag
        // This prevents production bypass via localStorage manipulation
        const isTestEnvironment =
            import.meta.env.DEV === true &&
            import.meta.env.VITE_ALLOW_TEST_MODE === 'true' &&
            typeof window !== 'undefined' &&
            localStorage.getItem('TEST_MODE') === 'true';

        if (isTestEnvironment) {
            console.warn('[Auth] TEST_MODE active - This should NEVER appear in production!');
            const mockUser = {
                uid: 'test-stress-user',
                email: 'stress@test.com',
                displayName: 'Stress Test User',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => { },
                getIdToken: async () => 'mock-token',
                getIdTokenResult: async () => ({ token: 'mock-token' } as any),
                reload: async () => { },
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null
            } as unknown as User;

            set({ user: mockUser, authLoading: false });
            return () => { }; // No-op unsubscribe for test mode
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
                } catch (e) {
                    // console.error("[Auth] Failed to sync user to Firestore", e);
                }
            }
        });
    }
});
