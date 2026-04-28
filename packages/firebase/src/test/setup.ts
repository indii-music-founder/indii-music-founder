/**
 * Firebase package test setup
 *
 * Provides comprehensive mocks for firebase-admin, firebase-functions/v1,
 * firebase-functions/v2/*, and native modules (sharp) to prevent import-time
 * crashes when barrel files (index.ts) are loaded.
 *
 * The key issue: storageMaintenance.ts uses .pubsub.schedule().timeZone().onRun()
 * which fires during module resolution. Without a complete mock chain, every test
 * that imports from the barrel file crashes.
 *
 * CRITICAL: `sharp` must be mocked before any module tries to load its native
 * binary. On CI (ubuntu-latest / linux-x64) the binary may not exist, causing
 * a fatal crash at require-time. We place this mock first and use vi.hoisted()
 * to guarantee it registers before any transitive imports.
 */
import { vi } from 'vitest';

// ─── Native Module Mocks (MUST be first) ─────────────────────────────────────
// `sharp` is used by lib/image_resizing.ts and is loaded transitively whenever
// a test imports from the barrel file (index.ts). On CI (ubuntu-latest) the
// sharp native binary for linux-x64 may not be installed, causing all firebase
// tests to crash at module resolution time. Mocking it here once prevents every
// individual test file from needing its own mock.
//
// IMPORTANT: This mock must appear before any other vi.mock() calls to ensure
// it is hoisted first and registered before any module graph resolution.
vi.mock('sharp', () => {
    const sharpInstance = {
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image-data')),
        toFile: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
        metadata: vi.fn().mockResolvedValue({ width: 100, height: 100, format: 'png' }),
    };
    return {
        default: vi.fn(() => sharpInstance),
    };
});

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
// ─── Firebase Functions v2 Mocks ─────────────────────────────────────────────
// The barrel file (index.ts) transitively imports modules that use v2 triggers
// (image_resizing.ts → firebase-functions/v2/storage, agentStream.ts → v2/https,
// etc.). Without these mocks, tests crash on import.

const mockV2Handler = vi.fn((opts: unknown, handler?: unknown) => handler ?? opts);

vi.mock('firebase-functions/v2/https', () => ({
    onCall: mockV2Handler,
    onRequest: mockV2Handler,
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: mockV2Handler,
    onObjectArchived: mockV2Handler,
    onObjectDeleted: mockV2Handler,
    onObjectMetadataUpdated: mockV2Handler,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: mockV2Handler,
    onDocumentUpdated: mockV2Handler,
    onDocumentDeleted: mockV2Handler,
    onDocumentWritten: mockV2Handler,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: mockV2Handler,
}));

// ─── Third-Party Module Mocks ────────────────────────────────────────────────
// firebase-functions-test is used by some integration-style tests. It eagerly
// initializes Firebase Admin, which can trigger transitive module loading.
// Mocking it prevents side effects during test setup.
vi.mock('firebase-functions-test', () => ({
    default: vi.fn(() => ({
        cleanup: vi.fn(),
        wrap: vi.fn((fn: unknown) => fn),
        makeChange: vi.fn(),
    })),
}));

// inngest/express is imported by index.ts barrel
vi.mock('inngest/express', () => ({
    serve: vi.fn(() => vi.fn()),
}));

// inngest (main module) is imported for the Inngest client constructor
vi.mock('inngest', () => ({
    Inngest: vi.fn(() => ({
        send: vi.fn().mockResolvedValue({}),
        createFunction: vi.fn(),
    })),
}));

// cors is imported at the top of index.ts
vi.mock('cors', () => ({
    default: vi.fn(() => vi.fn((req: unknown, res: unknown, next: unknown) => {
        if (typeof next === 'function') next();
    })),
}));

