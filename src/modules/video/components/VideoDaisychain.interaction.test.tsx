import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import CreativeStudio from '../../creative/CreativeStudio';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

// 🚀 Linked mocks for interaction testing
// Vitest requires variables used in vi.mock factories to be prefixed with 'mock'
const mockSetVideoInput = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetGenerationMode = vi.fn();
const mockSetPrompt = vi.fn();
const mockAddToHistory = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();

vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, property: string) => {
            if (property === 'div') {
                return ({ children, ...props }: any) => <div {...props}>{children}</div>;
            }
            if (property === 'button') {
                return ({ children, ...props }: any) => <button {...props}>{children}</button>;
            }
            return ({ children, ...props }: any) => React.createElement(property, props, children);
        }
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock video editor store
vi.mock('../store/videoEditorStore', () => {
    const mockData = {
        viewMode: 'director',
        setViewMode: vi.fn(),
        jobId: null,
        setJobId: vi.fn(),
        status: 'idle',
        setStatus: vi.fn(),
        progress: 0,
        setProgress: vi.fn()
    };
    const mockStore = vi.fn(() => mockData);
    (mockStore as any).getState = () => mockData;
    (mockStore as any).subscribe = vi.fn(() => () => { });
    return { useVideoEditorStore: mockStore };
});

// 🖱️ Click Persona: Video Daisychain Interaction
// Flow: Select Start Frame → Select End Frame → Toggle Daisy Chain → Generate Video

vi.mock('@/core/store', () => {
    const mockStore = vi.fn();
    (mockStore as any).setState = vi.fn();
    (mockStore as any).getState = vi.fn(() => ({
        setVideoInput: vi.fn(),
        setGenerationMode: vi.fn(),
        setViewMode: vi.fn(),
        setSelectedItem: vi.fn(),
        addToHistory: vi.fn(),
        setIsGenerating: vi.fn(),
        setHasUnsavedChanges: vi.fn(),
        isRightPanelOpen: false,
        toggleRightPanel: vi.fn(),
        generatedHistory: [],
        whiskState: {
            subjects: [],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: false
        },
        studioControls: { resolution: '1K', aspectRatio: '16:9', duration: 4, fps: 24 }
    }));
    (mockStore as any).subscribe = vi.fn();
    return { useStore: mockStore };
});

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        getWhiskStatus: vi.fn().mockResolvedValue({}),
        synthesizeVideoPrompt: vi.fn((prompt) => prompt), // Identity function for mock
    }
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn().mockReturnValue(vi.fn()), // Returns unsubscribe
    }
}));

// Mock lazy-loaded components to speed up test
vi.mock('../../video/editor/VideoEditor', () => ({
    VideoEditor: () => <div data-testid="video-editor" />
}));

vi.mock('../../creative/components/CreativeGallery', () => ({
    default: () => (
        <div data-testid="creative-gallery">
            <button data-testid="set-first-frame-btn" onClick={() => {
                mockSetVideoInput('firstFrame', { id: 'img-1', url: 'img1.jpg' });
                mockToastSuccess('Set as First Frame');
            }}>First Frame</button>
            <button data-testid="set-last-frame-btn" onClick={() => {
                mockSetVideoInput('lastFrame', { id: 'img-2', url: 'img2.jpg' });
                mockToastSuccess('Set as Last Frame');
            }}>Last Frame</button>
        </div>
    )
}));

vi.mock('../../creative/components/CreativeNavbar', () => ({
    default: () => (
        <div data-testid="creative-navbar">
            <button data-testid="gallery-view-btn" onClick={() => mockSetViewMode('gallery')}>Gallery</button>
            <button data-testid="director-view-btn" onClick={() => mockSetViewMode('video_production')}>Director</button>
            <button data-testid="daisy-chain-toggle" onClick={() => mockSetVideoInput('isDaisyChain', true)}>Daisy Chain</button>
        </div>
    )
}));

vi.mock('../../creative/components/CreativeCanvas', () => ({
    default: () => <div data-testid="creative-canvas" />
}));

vi.mock('../../creative/components/InfiniteCanvas', () => ({
    default: () => <div data-testid="infinite-canvas" />
}));

describe('🖱️ Click: Video Production Daisychain', () => {
    const mockItems = [
        { id: 'img-1', url: 'img1.jpg', type: 'image', prompt: 'Start Prompt' },
        { id: 'img-2', url: 'img2.jpg', type: 'image', prompt: 'End Prompt' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useToast).mockReturnValue({
            success: mockToastSuccess,
            info: mockToastInfo,
            error: mockToastError,
            warning: vi.fn(),
            showToast: vi.fn(),
            loading: vi.fn(),
            updateProgress: vi.fn(),
            dismiss: vi.fn(),
            promise: vi.fn()
        } as any);
    });

    it('successfully completes a 5-step video production daisychain', async () => {
        // We need a wrapper to manage the store state transitions during the test
        const DaisychainApp = () => {
            const [state, setState] = useState({
                viewMode: 'gallery' as const,
                generationMode: 'video' as const,
                videoInputs: { isDaisyChain: false, firstFrame: null, lastFrame: null, timeOffset: 0, ingredients: [] },
                generatedHistory: mockItems,
                uploadedImages: [],
                studioControls: { resolution: '1K', aspectRatio: '16:9', duration: 4, fps: 24 },
                currentProjectId: 'p1',
                currentOrganizationId: 'o1',
                whiskState: {
                    subjects: [],
                    scenes: [],
                    styles: [],
                    motion: [],
                    preciseReference: false
                }
            });

            const setVideoInput = React.useCallback((key: string, val: any) => {
                setState((prev: any) => ({
                    ...prev,
                    videoInputs: { ...prev.videoInputs, [key]: val }
                }));
            }, []);

            const setGenerationMode = React.useCallback((mode: string) => {
                setState((prev: any) => ({ ...prev, generationMode: mode }));
            }, []);

            const setViewMode = React.useCallback((mode: any) => {
                setState((prev: any) => ({ ...prev, viewMode: mode }));
            }, []);

            const setPrompt = React.useCallback((p: string) => {
                setState((prev: any) => ({ ...prev, prompt: p }));
            }, []);

            const addToHistory = React.useCallback((_item: any) => {
                // Mock add to history
            }, []);

            // 🔗 Link interaction mocks to state updates
            mockSetVideoInput.mockImplementation(setVideoInput);
            mockSetViewMode.mockImplementation(setViewMode);
            mockSetGenerationMode.mockImplementation(setGenerationMode);
            mockSetPrompt.mockImplementation(setPrompt);
            mockAddToHistory.mockImplementation(addToHistory);

            const storeState = React.useMemo(() => ({
                ...state,
                setVideoInput,
                setGenerationMode,
                setViewMode,
                setPrompt,
                addToHistory,
                setSelectedItem: vi.fn(),
                subscribe: vi.fn(),
                currentProjectId: 'test-project',
                studioControls: {
                    resolution: '720p',
                    aspectRatio: '16:9',
                    duration: 4,
                    thinking: true
                },
                // Mock properties accessed via getState
                videoInputs: state.videoInputs,
                setIsGenerating: vi.fn(),
                setHasUnsavedChanges: vi.fn(),
                isRightPanelOpen: false,
                toggleRightPanel: vi.fn(),
                whiskState: state.whiskState
            }), [state, setVideoInput, setGenerationMode, setViewMode, setPrompt, addToHistory]);

            // Sync useStore mock to this local state
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
                return selector ? selector(storeState) : storeState;
            });

            // Mock useStore properties for direct access
            (useStore as any).getState = () => storeState;

            return <CreativeStudio initialMode="video" />;
        };

        render(<DaisychainApp />);

        // Ensure we are in Video Generation Mode but need to switch to Gallery to pick assets
        // Initial state logic in CreativeStudio might force us to video_production view

        // --- STEP 0: Switch to Gallery View ---
        // const galleryTab = screen.getByTestId('gallery-view-btn');
        // fireEvent.click(galleryTab); // Removed as initial viewMode is now 'gallery'

        await waitFor(() => {
            expect(screen.getByTestId('creative-gallery')).toBeInTheDocument();
        });

        const firstFrameBtn = screen.getByTestId('set-first-frame-btn');
        fireEvent.click(firstFrameBtn);

        // Verify store update via waitFor to allow re-render
        await waitFor(() => {
            const state = (useStore as any).getState();
            expect(state.videoInputs.firstFrame).toEqual(expect.objectContaining({ id: 'img-1' }));
        });

        const lastFrameBtn = screen.getByTestId('set-last-frame-btn');
        fireEvent.click(lastFrameBtn);

        await waitFor(() => {
            const state = (useStore as any).getState();
            expect(state.videoInputs.lastFrame).toEqual(expect.objectContaining({ id: 'img-2' }));
        });

        // --- STEP 3: Toggle Daisy Chain ---
        const daisyToggle = screen.getByTestId('daisy-chain-toggle');
        fireEvent.click(daisyToggle);

        // --- STEP 4: Input Prompt ---
        // Switch back to Director View to see the prompt input
        const directorTab = screen.getByTestId('director-view-btn');
        fireEvent.click(directorTab);

        const promptInput = screen.getByTestId('director-prompt-input');
        fireEvent.change(promptInput, { target: { value: 'Cinematic morph' } });

        // --- STEP 5: Generate ---
        vi.mocked(VideoGeneration.generateVideo).mockResolvedValue([
            { id: 'vid-1', url: 'video.mp4', prompt: 'Cinematic morph' }
        ]);

        const genBtn = screen.getByTestId('video-generate-btn');
        fireEvent.click(genBtn);

        expect(mockToastInfo).toHaveBeenCalledWith('Queuing interpolation...');

        await waitFor(() => {
            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: 'img1.jpg',
                lastFrame: 'img2.jpg'
            }));
            expect(mockToastSuccess).toHaveBeenCalledWith('Scene generated!');
        });
    });
});
