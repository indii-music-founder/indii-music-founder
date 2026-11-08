import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketingAssetGeneratorUI from './MarketingAssetGeneratorUI';

vi.mock('@/services/marketing/CampaignIntelligenceService', () => ({
    CampaignIntelligence: {
        generateMarketingVideo: vi.fn(),
    },
}));

/**
 * ISSUE-954: reel mode is text-to-video only — GenAI.generateVideo never
 * receives or conditions on audio. The upload step must not offer/imply
 * audio synchronization in that mode.
 */
describe('MarketingAssetGeneratorUI (ISSUE-954)', () => {
    it('keeps additional styles collapsed and preserves the selected alternative when choosing one', async () => {
        render(<MarketingAssetGeneratorUI />);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const moreStyles = await screen.findByRole('button', { name: 'More styles' });
        expect(moreStyles).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: /^Analog Film/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cyberpunk/i })).not.toBeInTheDocument();

        fireEvent.click(moreStyles);
        fireEvent.click(screen.getByRole('button', { name: /^Analog Film/ }));

        expect(screen.getByRole('button', { name: /^Analog Film/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'More styles' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: /^Documentary/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Cinematic Moody/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reel mode (default) never offers an audio upload or implies synchronization', () => {
        render(<MarketingAssetGeneratorUI />);

        expect(screen.queryByText('Click or drag to upload audio')).not.toBeInTheDocument();
        expect(screen.queryByText(/WAV, MP3, or FLAC/i)).not.toBeInTheDocument();
        expect(screen.getByText(/generates video from your text prompt only/i)).toBeInTheDocument();
    });
});

describe('MarketingAssetGeneratorUI reel generation (ISSUE-1604)', () => {
    it('generates marketing video reel and displays completed video player in step 4', async () => {
        const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
        vi.mocked(CampaignIntelligence.generateMarketingVideo).mockResolvedValueOnce('https://storage.googleapis.com/test-bucket/marketing-reel.mp4');

        render(<MarketingAssetGeneratorUI />);
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        const promptInput = await screen.findByPlaceholderText(/A slow tracking shot through a recording studio/i);
        fireEvent.change(promptInput, { target: { value: 'A slow cinematic tracking shot of an empty studio' } });

        const generateBtn = screen.getByRole('button', { name: /Generate Video/i });
        expect(generateBtn).not.toBeDisabled();
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(CampaignIntelligence.generateMarketingVideo).toHaveBeenCalledWith(
                'A slow cinematic tracking shot of an empty studio',
                'cinematic'
            );
        });

        expect(await screen.findByText('Generation Complete')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    it('displays actionable error message and returns to step 2 when generation fails', async () => {
        const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
        vi.mocked(CampaignIntelligence.generateMarketingVideo).mockRejectedValueOnce(
            new Error('Video generation quota exceeded for billing tier.')
        );

        render(<MarketingAssetGeneratorUI />);
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        const promptInput = await screen.findByPlaceholderText(/A slow tracking shot through a recording studio/i);
        fireEvent.change(promptInput, { target: { value: 'A slow tracking shot' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Video/i }));

        expect(await screen.findByText('Video generation quota exceeded for billing tier.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Video/i })).toBeInTheDocument();
    });
});
