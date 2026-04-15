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

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeWhiskPrompt: vi.fn((p) => p),
        synthesizeVideoPrompt: vi.fn((p) => p)
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn()
    }
}));

// Use a simplified store mock
vi.mock('@/core/store', () => ({
    useStore: (selector: any) => selector({
        studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6 },
        setPrompt: vi.fn(),
        addToHistory: vi.fn(),
        currentProjectId: 'test-project',
        whiskState: {},
        setSelectedItem: vi.fn(),
        setViewMode: vi.fn()
    }),
    logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

// Mock dynamic import for DirectImageGenerator
vi.mock('@/services/ai/generators/DirectImageGenerator', () => ({
    generateImageDirectly: vi.fn()
}));

describe('DirectGenerationTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        const { generateImageDirectly } = await import('@/services/ai/generators/DirectImageGenerator');
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
        const mockVideoResult = [{ id: 'job-123', url: 'https://test.com/video.mp4' }];
        (VideoGeneration.generateVideo as import("vitest").Mock).mockResolvedValue(mockVideoResult);

        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A cinematic drone shot' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        await waitFor(() => {
            expect(VideoGeneration.generateVideo).toHaveBeenCalled();
        });

        // Results grid should show the video
        // Note: querySelector('video') might be safer if getByRole('video') fails in jsdom
        await waitFor(() => {
            const video = document.querySelector('video');
            expect(video).toBeTruthy();
        });
    });

    it('displays error message when generation fails', async () => {
        const { generateImageDirectly } = await import('@/services/ai/generators/DirectImageGenerator');
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
