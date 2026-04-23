import { vi } from 'vitest';

/**
 * Comprehensive Firebase Mock Factory for indiiOS
 * Follows Platinum Polish standards for type safety and completeness.
 */

export const createFirebaseMock = () => {
    const mockAuth = {
        currentUser: {
            uid: 'test-uid',
            email: 'test@indii.ai',
            displayName: 'Test Artist',
            getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
        },
        onAuthStateChanged: vi.fn((cb) => {
            if (typeof cb === 'function') {
                cb({ uid: 'test-uid', email: 'test@indii.ai' });
            }
            return () => {};
        }),
        signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
        createUserWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'test-uid' } }),
        signOut: vi.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
        updateProfile: vi.fn().mockResolvedValue(undefined),
    };

    const mockFirestore = {
        collection: vi.fn((_db, path) => ({ id: path.split('/').pop(), path })),
        doc: vi.fn((_db, path, id) => ({ id: id || path.split('/').pop(), path: id ? `${path}/${id}` : path })),
        getDoc: vi.fn(() => Promise.resolve({
            exists: () => true,
            id: 'mock-doc-id',
            data: () => ({}),
        })),
        getDocs: vi.fn(() => Promise.resolve({
            docs: [],
            empty: true,
            size: 0,
            forEach: vi.fn(),
        })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        updateDoc: vi.fn().mockResolvedValue(undefined),
        deleteDoc: vi.fn().mockResolvedValue(undefined),
        addDoc: vi.fn().mockResolvedValue({ id: 'new-doc-id' }),
        onSnapshot: vi.fn(() => () => {}),
        query: vi.fn(() => ({})),
        where: vi.fn(() => ({})),
        limit: vi.fn(() => ({})),
        orderBy: vi.fn(() => ({})),
        startAfter: vi.fn(() => ({})),
        Timestamp: {
            now: vi.fn(() => ({ toMillis: () => Date.now(), toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
            fromDate: vi.fn((date) => ({ toMillis: () => date.getTime(), toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
            fromMillis: vi.fn((ms) => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: Math.floor(ms / 1000), nanoseconds: 0 })),
        },
        increment: vi.fn((n) => n),
        arrayUnion: vi.fn((...args) => args),
        arrayRemove: vi.fn((...args) => args),
        serverTimestamp: vi.fn(() => new Date()),
        runTransaction: vi.fn((cb) => cb({
            get: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}) })),
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        })),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined),
        })),
    };

    const mockStorage = {
        ref: vi.fn((_storage, path) => ({ fullPath: path })),
        uploadBytes: vi.fn().mockResolvedValue({ ref: { fullPath: 'mock-path' } }),
        uploadBytesResumable: vi.fn(() => ({
            on: vi.fn((event, next) => {
                if (event === 'state_changed') {
                    next({ bytesTransferred: 100, totalBytes: 100 });
                }
            }),
            then: vi.fn((cb) => cb({ ref: { fullPath: 'mock-path' } })),
            catch: vi.fn(),
        })),
        getDownloadURL: vi.fn().mockResolvedValue('https://firebasestorage.googleapis.com/v0/b/mock/o/file.png'),
        deleteObject: vi.fn().mockResolvedValue(undefined),
        listAll: vi.fn().mockResolvedValue({ items: [], prefixes: [] }),
    };

    const mockFunctions = {
        httpsCallable: vi.fn((_functions, name) => {
            return vi.fn().mockImplementation((data) => {
                // Default success response for most functions
                return Promise.resolve({ data: { success: true, message: `Mocked ${name} success`, ...data } });
            });
        }),
    };

    const mockRemoteConfig = {
        fetchAndActivate: vi.fn().mockResolvedValue(true),
        getValue: vi.fn((_rc, key) => ({
            asString: () => 'mock-value',
            asBoolean: () => false,
            asNumber: () => 0,
            getSource: () => 'static',
        })),
        getAll: vi.fn().mockReturnValue({}),
        setLogLevel: vi.fn(),
    };

    const mockAI = {
        getGenerativeModel: vi.fn(() => ({
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => '{"result": "mock AI response"}',
                    functionCalls: () => [],
                },
            }),
            generateContentStream: vi.fn().mockResolvedValue({
                stream: (async function* () {
                    yield { response: { text: () => 'Chunk 1' } };
                    yield { response: { text: () => 'Chunk 2' } };
                })(),
                response: Promise.resolve({ text: () => 'Full response' }),
            }),
            startChat: vi.fn(() => ({
                sendMessage: vi.fn().mockResolvedValue({
                    response: { text: () => 'Chat response' },
                }),
            })),
        })),
        getAI: vi.fn(() => ({})),
        SchemaType: {
            STRING: 'STRING',
            NUMBER: 'NUMBER',
            BOOLEAN: 'BOOLEAN',
            OBJECT: 'OBJECT',
            ARRAY: 'ARRAY',
        },
    };

    return {
        app: { name: '[DEFAULT]', options: {}, delete: vi.fn().mockResolvedValue(undefined) },
        auth: mockAuth,
        db: mockFirestore,
        firestore: mockFirestore, // Alias
        storage: mockStorage,
        functions: mockFunctions,
        remoteConfig: mockRemoteConfig,
        messaging: {
            getToken: vi.fn().mockResolvedValue('mock-fcm-token'),
            onMessage: vi.fn(() => () => {}),
        },
        appCheck: {
            getToken: vi.fn().mockResolvedValue({ token: 'mock-app-check-token' }),
        },
        ai: mockAI,
    };
};
