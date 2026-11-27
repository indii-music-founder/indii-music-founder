// Legacy structural-only resolver tests; no real Storage access or playback proof.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({
    ref: (_s: unknown, path: string) => ({ __path: path }),
    getDownloadURL: vi.fn(async (r: { __path: string }) => `https://firebasestorage.googleapis.com/${r.__path}`)
}));

import { parseGcsObjectPath, resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

describe('parseGcsObjectPath', () => {
    it('parses bucket + object path', () => {
        expect(parseGcsObjectPath('gs://my-bucket/videos/abc.mp4')).toEqual({ bucket: 'my-bucket', path: 'videos/abc.mp4' });
    });
    it('strips a leading slash from the object path', () => {
        expect(parseGcsObjectPath('gs://bucket//videos/abc.mp4')).toEqual({ bucket: 'bucket', path: 'videos/abc.mp4' });
    });
    it('returns a bare bucket with an empty path when there is no object', () => {
        expect(parseGcsObjectPath('gs://bucket/')).toEqual({ bucket: 'bucket', path: '' });
    });
    it('returns null for non-gs or malformed', () => {
        expect(parseGcsObjectPath('https://x/y')).toBeNull();
        expect(parseGcsObjectPath('gs://')).toBeNull();
    });
});

describe('resolveStorageUrl', () => {
    it('passes non-gs URIs through unchanged', async () => {
        expect(await resolveStorageUrl('https://cdn/x.mp4')).toBe('https://cdn/x.mp4');
    });
    it('preserves the explicit gs:// bucket when resolving an object', async () => {
        const resolved = await resolveStorageUrl('gs://bucket/videos/abc.mp4');
        expect(resolved).toBe('https://firebasestorage.googleapis.com/gs://bucket/videos/abc.mp4');
    });
    it('returns the original gs:// URI on a malformed input', async () => {
        expect(await resolveStorageUrl('gs://')).toBe('gs://');
    });
    it('returns the original URI when getDownloadURL throws', async () => {
        const { getDownloadURL } = await import('firebase/storage');
        (getDownloadURL as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
        expect(await resolveStorageUrl('gs://bucket/videos/abc.mp4')).toBe('gs://bucket/videos/abc.mp4');
    });
});
