import { describe, expect, it, vi } from 'vitest';

import { TikTokAnalyticsService } from './TikTokAnalyticsService';
import { YouTubeAnalyticsService } from './YouTubeAnalyticsService';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));
vi.mock('firebase/auth', () => ({
    GoogleAuthProvider: class {
        addScope() {}
    },
    reauthenticateWithPopup: vi.fn(),
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

describe('provider metric boundaries', () => {
    it('keeps TikTok views but does not relabel likes, shares, or upload dates', async () => {
        const service = new TikTokAnalyticsService();
        vi.spyOn(service, 'getVideoList').mockResolvedValue([{
            id: 'video-1',
            title: 'Video',
            cover_image_url: '',
            share_url: '',
            video_description: '',
            duration: 15,
            height: 1920,
            width: 1080,
            view_count: 12_000,
            like_count: 2_000,
            comment_count: 100,
            share_count: 500,
            create_time: 1_700_000_000,
        }] as never);

        await expect(service.buildPlatformData()).resolves.toMatchObject({
            streams: 12_000,
            saves: 0,
            completionRate: 0,
            savesUnavailable: true,
            completionUnavailable: true,
        });
        await expect(service.buildStreamHistory()).resolves.toEqual([]);
    });

    it('does not derive YouTube completion, saves, or weekly growth from incomparable fields', async () => {
        const service = new YouTubeAnalyticsService();
        vi.spyOn(service, 'getChannel').mockResolvedValue({ id: 'channel-1' } as never);
        vi.spyOn(service, 'getChannelDailyAnalytics').mockResolvedValue([{
            date: '2026-08-08',
            views: 2_000,
            watchMinutes: 4_000,
            likes: 300,
            subscribersGained: 10,
        }]);
        vi.spyOn(service, 'getGeographicBreakdown').mockResolvedValue([
            { country: 'US', views: 1_500 },
            { country: 'CA', views: 500 },
        ]);

        await expect(service.buildPlatformData()).resolves.toMatchObject({
            platform: 'youtube',
            streams: 2_000,
            saves: 0,
            completionRate: 0,
            savesUnavailable: true,
            completionUnavailable: true,
        });
        const regions = await service.buildRegionData('channel-1');
        expect(regions.map(region => region.growthRate)).toEqual([null, null]);
    });
});
