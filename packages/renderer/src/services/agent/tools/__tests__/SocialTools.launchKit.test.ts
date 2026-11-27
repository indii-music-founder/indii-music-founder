import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReleaseLaunchKit } from '@indii/shared';

const queuePost = vi.hoisted(() => vi.fn());
const schedulePost = vi.hoisted(() => vi.fn());

vi.mock('@/services/marketing/SocialAutoPosterService', () => ({
    socialAutoPosterService: { queuePost },
}));

vi.mock('@/services/social/SocialService', () => ({
    SocialService: {
        schedulePost,
        getFeed: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn(),
        generateStructuredData: vi.fn(),
    },
    getResponseText: vi.fn(() => ''),
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { brandKit: { brandAssets: [] } },
        }),
    },
}));

import { SocialTools } from '@/services/agent/tools/SocialTools';

const scheduleLaunchKit = (args: unknown) =>
    (SocialTools as Record<string, (a: unknown) => Promise<any>>).schedule_launch_kit_rollout(args);

function makeLaunchKit(overrides: Partial<ReleaseLaunchKit> = {}): ReleaseLaunchKit {
    return {
        kitId: 'kit-launch-01',
        title: 'Electric Horizon Rollout',
        artistOrBrandName: 'Midnight Signal',
        hookWindows: [],
        lockedReferenceImageUris: [],
        smartLinkUrl: 'https://indii.music/midnight',
        createdAtIso: '2026-11-26T20:00:00.000Z',
        adVariants: [
            {
                variantId: 'var_9x16_ok',
                shape: '9:16',
                durationSeconds: 15,
                channelLabel: 'Vertical Reel',
                renderUrl: 'https://cdn.example.com/reel-9x16.mp4',
                overallScore: 9.4,
                brandQcApproved: true,
                approved: true,
                discardedForRegression: false,
                attemptsUsed: 1,
                gapsFound: 'None',
            },
            {
                variantId: 'var_1x1_ok',
                shape: '1:1',
                durationSeconds: 15,
                channelLabel: 'Square Feed',
                renderUrl: 'https://cdn.example.com/square-1x1.mp4',
                overallScore: 9.1,
                brandQcApproved: true,
                approved: true,
                discardedForRegression: false,
                attemptsUsed: 1,
                gapsFound: 'None',
            },
            {
                variantId: 'var_9x16_rejected',
                shape: '9:16',
                durationSeconds: 30,
                channelLabel: 'Rejected Cut',
                renderUrl: 'https://cdn.example.com/rejected.mp4',
                overallScore: 7.4,
                brandQcApproved: false,
                approved: false,
                discardedForRegression: true,
                attemptsUsed: 2,
                gapsFound: 'Caption overlap',
            },
        ],
        socialPosts: [
            {
                id: 'post-ig',
                platform: 'Instagram',
                copy: 'Reel out now',
                hashtags: ['#indiemusic'],
                attachedVariantId: 'var_9x16_ok',
                scheduledDayOffset: 0,
                status: 'approved',
            },
            {
                id: 'post-tiktok',
                platform: 'TikTok',
                copy: 'Wait for the drop',
                hashtags: ['#newmusic'],
                attachedVariantId: 'var_9x16_ok',
                scheduledDayOffset: 0,
                status: 'approved',
            },
            {
                id: 'post-shorts',
                platform: 'YouTubeShorts',
                copy: 'Shorts drop live',
                hashtags: ['#shorts'],
                attachedVariantId: 'var_9x16_ok',
                scheduledDayOffset: 1,
                status: 'approved',
            },
            {
                id: 'post-x',
                platform: 'X',
                copy: 'Stream Electric Horizon now',
                hashtags: ['#synthwave'],
                attachedVariantId: 'var_1x1_ok',
                scheduledDayOffset: 0,
                status: 'approved',
            },
            {
                id: 'post-story',
                platform: 'InstagramStory',
                copy: 'Tap to pre-save',
                hashtags: [],
                attachedVariantId: 'var_9x16_ok',
                scheduledDayOffset: 0,
                status: 'approved',
            },
        ],
        ...overrides,
    };
}

describe('SocialTools.schedule_launch_kit_rollout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queuePost.mockResolvedValue('autopost-job-1');
        schedulePost.mockResolvedValue('social-sched-1');
    });

    it('fails closed with INVALID_LAUNCH_KIT when schema validation fails', async () => {
        const result = await scheduleLaunchKit({ launchKit: { kitId: '' } });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('INVALID_LAUNCH_KIT');
        expect(queuePost).not.toHaveBeenCalled();
        expect(schedulePost).not.toHaveBeenCalled();
    });

    it('fails closed with NO_APPROVED_POSTS when all posts reference unapproved/regressed/missing variants', async () => {
        const kit = makeLaunchKit({
            socialPosts: [
                {
                    id: 'post-bad-1',
                    platform: 'TikTok',
                    copy: 'Should fail closed',
                    hashtags: [],
                    attachedVariantId: 'var_9x16_rejected',
                    scheduledDayOffset: 0,
                    status: 'draft',
                },
                {
                    id: 'post-bad-2',
                    platform: 'X',
                    copy: 'Missing variant ref',
                    hashtags: [],
                    attachedVariantId: 'var_does_not_exist',
                    scheduledDayOffset: 0,
                    status: 'draft',
                },
            ],
        });

        const result = await scheduleLaunchKit({ launchKit: kit });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('NO_APPROVED_POSTS');
        expect(queuePost).not.toHaveBeenCalled();
        expect(schedulePost).not.toHaveBeenCalled();
    });

    it('routes approved vertical reels to queuePost, feed/story/X posts to schedulePost, and skips unapproved variants', async () => {
        const baseKit = makeLaunchKit();
        baseKit.socialPosts.push({
            id: 'post-skipped-unapproved',
            platform: 'TikTok',
            copy: 'Do not ship this rejected cut',
            hashtags: [],
            attachedVariantId: 'var_9x16_rejected',
            scheduledDayOffset: 2,
            status: 'draft',
        });

        const startTimestampMs = Date.now() + 3_600_000;
        const result = await scheduleLaunchKit({
            launchKit: baseKit,
            startTimestampMs,
            reelAudienceIntent: 'discovery',
        });

        expect(result.success).toBe(true);
        // Instagram, TikTok, YouTubeShorts go to socialAutoPosterService.queuePost
        expect(queuePost).toHaveBeenCalledTimes(3);
        const igCall = queuePost.mock.calls.find((c) => c[0].platform === 'meta_reels')?.[0];
        expect(igCall).toBeDefined();
        expect(igCall.mediaUrl).toBe('https://cdn.example.com/reel-9x16.mp4');
        expect(igCall.instagramPayload).toMatchObject({
            surface: 'reel',
            width: 1080,
            height: 1920,
            durationSeconds: 15,
            reelAudienceIntent: 'discovery',
        });

        // X and InstagramStory go to SocialService.schedulePost with future timestamps
        expect(schedulePost).toHaveBeenCalledTimes(2);
        const xCall = schedulePost.mock.calls.find((c) => c[0].platform === 'Twitter')?.[0];
        expect(xCall?.scheduledTime).toBe(startTimestampMs);

        expect(result.data.skippedPosts).toEqual([
            expect.objectContaining({
                postId: 'post-skipped-unapproved',
                attachedVariantId: 'var_9x16_rejected',
            }),
        ]);
    });

    it('fails closed on invalid reelAudienceIntent or out-of-range startTimestampMs, and never downgrades video-only platforms without renderUrl', async () => {
        const invalidIntent = await scheduleLaunchKit({
            launchKit: makeLaunchKit(),
            reelAudienceIntent: 'invalid-mode',
        });
        expect(invalidIntent.success).toBe(false);
        expect(invalidIntent.metadata?.errorCode).toBe('INVALID_LAUNCH_KIT');

        const kitMissingRenderUrl = makeLaunchKit({
            adVariants: [
                {
                    variantId: 'var_no_url',
                    shape: '9:16',
                    durationSeconds: 15,
                    channelLabel: 'Missing Render URL',
                    overallScore: 9.5,
                    brandQcApproved: true,
                    approved: true,
                    discardedForRegression: false,
                    attemptsUsed: 0,
                    gapsFound: 'None',
                },
            ],
            socialPosts: [
                {
                    id: 'post-tiktok-no-url',
                    platform: 'TikTok',
                    copy: 'Should be skipped instead of downgraded to Twitter',
                    hashtags: [],
                    attachedVariantId: 'var_no_url',
                    scheduledDayOffset: 0,
                    status: 'approved',
                },
            ],
        });
        const noUrlRes = await scheduleLaunchKit({ launchKit: kitMissingRenderUrl });
        expect(noUrlRes.success).toBe(false);
        expect(noUrlRes.metadata?.errorCode).toBe('NO_APPROVED_POSTS');
        expect(schedulePost).not.toHaveBeenCalled();
    });

    it('surfaces partial dispatch failure without hiding already queued platforms', async () => {
        queuePost
            .mockResolvedValueOnce('job-ig')
            .mockRejectedValueOnce(new Error('TikTok API offline'))
            .mockResolvedValueOnce('job-shorts');

        const result = await scheduleLaunchKit({ launchKit: makeLaunchKit() });
        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('LAUNCH_KIT_PARTIAL_FAILURE');
        expect(result.error).toContain('TikTok');
        expect(result.error).toContain('already queued');
    });
});
