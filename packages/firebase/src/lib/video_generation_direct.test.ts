import { describe, expect, it } from 'vitest';

import { decodeInlineVideoSeedImage, parseOwnedVideoSeedUri } from './video_generation_direct';

describe('legacy direct-video seed admission', () => {
    it('accepts bounded image bytes while retaining the declared supported MIME type', () => {
        const seed = decodeInlineVideoSeedImage('data:image/jpeg;base64,aGVsbG8=', undefined);

        expect(seed).toEqual({ imageBytes: 'aGVsbG8=', mimeType: 'image/jpeg' });
    });

    it('rejects HTTP URLs instead of making the callable fetch an arbitrary host', () => {
        expect(() => decodeInlineVideoSeedImage('https://169.254.169.254/latest/meta-data/', 'image/png'))
            .toThrow('inline bytes or an owner-scoped Cloud Storage URI');
    });

    it('requires an exact project bucket and owner-scoped Cloud Storage reference', () => {
        expect(parseOwnedVideoSeedUri(
            'artist-1',
            'gs://indii-music-founder.firebasestorage.app/creative/artist-1/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toBe('creative/artist-1/reference.png');
        expect(() => parseOwnedVideoSeedUri(
            'artist-1',
            'gs://attacker-bucket/creative/artist-1/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toThrow('configured project bucket');
        expect(() => parseOwnedVideoSeedUri(
            'artist-1',
            'gs://indii-music-founder.firebasestorage.app/creative/artist-2/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toThrow('authenticated owner');
    });
});
