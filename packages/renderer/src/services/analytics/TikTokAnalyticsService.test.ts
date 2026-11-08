import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    mockFunctions: {},
    mockAuth: {
        currentUser: { uid: 'user-tiktok-1' } as { uid: string } | null,
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

import { TikTokAnalyticsService } from './TikTokAnalyticsService';

describe('TikTokAnalyticsService', () => {
    let service: TikTokAnalyticsService;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockAuth.currentUser = { uid: 'user-tiktok-1' };
        service = new TikTokAnalyticsService();
        mockFetch = vi.fn();
        global.fetch = mockFetch as unknown as typeof fetch;
    });

    it('caches valid access token across requests', async () => {
        const refreshCallable = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                accessToken: 'tiktok-access-token-123',
                expiresAt: Date.now() + 86400 * 1000,
            },
        });
        mocks.mockHttpsCallable.mockReturnValue(refreshCallable);

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                data: {
                    user: {
                        open_id: 'tiktok-user',
                        display_name: 'Artist',
                        avatar_url: 'https://example.com/avatar.jpg',
                        follower_count: 5000,
                        following_count: 100,
                        likes_count: 20000,
                        video_count: 10,
                    },
                },
            }),
        });

        const user1 = await service.getUserInfo();
        const user2 = await service.getUserInfo();

        expect(user1.open_id).toBe('tiktok-user');
        expect(user2.open_id).toBe('tiktok-user');
        expect(refreshCallable).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clears cached token on disconnect', async () => {
        const refreshCallable = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                accessToken: 'tiktok-token-to-clear',
                expiresAt: Date.now() + 86400 * 1000,
            },
        });
        const revokeCallable = vi.fn().mockResolvedValue({ data: { ok: true } });
        mocks.mockHttpsCallable.mockImplementation((_functions, name: string) => {
            if (name === 'analyticsRefreshToken') return refreshCallable;
            if (name === 'analyticsRevokeToken') return revokeCallable;
            return vi.fn();
        });

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                data: {
                    user: {
                        open_id: 'tiktok-user',
                        display_name: 'Artist',
                        avatar_url: '',
                        follower_count: 0,
                        following_count: 0,
                        likes_count: 0,
                        video_count: 0,
                    },
                },
            }),
        });

        await service.getUserInfo();
        expect(refreshCallable).toHaveBeenCalledTimes(1);

        await service.disconnect();
        expect(revokeCallable).toHaveBeenCalledWith({ platform: 'tiktok' });

        await service.getUserInfo();
        expect(refreshCallable).toHaveBeenCalledTimes(2);
    });
});
