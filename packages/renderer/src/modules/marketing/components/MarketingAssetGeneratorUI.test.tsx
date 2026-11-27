import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketingAssetGeneratorUI from '@/modules/marketing/components/MarketingAssetGeneratorUI';

vi.mock('@/services/marketing/CampaignIntelligenceService', () => ({
    CampaignIntelligence: {
        generateMarketingVideo: vi.fn(),
    },
}));

vi.mock('@/services/marketing/ShortFormReelService', () => ({
    ShortFormReelService: {
        detectHooks: vi.fn(),
        extractHookAudio: vi.fn(),
        generateHookReel: vi.fn(),
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

describe('MarketingAssetGeneratorUI Audio-Synced Hook Reel mode', () => {
    it('keeps Continue disabled until a track is uploaded, then detects hooks and renders the selected DROP hook reel', async () => {
        const { ShortFormReelService } = await import('@/services/marketing/ShortFormReelService');
        const chorusHook = {
            section: 'CHORUS' as const,
            startTimeSeconds: 32,
            endTimeSeconds: 47,
            durationSeconds: 15,
            energyLevel: 'high' as const,
            lyricSnippet: 'Lights up on the skyline',
        };
        const dropHook = {
            section: 'DROP' as const,
            startTimeSeconds: 64,
            endTimeSeconds: 79,
            durationSeconds: 15,
            energyLevel: 'peak' as const,
            lyricSnippet: 'Feel the bassline hit',
        };

        vi.mocked(ShortFormReelService.detectHooks).mockResolvedValueOnce({
            durationSeconds: 185,
            hooks: [chorusHook, dropHook],
        });
        vi.mocked(ShortFormReelService.extractHookAudio).mockResolvedValueOnce({
            url: 'blob:drop-hook-audio',
            durationSeconds: 15,
        });
        vi.mocked(ShortFormReelService.generateHookReel).mockResolvedValueOnce({
            project: {
                id: 'short_reel_drop_1',
                name: 'midnight — 9:16 Hook Reel',
                fps: 30,
                durationInFrames: 450,
                width: 1080,
                height: 1920,
                tracks: [],
                clips: [],
            },
            videoUrl: 'https://storage.googleapis.com/test-bucket/drop-hook-reel.mp4',
            hookAudioUrl: 'blob:drop-hook-audio',
            hook: dropHook,
        });

        const { container } = render(<MarketingAssetGeneratorUI />);

        // Switch to Audio-Synced Hook Reel mode
        fireEvent.click(screen.getByRole('button', { name: /Audio-Synced Hook Reel/i }));

        // Continue stays disabled until an audio track is uploaded
        const continueBtn = screen.getByRole('button', { name: /Continue/i });
        expect(continueBtn).toBeDisabled();

        const audioInput = container.querySelector('input[type="file"][accept*="audio"]') as HTMLInputElement;
        expect(audioInput).not.toBeNull();
        const trackFile = new File(['wav-bytes'], 'midnight.wav', { type: 'audio/wav' });
        fireEvent.change(audioInput, { target: { files: [trackFile] } });

        await waitFor(() => {
            expect(ShortFormReelService.detectHooks).toHaveBeenCalledWith(trackFile);
        });

        // Both CHORUS and DROP cards appear
        expect(await screen.findByText(/CHORUS · 15s/i)).toBeInTheDocument();
        const dropBtn = screen.getByRole('button', { name: /DROP · 15s/i });
        expect(dropBtn).toBeInTheDocument();

        // Select DROP hook and advance to Step 2
        fireEvent.click(dropBtn);
        expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        const promptInput = await screen.findByPlaceholderText(/A slow tracking shot through a recording studio/i);
        fireEvent.change(promptInput, { target: { value: 'Neon laser beams in dark warehouse' } });

        fireEvent.click(screen.getByRole('button', { name: /Generate Video/i }));

        await waitFor(() => {
            expect(ShortFormReelService.extractHookAudio).toHaveBeenCalledWith(trackFile, dropHook);
            expect(ShortFormReelService.generateHookReel).toHaveBeenCalledWith(
                expect.objectContaining({
                    trackTitle: 'midnight',
                    hook: dropHook,
                    hookAudioUrl: 'blob:drop-hook-audio',
                    visualPrompt: 'Neon laser beams in dark warehouse',
                    aspectRatio: '9:16',
                    hookHeadline: 'Feel the bassline hit',
                }),
            );
        });

        expect(await screen.findByText('Generation Complete')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });
});
