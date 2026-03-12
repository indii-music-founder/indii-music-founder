
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from 'zustand';
import { createAuthSlice, AuthSlice } from './authSlice';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        app: {
            options: {
                apiKey: 'mock-api-key'
            }
        },
        // Mutable currentUser for debounce tests — starts null
        currentUser: null as any,
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
    let useStore: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        useStore = createStore<AuthSlice>((...a) => createAuthSlice(...a));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initial state should be loading with no user', () => {
        const state = useStore.getState();
        expect(state.user).toBeNull();
        expect(state.authLoading).toBe(true);
        expect(state.authError).toBeNull();
    });

    it('loginWithGoogle should call Firebase signInWithPopup', async () => {
        const { loginWithGoogle } = useStore.getState();

        await loginWithGoogle();

        expect(signInWithPopup).toHaveBeenCalled();
        expect(useStore.getState().authLoading).toBe(true); // Still loading until listener fires
    });

    it('loginWithGoogle should handle errors', async () => {
        const error = new Error('Popup closed');
        vi.mocked(signInWithPopup).mockRejectedValueOnce(error);
        const { loginWithGoogle } = useStore.getState();

        await loginWithGoogle();

        expect(useStore.getState().authError).toBe('Popup closed');
        expect(useStore.getState().authLoading).toBe(false);
    });

    it('logout should call Firebase signOut', async () => {
        const { logout } = useStore.getState();

        await logout();

        expect(signOut).toHaveBeenCalled();
        expect(useStore.getState().user).toBeNull();
    });

    it('initializeAuthListener should set user on state change', async () => {
        // Get reference to the mocked auth so we can mutate currentUser
        const { auth } = await import('@/services/firebase');

        const { initializeAuthListener } = useStore.getState();

        let authCallback: (user: any) => void = () => { };
        vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
            authCallback = cb as (user: any) => void;
            return () => { };
        });

        initializeAuthListener();

        // Simulate User Login
        const mockUser = { uid: '123', email: 'test@example.com' };
        (auth as any).currentUser = mockUser;
        authCallback(mockUser);

        expect(useStore.getState().user).toEqual(mockUser);
        expect(useStore.getState().authLoading).toBe(false);

        // Simulate Logout — with BUG-002 fix, null transitions are debounced by 500ms
        // to prevent spurious logouts during Firebase token refresh cycles.
        (auth as any).currentUser = null;
        authCallback(null);

        // User should NOT be null yet — debounce is in progress
        expect(useStore.getState().user).toEqual(mockUser);

        // Advance past the 500ms debounce window
        vi.advanceTimersByTime(500);

        // Now the logout should have taken effect
        expect(useStore.getState().user).toBeNull();
    });
});

