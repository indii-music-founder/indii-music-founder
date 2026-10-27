import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlatformConnector } from './PlatformConnector';

vi.mock('@/services/analytics/SpotifyService', () => ({
    spotifyService: {
        isConnected: vi.fn().mockResolvedValue(false),
        initiateOAuth: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock('@/services/analytics/YouTubeAnalyticsService', () => ({
    youTubeAnalyticsService: {
        isConnected: vi.fn().mockResolvedValue(false),
        requestYouTubeAccess: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock('@/services/analytics/TikTokAnalyticsService', () => ({
    tikTokAnalyticsService: {
        isConnected: vi.fn().mockResolvedValue(false),
        initiateOAuth: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock('@/services/analytics/InstagramAnalyticsService', () => ({
    instagramAnalyticsService: {
        isConnected: vi.fn().mockResolvedValue(false),
        initiateOAuth: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock('@/services/analytics/AppleMusicService', () => ({
    appleMusicService: {
        isConnected: vi.fn().mockResolvedValue(false),
        connect: vi.fn(),
        disconnect: vi.fn(),
    },
}));

describe('PlatformConnector', () => {
    it('renders Apple Music as unavailable and disables its connect action', async () => {
        render(<PlatformConnector />);

        expect(await screen.findByText('Apple Music')).toBeInTheDocument();
        expect(screen.getByText('Apple Music analytics are unavailable until the secured backend integration is configured.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    });

    it('renders Twitter / X card with walkthrough guide button', async () => {
        render(<PlatformConnector />);

        expect(await screen.findByText('Twitter / X')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open walkthrough guide for Twitter / X' })).toBeInTheDocument();
    });

    it('opens PlatformWalkthroughModal when Setup Walkthrough Copilot button is clicked', async () => {
        render(<PlatformConnector />);

        const copilotBtn = await screen.findByRole('button', { name: /Setup Walkthrough Copilot/i });
        fireEvent.click(copilotBtn);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Platform Connection Copilot')).toBeInTheDocument();
    });
});
