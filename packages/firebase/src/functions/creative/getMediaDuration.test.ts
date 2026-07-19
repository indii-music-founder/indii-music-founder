/**
 * ISSUE-926: media imports must use the file's real duration, never an
 * arbitrary frame-count guess. These tests cover the backend ffprobe fallback
 * used when the browser can't determine a finite duration client-side.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockGetMetadata = vi.fn();
    const mockDownload = vi.fn();
    const mockFile = vi.fn(() => ({
        getMetadata: mockGetMetadata,
        download: mockDownload,
    }));
    const mockBucket = vi.fn(() => ({
        file: mockFile,
        name: 'test-project.appspot.com',
    }));
    const mockFfprobe = vi.fn();

    return { mockGetMetadata, mockDownload, mockFile, mockBucket, mockFfprobe };
});

vi.mock('firebase-admin', () => ({
    storage: () => ({ bucket: mocks.mockBucket }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts: unknown, handler: unknown) => handler,
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('firebase-functions/v2', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: vi.fn(),
}));

vi.mock('fluent-ffmpeg', () => ({
    default: {
        setFfprobePath: vi.fn(),
        ffprobe: mocks.mockFfprobe,
    },
}));

vi.mock('ffprobe-static', () => ({
    default: { path: '/mock/ffprobe' },
}));

vi.mock('fs/promises', () => ({
    unlink: vi.fn().mockResolvedValue(undefined),
}));

import { getMediaDuration } from './getMediaDuration';

function callable() {
    return getMediaDuration as unknown as (request: {
        data: unknown;
        auth?: { uid: string };
    }) => Promise<{ durationSeconds: number }>;
}

describe('getMediaDuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockBucket.mockReturnValue({ file: mocks.mockFile, name: 'test-project.appspot.com' });
    });

    it('rejects unauthenticated requests', async () => {
        await expect(callable()({ data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'unauthenticated' }));
    });

    it('rejects an invalid/empty uri', async () => {
        await expect(callable()({ data: { uri: '' }, auth: { uid: 'u1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'invalid-argument' }));
    });

    it('rejects a storage bucket outside this project', async () => {
        await expect(callable()({
            data: { uri: 'gs://someone-elses-bucket/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'permission-denied' }));
    });

    it('rejects a path outside the authenticated user\'s own scope', async () => {
        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/someone-else/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'permission-denied' }));
    });

    it('rejects a non-media content type', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'image/png', size: '1000' }]);

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'failed-precondition' }));
    });

    it('rejects a file larger than the probe size cap', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: String(600 * 1024 * 1024) }]);

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'resource-exhausted' }));
    });

    it('rejects when metadata reports zero/invalid size', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: '0' }]);

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'failed-precondition' }));
    });

    it('downloads the file, probes duration via ffprobe, and cleans up the temp file', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: '1000000' }]);
        mocks.mockDownload.mockResolvedValue(undefined);
        mocks.mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, metadata: unknown) => void) => {
            cb(null, { format: { duration: '123.45' } });
        });

        const fsPromises = await import('fs/promises');

        const result = await callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        });

        expect(result).toEqual({ durationSeconds: 123.45 });
        expect(mocks.mockDownload).toHaveBeenCalledWith(expect.objectContaining({ destination: expect.any(String) }));
        expect(fsPromises.unlink).toHaveBeenCalled();
    });

    it('accepts Firebase Storage download URLs, not just gs:// URIs', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'audio/mpeg', size: '500000' }]);
        mocks.mockDownload.mockResolvedValue(undefined);
        mocks.mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, metadata: unknown) => void) => {
            cb(null, { format: { duration: '60' } });
        });

        const result = await callable()({
            data: { uri: 'https://firebasestorage.googleapis.com/v0/b/test-project.appspot.com/o/creative%2Fu1%2Fvideo%2Foutputs%2Fa.mp3?alt=media' },
            auth: { uid: 'u1' },
        });

        expect(result).toEqual({ durationSeconds: 60 });
    });

    it('surfaces a typed internal error when ffprobe fails, and still cleans up the temp file', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: '1000000' }]);
        mocks.mockDownload.mockResolvedValue(undefined);
        mocks.mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, metadata: unknown) => void) => {
            cb(new Error('corrupt file'), null);
        });

        const fsPromises = await import('fs/promises');

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'internal' }));

        expect(fsPromises.unlink).toHaveBeenCalled();
    });

    it('surfaces a typed internal error when ffprobe returns no usable duration', async () => {
        mocks.mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: '1000000' }]);
        mocks.mockDownload.mockResolvedValue(undefined);
        mocks.mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, metadata: unknown) => void) => {
            cb(null, { format: { duration: undefined } });
        });

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'internal' }));
    });

    it('rejects when the storage object metadata cannot be loaded', async () => {
        mocks.mockGetMetadata.mockRejectedValue(new Error('not found'));

        await expect(callable()({
            data: { uri: 'gs://test-project.appspot.com/creative/u1/video/outputs/a.mp4' },
            auth: { uid: 'u1' },
        })).rejects.toThrow(expect.objectContaining({ code: 'not-found' }));
    });
});
