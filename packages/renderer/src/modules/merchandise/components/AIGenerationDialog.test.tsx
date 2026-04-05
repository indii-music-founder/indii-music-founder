import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AIGenerationDialog } from './AIGenerationDialog';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { QuotaExceededError } from '@/shared/types/errors';

// Mock dependencies
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn(),
    }
}));

const mockToast = {
    loading: vi.fn().mockReturnValue('loading-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast
}));

vi.mock('@/core/store', () => ({
    useStore: () => ({
        currentProjectId: 'test-project',
        addToHistory: vi.fn(),
    })
}));

describe('AIGenerationDialog', () => {
    const onClose = vi.fn();
    const onImageGenerated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly when open', () => {
        render(
            <AIGenerationDialog
                isOpen={true}
                onClose={onClose}
                onImageGenerated={onImageGenerated}
            />
        );
        expect(screen.getByText('AI Image Generation')).toBeInTheDocument();
        expect(screen.getByText('Generate')).toBeInTheDocument();
        expect(screen.getByLabelText('Describe what you want to create')).toBeInTheDocument();
        // Generate button should be disabled initially (empty prompt)
        expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    });

    it('handles successful generation', async () => {
        (ImageGeneration.generateImages as import("vitest").Mock).mockResolvedValue([
            { id: '1', url: 'http://example.com/image.png', prompt: 'test prompt' }
        ]);

        render(
            <AIGenerationDialog
                isOpen={true}
                onClose={onClose}
                onImageGenerated={onImageGenerated}
            />
        );

        const input = screen.getByLabelText('Describe what you want to create');
        fireEvent.change(input, { target: { value: 'test prompt' } });

        const button = screen.getByRole('button', { name: /generate/i });
        expect(button).not.toBeDisabled();
        fireEvent.click(button);

        expect(mockToast.loading).toHaveBeenCalled();

        await waitFor(() => {
            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'test prompt'
            }));
            expect(onImageGenerated).toHaveBeenCalledWith('http://example.com/image.png', expect.stringContaining('AI: test prompt'));
            expect(mockToast.success).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('handles QuotaExceededError correctly', async () => {
        const error = new QuotaExceededError(
            'images', 'free', 'Upgrade to Pro', 5, 5
        );
        (ImageGeneration.generateImages as import("vitest").Mock).mockRejectedValue(error);

        render(
            <AIGenerationDialog
                isOpen={true}
                onClose={onClose}
                onImageGenerated={onImageGenerated}
            />
        );

        const input = screen.getByLabelText('Describe what you want to create');
        fireEvent.change(input, { target: { value: 'test prompt' } });

        const button = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Quota exceeded: images. Upgrade to Pro');
        });
    });

    it('handles generic errors correctly', async () => {
        (ImageGeneration.generateImages as import("vitest").Mock).mockRejectedValue(new Error('Network error'));

        render(
            <AIGenerationDialog
                isOpen={true}
                onClose={onClose}
                onImageGenerated={onImageGenerated}
            />
        );

        const input = screen.getByLabelText('Describe what you want to create');
        fireEvent.change(input, { target: { value: 'test prompt' } });

        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: Network error');
        });
    });

    it('shows loading state (Spinner + Disabled UI) during generation', async () => {
        let resolveGeneration: ((value: any) => void) | undefined;
        const generatePromise = new Promise((resolve) => {
            resolveGeneration = resolve;
        });

        (ImageGeneration.generateImages as import("vitest").Mock).mockReturnValue(generatePromise);

        render(
            <AIGenerationDialog
                isOpen={true}
                onClose={onClose}
                onImageGenerated={onImageGenerated}
            />
        );

        const input = screen.getByLabelText('Describe what you want to create');
        fireEvent.change(input, { target: { value: 'loading check' } });

        const button = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(button);

        // Assert Loading State
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent(/Generating.../i);
        expect(input).toBeDisabled();

        // Resolve
        await act(async () => {
             resolveGeneration!([
                { id: '1', url: 'http://example.com/image.png', prompt: 'loading check' }
            ]);
        });

        // Assert Success/Idle State
        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
