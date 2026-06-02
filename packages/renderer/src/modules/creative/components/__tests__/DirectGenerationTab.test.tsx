import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectGenerationTab from '../DirectGenerationTab';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
const mockToastObject = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => mockToastObject)
}));

const mockHttpsCallable = vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } });
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: () => mockHttpsCallable
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        doc: vi.fn(),
        onSnapshot: vi.fn((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    data: () => ({
                        status: 'completed',
                        progress: 100,
                        resultUri: 'https://test.com/video.mp4'
                    })
                });
            }, 10);
            return () => {};
        })
    };
});

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(),
    ref: vi.fn(),
    getDownloadURL: vi.fn().mockResolvedValue('https://test.com/video.mp4')
}));

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeWhiskPrompt: vi.fn((p) => p),
        synthesizeVideoPrompt: vi.fn((p) => p)
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn((jobId, callback) => {
            setTimeout(() => {
                callback({
                    id: jobId,
                    status: 'completed',
                    progress: 100,
                    videoUrl: 'https://test.com/video.mp4',
                    output: {
                        url: 'https://test.com/video.mp4',
                        metadata: { mime_type: 'video/mp4', quality: 'pro' }
                    }
                });
            }, 10);
            return () => {};
        })
    }
}));

import { create } from 'zustand';

const useMockStore = create<any>((set) => ({
    studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6, personGeneration: 'allow_adult', negativePrompt: '', seed: '' },
    creativePrompt: '',
    setCreativePrompt: (val: string) => set({ creativePrompt: val }),
    addToHistory: vi.fn((item) => set((state: any) => ({ generatedHistory: [...(state.generatedHistory || []), item] }))),
    currentProjectId: 'test-project',
    whiskState: {},
    setSelectedItem: vi.fn(),
    setViewMode: vi.fn(),
    videoInputs: { ingredients: [] },
    setVideoInputs: vi.fn(),
    generationMode: 'image',
    setGenerationMode: (val: string) => set({ generationMode: val }),
    isPromptBuilderOpen: false,
    togglePromptBuilder: () => set((state: any) => ({ isPromptBuilderOpen: !state.isPromptBuilderOpen }))
}));

// Use a simplified store mock
vi.mock('@/core/store', () => ({
    useStore: (selector: any) => useMockStore(selector),
    logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

// Mock dynamic import for DirectImageGenerator
vi.mock('@/services/intelligence/generators/DirectImageGenerator', () => ({
    generateImageDirectly: vi.fn()
}));

describe('DirectGenerationTab', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        useMockStore.setState({
            studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6, personGeneration: 'allow_adult', negativePrompt: '', seed: '' },
            creativePrompt: '',
            currentProjectId: 'test-project',
            whiskState: {},
            videoInputs: { ingredients: [] },
            generationMode: 'image',
            isPromptBuilderOpen: false
        });
    });

    it('renders initial state correctly', () => {
        render(<DirectGenerationTab />);
        expect(screen.getByPlaceholderText(/Describe your image/i)).toBeDefined();
        expect(screen.getByTestId('direct-image-mode-btn')).toBeDefined();
        expect(screen.getByTestId('direct-video-mode-btn')).toBeDefined();
    });

    it('switches between image and video modes', () => {
        render(<DirectGenerationTab />);
        const videoBtn = screen.getByTestId('direct-video-mode-btn');
        const imageBtn = screen.getByTestId('direct-image-mode-btn');

        fireEvent.click(videoBtn);
        expect(screen.getByPlaceholderText(/Describe your video/i)).toBeDefined();

        fireEvent.click(imageBtn);
        expect(screen.getByPlaceholderText(/Describe your image/i)).toBeDefined();
    });

    it('handles image generation successfully', async () => {
        vi.useFakeTimers();
        render(<DirectGenerationTab />);
        
        // Ensure image mode is selected
        const imageBtn = screen.getByTestId('direct-image-mode-btn');
        fireEvent.click(imageBtn);
        
        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        expect(mockHttpsCallable).toHaveBeenCalled();
        const imagePayload = mockHttpsCallable.mock.calls[0]?.[0];
        expect(imagePayload).not.toHaveProperty('referenceUri');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3010);
        });

        // Results grid should show the image
        const img = document.querySelector('img');
        expect(img).toBeTruthy();
    });

    it('handles video generation successfully', async () => {
        vi.useFakeTimers();
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A cinematic drone shot' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        expect(mockHttpsCallable).toHaveBeenCalled();
        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A cinematic drone shot',
            aspectRatio: '16:9',
            model: 'fast',
            resolution: '1080p',
            durationSeconds: 6,
            personGeneration: 'allow_adult',
            enhancePrompt: true,
        }));

        // Fast-forward all pending timers including the 10ms subscription callback
        // and the 3000ms job cleanup timer.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3010);
        });

        // Results grid should show the video
        const video = document.querySelector('video');
        expect(video).toBeTruthy();
    });

    it('displays error message when generation fails', async () => {
        mockHttpsCallable.mockRejectedValueOnce(new Error('API Error'));

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: API Error');
        });
    });

    it('surfaces Firebase callable details when the public message is internal', async () => {
        mockHttpsCallable.mockRejectedValueOnce({
            code: 'functions/internal',
            message: 'internal',
            details: { cause: 'Gemini model is not available in this project or region' },
        });

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: Gemini model is not available in this project or region');
        });
    });
});
