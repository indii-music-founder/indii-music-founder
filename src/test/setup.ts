/* eslint-disable @typescript-eslint/no-explicit-any -- Utility/config types use any by design */
import { vi } from 'vitest';

// Only import DOM-specific modules when running in jsdom environment
if (typeof window !== 'undefined') {
    // @ts-expect-error - testing-library/jest-dom types not found in this environment
    await import('@testing-library/jest-dom');
    // @ts-expect-error - fake-indexeddb types not found in this environment
    await import('fake-indexeddb/auto');

    // Mock ResizeObserver
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    };

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => []),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
    });

    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

    // Mock getComputedStyle (jsdom limitation)
    if (!window.getComputedStyle || window.getComputedStyle.toString().includes('Not implemented')) {
        window.getComputedStyle = vi.fn().mockImplementation(() => ({
            getPropertyValue: vi.fn().mockReturnValue(''),
            removeProperty: vi.fn(),
            setProperty: vi.fn(),
            length: 0,
            item: vi.fn().mockReturnValue(''),
        }));
    }

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // Mock electronAPI
    Object.defineProperty(window, 'electronAPI', {
        writable: true,
        configurable: true,
        value: {
            showNotification: vi.fn(),
            sftp: {
                connectDistributor: vi.fn().mockResolvedValue({ success: true }),
                uploadRelease: vi.fn().mockResolvedValue({ success: true, url: 'sftp://mock' }),
                disconnect: vi.fn().mockResolvedValue({ success: true })
            }
        }
    });
}

// ============================================================================
// LOCALSTORAGE MOCK - Ensure localStorage is always available in tests
// ============================================================================
if (typeof globalThis.localStorage === 'undefined' || !(globalThis.localStorage?.getItem)) {
    const store: Record<string, string> = {};
    const localStorageMock = {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = String(value); }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true, configurable: true });
}

// ============================================================================
// FIREBASE MOCKS - Centralized for all test files
// ============================================================================

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (str: string) => str,
        i18n: {
            changeLanguage: () => new Promise(() => { }),
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    }
}));

// Mock the @/services/firebase module FIRST to prevent module-level initialization
// This is critical because firebase.ts has side effects that call real Firebase APIs at import time
vi.mock('@/services/firebase', () => ({
    app: { name: 'mock-app', options: {} },
    db: {},
    storage: {},
    auth: {
        currentUser: { uid: 'test-uid', email: 'test@test.com', getIdToken: vi.fn().mockResolvedValue('test-token') },
        onAuthStateChanged: vi.fn((callback) => {
            // Simulate immediate callback with authenticated user
            if (typeof callback === 'function') {
                setTimeout(() => callback({ uid: 'test-uid', email: 'test@test.com' }), 0);
            }
            return () => { }; // Return unsubscribe function
        }),
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn()
    },
    functions: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {} },
    messaging: null,
    appCheck: null,
    ai: { instance: null },
    getFirebaseAI: vi.fn(() => null)
}));

// Mock Firebase App
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({
        name: 'mock-app',
        options: {},
        delete: vi.fn()
    }))
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({
        currentUser: { uid: 'test-uid', email: 'test@test.com', getIdToken: vi.fn().mockResolvedValue('test-token') },
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(() => () => { })
    })),
    initializeAuth: vi.fn(() => ({
        currentUser: { uid: 'test-uid', email: 'test@test.com', getIdToken: vi.fn().mockResolvedValue('test-token') },
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(() => () => { })
    })),
    browserLocalPersistence: {},
    browserSessionPersistence: {},
    indexedDBLocalPersistence: {},
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInAnonymously: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    updateEmail: vi.fn().mockResolvedValue({}),
    updatePassword: vi.fn().mockResolvedValue({})
}));

// Mock the @/core/store module to provide a valid userProfile with ID for tests
vi.mock('@/core/store', () => {
    const mockState = {
        userProfile: { id: 'test-uid', email: 'test@test.com', displayName: 'Test User' },
        currentOrganizationId: 'org-123',
        organizations: [{ id: 'org-123', plan: 'enterprise' }],
        inventory: { assets: [] },
        app: { currentModule: 'dashboard' },
        auth: { status: 'authenticated' },
        backgroundJobs: [],
        isJobMonitorOpen: false,
        uploadQueue: [],
        isUploadQueueOpen: false,
        addJob: vi.fn(),
        updateJobProgress: vi.fn(),
        updateJobStatus: vi.fn(),
        removeJob: vi.fn(),
        clearCompletedJobs: vi.fn(),
        toggleJobMonitor: vi.fn(),
        addUploadItems: vi.fn(),
        updateUploadProgress: vi.fn(),
        updateUploadStatus: vi.fn(),
        removeUploadItem: vi.fn(),
        clearCompletedUploads: vi.fn(),
        toggleUploadQueue: vi.fn(),
        // Common slice methods to prevent "is not a function" errors
        addAgentMessage: vi.fn(),
        updateAgentMessage: vi.fn(),
        setAgentStatus: vi.fn(),
        updateTaskProgress: vi.fn(),
        addNotification: vi.fn(),
        setLoading: vi.fn(),
        clearHistory: vi.fn(),
        startSession: vi.fn(),
        endSession: vi.fn(),
        setActiveSessionId: vi.fn(),
        registerSubscription: vi.fn(() => () => { }),
        setHasUnsavedChanges: vi.fn(),
        // Agent task slice — required by BatchingStatus & TaskTracker
        batchingTasks: [],
        clearCompletedBatchTasks: vi.fn(),
        addBatchingTask: vi.fn(),
        updateBatchingTask: vi.fn(),
        dispatchBatchQueue: vi.fn()
    };

    const useStoreMock = Object.assign(
        vi.fn((selector) => selector ? selector(mockState) : mockState),
        {
            getState: vi.fn(() => mockState),
            setState: vi.fn((patch) => Object.assign(mockState, typeof patch === 'function' ? patch(mockState) : patch)),
            subscribe: vi.fn(() => () => { })
        }
    );

    return {
        useStore: useStoreMock
    };
});

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
    const Timestamp = {
        now: vi.fn(() => ({ toMillis: () => Date.now(), toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
        fromDate: vi.fn((date: Date) => ({ toMillis: () => date.getTime(), toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
        fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis, toDate: () => new Date(millis), seconds: Math.floor(millis / 1000), nanoseconds: 0 }))
    };

    // Create a mock db object that passes basic checks
    const mockDb = { type: 'firestore', getFirestore: () => ({}) };

    return {
        initializeFirestore: vi.fn(() => mockDb),
        getFirestore: vi.fn(() => mockDb),
        Timestamp,
        collection: vi.fn(() => ({ id: 'mock-coll-id' })),
        doc: vi.fn(() => ({ id: crypto.randomUUID() })),
        addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
        getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
        getUsageStats: vi.fn(() => Promise.resolve({
            data: {
                tier: 'free',
                generationsUsed: 0,
                generationsRemaining: 10,
                maxGenerations: 10,
                storageTotalGB: 0,
                projectsCreated: 0,
                projectsRemaining: 3,
                maxProjects: 3,
                teamMembersUsed: 0,
                teamMembersRemaining: 1,
                maxTeamMembers: 1
            }
        })),
        getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })),
        setDoc: vi.fn(() => Promise.resolve()),
        updateDoc: vi.fn(() => Promise.resolve()),
        deleteDoc: vi.fn(() => Promise.resolve()),
        onSnapshot: vi.fn(() => () => { }),
        onSnapshots: vi.fn(() => () => { }),
        query: vi.fn(() => ({})),
        where: vi.fn(() => ({})),
        limit: vi.fn(() => ({})),
        orderBy: vi.fn(() => ({})),
        startAfter: vi.fn(() => ({})),
        arrayUnion: vi.fn((...args) => args),
        arrayRemove: vi.fn((...args) => args),
        increment: vi.fn((n) => n),
        deleteField: vi.fn(() => ({ __deleteField: true })),
        serverTimestamp: vi.fn(() => new Date()),
        getDocsViaCache: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })),
        getDocViaCache: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
        disableNetwork: vi.fn(() => Promise.resolve()),
        enableNetwork: vi.fn(() => Promise.resolve()),
        persistentLocalCache: vi.fn(() => ({})),
        persistentMultipleTabManager: vi.fn(() => ({})),
        runTransaction: vi.fn((cb) => cb({
            get: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        })),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn(() => Promise.resolve())
        })),

    };
});

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} }))
}));

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    uploadBytesResumable: vi.fn(),
    getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com')),
    listAll: vi.fn(() => Promise.resolve({ items: [], prefixes: [] })),
    deleteObject: vi.fn(() => Promise.resolve()),
}));

// Mock Firebase Remote Config
vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn(() => Promise.resolve(true)),
    getValue: vi.fn((rc, key) => ({
        asString: () => key === 'model_name' ? 'mock-model-v1' : 'us-central1',
        asBoolean: () => false,
        asNumber: () => 1
    })),
    getRemoteConfig: vi.fn(() => ({})),
    initializeRemoteConfig: vi.fn(() => ({}))
}));

// Mock Firebase Messaging
vi.mock('firebase/messaging', () => ({
    getMessaging: vi.fn(() => ({})),
    getToken: vi.fn(() => Promise.resolve('mock-fcm-token')),
    onMessage: vi.fn(() => () => { })
}));

// Mock Firebase App Check
vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    getToken: vi.fn(() => Promise.resolve({ token: 'mock-app-check-token' }))
}));
// Mock Firebase AI
vi.mock('firebase/ai', () => ({
    SchemaType: {
        STRING: 'STRING',
        NUMBER: 'NUMBER',
        BOOLEAN: 'BOOLEAN',
        OBJECT: 'OBJECT',
        ARRAY: 'ARRAY'
    },
    getAI: vi.fn(() => ({})),
    getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => "{}",
                functionCalls: () => []
            }
        }),
        generateContentStream: vi.fn().mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => "{}" };
                }
            },
            response: Promise.resolve({
                text: () => "{}",
                functionCalls: () => []
            })
        }),
        startChat: vi.fn(() => ({
            sendMessage: vi.fn().mockResolvedValue({
                response: {
                    text: () => "{}",
                    functionCalls: () => []
                }
            })
        }))
    })),
    getLiveGenerativeModel: vi.fn(() => ({})),
    VertexAIBackend: vi.fn().mockImplementation(function () {
        return {};
    })
}));

// AgentZeroService is retired (tombstone) — mock returns the null export to prevent import errors
vi.mock('@/services/agent/AgentZeroService', () => ({
    agentZeroService: null
}));

// Mock lucide-react with Proxy-based auto-generating stub factory
// This ensures ANY icon import works without needing to enumerate them all
vi.mock('lucide-react', async () => {
    const React = await import('react');

    const createMockIcon = (name: string) => {
        const MockIcon = (props: Record<string, unknown>) => {
            return React.createElement('svg', {
                'data-testid': `icon-${name}`,
                ...props
            });
        };
        MockIcon.displayName = name;
        return MockIcon;
    };

    // Cache generated icons so the same reference is returned for repeated accesses
    const iconCache = new Map<string, ReturnType<typeof createMockIcon>>();

    // Use a Proxy to auto-generate mock icons for any named export
    return new Proxy({ __esModule: true }, {
        get(_target, prop: string) {
            if (prop === '__esModule') return true;
            if (prop === 'default') return undefined;
            // Internal Proxy/Symbol properties
            if (typeof prop === 'symbol' || prop === 'then') return undefined;
            if (!iconCache.has(prop)) {
                iconCache.set(prop, createMockIcon(prop));
            }
            return iconCache.get(prop);
        },
        has(_target, prop: string) {
            // Report all string properties as existing so vitest doesn't throw
            return typeof prop === 'string';
        }
    });
});

// Mock CloudStorageService to prevent test hangs during dynamic imports
// This is critical for tests that instantiate services which lazy-load CloudStorageService
vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        smartSave: vi.fn().mockResolvedValue({ url: 'mock-storage-url' }),
        compressImage: vi.fn().mockResolvedValue({ dataUri: 'data:image/png;base64,mock-compressed' }),
    },
}));

// Mock ToastContext globally
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        addToast: vi.fn(),
        removeToast: vi.fn()
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock video editor store globally
vi.mock('@/modules/video/store/videoEditorStore', () => {
    const mockState = {
        project: { id: 'test-project', clips: [], tracks: [], duration: 0 },
        currentTime: 0,
        isPlaying: false,
        selectedClipId: null,
        selectedTrackId: null,
        viewMode: 'timeline' as const,
        setProject: vi.fn(),
        addClip: vi.fn(),
        updateClip: vi.fn(),
        removeClip: vi.fn(),
        addTrack: vi.fn(),
        updateTrack: vi.fn(),
        removeTrack: vi.fn(),
        setCurrentTime: vi.fn(),
        setIsPlaying: vi.fn(),
        setSelectedClipId: vi.fn(),
        setSelectedTrackId: vi.fn(),
        setViewMode: vi.fn(),
        setIsPopoutActive: vi.fn(),
        exportProject: vi.fn()
    };
    const useVideoEditorStoreMock = Object.assign(
        vi.fn((selector) => selector ? selector(mockState) : mockState),
        {
            getState: vi.fn(() => mockState),
            setState: vi.fn((patch: any) => Object.assign(mockState, typeof patch === 'function' ? patch(mockState) : patch)),
            subscribe: vi.fn(() => () => { })
        }
    );
    return {
        useVideoEditorStore: useVideoEditorStoreMock
    };
});

// Mock @tanstack/react-virtual — useVirtualizer doesn't render items in JSDOM
// because ResizeObserver never fires. This mock makes it render all items directly.
vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
        getVirtualItems: () =>
            Array.from({ length: opts.count }, (_, i) => ({
                index: i,
                start: i * (opts.estimateSize?.() || 200),
                size: opts.estimateSize?.() || 200,
                end: (i + 1) * (opts.estimateSize?.() || 200),
                key: i,
            })),
        getTotalSize: () => opts.count * (opts.estimateSize?.() || 200),
        measureElement: vi.fn(),
    }),
}));
