
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    auth: {},
    db: {}
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
        useStore = createStore<AuthSlice>((...a) => createAuthSlice(...a));
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

    it('initializeAuthListener should set user on state change', () => {
        const { initializeAuthListener } = useStore.getState();

        let authCallback: (user: any) => void = () => { };
        vi.mocked(onAuthStateChanged).mockImplementation((auth, cb) => {
            authCallback = cb as (user: any) => void;
            return () => { };
        });

        initializeAuthListener();

        // Simulate User Login
        const mockUser = { uid: '123', email: 'test@example.com' };
        authCallback(mockUser);

        expect(useStore.getState().user).toEqual(mockUser);
        expect(useStore.getState().authLoading).toBe(false);

        // Simulate Logout
        authCallback(null);
        expect(useStore.getState().user).toBeNull();
    });
});
