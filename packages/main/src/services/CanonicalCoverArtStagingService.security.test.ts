import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { stageCanonicalCoverArt } from './CanonicalCoverArtStagingService';

function png(width = 3000, height = 3000, colorType = 2): Uint8Array {
    const bytes = new Uint8Array(26);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
    new DataView(bytes.buffer).setUint32(16, width);
    new DataView(bytes.buffer).setUint32(20, height);
    bytes[24] = 8;
    bytes[25] = colorType;
    return bytes;
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function asset(bytes: Uint8Array, hash = createHash('sha256').update(bytes).digest('hex')) {
    const storagePath = `covers/owner-1/${hash}/original.png`;
    return {
        content_hash: hash,
        download_url: `https://firebasestorage.googleapis.com/v0/b/indii-test/o/${encodeURIComponent(storagePath)}?alt=media&token=test`,
        mime_type: 'image/png',
        original_file_name: 'cover.png',
        size_bytes: bytes.byteLength,
        storage_path: storagePath,
    };
}

describe('stageCanonicalCoverArt', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('stages only a hash-verified, measured canonical cover', async () => {
        const bytes = png();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody(bytes))));
        const staged = await stageCanonicalCoverArt(asset(bytes));
        expect(staged.coverAsset).toMatchObject({ width: 3000, height: 3000, color_space: 'rgb', local_path: expect.stringContaining('indii-ddex-cover-') });
        expect('download_url' in staged.coverAsset).toBe(false);
        await staged.cleanup();
    });

    it('rejects an arbitrary URL before any fetch', async () => {
        const bytes = png();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await expect(stageCanonicalCoverArt({ ...asset(bytes), download_url: 'https://example.test/cover.png' })).rejects.toThrow('Firebase Storage');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a renderer-supplied local path and a non-media Firebase URL', async () => {
        const bytes = png();
        await expect(stageCanonicalCoverArt({ ...asset(bytes), local_path: '/tmp/cover.png' }))
            .rejects.toThrow('reserved for the trusted desktop process');
        await expect(stageCanonicalCoverArt({ ...asset(bytes), download_url: asset(bytes).download_url.replace('?alt=media&token=test', '') }))
            .rejects.toThrow('must request media bytes');
    });

    it('rejects hash-correct artwork that does not meet measured DSP dimensions', async () => {
        const bytes = png(2999, 2999);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody(bytes))));
        await expect(stageCanonicalCoverArt(asset(bytes))).rejects.toThrow('at least 3000px');
    });

    it('rejects transparent PNG artwork instead of treating it as RGB delivery art', async () => {
        const bytes = png(3000, 3000, 6);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody(bytes))));
        await expect(stageCanonicalCoverArt(asset(bytes))).rejects.toThrow('transparent PNG');
    });
});
