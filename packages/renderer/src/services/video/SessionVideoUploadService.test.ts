import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
    uploadBytesResumable: vi.fn(),
    task: {
        on: vi.fn(),
        pause: vi.fn(() => true),
        resume: vi.fn(() => true),
        cancel: vi.fn(() => true),
        snapshot: { state: 'success', bytesTransferred: 4, totalBytes: 4 },
    },
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('firebase/storage', () => ({
    ref: vi.fn((_storage, path) => `ref://${path}`),
    uploadBytesResumable: mocks.uploadBytesResumable,
}));
vi.mock('../firebase', () => ({ functions: { region: 'us-central1' }, storage: {} }));

import { SessionVideoUploadService } from './SessionVideoUploadService';

const sessionId = 'a'.repeat(40);
const now = '2026-07-21T18:00:00.000Z';

function response(byteSize: number) {
    const session = {
        schemaVersion: 'video-session.v1',
        sessionId,
        ownerUid: 'artist-1',
        organizationId: 'org-1',
        projectId: 'project-1',
        idempotencyKey: 'session-upload-idempotency-1',
        uploadSessionId: `upload-${sessionId}`,
        expectedMimeType: 'video/mp4',
        expectedByteSize: byteSize,
        stagingBucket: 'private-media-bucket',
        stagingPath: `session-media/artist-1/${sessionId}/staging/original.mp4`,
        status: 'uploading',
        costEstimate: { currency: 'USD', amountMinor: 1, estimateVersion: 'pricing-v1' },
        retentionDeleteAfter: '2026-08-20T18:00:00.000Z',
        createdAt: now,
        updatedAt: now,
    };
    return {
        created: true,
        session,
        upload: {
            storageUri: `gs://private-media-bucket/${session.stagingPath}`,
            expectedMimeType: 'video/mp4',
            expectedByteSize: byteSize,
            requiredMetadata: {
                ownerUid: 'artist-1',
                organizationId: 'org-1',
                projectId: 'project-1',
                sessionId,
                uploadSessionId: `upload-${sessionId}`,
            },
        },
    };
}

describe('SessionVideoUploadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.uploadBytesResumable.mockReturnValue(mocks.task);
        mocks.httpsCallable.mockImplementation((_functions, name) => {
            if (name === 'createVideoSession') return mocks.callable;
            if (name === 'cancelVideoSession') return vi.fn().mockResolvedValue({ data: { ok: true } });
            throw new Error(`unexpected callable ${name}`);
        });
    });

    it('uploads to the server-authorized private path with exact identity metadata', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        mocks.callable.mockResolvedValue({ data: response(file.size) });
        mocks.task.on.mockImplementation((_event, progress, _error, complete) => {
            progress?.({ state: 'running', bytesTransferred: 2, totalBytes: 4 });
            complete?.();
            return vi.fn();
        });
        const onProgress = vi.fn();

        const handle = await SessionVideoUploadService.start(file, {
            organizationId: 'org-1',
            projectId: 'project-1',
            idempotencyKey: 'session-upload-idempotency-1',
        }, onProgress);
        await handle.completion;

        expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({
            expectedMimeType: 'video/mp4',
            expectedByteSize: file.size,
        }));
        expect(mocks.uploadBytesResumable).toHaveBeenCalledWith(
            `ref://session-media/artist-1/${sessionId}/staging/original.mp4`,
            file,
            {
                contentType: 'video/mp4',
                cacheControl: 'private, no-store',
                customMetadata: response(file.size).upload.requiredMetadata,
            },
        );
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 50 }));
    });

    it('supports SDK interruption controls and performs idempotent server cancellation', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        mocks.callable.mockResolvedValue({ data: response(file.size) });
        mocks.task.on.mockReturnValue(vi.fn());
        const cancelCallable = vi.fn().mockResolvedValue({ data: { ok: true } });
        mocks.httpsCallable.mockImplementation((_functions, name) =>
            name === 'createVideoSession' ? mocks.callable : cancelCallable,
        );

        const handle = await SessionVideoUploadService.start(file, {
            organizationId: 'org-1',
            projectId: 'project-1',
            idempotencyKey: 'session-upload-idempotency-1',
        });

        expect(handle.pause()).toBe(true);
        expect(handle.resume()).toBe(true);
        await Promise.all([handle.cancel(), handle.cancel()]);
        expect(mocks.task.cancel).toHaveBeenCalledTimes(1);
        expect(cancelCallable).toHaveBeenCalledTimes(1);
        expect(cancelCallable).toHaveBeenCalledWith({ sessionId });
    });

    it('fails closed when the authorization identity differs from the selected file', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        const mismatched = response(file.size);
        mismatched.upload.requiredMetadata.projectId = 'attacker-project';
        mocks.callable.mockResolvedValue({ data: mismatched });

        await expect(SessionVideoUploadService.start(file, {
            organizationId: 'org-1',
            projectId: 'project-1',
            idempotencyKey: 'session-upload-idempotency-1',
        })).rejects.toThrow('identity');
        expect(mocks.uploadBytesResumable).not.toHaveBeenCalled();
    });
});
