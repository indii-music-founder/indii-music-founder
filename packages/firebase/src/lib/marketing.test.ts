import { describe, it, expect } from 'vitest';
import { normalizeDispatchPlatform } from './marketing';

/**
 * ISSUE-820: MultiPlatformPoster/SocialAutoPosterService send the raw
 * platform id 'youtube_shorts' verbatim to the dispatchSocialPost callable,
 * but normalizeDispatchPlatform previously only recognized twitter/instagram/
 * tiktok — every YouTube Shorts post was rejected before it could even be
 * queued, even though the scheduled-delivery worker already supports a
 * 'youtube' platform value.
 */
describe('normalizeDispatchPlatform (ISSUE-820)', () => {
    it('maps youtube_shorts (the id the UI actually sends) to the worker-recognized "youtube"', () => {
        expect(normalizeDispatchPlatform('youtube_shorts')).toBe('youtube');
    });

    it('also accepts a plain "youtube" value', () => {
        expect(normalizeDispatchPlatform('youtube')).toBe('youtube');
    });

    it('still normalizes the existing platforms correctly', () => {
        expect(normalizeDispatchPlatform('twitter')).toBe('twitter');
        expect(normalizeDispatchPlatform('x')).toBe('twitter');
        expect(normalizeDispatchPlatform('instagram')).toBe('instagram');
        expect(normalizeDispatchPlatform('ig')).toBe('instagram');
        expect(normalizeDispatchPlatform('meta_reels')).toBe('instagram');
        expect(normalizeDispatchPlatform('tiktok')).toBe('tiktok');
    });

    it('is case/whitespace tolerant', () => {
        expect(normalizeDispatchPlatform('  YouTube_Shorts  ')).toBe('youtube');
        expect(normalizeDispatchPlatform('TIKTOK')).toBe('tiktok');
    });

    it('still rejects a genuinely unsupported platform', () => {
        expect(() => normalizeDispatchPlatform('mastodon')).toThrow(/not wired for native delivery/);
    });
});
