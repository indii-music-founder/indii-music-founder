import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReleaseLaunchKitSchema, type ScoredAdVariantRecord } from '@indii/shared';
import {
    CampaignIntelligence,
    attachSmartLinkAttribution,
    resolveMarketingImageModel,
} from '@/services/marketing/CampaignIntelligenceService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: vi.fn(async () => 'gs://bucket/generated.png'),
    },
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn((_s, p) => ({ fullPath: p })),
    getDownloadURL: vi.fn(async () => 'https://cdn.example.com/generated.png'),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn(),
        generateImage: vi.fn(),
        generateText: vi.fn(),
        generateVideo: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: {
                displayName: 'Midnight Signal',
                brandKit: {
                    brandDescription: 'Electronic indie duo from Detroit',
                    aestheticStyle: 'Neon analog synthwave',
                    releaseDetails: {
                        title: 'Electric Horizon',
                        type: 'Single',
                        mood: 'Euphoric',
                        themes: 'Night drives, liberation',
                        genre: 'Indie Electronic',
                    },
                },
            },
        }),
    },
}));

describe('attachSmartLinkAttribution', () => {
    it('appends UTM query params while preserving existing query params', () => {
        const result = attachSmartLinkAttribution(
            'https://indii.music/midnight-signal?ref=bio',
            'TikTok',
            'Electric Horizon Drop',
        );
        const parsed = new URL(result);
        expect(parsed.searchParams.get('ref')).toBe('bio');
        expect(parsed.searchParams.get('utm_source')).toBe('tiktok');
        expect(parsed.searchParams.get('utm_medium')).toBe('social');
        expect(parsed.searchParams.get('utm_campaign')).toBe('electric-horizon-drop');
    });

    it('returns the original string cleanly when given a malformed URL', () => {
        expect(attachSmartLinkAttribution('not a valid url', 'X', 'launch')).toBe('not a valid url');
        expect(attachSmartLinkAttribution('', 'Instagram', 'launch')).toBe('');
    });
});

describe('CampaignIntelligence.generateReleaseLaunchKit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const variants: ScoredAdVariantRecord[] = [
        {
            variantId: 'cut_9x16_rejected_high',
            shape: '9:16',
            durationSeconds: 15,
            channelLabel: 'IG Reels / TikTok',
            renderUrl: 'https://cdn.example.com/rejected-9x16.mp4',
            overallScore: 9.8,
            brandQcApproved: false,
            approved: true,
            discardedForRegression: false,
            attemptsUsed: 1,
            gapsFound: 'Logo contrast failed',
        },
        {
            variantId: 'cut_9x16_regressed',
            shape: '9:16',
            durationSeconds: 15,
            channelLabel: 'IG Reels / TikTok',
            renderUrl: 'https://cdn.example.com/regressed-9x16.mp4',
            overallScore: 9.6,
            brandQcApproved: true,
            approved: true,
            discardedForRegression: true,
            attemptsUsed: 2,
            gapsFound: 'Regressed on retry',
        },
        {
            variantId: 'cut_9x16_winner',
            shape: '9:16',
            durationSeconds: 15,
            channelLabel: 'IG Reels / TikTok',
            renderUrl: 'https://cdn.example.com/winner-9x16.mp4',
            overallScore: 9.3,
            brandQcApproved: true,
            approved: true,
            discardedForRegression: false,
            attemptsUsed: 1,
            gapsFound: 'None',
        },
        {
            variantId: 'cut_9x16_runner_up',
            shape: '9:16',
            durationSeconds: 30,
            channelLabel: 'YouTube Shorts',
            renderUrl: 'https://cdn.example.com/runnerup-9x16.mp4',
            overallScore: 9.0,
            brandQcApproved: true,
            approved: true,
            discardedForRegression: false,
            attemptsUsed: 1,
            gapsFound: 'None',
        },
        {
            variantId: 'cut_1x1_approved',
            shape: '1:1',
            durationSeconds: 15,
            channelLabel: 'X / Square Feed',
            renderUrl: 'https://cdn.example.com/winner-1x1.mp4',
            overallScore: 9.1,
            brandQcApproved: true,
            approved: true,
            discardedForRegression: false,
            attemptsUsed: 1,
            gapsFound: 'None',
        },
        {
            variantId: 'cut_4x5_approved',
            shape: '4:5',
            durationSeconds: 15,
            channelLabel: 'Meta Feed',
            renderUrl: 'https://cdn.example.com/winner-4x5.mp4',
            overallScore: 9.5,
            brandQcApproved: true,
            approved: true,
            discardedForRegression: false,
            attemptsUsed: 1,
            gapsFound: 'None',
        },
    ];

    it('builds a schema-valid ReleaseLaunchKit attaching only approved highest-scoring variants per shape and UTM links', async () => {
        const longXCopy =
            'Electric Horizon drops tonight across every platform with analog synths, live modular drums, and the official beat-synced music video premiere from Detroit — stream it everywhere and tell us your favorite timestamp in the chorus right now! #indiemusic #synthwave #newmusic #electronic #musicvideo #detroit';

        vi.mocked(AI.generateStructuredData).mockResolvedValueOnce({
            posts: [
                {
                    platform: 'Instagram',
                    copy: 'Turn up the chorus drop on Electric Horizon.',
                    hashtags: ['#indiemusic', '#synthwave'],
                    scheduledDayOffset: 0,
                },
                {
                    platform: 'InstagramStory',
                    copy: 'New single out now — tap below.',
                    hashtags: [],
                    scheduledDayOffset: 0,
                },
                {
                    platform: 'TikTok',
                    copy: 'Wait for the drop at 0:42.',
                    hashtags: ['#newmusic', '#electronic'],
                    scheduledDayOffset: 0,
                },
                {
                    platform: 'YouTubeShorts',
                    copy: 'Official Electric Horizon visualizer hook.',
                    hashtags: ['#shorts'],
                    scheduledDayOffset: 1,
                },
                {
                    platform: 'X',
                    copy: longXCopy,
                    hashtags: ['#indiemusic'],
                    scheduledDayOffset: 0,
                },
                {
                    platform: 'XHeader',
                    copy: 'MIDNIGHT SIGNAL — ELECTRIC HORIZON',
                    hashtags: [],
                    scheduledDayOffset: 0,
                },
            ],
        });

        const kit = await CampaignIntelligence.generateReleaseLaunchKit({
            kitId: 'kit-electric-horizon-01',
            title: 'Electric Horizon Launch',
            artistOrBrandName: 'Midnight Signal',
            topic: 'Electric Horizon single drop',
            canonicalRecordingEntityId: 'rec_01',
            canonicalMasterStoragePath: 'audio/masters/electric-horizon.wav',
            measuredBpm: 124,
            hookWindows: [
                {
                    section: 'DROP',
                    startTimeSeconds: 42,
                    endTimeSeconds: 57,
                    energyLevel: 'peak',
                    lyricSnippet: 'Lights across the skyline',
                },
            ],
            lockedReferenceImageUris: ['gs://indii-bucket/cover.png'],
            lockedSeed: 4201,
            smartLinkUrl: 'https://indii.music/midnight-signal',
            adVariants: variants,
        });

        // Must validate against canonical shared schema
        expect(() => ReleaseLaunchKitSchema.parse(kit)).not.toThrow();
        expect(kit.kitId).toBe('kit-electric-horizon-01');
        expect(kit.measuredBpm).toBe(124);

        const byPlatform = new Map(kit.socialPosts.map((p) => [p.platform, p]));

        // Vertical channels pick the highest-scoring approved 9:16 variant, NEVER rejected or regressed variants
        for (const platform of ['Instagram', 'InstagramStory', 'TikTok', 'YouTubeShorts'] as const) {
            expect(byPlatform.get(platform)?.attachedVariantId).toBe('cut_9x16_winner');
            expect(byPlatform.get(platform)?.copy).toContain('utm_source=');
        }

        // X prefers approved 1:1 over 4:5 and enforces <= 280 characters including UTM link
        const xPost = byPlatform.get('X')!;
        expect(xPost.attachedVariantId).toBe('cut_1x1_approved');
        expect(xPost.copy.length).toBeLessThanOrEqual(280);
        expect(xPost.copy).toContain('utm_source=x');

        // XHeader is banner metadata without attached video or SmartLink URL injection
        const xHeader = byPlatform.get('XHeader')!;
        expect(xHeader.attachedVariantId).toBeUndefined();
        expect(xHeader.copy).not.toContain('utm_source=');
    });
});

describe('CampaignIntelligence image model switcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves all MarketingImageModelTier options cleanly from INTELLIGENCE_MODELS.IMAGE', () => {
        expect(resolveMarketingImageModel()).toBe(INTELLIGENCE_MODELS.IMAGE.GENERATION);
        expect(resolveMarketingImageModel('pro')).toBe('gemini-3-pro-image');
        expect(resolveMarketingImageModel('fast')).toBe('gemini-3.1-flash-image');
        expect(resolveMarketingImageModel('imagen-fast')).toBe(INTELLIGENCE_MODELS.IMAGE.IMAGEN_FAST);
        expect(resolveMarketingImageModel('imagen-pro')).toBe(INTELLIGENCE_MODELS.IMAGE.IMAGEN_PRO);
    });

    it('forwards the selected imageModelTier to GenAI.generateImage in generateSingleImage', async () => {
        vi.mocked(AI.generateImage).mockResolvedValueOnce('ZmFrZUJhc2U2NA==');

        const url = await CampaignIntelligence.generateSingleImage(
            {
                id: 'post-switcher-1',
                platform: 'Instagram',
                copy: 'Stream Midnight',
                day: 1,
                status: 'PENDING' as never,
                imageAsset: { assetType: 'image', title: 'Cover', imageUrl: '', caption: 'Minimal studio lighting' },
            },
            { imageModelTier: 'fast' },
        );

        expect(url).toBe('https://cdn.example.com/generated.png');
        expect(AI.generateImage).toHaveBeenCalledWith(expect.any(String), 'gemini-3.1-flash-image');
    });
});
