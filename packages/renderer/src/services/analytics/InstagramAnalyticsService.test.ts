import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    mockFunctions: {},
    mockAuth: {
        currentUser: { uid: 'user-ig-1' } as { uid: string } | null,
    },
    mockHttpsCallable: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.mockAuth,
    functions: mocks.mockFunctions,
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: unknown[]) => mocks.mockHttpsCallable(...args),
}));

vi.mock('@sentry/react', () => ({
    captureException: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { InstagramAnalyticsService } from './InstagramAnalyticsService';

describe('InstagramAnalyticsService', () => {
    let service: InstagramAnalyticsService;
    let mockProxyCallable: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockAuth.currentUser = { uid: 'user-ig-1' };
        service = new InstagramAnalyticsService();
        mockProxyCallable = vi.fn();
        mocks.mockHttpsCallable.mockImplementation((_functions, name: string) => {
            if (name === 'instagramAnalyticsProxy') return mockProxyCallable;
            return vi.fn();
        });
    });

    it('fetches user profile via backend proxy', async () => {
        mockProxyCallable.mockResolvedValue({
            data: {
                ok: true,
                data: {
                    id: 'ig-user-123',
                    username: 'testartist',
                    name: 'Test Artist',
                    followers_count: 1500,
                    follows_count: 300,
                    media_count: 42,
                },
            },
        });

        const profile = await service.getUserProfile('ig-user-123');

        expect(profile.username).toBe('testartist');
        expect(profile.followers_count).toBe(1500);
        expect(mockProxyCallable).toHaveBeenCalledWith({
            endpoint: 'getUserProfile',
            params: { igUserId: 'ig-user-123' },
        });
    });

    it('fetches reels and filters to video/reels media only', async () => {
        mockProxyCallable.mockResolvedValue({
            data: {
                ok: true,
                data: {
                    data: [
                        { id: 'reel-1', media_type: 'VIDEO', media_product_type: 'REELS' },
                        { id: 'photo-1', media_type: 'IMAGE', media_product_type: 'FEED' },
                        { id: 'reel-2', media_type: 'VIDEO', media_product_type: 'FEED' },
                    ],
                },
            },
        });

        const reels = await service.getReels(10);

        expect(reels).toHaveLength(2);
        expect(reels.map(r => r.id)).toEqual(['reel-1', 'reel-2']);
        expect(mockProxyCallable).toHaveBeenCalledWith({
            endpoint: 'getReels',
            params: { limit: 10 },
        });
    });

    it('fetches reel insights via backend proxy and parses metrics', async () => {
        mockProxyCallable.mockResolvedValue({
            data: {
                ok: true,
                data: {
                    data: [
                        { name: 'plays', values: [{ value: 1200 }] },
                        { name: 'reach', values: [{ value: 900 }] },
                        { name: 'impressions', values: [{ value: 1500 }] },
                        { name: 'likes', values: [{ value: 100 }] },
                        { name: 'comments', values: [{ value: 15 }] },
                        { name: 'shares', values: [{ value: 8 }] },
                        { name: 'saved', values: [{ value: 25 }] },
                    ],
                },
            },
        });

        const insights = await service.getReelInsights('reel-123');

        expect(insights).toEqual({
            plays: 1200,
            reach: 900,
            impressions: 1500,
            likes: 100,
            comments: 15,
            shares: 8,
            saved: 25,
        });
        expect(mockProxyCallable).toHaveBeenCalledWith({
            endpoint: 'getReelInsights',
            params: { mediaId: 'reel-123' },
        });
    });

    it('fetches account daily insights via proxy and sorts by date', async () => {
        mockProxyCallable.mockResolvedValue({
            data: {
                ok: true,
                data: {
                    data: [
                        {
                            name: 'impressions',
                            values: [
                                { end_time: '2026-11-02T07:00:00+0000', value: 200 },
                                { end_time: '2026-11-01T07:00:00+0000', value: 100 },
                            ],
                        },
                        {
                            name: 'reach',
                            values: [
                                { end_time: '2026-11-02T07:00:00+0000', value: 150 },
                                { end_time: '2026-11-01T07:00:00+0000', value: 80 },
                            ],
                        },
                    ],
                },
            },
        });

        const daily = await service.getAccountDailyInsights('ig-123');

        expect(daily).toHaveLength(2);
        expect(daily[0]).toEqual({
            date: '2026-11-01',
            impressions: 100,
            reach: 80,
            profileViews: 0,
        });
        expect(daily[1]).toEqual({
            date: '2026-11-02',
            impressions: 200,
            reach: 150,
            profileViews: 0,
        });
    });

    it('builds platform data aggregating plays and saves without throwing', async () => {
        mockProxyCallable.mockImplementation(async ({ endpoint, params }) => {
            if (endpoint === 'getReels') {
                return {
                    data: {
                        ok: true,
                        data: {
                            data: [
                                { id: 'reel-1', media_type: 'VIDEO', media_product_type: 'REELS' },
                                { id: 'reel-2', media_type: 'VIDEO', media_product_type: 'REELS' },
                            ],
                        },
                    },
                };
            }
            if (endpoint === 'getReelInsights') {
                const plays = params?.mediaId === 'reel-1' ? 500 : 300;
                const saved = params?.mediaId === 'reel-1' ? 10 : 5;
                return {
                    data: {
                        ok: true,
                        data: {
                            data: [
                                { name: 'plays', values: [{ value: plays }] },
                                { name: 'saved', values: [{ value: saved }] },
                            ],
                        },
                    },
                };
            }
            return { data: { ok: true, data: {} } };
        });

        const platformData = await service.buildPlatformData();

        expect(platformData.platform).toBe('instagram_reels');
        expect(platformData.streams).toBe(800);
        expect(platformData.saves).toBe(15);
    });
});
