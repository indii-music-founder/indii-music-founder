import { describe, expect, it } from 'vitest';
import { editorImportPlan } from '../editorImportPlan';

describe('remote editor import intent (pure contract)', () => {
    it('routes an inferred image to the photo editor', () => {
        expect(editorImportPlan({ imageUrl: 'https://example.com/photo.jpg' })).toMatchObject({ destination: 'photo', mediaType: 'image' });
    });
    it('preserves deliberate image-in-video intent', () => {
        expect(editorImportPlan({ imageUrl: 'https://example.com/photo.jpg', editorDestination: 'video' }).destination).toBe('video');
    });
    it.each(['video', 'audio'] as const)('routes %s to the timeline', mediaType => {
        const payload = { mediaType, videoUrl: 'https://example.com/video.mp4', audioUrl: 'https://example.com/audio.wav' };
        expect(editorImportPlan(payload)).toMatchObject({ destination: 'video', mediaType, mediaUrl: payload[mediaType === 'video' ? 'videoUrl' : 'audioUrl'] });
    });
    it('rejects a mismatched asset rather than falling back to a different URL', () => {
        expect(() => editorImportPlan({ mediaType: 'image', videoUrl: 'https://example.com/video.mp4' })).toThrow(/matching/);
    });
    it('rejects audio directed to the photo editor', () => {
        expect(() => editorImportPlan({ audioUrl: 'https://example.com/audio.wav', editorDestination: 'photo' })).toThrow(/requires an image/);
    });
    it.each(['', 'blob:local-only', 'data:image/png;base64,AA', 'http://example.com/photo.jpg'])('rejects a non-shareable source %s', imageUrl => {
        expect(() => editorImportPlan({ imageUrl })).toThrow(/secure/);
    });
});
