import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnhancedShowroom from './EnhancedShowroom';
import { Editing } from '@/services/image/EditingService';
import { browserUpscale } from '@/services/upscale/BrowserUpscale';

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

vi.mock('@/services/upscale/BrowserUpscale', () => ({
    browserUpscale: vi.fn(),
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

    it('waits for browser upscale and passes the enlarged source to the next mockup', async () => {
        vi.stubGlobal('Image', class {
            naturalWidth = 1;
            naturalHeight = 1;
            async decode() {}
        });
        const original = 'data:image/png;base64,AAAA';
        const enlarged = 'data:image/png;base64,BBBB';
        type UpscaleResult = Awaited<ReturnType<typeof browserUpscale>>;
        let resolveUpscale!: (result: UpscaleResult) => void;
        const upscalePromise = new Promise<UpscaleResult>(resolve => {
            resolveUpscale = resolve;
        });
        vi.mocked(browserUpscale).mockReturnValueOnce(upscalePromise);
        vi.mocked(Editing.generateComposite).mockResolvedValueOnce({
            id: 'mockup-asset',
            url: 'https://storage.googleapis.com/test-bucket/mockup.png',
            prompt: 'Studio background',
        });

        try {
            render(<EnhancedShowroom initialAsset={original} />);
            fireEvent.change(screen.getByTestId('scene-prompt-input'), {
                target: { value: 'Studio background' },
            });
            fireEvent.click(screen.getByTestId('merch-upscale-4x'));

            const generate = screen.getByTestId('showroom-generate-mockup-btn');
            await waitFor(() => expect(browserUpscale).toHaveBeenCalledWith({
                dataUrl: original,
                required: { width: 4, height: 4 },
            }));
            expect(generate).toBeDisabled();
            fireEvent.click(generate);
            expect(Editing.generateComposite).not.toHaveBeenCalled();

            resolveUpscale({ url: enlarged, width: 4, height: 4 });
            await waitFor(() => expect(generate).toBeEnabled());
            expect(screen.getByAltText('Asset')).toHaveAttribute('src', enlarged);

            fireEvent.click(generate);
            await waitFor(() => expect(Editing.generateComposite).toHaveBeenCalledWith(
                expect.objectContaining({ images: [{ mimeType: 'image/png', data: 'BBBB' }] }),
            ));
            await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Mockup generated successfully!'));
        } finally {
            vi.unstubAllGlobals();
        }
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

describe('EnhancedShowroom browser AI Upscale (ISSUE-1612)', () => {
    const originalImage = globalThis.Image;

    beforeEach(() => {
        vi.clearAllMocks();
        class MockImage {
            naturalWidth = 1600;
            naturalHeight = 2000;
            width = 1600;
            height = 2000;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            decode = vi.fn().mockResolvedValue(undefined);
            set src(_value: string) {
                queueMicrotask(() => {
                    this.onload?.();
                });
            }
        }
        vi.stubGlobal('Image', MockImage);
    });

    afterEach(() => {
        vi.stubGlobal('Image', originalImage);
    });

    it('enlarges asset dimensions at 4x and displays the upscaled badge', async () => {
        vi.mocked(browserUpscale).mockResolvedValueOnce({
            url: 'data:image/png;base64,UPSCALED_6400X8000',
            width: 6400,
            height: 8000,
        });

        render(
            <EnhancedShowroom initialAsset="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" />
        );

        const upscale4xBtn = screen.getByTestId('merch-upscale-4x');
        fireEvent.click(upscale4xBtn);

        await waitFor(() => {
            expect(browserUpscale).toHaveBeenCalledWith(
                expect.objectContaining({
                    required: { width: 6400, height: 8000 },
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Upscaled 4× · 6400×8000/i)).toBeInTheDocument();
        });
        expect(screen.queryByTestId('showroom-upscale-error')).not.toBeInTheDocument();
        expect(mockToast.success).toHaveBeenCalledWith(
            expect.stringContaining('Design upscaled 4×')
        );
    });

    it('surfaces persistent inline error when browserUpscale fails to enlarge dimensions', async () => {
        vi.mocked(browserUpscale).mockResolvedValueOnce({
            url: 'data:image/png;base64,SAME_SIZE',
            width: 1600,
            height: 2000,
        });

        render(
            <EnhancedShowroom initialAsset="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" />
        );

        fireEvent.click(screen.getByTestId('merch-upscale-4x'));

        await waitFor(() => {
            expect(screen.getByTestId('showroom-upscale-error')).toHaveTextContent(
                'Upscale completed without enlarging the design asset.'
            );
        });
        expect(mockToast.error).toHaveBeenCalledWith(
            expect.stringContaining('Upscale completed without enlarging the design asset.')
        );
    });
});
