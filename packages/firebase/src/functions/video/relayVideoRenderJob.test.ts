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
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: mocks.firestore,
    FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../billing/enforceOperationCost', () => ({
    requireVerifiedCreativeUser: mocks.requireVerifiedCreativeUser,
}));

import { claimVideoRenderJob, completeVideoRenderJob } from './relayVideoRenderJob';

const claim = claimVideoRenderJob as unknown as (request: {
    auth?: { uid: string; token?: Record<string, unknown> };
    data: Record<string, unknown>;
}) => Promise<unknown>;
const complete = completeVideoRenderJob as unknown as (request: {
    auth?: { uid: string; token?: Record<string, unknown> };
    data: Record<string, unknown>;
}) => Promise<unknown>;

describe('desktop relay claim/complete', () => {
    let documents: Map<string, Record<string, unknown>>;
    let update: ReturnType<typeof vi.fn>;

    const job = (status: string, executor: string | null = null) => ({
        userId: 'user-1', jobId: 'job-1', projectId: 'proj-1',
        status, executor, artifactUrl: null, artifactGeneration: null, error: null,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.validateAppCheck.mockReturnValue(undefined);
        mocks.requireVerifiedCreativeUser.mockReturnValue('user-1');
        documents = new Map([['users/user-1/videoRenderJobs/job-1', job('queued')]]);
        update = vi.fn(async (_values: Record<string, unknown>) => {
            documents.set('users/user-1/videoRenderJobs/job-1', {
                ...documents.get('users/user-1/videoRenderJobs/job-1')!,
                ..._values,
            });
        });
        mocks.firestore.mockReturnValue({
            doc: vi.fn((path: string) => ({
                path,
                get: vi.fn(async () => {
                    const data = documents.get(path);
                    return { exists: Boolean(data), data: () => data };
                }),
                update,
            })),
        });
    });

    it('claims a queued job and marks it running under the desktop relay', async () => {
        await expect(claim({ auth: { uid: 'user-1', token: { email_verified: true } }, data: { jobId: 'job-1' } }))
            .resolves.toEqual({ claimed: true });
        expect(documents.get('users/user-1/videoRenderJobs/job-1')).toMatchObject({
            status: 'running', executor: 'desktop-relay',
        });
    });

    it('refuses to claim a job that is not queued', async () => {
        documents.set('users/user-1/videoRenderJobs/job-1', job('running', 'cloud-worker'));
        await expect(claim({ auth: { uid: 'user-1', token: { email_verified: true } }, data: { jobId: 'job-1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
        expect(update).not.toHaveBeenCalled();
    });

    it('completes a running desktop-relay job with an https artifact', async () => {
        documents.set('users/user-1/videoRenderJobs/job-1', job('running', 'desktop-relay'));
        await expect(complete({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { jobId: 'job-1', artifactUrl: 'https://storage.example/out.mp4?sig=x' },
        })).resolves.toEqual({ completed: true });
        expect(documents.get('users/user-1/videoRenderJobs/job-1')).toMatchObject({
            status: 'completed', artifactUrl: 'https://storage.example/out.mp4?sig=x',
        });
    });

    it('fails a running desktop-relay job with an error message', async () => {
        documents.set('users/user-1/videoRenderJobs/job-1', job('running', 'desktop-relay'));
        await complete({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { jobId: 'job-1', error: 'ffmpeg died' },
        });
        expect(documents.get('users/user-1/videoRenderJobs/job-1')).toMatchObject({ status: 'failed', error: 'ffmpeg died' });
    });

    it('rejects completion without an https artifact or an error', async () => {
        documents.set('users/user-1/videoRenderJobs/job-1', job('running', 'desktop-relay'));
        await expect(complete({ auth: { uid: 'user-1', token: { email_verified: true } }, data: { jobId: 'job-1' } }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(complete({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { jobId: 'job-1', artifactUrl: 'file:///local/out.mp4' },
        })).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects completion of jobs claimed by the cloud worker', async () => {
        documents.set('users/user-1/videoRenderJobs/job-1', job('running', 'cloud-worker'));
        await expect(complete({
            auth: { uid: 'user-1', token: { email_verified: true } },
            data: { jobId: 'job-1', artifactUrl: 'https://x/y.mp4' },
        })).rejects.toMatchObject({ code: 'failed-precondition' });
    });
});
