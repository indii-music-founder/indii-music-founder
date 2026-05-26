import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectGenerationTab from '../DirectGenerationTab';
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

const mockHttpsCallable = vi.fn(() => vi.fn().mockResolvedValue({ data: { success: true } }));
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: () => mockHttpsCallable
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
    studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6 },
    creativePrompt: '',
    setCreativePrompt: (val: string) => set({ creativePrompt: val }),
    addToHistory: vi.fn(),
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
            studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6 },
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
        const { generateImageDirectly } = await import('@/services/intelligence/generators/DirectImageGenerator');
        (generateImageDirectly as import("vitest").Mock).mockResolvedValue(['data:image/png;base64,test']);

        render(<DirectGenerationTab />);
        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        await waitFor(() => {
            expect(generateImageDirectly).toHaveBeenCalled();
        });

        expect(screen.getByRole('img')).toBeDefined();
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
        const { generateImageDirectly } = await import('@/services/intelligence/generators/DirectImageGenerator');
        (generateImageDirectly as import("vitest").Mock).mockRejectedValue(new Error('API Timeout'));

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: API Timeout');
        });
    });
});
