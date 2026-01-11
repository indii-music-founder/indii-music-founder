import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import CreativeStudio from '../../creative/CreativeStudio';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useVideoEditorStore } from '../store/videoEditorStore';

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
        setIsGenerating: vi.fn()
    }));
    (mockStore as any).subscribe = vi.fn();
    return { useStore: mockStore };
});

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        getWhiskStatus: vi.fn().mockResolvedValue({}),
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

describe('🖱️ Click: Video Production Daisychain', () => {
    const mockToast = {
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warning: vi.fn()
    };

    const mockItems = [
        { id: 'img-1', url: 'img1.jpg', type: 'image', prompt: 'Start Prompt' },
        { id: 'img-2', url: 'img2.jpg', type: 'image', prompt: 'End Prompt' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (useToast as any).mockReturnValue(mockToast);
    });

    it('successfully completes a 5-step video production daisychain', async () => {
        // We need a wrapper to manage the store state transitions during the test
        const DaisychainApp = () => {
            const [state, setState] = useState<any>({
                viewMode: 'gallery',
                generationMode: 'image',
                videoInputs: { isDaisyChain: false, firstFrame: null, lastFrame: null, timeOffset: 0 },
                generatedHistory: mockItems,
                studioControls: { resolution: '1K', aspectRatio: '16:9', duration: 4, fps: 24 },
                currentProjectId: 'p1',
                currentOrganizationId: 'o1'
            });

            const setVideoInput = (key: string, val: any) => {
                setState((prev: any) => ({
                    ...prev,
                    videoInputs: { ...prev.videoInputs, [key]: val }
                }));
            };

            const setGenerationMode = (mode: string) => {
                setState((prev: any) => ({ ...prev, generationMode: mode }));
            };

            const setViewMode = (mode: string) => {
                setState((prev: any) => ({ ...prev, viewMode: mode }));
            };

            const setPrompt = (p: string) => {
                setState((prev: any) => ({ ...prev, prompt: p }));
            };

            const addToHistory = (item: any) => {
                setState((prev: any) => ({ ...prev, generatedHistory: [...prev.generatedHistory, item] }));
            };

            (useStore as any).mockImplementation((selector: any) => {
                const storeState = {
                    ...state,
                    setVideoInput,
                    setGenerationMode,
                    setViewMode,
                    setPrompt,
                    addToHistory,
                    setSelectedItem: vi.fn(),
                    setPendingPrompt: vi.fn(),
                    selectedItem: null,
                    userProfile: { id: 'u1', name: 'Test User' },
                    whiskState: { activeSubjects: [], activeStyles: [] }
                };
                return selector ? selector(storeState) : storeState;
            });

            // Mock useStore properties
            (useStore as any).getState = () => ({
                setVideoInput,
                setGenerationMode,
                setViewMode,
                setSelectedItem: vi.fn(),
                videoInputs: state.videoInputs,
                addToHistory,
                setIsGenerating: vi.fn()
            });
            (useStore as any).setState = vi.fn();
            (useStore as any).subscribe = vi.fn();

            return <CreativeStudio />;
        };

        render(<DaisychainApp />);

        // Ensure we are in Video Generation Mode but need to switch to Gallery to pick assets
        // Initial state logic in CreativeStudio might force us to video_production view

        // --- STEP 0: Switch to Gallery View ---
        const galleryTab = screen.getByTestId('gallery-view-btn');
        fireEvent.click(galleryTab);

        // --- STEP 1: Set First Frame ---
        const firstFrameBtn = screen.getAllByTestId('set-first-frame-btn')[0];
        fireEvent.click(firstFrameBtn);

        expect(mockToast.success).toHaveBeenCalledWith('Set as First Frame'); // Updated expected message

        // --- STEP 2: Set Last Frame ---
        const lastFrameBtn = screen.getAllByTestId('set-last-frame-btn')[1];
        fireEvent.click(lastFrameBtn);
        expect(mockToast.success).toHaveBeenCalledWith('Set as Last Frame'); // Updated expected message

        // --- STEP 3: Toggle Daisy Chain ---
        const daisyToggle = screen.getByTestId('daisy-chain-toggle');
        fireEvent.click(daisyToggle);

        // --- STEP 4: Input Prompt ---
        const promptInput = screen.getByTestId('director-prompt-input');
        fireEvent.change(promptInput, { target: { value: 'Cinematic morph' } });

        // --- STEP 5: Generate ---
        vi.mocked(VideoGeneration.generateVideo).mockResolvedValue([
            { id: 'vid-1', url: 'video.mp4', prompt: 'Cinematic morph' }
        ]);

        const genBtn = screen.getByTestId('video-generate-btn');
        fireEvent.click(genBtn);

        expect(mockToast.info).toHaveBeenCalledWith('Queuing interpolation...');

        await waitFor(() => {
            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: 'img1.jpg',
                lastFrame: 'img2.jpg'
            }));
            expect(mockToast.success).toHaveBeenCalledWith('Scene generated!');
        });
    });
});
