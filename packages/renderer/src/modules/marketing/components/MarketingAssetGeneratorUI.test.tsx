import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketingAssetGeneratorUI from '@/modules/marketing/components/MarketingAssetGeneratorUI';

vi.mock('@/services/marketing/CampaignIntelligenceService', () => ({
    CampaignIntelligence: {
        generateMarketingVideo: vi.fn(),
        generateReleaseLaunchKit: vi.fn(),
    },
}));

vi.mock('@/services/marketing/ShortFormReelService', () => ({
    ShortFormReelService: {
        detectHooks: vi.fn(),
        extractHookAudio: vi.fn(),
        generateHookReel: vi.fn(),
    },
}));

vi.mock('@/services/marketing/MultiShapeAdMatrixService', () => ({
    MultiShapeAdMatrixService: {
        generateAndScoreMatrix: vi.fn(),
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

describe('MarketingAssetGeneratorUI Multi-Shape Ad Matrix mode (structural)', () => {
    it('lets artists choose ad shapes/durations, compiles & scores the matrix, and renders approved + held-back scorecards in Step 4', async () => {
        const { MultiShapeAdMatrixService } = await import('@/services/marketing/MultiShapeAdMatrixService');
        const makeVariant = (variantId: string, shape: '9:16' | '1:1' | '4:5' | '16:9', durationSeconds: 6 | 15 | 30, approved: boolean, jevImproved: boolean, overallScore: number, gapsFound: string) => ({
            variant: {
                variantId,
                shape,
                durationSeconds,
                channelLabel: shape === '9:16' ? 'Reels / TikTok / YouTube Shorts' : 'Feed',
                safeZone: {
                    shape,
                    width: 1080,
                    height: shape === '9:16' ? 1920 : 1080,
                    channelLabel: shape === '9:16' ? 'Reels / TikTok / YouTube Shorts' : 'Feed',
                    safeTopPct: 0.14,
                    safeBottomPct: 0.24,
                    safeLeftPct: 0.08,
                    safeRightPct: 0.16,
                    baseHeadlineFontSize: 66,
                    baseCtaFontSize: 36,
                },
                project: {
                    id: variantId,
                    name: variantId,
                    fps: 30,
                    durationInFrames: durationSeconds * 30,
                    width: 1080,
                    height: shape === '9:16' ? 1920 : 1080,
                    tracks: [],
                    clips: [],
                },
            },
            jevVerdict: {
                compositeScore: 8.6,
                hookPunchScore: 0.85,
                mobileCopyClarityScore: 0.9,
                ctaConversionScore: 0.84,
                safeZoneOverflowRisk: 0.12,
                brandVoiceFit: 0.88,
                passesPreFlight: true,
                recommendedAction: jevImproved ? ('scale_down_font' as const) : ('none' as const),
                source: 'jev' as const,
                rationale: 'Clean mobile hierarchy and safe margins.',
            },
            jevImproved,
            evaluation: {
                variantId,
                shape,
                durationSeconds,
                approved,
                discardedForRegression: false,
                attemptsUsed: jevImproved ? 1 : 0,
                bestScore: approved
                    ? {
                          firstTwoSecondHook: overallScore,
                          mobileLegibility: overallScore,
                          safeZoneIntegrity: overallScore,
                          audioVisualPacing: overallScore,
                          brandAlignment: overallScore,
                          overallScore,
                          overallPass: true,
                          gapsFound,
                      }
                    : null,
                brandQc: approved ? { approved: true, reason: 'Matches palette' } : { approved: false, reason: gapsFound },
                appliedPatches: [],
                history: [],
            },
        });

        const approvedCard = makeVariant('mat_9x16_15s', '9:16', 15, true, true, 9.4, 'None');
        const heldBackCard = makeVariant('mat_1x1_30s', '1:1', 30, false, false, 0, 'Supply rendered keyframes for Gemini >= 9.0 inspection.');

        vi.mocked(MultiShapeAdMatrixService.generateAndScoreMatrix).mockResolvedValueOnce({
            campaignId: 'camp_ui_1',
            totalVariants: 2,
            jevImprovedCount: 1,
            approvedVariants: [approvedCard],
            heldBackVariants: [heldBackCard],
            generatedAtIso: '2026-11-26T21:40:00.000Z',
        });

        render(<MarketingAssetGeneratorUI />);

        // Switch to Multi-Shape Ad Matrix mode
        fireEvent.click(screen.getByRole('button', { name: /Multi-Shape Ad Matrix/i }));

        // Add 30s duration alongside the default 6s and 15s
        const dur30Btn = screen.getByRole('button', { name: '30s' });
        fireEvent.click(dur30Btn);
        expect(dur30Btn).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        // Step 2: fill headline, CTA, and footage URL
        const headlineInput = await screen.findByPlaceholderText(/Drop Friday.*Out Now/i);
        fireEvent.change(headlineInput, { target: { value: 'Midnight Avenue — Out Now' } });

        const ctaInput = screen.getByPlaceholderText(/Stream Now|Pre-Save/i);
        fireEvent.change(ctaInput, { target: { value: 'Listen Today' } });

        const footageInput = screen.getByPlaceholderText(/https:\/\/\.\.\.|gs:\/\/\.\.\./i);
        fireEvent.change(footageInput, { target: { value: 'https://cdn.example.com/hero-9x16.mp4' } });

        const submitBtn = screen.getByRole('button', { name: /Compile & Score Matrix/i });
        expect(submitBtn).not.toBeDisabled();
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(MultiShapeAdMatrixService.generateAndScoreMatrix).toHaveBeenCalledWith(
                expect.objectContaining({
                    hookHeadline: 'Midnight Avenue — Out Now',
                    ctaText: 'Listen Today',
                    verticalFootageUrl: 'https://cdn.example.com/hero-9x16.mp4',
                    shapes: ['9:16', '1:1', '4:5', '16:9'],
                    durations: [6, 15, 30],
                }),
                expect.objectContaining({ renderVariant: expect.any(Function) }),
            );
        });

        expect(await screen.findByText('Ad Matrix Report')).toBeInTheDocument();
        expect(screen.getByText(/1 approved · 1 held back/i)).toBeInTheDocument();
        expect(screen.getByText(/9\.4\/10/i)).toBeInTheDocument();
        expect(screen.getByText(/Jev Refined/i)).toBeInTheDocument();
        expect(screen.getByText('Held Back')).toBeInTheDocument();
    });

    it('bridges the Ad Matrix report into a coordinated ReleaseLaunchKit with one click', async () => {
        const { MultiShapeAdMatrixService } = await import('@/services/marketing/MultiShapeAdMatrixService');
        const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');

        const makeVariant = (variantId: string, shape: '9:16' | '1:1', approved: boolean, overallScore: number) => ({
            variant: {
                variantId,
                shape,
                durationSeconds: 15 as const,
                channelLabel: shape === '9:16' ? 'Reels / TikTok' : 'X / Square Feed',
                safeZone: {
                    shape,
                    width: 1080,
                    height: shape === '9:16' ? 1920 : 1080,
                    channelLabel: shape === '9:16' ? 'Reels / TikTok' : 'X / Square Feed',
                    safeTopPct: 0.14,
                    safeBottomPct: 0.24,
                    safeLeftPct: 0.08,
                    safeRightPct: 0.16,
                    baseHeadlineFontSize: 66,
                    baseCtaFontSize: 36,
                },
                project: {
                    id: variantId,
                    name: variantId,
                    fps: 30,
                    durationInFrames: 450,
                    width: 1080,
                    height: shape === '9:16' ? 1920 : 1080,
                    tracks: [],
                    clips: [],
                },
            },
            jevVerdict: {
                compositeScore: 8.8,
                hookPunchScore: 0.9,
                mobileCopyClarityScore: 0.9,
                ctaConversionScore: 0.85,
                safeZoneOverflowRisk: 0.1,
                brandVoiceFit: 0.9,
                passesPreFlight: true,
                recommendedAction: 'none' as const,
                source: 'jev' as const,
                rationale: 'Clean mobile framing.',
            },
            jevImproved: false,
            evaluation: {
                variantId,
                shape,
                durationSeconds: 15 as const,
                approved,
                discardedForRegression: false,
                attemptsUsed: 0,
                bestScore: {
                    firstTwoSecondHook: overallScore,
                    mobileLegibility: overallScore,
                    safeZoneIntegrity: overallScore,
                    audioVisualPacing: overallScore,
                    brandAlignment: overallScore,
                    overallScore,
                    overallPass: approved,
                    gapsFound: approved ? 'None' : 'Minor legibility gap',
                },
                brandQc: { approved, reason: approved ? 'Brand QC passed' : 'Brand QC failed' },
                appliedPatches: [],
                history: [],
            },
        });

        vi.mocked(MultiShapeAdMatrixService.generateAndScoreMatrix).mockResolvedValueOnce({
            campaignId: 'camp_bridge_1',
            totalVariants: 2,
            jevImprovedCount: 0,
            approvedVariants: [makeVariant('bridge_9x16_15s', '9:16', true, 9.5)],
            heldBackVariants: [makeVariant('bridge_1x1_15s', '1:1', false, 7.8)],
            generatedAtIso: '2026-11-27T07:40:00.000Z',
        });

        vi.mocked(CampaignIntelligence.generateReleaseLaunchKit).mockResolvedValueOnce({
            kitId: 'kit_bridge_1',
            title: 'Midnight Avenue — Out Now',
            artistOrBrandName: 'Artist',
            hookWindows: [],
            lockedReferenceImageUris: [],
            smartLinkUrl: 'https://indii.link/midnight',
            adVariants: [],
            socialPosts: [
                {
                    id: 'kit_bridge_1_ig',
                    platform: 'Instagram',
                    copy: 'Stream Midnight Avenue https://indii.link/midnight?utm_source=instagram',
                    hashtags: ['#newmusic'],
                    attachedVariantId: 'bridge_9x16_15s',
                    scheduledDayOffset: 0,
                    status: 'approved',
                },
                {
                    id: 'kit_bridge_1_x',
                    platform: 'X',
                    copy: 'Midnight Avenue out now https://indii.link/midnight?utm_source=x',
                    hashtags: [],
                    scheduledDayOffset: 0,
                    status: 'draft',
                },
            ],
            createdAtIso: '2026-11-27T07:40:01.000Z',
        });

        render(<MarketingAssetGeneratorUI />);
        fireEvent.click(screen.getByRole('button', { name: /Multi-Shape Ad Matrix/i }));
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

        fireEvent.change(await screen.findByPlaceholderText(/Drop Friday.*Out Now/i), {
            target: { value: 'Midnight Avenue — Out Now' },
        });
        fireEvent.change(screen.getByPlaceholderText(/https:\/\/\.\.\.|gs:\/\/\.\.\./i), {
            target: { value: 'https://cdn.example.com/hero-9x16.mp4' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Optional SmartLink/i), {
            target: { value: 'https://indii.link/midnight' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Compile & Score Matrix/i }));
        await screen.findByText('Ad Matrix Report');

        fireEvent.click(screen.getByRole('button', { name: /Build Release Launch Kit/i }));

        await waitFor(() => {
            expect(CampaignIntelligence.generateReleaseLaunchKit).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Midnight Avenue — Out Now',
                    smartLinkUrl: 'https://indii.link/midnight',
                    adVariants: expect.arrayContaining([
                        expect.objectContaining({ variantId: 'bridge_9x16_15s', approved: true }),
                        expect.objectContaining({ variantId: 'bridge_1x1_15s', approved: false }),
                    ]),
                }),
            );
        });

        const kitPanel = await screen.findByTestId('release-launch-kit-panel');
        expect(kitPanel).toBeInTheDocument();
        expect(kitPanel.textContent).toContain('bridge_9x16_15s');
        expect(kitPanel.textContent).toContain('Instagram');
    });

    it('renders actionable Step 4 error on Launch Kit failure, recovers on retry, and exports JSON cleanly', async () => {
        const { MultiShapeAdMatrixService } = await import('@/services/marketing/MultiShapeAdMatrixService');
        const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');

        vi.mocked(MultiShapeAdMatrixService.generateAndScoreMatrix).mockResolvedValueOnce({
            campaignId: 'camp_err_1',
            totalVariants: 1,
            jevImprovedCount: 0,
            approvedVariants: [
                {
                    variant: {
                        variantId: 'cut_9x16_ok',
                        shape: '9:16',
                        durationSeconds: 15,
                        channelLabel: 'Reels / TikTok',
                        safeZone: {
                            shape: '9:16',
                            width: 1080,
                            height: 1920,
                            channelLabel: 'Reels / TikTok',
                            safeTopPct: 0.14,
                            safeBottomPct: 0.24,
                            safeLeftPct: 0.08,
                            safeRightPct: 0.16,
                            baseHeadlineFontSize: 66,
                            baseCtaFontSize: 36,
                        },
                        project: {
                            id: 'cut_9x16_ok',
                            name: 'cut_9x16_ok',
                            fps: 30,
                            durationInFrames: 450,
                            width: 1080,
                            height: 1920,
                            tracks: [],
                            clips: [],
                        },
                    },
                    jevVerdict: {
                        compositeScore: 8.9,
                        hookPunchScore: 0.9,
                        mobileCopyClarityScore: 0.9,
                        ctaConversionScore: 0.85,
                        safeZoneOverflowRisk: 0.08,
                        brandVoiceFit: 0.9,
                        passesPreFlight: true,
                        recommendedAction: 'none',
                        source: 'jev',
                        rationale: 'Clean',
                    },
                    jevImproved: false,
                    evaluation: {
                        variantId: 'cut_9x16_ok',
                        shape: '9:16',
                        durationSeconds: 15,
                        approved: true,
                        discardedForRegression: false,
                        attemptsUsed: 0,
                        bestScore: {
                            firstTwoSecondHook: 9.5,
                            mobileLegibility: 9.5,
                            safeZoneIntegrity: 9.5,
                            audioVisualPacing: 9.5,
                            brandAlignment: 9.5,
                            overallScore: 9.5,
                            overallPass: true,
                            gapsFound: 'None',
                        },
                        brandQc: { approved: true, reason: 'Passed' },
                        appliedPatches: [],
                        history: [],
                    },
                },
            ],
            heldBackVariants: [],
            generatedAtIso: '2026-11-27T07:41:00.000Z',
        });

        vi.mocked(CampaignIntelligence.generateReleaseLaunchKit)
            .mockRejectedValueOnce(new Error('Gemini Launch Kit quota temporarily saturated.'))
            .mockResolvedValueOnce({
                kitId: 'kit_recovered_1',
                title: 'Midnight Avenue',
                artistOrBrandName: 'Artist',
                hookWindows: [],
                lockedReferenceImageUris: [],
                adVariants: [],
                socialPosts: [
                    {
                        id: 'post_1',
                        platform: 'Instagram',
                        copy: 'Out now',
                        hashtags: [],
                        attachedVariantId: 'cut_9x16_ok',
                        scheduledDayOffset: 0,
                        status: 'approved',
                    },
                ],
                createdAtIso: '2026-11-27T07:41:05.000Z',
            });

        const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-kit-json');
        const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const originalCreateElement = document.createElement.bind(document);
        const anchorClickSpy = vi.fn();
        const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            const el = originalCreateElement(tagName);
            if (tagName.toLowerCase() === 'a') {
                el.click = anchorClickSpy;
            }
            return el;
        });

        try {
            render(<MarketingAssetGeneratorUI />);
            fireEvent.click(screen.getByRole('button', { name: /Multi-Shape Ad Matrix/i }));
            fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
            fireEvent.change(await screen.findByPlaceholderText(/Drop Friday.*Out Now/i), {
                target: { value: 'Midnight Avenue' },
            });
            fireEvent.change(screen.getByPlaceholderText(/https:\/\/\.\.\.|gs:\/\/\.\.\./i), {
                target: { value: 'https://cdn.example.com/hero.mp4' },
            });
            fireEvent.click(screen.getByRole('button', { name: /Compile & Score Matrix/i }));
            await screen.findByText('Ad Matrix Report');

            // First click fails and must display visible alert in Step 4
            fireEvent.click(screen.getByRole('button', { name: /Build Release Launch Kit/i }));
            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toContain('Gemini Launch Kit quota temporarily saturated.');

            // Retry recovers, clears alert, and exports JSON
            fireEvent.click(screen.getByRole('button', { name: /Build Release Launch Kit/i }));
            const kitPanel = await screen.findByTestId('release-launch-kit-panel');
            expect(kitPanel).toBeInTheDocument();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Download Launch Kit JSON/i }));
            expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
            expect(anchorClickSpy).toHaveBeenCalledTimes(1);
            expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-kit-json');
        } finally {
            createObjectUrlSpy.mockRestore();
            revokeObjectUrlSpy.mockRestore();
            createElementSpy.mockRestore();
        }
    });
});
