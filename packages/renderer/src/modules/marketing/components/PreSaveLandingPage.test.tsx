import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getCampaign: vi.fn(),
    recordLead: vi.fn(),
    renderShareCard: vi.fn(),
    shareOrDownloadImage: vi.fn(),
}));

vi.mock('@/services/marketing/PreSaveCampaignService', () => ({
    preSaveCampaignService: {
        getCampaign: mocks.getCampaign,
        recordLead: mocks.recordLead,
    },
}));

vi.mock('@shared/share/ShareCardRenderer', () => ({
    renderShareCard: mocks.renderShareCard,
}));

vi.mock('@shared/share/shareFile', () => ({
    shareOrDownloadImage: mocks.shareOrDownloadImage,
}));

import { PreSaveLandingPage } from '@/modules/marketing/components/PreSaveLandingPage';

describe('PreSaveLandingPage', () => {
    const originalShare = navigator.share;
    const originalClipboard = navigator.clipboard;
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        vi.useRealTimers();
        mocks.getCampaign.mockReset();
        mocks.recordLead.mockReset();
        mocks.renderShareCard.mockReset();
        mocks.shareOrDownloadImage.mockReset();
        mocks.getCampaign.mockResolvedValue({
            id: 'campaign-123',
            title: 'Midnight Frequencies',
            releaseDate: Date.UTC(2026, 8, 1),
            coverArtUrl: 'https://cdn.example.com/cover.jpg',
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
        mocks.renderShareCard.mockResolvedValue({
            blob: new Blob(['png'], { type: 'image/png' }),
            coverOmitted: false,
        });
        mocks.shareOrDownloadImage.mockResolvedValue('downloaded');
    });

    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
        Object.defineProperty(window, 'matchMedia', { value: originalMatchMedia, configurable: true });
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

    it('ticks a live countdown and stops the interval once the release instant arrives', async () => {
        vi.useFakeTimers();
        const baseNow = new Date(Date.UTC(2026, 8, 1, 0, 0, 0));
        vi.setSystemTime(baseNow);
        mocks.getCampaign.mockResolvedValueOnce({
            id: 'campaign-123',
            title: 'Midnight Frequencies',
            releaseDate: baseNow.getTime() + 2000,
            coverArtUrl: '',
            links: { spotify: 'https://open.spotify.com/album/abc123' },
            captureEmails: false,
            capturePhones: false,
            themeColor: '#22c55e',
            status: 'active',
        });

        render(<PreSaveLandingPage campaignId="campaign-123" />);
        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('2 seconds until release')).toBeInTheDocument();
        expect(screen.getByText('02')).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('1 second until release')).toBeInTheDocument();
        expect(screen.getByText('01')).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getAllByText('Out now').length).toBeGreaterThanOrEqual(1);
    });

    it('copies canonical drop link on desktop and keeps Share this drop enabled during feedback', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: false }),
            configurable: true,
        });

        render(<PreSaveLandingPage campaignId="campaign-123" />);
        const shareBtn = await screen.findByRole('button', { name: /Share this drop/i });
        fireEvent.click(shareBtn);

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/presave/campaign-123`);
            expect(screen.getByRole('status')).toHaveTextContent('Link copied');
        });
        expect(shareBtn).not.toBeDisabled();
    });

    it('uses navigator.share on coarse-pointer mobile and reports Copy failed if clipboard rejects', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'share', { value: share, configurable: true });
        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: true }),
            configurable: true,
        });

        render(<PreSaveLandingPage campaignId="campaign-123" />);
        const shareBtn = await screen.findByRole('button', { name: /Share this drop/i });
        fireEvent.click(shareBtn);

        await waitFor(() => {
            expect(share).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Midnight Frequencies',
                url: `${window.location.origin}/presave/campaign-123`,
            }));
        });

        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: false }),
            configurable: true,
        });
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
            configurable: true,
        });
        fireEvent.click(shareBtn);
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Copy failed');
        });
    });

    it('renders and shares a fan-voice Story card PNG and displays errors if export fails', async () => {
        render(<PreSaveLandingPage campaignId="campaign-123" />);
        const storyBtn = await screen.findByRole('button', { name: /Story card/i });
        fireEvent.click(storyBtn);

        await waitFor(() => {
            expect(mocks.renderShareCard).toHaveBeenCalledWith(
                expect.objectContaining({
                    eyebrow: 'Out now',
                    title: 'Midnight Frequencies',
                    accentFrom: '#22c55e',
                    accentTo: '#FE2E9A',
                }),
                'story',
            );
            expect(mocks.shareOrDownloadImage).toHaveBeenCalledWith(
                expect.any(Blob),
                'midnight-frequencies-story.png',
                expect.objectContaining({ title: 'Midnight Frequencies' }),
            );
            expect(screen.getByRole('status')).toHaveTextContent('Story card downloaded');
        });

        mocks.renderShareCard.mockRejectedValueOnce(new Error('Canvas failed'));
        fireEvent.click(storyBtn);
        expect(await screen.findByRole('alert')).toHaveTextContent('Canvas failed');
    });

    it('includes UTM growth attribution on both header and footer indii.music links', async () => {
        render(<PreSaveLandingPage campaignId="campaign-123" />);
        await screen.findByRole('heading', { name: 'Midnight Frequencies' });

        const expectedHref = 'https://indii.music/?utm_source=presave&utm_medium=fan_page&utm_campaign=campaign-123';
        expect(screen.getByRole('link', { name: 'indii.music' })).toHaveAttribute('href', expectedHref);
        expect(screen.getByRole('link', { name: 'made with indii · indii.music' })).toHaveAttribute('href', expectedHref);
    });
});
