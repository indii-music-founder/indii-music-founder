import { describe, expect, it } from 'vitest';
import {
    calculateReelEngagementPercent,
    planStorySegments,
    resolveReelShareSignal,
    resolveUnifiedViews,
    scoreReelDistribution,
    validateInstagramPublishingPayload,
} from './instagramSocial';

describe('Instagram publishing policy', () => {
    it('accepts a strict discovery Reel and appends targeted hashtags at the end', () => {
        const result = validateInstagramPublishingPayload({
            surface: 'reel', width: 1080, height: 1920, durationSeconds: 14.9,
            reelAudienceIntent: 'discovery', caption: 'Detroit synthesizer workflow',
            hashtags: ['DetroitTechno', 'SynthWorkflow', 'IndependentArtist', 'StudioProcess', 'NewRelease'],
        });
        expect(result.valid).toBe(true);
        expect(result.publishCaption).toBe('Detroit synthesizer workflow\n\n#detroittechno #synthworkflow #independentartist #studioprocess #newrelease');
    });

    it('rejects the ambiguous Reel duration band, generic tags, and wrong dimensions', () => {
        const result = validateInstagramPublishingPayload({
            surface: 'reel', width: 1080, height: 1350, durationSeconds: 20,
            reelAudienceIntent: 'nurture', caption: 'Behind the release #extra',
            hashtags: ['music', 'viral', 'fyp', 'reels', 'trending'],
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([
            'reel media must be exactly 1080x1920px.',
            'Nurture Reels must be over 30 seconds.',
            expect.stringContaining('Generic hashtags are not allowed'),
            expect.stringContaining('appended only at the end'),
        ]));
    });

    it('requires complete sequential Story segments and reports TTL', () => {
        const invalid = validateInstagramPublishingPayload({
            surface: 'story', width: 1080, height: 1920, durationSeconds: 31,
            caption: '', hashtags: [], storyExtend: true,
            storySegments: [{ mediaUrl: 'one.mp4', durationSeconds: 15, sequence: 1 }],
        });
        expect(invalid.valid).toBe(false);
        expect(invalid.storyTtlHours).toBe(48);
        expect(planStorySegments(31)).toEqual([
            { sequence: 1, startSeconds: 0, durationSeconds: 15 },
            { sequence: 2, startSeconds: 15, durationSeconds: 15 },
            { sequence: 3, startSeconds: 30, durationSeconds: 1 },
        ]);
    });
});

describe('Instagram measurement policy', () => {
    it('prefers provider Views and labels fallbacks honestly', () => {
        expect(resolveUnifiedViews({ views: 100, plays: 90 })).toMatchObject({ views: 100, source: 'views' });
        expect(resolveUnifiedViews({ plays: 90 })).toMatchObject({ views: 90, source: 'plays_legacy' });
        expect(resolveUnifiedViews({ impressions: 80 })).toMatchObject({ views: 80, source: 'impressions_legacy' });
        expect(resolveUnifiedViews({})).toMatchObject({ views: null, source: 'unavailable' });
    });

    it('calculates engagement and never calls aggregate shares DM shares', () => {
        expect(calculateReelEngagementPercent({ views: 1000, likes: 50, shares: 25, comments: 25 })).toBe(10);
        expect(calculateReelEngagementPercent({ views: 0, likes: 1, shares: 1, comments: 1 })).toBeNull();
        expect(resolveReelShareSignal({ shares: 12 })).toEqual({ value: 12, kind: 'all_shares_proxy', label: 'All shares (DM-share proxy)' });
    });

    it('weights DM shares above all other normalized inputs', () => {
        expect(scoreReelDistribution({ dmShareScore: 1, viewsScore: 0, retentionScore: 0, engagementScore: 0 })).toBe(45);
        expect(scoreReelDistribution({ dmShareScore: 0, viewsScore: 1, retentionScore: 0, engagementScore: 0 })).toBe(30);
    });
});
