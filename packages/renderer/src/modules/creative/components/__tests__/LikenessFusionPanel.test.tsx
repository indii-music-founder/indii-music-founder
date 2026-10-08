import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LikenessFusionPanel from '../LikenessFusionPanel';
import { LikenessService } from '@/services/image/LikenessService';
import { fuseLikeness } from '@/services/identity/LikenessFusionService';
import { useStore } from '@/core/store';

vi.mock('@/services/image/LikenessService', () => ({
    LikenessService: {
        getAll: vi.fn(),
        add: vi.fn(),
    },
}));

vi.mock('@/services/identity/LikenessFusionService', () => ({
    IDENTITY_SIMILARITY_THRESHOLD: 0.55,
    fuseLikeness: vi.fn(),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((url: string) => Promise.resolve(url)),
}));

vi.mock('@/core/store', () => {
    const mockState = {
        selectedItem: { id: 'img_test_1', type: 'image', url: 'https://storage.indii.music/test.png' },
        addToHistory: vi.fn(),
        currentProjectId: 'test-project',
        openDoc: vi.fn(),
    };
    return {
        useStore: vi.fn((selector) => selector(mockState)),
    };
});

describe('LikenessFusionPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (LikenessService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            {
                id: 'headshot_1',
                url: 'https://storage.indii.music/selfie1.webp',
                storageRef: 'users/u1/selfie1.webp',
                qualityScore: 'good',
                createdAt: 1000,
            },
            {
                id: 'headshot_2',
                url: 'https://storage.indii.music/selfie2.webp',
                storageRef: 'users/u1/selfie2.webp',
                qualityScore: 'acceptable',
                createdAt: 900,
            },
        ]);
        (fuseLikeness as ReturnType<typeof vi.fn>).mockResolvedValue({
            dataUrl: 'data:image/png;base64,fusedImageData',
            similarity: 0.78,
            passedThreshold: true,
            attempts: [{ dataUrl: 'data:image/png;base64,fusedImageData', similarity: 0.78 }],
            embeddingMode: 'identity',
        });
    });

    it('renders headshot list and initial parameters', async () => {
        render(<LikenessFusionPanel />);
        expect(screen.getByTestId('likeness-fusion-panel')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId('headshot-card-headshot_1')).toBeInTheDocument();
        });
        expect(screen.getByTestId('fusion-max-attempts-input')).toHaveValue(3);
    });

    it('triggers fusion loop and displays similarity score readout on success', async () => {
        render(<LikenessFusionPanel />);
        await waitFor(() => {
            expect(screen.getByTestId('headshot-card-headshot_1')).toBeInTheDocument();
        });

        const fuseBtn = screen.getByTestId('fuse-likeness-btn');
        fireEvent.click(fuseBtn);

        await waitFor(() => {
            expect(fuseLikeness).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetDataUrl: 'https://storage.indii.music/test.png',
                    headshotId: 'headshot_1',
                    maxAttempts: 3,
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByTestId('fusion-results-section')).toBeInTheDocument();
        });
        expect(screen.getByTestId('similarity-score-readout')).toHaveTextContent('78.0%');
        expect(screen.getByText('Passed Threshold')).toBeInTheDocument();
    });

    it('handles empty headshots gracefully with informative banner', async () => {
        (LikenessService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        render(<LikenessFusionPanel targetImageUrl="https://test.com/target.png" />);

        await waitFor(() => {
            expect(screen.getByText('No verified headshots found')).toBeInTheDocument();
        });
        expect(screen.getByTestId('upload-likeness-selfie-btn')).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox', { name: /I consent to storing/ }));
        expect(screen.getByTestId('upload-likeness-selfie-btn')).toBeEnabled();
        expect(screen.getByTestId('fuse-likeness-btn')).toBeDisabled();
    });
    it('does not record consent or enroll an image without an affirmative choice', async () => {
        vi.mocked(LikenessService.getAll).mockResolvedValue([]);
        render(<LikenessFusionPanel />);
        await screen.findByText('No verified headshots found');
        fireEvent.change(screen.getByTestId('likeness-selfie-upload-input'), {
            target: { files: [new File(['image'], 'selfie.png', { type: 'image/png' })] },
        });
        expect(LikenessService.add).not.toHaveBeenCalled();
        expect(screen.getByText('Confirm your consent before uploading a likeness photo.')).toBeInTheDocument();
    });

    it('reports failed persistence rather than claiming enrollment succeeded', async () => {
        vi.mocked(LikenessService.getAll).mockResolvedValue([]);
        vi.mocked(LikenessService.add).mockResolvedValue(null);
        render(<LikenessFusionPanel />);
        await screen.findByText('No verified headshots found');
        fireEvent.click(screen.getByRole('checkbox', { name: /I consent to storing/ }));
        fireEvent.change(screen.getByTestId('likeness-selfie-upload-input'), {
            target: { files: [new File(['image'], 'selfie.png', { type: 'image/png' })] },
        });
        await screen.findByText(/The selfie could not be saved/);
        expect(LikenessService.add).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/), 'acceptable', expect.any(String), true);
    });

});
