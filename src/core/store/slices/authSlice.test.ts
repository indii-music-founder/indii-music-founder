
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand';
import { createAuthSlice, AuthSlice } from './authSlice';
import type { UserCredential } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, sendPasswordResetEmail } from 'firebase/auth';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInAnonymously: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        app: {
            options: {
                apiKey: 'mock-api-key'
            }
        },
        // Mutable currentUser for debounce tests — starts null
        currentUser: null as unknown,
    },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Firestore (though mostly integration level, we test basic call)
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn()
}));

describe('AuthSlice', () => {
    let useStore: StoreApi<AuthSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        useStore = createStore<AuthSlice>((...a) => createAuthSlice(...a));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ============================================================================
    // Initial State
    // ============================================================================
    describe('initial state', () => {
        it('should be loading with no user', () => {
            const state = useStore.getState();
            expect(state.user).toBeNull();
            expect(state.authLoading).toBe(true);
            expect(state.authError).toBeNull();
            expect(state.passwordResetSent).toBe(false);
            expect(state.isSignUpMode).toBe(false);
        });
    });

    // ============================================================================
    // loginWithGoogle
    // ============================================================================
    describe('loginWithGoogle', () => {
        it('should call Firebase signInWithPopup', async () => {
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(signInWithPopup).toHaveBeenCalled();
            expect(useStore.getState().authLoading).toBe(true); // Still loading until listener fires
        });

        it('should handle generic errors with message', async () => {
            const error = Object.assign(new Error('Something broke'), { code: 'auth/internal-error' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(useStore.getState().authError).toBe('Something broke');
            expect(useStore.getState().authLoading).toBe(false);
        });

        it('should suppress popup-closed errors (not a real error)', async () => {
            const error = Object.assign(new Error('popup closed'), { code: 'auth/popup-closed-by-user' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            // Error should NOT be set (popup dismissed is not an error)
            expect(useStore.getState().authError).toBeNull();
            expect(useStore.getState().authLoading).toBe(false);
        });

        it('should suppress cancelled-popup-request errors', async () => {
            const error = Object.assign(new Error('cancelled'), { code: 'auth/cancelled-popup-request' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(useStore.getState().authError).toBeNull();
            expect(useStore.getState().authLoading).toBe(false);
        });

        it('should show user-friendly message for config errors', async () => {
            const error = Object.assign(new Error('invalid api key'), { code: 'auth/invalid-api-key' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(useStore.getState().authError).toBe('Authentication service unavailable. Please try again later.');
        });

        it('should show user-friendly message for too-many-requests', async () => {
            const error = Object.assign(new Error('too many'), { code: 'auth/too-many-requests' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(useStore.getState().authError).toBe('Too many sign-in attempts. Please wait a few minutes and try again.');
        });

        it('should show user-friendly message for network failures', async () => {
            const error = Object.assign(new Error('network'), { code: 'auth/network-request-failed' });
            vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
            const { loginWithGoogle } = useStore.getState();

            await loginWithGoogle();

            expect(useStore.getState().authError).toBe('Network error. Check your internet connection and try again.');
        });
    });

    // ============================================================================
    // loginWithEmail
    // ============================================================================
    describe('loginWithEmail', () => {
        it('should call Firebase signInWithEmailAndPassword', async () => {
            vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as unknown as UserCredential);
            const { loginWithEmail } = useStore.getState();

            await loginWithEmail('test@example.com', 'password123');

            expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
        });

        it('should show user-friendly message for wrong password', async () => {
            const error = Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' });
            vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(error);
            const { loginWithEmail } = useStore.getState();

            await expect(loginWithEmail('test@example.com', 'wrong')).rejects.toThrow();

            expect(useStore.getState().authError).toBe('Incorrect email or password. Please try again.');
            expect(useStore.getState().authLoading).toBe(false);
        });

        it('should show user-friendly message for invalid-credential', async () => {
            const error = Object.assign(new Error('invalid'), { code: 'auth/invalid-credential' });
            vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(error);
            const { loginWithEmail } = useStore.getState();

            await expect(loginWithEmail('test@example.com', 'wrong')).rejects.toThrow();

            expect(useStore.getState().authError).toBe('Incorrect email or password. Please try again.');
        });

        it('should show user-friendly message for disabled account', async () => {
            const error = Object.assign(new Error('disabled'), { code: 'auth/user-disabled' });
            vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(error);
            const { loginWithEmail } = useStore.getState();

            await expect(loginWithEmail('test@example.com', 'password')).rejects.toThrow();

            expect(useStore.getState().authError).toBe('This account has been disabled. Contact support for help.');
        });
    });

    // ============================================================================
    // signUpWithEmail
    // ============================================================================
    describe('signUpWithEmail', () => {
        it('should call Firebase createUserWithEmailAndPassword', async () => {
            vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({} as unknown as UserCredential);
            const { signUpWithEmail } = useStore.getState();

            await signUpWithEmail('new@example.com', 'password123');

            expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'new@example.com', 'password123');
        });

        it('should show user-friendly message for email-already-in-use', async () => {
            const error = Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
            vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(error);
            const { signUpWithEmail } = useStore.getState();

            await expect(signUpWithEmail('existing@example.com', 'password123')).rejects.toThrow();

            expect(useStore.getState().authError).toBe('An account with this email already exists. Try signing in instead.');
        });

        it('should show user-friendly message for weak-password', async () => {
            const error = Object.assign(new Error('weak'), { code: 'auth/weak-password' });
            vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(error);
            const { signUpWithEmail } = useStore.getState();

            await expect(signUpWithEmail('new@example.com', '123')).rejects.toThrow();

            expect(useStore.getState().authError).toBe('Password must be at least 6 characters.');
        });
    });

    // ============================================================================
    // loginAsGuest
    // ============================================================================
    describe('loginAsGuest', () => {
        it('should call Firebase signInAnonymously', async () => {
            vi.mocked(signInAnonymously).mockResolvedValueOnce({} as unknown as UserCredential);
            const { loginAsGuest } = useStore.getState();

            await loginAsGuest();

            expect(signInAnonymously).toHaveBeenCalled();
        });

        it('should show admin-restricted error for disabled anonymous auth', async () => {
            const error = Object.assign(new Error('restricted'), { code: 'auth/admin-restricted-operation' });
            vi.mocked(signInAnonymously).mockRejectedValueOnce(error);
            const { loginAsGuest } = useStore.getState();

            await loginAsGuest();

            expect(useStore.getState().authError).toContain('Anonymous Auth is disabled');
        });

        it('should use centralised error mapper for other errors', async () => {
            const error = Object.assign(new Error('rate limited'), { code: 'auth/too-many-requests' });
            vi.mocked(signInAnonymously).mockRejectedValueOnce(error);
            const { loginAsGuest } = useStore.getState();

            await loginAsGuest();

            expect(useStore.getState().authError).toBe('Too many sign-in attempts. Please wait a few minutes and try again.');
        });
    });

    // ============================================================================
    // resetPassword
    // ============================================================================
    describe('resetPassword', () => {
        it('should call Firebase sendPasswordResetEmail and set passwordResetSent', async () => {
            vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(undefined);
            const { resetPassword } = useStore.getState();

            await resetPassword('user@example.com');

            expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'user@example.com');
            expect(useStore.getState().passwordResetSent).toBe(true);
            expect(useStore.getState().authLoading).toBe(false);
            expect(useStore.getState().authError).toBeNull();
        });

        it('should NOT reveal account non-existence (anti-enumeration)', async () => {
            const error = Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
            vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(error);
            const { resetPassword } = useStore.getState();

            await resetPassword('nonexistent@example.com');

            // Should still show "success" to prevent email enumeration attacks
            expect(useStore.getState().passwordResetSent).toBe(true);
            expect(useStore.getState().authError).toBeNull();
        });

        it('should show error for invalid email', async () => {
            const error = Object.assign(new Error('invalid'), { code: 'auth/invalid-email' });
            vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(error);
            const { resetPassword } = useStore.getState();

            await resetPassword('not-an-email');

            expect(useStore.getState().passwordResetSent).toBe(false);
            expect(useStore.getState().authError).toBe('Please enter a valid email address.');
        });

        it('should show error for too-many-requests', async () => {
            const error = Object.assign(new Error('too many'), { code: 'auth/too-many-requests' });
            vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(error);
            const { resetPassword } = useStore.getState();

            await resetPassword('user@example.com');

            expect(useStore.getState().passwordResetSent).toBe(false);
            expect(useStore.getState().authError).toContain('Too many requests');
        });
    });

    // ============================================================================
    // clearAuthError
    // ============================================================================
    describe('clearAuthError', () => {
        it('should clear authError', () => {
            useStore.setState({ authError: 'Some error' });
            const { clearAuthError } = useStore.getState();

            clearAuthError();

            expect(useStore.getState().authError).toBeNull();
        });
    });

    // ============================================================================
    // setSignUpMode
    // ============================================================================
    describe('setSignUpMode', () => {
        it('should clear authError and passwordResetSent when switching modes', () => {
            useStore.setState({ authError: 'Some error', passwordResetSent: true });
            const { setSignUpMode } = useStore.getState();

            setSignUpMode(true);

            expect(useStore.getState().isSignUpMode).toBe(true);
            expect(useStore.getState().authError).toBeNull();
            expect(useStore.getState().passwordResetSent).toBe(false);
        });
    });

    // ============================================================================
    // logout
    // ============================================================================
    describe('logout', () => {
        it('should call Firebase signOut and clear state', async () => {
            const { logout } = useStore.getState();

            await logout();

            expect(signOut).toHaveBeenCalled();
            expect(useStore.getState().user).toBeNull();
            expect(useStore.getState().passwordResetSent).toBe(false);
        });
    });

    // ============================================================================
    // initializeAuthListener
    // ============================================================================
    describe('initializeAuthListener', () => {
        it('should set user on state change', async () => {
            // Get reference to the mocked auth so we can mutate currentUser
            const { auth } = await import('@/services/firebase');

            const { initializeAuthListener } = useStore.getState();

            let authCallback: (user: unknown) => void = () => { };
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
                authCallback = cb as (user: unknown) => void;
                return () => { };
            });

            initializeAuthListener();

            // Simulate User Login
            const mockUser = { uid: '123', email: 'test@example.com' };
            (auth as unknown as Record<string, unknown>).currentUser = mockUser;
            authCallback(mockUser);

            expect(useStore.getState().user).toEqual(mockUser);
            expect(useStore.getState().authLoading).toBe(false);

            // Simulate Logout — with BUG-002 fix, null transitions are debounced by 500ms
            // to prevent spurious logouts during Firebase token refresh cycles.
            (auth as unknown as Record<string, unknown>).currentUser = null;
            authCallback(null);

            // User should NOT be null yet — debounce is in progress
            expect(useStore.getState().user).toEqual(mockUser);

            // Advance past the 500ms debounce window
            vi.advanceTimersByTime(500);

            // Now the logout should have taken effect
            expect(useStore.getState().user).toBeNull();
        });

        it('should return early with authLoading=false when API key is fake', async () => {
            const { auth } = await import('@/services/firebase');
            Object.assign(auth.app.options, { apiKey: 'AIzaSy_FAKE_KEY_FOR_DEV_BYPASS_00000000' });

            const { initializeAuthListener } = useStore.getState();
            const unsubscribe = initializeAuthListener();

            expect(useStore.getState().authLoading).toBe(false);
            expect(onAuthStateChanged).not.toHaveBeenCalled();
            unsubscribe();

            // Restore
            Object.assign(auth.app.options, { apiKey: 'mock-api-key' });
        });

        it('should timeout after 10s if onAuthStateChanged never fires', async () => {
            vi.mocked(onAuthStateChanged).mockImplementation(() => {
                // Never call the callback — simulating a hung SDK
                return () => { };
            });

            const { initializeAuthListener } = useStore.getState();
            initializeAuthListener();

            // Initially still loading
            expect(useStore.getState().authLoading).toBe(true);

            // Advance past the 10s timeout
            vi.advanceTimersByTime(10_000);

            expect(useStore.getState().authLoading).toBe(false);
            expect(useStore.getState().authError).toContain('timed out');
        });

        it('should cancel debounce if valid user arrives during debounce window', async () => {
            const { auth } = await import('@/services/firebase');

            let authCallback: (user: unknown) => void = () => { };
            vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
                authCallback = cb as (user: unknown) => void;
                return () => { };
            });

            const { initializeAuthListener } = useStore.getState();
            initializeAuthListener();

            // Login
            const mockUser = { uid: '123', email: 'test@example.com' };
            (auth as unknown as Record<string, unknown>).currentUser = mockUser;
            authCallback(mockUser);
            expect(useStore.getState().user).toEqual(mockUser);

            // Trigger null (token refresh)
            (auth as unknown as Record<string, unknown>).currentUser = null;
            authCallback(null);

            // User still present (debounce active)
            expect(useStore.getState().user).toEqual(mockUser);

            // Token refresh resolves — user comes back before debounce expires
            const refreshedUser = { uid: '123', email: 'test@example.com', refreshed: true };
            (auth as unknown as Record<string, unknown>).currentUser = refreshedUser;
            authCallback(refreshedUser);

            // User should be the refreshed user immediately
            expect(useStore.getState().user).toEqual(refreshedUser);

            // Advance past debounce — should NOT cause logout
            vi.advanceTimersByTime(1000);
            expect(useStore.getState().user).toEqual(refreshedUser);
        });
    });
});

