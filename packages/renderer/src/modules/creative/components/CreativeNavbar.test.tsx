import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeNavbar from './CreativeNavbar';
import { useStore } from '@/core/store';
import { useToast, ToastProvider } from '@/core/context/ToastContext';
import { ScreenControl } from '@/services/screen/ScreenControlService';

// Mock dependencies
vi.mock('@/core/store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({
        setGenerationMode: vi.fn(),
    }));
    return { useStore: mockUseStore };
});

vi.mock('@/services/screen/ScreenControlService');

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    },
    remoteConfig: { defaultConfig: {} },
    db: {},
    functions: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock framer-motion to simplify DOM transitions in JSDOM tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => {
            const cleanProps = { ...props };
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            return <div {...cleanProps}>{children}</div>;
        }
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock child components to simplify testing
vi.mock('./IntelligencePromptBuilder', () => ({
    default: ({ onAddTag, currentPrompt, onSetPrompt }: { onAddTag: (tag: string) => void; currentPrompt: string; onSetPrompt: (prompt: string) => void }) => (
        <div data-testid="prompt-builder">
            <span>Current Prompt: {currentPrompt}</span>
            <button onClick={() => onAddTag('test tag')}>Add Tag</button>
            <button onClick={() => onSetPrompt('new prompt')}>Set Prompt</button>
        </div>
    )
}));

vi.mock('./BrandAssetsDrawer', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="brand-assets-drawer">
            <button onClick={onClose}>Close Drawer</button>
        </div>
    )
}));

vi.mock('./HistoryDrawer', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="history-drawer">
            <button onClick={onClose}>Close History</button>
        </div>
    )
}));

vi.mock('./AgentCapabilityRegistry', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="agent-capability-registry">
            <button onClick={onClose}>Close Roster Registry</button>
        </div>
    )
}));

vi.mock('../video/components/FrameSelectionModal', () => ({
    default: ({ isOpen, onClose, onSelect, target }: any) => isOpen ? (
        <div data-testid="frame-selection-modal" data-target={target}>
            <button onClick={onClose}>Close Modal</button>
            <button onClick={() => onSelect({ url: 'test-frame.png' })}>Select Frame</button>
        </div>
    ) : null
}));

vi.mock('./DaisyChainControls', () => ({
    default: ({ onOpenFrameModal }: { onOpenFrameModal: (target: 'firstFrame' | 'lastFrame') => void }) => (
        <div data-testid="daisy-chain-controls">
            <button onClick={() => onOpenFrameModal('firstFrame')}>Trigger First Frame</button>
            <button onClick={() => onOpenFrameModal('lastFrame')}>Trigger Last Frame</button>
        </div>
    )
}));

describe('CreativeNavbar', () => {
    const mockSetGenerationMode = vi.fn();
    const mockSetStudioControls = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockAddToHistory = vi.fn();
    const mockSetPrompt = vi.fn();
    const mockSetCreativePrompt = vi.fn();
    const mockToggleAgentWindow = vi.fn();
    const mockTogglePromptBuilder = vi.fn();
    const mockEnablePLPMode = vi.fn();
    const mockDisablePLPMode = vi.fn();
    const mockSetViewMode = vi.fn();
    
    const mockToast = {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    };

    const defaultState = {
        currentProjectId: 'test-project',
        addToHistory: mockAddToHistory,
        studioControls: {
            resolution: '1K',
            aspectRatio: '16:9',
            negativePrompt: '',
            seed: '',
            isPLPMode: false
        },
        generationMode: 'image',
        setGenerationMode: mockSetGenerationMode,
        viewMode: 'direct',
        setViewMode: mockSetViewMode,
        videoInputs: {
            firstFrame: null,
            lastFrame: null,
            timeOffset: 0,
            isDaisyChain: false
        },
        setVideoInput: mockSetVideoInput,
        addUploadedImage: vi.fn(),
        generatedHistory: [],
        setSelectedItem: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        prompt: '',
        setPrompt: mockSetPrompt,
        creativePrompt: 'initial prompt text',
        setCreativePrompt: mockSetCreativePrompt,
        isPromptBuilderOpen: false,
        togglePromptBuilder: mockTogglePromptBuilder,
        toggleAgentWindow: mockToggleAgentWindow,
        enablePLPMode: mockEnablePLPMode,
        disablePLPMode: mockDisablePLPMode,
        userProfile: {
            brandKit: {
                colors: ['#000000'],
                brandAssets: [],
                referenceImages: []
            }
        },
        setStudioControls: mockSetStudioControls
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(defaultState);
            return defaultState;
        });
        (useStore as any).getState = () => defaultState;
        (useToast as unknown as import('vitest').Mock).mockReturnValue(mockToast);
    });

    it('renders correctly and matches active status text', () => {
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );
        expect(screen.getByText('Studio')).toBeInTheDocument();
        expect(screen.getByText('ONLINE')).toBeInTheDocument();
    });

    it('opens and closes brand assets drawer', () => {
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const toggleButton = screen.getByText('Brand');
        fireEvent.click(toggleButton);

        expect(screen.getByTestId('brand-assets-drawer')).toBeInTheDocument();

        const closeButton = screen.getByText('Close Drawer');
        fireEvent.click(closeButton);

        expect(screen.queryByTestId('brand-assets-drawer')).not.toBeInTheDocument();
    });

    it('opens and closes the unified history drawer (Versions + Prompts)', () => {
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        // Single History entry point now (ISSUE-496 consolidation)
        fireEvent.click(screen.getByTestId('history-btn'));
        expect(screen.getByTestId('history-drawer')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Close History'));
        expect(screen.queryByTestId('history-drawer')).not.toBeInTheDocument();
    });

    it('opens and closes roster drawer drawer', () => {
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const toggleButton = screen.getByText('Roster');
        fireEvent.click(toggleButton);

        expect(screen.getByTestId('agent-capability-registry')).toBeInTheDocument();

        const closeButton = screen.getByText('Close Roster Registry');
        fireEvent.click(closeButton);

        expect(screen.queryByTestId('agent-capability-registry')).not.toBeInTheDocument();
    });

    it('toggles prompt builder using mock toggle in store and renders it when open', () => {
        const openState = {
            ...defaultState,
            isPromptBuilderOpen: true
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(openState);
            return openState;
        });

        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        // Verify PromptBuilder renders when isPromptBuilderOpen is true
        expect(screen.getByTestId('prompt-builder')).toBeInTheDocument();
        expect(screen.getByText('Current Prompt: initial prompt text')).toBeInTheDocument();

        // Clicking builder toggle button calls togglePromptBuilder
        const builderButton = screen.getByTestId('builder-btn');
        fireEvent.click(builderButton);
        expect(mockTogglePromptBuilder).toHaveBeenCalled();

        // Clicking add tag calls setCreativePrompt with tag
        const addTagButton = screen.getByText('Add Tag');
        fireEvent.click(addTagButton);
        expect(mockSetCreativePrompt).toHaveBeenCalledWith('initial prompt text, test tag');

        // Clicking set prompt updates prompt directly
        const setPromptButton = screen.getByText('Set Prompt');
        fireEvent.click(setPromptButton);
        expect(mockSetCreativePrompt).toHaveBeenCalledWith('new prompt');
    });

    it('activates and deactivates PLP Mode and displays corresponding toast', () => {
        const { rerender } = render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const plpButton = screen.getByTitle('Enable PLP — Promote · Launch · Push (15 release-ready ad variants)');
        fireEvent.click(plpButton);
        expect(mockEnablePLPMode).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith('PLP Mode activated: Ready to generate 15 ad variants');

        // Simulate active PLP mode state
        const activePLPState = {
            ...defaultState,
            studioControls: {
                ...defaultState.studioControls,
                isPLPMode: true
            }
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(activePLPState);
            return activePLPState;
        });

        rerender(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const disableButton = screen.getByTitle('Disable PLP — Promote · Launch · Push');
        fireEvent.click(disableButton);
        expect(mockDisablePLPMode).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith('PLP Mode deactivated');
    });

    it('opens projector window when permission is granted', async () => {
        (ScreenControl.requestPermission as import('vitest').Mock).mockResolvedValue(true);
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const projectorButton = screen.getByTitle('Open Projector');
        fireEvent.click(projectorButton);

        await waitFor(() => {
            expect(ScreenControl.openProjectorWindow).toHaveBeenCalled();
        });
    });

    it('fails to open projector window when permission is denied', async () => {
        (ScreenControl.requestPermission as import('vitest').Mock).mockResolvedValue(false);
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        const projectorButton = screen.getByTitle('Open Projector');
        fireEvent.click(projectorButton);

        await waitFor(() => {
            expect(ScreenControl.openProjectorWindow).not.toHaveBeenCalled();
            expect(mockToast.error).toHaveBeenCalledWith('Screen Control API not supported or permission denied.');
        });
    });

    it('navigates viewModes and setGenerationModes on tab selection clicks', () => {
        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        // IA Option C: 4 primary modes + secondary sub-views. Default viewMode is
        // 'direct' so the Image mode is active and its sub-views are visible.

        // Primary: Video mode → first view (Produce / video_production)
        fireEvent.click(screen.getByTestId('mode-video-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('video_production');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');

        // Primary: Image mode → first view (Generate / direct)
        fireEvent.click(screen.getByTestId('mode-image-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('direct');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('image');

        // Secondary sub-view (visible under active Image mode): Generate
        fireEvent.click(screen.getByTestId('direct-view-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('direct');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('image');

        // Secondary sub-view: Canvas
        fireEvent.click(screen.getByTestId('canvas-view-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('canvas');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('image');

        // Single-view mode: Mockup (carries showroom-view-btn)
        fireEvent.click(screen.getByTestId('showroom-view-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('showroom');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('image');

        // Single-view mode: Sequence (renamed from Keyframes; carries lab-view-btn, video gen)
        fireEvent.click(screen.getByTestId('lab-view-btn'));
        expect(mockSetViewMode).toHaveBeenCalledWith('lab');
        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');
    });

    it('renders DaisyChainControls when generationMode is video and opens FrameSelectionModal', () => {
        const videoState = {
            ...defaultState,
            generationMode: 'video'
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(videoState);
            return videoState;
        });

        render(
            <ToastProvider>
                <CreativeNavbar />
            </ToastProvider>
        );

        // Verify DaisyChainControls renders instead of image right buttons
        expect(screen.getByTestId('daisy-chain-controls')).toBeInTheDocument();
        expect(screen.queryByText('Brand')).not.toBeInTheDocument();

        // Trigger First Frame selection
        const triggerFirstFrameBtn = screen.getByText('Trigger First Frame');
        fireEvent.click(triggerFirstFrameBtn);

        // Modal should render with target firstFrame
        const modal = screen.getByTestId('frame-selection-modal');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('data-target', 'firstFrame');

        // Select frame
        const selectBtn = screen.getByText('Select Frame');
        fireEvent.click(selectBtn);

        // Verify setVideoInput is called
        expect(mockSetVideoInput).toHaveBeenCalledWith('firstFrame', { url: 'test-frame.png' });
    });
});
