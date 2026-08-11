import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PreSaveCampaignBuilder from './PreSaveCampaignBuilder';

const mocks = vi.hoisted(() => ({
    createCampaign: vi.fn(),
}));

vi.mock('@/services/marketing/PreSaveCampaignService', () => ({
    preSaveCampaignService: {
        createCampaign: mocks.createCampaign,
        listCampaigns: vi.fn().mockResolvedValue([]),
        getCampaignUrl: (campaignId: string) => `https://app.indii.music/presave/${campaignId}`,
    },
}));

describe('PreSaveCampaignBuilder', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mocks.createCampaign.mockReset();
        mocks.createCampaign.mockResolvedValue('campaign-123');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined),
        });
    });

    it('does not expose Copy or Share until the campaign is durably created', () => {
        render(<PreSaveCampaignBuilder />);

        expect(screen.queryByRole('button', { name: /^Copy$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Share$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /Campaign QR code/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Publish the campaign to create a shareable URL/i)).toBeInTheDocument();
    });

    it('publishes first, then shares the persisted app.indii.music URL', async () => {
        const shareSpy = navigator.share as unknown as ReturnType<typeof vi.fn>;
        render(<PreSaveCampaignBuilder />);

        fireEvent.change(screen.getByLabelText(/Track \/ Release Title/i), {
            target: { value: 'Midnight Frequencies' },
        });
        fireEvent.change(screen.getByLabelText(/Release Date/i), {
            target: { value: '2026-09-01' },
        });
        fireEvent.change(screen.getByPlaceholderText('https://open.spotify.com/album/...'), {
            target: { value: 'https://open.spotify.com/album/abc123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Publish Campaign/i }));

        await waitFor(() => {
            expect(mocks.createCampaign).toHaveBeenCalledTimes(1);
            expect(screen.getAllByText('https://app.indii.music/presave/campaign-123')).toHaveLength(2);
            expect(screen.getByRole('img', { name: /Campaign QR code/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Share$/i }));

        await waitFor(() => {
            expect(shareSpy).toHaveBeenCalledWith({
                title: 'Midnight Frequencies',
                text: 'Open this pre-save campaign page.',
                url: 'https://app.indii.music/presave/campaign-123',
            });
        });
    });

    it('shows persistence failure honestly and never unlocks sharing', async () => {
        mocks.createCampaign.mockRejectedValueOnce(new Error('permission-denied'));
        render(<PreSaveCampaignBuilder />);

        fireEvent.change(screen.getByLabelText(/Track \/ Release Title/i), {
            target: { value: 'Midnight Frequencies' },
        });
        fireEvent.change(screen.getByLabelText(/Release Date/i), {
            target: { value: '2026-09-01' },
        });
        fireEvent.change(screen.getByPlaceholderText('https://open.spotify.com/album/...'), {
            target: { value: 'https://open.spotify.com/album/abc123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Publish Campaign/i }));

        expect(await screen.findByText(/Campaign was not published/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Share$/i })).not.toBeInTheDocument();
    });

    it('renders listed smart links and switches to edit mode when requested', async () => {
        const { preSaveCampaignService } = await import('@/services/marketing/PreSaveCampaignService');
        vi.mocked(preSaveCampaignService.listCampaigns).mockResolvedValueOnce([
            {
                id: 'campaign-456',
                title: 'Solar Echoes',
                releaseDate: new Date('2026-10-15T00:00:00').getTime(),
                coverArtUrl: 'https://cdn.indii.music/solar.jpg',
                links: { spotify: 'https://open.spotify.com/album/solar' },
                captureEmails: true,
                capturePhones: false,
                themeColor: '#22c55e',
                status: 'active',
                leadCount: 42,
                createdAt: Date.now(),
            },
        ]);

        render(<PreSaveCampaignBuilder />);

        expect(await screen.findByText('Solar Echoes')).toBeInTheDocument();
        expect(screen.getByText('42 presaves')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

        expect(await screen.findByDisplayValue('Solar Echoes')).toBeInTheDocument();
    });
});
