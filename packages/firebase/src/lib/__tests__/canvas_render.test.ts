import { describe, expect, it } from 'vitest';

import { resolveCoverArtStoragePath, resolveAudioStoragePath, resolveCanvasDurationSeconds } from '../canvas_render.js';

describe('canvas_render pure helpers', () => {
    describe('resolveCoverArtStoragePath', () => {
        it('resolves from top-level coverArtStoragePath', () => {
            expect(resolveCoverArtStoragePath({ coverArtStoragePath: 'users/u1/art/cover.jpg' })).toBe('users/u1/art/cover.jpg');
        });

        it('resolves from assets.coverArt.storagePath', () => {
            expect(resolveCoverArtStoragePath({ assets: { coverArt: { storagePath: 'users/u1/art/nested.jpg' } } })).toBe('users/u1/art/nested.jpg');
        });

        it('resolves from assets.coverArt.path', () => {
            expect(resolveCoverArtStoragePath({ assets: { coverArt: { path: 'users/u1/art/alt.jpg' } } })).toBe('users/u1/art/alt.jpg');
        });

        it('resolves from assets.coverArtStoragePath', () => {
            expect(resolveCoverArtStoragePath({ assets: { coverArtStoragePath: 'users/u1/art/assets-level.jpg' } })).toBe('users/u1/art/assets-level.jpg');
        });

        it('returns undefined when no cover art field exists', () => {
            expect(resolveCoverArtStoragePath({})).toBeUndefined();
            expect(resolveCoverArtStoragePath({ assets: {} })).toBeUndefined();
        });

        it('ignores non-string or empty values', () => {
            expect(resolveCoverArtStoragePath({ coverArtStoragePath: '' })).toBeUndefined();
            expect(resolveCoverArtStoragePath({ coverArtStoragePath: 42 })).toBeUndefined();
        });
    });

    describe('resolveAudioStoragePath', () => {
        it('resolves a gs:// audioUrl to its object path', () => {
            expect(resolveAudioStoragePath({ audioUrl: 'gs://my-bucket/users/u1/audio/master.wav' })).toBe('users/u1/audio/master.wav');
        });

        it('resolves a Firebase Storage download URL', () => {
            const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/users%2Fu1%2Faudio%2Fmaster.wav?alt=media';
            expect(resolveAudioStoragePath({ audioUrl: url })).toBe('users/u1/audio/master.wav');
        });

        it('returns undefined when audioUrl is missing', () => {
            expect(resolveAudioStoragePath({})).toBeUndefined();
        });

        it('returns undefined when audioUrl is not a parseable storage reference', () => {
            expect(resolveAudioStoragePath({ audioUrl: 'not-a-url' })).toBeUndefined();
        });
    });

    describe('resolveCanvasDurationSeconds', () => {
        it('defaults to 6 seconds when no spec is provided', () => {
            expect(resolveCanvasDurationSeconds(undefined)).toBe(6);
        });

        it('clamps below the 3s minimum', () => {
            expect(resolveCanvasDurationSeconds({ durationSeconds: 1 })).toBe(3);
        });

        it('clamps above the 8s maximum', () => {
            expect(resolveCanvasDurationSeconds({ durationSeconds: 600 })).toBe(8);
        });

        it('passes through an in-range value', () => {
            expect(resolveCanvasDurationSeconds({ durationSeconds: 5 })).toBe(5);
        });

        it('defaults on non-finite values', () => {
            expect(resolveCanvasDurationSeconds({ durationSeconds: Number.NaN })).toBe(6);
        });
    });
});
