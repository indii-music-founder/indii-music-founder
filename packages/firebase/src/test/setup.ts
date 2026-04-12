/**
 * Firebase package test setup
 *
 * Provides comprehensive mocks for firebase-admin and firebase-functions/v1
 * to prevent import-time crashes when barrel files (index.ts) are loaded.
 *
 * The key issue: storageMaintenance.ts uses .pubsub.schedule().timeZone().onRun()
 * which fires during module resolution. Without a complete mock chain, every test
 * that imports from the barrel file crashes.
 */
import { vi } from 'vitest';

// ─── Firebase Functions v1 Builder Pattern Mock ──────────────────────────────
// Every chained builder method must return `this` to support arbitrary chains:
//   functions.region().runWith().pubsub.schedule().timeZone().onRun(handler)
//   functions.firestore.document().onWrite(handler)
//   functions.storage.object().onFinalize(handler)

function createFunctionsBuilderMock() {
    const handler = vi.fn((fn: unknown) => fn);

    const pubsubScheduleBuilder = {
        timeZone: vi.fn().mockReturnThis(),
        onRun: handler,
    };

    const pubsubTopicBuilder = {
        onPublish: handler,
    };

    const pubsub = {
        schedule: vi.fn(() => pubsubScheduleBuilder),
        topic: vi.fn(() => pubsubTopicBuilder),
    };

    const firestoreDocBuilder = {
        onCreate: handler,
        onUpdate: handler,
        onDelete: handler,
        onWrite: handler,
    };

    const firestoreNs = {
        document: vi.fn(() => firestoreDocBuilder),
    };

    const storageObjectBuilder = {
        onArchive: handler,
        onDelete: handler,
        onFinalize: handler,
        onMetadataUpdate: handler,
    };

    const storageNs = {
        bucket: vi.fn().mockReturnValue({ object: vi.fn(() => storageObjectBuilder) }),
        object: vi.fn(() => storageObjectBuilder),
    };

    const builder: Record<string, unknown> = {
        region: vi.fn().mockReturnThis(),
        runWith: vi.fn().mockReturnThis(),
        pubsub,
        firestore: firestoreNs,
        storage: storageNs,
        https: {
            onCall: vi.fn((fn: unknown) => fn),
            onRequest: vi.fn((fn: unknown) => fn),
            HttpsError: class extends Error {
                code: string;
                constructor(code: string, message: string) {
                    super(message);
                    this.code = code;
                }
            },
        },
        config: vi.fn(() => ({})),
    };

    // Make builder chainable: region() and runWith() return the full builder
    (builder.region as ReturnType<typeof vi.fn>).mockReturnValue(builder);
    (builder.runWith as ReturnType<typeof vi.fn>).mockReturnValue(builder);

    return builder;
}

vi.mock('firebase-functions/v1', () => createFunctionsBuilderMock());

// ─── Firebase Admin Mock ─────────────────────────────────────────────────────

const mockDoc = {
    get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
    set: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
};

const mockCollection = {
    doc: vi.fn(() => mockDoc),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
    add: vi.fn().mockResolvedValue(mockDoc),
};

const mockFirestore = Object.assign(
    vi.fn(() => ({
        collection: vi.fn(() => mockCollection),
        doc: vi.fn(() => mockDoc),
        batch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn().mockResolvedValue({}),
        })),
        runTransaction: vi.fn((fn: (t: unknown) => unknown) =>
            fn({ get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() })
        ),
    })),
    {
        FieldValue: {
            serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
            increment: vi.fn((n: number) => ({ _methodName: 'increment', operand: n })),
            arrayUnion: vi.fn((...args: unknown[]) => ({ _methodName: 'arrayUnion', elements: args })),
            arrayRemove: vi.fn((...args: unknown[]) => ({ _methodName: 'arrayRemove', elements: args })),
            delete: vi.fn(() => ({ _methodName: 'delete' })),
        },
        Timestamp: {
            now: vi.fn(() => ({ toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
            fromDate: vi.fn((d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
        },
    }
);

vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    credential: {
        cert: vi.fn(),
        applicationDefault: vi.fn(),
    },
    auth: vi.fn(() => ({
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'mock-uid' }),
        getUser: vi.fn().mockResolvedValue({ uid: 'mock-uid', email: 'test@example.com' }),
        createUser: vi.fn().mockResolvedValue({ uid: 'new-uid' }),
    })),
    firestore: mockFirestore,
    storage: vi.fn(() => ({
        bucket: vi.fn(() => ({
            file: vi.fn(() => ({
                save: vi.fn().mockResolvedValue({}),
                download: vi.fn().mockResolvedValue([Buffer.from('test')]),
                delete: vi.fn().mockResolvedValue({}),
                exists: vi.fn().mockResolvedValue([false]),
                getSignedUrl: vi.fn().mockResolvedValue(['https://mock-url.com']),
            })),
        })),
    })),
    apps: [],
}));

// ─── Firebase Functions Params Mock ──────────────────────────────────────────
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: vi.fn(() => 'mock-secret-value') })),
    defineString: vi.fn(() => ({ value: vi.fn(() => 'mock-string-value') })),
    defineInt: vi.fn(() => ({ value: vi.fn(() => 0) })),
}));
