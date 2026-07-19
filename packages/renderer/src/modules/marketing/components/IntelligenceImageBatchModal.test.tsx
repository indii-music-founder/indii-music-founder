import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntelligenceImageBatchModal from './IntelligenceImageBatchModal';
import { CampaignAsset, CampaignStatus } from '../types';

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
});
