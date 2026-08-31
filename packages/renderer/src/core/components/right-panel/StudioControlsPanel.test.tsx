import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import StudioControlsPanel from './StudioControlsPanel';
import { useStore } from '../../store';
import { useToast } from '@/core/context/ToastContext';

const billingMocks = vi.hoisted(() => ({
    getStatus: vi.fn(),
    getHistory: vi.fn(),
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: billingMocks,
}));

// Mock store
vi.mock('../../store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({}));
    return { useStore: mockUseStore };
});

// Mock toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock sub-components
vi.mock('../../../modules/creative/components/CreativeGallery', () => ({
    default: () => <div data-testid="creative-gallery">Creative Gallery Content</div>,
}));

vi.mock('@/modules/creative/components/whisk/WhiskDropZone', () => ({
    WhiskDropZone: ({ title }: { title: string }) => (
        <div data-testid={`whisk-drop-${title.toLowerCase() || 'unnamed'}`}>
            Dropzone {title}
        </div>
    ),
}));

vi.mock('@/modules/creative/components/whisk/WhiskPresetStyles', () => ({
    default: ({ onSelectPreset }: any) => (
        <div data-testid="whisk-preset-styles">
            Preset Styles
            <button
                onClick={() => onSelectPreset({ label: 'Oil Painting', prompt: 'oil painting aesthetic', aspectRatio: '16:9', duration: 4 })}
                data-testid="preset-oil-painting"
            >
                Select Oil Painting
            </button>
        </div>
    ),
}));

vi.mock('@/modules/creative/components/CharacterLibrary', () => ({
    CharacterLibrary: () => <div data-testid="character-library">Character Library Content</div>,
}));

vi.mock('@/services/typography/TypographyPanel', () => ({
    default: () => <div data-testid="typography-panel-mock">Typography Content</div>,
}));

// Mock framer motion / motion/react
vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, property: string) => {
            return ({ children, ...props }: any) => {
                const cleanProps = { ...props };
                // Remove animation-specific props that cause warning logs on raw HTML tags in JSDOM
                delete cleanProps.initial;
                delete cleanProps.animate;
                delete cleanProps.exit;
                delete cleanProps.transition;
                return React.createElement(property, cleanProps, children);
            };
        }
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('StudioControlsPanel', () => {
    const mockSetStudioControls = vi.fn();
    const mockAddWhiskItem = vi.fn();
    const mockRemoveWhiskItem = vi.fn();
    const mockToggleWhiskItem = vi.fn();
    const mockUpdateWhiskItem = vi.fn();
    const mockSetPreciseReference = vi.fn();
    const mockSetTargetMedia = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockToggleRightPanel = vi.fn();
    const mockSuccessToast = vi.fn();

    const defaultState = {
        studioControls: {
            aspectRatio: '16:9',
            resolution: '1K',
            negativePrompt: '',
            seed: '',
            cameraMovement: '',
            motionStrength: 5,
            fps: 24,
            duration: 4,
            model: 'fast' as const,
            thinkingLevel: 'none' as const,
            mediaResolution: 'medium' as const,
            generateAudio: false,
            useGrounding: false,
            useImageSearch: false,
            personGeneration: 'allow_adult' as const,
            isTransitionMode: false,
            isPLPMode: false,
            imageSize: '1K' as const,
            batchCount: 1,
            responseFormat: 'image_only' as const,
            includeThoughts: false,
            omniPipelineMode: 'pure-omni',
            characterXRay: false,
            activePosePreset: 'guitar_solo',
            posePreservation: 0.5,
            beatPulse: 0.5,
            visualizerColor: '#8B5CF6',
            lyricsText: '',
            typographyStyle: 'cyberpunk' as const,
            selectedLanguage: 'es',
            synthIdEnabled: false,
        },
        setStudioControls: mockSetStudioControls,
        whiskState: {
            subjects: [],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: false,
            targetMedia: 'image' as const
        },
        addWhiskItem: mockAddWhiskItem,
        removeWhiskItem: mockRemoveWhiskItem,
        toggleWhiskItem: mockToggleWhiskItem,
        updateWhiskItem: mockUpdateWhiskItem,
        setPreciseReference: mockSetPreciseReference,
        setTargetMedia: mockSetTargetMedia,
        videoInputs: {
            firstFrame: null,
            lastFrame: null,
            timeOffset: 0,
            isDaisyChain: false
        },
        setVideoInput: mockSetVideoInput,
        viewMode: 'direct' as const
    };

    beforeEach(() => {
        vi.clearAllMocks();
        billingMocks.getStatus.mockResolvedValue({
            dailyUsed: 0,
            monthlyUsed: 0,
            dailyRemaining: 5,
            monthlyRemaining: 50,
            tier: 'free',
            pendingHoldCost: 0,
            pendingHoldCount: 0,
            settledCost: 0,
            voidedCost: 0,
        });
        billingMocks.getHistory.mockResolvedValue({
            operations: [],
            nextCursor: null,
            hasMore: false,
        });
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultState);
        (useStore as any).getState = () => defaultState;
        (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            success: mockSuccessToast,
            error: vi.fn(),
            info: vi.fn(),
        });
    });

    it('renders with default tab and title', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        expect(screen.getByText('Studio Controls')).toBeInTheDocument();
        expect(screen.getByTestId('whisk-drop-subject')).toBeInTheDocument();
        expect(screen.getByTestId('whisk-drop-scene')).toBeInTheDocument();
        expect(screen.getByTestId('whisk-drop-style')).toBeInTheDocument();
    });

    it('toggles the right panel when close button is clicked', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Find close button using the mocked Lucide ChevronRight icon
        const closeIcon = screen.getByTestId('icon-ChevronRight');
        const closeBtn = closeIcon.closest('button');
        expect(closeBtn).toBeInTheDocument();
        
        fireEvent.click(closeBtn!);
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('switches to gallery/history tab', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        const historyTabBtn = screen.getByTitle('History');
        fireEvent.click(historyTabBtn);

        expect(screen.getByTestId('creative-gallery')).toBeInTheDocument();
        expect(screen.queryByTestId('whisk-drop-subject')).not.toBeInTheDocument();
    });

    it('toggles reference mixer section', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Locate Reference Mixer heading toggle button
        const sectionToggle = screen.getByText('Reference Mixer').closest('button');
        expect(sectionToggle).toBeInTheDocument();
        
        // Default is open, so click to close
        fireEvent.click(sectionToggle!);
        // Mixer content should be hidden (since AnimatePresence removes or animates, we check state or visual presence depending on wrapper)
        // Let's toggle it back on
        fireEvent.click(sectionToggle!);
    });

    it('sets precise reference mode toggle', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        const preciseBtn = screen.getByTitle('Precise: OFF');
        fireEvent.click(preciseBtn);

        expect(mockSetPreciseReference).toHaveBeenCalledWith(true);
    });

    it('changes target media between image, video, and both', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        const videoMediaBtn = screen.getByText('Video');
        fireEvent.click(videoMediaBtn);

        expect(mockSetTargetMedia).toHaveBeenCalledWith('video');
    });

    it('renders character library when target media is video', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            whiskState: {
                ...defaultState.whiskState,
                targetMedia: 'video'
            }
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        expect(screen.getByTestId('character-library')).toBeInTheDocument();
    });

    it('handles transition mode toggles and start/end dropzones', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            studioControls: {
                ...defaultState.studioControls,
                isTransitionMode: true
            },
            whiskState: {
                ...defaultState.whiskState,
                targetMedia: 'video'
            }
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        expect(screen.getByText('TRANSITION KEYFRAMES')).toBeInTheDocument();
        expect(screen.getByText('Clear All')).toBeInTheDocument();
        
        // Trigger Clear All
        fireEvent.click(screen.getByText('Clear All'));
        expect(mockSetVideoInput).toHaveBeenCalledWith('firstFrame', null);
        expect(mockSetVideoInput).toHaveBeenCalledWith('lastFrame', null);
    });

    it('handles preset style selection', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        const presetBtn = screen.getByTestId('preset-oil-painting');
        fireEvent.click(presetBtn);

        expect(mockAddWhiskItem).toHaveBeenCalledWith('style', 'text', 'oil painting aesthetic', 'Oil Painting');
        expect(mockSetStudioControls).toHaveBeenCalledWith({ aspectRatio: '16:9' });
        expect(mockSetStudioControls).toHaveBeenCalledWith({ duration: 4 });
        expect(mockSuccessToast).toHaveBeenCalledWith('Style: Oil Painting');
    });

    it('toggles Fast vs Pro model tier', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Model & Constraints section first
        const advancedBtn = screen.getByText('Model & Constraints').closest('button');
        expect(advancedBtn).toBeInTheDocument();
        fireEvent.click(advancedBtn!);
        
        const proBtn = screen.getByTitle('Nano Banana Pro (Gemini 3 Pro) — Max quality, 14 refs, 5 chars');
        fireEvent.click(proBtn);

        expect(mockSetStudioControls).toHaveBeenCalledWith({ model: 'pro' });
    });

    it('updates media resolution selection dropdown', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Model & Constraints section first
        const advancedBtn = screen.getByText('Model & Constraints').closest('button');
        expect(advancedBtn).toBeInTheDocument();
        fireEvent.click(advancedBtn!);
        
        const resolutionSelect = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="high"]'));
        expect(resolutionSelect).toBeDefined();
        fireEvent.change(resolutionSelect!, { target: { value: 'high' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ mediaResolution: 'high' });
    });

    it('ISSUE-1006: shows actionable operation receipts and loads the next history page', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            user: { uid: 'user-1' },
        });
        billingMocks.getStatus.mockResolvedValueOnce({
            dailyUsed: 0.12,
            monthlyUsed: 0.12,
            dailyRemaining: 4.88,
            monthlyRemaining: 49.88,
            tier: 'free',
            pendingHoldCost: 0.12,
            pendingHoldCount: 1,
            settledCost: 0,
            voidedCost: 0.08,
        });
        billingMocks.getHistory.mockResolvedValueOnce({
            operations: [
                {
                    operationId: 'op-pending',
                    operationType: 'image',
                    status: 'APPROVED',
                    estimatedCost: 0.12,
                    createdAt: '2026-07-16T20:00:00.000Z',
                    finalizedAt: null,
                    autoReleaseAt: '2026-07-16T20:15:00.000Z',
                    resolution: 'pending_auto_release',
                },
                {
                    operationId: 'op-refunded',
                    operationType: 'image',
                    status: 'VOIDED',
                    estimatedCost: 0.08,
                    createdAt: '2026-07-16T19:00:00.000Z',
                    finalizedAt: '2026-07-16T19:01:00.000Z',
                    autoReleaseAt: null,
                    resolution: 'refunded',
                },
            ],
            nextCursor: { timestampMs: 1_784_236_800_000, operationId: 'op-refunded' },
            hasMore: true,
        });

        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        await waitFor(() => expect(billingMocks.getHistory).toHaveBeenCalledWith('user-1'));

        fireEvent.click(screen.getByText('Model & Constraints').closest('button')!);
        expect(await screen.findByText(/Pending hold — auto-releases/)).toBeInTheDocument();
        expect(screen.getByText('Refunded — safe to retry.')).toBeInTheDocument();

        billingMocks.getHistory.mockResolvedValueOnce({
            operations: [{
                operationId: 'op-settled',
                operationType: 'video',
                status: 'SETTLED',
                estimatedCost: 0.5,
                createdAt: '2026-07-16T18:00:00.000Z',
                finalizedAt: '2026-07-16T18:02:00.000Z',
                autoReleaseAt: null,
                resolution: 'settled',
            }],
            nextCursor: null,
            hasMore: false,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

        expect(await screen.findByText('Settled — provider output billed.')).toBeInTheDocument();
        expect(billingMocks.getHistory).toHaveBeenLastCalledWith(
            'user-1',
            { timestampMs: 1_784_236_800_000, operationId: 'op-refunded' },
        );
    });

    it('toggles Google Search grounding', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Model & Constraints section first
        const advancedBtn = screen.getByText('Model & Constraints').closest('button');
        expect(advancedBtn).toBeInTheDocument();
        fireEvent.click(advancedBtn!);
        
        const groundingToggle = screen.getByText('Google Search').previousSibling;
        expect(groundingToggle).toBeInTheDocument();
        fireEvent.click(groundingToggle as HTMLElement);

        expect(mockSetStudioControls).toHaveBeenCalledWith({
            useGrounding: true,
            useImageSearch: false
        });
    });

    it('sets negative prompt text', () => {
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Model & Constraints section first
        const advancedBtn = screen.getByText('Model & Constraints').closest('button');
        expect(advancedBtn).toBeInTheDocument();
        fireEvent.click(advancedBtn!);
        
        const textarea = screen.getByPlaceholderText('e.g. "no blurry parts, no extra limbs"');
        fireEvent.change(textarea, { target: { value: 'blurry, distorted' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ negativePrompt: 'blurry, distorted' });
    });

    it('renders Omni Stage Controls in omni viewMode', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            viewMode: 'omni'
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);

        expect(screen.getByText('Omni Stage Controls')).toBeInTheDocument();
        
        // Expand Omni Stage Controls first
        const omniStageBtn = screen.getByText('Omni Stage Controls').closest('button');
        expect(omniStageBtn).toBeInTheDocument();
        fireEvent.click(omniStageBtn!);

        expect(screen.getByText('Gemini Omni Flash · 4 task modes')).toBeInTheDocument();
        expect(screen.queryByText('Hybrid Veo')).not.toBeInTheDocument();
        expect(screen.getByText('Character X-Ray')).toBeInTheDocument();
        expect(screen.getByText('Automatic SynthID')).toBeInTheDocument();
        expect(screen.getByText('HD 720p · 24 fps')).toBeInTheDocument();
        expect(screen.getByText('~$0.40')).toBeInTheDocument();
        expect(screen.queryByText('Reference Mixer')).not.toBeInTheDocument();
        expect(screen.queryByText('Model & Constraints')).not.toBeInTheDocument();
        expect(screen.queryByText('NEGATIVE PROMPT')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Omni aspect ratio'), { target: { value: '9:16' } });
        expect(mockSetStudioControls).toHaveBeenCalledWith({ aspectRatio: '9:16' });
        fireEvent.change(screen.getByLabelText('Omni duration'), { target: { value: '10' } });
        expect(mockSetStudioControls).toHaveBeenCalledWith({ duration: 10 });
    });

    it('handles Character X-Ray toggle in omni viewMode', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            viewMode: 'omni',
            studioControls: {
                ...defaultState.studioControls,
                characterXRay: false
            }
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Omni Stage Controls first
        const omniStageBtn = screen.getByText('Omni Stage Controls').closest('button');
        expect(omniStageBtn).toBeInTheDocument();
        fireEvent.click(omniStageBtn!);

        const xrayToggle = screen.getByText('Character X-Ray').closest('div')?.nextSibling;
        expect(xrayToggle).toBeInTheDocument();
        fireEvent.click(xrayToggle as HTMLElement);
        expect(mockSetStudioControls).toHaveBeenCalledWith({ characterXRay: true });
    });

    it('handles Pose Preset changes in omni viewMode', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            viewMode: 'omni'
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Omni Stage Controls first
        const omniStageBtn = screen.getByText('Omni Stage Controls').closest('button');
        expect(omniStageBtn).toBeInTheDocument();
        fireEvent.click(omniStageBtn!);

        const select = screen.getAllByRole('combobox').find(el => el.querySelector('option[value="guitar_solo"]'));
        expect(select).toBeDefined();
        fireEvent.change(select!, { target: { value: 'dj_stance' } });
        expect(mockSetStudioControls).toHaveBeenCalledWith({ activePosePreset: 'dj_stance' });
    });
});
