import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntelligenceImageBatchModal from '@/modules/marketing/components/IntelligenceImageBatchModal';
import { CampaignAsset, CampaignStatus } from '@/modules/marketing/types';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/marketing/CampaignIntelligenceService', () => ({
    CampaignIntelligence: {
        generatePostImages: vi.fn(),
        generateSingleImage: vi.fn(),
    },
}));

const TEST_CAMPAIGN: CampaignAsset = {
    id: 'campaign-1',
    assetType: 'campaign',
    title: 'Test Campaign',
    durationDays: 7,
    startDate: '2026-01-01',
    status: CampaignStatus.PENDING,
    posts: [
        {
            id: 'post-1',
            platform: 'Instagram',
            copy: 'copy',
            imageAsset: { assetType: 'image', title: 't', imageUrl: 'https://already-generated.example/image.png', caption: '' },
            day: 1,
            status: CampaignStatus.PENDING,
        },
    ],
};

/**
 * ISSUE-949: Apply & Save previously closed the modal unconditionally,
 * regardless of whether the generated image URLs actually persisted to the
 * campaign record.
 */
describe('IntelligenceImageBatchModal (ISSUE-949)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('only closes after onComplete (the real persistence call) resolves', async () => {
        const onClose = vi.fn();
        const onComplete = vi.fn().mockResolvedValue(undefined);

        render(<IntelligenceImageBatchModal campaign={TEST_CAMPAIGN} onClose={onClose} onComplete={onComplete} />);

        fireEvent.click(screen.getByRole('button', { name: /Apply & Save/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('keeps the modal open and never claims success when persistence fails', async () => {
        const onClose = vi.fn();
        const onComplete = vi.fn().mockRejectedValue(new Error('Firestore write failed'));

        render(<IntelligenceImageBatchModal campaign={TEST_CAMPAIGN} onClose={onClose} onComplete={onComplete} />);

        fireEvent.click(screen.getByRole('button', { name: /Apply & Save/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Apply & Save/i })).toBeInTheDocument();
    });

    it('lets users switch image model tier and passes the selected tier to batch generation', async () => {
        const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
        vi.mocked(CampaignIntelligence.generatePostImages).mockResolvedValueOnce([
            {
                id: 'post-pending-1',
                platform: 'Instagram',
                copy: 'Drop Friday',
                imageAsset: {
                    assetType: 'image',
                    title: 'Cover',
                    imageUrl: 'https://cdn.example.com/new-fast.png',
                    caption: 'Studio glow',
                },
                day: 1,
                status: CampaignStatus.PENDING,
            },
        ]);

        const campaignWithPending: CampaignAsset = {
            ...TEST_CAMPAIGN,
            posts: [
                {
                    id: 'post-pending-1',
                    platform: 'Instagram',
                    copy: 'Drop Friday',
                    imageAsset: { assetType: 'image', title: 'Cover', imageUrl: '', caption: 'Studio glow' },
                    day: 1,
                    status: CampaignStatus.PENDING,
                },
            ],
        };

        render(
            <IntelligenceImageBatchModal
                campaign={campaignWithPending}
                onClose={vi.fn()}
                onComplete={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        const switcher = screen.getByTestId('image-model-switcher');
        expect(switcher).toBeInTheDocument();

        const proBtn = screen.getByRole('button', { name: /Nano Banana Pro/i });
        fireEvent.click(proBtn);
        expect(proBtn).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Generate 1 Images/i }));

        await waitFor(() => {
            expect(CampaignIntelligence.generatePostImages).toHaveBeenCalledWith(
                campaignWithPending.posts,
                expect.any(Function),
                { imageModelTier: 'pro' },
            );
        });
    });
});
