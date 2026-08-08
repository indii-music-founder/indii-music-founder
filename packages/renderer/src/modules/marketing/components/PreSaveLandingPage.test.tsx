import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getCampaign: vi.fn(),
    recordLead: vi.fn(),
}));

vi.mock('@/services/marketing/PreSaveCampaignService', () => ({
    preSaveCampaignService: {
        getCampaign: mocks.getCampaign,
        recordLead: mocks.recordLead,
    },
}));

import { PreSaveLandingPage } from './PreSaveLandingPage';

describe('PreSaveLandingPage', () => {
    beforeEach(() => {
        mocks.getCampaign.mockReset();
        mocks.recordLead.mockReset();
        mocks.getCampaign.mockResolvedValue({
            id: 'campaign-123',
            title: 'Midnight Frequencies',
            releaseDate: Date.UTC(2026, 8, 1),
            coverArtUrl: '',
            links: { spotify: 'https://open.spotify.com/album/abc123' },
            captureEmails: true,
            capturePhones: false,
            themeColor: '#22c55e',
            status: 'active',
        });
        mocks.recordLead.mockResolvedValue({
            presaved: true,
            campaignId: 'campaign-123',
            leadId: 'lead-123',
        });
    });

    it('persists consented fan data before redirecting to the selected DSP', async () => {
        const onRedirect = vi.fn();
        render(<PreSaveLandingPage campaignId="campaign-123" onRedirect={onRedirect} />);

        expect(await screen.findByRole('heading', { name: 'Midnight Frequencies' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'fan@example.com' } });
        fireEvent.click(screen.getByRole('checkbox', { name: /release updates/i }));
        fireEvent.click(screen.getByRole('button', { name: /Pre-save on Spotify/i }));

        await waitFor(() => {
            expect(mocks.recordLead).toHaveBeenCalledWith(
                'campaign-123',
                expect.objectContaining({
                    dsp: 'spotify',
                    email: 'fan@example.com',
                    optInMarketing: true,
                }),
            );
            expect(onRedirect).toHaveBeenCalledWith('https://open.spotify.com/album/abc123');
        });
    });

    it('does not redirect or claim success when lead persistence fails', async () => {
        mocks.recordLead.mockResolvedValueOnce({
            presaved: false,
            reason: 'FIRESTORE_ERROR',
            message: 'Could not save your pre-save.',
        });
        const onRedirect = vi.fn();
        render(<PreSaveLandingPage campaignId="campaign-123" onRedirect={onRedirect} />);

        await screen.findByRole('heading', { name: 'Midnight Frequencies' });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'fan@example.com' } });
        fireEvent.click(screen.getByRole('checkbox', { name: /release updates/i }));
        fireEvent.click(screen.getByRole('button', { name: /Pre-save on Spotify/i }));

        expect(await screen.findByText(/Could not save your pre-save/i)).toBeInTheDocument();
        expect(onRedirect).not.toHaveBeenCalled();
    });

    it('renders an honest unavailable state when the campaign cannot be loaded', async () => {
        mocks.getCampaign.mockRejectedValueOnce(new Error('not-found'));
        render(<PreSaveLandingPage campaignId="missing" />);

        expect(await screen.findByText(/campaign is unavailable/i)).toBeInTheDocument();
    });
});
