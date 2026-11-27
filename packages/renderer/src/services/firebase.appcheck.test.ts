// src/services/firebase.appcheck.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unmock the module under test (mocked globally in setup.ts)
vi.unmock('@/services/firebase');
vi.unmock('./firebase'); // Just to be safe

// Hoisted mocks for proper reference tracking
const mocks = vi.hoisted(() => {
  const authState = {
    currentUser: null as unknown,
    idTokenCallbacks: [] as Array<(user: unknown) => void>,
    authStateReady: vi.fn(),
  };
  return {
    serverTimestamp: vi.fn(),
    initializeApp: vi.fn(() => ({
      serverTimestamp: vi.fn(), name: 'mock-app', options: {}
    })),
    initializeAppCheck: vi.fn(() => ({ app: { name: 'mock-app' } })),
    getAppCheckToken: vi.fn(() => Promise.resolve({ token: 'refreshed-app-check-token' })),
    ReCaptchaV3Provider: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn(),
    CustomProvider: vi.fn(function (opts: { getToken: () => Promise<{ token: string; expireTimeMillis: number }> }) {
      return opts;
    }),
    httpsCallable: vi.fn(),
    authState,
  };
});

vi.mock('firebase/app', () => ({
  serverTimestamp: vi.fn(),
  initializeApp: mocks.initializeApp
}));

vi.mock('firebase/app-check', () => ({
  serverTimestamp: vi.fn(),
  initializeAppCheck: mocks.initializeAppCheck,
  getToken: mocks.getAppCheckToken,
  ReCaptchaV3Provider: mocks.ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider: mocks.ReCaptchaEnterpriseProvider,
  CustomProvider: mocks.CustomProvider,
}));

// Mock other firebase modules to avoid errors during import
vi.mock('firebase/auth', () => ({
  serverTimestamp: vi.fn(),
  getAuth: vi.fn(),
  initializeAuth: vi.fn(() => ({
    serverTimestamp: vi.fn(),
    get currentUser() { return mocks.authState.currentUser; },
    onAuthStateChanged: vi.fn(),
    onIdTokenChanged: vi.fn((cb: (user: unknown) => void) => {
      mocks.authState.idTokenCallbacks.push(cb);
      return () => {};
    }),
    authStateReady: mocks.authState.authStateReady,
  })),
  connectAuthEmulator: vi.fn(),
  browserLocalPersistence: {},
  browserSessionPersistence: {},
  indexedDBLocalPersistence: {},
  browserPopupRedirectResolver: {},
}));
vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
  initializeFirestore: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  connectFirestoreEmulator: vi.fn(),
  persistentLocalCache: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  persistentMultipleTabManager: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  persistentSingleTabManager: vi.fn(() => ({ kind: 'single-tab' })),
  getFirestore: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  doc: vi.fn(),
  setDoc: vi.fn()
}));
vi.mock('firebase/storage', () => ({
  serverTimestamp: vi.fn(),
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn()
}));
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
  getFunctions: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: mocks.httpsCallable
}));
vi.mock('firebase/ai', () => ({
  serverTimestamp: vi.fn(),
  getAI: vi.fn(),
  VertexAIBackend: vi.fn().mockImplementation(() => ({
    serverTimestamp: vi.fn(),
  }))
}));
vi.mock('firebase/remote-config', () => ({
  serverTimestamp: vi.fn(),
  getRemoteConfig: vi.fn(() => ({
    serverTimestamp: vi.fn(), defaultConfig: {}
  }))
}));
vi.mock('firebase/messaging', () => ({
  serverTimestamp: vi.fn(),
  getMessaging: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  getToken: vi.fn(),
  onMessage: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(true))
}));

describe('Firebase App Check Initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.authState.currentUser = null;
    mocks.authState.idTokenCallbacks = [];
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it('should initialize App Check in standard web environment when key is present', async () => {
    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
      env: {
        appCheckKey: 'test-key',
        DEV: false
      },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));

    await import('@/services/firebase');

    expect(mocks.initializeAppCheck).toHaveBeenCalled();
    expect(mocks.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
  });

  it('initializes App Check with CustomProvider in Electron production environment', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });

    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
      env: {
        appCheckKey: 'test-key',
        DEV: false
      },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));

    await import('@/services/firebase');

    expect(mocks.initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mocks.CustomProvider).toHaveBeenCalledTimes(1);
    expect(mocks.ReCaptchaEnterpriseProvider).not.toHaveBeenCalled();
  });

  it('skips App Check in Electron dev emulator mode', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });

    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
      env: {
        appCheckKey: 'test-key',
        appCheckDebugToken: 'debug-token',
        DEV: true,
        VITE_USE_FUNCTIONS_EMULATOR: 'true'
      },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));

    await import('@/services/firebase');

    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('should NOT initialize App Check when key is a dummy or placeholder', async () => {
    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
      env: {
        appCheckKey: 'dummy',
        DEV: false
      },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));

    await import('@/services/firebase');

    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('gives each tab its own Firestore connection: single-tab cache, no forced ownership (ISSUE-1710)', async () => {
    vi.doMock('@/config/env', () => ({
      env: { appCheckKey: '', DEV: false },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));
    const firestore = await import('firebase/firestore');

    await import('@/services/firebase');

    expect(firestore.persistentSingleTabManager).toHaveBeenCalledWith({ forceOwnership: false });
    expect(firestore.persistentLocalCache).toHaveBeenCalledWith({ tabManager: { kind: 'single-tab' } });
    expect(firestore.persistentMultipleTabManager).not.toHaveBeenCalled();
  });

  it('rejects Electron CustomProvider.getToken immediately without calling authStateReady, getIdToken, httpsCallable, or fetch when user or fresh token is absent', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    vi.doMock('@/config/env', () => ({
      env: { appCheckKey: 'test-key', DEV: false, functionsRegion: 'us-central1' },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com', appId: '1:123:web:abc' }
    }));

    await import('@/services/firebase');

    const customProviderOpts = mocks.CustomProvider.mock.calls[0]?.[0] as { getToken: () => Promise<unknown> };
    expect(customProviderOpts).toBeDefined();

    // Case 1: currentUser is null
    await expect(customProviderOpts.getToken()).rejects.toThrow('Waiting for fresh Firebase Auth ID token');

    // Case 2: currentUser has an expired cached token (within 30s buffer)
    const getIdTokenSpy = vi.fn();
    mocks.authState.currentUser = {
      uid: 'u1',
      getIdToken: getIdTokenSpy,
      stsTokenManager: {
        accessToken: 'stale-token',
        expirationTime: Date.now() + 5_000,
      },
    };
    await expect(customProviderOpts.getToken()).rejects.toThrow('Waiting for fresh Firebase Auth ID token');

    expect(mocks.authState.authStateReady).not.toHaveBeenCalled();
    expect(getIdTokenSpy).not.toHaveBeenCalled();
    expect(mocks.httpsCallable).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('mints Electron App Check token via direct fetch with fresh cached ID token and never calls httpsCallable', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { token: 'minted-appcheck-jwt', expireTimeMillis: 9999999999999 } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    mocks.authState.currentUser = {
      uid: 'u1',
      stsTokenManager: {
        accessToken: 'fresh-id-token-123',
        expirationTime: Date.now() + 120_000,
      },
    };

    vi.doMock('@/config/env', () => ({
      env: { appCheckKey: 'test-key', DEV: false, functionsRegion: 'us-central1' },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com', appId: '1:123:web:abc' }
    }));

    await import('@/services/firebase');

    const customProviderOpts = mocks.CustomProvider.mock.calls[0]?.[0] as { getToken: () => Promise<unknown> };
    const result = await customProviderOpts.getToken();

    expect(result).toEqual({ token: 'minted-appcheck-jwt', expireTimeMillis: 9999999999999 });
    expect(mocks.httpsCallable).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://us-central1-test-proj.cloudfunctions.net/mintElectronAppCheckToken',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fresh-id-token-123',
        },
        body: JSON.stringify({ data: { appId: '1:123:web:abc' } }),
      }),
    );
  });

  it('proactively refreshes App Check when onIdTokenChanged fires with a fresh cached ID token in Electron', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });

    vi.doMock('@/config/env', () => ({
      env: { appCheckKey: 'test-key', DEV: false, functionsRegion: 'us-central1' },
      firebaseConfig: { apiKey: 'test', projectId: 'test-proj', authDomain: 'test.firebaseapp.com' }
    }));

    await import('@/services/firebase');

    expect(mocks.authState.idTokenCallbacks).toHaveLength(1);
    const cb = mocks.authState.idTokenCallbacks[0]!;
    cb({
      uid: 'u1',
      stsTokenManager: {
        accessToken: 'fresh-id-token-after-refresh',
        expirationTime: Date.now() + 120_000,
      },
    });

    await vi.waitFor(() => {
      expect(mocks.getAppCheckToken).toHaveBeenCalledWith(expect.any(Object), true);
    });
  });
});
