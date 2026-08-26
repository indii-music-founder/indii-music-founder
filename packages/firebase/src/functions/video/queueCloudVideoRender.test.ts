import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    firestore: vi.fn(),
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    validateAppCheck: vi.fn(),
    requireVerifiedCreativeUser: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: mocks.onCall,
    HttpsError: class HttpsError extends Error {
        constructor(
            public code: string,
            message: string,
            public details?: unknown,
        ) {
            super(message);
        }
    },
}));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: mocks.firestore,
    FieldValue: {
        serverTimestamp: vi.fn(() => '__server_timestamp__'),
    },
}));

vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../billing/enforceOperationCost', () => ({
    requireVerifiedCreativeUser: mocks.requireVerifiedCreativeUser,
}));

import {
    sanitizeVideoRenderOutputName,
    VIDEO_RENDER_JOB_TRANSITIONS,
    queueCloudVideoRender,
} from './queueCloudVideoRender';

const callQueue = queueCloudVideoRender as unknown as (request: {
    auth?: { uid: string; token?: Record<string, unknown> };
    data: Record<string, unknown>;
    rawRequest?: Record<string, unknown>;
}) => Promise<unknown>;

describe('queueCloudVideoRender', () => {
    function firestoreHarness(documents: Map<string, Record<string, unknown>>) {
        const creates = new Map<string, ReturnType<typeof vi.fn>>();
        const ref = (path: string) => {
            let create = creates.get(path);
            if (!create) {
                create = vi.fn((values: Record<string, unknown>) => {
                    if (documents.has(path)) {
                        throw Object.assign(new Error('already exists'), { code: 6 });
                    }
                    documents.set(path, { ...values });
                });
                creates.set(path, create);
            }
            return {
                path,
                create,
                get: vi.fn(async () => {
                    const data = documents.get(path);
                    return { exists: Boolean(data), data: () => data };
                }),
                collection: (name: string) => ({
                    doc: (id: string) => ref(`${path}/${name}/${id}`),
                }),
            };
        };
        const db = {
            doc: vi.fn((path: string) => ref(path)),
            collection: vi.fn((name: string) => ({
                doc: vi.fn((id: string) => ref(`${name}/${id}`)),
            })),
        };
        mocks.firestore.mockReturnValue(db);
        return { db, ref };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.validateAppCheck.mockReturnValue(undefined);
        mocks.requireVerifiedCreativeUser.mockReturnValue('user-1');
    });

    it('creates a durable queued job for an owned project and returns the queued receipt', async () => {
        const documents = new Map<string, Record<string, unknown>>([
            ['users/user-1/videoProjects/proj-1', { userId: 'user-1', project: { id: 'proj-1' } }],
        ]);
        const { ref } = firestoreHarness(documents);

        const result = await callQueue({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { projectId: 'proj-1', outputName: 'My Movie.MP4' },
        });

        expect(result).toMatchObject({ status: 'queued', progress: 0, projectId: 'proj-1' });
        expect(result).toHaveProperty('renderId');
        const renderId = (result as { renderId: string }).renderId;

        const jobRef = ref(`users/user-1/videoRenderJobs/${renderId}`);
        expect(jobRef.create).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaVersion: 'video-render-job.v1',
                userId: 'user-1',
                projectId: 'proj-1',
                outputName: 'My_Movie.mp4',
                status: 'queued',
                executor: null,
                artifactUrl: null,
            }),
        );
    });

    it('refuses a project that does not exist or is owned by someone else', async () => {
        const documents = new Map<string, Record<string, unknown>>([
            ['users/user-1/videoProjects/proj-9', { userId: 'someone-else', project: { id: 'proj-9' } }],
        ]);
        firestoreHarness(documents);

        await expect(callQueue({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { projectId: 'proj-9' },
        })).rejects.toMatchObject({ code: 'not-found' });
        await expect(callQueue({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { projectId: 'missing' },
        })).rejects.toMatchObject({ code: 'not-found' });
    });

    it('sanitizes output names and rejects path smuggling', () => {
        expect(sanitizeVideoRenderOutputName('My Movie.MP4')).toBe('My_Movie.mp4');
        expect(sanitizeVideoRenderOutputName('final')).toBe('final.mp4');
        expect(sanitizeVideoRenderOutputName(undefined)).toBeUndefined();
        expect(() => sanitizeVideoRenderOutputName('a/b.mp4')).toThrow(/filename/);
        expect(() => sanitizeVideoRenderOutputName('..\\x.mp4')).toThrow(/filename/);
    });

    it('declares one-hop-only status transitions for executors', () => {
        expect(VIDEO_RENDER_JOB_TRANSITIONS.queued).toEqual(['running']);
        expect(VIDEO_RENDER_JOB_TRANSITIONS.running).toEqual(['completed', 'failed']);
        expect(VIDEO_RENDER_JOB_TRANSITIONS.completed).toEqual([]);
        expect(VIDEO_RENDER_JOB_TRANSITIONS.failed).toEqual([]);
    });
});
