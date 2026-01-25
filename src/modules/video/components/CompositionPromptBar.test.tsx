import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompositionPromptBar } from './CompositionPromptBar';
import { videoCompositionService } from '@/services/video/VideoCompositionService';
import { renderService } from '@/services/video/RenderService';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/services/video/VideoCompositionService', () => ({
    videoCompositionService: {
        generateComposition: vi.fn(),
    },
}));

vi.mock('@/services/video/RenderService', () => ({
    renderService: {
        renderComposition: vi.fn(),
    },
}));

vi.mock('../store/videoEditorStore');

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('CompositionPromptBar', () => {
    const mockSetAIComposition = vi.fn();
    const mockOnBack = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useVideoEditorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            setAIComposition: mockSetAIComposition,
            aiComposition: null, // Start with no composition
            setViewMode: vi.fn(),
        });
    });

    it('renders input and buttons correctly', () => {
        render(<CompositionPromptBar onBack={mockOnBack} />);
        expect(screen.getByPlaceholderText('Describe your video composition...')).toBeInTheDocument();
        expect(screen.getByText('Generate')).toBeInTheDocument();
        expect(screen.queryByText('Export')).not.toBeInTheDocument(); // Export should be hidden initially
    });

    it('generates composition on button click', async () => {
        const mockComposition = { id: 'test-comp' };
        (videoCompositionService.generateComposition as ReturnType<typeof vi.fn>).mockResolvedValue(mockComposition);

        render(<CompositionPromptBar onBack={mockOnBack} />);

        const input = screen.getByPlaceholderText('Describe your video composition...');
        fireEvent.change(input, { target: { value: 'A cool video' } });

        const generateBtn = screen.getByText('Generate').closest('button');
        fireEvent.click(generateBtn!);

        expect(screen.getByText('Dreaming...')).toBeInTheDocument();

        await waitFor(() => {
            expect(videoCompositionService.generateComposition).toHaveBeenCalledWith('A cool video');
            expect(mockSetAIComposition).toHaveBeenCalledWith(mockComposition);
        });
    });

    it('enables export when composition exists', () => {
        (useVideoEditorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            setAIComposition: mockSetAIComposition,
            aiComposition: { id: 'some-comp' }, // Now we have composition
            setViewMode: vi.fn(),
        });

        render(<CompositionPromptBar onBack={mockOnBack} />);
        expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('calls renderService on export', async () => {
        (useVideoEditorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            setAIComposition: mockSetAIComposition,
            aiComposition: { id: 'some-comp' },
            setViewMode: vi.fn(),
        });
        (renderService.renderComposition as ReturnType<typeof vi.fn>).mockResolvedValue('/path/to/video.mp4');

        render(<CompositionPromptBar onBack={mockOnBack} />);

        // We need to type into prompt because it is needed for inputProps
        const input = screen.getByPlaceholderText('Describe your video composition...');
        fireEvent.change(input, { target: { value: 'Export me' } });

        const exportBtn = screen.getByText('Export').closest('button');
        fireEvent.click(exportBtn!);

        expect(screen.getByText('Rendering...')).toBeInTheDocument();

        await waitFor(() => {
            expect(renderService.renderComposition).toHaveBeenCalledWith({
                compositionId: 'AIComposition',
                inputProps: {
                    composition: { id: 'some-comp' },
                    prompt: 'Export me'
                }
            });
        });
    });
});
