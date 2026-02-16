// src/services/firebase.appcheck.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for proper reference tracking
const mocks = vi.hoisted(() => ({
    initializeApp: vi.fn(() => ({ name: 'mock-app', options: {} })),
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn(),
}));

vi.mock('firebase/app', () => ({
    initializeApp: mocks.initializeApp
}));

vi.mock('firebase/app-check', () => ({
    initializeAppCheck: mocks.initializeAppCheck,
    ReCaptchaEnterpriseProvider: mocks.ReCaptchaEnterpriseProvider
}));

// Mock other firebase modules to avoid errors during import
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    initializeAuth: vi.fn(() => ({ currentUser: null, onAuthStateChanged: vi.fn() })),
    browserLocalPersistence: {},
    browserSessionPersistence: {},
    indexedDBLocalPersistence: {}
}));
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    setDoc: vi.fn()
}));
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn()
}));
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn()
}));
vi.mock('firebase/ai', () => ({
    getAI: vi.fn(),
    VertexAIBackend: vi.fn().mockImplementation(() => ({}))
}));
vi.mock('firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(() => ({ defaultConfig: {} }))
}));
vi.mock('firebase/messaging', () => ({
    getMessaging: vi.fn(() => ({})),
    getToken: vi.fn(),
    onMessage: vi.fn()
}));

describe('Firebase App Check Initialization', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (window as any).electronAPI;
    });

    it('should initialize App Check in standard web environment when key is present', async () => {
        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                DEV: false
            },
            firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
        }));

        await import('./firebase');

        expect(mocks.initializeAppCheck).toHaveBeenCalled();
        expect(mocks.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
    });

    it('should NOT initialize App Check in Electron environment (no debug token)', async () => {
        (window as any).electronAPI = {};

        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                DEV: false
            },
            firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
        }));

        await import('./firebase');

        expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
    });

    it('should initialize App Check in Electron environment WITH debug token', async () => {
        (window as any).electronAPI = {};

        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                appCheckDebugToken: 'debug-token',
                DEV: true
            },
            firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
        }));

        await import('./firebase');

        expect(mocks.initializeAppCheck).toHaveBeenCalled();
        expect(mocks.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
    });
});
