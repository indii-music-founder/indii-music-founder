import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for direct access in vi.mock
const mocks = vi.hoisted(() => {
    return {
        exists: vi.fn(),
        getSignedUrl: vi.fn(),
        getDoc: vi.fn(),
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    const mockDocRef = {
        get: () => mocks.getDoc(),
    };
    const firestoreInstance = {
        collection: vi.fn(() => ({
            doc: vi.fn(() => mockDocRef),
        })),
    };
    const firestoreFn = Object.assign(
        vi.fn(() => firestoreInstance),
        {}
    );
    return {
        initializeApp: vi.fn(),
        firestore: firestoreFn,
        storage: vi.fn(() => ({
            bucket: vi.fn(() => ({
                file: vi.fn(() => ({
                    exists: mocks.exists,
                    getSignedUrl: mocks.getSignedUrl,
                })),
            })),
        })),
        apps: [{ name: '[DEFAULT]' }],
    };
});

// Mock firebase-functions/v1
vi.mock('firebase-functions/v1', () => {
    const handler = vi.fn((fn: unknown) => fn);
    const scheduleBuilder = { timeZone: vi.fn().mockReturnThis(), onRun: handler };
    const topicBuilder = { onPublish: handler };
    const docBuilder = { onCreate: handler, onUpdate: handler, onDelete: handler, onWrite: handler };
    const objectBuilder = { onArchive: handler, onDelete: handler, onFinalize: handler, onMetadataUpdate: handler };

    const builder: Record<string, unknown> = {
        region: vi.fn().mockReturnThis(),
        runWith: vi.fn().mockReturnThis(),
        pubsub: {
            schedule: vi.fn(() => scheduleBuilder),
            topic: vi.fn(() => topicBuilder),
        },
        firestore: { document: vi.fn(() => docBuilder) },
        storage: {
            bucket: vi.fn().mockReturnValue({ object: vi.fn(() => objectBuilder) }),
            object: vi.fn(() => objectBuilder),
        },
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
    (builder.region as ReturnType<typeof vi.fn>).mockReturnValue(builder);
    (builder.runWith as ReturnType<typeof vi.fn>).mockReturnValue(builder);
    return builder;
});

// generateReleaseDownloadUrl is now Gen2 (ISSUE-1243). The v1 mock above stays
// because `../index` still declares un-migrated Gen1 functions. Gen2 `onCall`
// accepts either (handler) or (options, handler); unwrap whichever is the
// handler so the test can invoke it directly.
vi.mock('firebase-functions/v2/https', () => {
    const unwrap = vi.fn((optsOrHandler: unknown, maybeHandler?: unknown) =>
        typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler);
    return {
        onCall: unwrap,
        onRequest: unwrap,
        HttpsError: class extends Error {
            code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        },
    };
});


import { generateReleaseDownloadUrl } from '../index';

describe('generateReleaseDownloadUrl Cloud Function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw unauthenticated HttpsError if request.auth is missing', async () => {
        const callable = generateReleaseDownloadUrl as any;
        await expect(callable({ data: { platform: 'mac' } } as any)).rejects.toThrowError(
            expect.objectContaining({ code: 'unauthenticated' })
        );
    });

    it('should throw invalid-argument HttpsError if platform is invalid', async () => {
        const callable = generateReleaseDownloadUrl as any;
        await expect(callable({ data: { platform: 'linux' }, auth: { uid: 'user123' } } as any)).rejects.toThrowError(
            expect.objectContaining({ code: 'invalid-argument' })
        );
    });

    it('should throw not-found HttpsError if user profile does not exist', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: false,
            data: () => null,
        });

        const callable = generateReleaseDownloadUrl as any;
        await expect(callable({ data: { platform: 'mac' }, auth: { uid: 'user123' } } as any)).rejects.toThrowError(
            expect.objectContaining({ code: 'not-found', message: 'User profile not found.' })
        );
    });

    it('should throw permission-denied HttpsError if user is not a founder', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: true,
            data: () => ({ subscriptionTier: 'regular', tier: 'standard', isFounder: false }),
        });

        const callable = generateReleaseDownloadUrl as any;
        await expect(callable({ data: { platform: 'mac' }, auth: { uid: 'user123' } } as any)).rejects.toThrowError(
            expect.objectContaining({
                code: 'permission-denied',
                message: 'You must be a verified Founder to download the application releases.'
            })
        );
    });

    it('should throw not-found HttpsError if the file does not exist in storage', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: true,
            data: () => ({ subscriptionTier: 'founder' }),
        });
        mocks.exists.mockResolvedValue([false]);

        const callable = generateReleaseDownloadUrl as any;
        await expect(callable({ data: { platform: 'mac' }, auth: { uid: 'user123' } } as any)).rejects.toThrowError(
            expect.objectContaining({
                code: 'not-found',
                message: 'The requested release file is currently unavailable.'
            })
        );
    });

    it('should return success and the signed URL if user is a founder and file exists', async () => {
        mocks.getDoc.mockResolvedValue({
            exists: true,
            data: () => ({ isFounder: true }),
        });
        mocks.exists.mockResolvedValue([true]);
        mocks.getSignedUrl.mockResolvedValue(['https://signed-url.com/indii-Installer.dmg']);

        const callable = generateReleaseDownloadUrl as any;

        const result = await callable({ data: { platform: 'mac' }, auth: { uid: 'user123' } } as any);

        expect(result).toEqual({
            success: true,
            url: 'https://signed-url.com/indii-Installer.dmg',
        });
        expect(mocks.getSignedUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'read',
            })
        );
    });
});
