import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import StudioControlsPanel from './StudioControlsPanel';
import { useStore } from '../../store';
import { useToast } from '@/core/context/ToastContext';

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

        expect(screen.getByText('Pure Omni')).toBeInTheDocument();
        expect(screen.getByText('Hybrid Veo')).toBeInTheDocument();
        expect(screen.getByText('Character X-Ray')).toBeInTheDocument();
    });

    it('handles Omni Pipeline Mode changes', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            viewMode: 'omni'
        });
        render(<StudioControlsPanel toggleRightPanel={mockToggleRightPanel} />);
        
        // Expand Omni Stage Controls first
        const omniStageBtn = screen.getByText('Omni Stage Controls').closest('button');
        expect(omniStageBtn).toBeInTheDocument();
        fireEvent.click(omniStageBtn!);

        const hybridBtn = screen.getByText('Hybrid Veo');
        fireEvent.click(hybridBtn);
        expect(mockSetStudioControls).toHaveBeenCalledWith({ omniPipelineMode: 'hybrid-veo' });
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
