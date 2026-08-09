import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    PlatformOAuthCallback,
} from './PlatformOAuthCallback';
import {
    getPlatformOAuthCallbackProvider,
    type PlatformOAuthCallbackProvider,
} from './platformOAuthCallbackRoute';

const services = vi.hoisted(() => ({
    spotify: { handleCallback: vi.fn() },
    tiktok: { handleCallback: vi.fn() },
}));

vi.mock('@/services/analytics/SpotifyService', () => ({ spotifyService: services.spotify }));
vi.mock('@/services/analytics/TikTokAnalyticsService', () => ({ tikTokAnalyticsService: services.tiktok }));

function renderCallback(provider: PlatformOAuthCallbackProvider, url: string) {
    return render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path={`/auth/${provider}/callback`} element={<PlatformOAuthCallback provider={provider} />} />
                <Route path="/analytics" element={<p>Analytics destination</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('PlatformOAuthCallback production route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        services.spotify.handleCallback.mockResolvedValue(undefined);
        services.tiktok.handleCallback.mockResolvedValue(undefined);
    });

    it.each([
        ['/auth/spotify/callback', 'spotify'],
        ['/auth/spotify/callback/', 'spotify'],
        ['/auth/tiktok/callback', 'tiktok'],
        ['/auth/tiktok/callback/', 'tiktok'],
    ] as const)('maps %s to the %s callback used by App', (path, provider) => {
        expect(getPlatformOAuthCallbackProvider(path)).toBe(provider);
    });

    it('does not claim unsupported callback URLs', () => {
        expect(getPlatformOAuthCallbackProvider('/auth/youtube/callback')).toBeNull();
        expect(getPlatformOAuthCallbackProvider('/analytics')).toBeNull();
    });

    it('completes the Spotify exchange before returning to Analytics', async () => {
        renderCallback('spotify', '/auth/spotify/callback?code=spotify-code&state=spotify-state');

        expect(await screen.findByText('Analytics destination')).toBeInTheDocument();
        expect(services.spotify.handleCallback).toHaveBeenCalledWith('spotify-code', 'spotify-state');
        expect(services.tiktok.handleCallback).not.toHaveBeenCalled();
    });

    it('completes the TikTok exchange before returning to Analytics', async () => {
        renderCallback('tiktok', '/auth/tiktok/callback?code=tiktok-code&state=tiktok-state');

        expect(await screen.findByText('Analytics destination')).toBeInTheDocument();
        expect(services.tiktok.handleCallback).toHaveBeenCalledWith('tiktok-code', 'tiktok-state');
        expect(services.spotify.handleCallback).not.toHaveBeenCalled();
    });

    it('surfaces a provider rejection without attempting token exchange', async () => {
        renderCallback('spotify', '/auth/spotify/callback?error=access_denied&state=spotify-state');

        expect(await screen.findByRole('alert')).toHaveTextContent('authorization was declined');
        expect(services.spotify.handleCallback).not.toHaveBeenCalled();
    });

    it('stays on the callback surface when the account-bound exchange fails', async () => {
        services.tiktok.handleCallback.mockRejectedValueOnce(new Error('OAuth session belongs to another account.'));
        renderCallback('tiktok', '/auth/tiktok/callback?code=tiktok-code&state=tiktok-state');

        expect(await screen.findByRole('alert')).toHaveTextContent('another account');
        expect(screen.queryByText('Analytics destination')).not.toBeInTheDocument();
    });
});
