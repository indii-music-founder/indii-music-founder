import { vi } from 'vitest';

// Only import DOM-specific modules when running in jsdom environment
if (typeof window !== 'undefined') {
    // @ts-expect-error - testing-library/jest-dom types not found in this environment
    await import('@testing-library/jest-dom');
    // @ts-expect-error - fake-indexeddb types not found in this environment
    await import('fake-indexeddb/auto');

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));

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
}

// ============================================================================
// FIREBASE MOCKS - Centralized for all test files
// ============================================================================

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
        currentUser: { uid: 'test-uid', email: 'test@test.com' },
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(() => () => { })
    })),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn()
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(() => ({ id: 'mock-coll-id' })),
    doc: vi.fn(() => ({ id: crypto.randomUUID() })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
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
    serverTimestamp: vi.fn(() => new Date()),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    runTransaction: vi.fn((cb) => cb({
        get: vi.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
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
    Timestamp: {
        now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
        fromDate: vi.fn((date) => ({ toDate: () => date, toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
        fromMillis: vi.fn((millis) => ({ toDate: () => new Date(millis), toMillis: () => millis, seconds: Math.floor(millis / 1000), nanoseconds: 0 }))
    }
}));

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
    getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com'))
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

// Mock Firebase App Check
vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    getToken: vi.fn(() => Promise.resolve({ token: 'mock-app-check-token' }))
}));
// Mock Firebase AI
vi.mock('firebase/ai', () => ({
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
