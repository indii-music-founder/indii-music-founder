// src/services/firebase.appcheck.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unmock the module under test (mocked globally in setup.ts)
vi.unmock('@/services/firebase');
vi.unmock('./firebase'); // Just to be safe

// Hoisted mocks for proper reference tracking
const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
  initializeApp: vi.fn(() => ({
    serverTimestamp: vi.fn(), name: 'mock-app', options: {}
  })),
  initializeAppCheck: vi.fn(),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  serverTimestamp: vi.fn(),
  initializeApp: mocks.initializeApp
}));

vi.mock('firebase/app-check', () => ({
  serverTimestamp: vi.fn(),
  initializeAppCheck: mocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: mocks.ReCaptchaEnterpriseProvider
}));

// Mock other firebase modules to avoid errors during import
vi.mock('firebase/auth', () => ({
  serverTimestamp: vi.fn(),
  getAuth: vi.fn(),
  initializeAuth: vi.fn(() => ({
    serverTimestamp: vi.fn(), currentUser: null, onAuthStateChanged: vi.fn()
  })),
  browserLocalPersistence: {},
  browserSessionPersistence: {},
  indexedDBLocalPersistence: {}
}));
vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
  initializeFirestore: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  persistentLocalCache: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  persistentMultipleTabManager: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  getFirestore: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  doc: vi.fn(),
  setDoc: vi.fn()
}));
vi.mock('firebase/storage', () => ({
  serverTimestamp: vi.fn(),
  getStorage: vi.fn()
}));
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
  getFunctions: vi.fn(() => ({
    serverTimestamp: vi.fn(),
  })),
  httpsCallable: vi.fn()
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
  onMessage: vi.fn()
}));

describe('Firebase App Check Initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

    await import('./firebase');

    expect(mocks.initializeAppCheck).toHaveBeenCalled();
    expect(mocks.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-key');
  });

  it('should NOT initialize App Check in Electron environment (no debug token)', async () => {
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });

    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
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
    Object.defineProperty(window, 'electronAPI', { value: {}, writable: true, configurable: true });

    vi.doMock('@/config/env', () => ({
      serverTimestamp: vi.fn(),
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
