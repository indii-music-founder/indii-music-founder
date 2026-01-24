// src/services/firebase.appcheck.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks
const mockInitializeApp = vi.fn();
const mockInitializeAppCheck = vi.fn();
const mockReCaptchaEnterpriseProvider = vi.fn();

vi.mock('firebase/app', () => ({
    initializeApp: mockInitializeApp
}));

vi.mock('firebase/app-check', () => ({
    initializeAppCheck: mockInitializeAppCheck,
    ReCaptchaEnterpriseProvider: mockReCaptchaEnterpriseProvider
}));

// Mock other firebase modules to avoid errors during import
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    initializeAuth: vi.fn(),
    browserLocalPersistence: {},
    browserSessionPersistence: {}
}));
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    getFirestore: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn()
}));
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn()
}));
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));
vi.mock('firebase/ai', () => ({
    getAI: vi.fn(),
    VertexAIBackend: vi.fn()
}));
vi.mock('firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(() => ({ defaultConfig: {} }))
}));

describe('Firebase App Check Initialization', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        // Reset window properties
        delete (window as any).electronAPI;
    });

    it('should initialize App Check in standard web environment when key is present', async () => {
        // Mock Env
        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                DEV: false
            },
            firebaseConfig: { apiKey: 'test' }
        }));

        // Import the service
        await import('./firebase');

        expect(mockInitializeAppCheck).toHaveBeenCalled();
        expect(mockReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
    });

    it('should NOT initialize App Check in Electron environment (no debug token)', async () => {
        // Setup Electron environment
        (window as any).electronAPI = {};

        // Mock Env
        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                DEV: false
            },
            firebaseConfig: { apiKey: 'test' }
        }));

        // Import the service
        await import('./firebase');

        expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    });

    it('should initialize App Check in Electron environment WITH debug token', async () => {
        // Setup Electron environment
        (window as any).electronAPI = {};

        // Mock Env
        vi.doMock('@/config/env', () => ({
            env: {
                appCheckKey: 'test-key',
                appCheckDebugToken: 'debug-token',
                DEV: true
            },
            firebaseConfig: { apiKey: 'test' }
        }));

        // Import the service
        await import('./firebase');

        expect(mockInitializeAppCheck).toHaveBeenCalled();
        expect(mockReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
    });
});
