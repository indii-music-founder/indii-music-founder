import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaUrlToBlob } from './mediaUrlToBlob';

describe('mediaUrlToBlob (ISSUE-1708)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('decodes a data: URL without calling fetch (the CSP blocks fetch on data:)', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const blob = await mediaUrlToBlob('data:audio/wav;base64,UklGRg==');

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(blob.type).toBe('audio/wav');
        expect(blob.size).toBe(4);
    });

    it('fetches ordinary URLs', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('abc', { headers: { 'Content-Type': 'audio/mpeg' } }));
        const blob = await mediaUrlToBlob('https://example.com/a.mp3');
        expect(blob.size).toBe(3);
    });

    it('reports a failed fetch', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));
        await expect(mediaUrlToBlob('https://example.com/missing.mp3')).rejects.toThrow('404');
    });
});
