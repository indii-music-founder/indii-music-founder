import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectGenerationTab from './DirectGenerationTab';

// Mock dependencies
const mockAddToHistory = vi.fn();
const mockSetPrompt = vi.fn();
const mockSetSelectedItem = vi.fn();
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
};

vi.mock('@/core/store', () => ({
    useStore: () => ({
        studioControls: {
            aspectRatio: '16:9',
            resolution: '1024x1024',
            model: 'pro',
            thinking: false
        },
        setPrompt: mockSetPrompt,
        addToHistory: mockAddToHistory,
        currentProjectId: 'test-project',
        whiskState: {
            subject: [],
            style: [],
            scene: []
        },
        setSelectedItem: mockSetSelectedItem
    })
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn().mockResolvedValue([
            { id: '1', url: 'data:image/png;base64,test1' }
        ])
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn().mockResolvedValue([
            { id: '1', url: 'https://test.com/video.mp4' }
        ])
    }
}));

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeWhiskPrompt: vi.fn((prompt) => prompt),
        synthesizeVideoPrompt: vi.fn((prompt) => prompt)
    }
}));

describe('DirectGenerationTab Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default state', () => {
        render(<DirectGenerationTab />);

        expect(screen.getByPlaceholderText(/Describe your image/i)).toBeInTheDocument();
        expect(screen.getByText('IMAGE')).toBeInTheDocument();
        expect(screen.getByText('VIDEO')).toBeInTheDocument();
    });

    it('should switch between image and video modes', () => {
        render(<DirectGenerationTab />);

        const videoButton = screen.getByText('VIDEO');
        fireEvent.click(videoButton);

        expect(screen.getByPlaceholderText(/Describe your video/i)).toBeInTheDocument();
    });

    it('should update prompt on input', () => {
        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        expect(input).toHaveValue('A beautiful landscape');
    });

    it('should generate image on send button click', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        const sendButton = screen.getByRole('button', { name: '' }); // Send button
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
        });
    });

    it('should handle image generation success', async () => {
        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Image generated successfully');
            expect(mockAddToHistory).toHaveBeenCalled();
            expect(mockSetSelectedItem).toHaveBeenCalled();
        });
    });

    it('should handle image generation error', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        (ImageGeneration.generateImages as any).mockRejectedValueOnce(
            new Error('Generation failed')
        );

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(
                expect.stringContaining('Generation failed')
            );
        });
    });

    it('should handle timeout errors specifically', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        (ImageGeneration.generateImages as any).mockRejectedValueOnce({
            code: 'deadline-exceeded',
            message: 'Timeout'
        });

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'Test' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(
                expect.stringContaining('timed out')
            );
        });
    });

    it('should handle quota exceeded errors', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        (ImageGeneration.generateImages as any).mockRejectedValueOnce({
            code: 'resource-exhausted',
            message: 'Quota exceeded'
        });

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'Test' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(
                expect.stringContaining('Quota exceeded')
            );
        });
    });

    it('should generate video when in video mode', async () => {
        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');

        render(<DirectGenerationTab />);

        // Switch to video mode
        const videoButton = screen.getByText('VIDEO');
        fireEvent.click(videoButton);

        const input = screen.getByPlaceholderText(/Describe your video/i);
        fireEvent.change(input, { target: { value: 'A video scene' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(VideoGeneration.generateVideo).toHaveBeenCalled();
        });
    });

    it('should handle video generation success', async () => {
        render(<DirectGenerationTab />);

        const videoButton = screen.getByText('VIDEO');
        fireEvent.click(videoButton);

        const input = screen.getByPlaceholderText(/Describe your video/i);
        fireEvent.change(input, { target: { value: 'A video scene' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Video generated successfully');
        });
    });

    it('should handle queued video generation', async () => {
        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
        (VideoGeneration.generateVideo as any).mockResolvedValueOnce([
            { id: '1', url: '' } // Empty URL indicates queued
        ]);

        render(<DirectGenerationTab />);

        const videoButton = screen.getByText('VIDEO');
        fireEvent.click(videoButton);

        const input = screen.getByPlaceholderText(/Describe your video/i);
        fireEvent.change(input, { target: { value: 'A video scene' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.info).toHaveBeenCalledWith(
                expect.stringContaining('Video job queued')
            );
        });
    });

    it('should not generate with empty prompt', () => {
        render(<DirectGenerationTab />);

        const sendButton = screen.getByRole('button', { name: '' });

        expect(sendButton).toBeDisabled();
    });

    it('should handle Enter key to generate', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'Test prompt' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
        });
    });

    it('should not generate on Shift+Enter', () => {
        const { ImageGeneration } = require('@/services/image/ImageGenerationService');
        (ImageGeneration.generateImages as any).mockClear();

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'Test prompt' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

        expect(ImageGeneration.generateImages).not.toHaveBeenCalled();
    });

    it('should show empty state when no results', () => {
        render(<DirectGenerationTab />);

        expect(screen.getByText('Start Creating')).toBeInTheDocument();
        expect(screen.getByText(/Enter a prompt to begin/i)).toBeInTheDocument();
    });

    it('should display model name in prompt bar', () => {
        render(<DirectGenerationTab />);

        expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    it('should show loading state during generation', async () => {
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        let resolveGeneration: any;
        (ImageGeneration.generateImages as any).mockImplementation(
            () => new Promise((resolve) => { resolveGeneration = resolve; })
        );

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText(/Describe your image/i);
        fireEvent.change(input, { target: { value: 'Test' } });

        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        // Check for loader icon
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const sendBtn = buttons.find(btn => btn.querySelector('[data-testid="icon-Loader2"]'));
            expect(sendBtn).toBeInTheDocument();
        });

        // Resolve the generation
        resolveGeneration([{ id: '1', url: 'data:image/png;base64,test' }]);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalled();
        });
    });
});