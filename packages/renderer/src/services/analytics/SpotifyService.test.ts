import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    mockFunctions: {},
    mockAuth: {
        currentUser: { uid: 'user-spotify-1' } as { uid: string } | null,
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

import { SpotifyService } from './SpotifyService';

describe('SpotifyService', () => {
    let service: SpotifyService;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockAuth.currentUser = { uid: 'user-spotify-1' };
        service = new SpotifyService();
        mockFetch = vi.fn();
        global.fetch = mockFetch as unknown as typeof fetch;
    });

    it('caches valid access token in memory across multiple requests', async () => {
        const refreshCallable = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                accessToken: 'spotify-access-token-123',
                expiresAt: Date.now() + 3600 * 1000,
            },
        });
        mocks.mockHttpsCallable.mockReturnValue(refreshCallable);

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: 'track-1', name: 'Song One' }),
        });

        const track1 = await service.getTrack('track-1');
        const track2 = await service.getTrack('track-2');

        expect(track1).toEqual({ id: 'track-1', name: 'Song One' });
        expect(track2).toEqual({ id: 'track-1', name: 'Song One' });
        expect(refreshCallable).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('encodes URI components in trackId and artistId', async () => {
        const refreshCallable = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                accessToken: 'spotify-token',
                expiresAt: Date.now() + 3600 * 1000,
            },
        });
        mocks.mockHttpsCallable.mockReturnValue(refreshCallable);

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: 'escaped' }),
        });

        await service.getTrack('track/with/slash?query=1');
        expect(mockFetch).toHaveBeenLastCalledWith(
            'https://api.spotify.com/v1/tracks/track%2Fwith%2Fslash%3Fquery%3D1',
            expect.objectContaining({
                headers: { Authorization: 'Bearer spotify-token' },
                signal: expect.anything(),
            }),
        );

        await service.getArtist('artist#with#hash');
        expect(mockFetch).toHaveBeenLastCalledWith(
            'https://api.spotify.com/v1/artists/artist%23with%23hash',
            expect.objectContaining({
                headers: { Authorization: 'Bearer spotify-token' },
                signal: expect.anything(),
            }),
        );
    });

    it('clears cached token on disconnect', async () => {
        const refreshCallable = vi.fn().mockResolvedValue({
            data: {
                ok: true,
                accessToken: 'spotify-token-to-clear',
                expiresAt: Date.now() + 3600 * 1000,
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
            json: async () => ({ id: 'track-1' }),
        });

        await service.getTrack('track-1');
        expect(refreshCallable).toHaveBeenCalledTimes(1);

        await service.disconnect();
        expect(revokeCallable).toHaveBeenCalledWith({ platform: 'spotify' });

        await service.getTrack('track-1');
        expect(refreshCallable).toHaveBeenCalledTimes(2);
    });
});
