import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('../firebase', () => ({ functions: { region: 'us-central1' } }));

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
            protocol: 'gcs-resumable.v1',
            resumableSessionUri: 'https://storage.googleapis.com/upload/resumable-session-1',
            chunkSizeBytes: 8 * 1024 * 1024,
            expiresAt: '2026-07-27T18:00:00.000Z',
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
        vi.stubGlobal('fetch', mocks.fetch);
        mocks.httpsCallable.mockImplementation((_functions, name) => {
            if (name === 'createVideoSession') return mocks.callable;
            if (name === 'cancelVideoSession') return vi.fn().mockResolvedValue({ data: { ok: true } });
            throw new Error(`unexpected callable ${name}`);
        });
    });

    it('resumes at the server-confirmed byte offset instead of replacing uploaded bytes', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        mocks.callable.mockResolvedValue({ data: response(file.size) });
        mocks.fetch
            .mockResolvedValueOnce(new Response(null, {
                status: 308,
                headers: { Range: 'bytes=0-1' },
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
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
        expect(mocks.fetch).toHaveBeenNthCalledWith(
            1,
            response(file.size).upload.resumableSessionUri,
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({ 'Content-Range': `bytes */${file.size}` }),
            }),
        );
        expect(mocks.fetch).toHaveBeenNthCalledWith(
            2,
            response(file.size).upload.resumableSessionUri,
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({ 'Content-Range': `bytes 2-3/${file.size}` }),
            }),
        );
        const resumedBody = mocks.fetch.mock.calls[1]?.[1]?.body as Blob;
        expect(resumedBody.size).toBe(2);
        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 50 }));
    });

    it('supports interruption controls and performs idempotent server cancellation', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        mocks.callable.mockResolvedValue({ data: response(file.size) });
        mocks.fetch.mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
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
        await expect(handle.completion).rejects.toThrow(/cancelled/i);
        expect(cancelCallable).toHaveBeenCalledTimes(1);
        expect(cancelCallable).toHaveBeenCalledWith({ sessionId });
    });

    it('re-queries committed bytes after pausing an in-flight chunk and uploads only the suffix', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        mocks.callable.mockResolvedValue({ data: response(file.size) });
        let rejectInFlight: ((reason: unknown) => void) | undefined;
        mocks.fetch
            .mockResolvedValueOnce(new Response(null, { status: 308 }))
            .mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
                rejectInFlight = reject;
                init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }))
            .mockResolvedValueOnce(new Response(null, {
                status: 308,
                headers: { Range: 'bytes=0-1' },
            }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));

        const handle = await SessionVideoUploadService.start(file, {
            organizationId: 'org-1',
            projectId: 'project-1',
            idempotencyKey: 'session-upload-idempotency-1',
        });
        await vi.waitFor(() => expect(rejectInFlight).toBeTypeOf('function'));
        expect(handle.pause()).toBe(true);
        expect(handle.resume()).toBe(true);
        await handle.completion;

        expect(mocks.fetch).toHaveBeenNthCalledWith(
            3,
            response(file.size).upload.resumableSessionUri,
            expect.objectContaining({
                headers: expect.objectContaining({ 'Content-Range': `bytes */${file.size}` }),
            }),
        );
        expect(mocks.fetch).toHaveBeenNthCalledWith(
            4,
            response(file.size).upload.resumableSessionUri,
            expect.objectContaining({
                headers: expect.objectContaining({ 'Content-Range': `bytes 2-3/${file.size}` }),
            }),
        );
        expect((mocks.fetch.mock.calls[3]?.[1]?.body as Blob).size).toBe(2);
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
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('refuses to send private media to a non-GCS resumable endpoint', async () => {
        const file = new File(['test'], 'session.mp4', { type: 'video/mp4' });
        const untrusted = response(file.size);
        untrusted.upload.resumableSessionUri = 'https://uploads.attacker.example/session-1';
        mocks.callable.mockResolvedValue({ data: untrusted });

        await expect(SessionVideoUploadService.start(file, {
            organizationId: 'org-1',
            projectId: 'project-1',
            idempotencyKey: 'session-upload-idempotency-1',
        })).rejects.toThrow('selected file');
        expect(mocks.fetch).not.toHaveBeenCalled();
    });
});
