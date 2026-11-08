import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnhancedShowroom from './EnhancedShowroom';
import { Editing } from '@/services/image/EditingService';

const mockToast = {
    loading: vi.fn(() => 'loading-toast-id'),
    updateProgress: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        generateComposite: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: any) =>
        selector({
            addToHistory: vi.fn(),
            currentProjectId: 'test-project-123',
        }),
}));

describe('EnhancedShowroom (ISSUE-1605)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes mockup creation through Editing.generateComposite and renders mockup result', async () => {
        vi.mocked(Editing.generateComposite).mockResolvedValueOnce({
            id: 'mockup-asset-1',
            url: 'https://storage.googleapis.com/test-bucket/mockup-result.png',
            prompt: 'Product photograph',
        });

        render(
            <EnhancedShowroom initialAsset="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" />
        );

        const promptInput = screen.getByTestId('scene-prompt-input');
        fireEvent.change(promptInput, { target: { value: 'Studio minimal clean background' } });

        const generateBtn = screen.getByTestId('showroom-generate-mockup-btn');
        expect(generateBtn).not.toBeDisabled();
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(Editing.generateComposite).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: [
                        {
                            mimeType: 'image/png',
                            data: expect.any(String),
                        },
                    ],
                    projectContext: expect.stringContaining('commercial product visualization'),
                })
            );
        });

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Mockup generated successfully!');
        });
    });

    it('surfaces actionable error message when composite generation fails', async () => {
        vi.mocked(Editing.generateComposite).mockRejectedValueOnce(
            new Error('Invalid or unauthorized model ID.')
        );

        render(
            <EnhancedShowroom initialAsset="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" />
        );

        const promptInput = screen.getByTestId('scene-prompt-input');
        fireEvent.change(promptInput, { target: { value: 'Studio minimal clean background' } });

        const generateBtn = screen.getByTestId('showroom-generate-mockup-btn');
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Failed to generate mockup: Invalid or unauthorized model ID.');
        });
    });
});
