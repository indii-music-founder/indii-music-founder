import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const mocks = vi.hoisted(() => ({ bucket: vi.fn() }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: mocks.bucket }) }));

import { downloadOwnedRenderMedia, ownedRenderMediaSource } from './mediaSource';

const bucketName = 'project.firebasestorage.app';
const ownedPath = 'users/artist-1/assets/clip.mp4';
const source = `gs://${bucketName}/${ownedPath}`;
const dirs: string[] = [];

afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('render media trust boundary', () => {
    it('accepts only owner-scoped objects in the configured bucket', () => {
        expect(ownedRenderMediaSource(source, bucketName, 'artist-1')).toBe(ownedPath);
        expect(ownedRenderMediaSource(`https://storage.googleapis.com/${bucketName}/${ownedPath}?token=x`, bucketName, 'artist-1')).toBe(ownedPath);
        expect(ownedRenderMediaSource(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(ownedPath)}?alt=media`, bucketName, 'artist-1')).toBe(ownedPath);
        expect(() => ownedRenderMediaSource(source, bucketName, 'artist-2')).toThrow(/owner/);
        expect(() => ownedRenderMediaSource('gs://other-bucket/users/artist-1/assets/clip.mp4', bucketName, 'artist-1')).toThrow(/bucket/);
        expect(() => ownedRenderMediaSource('https://127.0.0.1/clip.mp4', bucketName, 'artist-1')).toThrow(/External/);
        expect(() => ownedRenderMediaSource(`https://storage.googleapis.com/${bucketName}/users/artist-1/../artist-2/clip.mp4`, bucketName, 'artist-1')).toThrow();
    });

    it('streams a generation-pinned object and verifies its length and checksum', async () => {
        const bytes = Buffer.from('verified render media');
        const md5Hash = createHash('md5').update(bytes).digest('base64');
        const file = vi.fn((_path: string, options?: { generation?: number }) => options?.generation
            ? { createReadStream: () => Readable.from([bytes]) }
            : { getMetadata: async () => [{ size: String(bytes.length), contentType: 'video/mp4', generation: '42', md5Hash }] });
        mocks.bucket.mockReturnValue({ name: bucketName, file });
        const dir = await mkdtemp(join(tmpdir(), 'render-media-')); dirs.push(dir);
        const destination = join(dir, 'clip.mp4');
        await downloadOwnedRenderMedia(source, destination, 'artist-1');
        expect(await readFile(destination)).toEqual(bytes);
        expect(file).toHaveBeenCalledWith(ownedPath, { generation: 42 });
    });

    it('rejects oversized metadata and checksum mismatches before rendering', async () => {
        const bytes = Buffer.from('tampered');
        const getMetadata = vi.fn(async () => [{ size: String(bytes.length), contentType: 'video/mp4', generation: '42', md5Hash: 'wrong' }]);
        const file = vi.fn((_path: string, options?: { generation?: number }) => options?.generation
            ? { createReadStream: () => Readable.from([bytes]) }
            : { getMetadata });
        mocks.bucket.mockReturnValue({ name: bucketName, file });
        const dir = await mkdtemp(join(tmpdir(), 'render-media-')); dirs.push(dir);
        const destination = join(dir, 'clip.mp4');
        await expect(downloadOwnedRenderMedia(source, destination, 'artist-1')).rejects.toThrow(/checksum/);
        await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
        getMetadata.mockResolvedValueOnce([{ size: String(512 * 1024 * 1024 + 1), contentType: 'video/mp4', generation: '42', md5Hash: 'wrong' }]);
        await expect(downloadOwnedRenderMedia(source, destination, 'artist-1')).rejects.toThrow(/512 MB/);
        expect(file).toHaveBeenCalledTimes(3);
    });
});
