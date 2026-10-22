import { describe, expect, it } from 'vitest';
import { serializeDispatchPayload } from '../dispatchPayload';

describe('dispatch payload persistence contract (pure logic)', () => {
    it('omits unused media fields from an image import', () => {
        expect(serializeDispatchPayload({ imageUrl: 'https://example.com/photo.jpg', mediaType: 'image', audioUrl: undefined, videoUrl: undefined })).toEqual({ imageUrl: 'https://example.com/photo.jpg', mediaType: 'image' });
    });
    it('omits an absent contact portrait while retaining its audio and instruction', () => {
        expect(serializeDispatchPayload({ audioUrl: 'https://example.com/voice.m4a', imageUrl: undefined, transcription: 'Contact intake' })).toEqual({ audioUrl: 'https://example.com/voice.m4a', transcription: 'Contact intake' });
    });
    it('preserves zero coordinates, zero amounts and deliberately empty strings', () => {
        expect(serializeDispatchPayload({ lat: 0, lng: 0, amount: 0, title: '', noteText: '' })).toEqual({ lat: 0, lng: 0, amount: 0, title: '', noteText: '' });
    });
    it('does not mutate the caller payload retained for retry', () => {
        const payload = { imageUrl: 'https://example.com/photo.jpg', audioUrl: undefined };
        const result = serializeDispatchPayload(payload);
        expect(result).not.toBe(payload);
        expect(Object.hasOwn(payload, 'audioUrl')).toBe(true);
        expect(Object.hasOwn(result, 'audioUrl')).toBe(false);
    });
});
